import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  ExistingArticleFingerprint,
  FetchedSourceArticle,
  PublicApiCatalogItem,
  PublicApiProviderId,
  SentimentVerdict,
  SourceFetchResponse,
} from '../src/types/news.ts';
import { DEFAULT_PREDEFINED_CATEGORIES } from './newsPipeline.ts';
import { recordApiCall } from './apiQuotaTracker.ts';
import { evaluateBatchWithDedupBot } from './dedupBot.ts';

const MODEL_NAME = 'gemini-4-hydrogen';

export interface RawPublicFeedItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  sourceLabel?: string;
}

export const PUBLIC_API_CATALOG: PublicApiCatalogItem[] = [
  {
    id: 'api-spaceflight',
    name: 'Spaceflight News API (v4)',
    category: 'Khoa học & Công nghệ',
    description:
      'Kho tin tức hàng không vũ trụ, vệ tinh, NASA/SpaceX và khoa học công nghệ cập nhật liên tục.',
    auth: 'Không cần key',
    https: true,
    cors: 'Yes',
    docsUrl: 'https://spaceflightnewsapi.net',
    endpointUrl: 'https://api.spaceflightnewsapi.net/v4/articles/?limit=7',
    liveProviderId: 'spaceflight',
    defaultCategory: 'Khoa học',
  },
  {
    id: 'api-hackernews',
    name: 'Hacker News API (Firebase)',
    category: 'Khoa học & Công nghệ',
    description:
      'Luồng tin công nghệ, AI, kỹ thuật phần mềm và khởi nghiệp hàng đầu từ cộng đồng Y Combinator.',
    auth: 'Không cần key',
    https: true,
    cors: 'Unknown',
    docsUrl: 'https://github.com/HackerNews/API',
    endpointUrl: 'https://hacker-news.firebaseio.com/v0/topstories.json',
    liveProviderId: 'hackernews',
    defaultCategory: 'Công nghệ',
  },
  {
    id: 'api-devto',
    name: 'DEV Community Articles API',
    category: 'Khoa học & Công nghệ',
    description:
      'Bài viết chuyên sâu về phát triển phần mềm, kiến trúc hệ thống, AI và công cụ lập trình.',
    auth: 'Không cần key',
    https: true,
    cors: 'Yes',
    docsUrl: 'https://developers.forem.com/api',
    endpointUrl: 'https://dev.to/api/articles?top=1&per_page=7',
    liveProviderId: 'devto',
    defaultCategory: 'Công nghệ',
  },
  {
    id: 'api-gdelt',
    name: 'GDELT DOC 2.0 Global News API',
    category: 'Tin tức',
    description:
      'Chỉ mục báo chí toàn cầu theo thời gian thực kèm theo dõi sự kiện kinh tế, địa chính trị theo từ khóa.',
    auth: 'Không cần key',
    https: true,
    cors: 'Yes',
    docsUrl: 'https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/',
    endpointUrl:
      'https://api.gdeltproject.org/api/v2/doc/doc?query=Vietnam%20OR%20economy&mode=ArtList&maxrecords=7&format=json',
    liveProviderId: 'gdelt',
    defaultCategory: 'Thế giới',
  },
  {
    id: 'api-noozra',
    name: 'Noozra Headlines',
    category: 'Tin tức',
    description: 'Tiêu đề tin tức miễn phí tổng hợp từ hơn 200 nguồn RSS chọn lọc.',
    auth: 'Không cần key',
    https: true,
    cors: 'Yes',
    docsUrl: 'https://noozra.com/api',
    defaultCategory: 'Thế giới',
  },
  {
    id: 'api-inshorts',
    name: 'Inshorts News API',
    category: 'Tin tức',
    description: 'Tin tức tóm tắt nhanh theo chuyên mục công nghệ, kinh doanh, thế giới.',
    auth: 'Không cần key',
    https: true,
    cors: 'Unknown',
    docsUrl: 'https://github.com/cyberboysumanjay/Inshorts-News-API',
    defaultCategory: 'Thế giới',
  },
  {
    id: 'api-openmeteo',
    name: 'Open-Meteo Forecast API',
    category: 'Dữ liệu mở',
    description: 'Dữ liệu khí tượng & thời tiết toàn cầu không cần khóa API (đang tích hợp trên thanh tiện ích).',
    auth: 'Không cần key',
    https: true,
    cors: 'Yes',
    docsUrl: 'https://open-meteo.com/',
    defaultCategory: 'Khoa học',
  },
  {
    id: 'api-libretranslate',
    name: 'LibreTranslate Open API',
    category: 'Phân tích văn bản',
    description: 'Công cụ dịch đa ngôn ngữ mã nguồn mở phục vụ chuẩn hóa văn bản báo chí.',
    auth: 'Không cần key',
    https: true,
    cors: 'Unknown',
    docsUrl: 'https://libretranslate.com/docs',
    defaultCategory: 'Công nghệ',
  },
  {
    id: 'api-guardian',
    name: 'The Guardian Open Platform',
    category: 'Tin tức',
    description: 'Truy cập kho bài viết, thẻ chủ đề và chuyên mục của nhật báo The Guardian.',
    auth: 'apiKey',
    https: true,
    cors: 'Unknown',
    docsUrl: 'https://open-platform.theguardian.com/',
    defaultCategory: 'Thế giới',
  },
  {
    id: 'api-nytimes',
    name: 'New York Times Developer API',
    category: 'Tin tức',
    description: 'Kho dữ liệu bài viết, tin nổi bật và chuyên mục từ The New York Times.',
    auth: 'apiKey',
    https: true,
    cors: 'Unknown',
    docsUrl: 'https://developer.nytimes.com/',
    defaultCategory: 'Thế giới',
  },
  {
    id: 'api-newsdata',
    name: 'NewsData.io Live News',
    category: 'Tin tức',
    description: 'Dữ liệu tin nóng đa quốc gia với bộ lọc ngôn ngữ, quốc gia và chủ đề.',
    auth: 'apiKey',
    https: true,
    cors: 'Unknown',
    docsUrl: 'https://newsdata.io/docs',
    defaultCategory: 'Thế giới',
  },
  {
    id: 'api-marketaux',
    name: 'MarketAux Financial News',
    category: 'Tin tức',
    description: 'Tin tức thị trường tài chính, chứng khoán kèm gắn thẻ mã cổ phiếu & cảm xúc.',
    auth: 'apiKey',
    https: true,
    cors: 'Yes',
    docsUrl: 'https://www.marketaux.com/',
    defaultCategory: 'Kinh doanh',
  },
  {
    id: 'api-mediastack',
    name: 'Mediastack REST API',
    category: 'Tin tức',
    description: 'REST API tổng hợp tin tức thời sự và blog từ hàng nghìn đầu báo.',
    auth: 'apiKey',
    https: true,
    cors: 'Unknown',
    docsUrl: 'https://mediastack.com',
    defaultCategory: 'Thế giới',
  },
  {
    id: 'api-meaningcloud',
    name: 'MeaningCloud Sentiment Analysis',
    category: 'Phân tích văn bản',
    description: 'API phân tích sắc thái cảm xúc đa ngôn ngữ cho văn bản và tin tức.',
    auth: 'apiKey',
    https: true,
    cors: 'Yes',
    docsUrl: 'https://www.meaningcloud.com/developer/sentiment-analysis',
    defaultCategory: 'Công nghệ',
  },
];

