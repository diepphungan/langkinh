import * as cheerio from 'cheerio';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  DedupBotReport,
  DiscoveredRssFeed,
  ExistingArticleFingerprint,
  FetchedSourceArticle,
  SentimentVerdict,
  SourceFetchResponse,
  SourceFetchStatus,
} from '../src/types/news.ts';
import { DEFAULT_PREDEFINED_CATEGORIES } from './newsPipeline.ts';
import {
  detectPublicApiProvider,
  enrichPublicApiItems,
  fetchRawItemsFromPublicApi,
} from './publicApis.ts';
import { recordApiCall } from './apiQuotaTracker.ts';
import {
  evaluateBatchWithDedupBot,
  type DedupCandidate,
} from './dedupBot.ts';

const MODEL_NAME = 'gemini-4-hydrogen';

export interface SourceInput {
  id: string;
  name: string;
  url: string;
  defaultCategory?: string;
}

export interface RawFeedItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
}

export function validatePublicHttpUrl(rawUrl: string): URL {
  const trimmed = rawUrl.trim();
  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(normalized);

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Chỉ hỗ trợ giao thức http hoặc https.');
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    host.startsWith('169.254.')
  ) {
    throw new Error('Địa chỉ nguồn trang không hợp lệ.');
  }

  return parsed;
}

function stripHtmlAndCdata(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTagValue(block: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = block.match(regex);
  return match?.[1] ? stripHtmlAndCdata(match[1]) : '';
}

export function parseRssOrAtomItems(xmlText: string, maxItems = 7): RawFeedItem[] {
  const items: RawFeedItem[] = [];

  // RSS <item>
  const rssItemMatches = xmlText.match(/<item[\s>][\s\S]*?<\/item>/gi);
  if (rssItemMatches && rssItemMatches.length > 0) {
    for (const block of rssItemMatches.slice(0, maxItems)) {
      const title = extractTagValue(block, 'title');
      const link = extractTagValue(block, 'link');
      const pubDate = extractTagValue(block, 'pubDate');
      const description =
        extractTagValue(block, 'description') || extractTagValue(block, 'content:encoded');
      if (title && link) {
        items.push({ title, link, pubDate, description: description.slice(0, 400) });
      }
    }
    return items;
  }

  // Atom <entry>
  const atomMatches = xmlText.match(/<entry[\s>][\s\S]*?<\/entry>/gi);
  if (atomMatches && atomMatches.length > 0) {
    for (const block of atomMatches.slice(0, maxItems)) {
      const title = extractTagValue(block, 'title');
      const hrefMatch = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
      const link = hrefMatch?.[1] || extractTagValue(block, 'link');
      const pubDate =
        extractTagValue(block, 'updated') || extractTagValue(block, 'published');
      const description =
        extractTagValue(block, 'summary') || extractTagValue(block, 'content');
      if (title && link) {
        items.push({ title, link, pubDate, description: description.slice(0, 400) });
      }
    }
  }

  return items;
}

function inferCategoryFromFeedMeta(label: string, feedUrl: string): string {
  const combined = `${label} ${feedUrl}`.toLowerCase();
  if (combined.includes('kinh-doanh') || combined.includes('kinh doanh') || combined.includes('startup') || combined.includes('bat-dong-san')) {
    return 'Kinh doanh';
  }
  if (combined.includes('so-hoa') || combined.includes('số hóa') || combined.includes('cong-nghe')) {
    return 'Công nghệ';
  }
  if (combined.includes('khoa-hoc') || combined.includes('khoa học')) {
    return 'Khoa học';
  }
  if (combined.includes('the-gioi') || combined.includes('thế giới')) {
    return 'Thế giới';
  }
  if (combined.includes('giai-tri') || combined.includes('giải trí')) {
    return 'Giải trí';
  }
  if (combined.includes('the-thao') || combined.includes('thể thao')) {
    return 'Thể thao';
  }
  if (combined.includes('suc-khoe') || combined.includes('sức khỏe')) {
    return 'Sức khỏe';
  }
  return 'Chính trị & Xã hội';
}

export async function discoverRssFeedsFromDirectory(
  directoryUrl: string
): Promise<DiscoveredRssFeed[]> {
  const parsedBase = validatePublicHttpUrl(directoryUrl);
  const start = Date.now();
  const res = await fetch(parsedBase.toString(), {
    signal: AbortSignal.timeout(7000),
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; LangKinhNewsReader/1.0)',
      Accept: 'text/html,application/xhtml+xml,application/xml',
    },
  });
  const html = await res.text();
  recordApiCall({
    apiId: 'rss',
    endpoint: parsedBase.hostname + parsedBase.pathname,
    statusCode: res.status,
    ok: res.ok,
    latencyMs: Date.now() - start,
    detail: 'Quét danh mục RSS',
  });
  if (!res.ok) {
    throw new Error(`Không thể truy cập trang danh mục RSS (mã ${res.status}).`);
  }

  const $ = cheerio.load(html);
  const domain = parsedBase.hostname.replace(/^www\./, '');
  const seen = new Set<string>();
  const discovered: DiscoveredRssFeed[] = [];

  const addCandidate = (href: string | undefined, rawText: string) => {
    if (!href) return;
    try {
      const absUrl = new URL(href.trim(), parsedBase.toString()).toString();
      if (!/(\.rss|\.xml|\/rss\/|\/feed\/?)/i.test(absUrl)) return;
      if (absUrl === parsedBase.toString()) return;
      if (seen.has(absUrl)) return;
      seen.add(absUrl);

      const cleanedText = rawText.replace(/RSS/gi, '').replace(/\s+/g, ' ').trim();
      const slugFallback = absUrl.split('/').pop()?.replace(/\.(rss|xml)$/i, '') || 'Tin tức';
      const displayName = cleanedText && cleanedText.length >= 2 ? cleanedText : slugFallback;
      discovered.push({
        name: `${domain.split('.')[0].toUpperCase()} — ${displayName}`,
        url: absUrl,
        domain,
        defaultCategory: inferCategoryFromFeedMeta(displayName, absUrl),
      });
    } catch {
      // ignore invalid href
    }
  };

  $('link[type*="rss"], link[type*="atom"]').each((_, el) => {
    addCandidate($(el).attr('href'), $(el).attr('title') || 'RSS Chính');
  });

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && /(\.rss|\.xml|\/rss\/)/i.test(href)) {
      addCandidate(href, $(el).text() || $(el).attr('title') || '');
    }
  });

  return discovered.slice(0, 30);
}

