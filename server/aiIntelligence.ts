import { GoogleGenAI, ThinkingLevel, GenerateContentResponse } from '@google/genai';
import type {
  AiRecommendationResponse,
  AiSuggestedArticle,
  AiSuggestedSource,
  AiTopicRecommendation,
  ExistingArticleFingerprint,
  FetchedSourceArticle,
  GroundingSource,
  NewsCategoryId,
  SentimentVerdict,
  VolatilityAlertItem,
  VolatilityCollectionResponse,
  VolatilityScopeId,
} from '../src/types/news.ts';
import { isApiInCooldown, recordApiCall } from './apiQuotaTracker.ts';
import { evaluateBatchWithDedupBot } from './dedupBot.ts';
import {
  buildLiveRecommendationsFromRssAndContext,
  buildLiveVolatilityFromRssAndGdelt,
} from './fallbackNewsEngine.ts';

const MODEL_NAME = 'gemini-4-hydrogen';

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

const SCOPE_DESCRIPTIONS: Record<VolatilityScopeId, string> = {
  'tat-ca':
    'Tất cả biến động lớn nóng hổi trong 24–48 giờ qua: biến động giá vàng, tỷ giá USD/VND, chứng khoán, lãi suất, chính sách vĩ mô, sự cố công nghệ/an ninh mạng, địa chính trị và thiên tai thời tiết cực đoan.',
  'kinh-te-tai-chinh':
    'Biến động thị trường tài chính – kinh tế: chứng khoán, VN-Index, tỷ giá USD, giá vàng SJC/thế giới, giá dầu, lãi suất ngân hàng trung ương, lạm phát và dòng vốn.',
  'cong-nghe-an-ninh':
    'Biến động công nghệ & an ninh mạng: sự cố hạ tầng cloud/AI, lỗ hổng bảo mật nghiêm trọng, biến động cổ phiếu bán dẫn, quy định AI mới và đột phá công nghệ lớn.',
  'dia-chinh-tri':
    'Biến động địa chính trị & thương mại quốc tế: thuế quan, đứt gãy chuỗi cung ứng, căng thẳng khu vực, trừng phạt kinh tế và hiệp định ngoại giao khẩn.',
  'thoi-tiet-nang-luong':
    'Biến động thời tiết cực đoan, biến đổi khí hậu & năng lượng: bão lũ, cảnh báo thiên tai, mất điện lưới, giá dầu khí, LNG và chuyển dịch năng lượng.',
};

function parseJsonSafe<T>(rawText: string | undefined): T {
  if (!rawText) {
    throw new Error('EMPTY_MODEL_RESPONSE');
  }
  const cleaned = rawText.trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fence?.[1]) {
      return JSON.parse(fence[1].trim()) as T;
    }
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && lastBraceValid(start, end)) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    }
    throw new Error('INVALID_JSON_FORMAT');
  }
}

function lastBraceValid(start: number, end: number): boolean {
  return start !== -1 && end > start;
}

function extractGroundingSources(response: GenerateContentResponse): GroundingSource[] {
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (!Array.isArray(chunks)) return [];
  const seen = new Set<string>();
  const sources: GroundingSource[] = [];
  for (const chunk of chunks) {
    const uri = chunk.web?.uri?.trim();
    const title = chunk.web?.title?.trim();
    if (uri && /^https?:\/\//i.test(uri) && !seen.has(uri)) {
      seen.add(uri);
      let fallbackTitle = uri;
      try {
        fallbackTitle = new URL(uri).hostname.replace(/^www\./i, '');
      } catch {
        // keep uri
      }
      sources.push({
        uri,
        title: title || fallbackTitle,
      });
    }
  }
  return sources.slice(0, 12);
}

function normalizeCategory(cat: string | undefined): NewsCategoryId {
  const valid: NewsCategoryId[] = [
    'tong-hop',
    'viet-nam',
    'kinh-te',
    'cong-nghe',
    'the-gioi',
    'khoa-hoc',
  ];
  if (cat && (valid as string[]).includes(cat)) {
    return cat as NewsCategoryId;
  }
  return 'tong-hop';
}

function normalizeVerdict(raw?: string): SentimentVerdict {
  const lower = (raw || '').toLowerCase();
  if (lower.includes('tích cực') || lower.includes('positive')) return 'Tích cực';
  if (lower.includes('tiêu cực') || lower.includes('negative')) return 'Tiêu cực';
  return 'Trung lập';
}

