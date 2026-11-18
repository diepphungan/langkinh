import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type {
  LabAskArchiveResponse,
  LabClusterArticle,
  LabFactCheckCluster,
  LabFactCheckResponse,
  LabMacroRippleResponse,
  SentimentVerdict,
  StoredNewsArticle,
} from '../src/types/news.ts';
import { isApiInCooldown, recordApiCall } from './apiQuotaTracker.ts';
import { getPublishedArchiveSnapshot } from './newsroomPublisherBot.ts';
import {
  BUILTIN_VN_SECURITIES,
  computeWatchlistStockAnalyticsBatch,
  getMultipleStockQuotes,
} from './ssiMarketService.ts';
import { crawlArticleFromUrl } from './articleCrawler.ts';

const MODEL_NAME = 'gemini-4-hydrogen';

function normalizeVn(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP_WORDS = new Set([
  'cua',
  'cho',
  'voi',
  'cac',
  'nhung',
  'trong',
  'tren',
  'duoi',
  'khi',
  'sau',
  'truoc',
  'nay',
  'nay',
  'moi',
  'tu',
  'den',
  've',
  'va',
  'hay',
  'hoac',
  'la',
  'tai',
  'theo',
  'nhu',
  'da',
  'dang',
  'se',
  'duoc',
  'bi',
  'mot',
  'nhieu',
  'hon',
  'nam',
  'thang',
  'ngay',
  'tuan',
  'gio',
  'tin',
  'bao',
  'bai',
  'viet',
  'noi',
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
]);

function tokenize(text: string): string[] {
  return normalizeVn(text)
    .split(' ')
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

function parseJsonSafe<T>(rawText: string | undefined): T {
  if (!rawText) throw new Error('EMPTY_MODEL_RESPONSE');
  const cleaned = rawText.trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fence?.[1]) return JSON.parse(fence[1].trim()) as T;
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as T;
    throw new Error('INVALID_JSON_FORMAT');
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`GEMINI_TIMEOUT_${label}`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const KNOWN_TICKERS = new Set(BUILTIN_VN_SECURITIES.map((s) => s.symbol));

function extractTickers(text: string): string[] {
  const matches = text.toUpperCase().match(/\b[A-Z]{3,4}\b/g);
  if (!matches) return [];
  const res = new Set<string>();
  for (const m of matches) {
    if (KNOWN_TICKERS.has(m)) res.add(m);
  }
  return Array.from(res).slice(0, 6);
}

function mergeArchivePool(
  clientArticles: Array<
    Pick<
      StoredNewsArticle,
      'id' | 'title' | 'summary' | 'url' | 'sourceName' | 'sentimentLabel' | 'createdAt' | 'publishedRelative' | 'tags'
    >
  > = []
): LabClusterArticle[] {
  const byUrl = new Map<string, LabClusterArticle>();
  const serverNews = getPublishedArchiveSnapshot();

  for (const item of serverNews) {
    const key = item.url.trim().toLowerCase();
    if (!key) continue;
    byUrl.set(key, {
      id: item.id,
      title: item.title,
      summary: item.summary,
      url: item.url,
      sourceName: item.sourceName,
      publishedLabel: item.displayTimestamp || item.publishedRelative || 'Gần đây',
      sentimentLabel: item.sentimentLabel,
      matchedTickers: item.matchedTickers || extractTickers(`${item.title} ${item.summary}`),
    });
  }

  for (const art of clientArticles) {
    const key = (art.url || '').trim().toLowerCase();
    if (!key || !art.title) continue;
    if (!byUrl.has(key)) {
      byUrl.set(key, {
        id: art.id,
        title: art.title,
        summary: art.summary || art.title,
        url: art.url,
        sourceName: art.sourceName || 'Kho Tin',
        publishedLabel: art.publishedRelative || (art.createdAt ? art.createdAt.slice(0, 10) : 'Đã lưu'),
        sentimentLabel: art.sentimentLabel || 'Trung lập',
        matchedTickers: extractTickers(`${art.title} ${art.summary || ''} ${(art.tags || []).join(' ')}`),
      });
    }
  }

  return Array.from(byUrl.values()).slice(0, 300);
}

/* ============================================================================
 * 1. MULTI-SOURCE EVENT CLUSTERING & FACT-CHECK
 * ============================================================================ */

export function buildMultiSourceClusters(
  clientArticles: Array<
    Pick<
      StoredNewsArticle,
      'id' | 'title' | 'summary' | 'url' | 'sourceName' | 'sentimentLabel' | 'createdAt' | 'publishedRelative' | 'tags'
    >
  > = []
): LabFactCheckCluster[] {
  const pool = mergeArchivePool(clientArticles);
  if (pool.length === 0) return [];

  const tokenSets = pool.map((a) => new Set(tokenize(a.title)));
  const used = new Set<number>();
  const clusters: LabFactCheckCluster[] = [];

  for (let i = 0; i < pool.length; i++) {
    if (used.has(i)) continue;
    const base = pool[i];
    const baseTokens = tokenSets[i];
    if (baseTokens.size < 2) continue;

    const groupIdx = [i];
    const sourcesSet = new Set<string>([base.sourceName]);

    for (let j = i + 1; j < pool.length; j++) {
      if (used.has(j)) continue;
      const cand = pool[j];
      const candTokens = tokenSets[j];
      let overlap = 0;
      const sharedWords: string[] = [];
      for (const tok of baseTokens) {
        if (candTokens.has(tok)) {
          overlap++;
          sharedWords.push(tok);
        }
      }
      const union = baseTokens.size + candTokens.size - overlap;
      const jaccard = union > 0 ? overlap / union : 0;
      const sameTicker =
        base.matchedTickers.length > 0 &&
        cand.matchedTickers.some((t) => base.matchedTickers.includes(t)) &&
        overlap >= 2;

      if (jaccard >= 0.24 || overlap >= 4 || sameTicker) {
        groupIdx.push(j);
        sourcesSet.add(cand.sourceName);
        if (groupIdx.length >= 5) break;
      }
    }

    if (groupIdx.length >= 2) {
      groupIdx.forEach((idx) => used.add(idx));
      const articles = groupIdx.map((idx) => pool[idx]);
      const wordCounts = new Map<string, number>();
      for (const idx of groupIdx) {
        for (const w of tokenSets[idx]) {
          wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
        }
      }
      const sharedKeywords = Array.from(wordCounts.entries())
        .filter(([, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([w]) => w);

      clusters.push({
        id: `cluster-${i}-${articles[0].id.slice(0, 8)}`,
        topicTitle: articles[0].title,
        articleCount: articles.length,
        sources: Array.from(sourcesSet),
        sharedKeywords,
        articles,
      });
    }
  }

  // Sort multi-outlet clusters first, then by articleCount
  clusters.sort((a, b) => {
    const scoreA = a.sources.length * 10 + a.articleCount;
    const scoreB = b.sources.length * 10 + b.articleCount;
    return scoreB - scoreA;
  });

  if (clusters.length < 4) {
    // Also provide top distinct high-signal articles so user always has instant choices
    for (let i = 0; i < pool.length && clusters.length < 6; i++) {
      if (used.has(i)) continue;
      const art = pool[i];
      clusters.push({
        id: `single-${i}-${art.id.slice(0, 8)}`,
        topicTitle: art.title,
        articleCount: 1,
        sources: [art.sourceName],
        sharedKeywords: tokenize(art.title).slice(0, 4),
        articles: [art],
      });
    }
  }

  return clusters.slice(0, 8);
}

function buildQuantitativeFactCheckFallback(params: {
  topicHeadline: string;
  articles: LabClusterArticle[];
}): LabFactCheckResponse {
  const articles = params.articles;
  const outlets = Array.from(new Set(articles.map((a) => a.sourceName)));
  const sentiments = new Set(articles.map((a) => a.sentimentLabel));

  const confirmedFacts: string[] = [];
  const allNumbers = new Set<string>();
  for (const a of articles) {
    const nums = `${a.title} ${a.summary}`.match(/\d+(?:[.,]\d+)?\s*(?:%|tỷ|nghìn tỷ|triệu|USD|điểm|phiên)/gi);
    if (nums) nums.slice(0, 2).forEach((n) => allNumbers.add(n.trim()));
  }

  if (articles.length >= 2) {
    confirmedFacts.push(
      `Sự kiện được ${outlets.length} cơ quan báo chí (${outlets.join(', ')}) đồng thời đưa tin xoay quanh chủ đề "${params.topicHeadline}".`
    );
  } else {
    confirmedFacts.push(
      `Nguồn tin gốc từ ${articles[0]?.sourceName || 'báo chí'} ghi nhận: ${articles[0]?.summary || params.topicHeadline}`
    );
  }

  if (allNumbers.size > 0) {
    confirmedFacts.push(
      `Các số liệu định lượng xuất hiện trong cụm tin: ${Array.from(allNumbers).slice(0, 5).join(', ')}.`
    );
  }

  const tickers = Array.from(new Set(articles.flatMap((a) => a.matchedTickers)));
  if (tickers.length > 0) {
    confirmedFacts.push(`Các mã/thực thể niêm yết được nhắc tới: ${tickers.join(', ')}.`);
  }

  const outletDivergences = articles.slice(0, 5).map((a) => ({
    outlet: a.sourceName,
    framing: `Sắc thái ${a.sentimentLabel}`,
    keyDifference: a.summary.slice(0, 190) || a.title,
  }));

  const clickbaitWarnings: string[] = [];
  for (const a of articles) {
    if (/[!?]{2,}|\b(sốc|rúng động|kinh hoàng|vỡ trận|tháo chạy|điên cuồng|bí mật)\b/i.test(a.title)) {
      clickbaitWarnings.push(
        `Tiêu đề từ ${a.sourceName} ("${a.title}") sử dụng ngôn từ mang tính giật tít/cảm xúc mạnh, cần đối chiếu số liệu gốc.`
      );
    }
  }
  if (sentiments.size > 1) {
    clickbaitWarnings.push(
      `Các nguồn báo đang có góc nhìn trái chiều về sắc thái (${Array.from(sentiments).join(' vs ')}).`
    );
  }
  if (articles.length === 1) {
    clickbaitWarnings.push(
      'Hiện mới có 1 nguồn tin trực tiếp; nên đối chiếu thêm văn bản công bố chính thức hoặc báo cáo thứ cấp trước khi ra quyết định.'
    );
  }
  if (clickbaitWarnings.length === 0) {
    clickbaitWarnings.push('Chưa phát hiện dấu hiệu giật tít bất thường hoặc mâu thuẫn số liệu lớn giữa các nguồn.');
  }

  const reliabilityScore = Math.min(
    94,
    Math.max(48, 55 + outlets.length * 11 - (sentiments.size > 1 ? 8 : 0))
  );

  return {
    generatedAt: new Date().toISOString(),
    mode: 'quantitative',
    topicHeadline: params.topicHeadline,
    reliabilityScore,
    verdictLabel:
      outlets.length >= 2 && sentiments.size === 1
        ? 'Đồng thuận cao'
        : sentiments.size > 1
          ? 'Có sai khác góc nhìn'
          : 'Cần kiểm chứng thêm',
    confirmedFacts,
    outletDivergences,
    clickbaitWarnings,
    sourcesUsed: articles.map((a) => ({
      title: a.title,
      url: a.url,
      sourceName: a.sourceName,
    })),
  };
}

export async function runMultiSourceFactCheck(
  ai: GoogleGenAI | null,
  params: {
    topicTitle?: string;
    url?: string;
    articles?: LabClusterArticle[];
  }
): Promise<LabFactCheckResponse> {
  let articles = Array.isArray(params.articles) ? params.articles.slice(0, 6) : [];
  let topicHeadline = params.topicTitle?.trim() || articles[0]?.title || 'Kiểm chứng đa nguồn';

  if (articles.length === 0 && params.url?.trim()) {
    try {
      const crawled = await crawlArticleFromUrl(ai!, params.url.trim(), { runNlp: false });
      topicHeadline = crawled.title || params.url.trim();
      articles = [
        {
          id: `crawl-${Date.now()}`,
          title: crawled.title || params.url.trim(),
          summary: crawled.contentParagraphs.slice(0, 3).join(' ').slice(0, 450) || crawled.title,
          url: params.url.trim(),
          sourceName: crawled.sourceDomain || 'URL',
          publishedLabel: crawled.publishedDate || 'Mới nhập',
          sentimentLabel: 'Trung lập',
          matchedTickers: extractTickers(`${crawled.title} ${crawled.contentParagraphs.join(' ')}`),
        },
      ];
    } catch {
      articles = [
        {
          id: `url-${Date.now()}`,
          title: params.url.trim(),
          summary: params.url.trim(),
          url: params.url.trim(),
          sourceName: 'URL người dùng',
          publishedLabel: 'Mới nhập',
          sentimentLabel: 'Trung lập',
          matchedTickers: [],
        },
      ];
    }
  }

  if (articles.length === 0) {
    throw new Error('Vui lòng chọn cụm sự kiện từ Kho Tin hoặc nhập đường dẫn URL để kiểm chứng.');
  }

  if (!ai || isApiInCooldown('gemini')) {
    return buildQuantitativeFactCheckFallback({ topicHeadline, articles });
  }

  const evidenceBlock = articles
    .map(
      (a, idx) =>
        `[Nguồn ${idx + 1}: ${a.sourceName} | Sắc thái: ${a.sentimentLabel} | ${a.publishedLabel}]\nTiêu đề: ${a.title}\nTóm tắt: ${a.summary}\nURL: ${a.url}`
    )
    .join('\n\n');

  const prompt = `Bạn là Trưởng ban Kiểm chứng Dữ kiện & Soi Độ lệch Báo chí của "Lăng Kính".
Hãy đối chiếu chéo các nguồn tin dưới đây (kèm tra cứu Google Search nếu cần xác minh thêm số liệu gốc) để trả về DUY NHẤT 1 JSON tiếng Việt chuẩn xác:

Chủ đề: ${topicHeadline}

Các nguồn cần đối chiếu:
${evidenceBlock}

Cấu trúc JSON bắt buộc:
{
  "topicHeadline": "Tiêu đề chuẩn xác khách quan nhất cho sự kiện",
  "reliabilityScore": 82,
  "verdictLabel": "Đồng thuận cao" | "Có sai khác góc nhìn" | "Cần kiểm chứng thêm",
  "confirmedFacts": [
    "Sự thật cốt lõi 1 được nhiều nguồn xác nhận kèm số liệu",
    "Sự thật cốt lõi 2"
  ],
  "outletDivergences": [
    {
      "outlet": "Tên báo",
      "framing": "Cách tiếp cận / thiên hướng (vd: Nhấn mạnh rủi ro / Lạc quan chính sách)",
      "keyDifference": "1-2 câu chỉ rõ điểm khác biệt hoặc chi tiết riêng của báo này"
    }
  ],
  "clickbaitWarnings": [
    "Cảnh báo về ngôn từ giật tít, thiếu bối cảnh hoặc chi tiết chưa được kiểm chứng"
  ]
}`;

  const start = Date.now();
  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      }),
      8500,
      'lab-fact-check'
    );

    recordApiCall({
      apiId: 'gemini',
      endpoint: '/api/lab/fact-check',
      statusCode: 200,
      ok: true,
      latencyMs: Date.now() - start,
    });

    const parsed = parseJsonSafe<Partial<LabFactCheckResponse>>(response.text);
    return {
      generatedAt: new Date().toISOString(),
      mode: 'gemini',
      topicHeadline: parsed.topicHeadline?.trim() || topicHeadline,
      reliabilityScore: Math.max(10, Math.min(99, Number(parsed.reliabilityScore) || 78)),
      verdictLabel:
        parsed.verdictLabel === 'Đồng thuận cao' ||
        parsed.verdictLabel === 'Có sai khác góc nhìn' ||
        parsed.verdictLabel === 'Cần kiểm chứng thêm'
          ? parsed.verdictLabel
          : 'Có sai khác góc nhìn',
      confirmedFacts:
        Array.isArray(parsed.confirmedFacts) && parsed.confirmedFacts.length > 0
          ? parsed.confirmedFacts.slice(0, 5)
          : buildQuantitativeFactCheckFallback({ topicHeadline, articles }).confirmedFacts,
      outletDivergences:
        Array.isArray(parsed.outletDivergences) && parsed.outletDivergences.length > 0
          ? parsed.outletDivergences.slice(0, 6)
          : buildQuantitativeFactCheckFallback({ topicHeadline, articles }).outletDivergences,
      clickbaitWarnings:
        Array.isArray(parsed.clickbaitWarnings) && parsed.clickbaitWarnings.length > 0
          ? parsed.clickbaitWarnings.slice(0, 4)
          : ['Không ghi nhận dấu hiệu giật tít nghiêm trọng giữa các đầu báo được đối chiếu.'],
      sourcesUsed: articles.map((a) => ({
        title: a.title,
        url: a.url,
        sourceName: a.sourceName,
      })),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const is429 = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
    recordApiCall({
      apiId: 'gemini',
      endpoint: '/api/lab/fact-check',
      statusCode: is429 ? 429 : 500,
      ok: false,
      latencyMs: Date.now() - start,
      cooldownSeconds: is429 ? 45 : 15,
    });
    return buildQuantitativeFactCheckFallback({ topicHeadline, articles });
  }
}

/* ============================================================================
 * 2. MACRO-TO-TICKER RIPPLE EFFECT (WITH LIVE SSI DATA ENRICHMENT)
 * ============================================================================ */

interface RippleBlueprint {
  macroThesis: string;
  beneficiarySectors: LabMacroRippleResponse['beneficiarySectors'];
  riskSectors: LabMacroRippleResponse['riskSectors'];
  tickers: Array<{ symbol: string; sector: string; impact: 'positive' | 'negative' | 'mixed'; reason: string }>;
}

function buildDeterministicMacroBlueprint(scenario: string): RippleBlueprint {
  const norm = normalizeVn(scenario);

  if (/\b(ty gia|usd|ngoai te|dxy|fed|lai suat)\b/.test(norm)) {
    const isRateCut = /\b(giam lai suat|ha lai suat|noi long)\b/.test(norm);
    if (isRateCut) {
      return {
        macroThesis:
          'Mặt bằng lãi suất hạ nhiệt giúp giảm chi phí vốn doanh nghiệp, kích thích thanh khoản thị trường chứng khoán và cải thiện sức cầu bất động sản, tiêu dùng.',
        beneficiarySectors: [
          { sector: 'Chứng khoán', impactLevel: 'Mạnh', mechanism: 'Dòng tiền rẻ quay lại thị trường cổ phiếu giúp thanh khoản & dư nợ margin mở rộng.' },
          { sector: 'Bất động sản & Thép', impactLevel: 'Mạnh', mechanism: 'Lãi suất vay mua nhà giảm giúp cải thiện khả năng hấp thụ dự án & giải ngân xây dựng.' },
        ],
        riskSectors: [
          { sector: 'Ngân hàng biên lãi mỏng', riskLevel: 'Trung bình', mechanism: 'NIM chịu áp lực ngắn hạn khi lãi suất cho vay giảm nhanh hơn huy động.' },
        ],
        tickers: [
          { symbol: 'SSI', sector: 'Chứng khoán', impact: 'positive', reason: 'Thanh khoản thị trường hưởng lợi trực tiếp từ dòng tiền chi phí thấp.' },
          { symbol: 'VCI', sector: 'Chứng khoán', impact: 'positive', reason: 'Độ nhạy cao với chu kỳ mở rộng thị phần môi giới và tự doanh.' },
          { symbol: 'HPG', sector: 'Thép', impact: 'positive', reason: 'Chi phí lãi vay giảm kết hợp phục hồi xây dựng dân dụng.' },
          { symbol: 'NLG', sector: 'Bất động sản', impact: 'positive', reason: 'Phân khúc nhà ở vừa túi tiền hưởng lợi sớm khi lãi suất vay mua nhà hạ.' },
          { symbol: 'VCB', sector: 'Ngân hàng', impact: 'mixed', reason: 'Chất lượng tài sản đầu ngành nhưng NIM có thể co nhẹ trong ngắn hạn.' },
        ],
      };
    }
    return {
      macroThesis:
        'Áp lực tỷ giá USD/VND hoặc lãi suất neo cao làm tăng chi phí nhập khẩu nguyên liệu và nợ vay USD, nhưng hỗ trợ các doanh nghiệp xuất khẩu thu ngoại tệ ròng.',
      beneficiarySectors: [
        { sector: 'Xuất khẩu Phần mềm & Thủy sản', impactLevel: 'Mạnh', mechanism: 'Doanh thu USD/JPY quy đổi sang VND tăng biên lợi nhuận gộp.' },
        { sector: 'Dầu khí & Cảng biển', impactLevel: 'Trung bình', mechanism: 'Giá cước và hợp đồng thuê giàn neo theo USD được hưởng chênh lệch tỷ giá.' },
      ],
      riskSectors: [
        { sector: 'Hàng không, Điện & Nhập khẩu', riskLevel: 'Cao', mechanism: 'Ghi nhận lỗ chênh lệch tỷ giá từ khoản vay ngoại tệ và chi phí đầu vào USD.' },
        { sector: 'Ngân hàng & Chứng khoán', riskLevel: 'Trung bình', mechanism: 'Tâm lý thận trọng trước khả năng hút ròng tín phiếu điều tiết thanh khoản.' },
      ],
      tickers: [
        { symbol: 'FPT', sector: 'Công nghệ', impact: 'positive', reason: 'Doanh thu xuất khẩu phần mềm nước ngoài hưởng lợi từ tỷ giá USD/VND cao.' },
        { symbol: 'VHC', sector: 'Thủy sản', impact: 'positive', reason: 'Thu ngoại tệ ròng từ thị trường Mỹ và biên gộp cải thiện.' },
        { symbol: 'PVS', sector: 'Dầu khí', impact: 'positive', reason: 'Hợp đồng dịch vụ kỹ thuật dầu khí định giá theo USD.' },
        { symbol: 'POW', sector: 'Điện lực', impact: 'negative', reason: 'Chịu áp lực chi phí khí đầu vào và đánh giá lại nợ vay ngoại tệ.' },
        { symbol: 'SSI', sector: 'Chứng khoán', impact: 'mixed', reason: 'Biến động tỷ giá thường khiến dòng vốn ngoại giao dịch thận trọng hơn.' },
      ],
    };
  }

  if (/\b(thep|hrc|quang sat|xay dung|dau tu cong|ha tang)\b/.test(norm)) {
    return {
      macroThesis:
        'Giá thép thế giới phục hồi hoặc giải ngân đầu tư công tăng tốc giúp các nhà sản xuất thép tích hợp mở rộng biên lợi nhuận nhờ hàng tồn kho giá thấp.',
      beneficiarySectors: [
        { sector: 'Thép & Vật liệu xây dựng', impactLevel: 'Mạnh', mechanism: 'Giá bán HRC/thép xây dựng tăng nhanh hơn chi phí quặng sắt.' },
        { sector: 'Hạ tầng & Xây lắp', impactLevel: 'Trung bình', mechanism: 'Khối lượng nghiệm thu các dự án trọng điểm quốc gia cải thiện dòng tiền.' },
      ],
      riskSectors: [
        { sector: 'Bất động sản biên mỏng', riskLevel: 'Trung bình', mechanism: 'Giá vật liệu đầu vào tăng có thể làm đội chi phí thi công dự án mới.' },
      ],
      tickers: [
        { symbol: 'HPG', sector: 'Thép', impact: 'positive', reason: 'Doanh nghiệp đầu ngành sở hữu chuỗi giá trị khép kín và hưởng lợi trực tiếp từ Dung Quất 2.' },
        { symbol: 'HSG', sector: 'Tôn mạ', impact: 'positive', reason: 'Hàng tồn kho giá rẻ mang lại độ bật biên gộp nhanh khi giá HRC hồi phục.' },
        { symbol: 'NKG', sector: 'Tôn mạ', impact: 'positive', reason: 'Tỷ trọng xuất khẩu cao nhạy với chu kỳ giá thép toàn cầu.' },
        { symbol: 'VCG', sector: 'Xây lắp', impact: 'mixed', reason: 'Hưởng lợi đầu tư công nhưng cần kiểm soát giá vật liệu đầu vào.' },
      ],
    };
  }

  if (/\b(dau|brent|nang luong|khi dot|trung dong|lng)\b/.test(norm)) {
    return {
      macroThesis:
        'Giá dầu thô biến động tăng thúc đẩy hoạt động thăm dò khai thác thượng nguồn (E&P), đồng thời tạo áp lực chi phí nhiên liệu lên nhóm vận tải và sản xuất.',
      beneficiarySectors: [
        { sector: 'Dịch vụ Dầu khí Thượng nguồn', impactLevel: 'Mạnh', mechanism: 'Giá thuê giàn khoan và khối lượng công việc M&C gia tăng.' },
      ],
      riskSectors: [
        { sector: 'Vận tải & Nhựa hóa chất', riskLevel: 'Cao', mechanism: 'Chi phí xăng dầu và hạt nhựa đầu vào tăng làm thu hẹp biên lợi nhuận.' },
      ],
      tickers: [
        { symbol: 'PVS', sector: 'Dầu khí', impact: 'positive', reason: 'Lượng backlog dự án điện gió ngoài khơi & khí Lô B gia tăng.' },
        { symbol: 'PVD', sector: 'Dầu khí', impact: 'positive', reason: 'Hiệu suất sử dụng giàn và giá thuê ngày duy trì ở mức cao.' },
        { symbol: 'GAS', sector: 'Khí đốt', impact: 'positive', reason: 'Giá bán khí neo theo rổ giá dầu nhiên liệu thế giới.' },
        { symbol: 'DGC', sector: 'Hóa chất', impact: 'mixed', reason: 'Chi phí logistics tăng nhẹ nhưng nhu cầu hóa chất công nghiệp ổn định.' },
      ],
    };
  }

  // Default broad macro blueprint (Tech / FDI / Export / Domestic demand)
  return {
    macroThesis:
      'Chuyển dịch chuỗi cung ứng, đầu tư hạ tầng AI/bán dẫn và phục hồi tiêu dùng nội địa tạo sự phân hóa rõ nét: nhóm công nghệ, ngân hàng chất lượng cao và bán lẻ dẫn dắt.',
    beneficiarySectors: [
      { sector: 'Công nghệ & Hạ tầng số', impactLevel: 'Mạnh', mechanism: 'Nhu cầu chuyển đổi số và trung tâm dữ liệu AI duy trì tăng trưởng 2 chữ số.' },
      { sector: 'Ngân hàng & Bán lẻ', impactLevel: 'Trung bình', mechanism: 'Tăng trưởng tín dụng sản xuất kinh doanh và sức mua nội địa hồi phục.' },
    ],
    riskSectors: [
      { sector: 'Doanh nghiệp thâm dụng nợ vay', riskLevel: 'Trung bình', mechanism: 'Áp lực cạnh tranh biên lợi nhuận và chi phí tài chính vẫn cần theo dõi.' },
    ],
    tickers: [
      { symbol: 'FPT', sector: 'Công nghệ', impact: 'positive', reason: 'Đầu tàu xuất khẩu phần mềm và đầu tư hạ tầng AI Cloud tại Việt Nam.' },
      { symbol: 'MWG', sector: 'Bán lẻ', impact: 'positive', reason: 'Hưởng lợi khi sức mua tiêu dùng và tái cấu trúc chuỗi bán lẻ phát huy hiệu quả.' },
      { symbol: 'TCB', sector: 'Ngân hàng', impact: 'positive', reason: 'Tỷ lệ CASA cao giúp tối ưu chi phí vốn khi tín dụng mở rộng.' },
      { symbol: 'HPG', sector: 'Vật liệu', impact: 'positive', reason: 'Đại diện chu kỳ sản xuất công nghiệp và đầu tư hạ tầng.' },
      { symbol: 'SSI', sector: 'Chứng khoán', impact: 'mixed', reason: 'Phản ánh trực tiếp tâm lý dòng tiền và thanh khoản toàn thị trường.' },
    ],
  };
}

export async function runMacroRippleAnalysis(
  ai: GoogleGenAI | null,
  params: {
    scenarioText: string;
    sourceArticleTitle?: string;
  }
): Promise<LabMacroRippleResponse> {
  const scenario = params.scenarioText.trim() || params.sourceArticleTitle?.trim() || 'Tỷ giá USD/VND và mặt bằng lãi suất';
  let blueprint: RippleBlueprint = buildDeterministicMacroBlueprint(scenario);
  let mode: 'gemini' | 'quantitative' = 'quantitative';

  if (ai && !isApiInCooldown('gemini')) {
    const prompt = `Bạn là Giám đốc Chiến lược Vĩ mô & Chứng khoán Việt Nam tại "Lăng Kính".
Hãy lập Bản đồ Tác động Dây chuyền từ kịch bản/tin tức vĩ mô sau tới các nhóm ngành và cổ phiếu niêm yết Việt Nam (HOSE/HNX/UPCOM):

Kịch bản / Sự kiện: "${scenario}"

Trả về DUY NHẤT 1 JSON hợp lệ:
{
  "macroThesis": "2 câu phân tích cơ chế truyền dẫn vĩ mô rõ ràng",
  "beneficiarySectors": [
    { "sector": "Tên ngành hưởng lợi", "impactLevel": "Mạnh" | "Trung bình", "mechanism": "1 câu giải thích cơ chế hưởng lợi" }
  ],
  "riskSectors": [
    { "sector": "Tên ngành chịu rủi ro", "riskLevel": "Cao" | "Trung bình", "mechanism": "1 câu giải thích cơ chế rủi ro" }
  ],
  "tickers": [
    { "symbol": "MÃ_3_CHỮ_HOA", "sector": "Tên ngành", "impact": "positive" | "negative" | "mixed", "reason": "1 câu lý do tác động tới mã này" }
  ]
}
Quy định: Chọn 4-6 mã cổ phiếu Việt Nam thanh khoản cao (VD: FPT, SSI, VCB, TCB, MBB, HPG, HSG, MWG, DGC, PVS, PVD, VHC, GAS, POW, VNM, NLG).`;

    const start = Date.now();
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
        }),
        8000,
        'lab-macro-ripple'
      );
      recordApiCall({
        apiId: 'gemini',
        endpoint: '/api/lab/macro-ripple',
        statusCode: 200,
        ok: true,
        latencyMs: Date.now() - start,
      });

      const parsed = parseJsonSafe<Partial<RippleBlueprint>>(response.text);
      const validTickers = Array.isArray(parsed.tickers)
        ? parsed.tickers
            .filter((t) => t && typeof t.symbol === 'string' && /^[A-Z0-9]{2,6}$/.test(t.symbol.trim().toUpperCase()))
            .map((t) => ({
              symbol: t.symbol.trim().toUpperCase(),
              sector: t.sector?.trim() || 'Thị trường',
              impact: (t.impact === 'positive' || t.impact === 'negative' ? t.impact : 'mixed') as
                | 'positive'
                | 'negative'
                | 'mixed',
              reason: t.reason?.trim() || 'Chịu tác động dây chuyền từ diễn biến vĩ mô.',
            }))
            .slice(0, 6)
        : [];

      if (validTickers.length >= 2) {
        mode = 'gemini';
        blueprint = {
          macroThesis: parsed.macroThesis?.trim() || blueprint.macroThesis,
          beneficiarySectors:
            Array.isArray(parsed.beneficiarySectors) && parsed.beneficiarySectors.length > 0
              ? parsed.beneficiarySectors.slice(0, 3)
              : blueprint.beneficiarySectors,
          riskSectors:
            Array.isArray(parsed.riskSectors) && parsed.riskSectors.length > 0
              ? parsed.riskSectors.slice(0, 3)
              : blueprint.riskSectors,
          tickers: validTickers,
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const is429 = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
      recordApiCall({
        apiId: 'gemini',
        endpoint: '/api/lab/macro-ripple',
        statusCode: is429 ? 429 : 500,
        ok: false,
        latencyMs: Date.now() - start,
        cooldownSeconds: is429 ? 45 : 15,
      });
    }
  }

  // Enrich with real live SSI FastConnect quotes + 4-pillar analytics
  const symbols = blueprint.tickers.map((t) => t.symbol);
  const quotes = await getMultipleStockQuotes(symbols);
  const analytics = await computeWatchlistStockAnalyticsBatch({
    symbols,
    quotes,
    taggedArticles: [],
  });

  const enrichedTickers: LabMacroRippleResponse['impactedTickers'] = blueprint.tickers.map((t) => {
    const q = quotes[t.symbol];
    const an = analytics[t.symbol];
    return {
      symbol: t.symbol,
      companyName: q?.companyName || t.symbol,
      sector: an?.sectorLabel || t.sector,
      impact: t.impact,
      reason: t.reason,
      price: q?.price || 0,
      changePct: q?.changePct || 0,
      rsi14: an?.timing.rsi14 ?? null,
      maPositionLabel: an?.timing.maPositionLabel || 'Đang cập nhật',
      verdict: an?.recommendation.verdict || 'NẮM GIỮ / THEO DÕI',
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    mode,
    scenarioTitle: scenario,
    macroThesis: blueprint.macroThesis,
    beneficiarySectors: blueprint.beneficiarySectors,
    riskSectors: blueprint.riskSectors,
    impactedTickers: enrichedTickers,
  };
}

/* ============================================================================
 * 3. ASK YOUR ARCHIVE (90-DAY KHO TIN RAG SYNTHESIS)
 * ============================================================================ */

export async function runAskArchiveSynthesis(
  ai: GoogleGenAI | null,
  params: {
    question: string;
    clientArticles?: Array<
      Pick<
        StoredNewsArticle,
        'id' | 'title' | 'summary' | 'url' | 'sourceName' | 'sentimentLabel' | 'createdAt' | 'publishedRelative' | 'tags'
      >
    >;
  }
): Promise<LabAskArchiveResponse> {
  const question = params.question.trim();
  if (!question) {
    throw new Error('Vui lòng nhập câu hỏi hoặc chủ đề cần tổng hợp từ Kho Tin.');
  }

  const pool = mergeArchivePool(params.clientArticles || []);
  const qTokens = tokenize(question);
  const qTickers = extractTickers(question.toUpperCase());

  const scored = pool
    .map((art) => {
      const textNorm = normalizeVn(`${art.title} ${art.summary}`);
      let score = 0;
      for (const tok of qTokens) {
        if (textNorm.includes(tok)) score += 3;
      }
      for (const sym of qTickers) {
        if (art.matchedTickers.includes(sym) || art.title.toUpperCase().includes(sym)) {
          score += 8;
        }
      }
      return { art, score };
    })
    .sort((a, b) => b.score - a.score);

  const relevant = scored.filter((s) => s.score > 0).slice(0, 14).map((s) => s.art);
  const finalEvidence = relevant.length > 0 ? relevant : pool.slice(0, 10);

  const buildFallbackReport = (): LabAskArchiveResponse => {
    const posCount = finalEvidence.filter((a) => a.sentimentLabel === 'Tích cực').length;
    const negCount = finalEvidence.filter((a) => a.sentimentLabel === 'Tiêu cực').length;

    return {
      generatedAt: new Date().toISOString(),
      mode: 'quantitative',
      question,
      executiveAnswer:
        relevant.length > 0
          ? `Qua truy xuất ${pool.length} bản tin trong Kho Tin & Newsroom, hệ thống tìm thấy ${relevant.length} bài viết liên quan trực tiếp đến "${question}" (trong đó ${posCount} tin Tích cực, ${negCount} tin Tiêu cực). Trọng tâm tin tức phản ánh diễn biến thực tế từ các nguồn ${Array.from(new Set(finalEvidence.map((a) => a.sourceName))).slice(0, 4).join(', ')}.`
          : `Chưa có bài khớp chính xác toàn bộ từ khóa của câu hỏi trong ${pool.length} tin hiện có; dưới đây là tổng hợp các bản tin thời sự gần nhất để bạn tham khảo.`,
      keyFindings: finalEvidence
        .slice(0, 5)
        .map((a, idx) => `[${idx + 1}] (${a.sourceName} · ${a.sentimentLabel}): ${a.title} — ${a.summary.slice(0, 140)}`),
      timelineHighlights: finalEvidence.slice(0, 5).map((a) => ({
        dateLabel: a.publishedLabel,
        event: a.title,
        sourceName: a.sourceName,
        url: a.url,
      })),
      citations: finalEvidence.map((a, idx) => ({
        index: idx + 1,
        title: a.title,
        sourceName: a.sourceName,
        url: a.url,
        publishedLabel: a.publishedLabel,
        sentimentLabel: a.sentimentLabel,
      })),
      totalArchiveSearched: pool.length,
    };
  };

  if (!ai || isApiInCooldown('gemini') || finalEvidence.length === 0) {
    return buildFallbackReport();
  }

  const evidencePrompt = finalEvidence
    .map(
      (a, idx) =>
        `[${idx + 1}] ${a.title} | Nguồn: ${a.sourceName} | Thời gian: ${a.publishedLabel} | Sắc thái: ${a.sentimentLabel}\nTóm tắt: ${a.summary}\nURL: ${a.url}`
    )
    .join('\n\n');

  const prompt = `Bạn là Trợ lý Nghiên cứu Chuyên đề của "Lăng Kính". Hãy CHỈ dựa trên các tài liệu trích xuất từ Kho Tin dưới đây để trả lời câu hỏi của người dùng bằng tiếng Việt sắc sảo, có trích dẫn [1], [2]...

Câu hỏi: "${question}"

Tài liệu Kho Tin (${finalEvidence.length} bài liên quan nhất trong tổng ${pool.length} bài):
${evidencePrompt}

Trả về DUY NHẤT 1 JSON hợp lệ:
{
  "executiveAnswer": "Báo cáo tổng hợp 3-4 câu trả lời trực diện câu hỏi, kèm trích dẫn [1], [2]...",
  "keyFindings": [
    "Phát hiện chính 1 kèm trích dẫn [x]",
    "Phát hiện chính 2 kèm trích dẫn [y]",
    "Phát hiện chính 3"
  ],
  "timelineHighlights": [
    { "dateLabel": "Thời gian của nguồn", "event": "Diễn biến tóm tắt 1 câu", "sourceIndex": 1 }
  ]
}`;

  const start = Date.now();
  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } },
      }),
      8500,
      'lab-ask-archive'
    );
    recordApiCall({
      apiId: 'gemini',
      endpoint: '/api/lab/ask-archive',
      statusCode: 200,
      ok: true,
      latencyMs: Date.now() - start,
    });

    const parsed = parseJsonSafe<{
      executiveAnswer?: string;
      keyFindings?: string[];
      timelineHighlights?: Array<{ dateLabel?: string; event?: string; sourceIndex?: number }>;
    }>(response.text);

    const fb = buildFallbackReport();
    const timelines = Array.isArray(parsed.timelineHighlights)
      ? parsed.timelineHighlights
          .filter((t) => t && typeof t.event === 'string' && t.event.trim())
          .slice(0, 6)
          .map((t) => {
            const idx = Math.max(0, Math.min(finalEvidence.length - 1, (Number(t.sourceIndex) || 1) - 1));
            const src = finalEvidence[idx];
            return {
              dateLabel: t.dateLabel?.trim() || src.publishedLabel,
              event: t.event!.trim(),
              sourceName: src.sourceName,
              url: src.url,
            };
          })
      : fb.timelineHighlights;

    return {
      generatedAt: new Date().toISOString(),
      mode: 'gemini',
      question,
      executiveAnswer: parsed.executiveAnswer?.trim() || fb.executiveAnswer,
      keyFindings:
        Array.isArray(parsed.keyFindings) && parsed.keyFindings.length > 0
          ? parsed.keyFindings.slice(0, 6)
          : fb.keyFindings,
      timelineHighlights: timelines.length > 0 ? timelines : fb.timelineHighlights,
      citations: fb.citations,
      totalArchiveSearched: pool.length,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const is429 = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
    recordApiCall({
      apiId: 'gemini',
      endpoint: '/api/lab/ask-archive',
      statusCode: is429 ? 429 : 500,
      ok: false,
      latencyMs: Date.now() - start,
      cooldownSeconds: is429 ? 45 : 15,
    });
    return buildFallbackReport();
  }
}