export async function tryFetchRssFeed(url: string, maxItems = 7): Promise<RawFeedItem[]> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6500),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LangKinhNewsReader/1.0)',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html',
      },
    });
    const text = await res.text();
    recordApiCall({
      apiId: 'rss',
      endpoint: new URL(url).hostname + new URL(url).pathname,
      statusCode: res.status,
      ok: res.ok,
      latencyMs: Date.now() - start,
    });
    if (!res.ok) return [];

    if (text.includes('<item') || text.includes('<entry')) {
      return parseRssOrAtomItems(text, maxItems);
    }

    // If user entered an RSS directory page (e.g., https://vnexpress.net/rss), auto-resolve to its primary RSS feed
    const $ = cheerio.load(text);
    const rssLinks: string[] = [];
    $('link[type*="rss"], a[href*=".rss"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) {
        try {
          rssLinks.push(new URL(href, url).toString());
        } catch {
          // ignore
        }
      }
    });

    if (rssLinks.length > 0) {
      const preferred =
        rssLinks.find((l) => l.includes('tin-moi-nhat')) ||
        rssLinks.find((l) => l.includes('tin-noi-bat')) ||
        rssLinks[0];
      const subStart = Date.now();
      const subRes = await fetch(preferred, {
        signal: AbortSignal.timeout(6500),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LangKinhNewsReader/1.0)',
          Accept: 'application/rss+xml, application/xml, text/xml',
        },
      });
      const subText = await subRes.text();
      recordApiCall({
        apiId: 'rss',
        endpoint: new URL(preferred).hostname + new URL(preferred).pathname,
        statusCode: subRes.status,
        ok: subRes.ok,
        latencyMs: Date.now() - subStart,
        detail: 'Tự động giải mã danh mục RSS',
      });
      if (subRes.ok && (subText.includes('<item') || subText.includes('<entry'))) {
        return parseRssOrAtomItems(subText, maxItems);
      }
    }

    return [];
  } catch {
    recordApiCall({
      apiId: 'rss',
      endpoint: url,
      statusCode: 500,
      ok: false,
      latencyMs: Date.now() - start,
    });
    return [];
  }
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
  const total = p + u + n;
  if (total <= 0) {
    return { positive: 33, neutral: 34, negative: 33 };
  }
  const np = Math.round((p / total) * 100);
  const nu = Math.round((u / total) * 100);
  const nn = Math.max(0, 100 - np - nu);
  return { positive: np, neutral: nu, negative: nn };
}