export function detectPublicApiProvider(rawUrl: string): PublicApiProviderId | null {
  const lower = rawUrl.toLowerCase();
  if (lower.includes('api.spaceflightnewsapi.net')) return 'spaceflight';
  if (lower.includes('hacker-news.firebaseio.com')) return 'hackernews';
  if (lower.includes('dev.to/api/articles')) return 'devto';
  if (lower.includes('api.gdeltproject.org')) return 'gdelt';
  return null;
}

const gdeltCache = new Map<string, { items: RawPublicFeedItem[]; expiresAt: number }>();

export async function fetchRawItemsFromPublicApi(
  provider: PublicApiProviderId,
  customQuery?: string
): Promise<RawPublicFeedItem[]> {
  if (provider === 'spaceflight') {
    const start = Date.now();
    const res = await fetch('https://api.spaceflightnewsapi.net/v4/articles/?limit=7', {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json' },
    });
    recordApiCall({
      apiId: 'spaceflight',
      endpoint: '/v4/articles/?limit=7',
      statusCode: res.status,
      ok: res.ok,
      latencyMs: Date.now() - start,
    });
    if (!res.ok) {
      throw new Error(`Spaceflight News API trả về mã lỗi ${res.status}`);
    }
    const data = (await res.json()) as {
      results?: Array<{
        title?: string;
        url?: string;
        published_at?: string;
        summary?: string;
        news_site?: string;
      }>;
    };
    return (data.results || [])
      .filter((r) => r.title && r.url)
      .map((r) => ({
        title: r.title!,
        link: r.url!,
        pubDate: r.published_at || '',
        description: (r.summary || '').slice(0, 400),
        sourceLabel: r.news_site || 'Spaceflight News',
      }));
  }

  if (provider === 'hackernews') {
    const start = Date.now();
    const topRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json', {
      signal: AbortSignal.timeout(7000),
    });
    recordApiCall({
      apiId: 'hackernews',
      endpoint: '/v0/topstories.json + items',
      statusCode: topRes.status,
      ok: topRes.ok,
      latencyMs: Date.now() - start,
    });
    if (!topRes.ok) {
      throw new Error(`Hacker News API trả về mã lỗi ${topRes.status}`);
    }
    const ids = (await topRes.json()) as number[];
    const candidateIds = (Array.isArray(ids) ? ids : []).slice(0, 14);
    const items = await Promise.all(
      candidateIds.map(async (id) => {
        try {
          const itemRes = await fetch(
            `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
            { signal: AbortSignal.timeout(5000) }
          );
          if (!itemRes.ok) return null;
          return (await itemRes.json()) as {
            title?: string;
            url?: string;
            time?: number;
            score?: number;
            descendants?: number;
          };
        } catch {
          return null;
        }
      })
    );

    return items
      .filter(
        (it): it is NonNullable<typeof it> =>
          Boolean(it && it.title && it.url && /^https?:\/\//i.test(it.url))
      )
      .slice(0, 7)
      .map((it) => ({
        title: it.title!,
        link: it.url!,
        pubDate: it.time ? new Date(it.time * 1000).toISOString() : '',
        description: `Điểm cộng đồng Hacker News: ${it.score ?? 0}, ${it.descendants ?? 0} bình luận.`,
        sourceLabel: 'Hacker News',
      }));
  }

  if (provider === 'devto') {
    const start = Date.now();
    const res = await fetch('https://dev.to/api/articles?top=1&per_page=7', {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json' },
    });
    recordApiCall({
      apiId: 'devto',
      endpoint: '/api/articles?top=1&per_page=7',
      statusCode: res.status,
      ok: res.ok,
      latencyMs: Date.now() - start,
    });
    if (!res.ok) {
      throw new Error(`DEV.to API trả về mã lỗi ${res.status}`);
    }
    const data = (await res.json()) as Array<{
      title?: string;
      url?: string;
      published_at?: string;
      description?: string;
      tag_list?: string[];
      positive_reactions_count?: number;
    }>;
    return (Array.isArray(data) ? data : [])
      .filter((a) => a.title && a.url)
      .map((a) => ({
        title: a.title!,
        link: a.url!,
        pubDate: a.published_at || '',
        description: `${a.description || ''} (Tags: ${(a.tag_list || []).join(', ')}; Phản hồi tích cực: ${a.positive_reactions_count ?? 0})`.slice(
          0,
          400
        ),
        sourceLabel: 'DEV Community',
      }));
  }

  // GDELT DOC 2.0
  const queryText = (customQuery || 'Vietnam OR economy OR technology').trim();
  const cacheKey = queryText.toLowerCase();
  const cached = gdeltCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.items;
  }

  const start = Date.now();
  const gdeltUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(
    queryText
  )}&mode=ArtList&maxrecords=7&format=json`;
  const res = await fetch(gdeltUrl, { signal: AbortSignal.timeout(9000) });
  const rawText = await res.text();
  const isJson = res.ok && rawText.trim().startsWith('{');
  recordApiCall({
    apiId: 'gdelt',
    endpoint: `/api/v2/doc/doc?query=${queryText.slice(0, 30)}`,
    statusCode: isJson ? res.status : 429,
    ok: isJson,
    latencyMs: Date.now() - start,
    cooldownSeconds: isJson ? 5 : 10,
  });
  if (!isJson) {
    throw new Error(
      'GDELT đang giới hạn tần suất truy vấn (tối đa 1 lần / 5 giây). Vui lòng thử lại sau vài giây.'
    );
  }
  const parsed = JSON.parse(rawText) as {
    articles?: Array<{
      title?: string;
      url?: string;
      seendate?: string;
      domain?: string;
    }>;
  };
  const items = (parsed.articles || [])
    .filter((a) => a.title && a.url)
    .slice(0, 7)
    .map((a) => ({
      title: a.title!,
      link: a.url!,
      pubDate: a.seendate || '',
      description: `Bài viết từ ${a.domain || 'báo quốc tế'} trong chỉ mục sự kiện GDELT (${queryText}).`,
      sourceLabel: a.domain || 'GDELT News',
    }));

  gdeltCache.set(cacheKey, { items, expiresAt: Date.now() + 60_000 });
  return items;
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

export async function enrichPublicApiItems(
  ai: GoogleGenAI,
  sourceId: string,
  sourceName: string,
  sourceDomain: string,
  defaultCategory: string,
  items: RawPublicFeedItem[]
): Promise<FetchedSourceArticle[]> {
  if (items.length === 0) return [];

  const serialized = items
    .map(
      (it, idx) =>
        `[${idx + 1}] Tiêu đề: ${it.title}\nURL: ${it.link}\nNguồn: ${it.sourceLabel || sourceDomain}\nNgày: ${it.pubDate}\nMô tả: ${it.description}`
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
      contents: `Dưới đây là danh sách các bài báo thực tế lấy từ Public API "${sourceName}".
Hãy xử lý từng mục sang tiếng Việt súc tích:
1. Dịch tiêu đề tự nhiên sang tiếng Việt (giữ thuật ngữ chuyên môn nếu cần).
2. Phân loại vào đúng 1 danh mục trong: [${DEFAULT_PREDEFINED_CATEGORIES.join(', ')}] (mặc định: ${defaultCategory}).
3. Viết tóm tắt ngắn 1 câu và 1 điểm cốt lõi.
4. Chấm cảm xúc ("Tích cực", "Tiêu cực", hoặc "Trung lập") kèm positive + neutral + negative = 100.

Danh sách mục:
${serialized}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    recordApiCall({
      apiId: 'gemini',
      endpoint: 'enrichPublicApiItems',
      statusCode: 200,
      ok: true,
      latencyMs: Date.now() - gemStart,
      detail: `${items.length} mục từ ${sourceName}`,
    });

    const parsed = JSON.parse((response.text || '{}').trim()) as {
      articles?: Array<{
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
    };

    return (parsed.articles || []).map((a, idx) => {
      const orig = items[a.index - 1] || items[idx];
      const scores = normalizeThreeScores(a.positive, a.neutral, a.negative);
      return {
        id: `${sourceId}-${Date.now()}-${idx}`,
        sourceId,
        sourceName: orig?.sourceLabel || sourceName,
        sourceDomain,
        title: a.titleVi || orig?.title || 'Tin từ Public API',
        url: orig?.link || 'https://github.com/public-apis/public-apis',
        publishedRelative: a.publishedRelative || 'Mới cập nhật',
        category: a.category || defaultCategory,
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
      endpoint: 'enrichPublicApiItems',
      statusCode: is429 ? 429 : 500,
      ok: false,
      latencyMs: Date.now() - gemStart,
      cooldownSeconds: is429 ? 45 : 0,
    });
    return items.map((orig, idx) => ({
      id: `${sourceId}-${Date.now()}-${idx}`,
      sourceId,
      sourceName: orig.sourceLabel || sourceName,
      sourceDomain,
      title: orig.title,
      url: orig.link,
      publishedRelative: orig.pubDate ? orig.pubDate.slice(0, 22) : 'Mới cập nhật',
      category: defaultCategory,
      summary: orig.description || orig.title,
      keyTakeaway: orig.description ? orig.description.slice(0, 140) : orig.title,
      sentimentLabel: 'Trung lập',
      sentiment: {
        positive: 30,
        neutral: 50,
        negative: 20,
        toneLabel: 'Dữ liệu API gốc',
      },
    }));
  }
}

export async function fetchPublicApiFeed(
  ai: GoogleGenAI,
  provider: PublicApiProviderId,
  customQuery?: string,
  existingIndex: ExistingArticleFingerprint[] = []
): Promise<SourceFetchResponse> {
  const catalogEntry =
    PUBLIC_API_CATALOG.find((item) => item.liveProviderId === provider) ||
    PUBLIC_API_CATALOG[0];
  const rawItems = await fetchRawItemsFromPublicApi(provider, customQuery);
  const domain = catalogEntry.endpointUrl
    ? new URL(catalogEntry.endpointUrl).hostname.replace(/^www\./, '')
    : 'public-apis';

  const { accepted, report } = evaluateBatchWithDedupBot(
    rawItems.map((it) => ({
      ...it,
      url: it.link,
      sourceName: it.sourceLabel || catalogEntry.name,
    })),
    existingIndex
  );

  const enriched =
    accepted.length > 0
      ? await enrichPublicApiItems(
          ai,
          catalogEntry.id,
          catalogEntry.name,
          domain,
          catalogEntry.defaultCategory,
          accepted.map((a) => ({
            title: a.item.title,
            link: a.item.link,
            pubDate: a.item.pubDate,
            description: a.item.description,
            sourceLabel: a.item.sourceLabel,
          }))
        )
      : [];

  const articles = enriched.map((art, idx) => ({
    ...art,
    dedupStatus: accepted[idx]?.dedupStatus || 'new',
    existingDocId: accepted[idx]?.existingDocId,
    updateReason: accepted[idx]?.updateReason,
  }));

  return {
    fetchedAt: new Date().toISOString(),
    statuses: [
      {
        sourceId: catalogEntry.id,
        sourceName: catalogEntry.name,
        method: 'Public API',
        articleCount: articles.length,
      },
    ],
    articles,
    botReport: report,
  };
}
