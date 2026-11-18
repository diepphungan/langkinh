import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, GenerateContentResponse } from '@google/genai';
import type {
  DeepAnalysisReport,
  ExistingArticleFingerprint,
  GroundingSource,
  NewsCategoryId,
  NewsDigestResponse,
  NewsStory,
  SummaryLengthOption,
} from './src/types/news.ts';
import {
  processBatchArticles,
  processSingleArticle,
} from './server/newsPipeline.ts';
import {
  discoverRssFeedsFromDirectory,
  fetchNewsFromSources,
  type SourceInput,
} from './server/newsSources.ts';
import { crawlArticleFromUrl } from './server/articleCrawler.ts';
import {
  fetchPublicApiFeed,
  PUBLIC_API_CATALOG,
} from './server/publicApis.ts';
import {
  getApiUsageSnapshot,
  isApiInCooldown,
  recordApiCall,
} from './server/apiQuotaTracker.ts';
import {
  collectVolatilityNews,
  generateAiRecommendations,
} from './server/aiIntelligence.ts';
import {
  buildLiveAnalysisReportFromUrl,
  buildLiveDigestFromRssAndApis,
} from './server/fallbackNewsEngine.ts';
import {
  computeWatchlistStockAnalyticsBatch,
  getFinanceRuntimeSettingsStatus,
  getMacroBenchmarks,
  getMarketIndices,
  getMultipleStockQuotes,
  getMultiTimeframeChartTechnical,
  getSecuritiesCatalog,
  getSsiAccessToken,
  updateFinanceRuntimeSettings,
} from './server/ssiMarketService.ts';
import {
  analyzeCorporateCashflowTiming,
  analyzeStockFourPerspectives,
  buildAnomalyRadar,
  buildPeerComparisonMatrix,
  diagnoseIntradayErraticMover,
  generateWatchlistHealthSummary,
  predictStockMovement,
  rankPeersWithAi,
  runWatchlistScan,
  scanIntradayErraticMovers,
  synthesizeWatchlistPortfolioStrategy,
} from './server/financeWatchlistService.ts';
import {
  runAutoDiscoveryScan,
  scanCorporateEvents,
  smartDiscoverSource,
  TOPIC_PACK_CATALOG,
} from './server/autoDiscoveryBot.ts';
import {
  getArchiveSize,
  getNewsroomFeed,
  publishFetchedArticlesToFeed,
  publishSocialTrendsToFeed,
} from './server/newsroomPublisherBot.ts';
import { fetchSocialTrendsFeed } from './server/socialTrendsEngine.ts';
import {
  generateNewsroomEdition,
  markEditionDeliveryTimestamps,
  startEditionScheduler,
} from './server/editionBriefingEngine.ts';
import {
  getWebhookChannelsStatus,
  sendEditionToTelegramAndLark,
  sendTestWebhookMessage,
  updateWebhookChannelsConfig,
} from './server/webhookNotifier.ts';
import {
  getPersistedSourcesState,
  hydrateSourcesStoreOnBoot,
  resetSourcesToOfficialDefaults,
  syncSourcesStateToDisk,
  syncWatchlistDynamicSources,
} from './server/persistentSourcesStore.ts';
import {
  DEFAULT_ACTIVE_TOPIC_PACKS,
  normalizeTopicPackIds,
} from './src/lib/defaultSeedSources.ts';
import {
  addCustomAutomationRule,
  deleteCustomAutomationRule,
  getAutomationRulesState,
  resetDefaultAutomationRules,
  runAutomationSandboxTest,
  toggleAutomationRule,
  updateAutomationRuleKeywords,
} from './server/automationRulesEngine.ts';
import {
  buildMultiSourceClusters,
  runAskArchiveSynthesis,
  runMacroRippleAnalysis,
  runMultiSourceFactCheck,
} from './server/intelligenceLabService.ts';
import type {
  AiRecommendationResponse,
  AutomationRule,
  ChartTimeframe,
  CorporateEventItem,
  EditionType,
  FinanceTaggedArticle,
  GeographicRegion,
  IntradayErraticMover,
  NewsroomCategoryBucket,
  NewsroomDatePreset,
  PeerComparisonResponse,
  PeerTimeframe,
  PublicApiProviderId,
  SentimentVerdict,
  StockQuoteSnapshot,
  StoredNewsArticle,
  TopicPackId,
  VolatilityScopeId,
  WatchlistItemConfig,
  WatchlistStockAnalytics,
} from './src/types/news.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
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

const CATEGORY_LABELS: Record<NewsCategoryId, string> = {
  'tong-hop': 'Tin tức tổng hợp nổi bật Việt Nam và thế giới',
  'viet-nam': 'Tin tức Việt Nam (kinh tế, chính sách, xã hội, hạ tầng)',
  'kinh-te': 'Kinh tế, tài chính, chứng khoán, ngân hàng và thị trường',
  'cong-nghe': 'Công nghệ, trí tuệ nhân tạo, bán dẫn và chuyển đổi số',
  'the-gioi': 'Thời sự quốc tế, địa chính trị và ngoại giao toàn cầu',
  'khoa-hoc': 'Khoa học, năng lượng sạch, môi trường và biến đổi khí hậu',
};

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('MISSING_API_KEY');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractGroundingSources(response: GenerateContentResponse): GroundingSource[] {
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (!Array.isArray(chunks)) return [];
  const seen = new Set<string>();
  const sources: GroundingSource[] = [];

  for (const chunk of chunks) {
    const uri = chunk.web?.uri?.trim();
    const title = chunk.web?.title?.trim();
    if (uri && !seen.has(uri)) {
      seen.add(uri);
      sources.push({
        uri,
        title: title || new URL(uri).hostname.replace(/^www\./, ''),
      });
    }
  }
  return sources.slice(0, 14);
}

function parseJsonFromModelText<T>(rawText: string | undefined): T {
  if (!rawText) {
    throw new Error('EMPTY_MODEL_RESPONSE');
  }
  const cleaned = rawText.trim();
  // Try direct parse first
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Extract from ```json ... ``` or first { ... } block
    const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenceMatch?.[1]) {
      return JSON.parse(fenceMatch[1].trim()) as T;
    }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as T;
    }
    throw new Error('INVALID_JSON_FORMAT');
  }
}

function normalizeSentiment(sentiment?: Partial<NewsStory['sentiment']>) {
  const pos = Math.max(0, Math.round(Number(sentiment?.positive ?? 33)));
  const neu = Math.max(0, Math.round(Number(sentiment?.neutral ?? 44)));
  const neg = Math.max(0, Math.round(Number(sentiment?.negative ?? 23)));
  const sum = pos + neu + neg;
  if (sum <= 0) {
    return {
      positive: 34,
      neutral: 44,
      negative: 22,
      toneLabel: sentiment?.toneLabel || 'Cân bằng phân tích',
    };
  }
  const normPos = Math.round((pos / sum) * 100);
  const normNeu = Math.round((neu / sum) * 100);
  const normNeg = Math.max(0, 100 - normPos - normNeu);
  return {
    positive: normPos,
    neutral: normNeu,
    negative: normNeg,
    toneLabel: sentiment?.toneLabel || 'Cân bằng phân tích',
  };
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg === 'MISSING_API_KEY') {
    return {
      status: 500,
      message: 'Chưa cấu hình GEMINI_API_KEY trong phần Settings > Secrets.',
    };
  }
  if (msg.includes('PERMISSION_DENIED') || msg.includes('API_KEY_INVALID') || msg.includes('403') || msg.includes('400')) {
    return {
      status: 400,
      message: 'Khóa API Gemini không hợp lệ hoặc thiếu quyền truy cập. Vui lòng kiểm tra trong Settings > Secrets.',
    };
  }
  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
    return {
      status: 429,
      message: 'Hệ thống đang chạm giới hạn tần suất gọi API. Vui lòng thử lại sau ít phút.',
    };
  }
  return {
    status: 500,
    message: `Không thể hoàn tất tổng hợp tin tức lúc này (${msg.slice(0, 140)}).`,
  };
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const digestCache = new Map<string, CacheEntry<NewsDigestResponse>>();
const aiRecCache = new Map<string, CacheEntry<AiRecommendationResponse>>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const AI_REC_TTL_MS = 3 * 60 * 1000;

function parseExistingItems(raw: unknown): ExistingArticleFingerprint[] {
  if (!Array.isArray(raw)) return [];
  const result: ExistingArticleFingerprint[] = [];
  for (const item of raw.slice(0, 500)) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const url = typeof obj.url === 'string' ? obj.url.trim() : '';
    const title = typeof obj.title === 'string' ? obj.title.trim() : '';
    if (!url || !title) continue;
    result.push({
      id: typeof obj.id === 'string' ? obj.id : url,
      url,
      title,
      summary: typeof obj.summary === 'string' ? obj.summary : '',
    });
  }
  return result;
}