function parseJsonSafe<T>(text: string | undefined): T {
  if (!text) throw new Error('EMPTY_MODEL_RESPONSE');
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fence?.[1]) return JSON.parse(fence[1].trim()) as T;
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1)) as T;
    }
    throw new Error('INVALID_JSON_FORMAT');
  }
}

async function enrichRssItems(
  ai: GoogleGenAI,
  source: SourceInput,
  domain: string,
  rssItems: RawFeedItem[]
): Promise<FetchedSourceArticle[]> {
  const serialized = rssItems
    .map(
      (it, idx) =>
        `[${idx + 1}] Tiêu đề: ${it.title}\nURL: ${it.link}\nNgày: ${it.pubDate}\nMô tả: ${it.description}`
    )
    .join('\n\n');

  const schema = {
    type: Type.OBJECT,
    properties: {
      articles: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            index: { type: Type.INTEGER },
            titleVi: { type: Type.STRING },
            category: { type: Type.STRING },
            summary: { type: Type.STRING },
            keyTakeaway: { type: Type.STRING },
            publishedRelative: { type: Type.STRING },
            sentimentLabel: { type: Type.STRING },
            positive: { type: Type.INTEGER },
            neutral: { type: Type.INTEGER },
            negative: { type: Type.INTEGER },
            toneLabel: { type: Type.STRING },
          },
          required: [
            'index',
            'titleVi',
            'category',
            'summary',
            'keyTakeaway',
            'publishedRelative',
            'sentimentLabel',
            'positive',
            'neutral',
            'negative',
            'toneLabel',
          ],
        },
      },
    },
    required: ['articles'],
  };

  const gemStart = Date.now();
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Dưới đây là danh sách các bài báo thực tế lấy từ nguồn RSS "${source.name}" (${domain}).
Hãy xử lý từng bài bằng tiếng Việt:
1. Giữ nguyên nghĩa tiêu đề (dịch sang tiếng Việt tự nhiên nếu là tiếng Anh).
2. Phân loại vào đúng 1 danh mục trong: [${DEFAULT_PREDEFINED_CATEGORIES.join(', ')}] (gợi ý mặc định: ${source.defaultCategory || 'Tổng hợp'}).
3. Viết tóm tắt ngắn gọn 1-2 câu và 1 điểm cốt lõi.
4. Phân tích cảm xúc thành "Tích cực", "Tiêu cực", hoặc "Trung lập" kèm positive + neutral + negative = 100.