function normalizeThreeScores(pos: number, neu: number, neg: number) {
  const p = Math.max(0, Math.round(Number(pos) || 0));
  const u = Math.max(0, Math.round(Number(neu) || 0));
  const n = Math.max(0, Math.round(Number(neg) || 0));
  const sum = p + u + n;
  if (sum <= 0) return { positive: 30, neutral: 45, negative: 25 };
  const np = Math.round((p / sum) * 100);
  const nu = Math.round((u / sum) * 100);
  const nn = Math.max(0, 100 - np - nu);
  return { positive: np, neutral: nu, negative: nn };
}

function extractDomainSafe(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return 'news.source';
  }
}

export async function generateAiRecommendations(
  ai: GoogleGenAI,
  params: {
    currentCategory: NewsCategoryId;
    activeQuery?: string;
    recentTopics: string[];
    storedHeadlines: string[];
    enabledSourceDomains: string[];
  }
): Promise<AiRecommendationResponse> {
  const todayIso = new Date().toISOString().split('T')[0];

  const contextLines = [
    `Chuyên mục đang xem: ${params.currentCategory}`,
    params.activeQuery ? `Từ khóa đang tìm: "${params.activeQuery}"` : '',
    params.recentTopics.length > 0
      ? `Chủ đề người dùng quan tâm gần đây: ${params.recentTopics.slice(0, 8).join(' | ')}`
      : '',
    params.storedHeadlines.length > 0
      ? `Một số tiêu đề đã lưu trong Kho Tin: ${params.storedHeadlines.slice(0, 8).join(' | ')}`
      : '',
    params.enabledSourceDomains.length > 0
      ? `Các nguồn trang đang theo dõi: ${params.enabledSourceDomains.slice(0, 8).join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const prompt = `Hôm nay là ${todayIso}. Bạn là hệ thống AI Biên tập & Đề xuất Nội dung của nền tảng tin tức "Lăng Kính".
Dựa trên ngữ cảnh người dùng dưới đây VÀ kết quả tìm kiếm Google Search về các diễn biến thời sự mới nhất hôm nay, hãy đề xuất nội dung giá trị cao mà người đọc nên theo dõi tiếp.

Ngữ cảnh hiện tại của người đọc:
${contextLines}

Trả về DUY NHẤT một khối JSON hợp lệ (không kèm văn bản giải thích bên ngoài) theo cấu trúc:
{
  "personalizedBrief": "1-2 câu ngắn gọn bằng tiếng Việt giải thích AI nhận thấy mối quan tâm nào và đề xuất hướng đọc phù hợp nhất lúc này.",
  "recommendedTopics": [
    {
      "id": "rec-topic-1",
      "angleTitle": "Tên góc tiếp cận / chủ đề đề xuất sắc nét (tối đa 10 từ)",
      "topicQuery": "Từ khóa tìm kiếm tối ưu 2-5 từ để người dùng bấm tổng hợp ngay",
      "suggestedCategory": "tong-hop" | "viet-nam" | "kinh-te" | "cong-nghe" | "the-gioi" | "khoa-hoc",
      "priority": "Nên đọc ngay" | "Mở rộng góc nhìn" | "Theo dõi xu hướng",
      "reason": "1 câu giải thích giá trị thực tiễn của đề xuất này."
    }
  ],
  "suggestedArticles": [
    {
      "title": "Tiêu đề bài báo thực tế tìm được từ Google Search",
      "url": "https://... đường dẫn thực tế tìm được",
      "source": "Tên báo (vd: VnExpress, CafeF, Reuters, Tuổi Trẻ)",
      "category": "Kinh doanh" | "Công nghệ" | "Thế giới" | "Khoa học" | "Chính trị & Xã hội",
      "whyRecommended": "1 câu ngắn vì sao bài này đáng đọc tiếp."
    }
  ],
  "suggestedSources": [
    {
      "name": "Tên nguồn RSS/báo uy tín chưa có trong danh sách đang theo dõi",
      "url": "https://... đường dẫn RSS hợp lệ thực tế (vd: https://vnexpress.net/rss/kinh-doanh.rss)",
      "defaultCategory": "Kinh doanh" | "Công nghệ" | "Thế giới" | "Khoa học",
      "reason": "1 câu lý do nên theo dõi nguồn này."
    }
  ]
}

Quy định bắt buộc:
- Tạo đúng 3-4 phần tử trong "recommendedTopics", 3-4 bài báo thực tế có URL hợp lệ từ kết quả tìm kiếm trong "suggestedArticles", và 2-3 nguồn RSS thực tế trong "suggestedSources".
- Không lặp lại y nguyên các nguồn đã có trong danh sách đang theo dõi nếu đã tồn tại.`;

  if (isApiInCooldown('gemini')) {
    return buildLiveRecommendationsFromRssAndContext(params);
  }

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
      7500,
      'ai-recommend'
    );

    recordApiCall({
      apiId: 'gemini',
      endpoint: '/api/ai/recommend-content',
      statusCode: 200,
      ok: true,
      latencyMs: Date.now() - start,
    });

    const parsed = parseJsonSafe<{
      personalizedBrief?: string;
      recommendedTopics?: Partial<AiTopicRecommendation>[];
      suggestedArticles?: Partial<AiSuggestedArticle>[];
      suggestedSources?: Partial<AiSuggestedSource>[];
    }>(response.text);

    const groundingSources = extractGroundingSources(response);

    const recommendedTopics: AiTopicRecommendation[] = (parsed.recommendedTopics || [])
      .slice(0, 4)
      .map((t, i) => ({
        id: t.id || `ai-topic-${Date.now()}-${i}`,
        angleTitle: t.angleTitle || 'Chủ đề đề xuất mới',
        topicQuery: t.topicQuery || 'Kinh tế vĩ mô',
        suggestedCategory: normalizeCategory(t.suggestedCategory),
        priority:
          t.priority === 'Nên đọc ngay' ||
          t.priority === 'Mở rộng góc nhìn' ||
          t.priority === 'Theo dõi xu hướng'
            ? t.priority
            : 'Nên đọc ngay',
        reason: t.reason || 'Gợi ý dựa trên xu hướng tin tức đang nổi bật.',
      }));

    let suggestedArticles: AiSuggestedArticle[] = (parsed.suggestedArticles || [])
      .filter(
        (a) =>
          typeof a.url === 'string' &&
          /^https?:\/\//i.test(a.url.trim()) &&
          typeof a.title === 'string' &&
          a.title.trim().length > 0
      )
      .slice(0, 4)
      .map((a) => ({
        title: a.title!.trim(),
        url: a.url!.trim(),
        source: a.source?.trim() || extractDomainSafe(a.url!.trim()),
        category: a.category?.trim() || 'Tổng hợp',
        whyRecommended:
          a.whyRecommended?.trim() || 'Bổ sung góc nhìn chuyên sâu liên quan chủ đề quan tâm.',
      }));

    if (suggestedArticles.length === 0 && groundingSources.length > 0) {
      suggestedArticles = groundingSources.slice(0, 3).map((gs) => ({
        title: gs.title,
        url: gs.uri,
        source: extractDomainSafe(gs.uri),
        category: 'Tổng hợp',
        whyRecommended: 'Tài liệu tham chiếu thời sự trực tiếp từ tìm kiếm.',
      }));
    }

    const suggestedSources: AiSuggestedSource[] = (parsed.suggestedSources || [])
      .filter(
        (s) =>
          typeof s.url === 'string' &&
          /^https?:\/\//i.test(s.url.trim()) &&
          typeof s.name === 'string' &&
          s.name.trim().length > 0
      )
      .slice(0, 3)
      .map((s) => ({
        name: s.name!.trim(),
        url: s.url!.trim(),
        defaultCategory: s.defaultCategory?.trim() || 'Kinh doanh',
        reason: s.reason?.trim() || 'Bổ sung tin chuyên sâu cho dòng tin của bạn.',
      }));

    return {
      generatedAt: new Date().toISOString(),
      personalizedBrief:
        parsed.personalizedBrief?.trim() ||
        'Đề xuất tự động dựa trên dòng tin đang theo dõi và dữ liệu Kho Tin.',
      recommendedTopics,
      suggestedArticles,
      suggestedSources,
      groundingSources,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const is429 = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
    const isTimeout = msg.includes('GEMINI_TIMEOUT_');
    recordApiCall({
      apiId: 'gemini',
      endpoint: '/api/ai/recommend-content',
      statusCode: is429 ? 429 : isTimeout ? 504 : 500,
      ok: false,
      latencyMs: Date.now() - start,
      detail: msg.slice(0, 80),
      cooldownSeconds: is429 ? 45 : isTimeout ? 15 : 0,
    });
    return buildLiveRecommendationsFromRssAndContext(params);
  }
}

export async function collectVolatilityNews(
  ai: GoogleGenAI,
  params: {
    focusScope: VolatilityScopeId;
    customKeyword?: string;
    existingIndex?: ExistingArticleFingerprint[];
  }
): Promise<VolatilityCollectionResponse> {
  const todayIso = new Date().toISOString().split('T')[0];
  const scopeDesc = SCOPE_DESCRIPTIONS[params.focusScope] || SCOPE_DESCRIPTIONS['tat-ca'];
  const keywordDirective = params.customKeyword?.trim()
    ? `\nƯu tiên đặc biệt các biến động xoay quanh từ khóa: "${params.customKeyword.trim()}".`
    : '';

  const prompt = `Hôm nay là ${todayIso}. Bạn là Hệ thống AI Radar Tự động Thu thập Tin tức Biến động (Breaking & Volatility News Collector) của tòa soạn "Lăng Kính".
Hãy dùng Google Search để quét các SỰ KIỆN BIẾN ĐỘNG MẠNH, TIN NÓNG ĐỘT BIẾN hoặc THAY ĐỔI CHỈ SỐ ĐÁNG CHÚ Ý mới xảy ra trong 24-48 giờ gần nhất.

Phạm vi quét: ${scopeDesc}${keywordDirective}

Trả về DUY NHẤT một khối JSON hợp lệ bằng tiếng Việt theo cấu trúc:
{
  "volatilityIndexLabel": "Biến động mạnh" | "Chú ý cao" | "Ổn định",
  "marketPulseSummary": "Tóm tắt 2 câu về điểm nóng biến động nổi bật nhất hiện tại.",
  "volatilityAlerts": [
    {
      "id": "vol-1",
      "headline": "Tiêu đề ngắn gọn, chuẩn báo chí về diễn biến biến động (10-16 từ)",
      "sector": "Kinh doanh" | "Công nghệ" | "Thế giới" | "Khoa học" | "Chính trị & Xã hội",
      "volatilityLevel": "Khẩn cấp" | "Biến động cao" | "Đáng chú ý",
      "signalMetric": "Con số/tín hiệu định lượng ngắn (vd: Vàng tăng +2.1%, Lỗi diện rộng, Thuế mới 25%)",
      "impactSummary": "1 câu súc tích về tác động tức thời hoặc hệ quả.",
      "sourceName": "Tên cơ quan báo chí (vd: VnExpress, Reuters, CafeF)",
      "sourceUrl": "https://... đường dẫn bài báo thực tế từ kết quả tìm kiếm",
      "publishedRelative": "Ví dụ: Vừa xong / 2 giờ trước / Hôm nay",
      "sentimentLabel": "Tích cực" | "Tiêu cực" | "Trung lập",
      "positive": 20,
      "neutral": 40,
      "negative": 40
    }
  ]
}

Quy định bắt buộc:
- Thu thập đúng 5-6 sự kiện biến động thực tế tìm được qua Google Search.
- BẮT BUỘC mỗi sự kiện phải kèm đường dẫn bài viết thực tế ("sourceUrl") lấy từ kết quả tìm kiếm Google Search (tuyệt đối không tự bịa URL giả).
- Con số positive + neutral + negative cộng bằng 100.`;

  if (isApiInCooldown('gemini')) {
    return buildLiveVolatilityFromRssAndGdelt(params);
  }

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
      7500,
      'ai-volatility'
    );

    recordApiCall({
      apiId: 'gemini',
      endpoint: `/api/ai/collect-volatility (${params.focusScope})`,
      statusCode: 200,
      ok: true,
      latencyMs: Date.now() - start,
    });

    const parsed = parseJsonSafe<{
      volatilityIndexLabel?: string;
      marketPulseSummary?: string;
      volatilityAlerts?: Array<
        Partial<VolatilityAlertItem> & {
          sentimentLabel?: string;
          positive?: number;
          neutral?: number;
          negative?: number;
        }
      >;
    }>(response.text);

    const groundingSources = extractGroundingSources(response);
    const rawAlerts = Array.isArray(parsed.volatilityAlerts) ? parsed.volatilityAlerts : [];

    // Ensure valid URLs (supplementing from groundingSources if needed)
    const normalizedAlerts: Array<
      VolatilityAlertItem & {
        sentimentLabel: SentimentVerdict;
        scores: { positive: number; neutral: number; negative: number };
      }
    > = rawAlerts.slice(0, 6).map((item, idx) => {
      let validUrl =
        typeof item.sourceUrl === 'string' && /^https?:\/\//i.test(item.sourceUrl.trim())
          ? item.sourceUrl.trim()
          : '';
      if (!validUrl && groundingSources.length > 0) {
        validUrl = groundingSources[idx % groundingSources.length].uri;
      }
      const scores = normalizeThreeScores(
        item.positive ?? 20,
        item.neutral ?? 40,
        item.negative ?? 40
      );
      const verdict = normalizeVerdict(item.sentimentLabel);

      return {
        id: item.id || `vol-${Date.now()}-${idx}`,
        headline: item.headline?.trim() || 'Cập nhật biến động thị trường & thời sự',
        sector: item.sector?.trim() || 'Thế giới',
        volatilityLevel:
          item.volatilityLevel === 'Khẩn cấp' ||
          item.volatilityLevel === 'Biến động cao' ||
          item.volatilityLevel === 'Đáng chú ý'
            ? item.volatilityLevel
            : 'Biến động cao',
        signalMetric: item.signalMetric?.trim() || 'Cần theo dõi sát',
        impactSummary:
          item.impactSummary?.trim() || 'Diễn biến có tác động đáng chú ý tới bối cảnh chung.',
        sourceName:
          item.sourceName?.trim() || (validUrl ? extractDomainSafe(validUrl) : 'Tổng hợp'),
        sourceUrl: validUrl,
        publishedRelative: item.publishedRelative?.trim() || 'Mới cập nhật',
        sentimentLabel: verdict,
        scores,
      };
    });

    const withValidUrls = normalizedAlerts.filter((a) => /^https?:\/\//i.test(a.sourceUrl));

    // Pass through the Deduplication & Content Revision Bot before saving to DB
    const { accepted, report } = evaluateBatchWithDedupBot(
      withValidUrls.map((al) => ({
        title: al.headline,
        url: al.sourceUrl,
        description: `${al.signalMetric}. ${al.impactSummary}`,
        sourceName: al.sourceName,
        alertRef: al,
      })),
      params.existingIndex || []
    );

    const collectedArticles: FetchedSourceArticle[] = accepted.map((entry, idx) => {
      const al = entry.item.alertRef;
      return {
        id: `ai-vol-${Date.now()}-${idx}`,
        sourceId: 'ai-volatility-radar',
        sourceName: al.sourceName,
        sourceDomain: extractDomainSafe(al.sourceUrl),
        title: al.headline,
        url: al.sourceUrl,
        publishedRelative: al.publishedRelative,
        category: al.sector,
        summary: `[${al.volatilityLevel} · ${al.signalMetric}] ${al.impactSummary}`,
        keyTakeaway: al.impactSummary,
        sentimentLabel: al.sentimentLabel,
        sentiment: {
          ...al.scores,
          toneLabel: al.volatilityLevel,
        },
        dedupStatus: entry.dedupStatus,
        existingDocId: entry.existingDocId,
        updateReason: entry.updateReason,
      };
    });

    const volatilityAlerts: VolatilityAlertItem[] = normalizedAlerts.map(
      ({ sentimentLabel: _s, scores: _sc, ...rest }) => rest
    );

    const indexLabel =
      parsed.volatilityIndexLabel === 'Biến động mạnh' ||
      parsed.volatilityIndexLabel === 'Chú ý cao' ||
      parsed.volatilityIndexLabel === 'Ổn định'
        ? parsed.volatilityIndexLabel
        : volatilityAlerts.some((a) => a.volatilityLevel === 'Khẩn cấp')
          ? 'Biến động mạnh'
          : 'Chú ý cao';

    return {
      collectedAt: new Date().toISOString(),
      focusScope: params.focusScope,
      volatilityIndexLabel: indexLabel,
      marketPulseSummary:
        parsed.marketPulseSummary?.trim() ||
        'Tổng hợp các chuyển động đột biến và tín hiệu rủi ro mới nhất.',
      volatilityAlerts,
      collectedArticles,
      botReport: report,
      groundingSources,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const is429 = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
    const isTimeout = msg.includes('GEMINI_TIMEOUT_');
    recordApiCall({
      apiId: 'gemini',
      endpoint: `/api/ai/collect-volatility (${params.focusScope})`,
      statusCode: is429 ? 429 : isTimeout ? 504 : 500,
      ok: false,
      latencyMs: Date.now() - start,
      detail: msg.slice(0, 80),
      cooldownSeconds: is429 ? 45 : isTimeout ? 15 : 0,
    });
    return buildLiveVolatilityFromRssAndGdelt(params);
  }
}