async function startServer() {
  const bootSources = hydrateSourcesStoreOnBoot();
  console.log(
    `[Lang Kinh] Hydrated ${bootSources.state.sources.length} news sources (${bootSources.hadExistingDiskStore ? 'existing disk store' : 'initial official 7-pack seed'})`
  );
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.post('/api/news/aggregate', async (req: Request, res: Response) => {
    try {
      const category = (req.body?.category as NewsCategoryId) || 'tong-hop';
      const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
      const forceRefresh = Boolean(req.body?.forceRefresh);
      const preferredDomains = Array.isArray(req.body?.preferredDomains)
        ? (req.body.preferredDomains as unknown[])
            .filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
            .map((d) => d.trim().toLowerCase())
            .slice(0, 8)
        : [];

      const cacheKey = `${category}::${query.toLowerCase()}::${preferredDomains.join(',')}`;
      const cached = digestCache.get(cacheKey);
      if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
        res.json(cached.data);
        return;
      }

      if (isApiInCooldown('gemini')) {
        const liveFallback = await buildLiveDigestFromRssAndApis(
          category,
          query,
          preferredDomains
        );
        if (liveFallback.stories.length > 0) {
          digestCache.set(cacheKey, {
            data: liveFallback,
            expiresAt: Date.now() + 2 * 60 * 1000,
          });
        }
        res.json(liveFallback);
        return;
      }

      const ai = getAiClient();
      const todayIso = new Date().toISOString().split('T')[0];
      const topicDirective = query
        ? `Chủ đề tìm kiếm cụ thể của người đọc: "${query}". Hãy tìm kiếm và tổng hợp các tin tức mới nhất, đáng chú ý nhất xoay quanh chủ đề này.`
        : `Chuyên mục cần tổng hợp: ${CATEGORY_LABELS[category] || CATEGORY_LABELS['tong-hop']}.`;
      const sourceDirective =
        preferredDomains.length > 0
          ? `\nƯu tiên đặc biệt tìm kiếm và tổng hợp tin tức từ các nguồn trang web sau: ${preferredDomains.map((d) => `site:${d}`).join(' OR ')}.`
          : '';

      const prompt = `Hôm nay là ${todayIso}. Bạn là tổng biên tập và chuyên gia phân tích dữ liệu tin tức của tòa soạn "Lăng Kính".
Hãy sử dụng công cụ tìm kiếm Google Search để tra cứu các sự kiện tin tức THỰC TẾ, MỚI NHẤT trong vài ngày qua.
${topicDirective}${sourceDirective}

Yêu cầu trả về DUY NHẤT một khối JSON hợp lệ (không kèm văn bản giải thích ngoài JSON) theo cấu trúc sau bằng tiếng Việt chuẩn xác, khách quan, súc tích:
{
  "editionSummary": "Tóm tắt bức tranh toàn cảnh 2-3 câu về dòng chảy tin tức nổi bật nhất hiện tại.",
  "dominantThemes": [
    {
      "theme": "Tên chủ đề vĩ mô (tối đa 5 từ)",
      "storyCount": 3,
      "momentum": "Tăng nhanh" | "Ổn định" | "Hạ nhiệt",
      "brief": "1 câu giải thích ngắn gọn vì sao chủ đề này đáng chú ý."
    }
  ],
  "stories": [
    {
      "id": "slug-ngan-khong-dau",
      "title": "Tiêu đề báo chí sắc nét, súc tích (10-16 từ)",
      "deck": "Sapo tóm tắt bối cảnh chính (18-28 từ)",
      "category": "Kinh tế" | "Công nghệ" | "Thế giới" | "Việt Nam" | "Khoa học",
      "visualDesk": "economy" | "tech" | "world" | "climate",
      "publishedRelative": "Ví dụ: Hôm nay / 4 giờ trước / 1 ngày trước",
      "readTimeMinutes": 4,
      "executiveTakeaways": [
        "Điểm cốt lõi thứ nhất kèm số liệu hoặc sự kiện cụ thể",
        "Điểm cốt lõi thứ hai",
        "Điểm cốt lõi thứ ba"
      ],
      "sentiment": {
        "positive": 35,
        "neutral": 45,
        "negative": 20,
        "toneLabel": "Ví dụ: Thận trọng lạc quan / Phân tích dữ liệu / Cảnh báo rủi ro"
      },
      "perspectives": [
        {
          "actor": "Góc nhìn thứ nhất (ví dụ: Giới phân tích thị trường / Cơ quan quản lý)",
          "stance": "Tóm tắt lập trường hoặc trọng tâm phân tích (1-2 câu)"
        },
        {
          "actor": "Góc nhìn thứ hai (ví dụ: Doanh nghiệp / Người tiêu dùng / Quốc tế)",
          "stance": "Tóm tắt lập trường đối chiếu (1-2 câu)"
        }
      ],
      "keyEntities": ["Tên thực thể 1", "Tên thực thể 2", "Tên thực thể 3"],
      "impactLevel": "Cao" | "Trung bình" | "Theo dõi",
      "sourceOutlets": ["Tên cơ quan báo chí 1", "Tên cơ quan báo chí 2"],
      "contextSummary": "Đoạn tổng hợp bối cảnh ngắn (2-3 câu).",
      "articleLinks": [
        {
          "title": "Tiêu đề bài báo thực tế tìm được",
          "url": "https://... đường dẫn thực tế từ kết quả tìm kiếm",
          "source": "Tên báo (vd: VnExpress / Reuters / Tuổi Trẻ)"
        }
      ]
    }
  ]
}

Quy định bắt buộc:
- Tạo đúng 7 tin tức thực tế trong mảng "stories", có chiều sâu và không trùng lặp sự kiện.
- Mỗi phần tử trong "stories" cần kèm 2-3 đường dẫn bài báo thực tế trong "articleLinks" trích xuất từ kết quả tìm kiếm Google Search (không tự bịa URL giả).
- Tạo đúng 3-4 phần tử trong "dominantThemes".
- Các tỷ lệ positive + neutral + negative phải cộng bằng 100.
- Tuyệt đối trung thực với thông tin tìm kiếm được từ Google Search, không bịa đặt số liệu.`;

      const gemStart = Date.now();
      const response = await withTimeout(
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        }),
        9500,
        'news-aggregate'
      );
      recordApiCall({
        apiId: 'gemini',
        endpoint: `/api/news/aggregate (${category})`,
        statusCode: 200,
        ok: true,
        latencyMs: Date.now() - gemStart,
      });

      const parsed = parseJsonFromModelText<{
        editionSummary?: string;
        dominantThemes?: NewsDigestResponse['dominantThemes'];
        stories?: Partial<NewsStory>[];
      }>(response.text);

      const groundingSources = extractGroundingSources(response);

      const stories: NewsStory[] = (parsed.stories || []).map((s, idx) => {
        const rawLinks = Array.isArray(s.articleLinks) ? s.articleLinks : [];
        const validLinks = rawLinks
          .filter(
            (lnk) =>
              lnk &&
              typeof lnk.url === 'string' &&
              /^https?:\/\//i.test(lnk.url.trim()) &&
              typeof lnk.title === 'string' &&
              lnk.title.trim().length > 0
          )
          .map((lnk) => ({
            title: lnk.title.trim(),
            url: lnk.url.trim(),
            source:
              typeof lnk.source === 'string' && lnk.source.trim()
                ? lnk.source.trim()
                : new URL(lnk.url.trim()).hostname.replace(/^www\./, ''),
          }))
          .slice(0, 4);

        // Supplement from groundingSources if model omitted direct URLs
        if (validLinks.length === 0 && groundingSources.length > 0) {
          const fallbackSrc = groundingSources[idx % groundingSources.length];
          validLinks.push({
            title: fallbackSrc.title,
            url: fallbackSrc.uri,
            source: s.sourceOutlets?.[0] || fallbackSrc.title,
          });
        }

        return {
          id: s.id || `story-${Date.now()}-${idx}`,
          title: s.title || 'Bản tin đang cập nhật',
          deck: s.deck || '',
          category: s.category || 'Tổng hợp',
          visualDesk:
            s.visualDesk === 'economy' ||
            s.visualDesk === 'tech' ||
            s.visualDesk === 'world' ||
            s.visualDesk === 'climate'
              ? s.visualDesk
              : 'world',
          publishedRelative: s.publishedRelative || 'Mới cập nhật',
          readTimeMinutes: Math.max(2, Math.min(12, Number(s.readTimeMinutes) || 4)),
          executiveTakeaways: Array.isArray(s.executiveTakeaways)
            ? s.executiveTakeaways.slice(0, 4)
            : [],
          sentiment: normalizeSentiment(s.sentiment),
          perspectives: Array.isArray(s.perspectives) ? s.perspectives.slice(0, 3) : [],
          keyEntities: Array.isArray(s.keyEntities) ? s.keyEntities.slice(0, 5) : [],
          impactLevel:
            s.impactLevel === 'Cao' ||
            s.impactLevel === 'Trung bình' ||
            s.impactLevel === 'Theo dõi'
              ? s.impactLevel
              : 'Trung bình',
          sourceOutlets: Array.isArray(s.sourceOutlets) ? s.sourceOutlets.slice(0, 4) : [],
          contextSummary: s.contextSummary || s.deck || '',
          articleLinks: validLinks,
        };
      });

      const digest: NewsDigestResponse = {
        category,
        query,
        generatedAt: new Date().toISOString(),
        editionSummary:
          parsed.editionSummary ||
          'Tổng hợp các chuyển động nổi bật nhất trong phiên tin tức hiện tại.',
        dominantThemes: Array.isArray(parsed.dominantThemes)
          ? parsed.dominantThemes.slice(0, 4)
          : [],
        stories,
        groundingSources,
      };

      digestCache.set(cacheKey, {
        data: digest,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      res.json(digest);
    } catch (err) {
      const formatted = formatGeminiError(err);
      const isTimeout = err instanceof Error && err.message.includes('GEMINI_TIMEOUT_');
      recordApiCall({
        apiId: 'gemini',
        endpoint: '/api/news/aggregate',
        statusCode: isTimeout ? 504 : formatted.status,
        ok: false,
        latencyMs: 0,
        detail: formatted.message.slice(0, 80),
        cooldownSeconds: formatted.status === 429 ? 45 : isTimeout ? 15 : 0,
      });

      try {
        const category = (req.body?.category as NewsCategoryId) || 'tong-hop';
        const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
        const preferredDomains = Array.isArray(req.body?.preferredDomains)
          ? (req.body.preferredDomains as unknown[])
              .filter((d): d is string => typeof d === 'string' && d.trim().length > 0)
              .map((d) => d.trim().toLowerCase())
              .slice(0, 8)
          : [];
        const liveFallback = await buildLiveDigestFromRssAndApis(
          category,
          query,
          preferredDomains
        );
        if (liveFallback.stories.length > 0) {
          const cacheKey = `${category}::${query.toLowerCase()}::${preferredDomains.join(',')}`;
          digestCache.set(cacheKey, {
            data: liveFallback,
            expiresAt: Date.now() + 2 * 60 * 1000,
          });
          res.json(liveFallback);
          return;
        }
      } catch {
        // Fall through to error response if RSS feeds are also unreachable
      }

      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/news/analyze', async (req: Request, res: Response) => {
    try {
      const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
      const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
      const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
      const topicContext =
        typeof req.body?.topicContext === 'string' ? req.body.topicContext.trim() : '';

      if (!url && !text && !title) {
        res.status(400).json({
          error: 'Vui lòng cung cấp đường dẫn bài báo (URL), nội dung văn bản hoặc chủ đề cần phân tích.',
        });
        return;
      }

      if (isApiInCooldown('gemini')) {
        const fallbackReport = await buildLiveAnalysisReportFromUrl({
          url,
          title,
          text,
          topicContext,
        });
        res.json(fallbackReport);
        return;
      }

      const ai = getAiClient();
      const todayIso = new Date().toISOString().split('T')[0];

      const tools = url
        ? [{ urlContext: {} }, { googleSearch: {} }]
        : [{ googleSearch: {} }];

      const inputBlock = [
        url ? `Đường dẫn bài viết cần đọc và phân tích: ${url}` : '',
        title ? `Tiêu đề sự kiện: ${title}` : '',
        topicContext ? `Bối cảnh tóm tắt: ${topicContext}` : '',
        text ? `Nội dung văn bản người dùng cung cấp:\n"""\n${text.slice(0, 12000)}\n"""` : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      const prompt = `Hôm nay là ${todayIso}. Bạn là nhà phân tích tin tức chuyên sâu của "Lăng Kính".
Hãy đọc kỹ nội dung được cung cấp dưới đây và đối chiếu thêm qua Google Search để lập Hồ sơ Phân tích Chuyên sâu (Deep Analysis Dossier) bằng tiếng Việt.

${inputBlock}

Trả về DUY NHẤT một khối JSON hợp lệ theo đúng cấu trúc:
{
  "headline": "Tiêu đề chuẩn xác của bài viết / sự kiện",
  "sourceSummary": "Mô tả ngắn 1 câu về bản chất nguồn tin hoặc bối cảnh sự kiện",
  "executiveSummary": [
    "Luận điểm điều hành 1 (ngắn gọn, chứa thông tin cốt lõi)",
    "Luận điểm điều hành 2",
    "Luận điểm điều hành 3",
    "Luận điểm điều hành 4"
  ],
  "sentiment": {
    "positive": 30,
    "neutral": 50,
    "negative": 20,
    "toneLabel": "Ví dụ: Trung lập phân tích / Cảnh báo vĩ mô / Lạc quan có điều kiện",
    "objectivityNote": "Nhận xét 1-2 câu về mức độ khách quan, ngôn từ dẫn dắt hoặc thiên kiến tiềm ẩn trong cách đưa tin."
  },
  "perspectives": [
    {
      "stakeholder": "Bên liên quan / Góc nhìn 1",
      "framing": "Cách tiếp cận chính (ví dụ: Ủng hộ tăng trưởng / Lo ngại rủi ro)",
      "summary": "Giải thích 2 câu về lập luận của nhóm này."
    },
    {
      "stakeholder": "Bên liên quan / Góc nhìn 2",
      "framing": "Cách tiếp cận đối chiếu",
      "summary": "Giải thích 2 câu về lập luận đối chiếu."
    },
    {
      "stakeholder": "Bên liên quan / Góc nhìn 3",
      "framing": "Góc nhìn dài hạn / thị trường",
      "summary": "Giải thích 2 câu về tác động cấu trúc."
    }
  ],
  "factChecks": [
    {
      "claim": "Tuyên bố hoặc số liệu đáng chú ý được nêu ra",
      "status": "Đã xác thực" | "Cần đối chiếu" | "Quan điểm / Dự báo",
      "context": "Bối cảnh kiểm chứng dựa trên dữ liệu đối chiếu từ tìm kiếm."
    }
  ],
  "impactHorizon": {
    "shortTerm": "Tác động ngắn hạn (1-3 tháng tới) rõ ràng, thực tế.",
    "longTerm": "Tác động dài hạn (6-24 tháng tới) lên cấu trúc ngành hoặc xã hội.",
    "affectedSectors": ["Lĩnh vực 1", "Lĩnh vực 2", "Lĩnh vực 3"]
  },
  "editorialQuestions": [
    "Câu hỏi gợi mở phân tích sâu 1?",
    "Câu hỏi gợi mở phân tích sâu 2?",
    "Câu hỏi gợi mở phân tích sâu 3?"
  ]
}`;

      const gemStart = Date.now();
      const response = await withTimeout(
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            tools,
            thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
          },
        }),
        9500,
        'news-analyze'
      );
      recordApiCall({
        apiId: 'gemini',
        endpoint: '/api/news/analyze',
        statusCode: 200,
        ok: true,
        latencyMs: Date.now() - gemStart,
      });

      const parsed = parseJsonFromModelText<Partial<DeepAnalysisReport>>(response.text);
      const groundingSources = extractGroundingSources(response);
      const normSent = normalizeSentiment(parsed.sentiment);

      const report: DeepAnalysisReport = {
        id: `analysis-${Date.now()}`,
        analyzedAt: new Date().toISOString(),
        headline: parsed.headline || title || 'Hồ sơ phân tích tin tức',
        sourceSummary:
          parsed.sourceSummary || 'Phân tích tổng hợp đa chiều và đối chiếu bối cảnh.',
        executiveSummary: Array.isArray(parsed.executiveSummary)
          ? parsed.executiveSummary.slice(0, 5)
          : [],
        sentiment: {
          ...normSent,
          objectivityNote:
            parsed.sentiment?.objectivityNote ||
            'Ngôn ngữ đưa tin có sự cân bằng giữa dữ kiện thực tế và nhận định chuyên gia.',
        },
        perspectives: Array.isArray(parsed.perspectives) ? parsed.perspectives.slice(0, 4) : [],
        factChecks: Array.isArray(parsed.factChecks) ? parsed.factChecks.slice(0, 4) : [],
        impactHorizon: {
          shortTerm:
            parsed.impactHorizon?.shortTerm || 'Chưa ghi nhận biến động tức thời đáng kể.',
          longTerm:
            parsed.impactHorizon?.longTerm || 'Cần theo dõi thêm các tín hiệu chính sách tiếp theo.',
          affectedSectors: Array.isArray(parsed.impactHorizon?.affectedSectors)
            ? parsed.impactHorizon.affectedSectors.slice(0, 5)
            : [],
        },
        editorialQuestions: Array.isArray(parsed.editorialQuestions)
          ? parsed.editorialQuestions.slice(0, 3)
          : [],
        groundingSources,
      };

      res.json(report);
    } catch (err) {
      const formatted = formatGeminiError(err);
      const isTimeout = err instanceof Error && err.message.includes('GEMINI_TIMEOUT_');
      recordApiCall({
        apiId: 'gemini',
        endpoint: '/api/news/analyze',
        statusCode: isTimeout ? 504 : formatted.status,
        ok: false,
        latencyMs: 0,
        detail: formatted.message.slice(0, 80),
        cooldownSeconds: formatted.status === 429 ? 45 : isTimeout ? 15 : 0,
      });

      try {
        const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
        const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
        const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
        const topicContext =
          typeof req.body?.topicContext === 'string' ? req.body.topicContext.trim() : '';
        const fallbackReport = await buildLiveAnalysisReportFromUrl({
          url,
          title,
          text,
          topicContext,
        });
        res.json(fallbackReport);
        return;
      } catch {
        // fall through
      }

      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/news/ask', async (req: Request, res: Response) => {
    try {
      const storyTitle = typeof req.body?.storyTitle === 'string' ? req.body.storyTitle.trim() : '';
      const storyContext =
        typeof req.body?.storyContext === 'string' ? req.body.storyContext.trim() : '';
      const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';

      if (!question) {
        res.status(400).json({ error: 'Vui lòng nhập câu hỏi cần giải đáp.' });
        return;
      }

      const ai = getAiClient();
      const prompt = `Bạn là trợ lý biên tập & phân tích thời sự của "Lăng Kính".
Bối cảnh bản tin đang đọc:
- Tiêu đề: ${storyTitle}
- Tóm tắt: ${storyContext}

Câu hỏi của độc giả: "${question}"

Hãy trả lời trực diện, sắc sảo, khách quan bằng tiếng Việt (khoảng 3-5 câu ngắn gọn hoặc 2-3 ý rõ ràng). Nếu cần số liệu hoặc diễn biến mới nhất, hãy dùng Google Search để đối chiếu.`;

      const gemStart = Date.now();
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
      recordApiCall({
        apiId: 'gemini',
        endpoint: '/api/news/ask',
        statusCode: 200,
        ok: true,
        latencyMs: Date.now() - gemStart,
      });

      const sources = extractGroundingSources(response);
      res.json({
        question,
        answer: response.text?.trim() || 'Không thể tạo câu trả lời lúc này.',
        sources: sources.slice(0, 5),
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      recordApiCall({
        apiId: 'gemini',
        endpoint: '/api/news/ask',
        statusCode: formatted.status,
        ok: false,
        latencyMs: 0,
        cooldownSeconds: formatted.status === 429 ? 45 : 0,
      });
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/news/process', async (req: Request, res: Response) => {
    try {
      const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
      const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
      const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
      const categories = Array.isArray(req.body?.categories)
        ? (req.body.categories as unknown[])
            .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
            .map((c) => c.trim())
        : undefined;
      const summaryLength: SummaryLengthOption =
        req.body?.summaryLength === 'ngan' ? 'ngan' : 'tieu-chuan';

      if (!text && !url) {
        res.status(400).json({
          error: 'Vui lòng nhập nội dung bài báo hoặc đường dẫn URL để xử lý.',
        });
        return;
      }

      const ai = getAiClient();
      const gemStart = Date.now();
      const result = await processSingleArticle(ai, {
        title,
        text,
        url,
        categories,
        summaryLength,
      });
      recordApiCall({
        apiId: 'gemini',
        endpoint: '/api/news/process',
        statusCode: 200,
        ok: true,
        latencyMs: Date.now() - gemStart,
      });
      res.json(result);
    } catch (err) {
      const formatted = formatGeminiError(err);
      recordApiCall({
        apiId: 'gemini',
        endpoint: '/api/news/process',
        statusCode: formatted.status,
        ok: false,
        latencyMs: 0,
        cooldownSeconds: formatted.status === 429 ? 45 : 0,
      });
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/news/batch-classify', async (req: Request, res: Response) => {
    try {
      const rawArticles = Array.isArray(req.body?.articles) ? req.body.articles : [];
      const articles = rawArticles
        .map((item: unknown) => {
          if (typeof item === 'string') {
            return { text: item };
          }
          if (item && typeof item === 'object') {
            const obj = item as { title?: unknown; text?: unknown };
            return {
              title: typeof obj.title === 'string' ? obj.title : undefined,
              text: typeof obj.text === 'string' ? obj.text : '',
            };
          }
          return { text: '' };
        })
        .filter((a: { text: string }) => a.text.trim().length > 0);

      if (articles.length === 0) {
        res.status(400).json({
          error: 'Vui lòng nhập ít nhất một bài báo để phân loại hàng loạt.',
        });
        return;
      }

      const categories = Array.isArray(req.body?.categories)
        ? (req.body.categories as unknown[])
            .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
            .map((c) => c.trim())
        : undefined;

      const ai = getAiClient();
      const gemStart = Date.now();
      const result = await processBatchArticles(ai, { articles, categories });
      recordApiCall({
        apiId: 'gemini',
        endpoint: '/api/news/batch-classify',
        statusCode: 200,
        ok: true,
        latencyMs: Date.now() - gemStart,
        detail: `${articles.length} bài`,
      });
      res.json(result);
    } catch (err) {
      const formatted = formatGeminiError(err);
      recordApiCall({
        apiId: 'gemini',
        endpoint: '/api/news/batch-classify',
        statusCode: formatted.status,
        ok: false,
        latencyMs: 0,
        cooldownSeconds: formatted.status === 429 ? 45 : 0,
      });
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/news/fetch-source', async (req: Request, res: Response) => {
    try {
      const rawSources = Array.isArray(req.body?.sources) ? req.body.sources : [];
      const sources: SourceInput[] = rawSources
        .map((item: unknown, idx: number): SourceInput | null => {
          if (!item || typeof item !== 'object') return null;
          const obj = item as {
            id?: unknown;
            name?: unknown;
            url?: unknown;
            defaultCategory?: unknown;
          };
          const url = typeof obj.url === 'string' ? obj.url.trim() : '';
          if (!url) return null;
          return {
            id: typeof obj.id === 'string' && obj.id ? obj.id : `src-${idx}`,
            name: typeof obj.name === 'string' && obj.name.trim() ? obj.name.trim() : url,
            url,
            defaultCategory:
              typeof obj.defaultCategory === 'string' ? obj.defaultCategory.trim() : undefined,
          };
        })
        .filter((s: SourceInput | null): s is SourceInput => s !== null);

      if (sources.length === 0) {
        res.status(400).json({
          error: 'Vui lòng cung cấp ít nhất một nguồn trang hợp lệ để lấy tin.',
        });
        return;
      }

      const existingItems = parseExistingItems(req.body?.existingItems);
      const ai = getAiClient();
      const result = await fetchNewsFromSources(ai, sources, existingItems);
      if (result.articles.length > 0) {
        publishFetchedArticlesToFeed(result.articles, { sourceContext: 'Nguồn trang RSS' });
      }
      res.json(result);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/news/crawl-article', async (req: Request, res: Response) => {
    try {
      const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
      const runNlp = req.body?.runNlp !== false;
      const categories = Array.isArray(req.body?.categories)
        ? (req.body.categories as unknown[])
            .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
            .map((c) => c.trim())
        : undefined;

      if (!url) {
        res.status(400).json({ error: 'Vui lòng nhập đường dẫn URL bài báo cần thu thập.' });
        return;
      }

      const ai = getAiClient();
      const gemStart = Date.now();
      const crawled = await crawlArticleFromUrl(ai, url, { runNlp, categories });
      recordApiCall({
        apiId: 'gemini',
        endpoint: '/api/news/crawl-article',
        statusCode: 200,
        ok: true,
        latencyMs: Date.now() - gemStart,
      });
      res.json(crawled);
    } catch (err) {
      const formatted = formatGeminiError(err);
      recordApiCall({
        apiId: 'gemini',
        endpoint: '/api/news/crawl-article',
        statusCode: formatted.status,
        ok: false,
        latencyMs: 0,
        cooldownSeconds: formatted.status === 429 ? 45 : 0,
      });
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.get('/api/weather', async (req: Request, res: Response) => {
    try {
      const rawCity =
        typeof req.query?.city === 'string' && req.query.city.trim()
          ? req.query.city.trim()
          : 'Ho Chi Minh City';

      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(rawCity)}&count=1&language=vi&format=json`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!geoRes.ok) {
        throw new Error('Không thể tra cứu tọa độ thành phố.');
      }
      const geoData = (await geoRes.json()) as {
        results?: Array<{ name: string; latitude: number; longitude: number }>;
      };
      const firstLoc = geoData.results?.[0];
      if (!firstLoc) {
        res.status(404).json({ error: 'Không tìm thấy địa điểm thời tiết phù hợp.' });
        return;
      }

      const wxStart = Date.now();
      const wxRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${firstLoc.latitude}&longitude=${firstLoc.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`,
        { signal: AbortSignal.timeout(5000) }
      );
      recordApiCall({
        apiId: 'openmeteo',
        endpoint: `/v1/forecast (${firstLoc.name})`,
        statusCode: wxRes.status,
        ok: wxRes.ok,
        latencyMs: Date.now() - wxStart,
      });
      if (!wxRes.ok) {
        throw new Error('Không thể tải dữ liệu thời tiết.');
      }
      const wxData = (await wxRes.json()) as {
        current?: {
          temperature_2m?: number;
          relative_humidity_2m?: number;
          weather_code?: number;
          wind_speed_10m?: number;
        };
      };

      const code = Number(wxData.current?.weather_code ?? 0);
      let conditionLabel = 'Quang mây';
      if (code === 1 || code === 2) conditionLabel = 'Ít mây';
      else if (code === 3) conditionLabel = 'Nhiều mây';
      else if (code >= 45 && code <= 48) conditionLabel = 'Sương mù';
      else if (code >= 51 && code <= 67) conditionLabel = 'Có mưa';
      else if (code >= 80 && code <= 82) conditionLabel = 'Mưa rào';
      else if (code >= 95) conditionLabel = 'Có dông';

      res.json({
        city: firstLoc.name,
        temperatureC: Math.round(Number(wxData.current?.temperature_2m ?? 28)),
        conditionLabel,
        humidityPercent: Math.round(Number(wxData.current?.relative_humidity_2m ?? 70)),
        windKmh: Math.round(Number(wxData.current?.wind_speed_10m ?? 10)),
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Lỗi tải thời tiết.',
      });
    }
  });

  app.post('/api/news/discover-rss', async (req: Request, res: Response) => {
    try {
      const directoryUrl =
        typeof req.body?.url === 'string' && req.body.url.trim()
          ? req.body.url.trim()
          : 'https://vnexpress.net/rss';
      const feeds = await discoverRssFeedsFromDirectory(directoryUrl);
      res.json({ directoryUrl, feeds });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Không thể quét danh mục RSS.',
      });
    }
  });

  app.get('/api/system/api-usage', (_req: Request, res: Response) => {
    res.json(getApiUsageSnapshot());
  });

  app.get('/api/public-apis/catalog', (_req: Request, res: Response) => {
    res.json({ items: PUBLIC_API_CATALOG });
  });

  app.post('/api/public-apis/feed', async (req: Request, res: Response) => {
    try {
      const provider = req.body?.provider as PublicApiProviderId | undefined;
      const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
      if (
        provider !== 'spaceflight' &&
        provider !== 'hackernews' &&
        provider !== 'devto' &&
        provider !== 'gdelt'
      ) {
        res.status(400).json({ error: 'Nguồn Public API không được hỗ trợ.' });
        return;
      }
      const existingItems = parseExistingItems(req.body?.existingItems);
      const ai = getAiClient();
      const result = await fetchPublicApiFeed(ai, provider, query, existingItems);
      if (result.articles.length > 0) {
        publishFetchedArticlesToFeed(result.articles, { sourceContext: `Public API (${provider})` });
      }
      res.json(result);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/ai/recommend-content', async (req: Request, res: Response) => {
    try {
      const currentCategory = (req.body?.currentCategory as NewsCategoryId) || 'tong-hop';
      const activeQuery =
        typeof req.body?.activeQuery === 'string' ? req.body.activeQuery.trim() : '';
      const forceRefresh = Boolean(req.body?.forceRefresh);
      const recentTopics = Array.isArray(req.body?.recentTopics)
        ? (req.body.recentTopics as unknown[])
            .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
            .slice(0, 8)
        : [];
      const storedHeadlines = Array.isArray(req.body?.storedHeadlines)
        ? (req.body.storedHeadlines as unknown[])
            .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
            .slice(0, 8)
        : [];
      const enabledSourceDomains = Array.isArray(req.body?.enabledSourceDomains)
        ? (req.body.enabledSourceDomains as unknown[])
            .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
            .slice(0, 8)
        : [];

      const cacheKey = `${currentCategory}::${activeQuery.toLowerCase()}::${recentTopics.slice(0, 3).join('|')}`;
      const cached = aiRecCache.get(cacheKey);
      if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
        res.json(cached.data);
        return;
      }

      const ai = getAiClient();
      const rec = await generateAiRecommendations(ai, {
        currentCategory,
        activeQuery,
        recentTopics,
        storedHeadlines,
        enabledSourceDomains,
      });

      aiRecCache.set(cacheKey, {
        data: rec,
        expiresAt: Date.now() + AI_REC_TTL_MS,
      });

      res.json(rec);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/ai/collect-volatility', async (req: Request, res: Response) => {
    try {
      const rawScope = req.body?.focusScope as VolatilityScopeId | undefined;
      const validScopes: VolatilityScopeId[] = [
        'tat-ca',
        'kinh-te-tai-chinh',
        'cong-nghe-an-ninh',
        'dia-chinh-tri',
        'thoi-tiet-nang-luong',
      ];
      const focusScope: VolatilityScopeId =
        rawScope && validScopes.includes(rawScope) ? rawScope : 'tat-ca';
      const customKeyword =
        typeof req.body?.customKeyword === 'string' ? req.body.customKeyword.trim() : '';
      const existingItems = parseExistingItems(req.body?.existingItems);

      const ai = getAiClient();
      const result = await collectVolatilityNews(ai, {
        focusScope,
        customKeyword,
        existingIndex: existingItems,
      });
      if (result.collectedArticles.length > 0) {
        publishFetchedArticlesToFeed(result.collectedArticles, {
          sourceContext: 'AI Radar Biến động',
        });
      }
      res.json(result);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  /* --- Tài chính & Chứng khoán: SSI FastConnect Data & Watchlist Endpoints --- */

  app.get('/api/finance/settings', (_req: Request, res: Response) => {
    res.json(getFinanceRuntimeSettingsStatus());
  });

  app.post('/api/finance/settings', async (req: Request, res: Response) => {
    try {
      const ssiConsumerId =
        typeof req.body?.ssiConsumerId === 'string' ? req.body.ssiConsumerId : undefined;
      const ssiConsumerSecret =
        typeof req.body?.ssiConsumerSecret === 'string'
          ? req.body.ssiConsumerSecret
          : undefined;
      const clearSsiCredentials = Boolean(req.body?.clearSsiCredentials);
      const webhookUrl =
        typeof req.body?.webhookUrl === 'string' ? req.body.webhookUrl : undefined;
      const testConnection = Boolean(req.body?.testConnection);

      const status = updateFinanceRuntimeSettings({
        ssiConsumerId,
        ssiConsumerSecret,
        clearSsiCredentials,
        webhookUrl,
      });

      if (testConnection && status.ssiConfigured) {
        try {
          await getSsiAccessToken();
          const refreshedStatus = getFinanceRuntimeSettingsStatus();
          res.json({
            ...refreshedStatus,
            testResult: 'Đã xác thực SSI FastConnect Data thành công.',
          });
          return;
        } catch (err) {
          res.status(400).json({
            ...getFinanceRuntimeSettingsStatus(),
            error:
              err instanceof Error
                ? err.message
                : 'Xác thực SSI FastConnect thất bại. Vui lòng kiểm tra Consumer ID / Secret.',
          });
          return;
        }
      }

      res.json(status);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Không thể cập nhật cài đặt tài chính.',
      });
    }
  });

  app.get('/api/finance/securities', async (req: Request, res: Response) => {
    try {
      const force = req.query?.refresh === '1';
      const catalog = await getSecuritiesCatalog(force);
      res.json(catalog);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Không thể tải danh mục mã chứng khoán.',
      });
    }
  });

  app.post('/api/finance/overview', async (req: Request, res: Response) => {
    try {
      const rawSymbols = Array.isArray(req.body?.symbols) ? req.body.symbols : [];
      const symbols = rawSymbols
        .filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0)
        .map((s: string) => s.trim().toUpperCase())
        .slice(0, 20);
      const taggedArticles = Array.isArray(req.body?.taggedArticles)
        ? (req.body.taggedArticles as FinanceTaggedArticle[]).slice(0, 50)
        : [];
      const storedArticles = Array.isArray(req.body?.storedArticles)
        ? (req.body.storedArticles as Array<
            Pick<StoredNewsArticle, 'title' | 'summary' | 'sentimentLabel'>
          >).slice(0, 60)
        : [];

      const [indicesRes, macroQuotes, quotes] = await Promise.all([
        getMarketIndices(),
        getMacroBenchmarks().catch(() => []),
        getMultipleStockQuotes(symbols),
      ]);

      const analytics = await computeWatchlistStockAnalyticsBatch({
        symbols,
        quotes,
        taggedArticles,
        storedArticles,
      }).catch(() => ({} as Record<string, WatchlistStockAnalytics>));

      const mode =
        indicesRes.sourceMode === 'ssi' ||
        Object.values(quotes).some((q) => q.sourceMode === 'ssi')
          ? 'ssi'
          : 'fallback';

      res.json({
        fetchedAt: new Date().toISOString(),
        marketDataMode: mode,
        warningNote:
          mode === 'fallback'
            ? 'Đang dùng dữ liệu giá dự phòng (VPS/VNDirect). Nhập SSI Consumer ID & Secret trong Cài đặt để bật luồng SSI FastConnect chính thống.'
            : undefined,
        indices: indicesRes.indices,
        macroQuotes,
        quotes,
        analytics,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Không thể tải dữ liệu thị trường.',
      });
    }
  });

  app.post('/api/finance/watchlist-scan', async (req: Request, res: Response) => {
    try {
      const watchlist = Array.isArray(req.body?.watchlist)
        ? (req.body.watchlist as WatchlistItemConfig[])
        : [];
      const existingIndex = parseExistingItems(req.body?.existingItems);
      const dedupBotEnabled = req.body?.dedupBotEnabled !== false;

      const scanResult = await runWatchlistScan({
        watchlist,
        existingIndex,
        dedupBotEnabled,
      });
      if (scanResult.fetchedForStorage.length > 0) {
        publishFetchedArticlesToFeed(scanResult.fetchedForStorage, {
          watchlistSymbols: watchlist.map((w) => w.symbol),
          sourceContext: 'Watchlist Scan',
        });
      }
      res.json(scanResult);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Không thể quét Watchlist lúc này.',
      });
    }
  });

  app.post('/api/finance/watchlist-summary', async (req: Request, res: Response) => {
    try {
      const watchlist = Array.isArray(req.body?.watchlist)
        ? (req.body.watchlist as WatchlistItemConfig[])
        : [];
      const quotes =
        req.body?.quotes && typeof req.body.quotes === 'object'
          ? (req.body.quotes as Record<string, StockQuoteSnapshot>)
          : {};
      const taggedArticles = Array.isArray(req.body?.taggedArticles)
        ? (req.body.taggedArticles as FinanceTaggedArticle[])
        : [];

      const summary = await generateWatchlistHealthSummary({
        watchlist,
        quotes,
        taggedArticles,
      });
      res.json(summary);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Không thể tạo tóm tắt Watchlist.',
      });
    }
  });

  app.post('/api/finance/watchlist-strategy', async (req: Request, res: Response) => {
    try {
      const watchlist = Array.isArray(req.body?.watchlist)
        ? (req.body.watchlist as WatchlistItemConfig[])
        : [];
      const quotes =
        req.body?.quotes && typeof req.body.quotes === 'object'
          ? (req.body.quotes as Record<string, StockQuoteSnapshot>)
          : {};
      const analytics =
        req.body?.analytics && typeof req.body.analytics === 'object'
          ? (req.body.analytics as Record<string, WatchlistStockAnalytics>)
          : undefined;
      const taggedArticles = Array.isArray(req.body?.taggedArticles)
        ? (req.body.taggedArticles as FinanceTaggedArticle[]).slice(0, 50)
        : [];
      const storedArticles = Array.isArray(req.body?.storedArticles)
        ? (req.body.storedArticles as Array<
            Pick<StoredNewsArticle, 'title' | 'summary' | 'sentimentLabel'>
          >).slice(0, 60)
        : [];
      const forceRefresh = req.body?.forceRefresh === true;

      const strategy = await synthesizeWatchlistPortfolioStrategy({
        watchlist,
        quotes,
        analytics,
        taggedArticles,
        storedArticles,
        forceRefresh,
      });
      res.json(strategy);
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Không thể tổng hợp chiến lược danh mục Watchlist.',
      });
    }
  });

  app.post('/api/finance/stock-predict', async (req: Request, res: Response) => {
    try {
      const symbol =
        typeof req.body?.symbol === 'string' ? req.body.symbol.trim().toUpperCase() : '';
      if (!symbol || !/^[A-Z0-9]{1,12}$/.test(symbol)) {
        res.status(400).json({ error: 'Mã cổ phiếu không hợp lệ.' });
        return;
      }

      const watchlistItem =
        req.body?.watchlistItem && typeof req.body.watchlistItem === 'object'
          ? (req.body.watchlistItem as WatchlistItemConfig)
          : undefined;
      const rawTf = req.body?.timeframe as ChartTimeframe | undefined;
      const timeframe: ChartTimeframe =
        rawTf === 'intraday' ||
        rawTf === '1D' ||
        rawTf === '1W' ||
        rawTf === '1M' ||
        rawTf === '3M'
          ? rawTf
          : '1D';
      const recentNews = Array.isArray(req.body?.recentNews)
        ? (req.body.recentNews as Array<{
            title: string;
            summary?: string;
            impactLabel: 'Rủi ro cao' | 'Hỗ trợ tăng' | 'Trung lập';
            publishedRelative: string;
            url: string;
            sourceName: string;
          }>)
        : [];
      const corporateEvents = Array.isArray(req.body?.corporateEvents)
        ? (req.body.corporateEvents as CorporateEventItem[]).slice(0, 30)
        : [];

      const prediction = await predictStockMovement({
        symbol,
        timeframe,
        watchlistItem,
        recentNews,
        corporateEvents,
      });
      res.json(prediction);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Không thể phân tích & dự đoán cổ phiếu.',
      });
    }
  });

  app.post('/api/finance/chart-technical', async (req: Request, res: Response) => {
    try {
      const symbol =
        typeof req.body?.symbol === 'string' ? req.body.symbol.trim().toUpperCase() : '';
      if (!symbol || !/^[A-Z0-9]{1,12}$/.test(symbol)) {
        res.status(400).json({ error: 'Mã cổ phiếu không hợp lệ.' });
        return;
      }
      const rawTf = req.body?.timeframe as ChartTimeframe | undefined;
      const timeframe: ChartTimeframe =
        rawTf === 'intraday' ||
        rawTf === '1D' ||
        rawTf === '1W' ||
        rawTf === '1M' ||
        rawTf === '3M'
          ? rawTf
          : '1D';
      const recentNews = Array.isArray(req.body?.recentNews)
        ? (req.body.recentNews as Array<{
            title: string;
            summary?: string;
            impactLabel: 'Rủi ro cao' | 'Hỗ trợ tăng' | 'Trung lập';
            publishedRelative: string;
          }>)
        : [];
      const corporateEvents = Array.isArray(req.body?.corporateEvents)
        ? (req.body.corporateEvents as CorporateEventItem[]).slice(0, 30)
        : [];

      const chartData = await getMultiTimeframeChartTechnical({
        symbol,
        timeframe,
        recentNews,
        corporateEvents,
      });
      res.json(chartData);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Không thể tải dữ liệu đồ thị kỹ thuật.',
      });
    }
  });

  app.post('/api/finance/cashflow-timing', async (req: Request, res: Response) => {
    try {
      const symbol =
        typeof req.body?.symbol === 'string' ? req.body.symbol.trim().toUpperCase() : '';
      if (!symbol || !/^[A-Z0-9]{1,12}$/.test(symbol)) {
        res.status(400).json({ error: 'Mã cổ phiếu không hợp lệ.' });
        return;
      }
      const watchlistItem =
        req.body?.watchlistItem && typeof req.body.watchlistItem === 'object'
          ? (req.body.watchlistItem as WatchlistItemConfig)
          : undefined;
      const taggedArticles = Array.isArray(req.body?.taggedArticles)
        ? (req.body.taggedArticles as FinanceTaggedArticle[])
        : [];
      const storedArticles = Array.isArray(req.body?.storedArticles)
        ? (req.body.storedArticles as Array<
            Pick<StoredNewsArticle, 'title' | 'summary' | 'sourceName' | 'sentimentLabel' | 'url'>
          >).slice(0, 60)
        : [];

      const cashflowRes = await analyzeCorporateCashflowTiming({
        symbol,
        watchlistItem,
        taggedArticles,
        storedArticles,
      });
      res.json(cashflowRes);
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Không thể phân tích dòng tiền & thời điểm giải ngân.',
      });
    }
  });

  app.post('/api/finance/anomaly-radar', async (req: Request, res: Response) => {
    try {
      const symbols = Array.isArray(req.body?.symbols)
        ? (req.body.symbols as unknown[])
            .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
            .slice(0, 12)
        : [];
      const taggedArticles = Array.isArray(req.body?.taggedArticles)
        ? (req.body.taggedArticles as FinanceTaggedArticle[]).slice(0, 50)
        : [];
      const storedArticles = Array.isArray(req.body?.storedArticles)
        ? (req.body.storedArticles as Array<Pick<StoredNewsArticle, 'title' | 'summary'>>).slice(
            0,
            60
          )
        : [];

      const radar = await buildAnomalyRadar({
        symbols,
        taggedArticles,
        storedArticles,
      });
      res.json(radar);
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Không thể quét Radar dòng tiền bất thường.',
      });
    }
  });

  app.post('/api/finance/corporate-events', async (req: Request, res: Response) => {
    try {
      const watchlistSymbols = Array.isArray(req.body?.watchlistSymbols)
        ? (req.body.watchlistSymbols as unknown[])
            .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
            .slice(0, 12)
        : [];
      const existingItems = parseExistingItems(req.body?.existingItems);
      const forceRefresh = req.body?.forceRefresh === true;

      const eventsRes = await scanCorporateEvents({
        watchlistSymbols,
        existingItems,
        forceRefresh,
      });
      res.json(eventsRes);
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Không thể quét lịch sự kiện ĐHĐCĐ & văn bản nội bộ.',
      });
    }
  });

  app.post('/api/finance/strategy-4angles', async (req: Request, res: Response) => {
    try {
      const symbol =
        typeof req.body?.symbol === 'string' ? req.body.symbol.trim().toUpperCase() : '';
      if (!symbol || !/^[A-Z0-9]{1,12}$/.test(symbol)) {
        res.status(400).json({ error: 'Mã cổ phiếu không hợp lệ.' });
        return;
      }
      const watchlistItem =
        req.body?.watchlistItem && typeof req.body.watchlistItem === 'object'
          ? (req.body.watchlistItem as WatchlistItemConfig)
          : undefined;
      const corporateEvents = Array.isArray(req.body?.corporateEvents)
        ? (req.body.corporateEvents as CorporateEventItem[]).slice(0, 30)
        : [];
      const taggedArticles = Array.isArray(req.body?.taggedArticles)
        ? (req.body.taggedArticles as FinanceTaggedArticle[]).slice(0, 40)
        : [];
      const storedArticles = Array.isArray(req.body?.storedArticles)
        ? (req.body.storedArticles as Array<
            Pick<StoredNewsArticle, 'title' | 'summary' | 'sourceName' | 'sentimentLabel'>
          >).slice(0, 60)
        : [];

      const report = await analyzeStockFourPerspectives({
        symbol,
        watchlistItem,
        corporateEvents,
        taggedArticles,
        storedArticles,
      });
      res.json(report);
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Không thể phân tích chiến lược 4 góc nhìn.',
      });
    }
  });

  app.post('/api/finance/peer-compare', async (req: Request, res: Response) => {
    try {
      const symbols = Array.isArray(req.body?.symbols)
        ? (req.body.symbols as unknown[])
            .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
            .slice(0, 4)
        : [];
      if (symbols.length < 2) {
        res.status(400).json({
          error: 'Vui lòng chọn từ 2 đến 4 cổ phiếu để so sánh cùng ngành.',
        });
        return;
      }
      const rawTf = req.body?.timeframe as PeerTimeframe | undefined;
      const timeframe: PeerTimeframe =
        rawTf === '1W' || rawTf === '3M' ? rawTf : '1M';
      const corporateEvents = Array.isArray(req.body?.corporateEvents)
        ? (req.body.corporateEvents as CorporateEventItem[]).slice(0, 30)
        : [];
      const taggedArticles = Array.isArray(req.body?.taggedArticles)
        ? (req.body.taggedArticles as FinanceTaggedArticle[]).slice(0, 50)
        : [];
      const storedArticles = Array.isArray(req.body?.storedArticles)
        ? (req.body.storedArticles as Array<
            Pick<StoredNewsArticle, 'title' | 'summary' | 'sourceName' | 'sentimentLabel'>
          >).slice(0, 60)
        : [];

      const comparison = await buildPeerComparisonMatrix({
        symbols,
        timeframe,
        corporateEvents,
        taggedArticles,
        storedArticles,
      });
      res.json(comparison);
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Không thể tổng hợp ma trận so sánh cùng ngành.',
      });
    }
  });

  app.post('/api/finance/peer-rank', async (req: Request, res: Response) => {
    try {
      const comparison = req.body?.comparison as PeerComparisonResponse | undefined;
      if (!comparison || !Array.isArray(comparison.rows) || comparison.rows.length < 2) {
        res.status(400).json({
          error: 'Thiếu dữ liệu ma trận so sánh để AI xếp hạng.',
        });
        return;
      }
      const ranking = await rankPeersWithAi({ comparison });
      res.json(ranking);
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Không thể xếp hạng cổ phiếu tối ưu bằng AI.',
      });
    }
  });

  app.post('/api/finance/erratic-movers', async (req: Request, res: Response) => {
    try {
      const symbols = Array.isArray(req.body?.symbols)
        ? (req.body.symbols as unknown[])
            .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
            .slice(0, 15)
        : [];
      const forceRefresh = req.body?.forceRefresh === true;

      const data = await scanIntradayErraticMovers({
        symbols,
        forceRefresh,
      });
      res.json(data);
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Không thể quét danh sách cổ phiếu biến động thất thường trong phiên.',
      });
    }
  });

  app.post('/api/finance/erratic-diagnose', async (req: Request, res: Response) => {
    try {
      const scope = req.body?.scope === 'group' ? 'group' : 'single';
      const mover =
        req.body?.mover && typeof req.body.mover === 'object'
          ? (req.body.mover as IntradayErraticMover)
          : undefined;
      const movers = Array.isArray(req.body?.movers)
        ? (req.body.movers as IntradayErraticMover[]).slice(0, 12)
        : [];
      if (scope === 'single' && !mover && movers.length === 0) {
        res.status(400).json({
          error: 'Thiếu dữ liệu mã cổ phiếu biến động thất thường để phân tích.',
        });
        return;
      }
      const taggedArticles = Array.isArray(req.body?.taggedArticles)
        ? (req.body.taggedArticles as FinanceTaggedArticle[]).slice(0, 50)
        : [];
      const storedArticles = Array.isArray(req.body?.storedArticles)
        ? (req.body.storedArticles as Array<
            Pick<StoredNewsArticle, 'title' | 'summary' | 'sourceName' | 'sentimentLabel' | 'createdAt'>
          >).slice(0, 80)
        : [];
      const corporateEvents = Array.isArray(req.body?.corporateEvents)
        ? (req.body.corporateEvents as CorporateEventItem[]).slice(0, 30)
        : [];

      const diagnosis = await diagnoseIntradayErraticMover({
        scope,
        mover,
        movers,
        taggedArticles,
        storedArticles,
        corporateEvents,
      });
      res.json(diagnosis);
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Không thể giải mã nguyên nhân biến động thất thường lúc này.',
      });
    }
  });

  /* --- Persistent Sources Store Endpoints (Layer 1: Disk JSON Atomic Persistence) --- */

  app.get('/api/sources', (_req: Request, res: Response) => {
    const info = getPersistedSourcesState();
    res.json({
      state: info.state,
      hadExistingDiskStore: info.hadExistingDiskStore,
      storePath: 'server/data/sources_store.json',
    });
  });

  app.post('/api/sources/sync', (req: Request, res: Response) => {
    try {
      const mode = req.body?.mode === 'merge' ? 'merge' : 'replace';
      const payload = req.body?.state && typeof req.body.state === 'object'
        ? req.body.state
        : req.body;
      const saved = syncSourcesStateToDisk(payload, mode);
      res.json({
        state: saved,
        savedAt: saved.updatedAt,
      });
    } catch (err) {
      res.status(400).json({
        error:
          err instanceof Error
            ? err.message
            : 'Không thể lưu cấu hình nguồn trang xuống đĩa máy chủ.',
      });
    }
  });

  app.post('/api/sources/reset-defaults', (req: Request, res: Response) => {
    try {
      const keepCustom = req.body?.keepCustomSources !== false;
      const saved = resetSourcesToOfficialDefaults(keepCustom);
      res.json({
        state: saved,
        savedAt: saved.updatedAt,
      });
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Không thể nạp lại bộ nguồn tiêu chuẩn.',
      });
    }
  });

  app.post('/api/sources/sync-watchlist', (req: Request, res: Response) => {
    try {
      const symbols = Array.isArray(req.body?.symbols)
        ? (req.body.symbols as unknown[]).filter(
            (s): s is string => typeof s === 'string' && s.trim().length > 0
          )
        : [];
      const saved = syncWatchlistDynamicSources(symbols);
      res.json({ state: saved });
    } catch (err) {
      res.status(400).json({
        error:
          err instanceof Error
            ? err.message
            : 'Không thể đồng bộ nguồn RSS động cho Watchlist.',
      });
    }
  });

  /* --- Auto-Discovery Crawler Bot Endpoints --- */

  app.get('/api/bot/topic-packs', (_req: Request, res: Response) => {
    res.json({ packs: TOPIC_PACK_CATALOG });
  });

  app.post('/api/bot/discover', async (req: Request, res: Response) => {
    try {
      const input = typeof req.body?.input === 'string' ? req.body.input.trim() : '';
      if (!input) {
        res.status(400).json({
          error: 'Vui lòng nhập tên miền trang báo (vd: baodautu.vn) hoặc từ khóa chủ đề.',
        });
        return;
      }
      const result = await smartDiscoverSource(input);
      res.json(result);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Không thể khám phá nguồn tin từ đầu vào.',
      });
    }
  });

  app.post('/api/bot/scan-all', async (req: Request, res: Response) => {
    try {
      const persisted = getPersistedSourcesState().state;
      const rawPacks = Array.isArray(req.body?.packs) ? req.body.packs : [];
      const packs: TopicPackId[] =
        rawPacks.length > 0 ? normalizeTopicPackIds(rawPacks) : persisted.activeTopicPacks;
      const watchlistSymbols = Array.isArray(req.body?.watchlistSymbols)
        ? (req.body.watchlistSymbols as unknown[])
            .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
            .slice(0, 12)
        : [];
      const customKeywords = Array.isArray(req.body?.customKeywords)
        ? (req.body.customKeywords as unknown[])
            .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
            .slice(0, 8)
        : [];
      const customFeeds = Array.isArray(req.body?.customFeeds)
        ? (req.body.customFeeds as Array<{
            name: string;
            url: string;
            domain?: string;
            defaultCategory?: string;
          }>).slice(0, 20)
        : [];
      const existingItems = parseExistingItems(req.body?.existingItems);
      const dedupBotEnabled = req.body?.dedupBotEnabled !== false;
      const maxFeedsPerRun =
        typeof req.body?.maxFeedsPerRun === 'number' ? req.body.maxFeedsPerRun : 14;

      const result = await runAutoDiscoveryScan({
        packs,
        watchlistSymbols,
        customKeywords,
        customFeeds,
        existingItems,
        dedupBotEnabled,
        maxFeedsPerRun,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Lỗi khi Bot quét nguồn tin tự động.',
      });
    }
  });

  /* --- Editorial Newsroom, Social Trends, Daily Editions & Telegram/Lark Webhook Endpoints --- */

  const runDefaultNewsroomBootstrapScan = async () => {
    const persisted = getPersistedSourcesState().state;
    await runAutoDiscoveryScan({
      packs:
        persisted.activeTopicPacks.length > 0
          ? persisted.activeTopicPacks
          : DEFAULT_ACTIVE_TOPIC_PACKS,
      maxFeedsPerRun: 14,
      dedupBotEnabled: true,
    });
  };

  app.get('/api/newsroom/feed', async (req: Request, res: Response) => {
    try {
      const datePreset = (typeof req.query?.datePreset === 'string'
        ? req.query.datePreset
        : 'latest') as NewsroomDatePreset;
      const specificDate =
        typeof req.query?.date === 'string' ? req.query.date.trim() : '';
      const region = (typeof req.query?.region === 'string'
        ? req.query.region
        : 'all') as GeographicRegion | 'all';
      const category = (typeof req.query?.category === 'string'
        ? req.query.category
        : 'all') as NewsroomCategoryBucket | 'all';
      const sentiment = (typeof req.query?.sentiment === 'string'
        ? req.query.sentiment
        : 'all') as SentimentVerdict | 'all';
      const searchQuery = typeof req.query?.q === 'string' ? req.query.q.trim() : '';
      const watchlistSymbols =
        typeof req.query?.watchlist === 'string'
          ? req.query.watchlist
              .split(',')
              .map((s) => s.trim().toUpperCase())
              .filter(Boolean)
          : [];

      const feed = await getNewsroomFeed({
        datePreset,
        specificDate,
        region,
        category,
        sentiment,
        searchQuery,
        watchlistSymbols,
        bootstrapScan: runDefaultNewsroomBootstrapScan,
      });
      res.json(feed);
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error ? err.message : 'Không thể tải dòng tin Bản tin.',
      });
    }
  });

  app.post('/api/newsroom/sync', async (req: Request, res: Response) => {
    try {
      const persisted = getPersistedSourcesState().state;
      const rawPacks = Array.isArray(req.body?.packs) ? req.body.packs : [];
      const packs: TopicPackId[] =
        rawPacks.length > 0 ? normalizeTopicPackIds(rawPacks) : persisted.activeTopicPacks;
      const watchlistSymbols = Array.isArray(req.body?.watchlistSymbols)
        ? (req.body.watchlistSymbols as unknown[])
            .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
            .slice(0, 12)
        : [];
      const customKeywords = Array.isArray(req.body?.customKeywords)
        ? (req.body.customKeywords as unknown[])
            .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
            .slice(0, 8)
        : [];
      const customFeeds = Array.isArray(req.body?.customFeeds)
        ? (req.body.customFeeds as Array<{
            name: string;
            url: string;
            domain?: string;
            defaultCategory?: string;
          }>).slice(0, 20)
        : [];
      const existingItems = parseExistingItems(req.body?.existingItems);
      const dedupBotEnabled = req.body?.dedupBotEnabled !== false;

      const [scanResult, socialResult] = await Promise.all([
        runAutoDiscoveryScan({
          packs: packs.length > 0 ? packs : DEFAULT_ACTIVE_TOPIC_PACKS,
          watchlistSymbols,
          customKeywords,
          customFeeds,
          existingItems,
          dedupBotEnabled,
          maxFeedsPerRun: 14,
        }),
        fetchSocialTrendsFeed(true),
      ]);

      if (socialResult.trends.length > 0) {
        publishSocialTrendsToFeed(socialResult.trends);
      }

      const feed = await getNewsroomFeed({
        datePreset: 'latest',
        watchlistSymbols,
      });

      res.json({
        syncedAt: new Date().toISOString(),
        scanResult,
        feed,
      });
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Không thể đồng bộ nguồn trang & xu hướng mạng xã hội.',
      });
    }
  });

  app.get('/api/newsroom/social-trends', async (req: Request, res: Response) => {
    try {
      const force = req.query?.refresh === '1';
      const result = await fetchSocialTrendsFeed(force);
      if (result.trends.length > 0) {
        publishSocialTrendsToFeed(result.trends);
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error ? err.message : 'Không thể quét xu hướng mạng xã hội.',
      });
    }
  });

  app.get('/api/newsroom/edition', async (req: Request, res: Response) => {
    try {
      const dateStr =
        typeof req.query?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
          ? req.query.date
          : undefined;
      const editionType: EditionType =
        req.query?.type === 'afternoon' ? 'afternoon' : 'morning';
      const forceRefresh = req.query?.refresh === '1';
      const watchlistSymbols =
        typeof req.query?.watchlist === 'string'
          ? req.query.watchlist
              .split(',')
              .map((s) => s.trim().toUpperCase())
              .filter(Boolean)
          : [];

      const edition = await generateNewsroomEdition({
        dateStr,
        editionType,
        watchlistSymbols,
        forceRefresh,
        bootstrapScan: runDefaultNewsroomBootstrapScan,
      });
      res.json(edition);
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Không thể tổng hợp Ấn bản Sáng/Chiều lúc này.',
      });
    }
  });

  app.get('/api/settings/webhooks', (_req: Request, res: Response) => {
    res.json(getWebhookChannelsStatus());
  });

  app.post('/api/settings/webhooks', (req: Request, res: Response) => {
    try {
      const status = updateWebhookChannelsConfig({
        telegramBotToken:
          typeof req.body?.telegramBotToken === 'string'
            ? req.body.telegramBotToken
            : undefined,
        telegramChatId:
          typeof req.body?.telegramChatId === 'string'
            ? req.body.telegramChatId
            : undefined,
        larkWebhookUrl:
          typeof req.body?.larkWebhookUrl === 'string'
            ? req.body.larkWebhookUrl
            : undefined,
        autoSendEnabled:
          typeof req.body?.autoSendEnabled === 'boolean'
            ? req.body.autoSendEnabled
            : undefined,
        clearTelegram: Boolean(req.body?.clearTelegram),
        clearLark: Boolean(req.body?.clearLark),
      });
      res.json(status);
    } catch (err) {
      res.status(400).json({
        error:
          err instanceof Error ? err.message : 'Không thể cập nhật cấu hình Telegram/Lark.',
      });
    }
  });

  app.post('/api/newsroom/edition/send', async (req: Request, res: Response) => {
    try {
      const testOnly = Boolean(req.body?.testOnly);
      const rawChannels = Array.isArray(req.body?.channels) ? req.body.channels : [];
      const channels = rawChannels.filter(
        (c: unknown): c is 'telegram' | 'lark' => c === 'telegram' || c === 'lark'
      );
      const selectedChannels: Array<'telegram' | 'lark'> =
        channels.length > 0 ? channels : ['telegram', 'lark'];

      if (testOnly) {
        const testRes = await sendTestWebhookMessage(selectedChannels);
        res.json(testRes);
        return;
      }

      const dateStr =
        typeof req.body?.dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.body.dateStr)
          ? req.body.dateStr
          : undefined;
      const editionType: EditionType =
        req.body?.editionType === 'afternoon' ? 'afternoon' : 'morning';
      const watchlistSymbols = Array.isArray(req.body?.watchlistSymbols)
        ? (req.body.watchlistSymbols as unknown[])
            .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
            .slice(0, 12)
        : [];

      const edition = await generateNewsroomEdition({
        dateStr,
        editionType,
        watchlistSymbols,
        bootstrapScan: runDefaultNewsroomBootstrapScan,
      });

      const delivery = await sendEditionToTelegramAndLark(edition, selectedChannels);
      markEditionDeliveryTimestamps(edition.editionKey, {
        telegramOk: delivery.telegram.ok,
        larkOk: delivery.lark.ok,
      });

      res.json({
        ...delivery,
        edition,
      });
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Không thể gửi Ấn bản qua Telegram / Lark lúc này.',
      });
    }
  });

  /* --- Smart Automation Rules Engine Endpoints --- */

  app.get('/api/automation/rules', (_req: Request, res: Response) => {
    const state = getAutomationRulesState();
    const sourcesState = getPersistedSourcesState().state;
    const webhookStatus = getWebhookChannelsStatus();
    res.json({
      state,
      liveMetrics: {
        enabledSourcesCount: sourcesState.sources.filter((s) => s.enabled).length,
        totalSourcesCount: sourcesState.sources.length,
        archiveCount: getArchiveSize(),
        telegramConfigured: webhookStatus.telegramConfigured,
        larkConfigured: webhookStatus.larkConfigured,
      },
    });
  });

  app.post('/api/automation/rules', (req: Request, res: Response) => {
    try {
      const action = typeof req.body?.action === 'string' ? req.body.action : '';
      let state;
      if (action === 'toggle') {
        const ruleId = typeof req.body?.ruleId === 'string' ? req.body.ruleId : '';
        state = toggleAutomationRule(ruleId);
      } else if (action === 'update_keywords') {
        const ruleId = typeof req.body?.ruleId === 'string' ? req.body.ruleId : '';
        const keywords = Array.isArray(req.body?.keywords)
          ? (req.body.keywords as unknown[]).filter((k): k is string => typeof k === 'string')
          : [];
        state = updateAutomationRuleKeywords(ruleId, keywords);
      } else if (action === 'add') {
        const name = typeof req.body?.name === 'string' ? req.body.name : '';
        const conditionType = req.body?.conditionType as AutomationRule['conditionType'];
        const actionType = req.body?.actionType as AutomationRule['actionType'];
        const keywords = Array.isArray(req.body?.keywords)
          ? (req.body.keywords as unknown[]).filter((k): k is string => typeof k === 'string')
          : [];
        const customTag = typeof req.body?.customTag === 'string' ? req.body.customTag : undefined;
        const sentimentTrigger =
          req.body?.sentimentTrigger === 'Tích cực' ||
          req.body?.sentimentTrigger === 'Tiêu cực' ||
          req.body?.sentimentTrigger === 'Trung lập'
            ? req.body.sentimentTrigger
            : 'any';
        state = addCustomAutomationRule({
          name,
          conditionType: conditionType || 'custom_keyword_tag',
          actionType: actionType || 'auto_tag',
          keywords,
          customTag,
          sentimentTrigger,
        });
      } else if (action === 'delete') {
        const ruleId = typeof req.body?.ruleId === 'string' ? req.body.ruleId : '';
        state = deleteCustomAutomationRule(ruleId);
      } else if (action === 'reset') {
        state = resetDefaultAutomationRules();
      } else {
        state = getAutomationRulesState();
      }
      res.json({ state });
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Không thể cập nhật quy tắc tự động.',
      });
    }
  });

  app.post('/api/automation/sandbox', (req: Request, res: Response) => {
    try {
      const title = typeof req.body?.title === 'string' ? req.body.title : '';
      const text = typeof req.body?.text === 'string' ? req.body.text : '';
      const watchlistSymbols = Array.isArray(req.body?.watchlistSymbols)
        ? (req.body.watchlistSymbols as unknown[]).filter(
            (s): s is string => typeof s === 'string' && s.trim().length > 0
          )
        : ['SSI', 'FPT', 'VCB', 'HPG'];

      if (!title.trim() && !text.trim()) {
        res.status(400).json({ error: 'Vui lòng nhập tiêu đề hoặc nội dung mẫu để kiểm thử bộ lọc.' });
        return;
      }

      const result = runAutomationSandboxTest({
        title,
        text,
        watchlistSymbols,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Lỗi chạy thử bộ lọc tự động.',
      });
    }
  });

  /* --- Intelligence Lab Endpoints (Fact-Check, Macro Ripple, Ask Archive) --- */

  app.post('/api/lab/clusters', (req: Request, res: Response) => {
    try {
      const clientArticles = Array.isArray(req.body?.articles)
        ? (req.body.articles as StoredNewsArticle[]).slice(0, 220)
        : [];
      const clusters = buildMultiSourceClusters(clientArticles);
      res.json({ clusters });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Không thể gom cụm sự kiện đa nguồn.',
      });
    }
  });

  app.post('/api/lab/fact-check', async (req: Request, res: Response) => {
    try {
      const topicTitle = typeof req.body?.topicTitle === 'string' ? req.body.topicTitle : undefined;
      const url = typeof req.body?.url === 'string' ? req.body.url : undefined;
      const articles = Array.isArray(req.body?.articles) ? req.body.articles : undefined;
      let ai: GoogleGenAI | null = null;
      try {
        ai = getAiClient();
      } catch {
        ai = null;
      }
      const report = await runMultiSourceFactCheck(ai, { topicTitle, url, articles });
      res.json(report);
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Không thể kiểm chứng đa nguồn lúc này.',
      });
    }
  });

  app.post('/api/lab/macro-ripple', async (req: Request, res: Response) => {
    try {
      const scenarioText =
        typeof req.body?.scenarioText === 'string' ? req.body.scenarioText.trim() : '';
      const sourceArticleTitle =
        typeof req.body?.sourceArticleTitle === 'string'
          ? req.body.sourceArticleTitle.trim()
          : undefined;
      if (!scenarioText && !sourceArticleTitle) {
        res.status(400).json({
          error: 'Vui lòng chọn bài viết vĩ mô hoặc nhập kịch bản kinh tế để lập bản đồ tác động.',
        });
        return;
      }
      let ai: GoogleGenAI | null = null;
      try {
        ai = getAiClient();
      } catch {
        ai = null;
      }
      const report = await runMacroRippleAnalysis(ai, { scenarioText, sourceArticleTitle });
      res.json(report);
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Không thể phân tích bản đồ tác động dây chuyền lúc này.',
      });
    }
  });

  app.post('/api/lab/ask-archive', async (req: Request, res: Response) => {
    try {
      const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
      if (!question) {
        res.status(400).json({ error: 'Vui lòng nhập câu hỏi cần tra cứu từ Kho Tin.' });
        return;
      }
      const clientArticles = Array.isArray(req.body?.articles)
        ? (req.body.articles as StoredNewsArticle[]).slice(0, 260)
        : [];
      let ai: GoogleGenAI | null = null;
      try {
        ai = getAiClient();
      } catch {
        ai = null;
      }
      const report = await runAskArchiveSynthesis(ai, { question, clientArticles });
      res.json(report);
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Không thể tổng hợp chuyên đề từ Kho Tin lúc này.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('/{*path}', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Lang Kinh server listening on http://0.0.0.0:${PORT}`);
    startEditionScheduler(async () => {
      await runDefaultNewsroomBootstrapScan();
      await fetchSocialTrendsFeed(true);
    });
  });
}

startServer();