Danh sách bài từ RSS:
${serialized}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    recordApiCall({
      apiId: 'gemini',
      endpoint: 'enrichRssItems',
      statusCode: 200,
      ok: true,
      latencyMs: Date.now() - gemStart,
      detail: `${rssItems.length} bài RSS`,
    });

    const parsed = parseJsonSafe<{
      articles: Array<{
        index: number;
        titleVi: string;
        category: string;
        summary: string;
        keyTakeaway: string;
        publishedRelative: string;
        sentimentLabel: string;
        positive: number;
        neutral: number;
        negative: number;
        toneLabel: string;
      }>;
    }>(response.text);

    return (parsed.articles || []).map((a, idx) => {
      const orig = rssItems[a.index - 1] || rssItems[idx];
      const scores = normalizeThreeScores(a.positive, a.neutral, a.negative);
      return {
        id: `${source.id}-${Date.now()}-${idx}`,
        sourceId: source.id,
        sourceName: source.name,
        sourceDomain: domain,
        title: a.titleVi || orig?.title || 'Tin mới từ nguồn',
        url: orig?.link || source.url,
        publishedRelative: a.publishedRelative || 'Mới cập nhật',
        category: a.category || source.defaultCategory || 'Kinh doanh',
        summary: a.summary || orig?.description || '',
        keyTakeaway: a.keyTakeaway || a.summary || '',
        sentimentLabel: normalizeVerdict(a.sentimentLabel),
        sentiment: {
          ...scores,
          toneLabel: a.toneLabel || normalizeVerdict(a.sentimentLabel),
        },
      };
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const is429 = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
    recordApiCall({
      apiId: 'gemini',
      endpoint: 'enrichRssItems',
      statusCode: is429 ? 429 : 500,
      ok: false,
      latencyMs: Date.now() - gemStart,
      detail: is429 ? 'Giới hạn tần suất (dùng dữ liệu RSS gốc)' : msg.slice(0, 80),
      cooldownSeconds: is429 ? 45 : 0,
    });
    // Graceful resilience: still return genuine RSS items even if Gemini is rate-limited
    return rssItems.map((orig, idx) => ({
      id: `${source.id}-${Date.now()}-${idx}`,
      sourceId: source.id,
      sourceName: source.name,
      sourceDomain: domain,
      title: orig.title,
      url: orig.link,
      publishedRelative: orig.pubDate ? orig.pubDate.slice(0, 22) : 'Mới cập nhật',
      category: source.defaultCategory || inferCategoryFromFeedMeta(orig.title, source.url),
      summary: orig.description || orig.title,
      keyTakeaway: orig.description ? orig.description.slice(0, 140) : orig.title,
      sentimentLabel: 'Trung lập',
      sentiment: {
        positive: 30,
        neutral: 50,
        negative: 20,
        toneLabel: 'Tin gốc RSS (chưa qua AI)',
      },
    }));
  }
}

async function fetchWebSourceViaGemini(
  ai: GoogleGenAI,
  source: SourceInput,
  domain: string
): Promise<FetchedSourceArticle[]> {
  const todayIso = new Date().toISOString().split('T')[0];

  const prompt = `Hôm nay là ${todayIso}. Hãy truy cập và tìm kiếm các tin tức MỚI NHẤT, THỰC TẾ trực tiếp từ trang web nguồn:
- Tên nguồn: ${source.name}
- URL trang nguồn: ${source.url}
- Tên miền: ${domain}

Hãy ưu tiên đọc nội dung từ URL ${source.url} và tìm kiếm bài viết mới trên site:${domain}.
Trả về DUY NHẤT một khối JSON hợp lệ liệt kê 5 bài báo mới nhất từ đúng nguồn trang này theo cấu trúc:
{
  "articles": [
    {
      "title": "Tiêu đề bài báo bằng tiếng Việt (dịch tự nhiên nếu nguồn tiếng Anh)",
      "url": "Đường dẫn đầy đủ đến bài viết (bắt đầu bằng https://)",
      "publishedRelative": "Ví dụ: Hôm nay / 3 giờ trước / 1 ngày trước",
      "category": "Chọn 1 danh mục trong [${DEFAULT_PREDEFINED_CATEGORIES.join(', ')}]",
      "summary": "Tóm tắt ngắn gọn 1-2 câu về nội dung bài báo",
      "keyTakeaway": "1 điểm cốt lõi đáng chú ý nhất",
      "sentimentLabel": "Tích cực" | "Tiêu cực" | "Trung lập",
      "positive": 35,
      "neutral": 45,
      "negative": 20,
      "toneLabel": "Mô tả ngắn giọng điệu bài báo"
    }
  ]
}
Lưu ý: Chỉ lấy các tin thực sự xuất hiện trên nguồn ${domain}. Không bịa đặt đường dẫn URL; nếu không có URL bài chi tiết thì dùng ${source.url}.`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      tools: [{ urlContext: {} }, { googleSearch: {} }],
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  const parsed = parseJsonSafe<{
    articles?: Array<{
      title?: string;
      url?: string;
      publishedRelative?: string;
      category?: string;
      summary?: string;
      keyTakeaway?: string;
      sentimentLabel?: string;
      positive?: number;
      neutral?: number;
      negative?: number;
      toneLabel?: string;
    }>;
  }>(response.text);

  return (parsed.articles || []).slice(0, 6).map((a, idx) => {
    const scores = normalizeThreeScores(a.positive ?? 33, a.neutral ?? 44, a.negative ?? 23);
    const validArticleUrl =
      a.url && /^https?:\/\//i.test(a.url) ? a.url : source.url;
    return {
      id: `${source.id}-${Date.now()}-${idx}`,
      sourceId: source.id,
      sourceName: source.name,
      sourceDomain: domain,
      title: a.title || `Bản tin từ ${source.name}`,
      url: validArticleUrl,
      publishedRelative: a.publishedRelative || 'Mới cập nhật',
      category: a.category || source.defaultCategory || 'Thế giới',
      summary: a.summary || '',
      keyTakeaway: a.keyTakeaway || a.summary || '',
      sentimentLabel: normalizeVerdict(a.sentimentLabel),
      sentiment: {
        ...scores,
        toneLabel: a.toneLabel || normalizeVerdict(a.sentimentLabel),
      },
    };
  });
}

interface TaggedCandidate extends DedupCandidate {
  kind: 'public-api' | 'rss' | 'web';
  sourceId: string;
  sourceDomain: string;
  defaultCategory: string;
  pubDate: string;
  sourceLabel?: string;
  preEnrichedWeb?: FetchedSourceArticle;
}

export async function fetchNewsFromSources(
  ai: GoogleGenAI,
  sources: SourceInput[],
  existingIndex: ExistingArticleFingerprint[] = []
): Promise<SourceFetchResponse> {
  const limited = sources.slice(0, 5);
  const statusMap = new Map<string, SourceFetchStatus>();
  const rawCandidates: TaggedCandidate[] = [];

  await Promise.all(
    limited.map(async (src) => {
      let parsedUrl: URL;
      try {
        parsedUrl = validatePublicHttpUrl(src.url);
      } catch (err) {
        statusMap.set(src.id, {
          sourceId: src.id,
          sourceName: src.name,
          method: 'Trích xuất web',
          articleCount: 0,
          error: err instanceof Error ? err.message : 'URL không hợp lệ.',
        });
        return;
      }

      const domain = parsedUrl.hostname.replace(/^www\./, '');
      const normalizedSource: SourceInput = {
        ...src,
        url: parsedUrl.toString(),
      };

      try {
        const publicProvider = detectPublicApiProvider(normalizedSource.url);
        if (publicProvider) {
          const rawItems = await fetchRawItemsFromPublicApi(publicProvider);
          statusMap.set(src.id, {
            sourceId: src.id,
            sourceName: src.name,
            method: 'Public API',
            articleCount: 0,
          });
          for (const it of rawItems) {
            rawCandidates.push({
              kind: 'public-api',
              sourceId: src.id,
              sourceName: src.name,
              sourceDomain: domain,
              defaultCategory: src.defaultCategory || 'Công nghệ',
              title: it.title,
              url: it.link,
              description: it.description,
              pubDate: it.pubDate,
              sourceLabel: it.sourceLabel,
            });
          }
          return;
        }

        const rssItems = await tryFetchRssFeed(normalizedSource.url);
        if (rssItems.length > 0) {
          statusMap.set(src.id, {
            sourceId: src.id,
            sourceName: src.name,
            method: 'RSS/Atom',
            articleCount: 0,
          });
          for (const it of rssItems) {
            rawCandidates.push({
              kind: 'rss',
              sourceId: src.id,
              sourceName: src.name,
              sourceDomain: domain,
              defaultCategory: src.defaultCategory || 'Chính trị & Xã hội',
              title: it.title,
              url: it.link,
              description: it.description,
              pubDate: it.pubDate,
            });
          }
          return;
        }

        const webArticles = await fetchWebSourceViaGemini(ai, normalizedSource, domain);
        statusMap.set(src.id, {
          sourceId: src.id,
          sourceName: src.name,
          method: 'Trích xuất web',
          articleCount: 0,
        });
        for (const art of webArticles) {
          rawCandidates.push({
            kind: 'web',
            sourceId: src.id,
            sourceName: src.name,
            sourceDomain: domain,
            defaultCategory: src.defaultCategory || 'Thế giới',
            title: art.title,
            url: art.url,
            description: art.summary,
            pubDate: art.publishedRelative,
            preEnrichedWeb: art,
          });
        }
      } catch (err) {
        statusMap.set(src.id, {
          sourceId: src.id,
          sourceName: src.name,
          method: 'Trích xuất web',
          articleCount: 0,
          error: err instanceof Error ? err.message : 'Không thể lấy tin từ nguồn này.',
        });
      }
    })
  );

  // Run Dedup & Update Audit Bot BEFORE AI enrichment to avoid redundant work & duplicates
  const { accepted, report } = evaluateBatchWithDedupBot(rawCandidates, existingIndex);

  // Group accepted candidates by sourceId for batch enrichment
  const grouped = new Map<string, typeof accepted>();
  for (const entry of accepted) {
    const list = grouped.get(entry.item.sourceId) || [];
    list.push(entry);
    grouped.set(entry.item.sourceId, list);
  }

  const allArticles: FetchedSourceArticle[] = [];
  await Promise.all(
    Array.from(grouped.entries()).map(async ([sourceId, entries]) => {
      const sample = entries[0].item;
      const statusEntry = statusMap.get(sourceId);

      if (sample.kind === 'web') {
        const webArts = entries.map((e) => ({
          ...e.item.preEnrichedWeb!,
          dedupStatus: e.dedupStatus,
          existingDocId: e.existingDocId,
          updateReason: e.updateReason,
        }));
        allArticles.push(...webArts);
        if (statusEntry) statusEntry.articleCount = webArts.length;
        return;
      }

      if (sample.kind === 'public-api') {
        const enriched = await enrichPublicApiItems(
          ai,
          sourceId,
          sample.sourceName,
          sample.sourceDomain,
          sample.defaultCategory,
          entries.map((e) => ({
            title: e.item.title,
            link: e.item.url,
            pubDate: e.item.pubDate,
            description: e.item.description,
            sourceLabel: e.item.sourceLabel,
          }))
        );
        const tagged = enriched.map((art, idx) => ({
          ...art,
          dedupStatus: entries[idx]?.dedupStatus || 'new',
          existingDocId: entries[idx]?.existingDocId,
          updateReason: entries[idx]?.updateReason,
        }));
        allArticles.push(...tagged);
        if (statusEntry) statusEntry.articleCount = tagged.length;
        return;
      }

      // RSS kind
      const enriched = await enrichRssItems(
        ai,
        {
          id: sourceId,
          name: sample.sourceName,
          url: entries[0].item.url,
          defaultCategory: sample.defaultCategory,
        },
        sample.sourceDomain,
        entries.map((e) => ({
          title: e.item.title,
          link: e.item.url,
          pubDate: e.item.pubDate,
          description: e.item.description,
        }))
      );
      const tagged = enriched.map((art, idx) => ({
        ...art,
        dedupStatus: entries[idx]?.dedupStatus || 'new',
        existingDocId: entries[idx]?.existingDocId,
        updateReason: entries[idx]?.updateReason,
      }));
      allArticles.push(...tagged);
      if (statusEntry) statusEntry.articleCount = tagged.length;
    })
  );

  const botReport: DedupBotReport = report;
  return {
    fetchedAt: new Date().toISOString(),
    statuses: Array.from(statusMap.values()),
    articles: allArticles,
    botReport,
  };
}
