import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  AnomalyRadarResponse,
  CashflowAnomalyItem,
  ChartTimeframe,
  CorporateCashflowTimingResponse,
  CorporateEventItem,
  ErraticMoverAiDiagnosis,
  ErraticMoversResponse,
  ErraticRootCauseCategory,
  ExistingArticleFingerprint,
  FetchedSourceArticle,
  FinanceAlertItem,
  FinanceArticleImpactLabel,
  FinanceTaggedArticle,
  FourAngleStrategyResponse,
  IntradayErraticMover,
  MarketTimingAction,
  NormalizedPerformancePoint,
  PeerAiRankingResponse,
  PeerComparisonResponse,
  PeerStockRow,
  PeerTimeframe,
  PortfolioStrategyBasketItem,
  PricedInStatus,
  SectorPosition,
  SentimentBreakdown,
  SentimentVerdict,
  SourceFetchStatus,
  SsiSecurityItem,
  StockPredictionResponse,
  StockQuoteSnapshot,
  StoredNewsArticle,
  TrapRiskLevel,
  WatchlistAiHealthResponse,
  WatchlistItemConfig,
  WatchlistPortfolioStrategyResponse,
  WatchlistScanResponse,
  WatchlistStockAnalytics,
} from '../src/types/news.ts';
import { isApiInCooldown, recordApiCall } from './apiQuotaTracker.ts';
import { evaluateBatchWithDedupBot } from './dedupBot.ts';
import { tryFetchRssFeed } from './newsSources.ts';
import {
  analyzeSingleStockErraticMovement,
  computeWatchlistStockAnalyticsBatch,
  detectStockAnomalies,
  getConfiguredWebhookUrl,
  getDailyOhlcHistory,
  getMacroBenchmarks,
  getMarketIndices,
  getMultipleStockQuotes,
  getMultiTimeframeChartTechnical,
  getSecuritiesCatalog,
  getStockQuote,
} from './ssiMarketService.ts';

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

interface FinancialFeedSeed {
  id: string;
  name: string;
  domain: string;
  url: string;
}

const FINANCIAL_RSS_FEEDS: FinancialFeedSeed[] = [
  {
    id: 'fin-cafef',
    name: 'CafeF — Chứng khoán',
    domain: 'cafef.vn',
    url: 'https://cafef.vn/thi-truong-chung-khoan.rss',
  },
  {
    id: 'fin-vneconomy',
    name: 'VnEconomy — Chứng khoán',
    domain: 'vneconomy.vn',
    url: 'https://vneconomy.vn/chung-khoan.rss',
  },
  {
    id: 'fin-vietstock',
    name: 'Vietstock — Cổ phiếu',
    domain: 'vietstock.vn',
    url: 'https://vietstock.vn/830/chung-khoan/co-phieu.rss',
  },
  {
    id: 'fin-vnexpress-kd',
    name: 'VnExpress — Kinh doanh',
    domain: 'vnexpress.net',
    url: 'https://vnexpress.net/rss/kinh-doanh.rss',
  },
];

const COMPANY_ALIASES: Array<{ pattern: RegExp; symbol: string }> = [
  { pattern: /\bchứng khoán ssi\b|\bcông ty ssi\b/i, symbol: 'SSI' },
  { pattern: /\btập đoàn fpt\b|\bfpt telecom\b|\bfpt software\b/i, symbol: 'FPT' },
  { pattern: /\bfpt retail\b|\blong châu\b/i, symbol: 'FRT' },
  { pattern: /\bvietcombank\b/i, symbol: 'VCB' },
  { pattern: /\bhòa phát\b/i, symbol: 'HPG' },
  { pattern: /\bthế giới di động\b|\bbách hóa xanh\b/i, symbol: 'MWG' },
  { pattern: /\btechcombank\b/i, symbol: 'TCB' },
  { pattern: /\bngân hàng quân đội\b|\bmbbank\b/i, symbol: 'MBB' },
  { pattern: /\bvpbank\b/i, symbol: 'VPB' },
  { pattern: /\bvietinbank\b/i, symbol: 'CTG' },
  { pattern: /\bsacombank\b/i, symbol: 'STB' },
  { pattern: /\bbidv\b/i, symbol: 'BID' },
  { pattern: /\bhdbank\b/i, symbol: 'HDB' },
  { pattern: /\btpbank\b/i, symbol: 'TPB' },
  { pattern: /\bseabank\b/i, symbol: 'SSB' },
  { pattern: /\bvinamilk\b/i, symbol: 'VNM' },
  { pattern: /\bvinhomes\b/i, symbol: 'VHM' },
  { pattern: /\bvingroup\b/i, symbol: 'VIC' },
  { pattern: /\bvincom retail\b/i, symbol: 'VRE' },
  { pattern: /\bmasan\b/i, symbol: 'MSN' },
  { pattern: /\bpetrolimex\b/i, symbol: 'PLX' },
  { pattern: /\bpv power\b/i, symbol: 'POW' },
  { pattern: /\bsabeco\b/i, symbol: 'SAB' },
  { pattern: /\bvietjet\b/i, symbol: 'VJC' },
  { pattern: /\bvietnam airlines\b/i, symbol: 'HVN' },
  { pattern: /\bvndirect\b/i, symbol: 'VND' },
  { pattern: /\bvietcap\b/i, symbol: 'VCI' },
  { pattern: /\bchứng khoán hsc\b/i, symbol: 'HCM' },
  { pattern: /\bđức giang\b|\bhóa chất đức giang\b/i, symbol: 'DGC' },
  { pattern: /\bphú nhuận\b|\bvàng bạc pnj\b/i, symbol: 'PNJ' },
  { pattern: /\bgemadept\b/i, symbol: 'GMD' },
  { pattern: /\bkinh bắc\b/i, symbol: 'KBC' },
  { pattern: /\bnovaland\b/i, symbol: 'NVL' },
  { pattern: /\bđất xanh\b/i, symbol: 'DXG' },
  { pattern: /\bphát đạt\b/i, symbol: 'PDR' },
  { pattern: /\bbình sơn\b|\blọc hóa dầu bình sơn\b/i, symbol: 'BSR' },
  { pattern: /\bbecamex\b/i, symbol: 'BCM' },
  { pattern: /\bbảo việt\b/i, symbol: 'BVH' },
  { pattern: /\bviettel global\b/i, symbol: 'VGI' },
];

const AMBIGUOUS_NON_TICKER_TOKENS = new Set([
  'USD',
  'GDP',
  'CPI',
  'FED',
  'ETF',
  'FDI',
  'IPO',
  'CEO',
  'CFO',
  'CTO',
  'VN30',
  'HNX',
  'HOSE',
  'UPCOM',
  'API',
  'RSS',
  'VAT',
  'ROE',
  'ROA',
  'EPS',
  'NIM',
  'NPL',
  'CAR',
  'KYC',
  'ESG',
  'BCTC',
  'UBCK',
  'NHNN',
  'VNĐ',
  'TR',
]);

const BEARISH_FINANCE_KEYWORDS = [
  'thua lỗ',
  'lỗ ròng',
  'lỗ lũy kế',
  'giảm sâu',
  'lao dốc',
  'sụt giảm',
  'xả mạnh',
  'bán ròng',
  'thanh tra',
  'vi phạm',
  'xử phạt',
  'cảnh báo',
  'kiểm soát',
  'hạn chế giao dịch',
  'hủy niêm yết',
  'cắt margin',
  'nợ xấu',
  'khởi tố',
  'đình chỉ',
  'chậm trả',
  'pha loãng',
  'rủi ro',
  'áp lực bán',
  'thủng đáy',
];

const BULLISH_FINANCE_KEYWORDS = [
  'lãi kỷ lục',
  'lợi nhuận tăng',
  'tăng trưởng',
  'vượt kế hoạch',
  'mua ròng',
  'gom mạnh',
  'cổ tức',
  'chia thưởng',
  'bứt phá',
  'tăng trần',
  'khởi sắc',
  'nâng hạng',
  'trúng thầu',
  'khởi công',
  'kỷ lục',
  'tích cực',
  'mở rộng',
  'khuyến nghị mua',
  'vượt đỉnh',
  'thuận lợi',
];

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function hashShort(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function formatRelativeTime(pubDate: string): string {
  if (!pubDate) return 'Mới cập nhật';
  const parsed = new Date(pubDate);
  if (Number.isNaN(parsed.getTime())) return 'Hôm nay';
  const mins = Math.max(1, Math.round((Date.now() - parsed.getTime()) / 60_000));
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  return `${Math.round(hrs / 24)} ngày trước`;
}

export function extractMatchedTickers(
  title: string,
  description: string,
  catalogSet: Set<string>
): string[] {
  const matched = new Set<string>();
  const fullText = `${title} ${description}`;

  // 1. Strict uppercase 3-5 char symbol tokens matching real catalog
  const tokenRegex = /\b([A-Z][A-Z0-9]{2,4})\b/g;
  let m: RegExpExecArray | null;
  while ((m = tokenRegex.exec(fullText)) !== null) {
    const token = m[1];
    if (!catalogSet.has(token)) continue;
    if (AMBIGUOUS_NON_TICKER_TOKENS.has(token)) continue;

    // Prevent currency units like "tỷ VND", "triệu VND", "đồng VND" from falsely matching VNDIRECT
    if (token === 'VND') {
      const ctx = fullText.slice(Math.max(0, m.index - 16), m.index + 16).toLowerCase();
      if (/\d\s*(?:tỷ|trieu|triệu|nghìn|nghin|k)?\s*vnd/.test(ctx)) {
        continue;
      }
      if (!/vndirect|cổ phiếu|mã vnd|chứng khoán/i.test(fullText)) {
        continue;
      }
    }
    matched.add(token);
  }

  // 2. Curated Vietnamese corporate name -> ticker aliases
  for (const alias of COMPANY_ALIASES) {
    if (alias.pattern.test(fullText) && catalogSet.has(alias.symbol)) {
      matched.add(alias.symbol);
    }
  }

  return Array.from(matched).slice(0, 6);
}

export function scoreFinanceArticleImpact(
  title: string,
  description: string
): {
  impactLabel: FinanceArticleImpactLabel;
  sentimentLabel: SentimentVerdict;
  sentiment: SentimentBreakdown;
} {
  const lower = `${title} ${description}`.toLowerCase();
  let bull = 0;
  let bear = 0;

  for (const kw of BULLISH_FINANCE_KEYWORDS) {
    if (lower.includes(kw)) bull += 1;
  }
  for (const kw of BEARISH_FINANCE_KEYWORDS) {
    if (lower.includes(kw)) bear += 1;
  }

  let positive = 26 + Math.min(45, bull * 14);
  let negative = 20 + Math.min(48, bear * 15);
  let neutral = Math.max(20, 100 - Math.min(72, positive + negative) + 24);
  const total = positive + negative + neutral;
  positive = Math.round((positive / total) * 100);
  negative = Math.round((negative / total) * 100);
  neutral = Math.max(0, 100 - positive - negative);

  let impactLabel: FinanceArticleImpactLabel = 'Trung lập';
  let sentimentLabel: SentimentVerdict = 'Trung lập';
  let toneLabel = 'Thông tin thị trường trung lập';

  if (bear > bull && negative >= 28) {
    impactLabel = 'Rủi ro cao';
    sentimentLabel = 'Tiêu cực';
    toneLabel = 'Cảnh báo rủi ro cổ phiếu';
  } else if (bull > bear && positive >= 30) {
    impactLabel = 'Hỗ trợ tăng';
    sentimentLabel = 'Tích cực';
    toneLabel = 'Tín hiệu hỗ trợ tích cực';
  }

  return {
    impactLabel,
    sentimentLabel,
    sentiment: {
      positive,
      neutral,
      negative,
      toneLabel,
    },
  };
}

async function dispatchWebhookAlert(alert: FinanceAlertItem): Promise<boolean> {
  const webhookUrl = getConfiguredWebhookUrl();
  if (!webhookUrl) return false;
  try {
    const formattedText = `[Lăng Kính · Cảnh báo Đỏ] ${alert.symbol} (${alert.priceSnapshot.toLocaleString('vi-VN')} đ, ${alert.changePctSnapshot >= 0 ? '+' : ''}${alert.changePctSnapshot}%)\n${alert.title}\n${alert.message}${alert.articleUrl ? `\nLink: ${alert.articleUrl}` : ''}`;

    const isTelegramBot = /api\.telegram\.org\/bot/i.test(webhookUrl);
    const body = isTelegramBot
      ? { text: formattedText }
      : {
          msg_type: 'text',
          content: { text: formattedText },
          text: formattedText,
          alert,
        };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function runWatchlistScan(params: {
  watchlist: WatchlistItemConfig[];
  existingIndex?: ExistingArticleFingerprint[];
  dedupBotEnabled?: boolean;
}): Promise<WatchlistScanResponse> {
  const symbols = params.watchlist.map((w) => w.symbol.toUpperCase());
  const catalogRes = await getSecuritiesCatalog(false);
  const catalogSet = new Set(catalogRes.items.map((i: SsiSecurityItem) => i.symbol));
  for (const sym of symbols) catalogSet.add(sym);

  // 1. Fetch Market Indices, Macro Benchmarks, Stock Quotes, and 4 Financial RSS Feeds in parallel
  const [indicesRes, macroQuotes, quotesMap, feedResults] = await Promise.all([
    getMarketIndices(),
    getMacroBenchmarks().catch(() => []),
    getMultipleStockQuotes(symbols),
    Promise.all(
      FINANCIAL_RSS_FEEDS.map(async (feed) => {
        try {
          const rawItems = await tryFetchRssFeed(feed.url, 14);
          return { feed, items: rawItems, error: undefined as string | undefined };
        } catch (err) {
          return {
            feed,
            items: [],
            error: err instanceof Error ? err.message : 'Lỗi tải RSS',
          };
        }
      })
    ),
  ]);

  const rawArticles: Array<{
    feed: FinancialFeedSeed;
    title: string;
    url: string;
    description: string;
    pubDate: string;
    matchedTickers: string[];
    impactLabel: FinanceArticleImpactLabel;
    sentimentLabel: SentimentVerdict;
    sentiment: SentimentBreakdown;
  }> = [];

  const statuses: SourceFetchStatus[] = [];
  const sourcesScanned: WatchlistScanResponse['sourcesScanned'] = [];

  for (const fr of feedResults) {
    statuses.push({
      sourceId: fr.feed.id,
      sourceName: fr.feed.name,
      method: 'RSS/Atom',
      articleCount: fr.items.length,
      error: fr.error,
    });
    sourcesScanned.push({
      name: fr.feed.name,
      domain: fr.feed.domain,
      count: fr.items.length,
      error: fr.error,
    });

    for (const it of fr.items) {
      const cleanDesc = (it.description || it.title)
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const matchedTickers = extractMatchedTickers(it.title, cleanDesc, catalogSet);
      const scored = scoreFinanceArticleImpact(it.title, cleanDesc);
      rawArticles.push({
        feed: fr.feed,
        title: it.title,
        url: it.link,
        description: cleanDesc || it.title,
        pubDate: it.pubDate,
        matchedTickers,
        ...scored,
      });
    }
  }

  if (rawArticles.length < 8) {
    const gnewsFeed: FinancialFeedSeed = {
      id: 'fin-gnews-vn',
      name: 'Google News — Chứng khoán VN',
      domain: 'news.google.com',
      url: 'https://news.google.com/rss/search?q=ch%E1%BB%A9ng+kho%C3%A1n+OR+VN-Index+OR+c%E1%BB%95+phi%E1%BA%BFu&hl=vi&gl=VN&ceid=VN:vi',
    };
    try {
      const backupItems = await tryFetchRssFeed(gnewsFeed.url, 14);
      statuses.push({
        sourceId: gnewsFeed.id,
        sourceName: gnewsFeed.name,
        method: 'RSS/Atom',
        articleCount: backupItems.length,
      });
      sourcesScanned.push({
        name: gnewsFeed.name,
        domain: gnewsFeed.domain,
        count: backupItems.length,
      });
      for (const it of backupItems) {
        const cleanDesc = (it.description || it.title)
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        const matchedTickers = extractMatchedTickers(it.title, cleanDesc, catalogSet);
        const scored = scoreFinanceArticleImpact(it.title, cleanDesc);
        rawArticles.push({
          feed: gnewsFeed,
          title: it.title,
          url: it.link,
          description: cleanDesc || it.title,
          pubDate: it.pubDate,
          matchedTickers,
          ...scored,
        });
      }
    } catch (err) {
      statuses.push({
        sourceId: gnewsFeed.id,
        sourceName: gnewsFeed.name,
        method: 'RSS/Atom',
        articleCount: 0,
        error: err instanceof Error ? err.message : 'Lỗi tải Google News Finance RSS',
      });
    }
  }

  // Prioritize articles that match tickers in Watchlist or any VN ticker
  const watchSet = new Set(symbols);
  rawArticles.sort((a, b) => {
    const aWatchHits = a.matchedTickers.filter((t) => watchSet.has(t)).length;
    const bWatchHits = b.matchedTickers.filter((t) => watchSet.has(t)).length;
    if (bWatchHits !== aWatchHits) return bWatchHits - aWatchHits;
    return b.matchedTickers.length - a.matchedTickers.length;
  });

  // 2. Pass through DedupBot against Kho Tin (focus on articles relevant to watchlist or top financial headlines)
  const storageCandidates = rawArticles
    .filter((a) => a.matchedTickers.some((t) => watchSet.has(t)) || a.matchedTickers.length > 0)
    .slice(0, 24);

  const { accepted, report } = evaluateBatchWithDedupBot(
    storageCandidates.map((c) => ({
      title: c.title,
      url: c.url,
      description: c.description,
      sourceName: c.feed.name,
      ref: c,
    })),
    params.dedupBotEnabled !== false ? params.existingIndex || [] : []
  );

  const buildTagged = (
    c: (typeof rawArticles)[number],
    dedupStatus?: 'new' | 'updated',
    existingDocId?: string,
    updateReason?: string
  ): FinanceTaggedArticle => {
    const rel = formatRelativeTime(c.pubDate);
    const tickerTagPrefix =
      c.matchedTickers.length > 0 ? `[${c.matchedTickers.join(', ')}] ` : '';
    const fetchedArticle: FetchedSourceArticle = {
      id: `fin-art-${hashShort(c.url)}`,
      sourceId: c.feed.id,
      sourceName: c.feed.name,
      sourceDomain: c.feed.domain,
      title: c.title,
      url: c.url,
      publishedRelative: rel,
      category: 'Kinh doanh',
      summary: `${tickerTagPrefix}${c.description}`.slice(0, 1400),
      keyTakeaway: `${c.impactLabel}${c.matchedTickers.length > 0 ? ` · Mã: ${c.matchedTickers.join(', ')}` : ''}`,
      sentimentLabel: c.sentimentLabel,
      sentiment: c.sentiment,
      dedupStatus,
      existingDocId,
      updateReason,
    };

    return {
      id: fetchedArticle.id,
      sourceId: c.feed.id,
      sourceName: c.feed.name,
      sourceDomain: c.feed.domain,
      title: c.title,
      url: c.url,
      publishedRelative: rel,
      summary: c.description,
      impactLabel: c.impactLabel,
      sentimentLabel: c.sentimentLabel,
      matchedTickers: c.matchedTickers,
      dedupStatus,
      existingDocId,
      updateReason,
      fetchedArticle,
    };
  };

  const acceptedUrlMap = new Map(accepted.map((a) => [a.item.url, a]));
  const taggedArticles: FinanceTaggedArticle[] = rawArticles.slice(0, 32).map((c) => {
    const acc = acceptedUrlMap.get(c.url);
    return buildTagged(c, acc?.dedupStatus, acc?.existingDocId, acc?.updateReason);
  });

  const fetchedForStorage: FetchedSourceArticle[] = accepted.map(
    (a) =>
      buildTagged(a.item.ref, a.dedupStatus, a.existingDocId, a.updateReason).fetchedArticle
  );

  // 3. Evaluate 3-Tier Multi-Layer Alert Rules for Watchlist Items
  const alerts: FinanceAlertItem[] = [];
  const todayKey = new Date().toISOString().split('T')[0];
  const nowIso = new Date().toISOString();

  for (const item of params.watchlist) {
    const quote = quotesMap[item.symbol];
    const matchingNews = taggedArticles.filter((art) =>
      art.matchedTickers.includes(item.symbol)
    );
    const price = quote?.price || 0;
    const changePct = quote?.changePct || 0;
    const threshold = Math.max(0.5, item.priceChangeThresholdPct || 3);

    // Price / Stop-loss / Target Rules
    if (quote && price > 0) {
      if (item.stopLossPrice > 0 && price <= item.stopLossPrice) {
        alerts.push({
          id: `al_${item.symbol}_sl_${todayKey}`,
          symbol: item.symbol,
          severity: 'critical',
          title: `${item.symbol} chạm ngưỡng cắt lỗ (${price.toLocaleString('vi-VN')} đ)`,
          message: `Thị giá ${price.toLocaleString('vi-VN')} đ đã giảm về vùng cắt lỗ ${item.stopLossPrice.toLocaleString('vi-VN')} đ (${changePct >= 0 ? '+' : ''}${changePct}%).`,
          triggerType: 'stop_loss',
          articleUrl: '',
          priceSnapshot: price,
          changePctSnapshot: changePct,
          read: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      } else if (changePct <= -threshold) {
        alerts.push({
          id: `al_${item.symbol}_drop_${todayKey}`,
          symbol: item.symbol,
          severity: 'critical',
          title: `${item.symbol} giảm sâu ${changePct}% vượt ngưỡng -${threshold}%`,
          message: `Giá khớp ${price.toLocaleString('vi-VN')} đ (Tham chiếu ${quote.refPrice.toLocaleString('vi-VN')} đ), KL ${quote.volume.toLocaleString('vi-VN')} cp.`,
          triggerType: 'price_drop',
          articleUrl: '',
          priceSnapshot: price,
          changePctSnapshot: changePct,
          read: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }

      if (quote.foreignNetVol <= -500_000 && changePct <= -1) {
        alerts.push({
          id: `al_${item.symbol}_fnet_${todayKey}`,
          symbol: item.symbol,
          severity: 'critical',
          title: `${item.symbol} khối ngoại bán ròng mạnh (${Math.round(quote.foreignNetVol).toLocaleString('vi-VN')} cp)`,
          message: `Áp lực bán ròng ngoại kết hợp giá giảm ${changePct}% xuống ${price.toLocaleString('vi-VN')} đ.`,
          triggerType: 'price_drop',
          articleUrl: '',
          priceSnapshot: price,
          changePctSnapshot: changePct,
          read: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }

      if (item.targetPrice > 0 && price >= item.targetPrice) {
        alerts.push({
          id: `al_${item.symbol}_tgt_${todayKey}`,
          symbol: item.symbol,
          severity: 'opportunity',
          title: `${item.symbol} đạt giá mục tiêu ${item.targetPrice.toLocaleString('vi-VN')} đ`,
          message: `Thị giá hiện tại ${price.toLocaleString('vi-VN')} đ (+${changePct}%), cân nhắc chốt lời từng phần hoặc nâng chặn lãi.`,
          triggerType: 'target_hit',
          articleUrl: '',
          priceSnapshot: price,
          changePctSnapshot: changePct,
          read: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      } else if (changePct >= threshold) {
        alerts.push({
          id: `al_${item.symbol}_brk_${todayKey}`,
          symbol: item.symbol,
          severity: 'opportunity',
          title: `${item.symbol} bứt phá +${changePct}% vượt ngưỡng +${threshold}%`,
          message: `Dòng tiền đẩy giá lên ${price.toLocaleString('vi-VN')} đ với thanh khoản ${quote.volume.toLocaleString('vi-VN')} cp.`,
          triggerType: 'price_breakout',
          articleUrl: '',
          priceSnapshot: price,
          changePctSnapshot: changePct,
          read: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      } else if (
        Math.abs(changePct) >= Math.max(1.8, threshold * 0.65) &&
        matchingNews.length === 0
      ) {
        alerts.push({
          id: `al_${item.symbol}_vol_${todayKey}`,
          symbol: item.symbol,
          severity: 'warning',
          title: `${item.symbol} biến động ${changePct >= 0 ? '+' : ''}${changePct}% chưa rõ tin hỗ trợ`,
          message: `Giá hiện khớp ${price.toLocaleString('vi-VN')} đ với KL ${quote.volume.toLocaleString('vi-VN')} cp nhưng chưa ghi nhận tin tức doanh nghiệp mới.`,
          triggerType: 'volume_spike',
          articleUrl: '',
          priceSnapshot: price,
          changePctSnapshot: changePct,
          read: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }
    }

    // News Sensitivity Rules
    for (const art of matchingNews.slice(0, 3)) {
      const artHash = hashShort(art.url);
      if (
        art.impactLabel === 'Rủi ro cao' &&
        (item.newsSensitivity === 'bearish' || item.newsSensitivity === 'all')
      ) {
        alerts.push({
          id: `al_${item.symbol}_nb_${artHash}`,
          symbol: item.symbol,
          severity: 'critical',
          title: `[Tin rủi ro · ${item.symbol}] ${art.title.slice(0, 140)}`,
          message: `${art.sourceName}: ${art.summary.slice(0, 220)}`,
          triggerType: 'news_bearish',
          articleUrl: art.url,
          priceSnapshot: price,
          changePctSnapshot: changePct,
          read: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      } else if (
        art.impactLabel === 'Hỗ trợ tăng' &&
        (item.newsSensitivity === 'bullish' || item.newsSensitivity === 'all')
      ) {
        alerts.push({
          id: `al_${item.symbol}_np_${artHash}`,
          symbol: item.symbol,
          severity: 'opportunity',
          title: `[Tín hiệu tích cực · ${item.symbol}] ${art.title.slice(0, 140)}`,
          message: `${art.sourceName}: ${art.summary.slice(0, 220)}`,
          triggerType: 'news_bullish',
          articleUrl: art.url,
          priceSnapshot: price,
          changePctSnapshot: changePct,
          read: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      } else if (item.newsSensitivity === 'all') {
        alerts.push({
          id: `al_${item.symbol}_na_${artHash}`,
          symbol: item.symbol,
          severity: 'warning',
          title: `[Tin mới · ${item.symbol}] ${art.title.slice(0, 140)}`,
          message: `${art.sourceName}: ${art.summary.slice(0, 220)}`,
          triggerType: 'news_any',
          articleUrl: art.url,
          priceSnapshot: price,
          changePctSnapshot: changePct,
          read: false,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }
    }
  }

  // 4. Dispatch Webhook for Critical Alerts if configured
  const webhookDeliveries = { attempted: 0, sent: 0, failed: 0 };
  if (getConfiguredWebhookUrl()) {
    const criticalAlerts = alerts.filter((a) => a.severity === 'critical').slice(0, 3);
    for (const ca of criticalAlerts) {
      webhookDeliveries.attempted += 1;
      const ok = await dispatchWebhookAlert(ca);
      if (ok) {
        ca.webhookSent = true;
        webhookDeliveries.sent += 1;
      } else {
        webhookDeliveries.failed += 1;
      }
    }
  }

  const marketDataMode =
    indicesRes.sourceMode === 'ssi' ||
    Object.values(quotesMap).some((q) => q.sourceMode === 'ssi')
      ? 'ssi'
      : 'fallback';

  const analyticsMap = await computeWatchlistStockAnalyticsBatch({
    symbols: params.watchlist.map((w) => w.symbol),
    quotes: quotesMap,
    taggedArticles,
  }).catch(() => ({} as Record<string, WatchlistStockAnalytics>));

  return {
    scannedAt: nowIso,
    marketDataMode,
    warningNote:
      marketDataMode === 'fallback'
        ? 'Đang dùng dữ liệu giá thị trường dự phòng (VPS/VNDirect) kết hợp RSS báo tài chính trực tiếp. Nhập khóa SSI FastConnect Data trong Cài đặt để bật khớp lệnh và dòng tiền Khối ngoại theo thời gian thực.'
        : undefined,
    indices: indicesRes.indices,
    macroQuotes,
    quotes: quotesMap,
    analytics: analyticsMap,
    taggedArticles,
    fetchedForStorage,
    statuses,
    alerts,
    botReport: report,
    webhookDeliveries,
    sourcesScanned,
  };
}

function buildQuantitativeWatchlistHealth(
  watchlist: WatchlistItemConfig[],
  quotes: Record<string, StockQuoteSnapshot>,
  taggedArticles: FinanceTaggedArticle[]
): WatchlistAiHealthResponse {
  const quoteList = watchlist
    .map((w) => quotes[w.symbol])
    .filter((q): q is StockQuoteSnapshot => Boolean(q && q.price > 0));

  const sortedByChange = [...quoteList].sort((a, b) => b.changePct - a.changePct);
  const strongest = sortedByChange[0];
  const riskiest = sortedByChange[sortedByChange.length - 1];

  const avgChange =
    quoteList.length > 0
      ? Number(
          (
            quoteList.reduce((acc, q) => acc + q.changePct, 0) / quoteList.length
          ).toFixed(2)
        )
      : 0;

  const riskNews = taggedArticles.filter((a) => a.impactLabel === 'Rủi ro cao');
  const bullNews = taggedArticles.filter((a) => a.impactLabel === 'Hỗ trợ tăng');

  const overallStance: WatchlistAiHealthResponse['overallStance'] =
    avgChange >= 0.8 && riskNews.length === 0
      ? 'Tích cực'
      : avgChange <= -1 || riskNews.length >= 2
        ? 'Phòng thủ'
        : 'Cân bằng';

  const bullets: string[] = [
    `Hiệu suất bình quân danh mục (${watchlist.length} mã): ${avgChange >= 0 ? '+' : ''}${avgChange}% trong phiên gần nhất.`,
    strongest
      ? `Mã dẫn dắt danh mục: ${strongest.symbol} (${strongest.price.toLocaleString('vi-VN')} đ, ${strongest.changePct >= 0 ? '+' : ''}${strongest.changePct}%, KL ${strongest.volume.toLocaleString('vi-VN')} cp).`
      : 'Chưa ghi nhận mã tăng vượt trội trong phiên.',
    riskiest && riskiest.symbol !== strongest?.symbol
      ? `Mã cần lưu ý rủi ro: ${riskiest.symbol} (${riskiest.changePct >= 0 ? '+' : ''}${riskiest.changePct}%${riskiest.foreignNetVol < 0 ? `, khối ngoại bán ròng ${Math.abs(riskiest.foreignNetVol).toLocaleString('vi-VN')} cp` : ''}).`
      : 'Các mã còn lại giữ biến động quanh tham chiếu.',
    `Quét tin tài chính ghi nhận ${bullNews.length} tin hỗ trợ tăng và ${riskNews.length} tin rủi ro cao gắn thẻ liên quan trực tiếp.`,
  ];

  return {
    generatedAt: new Date().toISOString(),
    mode: 'quantitative',
    overallStance,
    strongestSymbol: strongest?.symbol || watchlist[0]?.symbol || '—',
    riskiestSymbol: riskiest?.symbol || watchlist[0]?.symbol || '—',
    bullets,
    disclaimer:
      'Báo cáo định lượng tự động từ dữ liệu giá & luồng tin sạch DedupBot; không phải khuyến nghị đầu tư tài chính.',
  };
}

export async function generateWatchlistHealthSummary(params: {
  watchlist: WatchlistItemConfig[];
  quotes: Record<string, StockQuoteSnapshot>;
  taggedArticles: FinanceTaggedArticle[];
}): Promise<WatchlistAiHealthResponse> {
  if (params.watchlist.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      mode: 'quantitative',
      overallStance: 'Cân bằng',
      strongestSymbol: '—',
      riskiestSymbol: '—',
      bullets: ['Danh mục Watchlist đang trống. Vui lòng thêm ít nhất 1 mã cổ phiếu để phân tích.'],
      disclaimer: 'Phân tích phục vụ theo dõi thông tin, không phải khuyến nghị giao dịch.',
    };
  }

  const ai = getGeminiClient();
  if (!ai || isApiInCooldown('gemini')) {
    return buildQuantitativeWatchlistHealth(
      params.watchlist,
      params.quotes,
      params.taggedArticles
    );
  }

  const digestRows = params.watchlist.map((w) => {
    const q = params.quotes[w.symbol];
    const relNews = params.taggedArticles
      .filter((a) => a.matchedTickers.includes(w.symbol))
      .slice(0, 2)
      .map((a) => `[${a.impactLabel}] ${a.title}`);
    return `- ${w.symbol} (${w.exchange}): giá ${q ? q.price.toLocaleString('vi-VN') : 'N/A'} đ (${q ? `${q.changePct}%` : 'N/A'}), KL ${q ? q.volume.toLocaleString('vi-VN') : 'N/A'}, Ngoại ròng ${q ? q.foreignNetVol.toLocaleString('vi-VN') : '0'} | Ngưỡng ±${w.priceChangeThresholdPct}%, Target ${w.targetPrice || '—'}, Cắt lỗ ${w.stopLossPrice || '—'} | Tin: ${relNews.join('; ') || 'Không có tin mới'}`;
  });

  const start = Date.now();
  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Bạn là chuyên viên phân tích chứng khoán Việt Nam tại tòa soạn "Lăng Kính".
Dựa trên dữ liệu thị trường và tin tức đã khử trùng lặp sau đây của danh mục Watchlist, hãy tóm tắt sức khỏe danh mục thành 4 gạch đầu dòng súc tích, thực tế (nêu rõ mã khỏe nhất, mã cần quản trị rủi ro và tác động tin tức):

${digestRows.join('\n')}`,
        config: {
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              overallStance: { type: Type.STRING },
              strongestSymbol: { type: Type.STRING },
              riskiestSymbol: { type: Type.STRING },
              bullets: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['overallStance', 'strongestSymbol', 'riskiestSymbol', 'bullets'],
          },
        },
      }),
      6500,
      'watchlist-summary'
    );

    recordApiCall({
      apiId: 'gemini',
      endpoint: '/api/finance/watchlist-summary',
      statusCode: 200,
      ok: true,
      latencyMs: Date.now() - start,
    });

    const parsed = JSON.parse(response.text || '{}') as {
      overallStance?: string;
      strongestSymbol?: string;
      riskiestSymbol?: string;
      bullets?: string[];
    };

    const stance: WatchlistAiHealthResponse['overallStance'] =
      parsed.overallStance === 'Tích cực' || parsed.overallStance === 'Phòng thủ'
        ? parsed.overallStance
        : 'Cân bằng';

    return {
      generatedAt: new Date().toISOString(),
      mode: 'gemini',
      overallStance: stance,
      strongestSymbol: parsed.strongestSymbol || params.watchlist[0].symbol,
      riskiestSymbol: parsed.riskiestSymbol || params.watchlist[0].symbol,
      bullets: Array.isArray(parsed.bullets) && parsed.bullets.length > 0
        ? parsed.bullets.slice(0, 5)
        : buildQuantitativeWatchlistHealth(
            params.watchlist,
            params.quotes,
            params.taggedArticles
          ).bullets,
      disclaimer:
        'Tổng hợp bởi Gemini từ dữ liệu giá & tin tức trong phiên; không phải khuyến nghị mua/bán.',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const is429 = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
    const isTimeout = msg.includes('GEMINI_TIMEOUT_');
    recordApiCall({
      apiId: 'gemini',
      endpoint: '/api/finance/watchlist-summary',
      statusCode: is429 ? 429 : isTimeout ? 504 : 500,
      ok: false,
      latencyMs: Date.now() - start,
      cooldownSeconds: is429 ? 45 : isTimeout ? 15 : 0,
    });
    return buildQuantitativeWatchlistHealth(
      params.watchlist,
      params.quotes,
      params.taggedArticles
    );
  }
}

function buildQuantitativePrediction(params: {
  symbol: string;
  timeframe: ChartTimeframe;
  quote: StockQuoteSnapshot;
  ohlcRes: Awaited<ReturnType<typeof getMultiTimeframeChartTechnical>>;
  newsMarkers: StockPredictionResponse['newsMarkers'];
  corporateEvents?: CorporateEventItem[];
}): StockPredictionResponse {
  const { symbol, timeframe, quote, ohlcRes, newsMarkers, corporateEvents } = params;
  const {
    indicators,
    ohlc,
    reversalSignals,
    riskReward,
    candlestickSignals,
    tradeSetup,
    anomalies,
    marketDataMode,
  } = ohlcRes;

  let score = 0; // -10 .. +10
  if (indicators.priceVsMa20Pct !== null) {
    score += indicators.priceVsMa20Pct > 0 ? 2 : -2;
  }
  if (indicators.rsi14 !== null) {
    if (indicators.rsi14 >= 55 && indicators.rsi14 <= 70) score += 2;
    else if (indicators.rsi14 > 75) score -= 1;
    else if (indicators.rsi14 < 40) score -= 2;
  }
  if (quote.changePct > 1) score += 1;
  if (quote.changePct < -1.5) score -= 1;
  if (quote.foreignNetVol > 100_000) score += 1;
  if (quote.foreignNetVol < -200_000) score -= 1;

  for (const rev of reversalSignals) {
    score += rev.direction === 'bullish' ? 1.5 : -1.5;
  }

  for (const nm of newsMarkers.slice(0, 4)) {
    if (nm.impactLabel === 'Hỗ trợ tăng') score += 1;
    if (nm.impactLabel === 'Rủi ro cao') score -= 1.5;
  }

  const rawUp = Math.max(15, Math.min(72, Math.round(38 + score * 4.5)));
  const rawDown = Math.max(12, Math.min(68, Math.round(30 - score * 4)));
  const probSideways = Math.max(10, 100 - rawUp - rawDown);
  const normTotal = rawUp + rawDown + probSideways;
  const probUp = Math.round((rawUp / normTotal) * 100);
  const probDown = Math.round((rawDown / normTotal) * 100);
  const adjSideways = Math.max(0, 100 - probUp - probDown);

  const dirT3: 'Tăng' | 'Đi ngang' | 'Giảm' =
    probUp >= probDown + 10 ? 'Tăng' : probDown >= probUp + 10 ? 'Giảm' : 'Đi ngang';

  const price = quote.price || ohlc[ohlc.length - 1]?.close || 10000;
  const lowT3 = Math.round((price * 0.97) / 100) * 100;
  const highT3 = Math.round((price * 1.035) / 100) * 100;
  const lowT10 = Math.round((indicators.support || price * 0.94) / 100) * 100;
  const highT10 = Math.round((indicators.resistance || price * 1.07) / 100) * 100;

  return {
    generatedAt: new Date().toISOString(),
    symbol,
    companyName: quote.companyName,
    exchange: quote.exchange,
    timeframe,
    marketDataMode,
    predictionMode: 'quantitative',
    quote,
    ohlc,
    indicators,
    reversalSignals,
    riskReward,
    candlestickSignals,
    tradeSetup,
    anomalies,
    corporateEvents: corporateEvents?.filter((e) => !e.symbol || e.symbol === symbol),
    newsMarkers,
    outlookT3: {
      direction: dirT3,
      probUp,
      probSideways: adjSideways,
      probDown,
      targetRange: `${lowT3.toLocaleString('vi-VN')} – ${highT3.toLocaleString('vi-VN')} đ`,
      thesis: `Kỹ thuật ${indicators.trendSignal}: Giá hiện ${indicators.priceVsMa20Pct !== null ? `${indicators.priceVsMa20Pct >= 0 ? 'trên' : 'dưới'} MA20 (${indicators.priceVsMa20Pct}%)` : 'quanh trung bình 20 phiên'}, RSI(14) = ${indicators.rsi14 ?? 'N/A'}.`,
    },
    outlookT10: {
      direction: dirT3,
      probUp: Math.min(75, probUp + (indicators.trendSignal === 'Tăng' ? 3 : 0)),
      probSideways: Math.max(10, adjSideways - 3),
      probDown: Math.max(10, 100 - Math.min(75, probUp + (indicators.trendSignal === 'Tăng' ? 3 : 0)) - Math.max(10, adjSideways - 3)),
      targetRange: `${lowT10.toLocaleString('vi-VN')} – ${highT10.toLocaleString('vi-VN')} đ`,
      thesis: `Biên độ 10 phiên theo vùng hỗ trợ ${indicators.support.toLocaleString('vi-VN')} đ và kháng cự ${indicators.resistance.toLocaleString('vi-VN')} đ.`,
    },
    catalysts: [
      `Thanh khoản phiên gần nhất đạt ${quote.volume.toLocaleString('vi-VN')} cp${indicators.volumeRatio20 ? ` (${indicators.volumeRatio20}x TB 20 phiên)` : ''}.`,
      reversalSignals.find((r) => r.direction === 'bullish')?.description ||
        newsMarkers.find((n) => n.impactLabel === 'Hỗ trợ tăng')?.title ||
        `Vùng hỗ trợ kỹ thuật giữ ổn định quanh ${indicators.support.toLocaleString('vi-VN')} đ.`,
    ],
    risks: [
      reversalSignals.find((r) => r.direction === 'bearish')?.description ||
        newsMarkers.find((n) => n.impactLabel === 'Rủi ro cao')?.title ||
        `Áp lực cung ngắn hạn quanh vùng kháng cự ${indicators.resistance.toLocaleString('vi-VN')} đ.`,
      quote.foreignNetVol < 0
        ? `Khối ngoại đang bán ròng ${Math.abs(quote.foreignNetVol).toLocaleString('vi-VN')} cp.`
        : 'Biến động chung của VN-Index có thể tác động tới nhịp cổ phiếu.',
    ],
    actionPlan:
      indicators.trendSignal === 'Tăng'
        ? `Nắm giữ theo xu hướng; cân nhắc gia tăng khi rung lắc kiểm định MA20 (${(indicators.ma20 || price).toLocaleString('vi-VN')} đ), chặn rủi ro dưới ${riskReward.slPrice.toLocaleString('vi-VN')} đ.`
        : `Quan sát phản ứng tại vùng hỗ trợ ${indicators.support.toLocaleString('vi-VN')} đ; ưu tiên quản trị tỷ trọng nếu đóng cửa dưới ${riskReward.slPrice.toLocaleString('vi-VN')} đ.`,
  };
}

export async function predictStockMovement(params: {
  symbol: string;
  timeframe?: ChartTimeframe;
  watchlistItem?: WatchlistItemConfig;
  recentNews?: Array<{
    title: string;
    summary?: string;
    impactLabel: FinanceArticleImpactLabel;
    publishedRelative: string;
    url: string;
    sourceName: string;
  }>;
  corporateEvents?: CorporateEventItem[];
}): Promise<StockPredictionResponse> {
  const symbol = params.symbol.trim().toUpperCase();
  const timeframe: ChartTimeframe = params.timeframe || '1D';
  const newsMarkers = (params.recentNews || []).slice(0, 8);

  const chartRes = await getMultiTimeframeChartTechnical({
    symbol,
    timeframe,
    recentNews: newsMarkers,
    corporateEvents: params.corporateEvents,
  });

  const fallbackQuote: StockQuoteSnapshot = {
    ...chartRes.quote,
    exchange: params.watchlistItem?.exchange || chartRes.quote.exchange,
    companyName:
      chartRes.quote.companyName !== symbol
        ? chartRes.quote.companyName
        : params.watchlistItem?.companyName || symbol,
  };

  const quantBase = buildQuantitativePrediction({
    symbol,
    timeframe,
    quote: fallbackQuote,
    ohlcRes: chartRes,
    newsMarkers,
    corporateEvents: params.corporateEvents,
  });

  const ai = getGeminiClient();
  if (!ai || isApiInCooldown('gemini')) {
    return quantBase;
  }

  const start = Date.now();
  try {
    const prompt = `Bạn là chuyên gia phân tích kỹ thuật & cơ bản chứng khoán Việt Nam.
Hãy phân tích nhịp cổ phiếu ${symbol} (${fallbackQuote.companyName} - ${fallbackQuote.exchange}) từ dữ liệu thực tế (${timeframe}):
- Giá khớp: ${fallbackQuote.price.toLocaleString('vi-VN')} đ (${fallbackQuote.changePct >= 0 ? '+' : ''}${fallbackQuote.changePct}%)
- Khối lượng: ${fallbackQuote.volume.toLocaleString('vi-VN')} cp (${chartRes.indicators.volumeRatio20 || 1}x TB 20 phiên)
- Khối ngoại ròng: ${fallbackQuote.foreignNetVol.toLocaleString('vi-VN')} cp
- MA20: ${chartRes.indicators.ma20 ?? 'N/A'} | MA50: ${chartRes.indicators.ma50 ?? 'N/A'} | Bollinger: ${chartRes.indicators.bbLower ?? 'N/A'}–${chartRes.indicators.bbUpper ?? 'N/A'}
- RSI(14): ${chartRes.indicators.rsi14 ?? 'N/A'}
- Tín hiệu đảo chiều thuật toán: ${chartRes.reversalSignals.map((r) => r.label).join(', ') || 'Chưa ghi nhận đảo chiều rõ'}
- Hỗ trợ 20 phiên: ${chartRes.indicators.support} đ | Kháng cự 20 phiên: ${chartRes.indicators.resistance} đ
- Các tin tức đã khử trùng lặp gần đây:
${newsMarkers.map((n) => `  * [${n.impactLabel}] ${n.title} (${n.sourceName})`).join('\n') || '  * Chưa có tin tức riêng nổi bật'}

Yêu cầu trả về JSON hợp lệ dự đoán kịch bản T+3 và T+10 (xác suất probUp + probSideways + probDown = 100), vùng giá mục tiêu, động lực tăng (catalysts), rủi ro chính (risks) và kế hoạch hành động (actionPlan) ngắn gọn bằng tiếng Việt.`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              outlookT3: {
                type: Type.OBJECT,
                properties: {
                  direction: { type: Type.STRING },
                  probUp: { type: Type.INTEGER },
                  probSideways: { type: Type.INTEGER },
                  probDown: { type: Type.INTEGER },
                  targetRange: { type: Type.STRING },
                  thesis: { type: Type.STRING },
                },
                required: ['direction', 'probUp', 'probSideways', 'probDown', 'targetRange', 'thesis'],
              },
              outlookT10: {
                type: Type.OBJECT,
                properties: {
                  direction: { type: Type.STRING },
                  probUp: { type: Type.INTEGER },
                  probSideways: { type: Type.INTEGER },
                  probDown: { type: Type.INTEGER },
                  targetRange: { type: Type.STRING },
                  thesis: { type: Type.STRING },
                },
                required: ['direction', 'probUp', 'probSideways', 'probDown', 'targetRange', 'thesis'],
              },
              catalysts: { type: Type.ARRAY, items: { type: Type.STRING } },
              risks: { type: Type.ARRAY, items: { type: Type.STRING } },
              actionPlan: { type: Type.STRING },
            },
            required: ['outlookT3', 'outlookT10', 'catalysts', 'risks', 'actionPlan'],
          },
        },
      }),
      6500,
      'stock-predict'
    );

    recordApiCall({
      apiId: 'gemini',
      endpoint: `/api/finance/stock-predict (${symbol})`,
      statusCode: 200,
      ok: true,
      latencyMs: Date.now() - start,
    });

    const parsed = JSON.parse(response.text || '{}') as Partial<StockPredictionResponse>;
    const normalizeHorizon = (
      h: StockPredictionResponse['outlookT3'] | undefined,
      fallback: StockPredictionResponse['outlookT3']
    ) => {
      if (!h) return fallback;
      const u = Math.max(0, Number(h.probUp) || 0);
      const s = Math.max(0, Number(h.probSideways) || 0);
      const d = Math.max(0, Number(h.probDown) || 0);
      const tot = u + s + d;
      if (tot <= 0) return fallback;
      const pu = Math.round((u / tot) * 100);
      const ps = Math.round((s / tot) * 100);
      const pd = Math.max(0, 100 - pu - ps);
      const dir: 'Tăng' | 'Đi ngang' | 'Giảm' =
        h.direction === 'Tăng' || h.direction === 'Giảm' ? h.direction : 'Đi ngang';
      return {
        direction: dir,
        probUp: pu,
        probSideways: ps,
        probDown: pd,
        targetRange: h.targetRange || fallback.targetRange,
        thesis: h.thesis || fallback.thesis,
      };
    };

    return {
      ...quantBase,
      predictionMode: 'gemini',
      outlookT3: normalizeHorizon(parsed.outlookT3, quantBase.outlookT3),
      outlookT10: normalizeHorizon(parsed.outlookT10, quantBase.outlookT10),
      catalysts:
        Array.isArray(parsed.catalysts) && parsed.catalysts.length > 0
          ? parsed.catalysts.slice(0, 4)
          : quantBase.catalysts,
      risks:
        Array.isArray(parsed.risks) && parsed.risks.length > 0
          ? parsed.risks.slice(0, 4)
          : quantBase.risks,
      actionPlan: parsed.actionPlan || quantBase.actionPlan,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const is429 = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
    const isTimeout = msg.includes('GEMINI_TIMEOUT_');
    recordApiCall({
      apiId: 'gemini',
      endpoint: `/api/finance/stock-predict (${symbol})`,
      statusCode: is429 ? 429 : isTimeout ? 504 : 500,
      ok: false,
      latencyMs: Date.now() - start,
      cooldownSeconds: is429 ? 45 : isTimeout ? 15 : 0,
    });
    return quantBase;
  }
}

const cashflowTimingCache = new Map<
  string,
  { data: CorporateCashflowTimingResponse; expiresAt: number }
>();

const FUNDAMENTAL_CASHFLOW_KEYWORDS = [
  'doanh thu',
  'lợi nhuận',
  'cổ tức',
  'dòng tiền',
  'lãi ròng',
  'biên lãi',
  'trúng thầu',
  'mở rộng',
  'dự án',
  'nhà máy',
  'vốn điều lệ',
  'tăng trưởng',
  'nợ vay',
  'báo cáo tài chính',
  'quý ',
  'chia thưởng',
];

function buildQuantitativeCashflowTiming(params: {
  symbol: string;
  quote: StockQuoteSnapshot;
  indicators: Awaited<ReturnType<typeof getDailyOhlcHistory>>['indicators'];
  reversals: Awaited<ReturnType<typeof getDailyOhlcHistory>>['reversalSignals'];
  relevantArticles: Array<{
    title: string;
    summary: string;
    impactLabel: FinanceArticleImpactLabel;
    sourceName: string;
  }>;
}): CorporateCashflowTimingResponse {
  const { symbol, quote, indicators, reversals, relevantArticles } = params;

  const bullCount = relevantArticles.filter((a) => a.impactLabel === 'Hỗ trợ tăng').length;
  const bearCount = relevantArticles.filter((a) => a.impactLabel === 'Rủi ro cao').length;
  const fundamentalMentions = relevantArticles.filter((a) =>
    FUNDAMENTAL_CASHFLOW_KEYWORDS.some((kw) =>
      `${a.title} ${a.summary}`.toLowerCase().includes(kw)
    )
  ).length;

  const operatingScore = Math.max(
    35,
    Math.min(
      95,
      58 + fundamentalMentions * 7 + bullCount * 6 - bearCount * 10
    )
  );

  const volRatio = indicators.volumeRatio20 ?? 1;
  let foreignScore = 55;
  if (quote.foreignNetVol > 250_000) foreignScore += 22;
  else if (quote.foreignNetVol > 0) foreignScore += 10;
  else if (quote.foreignNetVol < -250_000) foreignScore -= 18;
  else if (quote.foreignNetVol < 0) foreignScore -= 8;

  if (volRatio >= 1.4 && quote.changePct >= 0) foreignScore += 12;
  if (volRatio >= 1.5 && quote.changePct < -1.5) foreignScore -= 12;
  foreignScore = Math.max(25, Math.min(95, foreignScore));

  let momentumScore = 54 + bullCount * 9 - bearCount * 12;
  if (indicators.trendSignal === 'Tăng') momentumScore += 12;
  if (indicators.trendSignal === 'Suy yếu') momentumScore -= 12;
  if (reversals.some((r) => r.direction === 'bullish')) momentumScore += 8;
  if (reversals.some((r) => r.direction === 'bearish')) momentumScore -= 8;
  momentumScore = Math.max(25, Math.min(95, momentumScore));

  const cashflowScore = Math.round(
    operatingScore * 0.36 + foreignScore * 0.34 + momentumScore * 0.3
  );

  let timingAction: MarketTimingAction = 'CHỜ ĐIỀU CHỈNH';
  if (
    cashflowScore >= 72 &&
    indicators.trendSignal === 'Tăng' &&
    (indicators.rsi14 ?? 55) <= 68
  ) {
    timingAction = 'GIA TĂNG TỶ TRỌNG';
  } else if (
    cashflowScore >= 60 &&
    (reversals.some((r) => r.direction === 'bullish') ||
      (indicators.priceVsMa20Pct !== null &&
        indicators.priceVsMa20Pct >= -2 &&
        indicators.priceVsMa20Pct <= 3.5))
  ) {
    timingAction = 'MUA THĂM DÒ';
  } else if (
    cashflowScore < 46 ||
    reversals.some((r) => r.direction === 'bearish') ||
    (indicators.rsi14 !== null && indicators.rsi14 >= 76)
  ) {
    timingAction = 'CHỐT LỜI / ĐỨNG NGOÀI';
  }

  const price = quote.price || indicators.ma20 || 10000;
  const entryLow = Math.round(
    Math.max(indicators.support || price * 0.96, (indicators.ma20 || price) * 0.985) / 50
  ) * 50;
  const entryHigh = Math.round((price * 1.008) / 50) * 50;

  return {
    generatedAt: new Date().toISOString(),
    symbol,
    mode: 'quantitative',
    cached: false,
    cashflowScore,
    pillars: {
      operatingCashflow: {
        score: operatingScore,
        summary:
          fundamentalMentions > 0
            ? `Ghi nhận ${fundamentalMentions} bản tin cơ bản nhắc tới doanh thu/lợi nhuận/dự án từ Kho Tin (${bullCount} tin tích cực, ${bearCount} tin rủi ro).`
            : 'Chưa có báo cáo lợi nhuận hoặc cổ tức đột biến mới; dòng tiền cốt lõi giữ ở mức nền ổn định.',
      },
      foreignInstitutionalFlow: {
        score: foreignScore,
        summary:
          quote.foreignNetVol !== 0
            ? `Khối ngoại ${quote.foreignNetVol > 0 ? 'mua ròng' : 'bán ròng'} ${Math.abs(quote.foreignNetVol).toLocaleString('vi-VN')} cp; thanh khoản phiên đạt ${volRatio}x TB 20 phiên.`
            : `Thanh khoản phiên đạt ${volRatio}x TB 20 phiên (chưa ghi nhận áp lực bán ròng ngoại từ nguồn SSI).`,
      },
      newsGrowthMomentum: {
        score: momentumScore,
        summary:
          reversals.length > 0
            ? `Động lượng giá ${indicators.trendSignal} kèm tín hiệu ${reversals[0].label}.`
            : `Xu hướng giá ${indicators.trendSignal}, RSI(14) = ${indicators.rsi14 ?? 'N/A'}.`,
      },
    },
    timingAction,
    optimalEntryZone: `${Math.min(entryLow, entryHigh).toLocaleString('vi-VN')} – ${Math.max(entryLow, entryHigh).toLocaleString('vi-VN')} đ`,
    liquidityCondition: `Cần duy trì KL phiên ≥ ${Math.round((indicators.volMa20 || quote.volume || 100000) * 1.15).toLocaleString('vi-VN')} cp (>1.15x TB 20 phiên) và giữ vững hỗ trợ ${indicators.support.toLocaleString('vi-VN')} đ.`,
    summaryThesis: `Điểm lợi thế dòng tiền ${symbol} đạt ${cashflowScore}/100 (${timingAction}). Mô hình kết hợp hấp thụ cung cầu phiên (${volRatio}x TB), định vị quanh MA20 (${(indicators.ma20 || price).toLocaleString('vi-VN')} đ) và ${relevantArticles.length} bản tin đã lọc trùng.`,
    evidenceFromNewsCount: relevantArticles.length,
    disclaimer:
      'Phân tích định lượng đa yếu tố kết hợp dữ liệu thị trường & Kho Tin sạch DedupBot; chỉ phục vụ tham khảo, không phải khuyến nghị mua/bán.',
  };
}

export async function analyzeCorporateCashflowTiming(params: {
  symbol: string;
  watchlistItem?: WatchlistItemConfig;
  taggedArticles?: FinanceTaggedArticle[];
  storedArticles?: Array<Pick<StoredNewsArticle, 'title' | 'summary' | 'sourceName' | 'sentimentLabel' | 'url'>>;
}): Promise<CorporateCashflowTimingResponse> {
  const symbol = params.symbol.trim().toUpperCase();

  // Merge DedupBot-cleaned articles from both Kho Tin and tagged financial feed
  const combinedNews: Array<{
    title: string;
    summary: string;
    impactLabel: FinanceArticleImpactLabel;
    sourceName: string;
  }> = [];
  const seenTitles = new Set<string>();

  for (const ta of params.taggedArticles || []) {
    if (!ta.matchedTickers.includes(symbol)) continue;
    const key = ta.title.toLowerCase().trim();
    if (seenTitles.has(key)) continue;
    seenTitles.add(key);
    combinedNews.push({
      title: ta.title,
      summary: ta.summary,
      impactLabel: ta.impactLabel,
      sourceName: ta.sourceName,
    });
  }

  for (const sa of params.storedArticles || []) {
    const text = `${sa.title} ${sa.summary}`.toUpperCase();
    if (!new RegExp(`\\b${symbol}\\b`).test(text)) continue;
    const key = sa.title.toLowerCase().trim();
    if (seenTitles.has(key)) continue;
    seenTitles.add(key);
    combinedNews.push({
      title: sa.title,
      summary: sa.summary,
      impactLabel:
        sa.sentimentLabel === 'Tích cực'
          ? 'Hỗ trợ tăng'
          : sa.sentimentLabel === 'Tiêu cực'
            ? 'Rủi ro cao'
            : 'Trung lập',
      sourceName: sa.sourceName,
    });
  }

  const newsHash = hashShort(
    combinedNews
      .slice(0, 8)
      .map((n) => n.title)
      .join('|') || 'none'
  );
  const cacheKey = `${symbol}::${newsHash}`;
  const cached = cashflowTimingCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.data, cached: true };
  }

  const [quoteRes, ohlcRes] = await Promise.all([
    getStockQuote(symbol),
    getDailyOhlcHistory(symbol, 120, '1D'),
  ]);

  const lastBar = ohlcRes.ohlc[ohlcRes.ohlc.length - 1];
  const prevBar = ohlcRes.ohlc[ohlcRes.ohlc.length - 2];
  const quote: StockQuoteSnapshot = quoteRes || {
    symbol,
    exchange: params.watchlistItem?.exchange || 'HOSE',
    companyName: params.watchlistItem?.companyName || symbol,
    price: lastBar?.close || 0,
    refPrice: prevBar?.close || lastBar?.close || 0,
    ceilingPrice: Math.round((prevBar?.close || 0) * 1.07),
    floorPrice: Math.round((prevBar?.close || 0) * 0.93),
    change: lastBar && prevBar ? Math.round(lastBar.close - prevBar.close) : 0,
    changePct:
      lastBar && prevBar && prevBar.close > 0
        ? Number((((lastBar.close - prevBar.close) / prevBar.close) * 100).toFixed(2))
        : 0,
    volume: lastBar?.volume || 0,
    valueVnd: (lastBar?.close || 0) * (lastBar?.volume || 0),
    foreignBuyVol: 0,
    foreignSellVol: 0,
    foreignNetVol: 0,
    tradingDate: lastBar?.date || new Date().toISOString().split('T')[0],
    sourceMode: ohlcRes.sourceMode,
  };

  const quantFallback = buildQuantitativeCashflowTiming({
    symbol,
    quote,
    indicators: ohlcRes.indicators,
    reversals: ohlcRes.reversalSignals,
    relevantArticles: combinedNews.slice(0, 10),
  });

  const ai = getGeminiClient();
  if (!ai || isApiInCooldown('gemini')) {
    cashflowTimingCache.set(cacheKey, {
      data: quantFallback,
      expiresAt: Date.now() + 10 * 60_000,
    });
    return quantFallback;
  }

  const start = Date.now();
  try {
    const newsDigestText =
      combinedNews
        .slice(0, 8)
        .map((n, idx) => `${idx + 1}. [${n.impactLabel} · ${n.sourceName}] ${n.title} — ${n.summary.slice(0, 220)}`)
        .join('\n') || 'Chưa ghi nhận tin tức doanh nghiệp cụ thể trong Kho Tin gần đây.';

    const prompt = `Bạn là chuyên gia phân tích dòng tiền doanh nghiệp & định thời điểm đầu tư (Market Timing) trên thị trường chứng khoán Việt Nam.
Phân tích mã cổ phiếu ${symbol} (${quote.companyName} · ${quote.exchange}) dựa trên dữ liệu thực tế:

1. DÒNG TIỀN THỊ TRƯỜNG (Smart Money Flow):
- Giá khớp: ${quote.price.toLocaleString('vi-VN')} đ (${quote.changePct >= 0 ? '+' : ''}${quote.changePct}%)
- Khối lượng phiên: ${quote.volume.toLocaleString('vi-VN')} cp (${ohlcRes.indicators.volumeRatio20 || 1}x TB 20 phiên)
- Khối ngoại mua ròng/bán ròng: ${quote.foreignNetVol.toLocaleString('vi-VN')} cp (Mua ${quote.foreignBuyVol.toLocaleString('vi-VN')} / Bán ${quote.foreignSellVol.toLocaleString('vi-VN')})
- MA20: ${ohlcRes.indicators.ma20 ?? 'N/A'} | MA50: ${ohlcRes.indicators.ma50 ?? 'N/A'} | Bollinger: ${ohlcRes.indicators.bbLower ?? 'N/A'}–${ohlcRes.indicators.bbUpper ?? 'N/A'} | RSI(14): ${ohlcRes.indicators.rsi14 ?? 'N/A'}
- Tín hiệu đảo chiều phát hiện được: ${ohlcRes.reversalSignals.map((r) => r.label).join('; ') || 'Chưa có tín hiệu đảo chiều cực đoan'}

2. DỮ LIỆU TIN TỨC CƠ BẢN & DÒNG TIỀN TỪ KHO TIN (Đã lọc trùng DedupBot):
${newsDigestText}

Yêu cầu trả về JSON chuẩn với:
- cashflowScore (0-100)
- pillars: 3 trụ cột (operatingCashflow, foreignInstitutionalFlow, newsGrowthMomentum), mỗi trụ cột gồm score (0-100) và summary (1-2 câu tiếng Việt thực chất)
- timingAction: PHẢI chọn đúng 1 trong 4 giá trị: "MUA THĂM DÒ" | "GIA TĂNG TỶ TRỌNG" | "CHỜ ĐIỀU CHỈNH" | "CHỐT LỜI / ĐỨNG NGOÀI"
- optimalEntryZone: Vùng giá giải ngân tối ưu (VD: "28.500 – 29.400 đ")
- liquidityCondition: Điều kiện thanh khoản xác nhận (1 câu ngắn gọn kèm số khối lượng)
- summaryThesis: Luận điểm tổng hợp dòng tiền & thời điểm giải ngân (2-3 câu).`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              cashflowScore: { type: Type.INTEGER },
              pillars: {
                type: Type.OBJECT,
                properties: {
                  operatingCashflow: {
                    type: Type.OBJECT,
                    properties: {
                      score: { type: Type.INTEGER },
                      summary: { type: Type.STRING },
                    },
                    required: ['score', 'summary'],
                  },
                  foreignInstitutionalFlow: {
                    type: Type.OBJECT,
                    properties: {
                      score: { type: Type.INTEGER },
                      summary: { type: Type.STRING },
                    },
                    required: ['score', 'summary'],
                  },
                  newsGrowthMomentum: {
                    type: Type.OBJECT,
                    properties: {
                      score: { type: Type.INTEGER },
                      summary: { type: Type.STRING },
                    },
                    required: ['score', 'summary'],
                  },
                },
                required: [
                  'operatingCashflow',
                  'foreignInstitutionalFlow',
                  'newsGrowthMomentum',
                ],
              },
              timingAction: { type: Type.STRING },
              optimalEntryZone: { type: Type.STRING },
              liquidityCondition: { type: Type.STRING },
              summaryThesis: { type: Type.STRING },
            },
            required: [
              'cashflowScore',
              'pillars',
              'timingAction',
              'optimalEntryZone',
              'liquidityCondition',
              'summaryThesis',
            ],
          },
        },
      }),
      6500,
      'cashflow-timing'
    );

    recordApiCall({
      apiId: 'gemini',
      endpoint: `/api/finance/cashflow-timing (${symbol})`,
      statusCode: 200,
      ok: true,
      latencyMs: Date.now() - start,
    });

    const parsed = JSON.parse(response.text || '{}') as Partial<CorporateCashflowTimingResponse>;
    const validActions: MarketTimingAction[] = [
      'MUA THĂM DÒ',
      'GIA TĂNG TỶ TRỌNG',
      'CHỜ ĐIỀU CHỈNH',
      'CHỐT LỜI / ĐỨNG NGOÀI',
    ];
    const timingAction = validActions.includes(parsed.timingAction as MarketTimingAction)
      ? (parsed.timingAction as MarketTimingAction)
      : quantFallback.timingAction;

    const clampScore = (v: unknown, fb: number) =>
      Math.max(10, Math.min(98, Math.round(Number(v) || fb)));

    const result: CorporateCashflowTimingResponse = {
      generatedAt: new Date().toISOString(),
      symbol,
      mode: 'gemini',
      cached: false,
      cashflowScore: clampScore(parsed.cashflowScore, quantFallback.cashflowScore),
      pillars: {
        operatingCashflow: {
          score: clampScore(
            parsed.pillars?.operatingCashflow?.score,
            quantFallback.pillars.operatingCashflow.score
          ),
          summary:
            parsed.pillars?.operatingCashflow?.summary ||
            quantFallback.pillars.operatingCashflow.summary,
        },
        foreignInstitutionalFlow: {
          score: clampScore(
            parsed.pillars?.foreignInstitutionalFlow?.score,
            quantFallback.pillars.foreignInstitutionalFlow.score
          ),
          summary:
            parsed.pillars?.foreignInstitutionalFlow?.summary ||
            quantFallback.pillars.foreignInstitutionalFlow.summary,
        },
        newsGrowthMomentum: {
          score: clampScore(
            parsed.pillars?.newsGrowthMomentum?.score,
            quantFallback.pillars.newsGrowthMomentum.score
          ),
          summary:
            parsed.pillars?.newsGrowthMomentum?.summary ||
            quantFallback.pillars.newsGrowthMomentum.summary,
        },
      },
      timingAction,
      optimalEntryZone: parsed.optimalEntryZone || quantFallback.optimalEntryZone,
      liquidityCondition: parsed.liquidityCondition || quantFallback.liquidityCondition,
      summaryThesis: parsed.summaryThesis || quantFallback.summaryThesis,
      evidenceFromNewsCount: combinedNews.length,
      disclaimer:
        'Phân tích bởi Gemini AI kết hợp dữ liệu SSI/OHLC & Kho Tin DedupBot; chỉ phục vụ tham khảo, không phải khuyến nghị giao dịch.',
    };

    // 30-minute cache keyed by symbol + newsHash
    cashflowTimingCache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + 30 * 60_000,
    });
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const is429 = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
    const isTimeout = msg.includes('GEMINI_TIMEOUT_');
    recordApiCall({
      apiId: 'gemini',
      endpoint: `/api/finance/cashflow-timing (${symbol})`,
      statusCode: is429 ? 429 : isTimeout ? 504 : 500,
      ok: false,
      latencyMs: Date.now() - start,
      cooldownSeconds: is429 ? 45 : isTimeout ? 15 : 0,
    });
    return quantFallback;
  }
}

/* --- 1. Anomaly Cashflow Radar (0 LLM tokens) --- */

const anomalyRadarCache = new Map<string, { data: AnomalyRadarResponse; expiresAt: number }>();

const DEFAULT_RADAR_UNIVERSE = ['SSI', 'FPT', 'VCB', 'HPG', 'MWG', 'TCB', 'MBB', 'VPB', 'VND', 'HSG'];

export async function buildAnomalyRadar(params: {
  symbols?: string[];
  taggedArticles?: FinanceTaggedArticle[];
  storedArticles?: Array<Pick<StoredNewsArticle, 'title' | 'summary'>>;
}): Promise<AnomalyRadarResponse> {
  const mergedSymbols = Array.from(
    new Set([
      ...(params.symbols || []).map((s) => s.trim().toUpperCase()),
      ...DEFAULT_RADAR_UNIVERSE,
    ])
  )
    .filter((s) => /^[A-Z0-9]{2,8}$/.test(s))
    .slice(0, 10);

  const cacheKey = mergedSymbols.join(',');
  const cached = anomalyRadarCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const [quotesMap, catalogRes] = await Promise.all([
    getMultipleStockQuotes(mergedSymbols),
    getSecuritiesCatalog(false),
  ]);

  const allAnomalies: CashflowAnomalyItem[] = [];
  // Scan in bounded batches of 4 to avoid Yahoo / SSI burst throttling
  for (let i = 0; i < mergedSymbols.length; i += 4) {
    const chunk = mergedSymbols.slice(i, i + 4);
    const settled = await Promise.allSettled(
      chunk.map(async (sym) => {
        const ohlcRes = await getDailyOhlcHistory(sym, 45, '1D');
        const meta = catalogRes.items.find((x) => x.symbol === sym);
        const lastBar = ohlcRes.ohlc[ohlcRes.ohlc.length - 1];
        const prevBar = ohlcRes.ohlc[ohlcRes.ohlc.length - 2];
        const quote: StockQuoteSnapshot = quotesMap[sym] || {
          symbol: sym,
          exchange: meta?.exchange || 'HOSE',
          companyName: meta?.companyName || sym,
          price: lastBar?.close || 0,
          refPrice: prevBar?.close || lastBar?.close || 0,
          ceilingPrice: Math.round((prevBar?.close || 0) * 1.07),
          floorPrice: Math.round((prevBar?.close || 0) * 0.93),
          change: lastBar && prevBar ? Math.round(lastBar.close - prevBar.close) : 0,
          changePct:
            lastBar && prevBar && prevBar.close > 0
              ? Number((((lastBar.close - prevBar.close) / prevBar.close) * 100).toFixed(2))
              : 0,
          volume: lastBar?.volume || 0,
          valueVnd: (lastBar?.close || 0) * (lastBar?.volume || 0),
          foreignBuyVol: 0,
          foreignSellVol: 0,
          foreignNetVol: 0,
          tradingDate: lastBar?.date || new Date().toISOString().split('T')[0],
          sourceMode: ohlcRes.sourceMode,
        };

        const relatedNews = [
          ...(params.taggedArticles || [])
            .filter((a) => a.matchedTickers.includes(sym))
            .map((a) => ({ title: a.title, summary: a.summary })),
          ...(params.storedArticles || [])
            .filter((a) => new RegExp(`\\b${sym}\\b`).test(`${a.title} ${a.summary}`.toUpperCase()))
            .map((a) => ({ title: a.title, summary: a.summary })),
        ].slice(0, 8);

        return detectStockAnomalies({
          symbol: sym,
          companyName: quote.companyName,
          exchange: quote.exchange,
          quote,
          bars: ohlcRes.ohlc,
          indicators: ohlcRes.indicators,
          relatedNews,
        });
      })
    );

    for (const r of settled) {
      if (r.status === 'fulfilled') {
        allAnomalies.push(...r.value);
      }
    }
  }

  allAnomalies.sort((a, b) => {
    const sevWeight = { critical: 3, opportunity: 2, warning: 1 };
    if (sevWeight[b.severity] !== sevWeight[a.severity]) {
      return sevWeight[b.severity] - sevWeight[a.severity];
    }
    return b.volumeRatio20 - a.volumeRatio20;
  });

  const result: AnomalyRadarResponse = {
    scannedAt: new Date().toISOString(),
    scannedSymbolsCount: mergedSymbols.length,
    anomalies: allAnomalies.slice(0, 16),
    summaryCounts: {
      accumulation: allAnomalies.filter((a) => a.direction === 'accumulation').length,
      distribution: allAnomalies.filter((a) => a.direction === 'distribution').length,
      foreignSpike: allAnomalies.filter((a) => a.direction === 'foreign_spike').length,
      cfoDivergence: allAnomalies.filter((a) => a.direction === 'cfo_divergence').length,
    },
  };

  anomalyRadarCache.set(cacheKey, {
    data: result,
    expiresAt: Date.now() + 3 * 60_000,
  });

  return result;
}

/* --- 2. AI 4-Perspective Strategy Analyzer (30-min cache + quantitative fallback) --- */

const fourAngleCache = new Map<string, { data: FourAngleStrategyResponse; expiresAt: number }>();

const SECTOR_PEERS_MAP: Array<{ members: string[]; sectorName: string; macroHint: string }> = [
  {
    members: ['VCB', 'TCB', 'MBB', 'ACB', 'VPB', 'BID', 'CTG', 'STB', 'HDB', 'TPB'],
    sectorName: 'Ngân hàng',
    macroHint: 'Tín dụng toàn ngành, biên lãi ròng (NIM), lãi suất điều hành NHNN & tỷ giá USD/VND.',
  },
  {
    members: ['HPG', 'HSG', 'NKG'],
    sectorName: 'Thép & Vật liệu',
    macroHint: 'Giá HRC & quặng sắt thế giới, thuế chống bán phá giá, đầu tư công nội địa & chu kỳ BĐS Trung Quốc.',
  },
  {
    members: ['FPT', 'MWG', 'DGW', 'FRT', 'PNJ', 'VGI'],
    sectorName: 'Công nghệ & Bán lẻ',
    macroHint: 'Chi tiêu CNTT/AI toàn cầu, sức mua tiêu dùng nội địa & biên lợi nhuận chuỗi bán lẻ hiện đại.',
  },
  {
    members: ['SSI', 'VND', 'VCI', 'HCM', 'SHS'],
    sectorName: 'Chứng khoán',
    macroHint: 'Thanh khoản HOSE/HNX, hệ thống KRX, dư nợ margin & kỳ vọng nâng hạng thị trường FTSE/MSCI.',
  },
];

function inferSectorMeta(symbol: string) {
  const found = SECTOR_PEERS_MAP.find((g) => g.members.includes(symbol));
  return (
    found || {
      members: [symbol, 'VN30'],
      sectorName: 'Doanh nghiệp niêm yết VN',
      macroHint: 'Lãi suất điều hành, tỷ giá USD/VND, dòng vốn ETF khu vực & chuỗi cung ứng xuất nhập khẩu.',
    }
  );
}

function inferPricedInStatus(
  indicators: Awaited<ReturnType<typeof getDailyOhlcHistory>>['indicators'],
  quote: StockQuoteSnapshot,
  bullCount: number
): PricedInStatus {
  const distMa20 = indicators.priceVsMa20Pct ?? 0;
  const rsi = indicators.rsi14 ?? 50;
  if (distMa20 >= 6.5 || rsi >= 70 || (quote.changePct >= 4.5 && bullCount > 0)) {
    return 'Đã phản ánh vào giá';
  }
  if (distMa20 >= 2.0 || rsi >= 56) {
    return 'Phản ánh một phần';
  }
  return 'Chưa phản ánh';
}

function buildQuantitativeFourAngles(params: {
  symbol: string;
  quote: StockQuoteSnapshot;
  chartRes: Awaited<ReturnType<typeof getMultiTimeframeChartTechnical>>;
  corpEvents: CorporateEventItem[];
  relevantNews: Array<{ title: string; summary: string; impactLabel: FinanceArticleImpactLabel; sourceName: string }>;
}): FourAngleStrategyResponse {
  const { symbol, quote, chartRes, corpEvents, relevantNews } = params;
  const { indicators, riskReward, anomalies } = chartRes;
  const sectorMeta = inferSectorMeta(symbol);

  const bullCount = relevantNews.filter((n) => n.impactLabel === 'Hỗ trợ tăng').length;
  const bearCount = relevantNews.filter((n) => n.impactLabel === 'Rủi ro cao').length;
  const pricedInStatus = inferPricedInStatus(indicators, quote, bullCount);

  const sectorPosition: SectorPosition =
    indicators.trendSignal === 'Tăng' && (indicators.priceVsMa20Pct ?? 0) >= 2
      ? 'Đầu tàu dẫn dắt'
      : indicators.trendSignal === 'Suy yếu'
        ? 'Chạy sau'
        : 'Theo sóng ngành';

  const govScore = Math.max(35, Math.min(92, 60 + corpEvents.length * 6 + bullCount * 5 - bearCount * 9));
  const sectorScore = Math.max(35, Math.min(92, 58 + Math.round((indicators.priceVsMa20Pct ?? 0) * 3)));
  const macroScore = Math.max(40, Math.min(88, 62 + (quote.foreignNetVol > 0 ? 10 : quote.foreignNetVol < 0 ? -8 : 0)));
  const marketScore = Math.max(35, Math.min(92, riskReward.winProbabilityPct));

  const govCatalysts = [
    ...corpEvents.slice(0, 2).map((e) => `[${e.categoryLabel}] ${e.title}`),
    ...(anomalies.some((a) => a.direction === 'cfo_divergence')
      ? ['Lưu ý đối chiếu chất lượng dòng tiền CFO và lợi nhuận kế toán.']
      : ['Chưa phát hiện dấu hiệu lệch pha CFO bất thường trong luồng tin gần đây.']),
  ];

  const actionLabel =
    pricedInStatus === 'Đã phản ánh vào giá'
      ? 'Không đuổi giá vùng cao; canh nhịp điều chỉnh kiểm định MA20 để cân nhắc.'
      : sectorPosition === 'Đầu tàu dẫn dắt'
        ? 'Ưu tiên nắm giữ hoặc giải ngân thăm dò theo tín hiệu nến xác nhận tại hỗ trợ.'
        : 'Theo dõi thêm xác nhận thanh khoản >1.2x TB20 trước khi tăng tỷ trọng.';

  return {
    generatedAt: new Date().toISOString(),
    symbol,
    mode: 'quantitative',
    cached: false,
    pricedInStatus,
    sectorPosition,
    winRatePct: riskReward.winProbabilityPct,
    riskRewardRatio: riskReward.riskRewardRatio,
    angles: {
      internalGovernance: {
        title: '1. Nội tại & Sự kiện Quản trị (ĐHĐCĐ / Nội bộ)',
        score: govScore,
        summary:
          corpEvents.length > 0
            ? `Ghi nhận ${corpEvents.length} văn bản/sự kiện quản trị liên quan ${symbol} (${corpEvents[0].categoryLabel}). Chất lượng dòng tiền & tin cơ bản giữ cân bằng (${bullCount} tích cực / ${bearCount} rủi ro).`
            : `Chưa ghi nhận nghị quyết ĐHĐCĐ hay giao dịch nội bộ đột biến mới; động lực nội tại bám sát ${relevantNews.length} bản tin doanh nghiệp.`,
        catalysts: govCatalysts.slice(0, 3),
      },
      sectorPositioning: {
        title: `2. Vị thế Toàn Ngành (${sectorMeta.sectorName})`,
        score: sectorScore,
        summary: `${symbol} đang ở vị thế "${sectorPosition}" với độ lệch MA20 đạt ${indicators.priceVsMa20Pct ?? 0}% và thanh khoản ${indicators.volumeRatio20 ?? 1}x trung bình 20 phiên.`,
        peerNote: `So với rổ cùng ngành (${sectorMeta.members.slice(0, 4).join(', ')}), ${symbol} thể hiện sức mạnh giá ${indicators.trendSignal.toLowerCase()}.`,
      },
      macroRegional: {
        title: '3. Bối cảnh Khu vực & Vĩ mô',
        score: macroScore,
        summary: `Nhóm ${sectorMeta.sectorName} chịu chi phối trực tiếp bởi: ${sectorMeta.macroHint} Khối ngoại phiên gần nhất ${quote.foreignNetVol >= 0 ? 'mua ròng/cân bằng' : 'bán ròng'} ${Math.abs(quote.foreignNetVol).toLocaleString('vi-VN')} cp.`,
        keyDrivers: [
          sectorMeta.macroHint,
          'Dòng vốn ETF khu vực ASEAN & biến động tỷ giá USD/VND.',
        ],
      },
      marketReaction: {
        title: '4. Đo lường Phản ứng Thị trường (Priced-in)',
        score: marketScore,
        summary: `Trạng thái chiết khấu thông tin: "${pricedInStatus}" (RSI 14 = ${indicators.rsi14 ?? 'N/A'}, Win Rate = ${riskReward.winProbabilityPct}%, R/R = 1:${riskReward.riskRewardRatio}).`,
        strategyAction: actionLabel,
      },
    },
    executiveVerdict: `${symbol} (${sectorMeta.sectorName}) định vị "${sectorPosition}", trạng thái tin tức "${pricedInStatus}". Xác suất lợi nhuận lịch sử ${riskReward.winProbabilityPct}% với tỷ lệ R/R 1:${riskReward.riskRewardRatio}. ${actionLabel}`,
    disclaimer:
      'Báo cáo 4 góc nhìn được tổng hợp từ dữ liệu OHLCV, ĐHĐCĐ & Kho Tin DedupBot; chỉ phục vụ tham khảo, không phải khuyến nghị đầu tư.',
  };
}

export async function analyzeStockFourPerspectives(params: {
  symbol: string;
  watchlistItem?: WatchlistItemConfig;
  corporateEvents?: CorporateEventItem[];
  taggedArticles?: FinanceTaggedArticle[];
  storedArticles?: Array<Pick<StoredNewsArticle, 'title' | 'summary' | 'sourceName' | 'sentimentLabel'>>;
}): Promise<FourAngleStrategyResponse> {
  const symbol = params.symbol.trim().toUpperCase();
  const symEvents = (params.corporateEvents || []).filter((e) => e.symbol === symbol).slice(0, 6);
  const relevantNews: Array<{
    title: string;
    summary: string;
    impactLabel: FinanceArticleImpactLabel;
    sourceName: string;
    publishedRelative: string;
  }> = [];

  for (const ta of params.taggedArticles || []) {
    if (!ta.matchedTickers.includes(symbol)) continue;
    relevantNews.push({
      title: ta.title,
      summary: ta.summary,
      impactLabel: ta.impactLabel,
      sourceName: ta.sourceName,
      publishedRelative: ta.publishedRelative,
    });
  }
  for (const sa of params.storedArticles || []) {
    if (!new RegExp(`\\b${symbol}\\b`).test(`${sa.title} ${sa.summary}`.toUpperCase())) continue;
    relevantNews.push({
      title: sa.title,
      summary: sa.summary,
      impactLabel:
        sa.sentimentLabel === 'Tích cực'
          ? 'Hỗ trợ tăng'
          : sa.sentimentLabel === 'Tiêu cực'
            ? 'Rủi ro cao'
            : 'Trung lập',
      sourceName: sa.sourceName,
      publishedRelative: 'Kho Tin',
    });
  }

  const newsHash = hashShort(
    [...relevantNews.slice(0, 6).map((n) => n.title), ...symEvents.map((e) => e.title)].join('|') || 'none'
  );
  const cacheKey = `${symbol}::${newsHash}`;
  const cached = fourAngleCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.data, cached: true };
  }

  const chartRes = await getMultiTimeframeChartTechnical({
    symbol,
    timeframe: '1D',
    recentNews: relevantNews.slice(0, 8),
    corporateEvents: symEvents,
  });

  const quote: StockQuoteSnapshot = {
    ...chartRes.quote,
    exchange: params.watchlistItem?.exchange || chartRes.quote.exchange,
    companyName:
      chartRes.quote.companyName !== symbol
        ? chartRes.quote.companyName
        : params.watchlistItem?.companyName || symbol,
  };

  const quantFallback = buildQuantitativeFourAngles({
    symbol,
    quote,
    chartRes,
    corpEvents: symEvents,
    relevantNews: relevantNews.slice(0, 10),
  });

  const ai = getGeminiClient();
  if (!ai || isApiInCooldown('gemini')) {
    fourAngleCache.set(cacheKey, {
      data: quantFallback,
      expiresAt: Date.now() + 10 * 60_000,
    });
    return quantFallback;
  }

  const sectorMeta = inferSectorMeta(symbol);
  const start = Date.now();
  try {
    const prompt = `Bạn là Giám đốc Chiến lược Đầu tư Chứng khoán Việt Nam tại tòa soạn "Lăng Kính".
Hãy lập báo cáo PHÂN TÍCH CHIẾN LƯỢC 4 GÓC NHÌN cho mã ${symbol} (${quote.companyName} · ${quote.exchange}, Ngành: ${sectorMeta.sectorName}):

DỮ LIỆU ĐỊNH LƯỢNG HIỆN TẠI:
- Giá khớp: ${quote.price.toLocaleString('vi-VN')} đ (${quote.changePct >= 0 ? '+' : ''}${quote.changePct}%), KL ${chartRes.indicators.volumeRatio20 ?? 1}x TB20, Ngoại ròng: ${quote.foreignNetVol.toLocaleString('vi-VN')} cp
- MA20: ${chartRes.indicators.ma20 ?? 'N/A'} (Lệch ${chartRes.indicators.priceVsMa20Pct ?? 0}%), RSI(14): ${chartRes.indicators.rsi14 ?? 'N/A'}
- Win Rate lịch sử: ${chartRes.riskReward.winProbabilityPct}% | R/R = 1:${chartRes.riskReward.riskRewardRatio}
- Bất thường dòng tiền phát hiện: ${chartRes.anomalies.map((a) => a.title).join('; ') || 'Không có đột biến cực đoan'}

SỰ KIỆN QUẢN TRỊ (ĐHĐCĐ / NỘI BỘ / M&A):
${symEvents.map((e) => `- [${e.categoryLabel}] ${e.title}`).join('\n') || '- Chưa có văn bản ĐHĐCĐ/nội bộ mới trong kỳ quét.'}

TIN TỨC DOANH NGHIỆP (Kho Tin DedupBot):
${relevantNews.slice(0, 6).map((n) => `- [${n.impactLabel}] ${n.title}`).join('\n') || '- Chưa có tin mới.'}

Yêu cầu trả về JSON chuẩn với:
- pricedInStatus: PHẢI chọn đúng 1 trong 3: "Chưa phản ánh" | "Phản ánh một phần" | "Đã phản ánh vào giá"
- sectorPosition: PHẢI chọn đúng 1 trong 3: "Đầu tàu dẫn dắt" | "Theo sóng ngành" | "Chạy sau"
- 4 góc nhìn (internalGovernance, sectorPositioning, macroRegional, marketReaction), mỗi góc gồm score (0-100) và summary súc tích 2 câu tiếng Việt thực chất, đi kèm catalysts/peerNote/keyDrivers/strategyAction.
- executiveVerdict: Kết luận chiến lược hành động 2-3 câu.`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              pricedInStatus: { type: Type.STRING },
              sectorPosition: { type: Type.STRING },
              internalScore: { type: Type.INTEGER },
              internalSummary: { type: Type.STRING },
              internalCatalysts: { type: Type.ARRAY, items: { type: Type.STRING } },
              sectorScore: { type: Type.INTEGER },
              sectorSummary: { type: Type.STRING },
              sectorPeerNote: { type: Type.STRING },
              macroScore: { type: Type.INTEGER },
              macroSummary: { type: Type.STRING },
              macroDrivers: { type: Type.ARRAY, items: { type: Type.STRING } },
              marketScore: { type: Type.INTEGER },
              marketSummary: { type: Type.STRING },
              marketAction: { type: Type.STRING },
              executiveVerdict: { type: Type.STRING },
            },
            required: [
              'pricedInStatus',
              'sectorPosition',
              'internalScore',
              'internalSummary',
              'sectorScore',
              'sectorSummary',
              'macroScore',
              'macroSummary',
              'marketScore',
              'marketSummary',
              'executiveVerdict',
            ],
          },
        },
      }),
      6500,
      'strategy-4angles'
    );

    recordApiCall({
      apiId: 'gemini',
      endpoint: `/api/finance/strategy-4angles (${symbol})`,
      statusCode: 200,
      ok: true,
      latencyMs: Date.now() - start,
    });

    const parsed = JSON.parse(response.text || '{}') as Record<string, unknown>;
    const clamp = (v: unknown, fb: number) => Math.max(15, Math.min(96, Math.round(Number(v) || fb)));
    const validPriced: PricedInStatus[] = ['Chưa phản ánh', 'Phản ánh một phần', 'Đã phản ánh vào giá'];
    const validPos: SectorPosition[] = ['Đầu tàu dẫn dắt', 'Theo sóng ngành', 'Chạy sau'];

    const result: FourAngleStrategyResponse = {
      ...quantFallback,
      mode: 'gemini',
      cached: false,
      pricedInStatus: validPriced.includes(parsed.pricedInStatus as PricedInStatus)
        ? (parsed.pricedInStatus as PricedInStatus)
        : quantFallback.pricedInStatus,
      sectorPosition: validPos.includes(parsed.sectorPosition as SectorPosition)
        ? (parsed.sectorPosition as SectorPosition)
        : quantFallback.sectorPosition,
      angles: {
        internalGovernance: {
          ...quantFallback.angles.internalGovernance,
          score: clamp(parsed.internalScore, quantFallback.angles.internalGovernance.score),
          summary: String(parsed.internalSummary || quantFallback.angles.internalGovernance.summary),
          catalysts: Array.isArray(parsed.internalCatalysts) && parsed.internalCatalysts.length > 0
            ? (parsed.internalCatalysts as string[]).slice(0, 3)
            : quantFallback.angles.internalGovernance.catalysts,
        },
        sectorPositioning: {
          ...quantFallback.angles.sectorPositioning,
          score: clamp(parsed.sectorScore, quantFallback.angles.sectorPositioning.score),
          summary: String(parsed.sectorSummary || quantFallback.angles.sectorPositioning.summary),
          peerNote: String(parsed.sectorPeerNote || quantFallback.angles.sectorPositioning.peerNote),
        },
        macroRegional: {
          ...quantFallback.angles.macroRegional,
          score: clamp(parsed.macroScore, quantFallback.angles.macroRegional.score),
          summary: String(parsed.macroSummary || quantFallback.angles.macroRegional.summary),
          keyDrivers: Array.isArray(parsed.macroDrivers) && parsed.macroDrivers.length > 0
            ? (parsed.macroDrivers as string[]).slice(0, 3)
            : quantFallback.angles.macroRegional.keyDrivers,
        },
        marketReaction: {
          ...quantFallback.angles.marketReaction,
          score: clamp(parsed.marketScore, quantFallback.angles.marketReaction.score),
          summary: String(parsed.marketSummary || quantFallback.angles.marketReaction.summary),
          strategyAction: String(parsed.marketAction || quantFallback.angles.marketReaction.strategyAction),
        },
      },
      executiveVerdict: String(parsed.executiveVerdict || quantFallback.executiveVerdict),
      disclaimer:
        'Báo cáo Chiến lược 4 Góc nhìn do Gemini AI tổng hợp từ SSI/OHLC, sự kiện ĐHĐCĐ & Kho Tin DedupBot; chỉ phục vụ tham khảo.',
    };

    fourAngleCache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + 30 * 60_000,
    });
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const is429 = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
    const isTimeout = msg.includes('GEMINI_TIMEOUT_');
    recordApiCall({
      apiId: 'gemini',
      endpoint: `/api/finance/strategy-4angles (${symbol})`,
      statusCode: is429 ? 429 : isTimeout ? 504 : 500,
      ok: false,
      latencyMs: Date.now() - start,
      cooldownSeconds: is429 ? 45 : isTimeout ? 15 : 0,
    });
    return quantFallback;
  }
}

/* --- 3. Peer Comparison Matrix (2-4 Tickers) & AI Peer Ranking --- */

const peerRankCache = new Map<string, { data: PeerAiRankingResponse; expiresAt: number }>();

function computePeriodReturn(bars: Array<{ close: number }>, sessionsBack: number): number {
  if (bars.length < 2) return 0;
  const last = bars[bars.length - 1].close;
  const baseIdx = Math.max(0, bars.length - 1 - sessionsBack);
  const base = bars[baseIdx].close;
  if (!base || base <= 0) return 0;
  return Number((((last - base) / base) * 100).toFixed(2));
}

export async function buildPeerComparisonMatrix(params: {
  symbols: string[];
  timeframe?: PeerTimeframe;
  corporateEvents?: CorporateEventItem[];
  taggedArticles?: FinanceTaggedArticle[];
  storedArticles?: Array<Pick<StoredNewsArticle, 'title' | 'summary' | 'sourceName' | 'sentimentLabel'>>;
}): Promise<PeerComparisonResponse> {
  const symbols = Array.from(
    new Set(
      params.symbols
        .map((s) => s.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''))
        .filter((s) => /^[A-Z0-9]{2,8}$/.test(s))
    )
  ).slice(0, 4);

  if (symbols.length < 2) {
    throw new Error('Vui lòng chọn ít nhất 2 cổ phiếu (tối đa 4 mã) để so sánh cùng ngành.');
  }

  const timeframe: PeerTimeframe =
    params.timeframe === '1W' || params.timeframe === '3M' ? params.timeframe : '1M';
  const windowBarsCount = timeframe === '1W' ? 6 : timeframe === '1M' ? 23 : 65;

  const [quotesMap, techResults] = await Promise.all([
    getMultipleStockQuotes(symbols),
    Promise.all(
      symbols.map((sym) =>
        getMultiTimeframeChartTechnical({
          symbol: sym,
          timeframe: '1D',
          corporateEvents: params.corporateEvents,
        })
      )
    ),
  ]);

  const rows: PeerStockRow[] = [];
  const alignedSeriesBySym = new Map<string, Array<{ date: string; pct: number }>>();

  for (let i = 0; i < symbols.length; i += 1) {
    const sym = symbols[i];
    const tech = techResults[i];
    const quote = quotesMap[sym] || tech.quote;
    const bars = tech.ohlc;

    const slice = bars.slice(-windowBarsCount);
    const baseClose = slice[0]?.close || quote.price || 1;
    alignedSeriesBySym.set(
      sym,
      slice.map((b) => ({
        date: b.date,
        pct: Number((((b.close - baseClose) / Math.max(1, baseClose)) * 100).toFixed(2)),
      }))
    );

    const perf1W = computePeriodReturn(bars, 5);
    const perf1M = computePeriodReturn(bars, 22);
    const perf3M = computePeriodReturn(bars, 64);

    const relatedNews: Array<{
      title: string;
      summary: string;
      impactLabel: FinanceArticleImpactLabel;
      sourceName: string;
    }> = [];

    for (const ta of params.taggedArticles || []) {
      if (ta.matchedTickers.includes(sym)) {
        relatedNews.push({
          title: ta.title,
          summary: ta.summary,
          impactLabel: ta.impactLabel,
          sourceName: ta.sourceName,
        });
      }
    }
    for (const sa of params.storedArticles || []) {
      if (new RegExp(`\\b${sym}\\b`).test(`${sa.title} ${sa.summary}`.toUpperCase())) {
        relatedNews.push({
          title: sa.title,
          summary: sa.summary,
          impactLabel:
            sa.sentimentLabel === 'Tích cực'
              ? 'Hỗ trợ tăng'
              : sa.sentimentLabel === 'Tiêu cực'
                ? 'Rủi ro cao'
                : 'Trung lập',
          sourceName: sa.sourceName,
        });
      }
    }

    const cashflowRes = buildQuantitativeCashflowTiming({
      symbol: sym,
      quote,
      indicators: tech.indicators,
      reversals: tech.reversalSignals,
      relevantArticles: relatedNews.slice(0, 8),
    });

    const symEvents = (params.corporateEvents || []).filter((e) => e.symbol === sym);
    const bullCount = relatedNews.filter((n) => n.impactLabel === 'Hỗ trợ tăng').length;
    const pricedInStatus = inferPricedInStatus(tech.indicators, quote, bullCount);

    let bbPosition = 'Giữa dải BB';
    if (tech.indicators.bbUpper && quote.price >= tech.indicators.bbUpper * 0.99) {
      bbPosition = 'Sát biên trên BB';
    } else if (tech.indicators.bbLower && quote.price <= tech.indicators.bbLower * 1.01) {
      bbPosition = 'Sát biên dưới BB';
    }

    const latestSignalLabel =
      tech.candlestickSignals[0]?.patternName ||
      tech.reversalSignals[0]?.label ||
      'Tích lũy bình thường';

    const anomalyLabel =
      tech.anomalies[0]?.direction === 'accumulation'
        ? `Gom hàng (${tech.anomalies[0].volumeRatio20}x)`
        : tech.anomalies[0]?.direction === 'distribution'
          ? `Phân phối (${tech.anomalies[0].volumeRatio20}x)`
          : tech.anomalies[0]?.direction === 'foreign_spike'
            ? 'Đột biến Ngoại'
            : tech.anomalies[0]?.direction === 'cfo_divergence'
              ? 'Lệch pha CFO'
              : 'Ổn định';

    rows.push({
      symbol: sym,
      companyName: quote.companyName,
      exchange: quote.exchange,
      price: quote.price,
      changePct: quote.changePct,
      perf1W,
      perf1M,
      perf3M,
      volumeRatio20: tech.indicators.volumeRatio20 ?? 1,
      anomalyLabel,
      foreignNetVol: quote.foreignNetVol,
      ma20Status:
        tech.indicators.priceVsMa20Pct !== null
          ? `${tech.indicators.priceVsMa20Pct >= 0 ? 'Trên' : 'Dưới'} MA20 (${tech.indicators.priceVsMa20Pct >= 0 ? '+' : ''}${tech.indicators.priceVsMa20Pct}%)`
          : 'Đang tính',
      rsi14: tech.indicators.rsi14,
      bbPosition,
      latestSignalLabel,
      cashflowScore: cashflowRes.cashflowScore,
      corporateEvents30dCount: symEvents.length,
      corporateEventsSummary:
        symEvents[0]?.title.slice(0, 75) || 'Chưa có văn bản ĐHĐCĐ/nội bộ đột biến',
      pricedInStatus,
      winRatePct: tech.riskReward.winProbabilityPct,
      entryPrice: tech.tradeSetup.entryZoneHigh || quote.price,
      tp1Price: tech.tradeSetup.tp1Price,
      slPrice: tech.tradeSetup.slPrice,
      riskRewardRatio: tech.tradeSetup.riskRewardRatio,
      action: cashflowRes.timingAction,
    });
  }

  // Merge normalized performance points onto a common date axis
  const primarySym = symbols[0];
  const baseTimeline = alignedSeriesBySym.get(primarySym) || [];
  const normalizedSeries: NormalizedPerformancePoint[] = baseTimeline.map((pt, idx) => {
    const point: NormalizedPerformancePoint = { date: pt.date };
    for (const sym of symbols) {
      const arr = alignedSeriesBySym.get(sym) || [];
      const val = arr[Math.min(idx, Math.max(0, arr.length - 1))]?.pct ?? 0;
      point[sym] = val;
    }
    return point;
  });

  const pickBest = (selector: (r: PeerStockRow) => number) =>
    [...rows].sort((a, b) => selector(b) - selector(a))[0]?.symbol || symbols[0];

  const leaders = {
    bestPerfSymbol: pickBest((r) =>
      timeframe === '1W' ? r.perf1W : timeframe === '3M' ? r.perf3M : r.perf1M
    ),
    strongestFlowSymbol: pickBest(
      (r) => r.cashflowScore * 1.2 + (r.foreignNetVol > 0 ? 15 : 0) + r.volumeRatio20 * 5
    ),
    bestTechnicalSymbol: pickBest(
      (r) => r.winRatePct + (r.rsi14 && r.rsi14 >= 48 && r.rsi14 <= 66 ? 10 : 0)
    ),
    bestRiskRewardSymbol: pickBest((r) => r.riskRewardRatio * 20 + r.winRatePct),
  };

  return {
    generatedAt: new Date().toISOString(),
    timeframe,
    symbols,
    normalizedSeries,
    rows,
    leaders,
  };
}

export async function rankPeersWithAi(params: {
  comparison: PeerComparisonResponse;
}): Promise<PeerAiRankingResponse> {
  const { comparison } = params;
  const cacheKey = `${[...comparison.symbols].sort().join(',')}::${comparison.timeframe}::${comparison.rows.map((r) => `${r.symbol}:${r.price}:${r.cashflowScore}`).join('|')}`;
  const cached = peerRankCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.data, cached: true };
  }

  const scored = comparison.rows
    .map((r) => {
      const perf =
        comparison.timeframe === '1W'
          ? r.perf1W
          : comparison.timeframe === '3M'
            ? r.perf3M
            : r.perf1M;
      const composite = Math.round(
        r.cashflowScore * 0.35 +
          r.winRatePct * 0.3 +
          Math.min(25, Math.max(-10, perf)) * 0.8 +
          Math.min(20, r.riskRewardRatio * 8)
      );
      return { row: r, score: Math.max(40, Math.min(96, composite)), perf };
    })
    .sort((a, b) => b.score - a.score);

  const totalScore = scored.reduce((acc, s) => acc + s.score, 0) || 100;
  const quantRankings = scored.map((s, idx) => {
    const rawAlloc =
      idx === 0
        ? Math.round((s.score / totalScore) * 100) + 12
        : Math.round((s.score / totalScore) * 100);
    return {
      rank: idx + 1,
      symbol: s.row.symbol,
      score: s.score,
      allocationPct: rawAlloc,
      reason: `Dòng tiền ${s.row.cashflowScore}/100, R/R 1:${s.row.riskRewardRatio}, hiệu suất ${comparison.timeframe} đạt ${s.perf >= 0 ? '+' : ''}${s.perf}%.`,
    };
  });

  // Normalize allocation to sum to 100%
  const allocSum = quantRankings.reduce((acc, r) => acc + r.allocationPct, 0) || 100;
  let running = 0;
  quantRankings.forEach((r, idx) => {
    if (idx === quantRankings.length - 1) {
      r.allocationPct = Math.max(5, 100 - running);
    } else {
      r.allocationPct = Math.max(10, Math.round((r.allocationPct / allocSum) * 100));
      running += r.allocationPct;
    }
  });

  const quantFallback: PeerAiRankingResponse = {
    generatedAt: new Date().toISOString(),
    timeframe: comparison.timeframe,
    mode: 'quantitative',
    cached: false,
    top_pick_ticker: quantRankings[0]?.symbol || comparison.symbols[0],
    marketMacroNote: `Ưu tiên phân bổ vốn vào mã dẫn đầu ${quantRankings[0]?.symbol} có lợi thế dòng tiền (${scored[0]?.row.cashflowScore}/100) và biên an toàn R/R tối ưu.`,
    rankings: quantRankings,
  };

  const ai = getGeminiClient();
  if (!ai || isApiInCooldown('gemini')) {
    peerRankCache.set(cacheKey, {
      data: quantFallback,
      expiresAt: Date.now() + 10 * 60_000,
    });
    return quantFallback;
  }

  const start = Date.now();
  try {
    const tableSummary = comparison.rows
      .map(
        (r) =>
          `- ${r.symbol}: Giá ${r.price.toLocaleString('vi-VN')} đ (${r.changePct}%), 1W=${r.perf1W}%, 1M=${r.perf1M}%, 3M=${r.perf3M}%, KL=${r.volumeRatio20}x (${r.anomalyLabel}), Ngoại ròng=${r.foreignNetVol}, ${r.ma20Status}, RSI=${r.rsi14 ?? 'N/A'}, Tín hiệu nến=${r.latestSignalLabel}, Điểm dòng tiền=${r.cashflowScore}/100, Priced-in=${r.pricedInStatus}, WinRate=${r.winRatePct}%, R/R=1:${r.riskRewardRatio}, Hành động=${r.action}`
      )
      .join('\n');

    const prompt = `Bạn là Trưởng phòng Phân tích Định lượng Chứng khoán Việt Nam.
So sánh trực tiếp ${comparison.symbols.length} cổ phiếu cùng ngành sau đây (khung ${comparison.timeframe}) và xếp hạng từ 1 đến ${comparison.symbols.length}:

${tableSummary}

Yêu cầu trả về JSON chuẩn với:
- top_pick_ticker: Mã tối ưu nhất để phân bổ vốn lúc này.
- marketMacroNote: Nhận xét ngắn 1-2 câu về luân chuyển dòng tiền giữa các mã trong nhóm.
- rankings: Mảng xếp hạng đầy đủ từ rank 1 -> ${comparison.symbols.length}, mỗi mã có symbol, score (0-100), allocationPct (tổng các mã = 100), và reason (< 20 từ tiếng Việt súc tích, nêu rõ lý do chọn/hạn chế).`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              top_pick_ticker: { type: Type.STRING },
              marketMacroNote: { type: Type.STRING },
              rankings: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    rank: { type: Type.INTEGER },
                    symbol: { type: Type.STRING },
                    score: { type: Type.INTEGER },
                    allocationPct: { type: Type.INTEGER },
                    reason: { type: Type.STRING },
                  },
                  required: ['rank', 'symbol', 'score', 'allocationPct', 'reason'],
                },
              },
            },
            required: ['top_pick_ticker', 'marketMacroNote', 'rankings'],
          },
        },
      }),
      6500,
      'peer-rank'
    );

    recordApiCall({
      apiId: 'gemini',
      endpoint: `/api/finance/peer-rank (${comparison.symbols.join('-')})`,
      statusCode: 200,
      ok: true,
      latencyMs: Date.now() - start,
    });

    const parsed = JSON.parse(response.text || '{}') as Partial<PeerAiRankingResponse>;
    const validSyms = new Set(comparison.symbols);
    const cleanedRankings = (Array.isArray(parsed.rankings) ? parsed.rankings : [])
      .filter((r) => validSyms.has(String(r.symbol).toUpperCase()))
      .map((r, idx) => ({
        rank: idx + 1,
        symbol: String(r.symbol).toUpperCase(),
        score: Math.max(30, Math.min(98, Math.round(Number(r.score) || 65))),
        allocationPct: Math.max(0, Math.min(100, Math.round(Number(r.allocationPct) || 25))),
        reason: String(r.reason || quantFallback.rankings[idx]?.reason || ''),
      }));

    if (cleanedRankings.length === 0) {
      return quantFallback;
    }

    // Ensure allocationPct sums cleanly to 100%
    const sumAlloc = cleanedRankings.reduce((a, b) => a + b.allocationPct, 0) || 100;
    let used = 0;
    cleanedRankings.forEach((r, idx) => {
      if (idx === cleanedRankings.length - 1) {
        r.allocationPct = Math.max(0, 100 - used);
      } else {
        r.allocationPct = Math.round((r.allocationPct / sumAlloc) * 100);
        used += r.allocationPct;
      }
    });

    const topTicker = validSyms.has(String(parsed.top_pick_ticker).toUpperCase())
      ? String(parsed.top_pick_ticker).toUpperCase()
      : cleanedRankings[0].symbol;

    const result: PeerAiRankingResponse = {
      generatedAt: new Date().toISOString(),
      timeframe: comparison.timeframe,
      mode: 'gemini',
      cached: false,
      top_pick_ticker: topTicker,
      marketMacroNote: String(parsed.marketMacroNote || quantFallback.marketMacroNote),
      rankings: cleanedRankings,
    };

    peerRankCache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + 30 * 60_000,
    });
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const is429 = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
    const isTimeout = msg.includes('GEMINI_TIMEOUT_');
    recordApiCall({
      apiId: 'gemini',
      endpoint: `/api/finance/peer-rank (${comparison.symbols.join('-')})`,
      statusCode: is429 ? 429 : isTimeout ? 504 : 500,
      ok: false,
      latencyMs: Date.now() - start,
      cooldownSeconds: is429 ? 45 : isTimeout ? 15 : 0,
    });
    return quantFallback;
  }
}

/* --- 4. Intraday Erratic Movers Scanner (0 LLM tokens) & AI Diagnosis (20m cache + fallback) --- */

const erraticMoversCache = new Map<string, { data: ErraticMoversResponse; expiresAt: number }>();
const erraticDiagnoseCache = new Map<string, { data: ErraticMoverAiDiagnosis; expiresAt: number }>();

const DEFAULT_ERRATIC_UNIVERSE = [
  'SSI',
  'FPT',
  'VCB',
  'HPG',
  'MWG',
  'TCB',
  'MBB',
  'VPB',
  'VND',
  'VCI',
  'HCM',
  'STB',
  'DIG',
  'NVL',
  'DXG',
  'DGC',
  'HSG',
  'PVS',
  'SHS',
  'BSR',
];

export async function scanIntradayErraticMovers(params: {
  symbols?: string[];
  forceRefresh?: boolean;
}): Promise<ErraticMoversResponse> {
  const mergedSymbols = Array.from(
    new Set([
      ...(params.symbols || []).map((s) => s.trim().toUpperCase()),
      ...DEFAULT_ERRATIC_UNIVERSE,
    ])
  )
    .filter((s) => /^[A-Z0-9]{2,8}$/.test(s))
    .slice(0, 18);

  const cacheKey = mergedSymbols.join(',');
  if (!params.forceRefresh) {
    const cached = erraticMoversCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
  }

  const [indicesRes, quotesMap, catalogRes] = await Promise.all([
    getMarketIndices(),
    getMultipleStockQuotes(mergedSymbols),
    getSecuritiesCatalog(false),
  ]);

  const vnIndex = indicesRes.indices.find((i) => i.indexId === 'VN-Index');
  const vnIndexChangePct = vnIndex?.changePct ?? 0;

  const detected: IntradayErraticMover[] = [];
  for (let i = 0; i < mergedSymbols.length; i += 6) {
    const chunk = mergedSymbols.slice(i, i + 6);
    const settled = await Promise.allSettled(
      chunk.map(async (sym) => {
        const [dailyRes, intradayRes] = await Promise.all([
          getDailyOhlcHistory(sym, 22, '1D'),
          getDailyOhlcHistory(sym, 45, 'intraday').catch(() => null),
        ]);
        const meta = catalogRes.items.find((x) => x.symbol === sym);
        const lastBar = dailyRes.ohlc[dailyRes.ohlc.length - 1];
        const prevBar = dailyRes.ohlc[dailyRes.ohlc.length - 2];

        const quote: StockQuoteSnapshot = quotesMap[sym] || {
          symbol: sym,
          exchange: meta?.exchange || 'HOSE',
          companyName: meta?.companyName || sym,
          price: lastBar?.close || 0,
          refPrice: prevBar?.close || lastBar?.close || 0,
          ceilingPrice: Math.round((prevBar?.close || 0) * 1.07),
          floorPrice: Math.round((prevBar?.close || 0) * 0.93),
          change: lastBar && prevBar ? Math.round(lastBar.close - prevBar.close) : 0,
          changePct:
            lastBar && prevBar && prevBar.close > 0
              ? Number((((lastBar.close - prevBar.close) / prevBar.close) * 100).toFixed(2))
              : 0,
          volume: lastBar?.volume || 0,
          valueVnd: (lastBar?.close || 0) * (lastBar?.volume || 0),
          foreignBuyVol: 0,
          foreignSellVol: 0,
          foreignNetVol: 0,
          tradingDate: lastBar?.date || new Date().toISOString().split('T')[0],
          sourceMode: dailyRes.sourceMode,
        };

        return analyzeSingleStockErraticMovement({
          symbol: sym,
          quote,
          dailyBars: dailyRes.ohlc,
          intradayBars: intradayRes?.ohlc || [],
          vnIndexChangePct,
          minLiquidityVnd: 10_000_000_000,
        });
      })
    );

    for (const r of settled) {
      if (r.status === 'fulfilled' && r.value) {
        detected.push(r.value);
      }
    }
  }

  detected.sort((a, b) => b.erraticScore - a.erraticScore);
  const topMovers = detected.slice(0, 12);

  const response: ErraticMoversResponse = {
    scannedAt: new Date().toISOString(),
    marketDataMode: indicesRes.sourceMode,
    vnIndexChangePct,
    scannedUniverseCount: mergedSymbols.length,
    qualifiedLiquidityCount: detected.length,
    movers: topMovers,
    summaryStats: {
      totalDetected: topMovers.length,
      vShapeCount: topMovers.filter((m) => m.patternType === 'v_shape_reversal').length,
      invertedVCount: topMovers.filter((m) => m.patternType === 'inverted_v_pullback').length,
      whipsawCount: topMovers.filter((m) => m.patternType === 'whipsaw_stophunt').length,
      gapVacuumCount: topMovers.filter((m) => m.patternType === 'gap_liquidity_vacuum').length,
    },
  };

  erraticMoversCache.set(cacheKey, {
    data: response,
    expiresAt: Date.now() + 2 * 60_000,
  });

  return response;
}

const VALID_ERRATIC_CATEGORIES: ErraticRootCauseCategory[] = [
  'Hấp thụ tin tức / Sự kiện bất ngờ',
  'Rũ bỏ kỹ thuật / Gom hàng (Shakeout)',
  'Bẫy tăng giá / Phân phối đỉnh (Bull Trap / Distribution)',
  'Nhiễu thanh khoản / Đáo hạn phái sinh & ETF',
];

function isRecentSevenDays(createdAt?: string): boolean {
  if (!createdAt) return true;
  const ts = Date.parse(createdAt);
  if (Number.isNaN(ts)) return true;
  return Date.now() - ts <= 7 * 86_400_000;
}

function buildQuantitativeErraticDiagnosis(params: {
  scope: 'single' | 'group';
  mover?: IntradayErraticMover;
  movers: IntradayErraticMover[];
  relatedNews: Array<{ title: string; summary: string; impactLabel: string; sourceName: string }>;
  relatedEvents: CorporateEventItem[];
}): ErraticMoverAiDiagnosis {
  const { scope, mover, movers, relatedNews, relatedEvents } = params;
  const roundPrice = (v: number) => Math.max(100, Math.round(v / 50) * 50);

  if (scope === 'group' || !mover) {
    const top = movers.slice(0, 4);
    const lead = top[0];
    const hasNews = relatedNews.length > 0 || relatedEvents.length > 0;
    const pullbacks = movers.filter((m) => m.patternType === 'inverted_v_pullback').length;
    const vShapes = movers.filter((m) => m.patternType === 'v_shape_reversal').length;
    const whipsaws = movers.filter((m) => m.patternType === 'whipsaw_stophunt').length;

    const rootCauseCategory: ErraticRootCauseCategory =
      hasNews && (relatedEvents.length > 0 || relatedNews.some((n) => n.impactLabel !== 'Trung lập'))
        ? 'Hấp thụ tin tức / Sự kiện bất ngờ'
        : pullbacks > vShapes
          ? 'Bẫy tăng giá / Phân phối đỉnh (Bull Trap / Distribution)'
          : vShapes >= pullbacks && vShapes > 0
            ? 'Rũ bỏ kỹ thuật / Gom hàng (Shakeout)'
            : 'Nhiễu thanh khoản / Đáo hạn phái sinh & ETF';

    const trapRiskLevel: TrapRiskLevel =
      pullbacks >= 2 || (lead && lead.intradayAmplitudePct >= 5.5 && lead.foreignNetVol < 0)
        ? 'Cao'
        : whipsaws >= 2 || (lead && lead.intradayAmplitudePct >= 3.5)
          ? 'Trung bình'
          : 'Thấp';

    return {
      generatedAt: new Date().toISOString(),
      mode: 'quantitative',
      cached: false,
      symbol: 'MARKET_GROUP',
      scope: 'group',
      rootCauseCategory,
      rootCauseAnalysis: `Quét ${movers.length} mã thanh khoản >10 tỷ VNĐ biến động mạnh nhất phiên: ghi nhận ${vShapes} mã rút chân chữ V, ${pullbacks} mã kéo xả chữ A và ${whipsaws} mã giật lắc 2 đầu${lead ? ` (dẫn đầu ${lead.symbol} biên độ ${lead.intradayAmplitudePct}%, điểm thất thường ${lead.erraticScore}/100)` : ''}. ${hasNews ? `Đối chiếu Kho Tin & ĐHĐCĐ 7 ngày qua có ${relatedNews.length} tin và ${relatedEvents.length} văn bản liên quan trực tiếp.` : 'Chưa xuất hiện văn bản ĐHĐCĐ/tin rò rỉ đột biến; biến động chủ yếu đến từ cung cầu kỹ thuật & cơ cấu danh mục.'}`,
      trapRiskLevel,
      trapRiskWarning:
        trapRiskLevel === 'Cao'
          ? 'Nhiều cổ phiếu xuất hiện bóng nến trên dài hoặc lệch pha mạnh so với VN-Index; rủi ro bẫy tăng giá (Bull Trap) và kẹp T+ ở vùng giá cao đang ở mức Cao.'
          : trapRiskLevel === 'Trung bình'
            ? 'Biên độ giật lắc trong phiên rộng khiến lệnh mua đuổi dễ chịu thiệt hại 2–3% ngay trong ngày; cần quan sát phản ứng khối lượng phiên T+1.'
            : 'Dao động phần lớn mang tính cân bằng lại cung cầu ngắn hạn, chưa thấy dấu hiệu xả hàng diện rộng.',
      holderAction:
        'Giữ kỷ luật chốt lời từng phần với các mã xuất hiện mẫu hình "Kéo xả cuối phiên" mất mốc 50% biên độ ngày; giữ lại tỷ trọng cho các mã "Rút chân đảo chiều mạnh" đóng cửa trên vùng 70% biên độ phiên kèm khối ngoại mua ròng.',
      cashAction:
        'Tuyệt đối không mua đuổi giá xanh khi biên độ trong phiên đang mở rộng quá 1.8x ATR14. Chỉ giải ngân thăm dò khi giá kiểm định lại vùng cân bằng T+1 với thanh khoản hạ nhiệt.',
      tPlus1BalanceZone: lead
        ? `${lead.symbol}: vùng cân bằng ${roundPrice((lead.dayLow + lead.dayHigh) / 2).toLocaleString('vi-VN')} – ${roundPrice(lead.refPrice).toLocaleString('vi-VN')} đ`
        : 'Chờ giá ổn định quanh giá tham chiếu và MA20 trong 30 phút đầu phiên T+1',
      foreignAndNewsContext: `Tổng hợp ${relatedNews.length} bài báo Kho Tin (7 ngày) & ${relatedEvents.length} sự kiện ĐHĐCĐ/nội bộ.`,
      matchedNewsCount: relatedNews.length + relatedEvents.length,
      groupHighlights: top.map((m) => ({
        symbol: m.symbol,
        patternLabel: m.patternLabel,
        diagnosis: `${m.signalsTriggered[0] || `Biên độ ${m.intradayAmplitudePct}%`} · Ngoại ròng ${m.foreignNetVol.toLocaleString('vi-VN')} cp`,
        trapRisk:
          m.patternType === 'inverted_v_pullback' || (m.changePct > 3 && m.foreignNetVol < 0)
            ? 'Cao'
            : m.patternType === 'whipsaw_stophunt'
              ? 'Trung bình'
              : 'Thấp',
        action:
          m.patternType === 'v_shape_reversal'
            ? `Nắm giữ, canh test ${roundPrice((m.dayLow + m.price) / 2).toLocaleString('vi-VN')} đ`
            : m.patternType === 'inverted_v_pullback'
              ? `Hạ tỷ trọng nếu thủng ${m.dayLow.toLocaleString('vi-VN')} đ`
              : `Đứng ngoài chờ cân bằng T+1 quanh ${m.refPrice.toLocaleString('vi-VN')} đ`,
      })),
      disclaimer:
        'Phân tích từ dữ liệu giá trong phiên, Khối ngoại & Kho Tin DedupBot; chỉ phục vụ tham khảo, không phải khuyến nghị giao dịch.',
    };
  }

  // Single-mover quantitative diagnosis
  const hasNewsOrEvent = relatedNews.length > 0 || relatedEvents.length > 0;
  let rootCauseCategory: ErraticRootCauseCategory;
  if (hasNewsOrEvent && (relatedEvents.length > 0 || relatedNews.some((n) => n.impactLabel !== 'Trung lập'))) {
    rootCauseCategory = 'Hấp thụ tin tức / Sự kiện bất ngờ';
  } else if (mover.patternType === 'v_shape_reversal') {
    rootCauseCategory = 'Rũ bỏ kỹ thuật / Gom hàng (Shakeout)';
  } else if (mover.patternType === 'inverted_v_pullback') {
    rootCauseCategory = 'Bẫy tăng giá / Phân phối đỉnh (Bull Trap / Distribution)';
  } else {
    rootCauseCategory = 'Nhiễu thanh khoản / Đáo hạn phái sinh & ETF';
  }

  const trapRiskLevel: TrapRiskLevel =
    mover.patternType === 'inverted_v_pullback' ||
    (mover.changePct >= 3.5 && mover.foreignNetVol < -50_000) ||
    (mover.volumeRatio15m >= 3.0 && mover.pricePositionInRangePct < 45)
      ? 'Cao'
      : mover.patternType === 'whipsaw_stophunt' || mover.intradayAmplitudePct >= 3.8
        ? 'Trung bình'
        : 'Thấp';

  const midBalance = roundPrice((mover.dayLow + mover.dayHigh) / 2);
  const supportTest = roundPrice(mover.dayLow + (mover.dayHigh - mover.dayLow) * 0.35);
  const tPlus1BalanceZone = `${Math.min(supportTest, midBalance).toLocaleString('vi-VN')} – ${Math.max(supportTest, midBalance).toLocaleString('vi-VN')} đ`;

  const newsSnippet = relatedEvents[0]
    ? `Văn bản nội bộ gần đây [${relatedEvents[0].categoryLabel}]: "${relatedEvents[0].title}".`
    : relatedNews[0]
      ? `Tin Kho Tin 7 ngày (${relatedNews[0].impactLabel}): "${relatedNews[0].title}".`
      : 'Chưa phát hiện tin tức doanh nghiệp hay nghị quyết ĐHĐCĐ mới trong 7 ngày gần nhất.';

  const foreignDesc =
    mover.foreignNetVol > 0
      ? `Khối ngoại mua ròng +${mover.foreignNetVol.toLocaleString('vi-VN')} cp hỗ trợ hấp thụ cung`
      : mover.foreignNetVol < 0
        ? `Khối ngoại bán ròng ${mover.foreignNetVol.toLocaleString('vi-VN')} cp gia tăng áp lực rung lắc`
        : 'Khối ngoại giao dịch cân bằng';

  const rootCauseAnalysis = `${mover.symbol} ghi nhận mẫu hình "${mover.patternLabel}" với biên độ ${mover.intradayAmplitudePct}% (${mover.amplitudeVsAtrRatio}x ATR14), lệch ${mover.betaDeviationPct > 0 ? '+' : ''}${mover.betaDeviationPct}% so với VN-Index (${mover.vnIndexChangePct}%). ${foreignDesc}. ${newsSnippet}`;

  const trapRiskWarning =
    trapRiskLevel === 'Cao'
      ? `Rủi ro Bẫy Giá CAO: Giá đang ở vị trí ${mover.pricePositionInRangePct}% của biên độ ngày (${mover.dayLow.toLocaleString('vi-VN')} – ${mover.dayHigh.toLocaleString('vi-VN')} đ) kèm lực bán vùng cao; dễ kẹp T+ nếu mua đuổi.`
      : trapRiskLevel === 'Trung bình'
        ? `Rủi ro Trung bình: Cổ phiếu giật lắc mạnh với xung lực khung ngắn đạt ${mover.volumeRatio15m}x trung bình, cần chờ cung cầu ổn định đầu phiên T+1.`
        : `Rủi ro Thấp: Lực cầu rút chân giữ được ${mover.pricePositionInRangePct}% biên độ phiên cho thấy bên mua đang kiểm soát nhịp.`;

  const holderAction =
    mover.patternType === 'inverted_v_pullback'
      ? `Nên chủ động chốt lời/hạ 30–50% tỷ trọng ở các nhịp hồi xanh về sát ${mover.dayHigh.toLocaleString('vi-VN')} đ; đặt ngưỡng cắt lỗ bảo vệ nếu thủng đáy phiên ${mover.dayLow.toLocaleString('vi-VN')} đ.`
      : mover.patternType === 'v_shape_reversal'
        ? `Có thể tiếp tục nắm giữ khi giá giữ vững trên vùng cân bằng ${midBalance.toLocaleString('vi-VN')} đ; nâng điểm chặn lãi lên ngay dưới ${mover.dayLow.toLocaleString('vi-VN')} đ.`
        : `Giữ tỷ trọng ở mức trung bình, tránh sử dụng margin cho tới khi giá thoát hẳn khỏi vùng giật lắc ${mover.dayLow.toLocaleString('vi-VN')} – ${mover.dayHigh.toLocaleString('vi-VN')} đ.`;

  const cashAction = `Tuyệt đối tránh mua đuổi khi cổ phiếu đang giật lắc trong phiên. Chờ giá kiểm định lại vùng cân bằng T+1 (${tPlus1BalanceZone}) với biên độ nến 15m thu hẹp (< 0.8%) và không thủng ${mover.dayLow.toLocaleString('vi-VN')} đ mới cân nhắc giải ngân thăm dò.`;

  return {
    generatedAt: new Date().toISOString(),
    mode: 'quantitative',
    cached: false,
    symbol: mover.symbol,
    scope: 'single',
    rootCauseCategory,
    rootCauseAnalysis,
    trapRiskLevel,
    trapRiskWarning,
    holderAction,
    cashAction,
    tPlus1BalanceZone,
    foreignAndNewsContext: `${foreignDesc} · Đối chiếu ${relatedNews.length} tin 7 ngày & ${relatedEvents.length} sự kiện ĐHĐCĐ.`,
    matchedNewsCount: relatedNews.length + relatedEvents.length,
    disclaimer:
      'Phân tích từ dữ liệu giao dịch trong phiên, Khối ngoại & Kho Tin DedupBot; chỉ phục vụ tham khảo, không phải khuyến nghị giao dịch.',
  };
}

export async function diagnoseIntradayErraticMover(params: {
  scope: 'single' | 'group';
  mover?: IntradayErraticMover;
  movers?: IntradayErraticMover[];
  taggedArticles?: FinanceTaggedArticle[];
  storedArticles?: Array<
    Pick<StoredNewsArticle, 'title' | 'summary' | 'sourceName' | 'sentimentLabel' | 'createdAt'>
  >;
  corporateEvents?: CorporateEventItem[];
}): Promise<ErraticMoverAiDiagnosis> {
  const scope: 'single' | 'group' = params.scope === 'group' ? 'group' : 'single';
  const moversList = Array.isArray(params.movers) ? params.movers.slice(0, 12) : [];
  const targetMover = params.mover || moversList[0];
  const targetKey = scope === 'group' ? 'MARKET_GROUP' : targetMover?.symbol || 'SSI';

  // Cache 20 minutes per symbol + time window (khung giờ)
  const hourBucket = Math.floor(Date.now() / (20 * 60_000));
  const cacheKey = `${targetKey}::${hourBucket}`;
  const cached = erraticDiagnoseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.data, cached: true };
  }

  const targetSymbols =
    scope === 'group'
      ? new Set(moversList.map((m) => m.symbol.toUpperCase()))
      : new Set([targetKey.toUpperCase()]);

  const relatedNews: Array<{
    title: string;
    summary: string;
    impactLabel: string;
    sourceName: string;
  }> = [];

  for (const ta of params.taggedArticles || []) {
    if (ta.matchedTickers.some((t) => targetSymbols.has(t))) {
      relatedNews.push({
        title: ta.title,
        summary: ta.summary,
        impactLabel: ta.impactLabel,
        sourceName: ta.sourceName,
      });
    }
  }
  for (const sa of params.storedArticles || []) {
    if (!isRecentSevenDays(sa.createdAt)) continue;
    const textUpper = `${sa.title} ${sa.summary}`.toUpperCase();
    const hit = Array.from(targetSymbols).some((sym) => new RegExp(`\\b${sym}\\b`).test(textUpper));
    if (!hit) continue;
    relatedNews.push({
      title: sa.title,
      summary: sa.summary,
      impactLabel:
        sa.sentimentLabel === 'Tích cực'
          ? 'Hỗ trợ tăng'
          : sa.sentimentLabel === 'Tiêu cực'
            ? 'Rủi ro cao'
            : 'Trung lập',
      sourceName: sa.sourceName,
    });
  }

  const relatedEvents = (params.corporateEvents || [])
    .filter((ev) => targetSymbols.has(ev.symbol.toUpperCase()))
    .slice(0, 8);

  const quantFallback = buildQuantitativeErraticDiagnosis({
    scope,
    mover: targetMover,
    movers: moversList,
    relatedNews: relatedNews.slice(0, 10),
    relatedEvents,
  });

  const ai = getGeminiClient();
  if (!ai || isApiInCooldown('gemini')) {
    erraticDiagnoseCache.set(cacheKey, {
      data: quantFallback,
      expiresAt: Date.now() + 20 * 60_000,
    });
    return quantFallback;
  }

  const start = Date.now();
  try {
    const contextText =
      scope === 'group'
        ? moversList
            .slice(0, 8)
            .map(
              (m) =>
                `- ${m.symbol} (${m.exchange}): Giá ${m.price.toLocaleString('vi-VN')} đ (${m.changePct}%), Biên độ ${m.intradayAmplitudePct}% (${m.amplitudeVsAtrRatio}x ATR14), Mẫu hình: ${m.patternLabel}, Lệch VN-Index: ${m.betaDeviationPct}%, Ngoại ròng: ${m.foreignNetVol.toLocaleString('vi-VN')} cp, Điểm thất thường ${m.erraticScore}/100`
            )
            .join('\n')
        : `- Mã: ${targetMover?.symbol} (${targetMover?.exchange}) — ${targetMover?.companyName}
- Giá khớp: ${targetMover?.price.toLocaleString('vi-VN')} đ (${targetMover?.changePct}%), Tham chiếu: ${targetMover?.refPrice.toLocaleString('vi-VN')} đ
- Biên độ phiên: Thấp ${targetMover?.dayLow.toLocaleString('vi-VN')} – Cao ${targetMover?.dayHigh.toLocaleString('vi-VN')} (${targetMover?.intradayAmplitudePct}%, bằng ${targetMover?.amplitudeVsAtrRatio}x ATR14)
- Vị trí giá hiện tại trong biên độ ngày: ${targetMover?.pricePositionInRangePct}% | Mẫu hình: ${targetMover?.patternLabel}
- KL khung ngắn: ${targetMover?.volumeRatio15m}x TB | Khối ngoại ròng: ${targetMover?.foreignNetVol.toLocaleString('vi-VN')} cp | Lệch VN-Index: ${targetMover?.betaDeviationPct}%
- Diễn biến nến 15m gần nhất: ${(targetMover?.intradayPath || [])
            .slice(-8)
            .map((p) => `${p.time}:${p.price}(${p.changePctFromRef}%)`)
            .join(' → ')}`;

    const newsPromptText =
      relatedNews
        .slice(0, 6)
        .map((n) => `- [${n.impactLabel} · ${n.sourceName}] ${n.title}`)
        .join('\n') || '- Chưa ghi nhận bài báo đột biến mới trong Kho Tin 7 ngày.';
    const eventsPromptText =
      relatedEvents
        .slice(0, 5)
        .map((e) => `- [${e.categoryLabel} · ${e.eventDate}] ${e.title}`)
        .join('\n') || '- Chưa có văn bản ĐHĐCĐ/nội bộ mới trong 7 ngày.';

    const prompt = `Bạn là Chuyên gia Giao dịch Định lượng & Quản trị Rủi ro Chứng khoán Việt Nam tại "Lăng Kính".
Hãy giải mã bản chất biến động thất thường trong phiên cho ${scope === 'group' ? 'TOÀN BỘ NHÓM CỔ PHIẾU GIẬT LẮC HÔM NAY' : `mã ${targetKey}`}:

DỮ LIỆU GIAO DỊCH TRONG PHIÊN:
${contextText}

TIN TỨC KHO TIN 7 NGÀY QUA:
${newsPromptText}

SỰ KIỆN ĐHĐCĐ / VĂN BẢN NỘI BỘ:
${eventsPromptText}

Yêu cầu trả về JSON chuẩn tiếng Việt súc tích, thực chiến:
1. rootCauseCategory: BẮT BUỘC chọn 1 trong 4 chuỗi chính xác:
   - "Hấp thụ tin tức / Sự kiện bất ngờ"
   - "Rũ bỏ kỹ thuật / Gom hàng (Shakeout)"
   - "Bẫy tăng giá / Phân phối đỉnh (Bull Trap / Distribution)"
   - "Nhiễu thanh khoản / Đáo hạn phái sinh & ETF"
2. rootCauseAnalysis: 2-3 câu phân tích nguyên nhân sâu xa dựa trên nến intraday, khối ngoại và tin tức.
3. trapRiskLevel: BẮT BUỘC chọn 1 trong 3: "Thấp" | "Trung bình" | "Cao".
4. trapRiskWarning: 1-2 câu cảnh báo trực diện rủi ro bẫy giá / kéo xả.
5. holderAction: Khuyến nghị cụ thể cho người ĐANG NẮM GIỮ (giữ / chốt lời từng phần / hạ tỷ trọng nếu thủng mốc giá nào).
6. cashAction: Khuyến nghị cụ thể cho người ĐANG CẦM TIỀN muốn mua mới (tuyệt đối tránh mua đuổi và điều kiện kiểm định T+1).
7. tPlus1BalanceZone: Mức giá cân bằng cần chờ kiểm định ở phiên kế tiếp T+1 (VD: "24.200 – 24.600 đ").`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              rootCauseCategory: { type: Type.STRING },
              rootCauseAnalysis: { type: Type.STRING },
              trapRiskLevel: { type: Type.STRING },
              trapRiskWarning: { type: Type.STRING },
              holderAction: { type: Type.STRING },
              cashAction: { type: Type.STRING },
              tPlus1BalanceZone: { type: Type.STRING },
            },
            required: [
              'rootCauseCategory',
              'rootCauseAnalysis',
              'trapRiskLevel',
              'trapRiskWarning',
              'holderAction',
              'cashAction',
              'tPlus1BalanceZone',
            ],
          },
        },
      }),
      6500,
      'erratic-diagnose'
    );

    recordApiCall({
      apiId: 'gemini',
      endpoint: `/api/finance/erratic-diagnose (${targetKey})`,
      statusCode: 200,
      ok: true,
      latencyMs: Date.now() - start,
    });

    const parsed = JSON.parse(response.text || '{}') as Partial<ErraticMoverAiDiagnosis>;
    const validTrap: TrapRiskLevel[] = ['Thấp', 'Trung bình', 'Cao'];

    const result: ErraticMoverAiDiagnosis = {
      ...quantFallback,
      generatedAt: new Date().toISOString(),
      mode: 'gemini',
      cached: false,
      rootCauseCategory: VALID_ERRATIC_CATEGORIES.includes(
        parsed.rootCauseCategory as ErraticRootCauseCategory
      )
        ? (parsed.rootCauseCategory as ErraticRootCauseCategory)
        : quantFallback.rootCauseCategory,
      rootCauseAnalysis: String(parsed.rootCauseAnalysis || quantFallback.rootCauseAnalysis),
      trapRiskLevel: validTrap.includes(parsed.trapRiskLevel as TrapRiskLevel)
        ? (parsed.trapRiskLevel as TrapRiskLevel)
        : quantFallback.trapRiskLevel,
      trapRiskWarning: String(parsed.trapRiskWarning || quantFallback.trapRiskWarning),
      holderAction: String(parsed.holderAction || quantFallback.holderAction),
      cashAction: String(parsed.cashAction || quantFallback.cashAction),
      tPlus1BalanceZone: String(parsed.tPlus1BalanceZone || quantFallback.tPlus1BalanceZone),
    };

    erraticDiagnoseCache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + 20 * 60_000,
    });
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const is429 = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
    const isTimeout = msg.includes('GEMINI_TIMEOUT_');
    recordApiCall({
      apiId: 'gemini',
      endpoint: `/api/finance/erratic-diagnose (${targetKey})`,
      statusCode: is429 ? 429 : isTimeout ? 504 : 500,
      ok: false,
      latencyMs: Date.now() - start,
      cooldownSeconds: is429 ? 45 : isTimeout ? 15 : 0,
    });
    erraticDiagnoseCache.set(cacheKey, {
      data: quantFallback,
      expiresAt: Date.now() + 20 * 60_000,
    });
    return quantFallback;
  }
}

/* --- 6. Portfolio Strategy Synthesis (3 Action Baskets + 30-Min Cached Gemini Advisor) --- */

const portfolioStrategyCache = new Map<
  string,
  { data: WatchlistPortfolioStrategyResponse; expiresAt: number }
>();

function computeStrategyDataHash(
  watchlist: WatchlistItemConfig[],
  quotes: Record<string, StockQuoteSnapshot>,
  analytics: Record<string, WatchlistStockAnalytics>
): string {
  return [...watchlist]
    .sort((a, b) => a.symbol.localeCompare(b.symbol))
    .map((w) => {
      const q = quotes[w.symbol];
      const an = analytics[w.symbol];
      return `${w.symbol}:${q?.price || 0}:${an?.recommendation.totalScore || 0}:${an?.fundamentals.roePct || 0}`;
    })
    .join('|');
}

export function buildQuantitativePortfolioStrategy(params: {
  watchlist: WatchlistItemConfig[];
  quotes: Record<string, StockQuoteSnapshot>;
  analytics: Record<string, WatchlistStockAnalytics>;
  taggedArticles?: FinanceTaggedArticle[];
}): WatchlistPortfolioStrategyResponse {
  const { watchlist, quotes, analytics, taggedArticles = [] } = params;

  const priorityBuy: PortfolioStrategyBasketItem[] = [];
  const holdOptimize: PortfolioStrategyBasketItem[] = [];
  const riskRestructure: PortfolioStrategyBasketItem[] = [];

  const rawWeights: Array<{
    symbol: string;
    weightScore: number;
    stance: string;
    capitalPlan: string;
  }> = [];

  for (const w of watchlist) {
    const q = quotes[w.symbol];
    const an = analytics[w.symbol];
    const price = q?.price || 0;
    const changePct = q?.changePct || 0;
    const score = an?.recommendation.totalScore ?? 55;
    const verdict = an?.recommendation.verdict ?? 'NẮM GIỮ / THEO DÕI';

    const buyZone =
      an?.recommendation.suggestedBuyZone ||
      (price > 0 ? `${Math.round(price * 0.98).toLocaleString('vi-VN')} – ${price.toLocaleString('vi-VN')} đ` : 'Quanh MA20');
    const ma20Label = an?.timing.ma20 ? `MA20 (${an.timing.ma20.toLocaleString('vi-VN')} đ)` : 'vùng hỗ trợ';

    if (score >= 65) {
      const reason = an
        ? `ROE ${an.fundamentals.roePct}%, ${an.fundamentals.primaryMetric} ${an.fundamentals.primaryValue} (${an.fundamentals.diffVsSectorPct >= 0 ? '+' : ''}${an.fundamentals.diffVsSectorPct}% vs ngành) · ${an.timing.maPositionLabel}, Vol ${an.liquidity.ma20VolPct}% TB20.`
        : 'Nền tảng cơ bản và động lượng ngắn hạn tích cực.';
      priorityBuy.push({
        symbol: w.symbol,
        companyName: q?.companyName || w.companyName,
        price,
        changePct,
        score,
        verdict,
        buyZoneOrSupport: buyZone,
        rationale: reason,
        allocationPct: 0,
      });
      rawWeights.push({
        symbol: w.symbol,
        weightScore: score * 1.4,
        stance: verdict,
        capitalPlan: `Ưu tiên giải ngân mới 15–25% sức mua tại vùng ${buyZone} (${ma20Label}); dừng lỗ kỷ luật nếu mất mốc ${w.stopLossPrice > 0 ? w.stopLossPrice.toLocaleString('vi-VN') : Math.round(price * 0.94).toLocaleString('vi-VN')} đ.`,
      });
    } else if (score < 45 || (an && an.timing.maPosition === 'below_both' && score < 52)) {
      const warn =
        an?.recommendation.riskWarning ||
        (an
          ? `${an.timing.maPositionLabel}, RSI(14) = ${an.timing.rsi14 ?? 'N/A'}, định giá ${an.fundamentals.primaryMetric} = ${an.fundamentals.primaryValue}.`
          : 'Động lượng suy yếu, cần quản trị rủi ro.');
      riskRestructure.push({
        symbol: w.symbol,
        companyName: q?.companyName || w.companyName,
        price,
        changePct,
        score,
        verdict,
        buyZoneOrSupport: an?.timing.ma50
          ? `Kháng cự MA50: ${an.timing.ma50.toLocaleString('vi-VN')} đ`
          : 'Canh hồi hạ tỷ trọng',
        rationale: warn,
        allocationPct: 0,
      });
      rawWeights.push({
        symbol: w.symbol,
        weightScore: Math.max(8, score * 0.35),
        stance: 'Hạ tỷ trọng / Cơ cấu',
        capitalPlan: `Giảm tỷ trọng về mức tối thiểu (≤ 5–10% NAV) khi hồi phục kỹ thuật; chuyển vốn sang nhóm ROE cao và giữ được ${ma20Label}.`,
      });
    } else {
      const reason = an
        ? `${an.timing.maPositionLabel} · RSI(14) ${an.timing.rsi14 ?? 'N/A'}, Thanh khoản ${an.liquidity.ma20VolPct}% TB20, ROE ${an.fundamentals.roePct}%.`
        : 'Xu hướng ổn định quanh vùng cân bằng.';
      holdOptimize.push({
        symbol: w.symbol,
        companyName: q?.companyName || w.companyName,
        price,
        changePct,
        score,
        verdict,
        buyZoneOrSupport: `Hỗ trợ ${ma20Label}`,
        rationale: reason,
        allocationPct: 0,
      });
      rawWeights.push({
        symbol: w.symbol,
        weightScore: score * 0.9,
        stance: 'Nắm giữ tối ưu',
        capitalPlan: `Tiếp tục nắm giữ vị thế hiện hữu quanh ${ma20Label}; chỉ gia tăng thêm khi thanh khoản vượt >130% TB20.`,
      });
    }
  }

  priorityBuy.sort((a, b) => b.score - a.score);
  holdOptimize.sort((a, b) => b.score - a.score);
  riskRestructure.sort((a, b) => a.score - b.score);

  const totalW = rawWeights.reduce((acc, r) => acc + r.weightScore, 0) || 1;
  let runningPct = 0;
  const aiDetailedAllocation = rawWeights.map((rw, idx) => {
    let pct = 0;
    if (rawWeights.length === 1) {
      pct = 100;
    } else if (idx === rawWeights.length - 1) {
      pct = Math.max(0, 100 - runningPct);
    } else {
      pct = Math.max(4, Math.round((rw.weightScore / totalW) * 100));
      runningPct += pct;
    }
    return {
      symbol: rw.symbol,
      suggestedWeightPct: pct,
      stance: rw.stance,
      capitalPlan: rw.capitalPlan,
    };
  });

  const weightBySym = new Map(aiDetailedAllocation.map((a) => [a.symbol, a.suggestedWeightPct]));
  [...priorityBuy, ...holdOptimize, ...riskRestructure].forEach((b) => {
    b.allocationPct = weightBySym.get(b.symbol) ?? 0;
  });

  const bullCount = taggedArticles.filter((a) => a.impactLabel === 'Hỗ trợ tăng').length;
  const bearCount = taggedArticles.filter((a) => a.impactLabel === 'Rủi ro cao').length;

  return {
    generatedAt: new Date().toISOString(),
    mode: 'quantitative',
    cached: false,
    marketContextNote: `Phân bổ 4 trụ cột cho ${watchlist.length} mã: ${priorityBuy.length} mã Ưu tiên giải ngân, ${holdOptimize.length} mã Nắm giữ tối ưu, ${riskRestructure.length} mã Cảnh báo rủi ro (${bullCount} tin hỗ trợ / ${bearCount} tin rủi ro trong Kho Tin).`,
    baskets: {
      priorityBuy,
      holdOptimize,
      riskRestructure,
    },
    aiDetailedAllocation,
    overallStrategySummary:
      priorityBuy.length > 0
        ? `Tập trung tỷ trọng lớn vào nhóm dẫn dắt (${priorityBuy.map((x) => x.symbol).join(', ')}) tại vùng giá mua quanh MA20, đồng thời duy trì kỷ luật chốt lời/hạ tỷ trọng ở nhóm suy yếu (${riskRestructure.map((x) => x.symbol).join(', ') || 'không có'}).`
        : `Thị trường đang phân hóa trung tính; ưu tiên giữ tỷ trọng phòng thủ trên các mã còn giữ MA20 (${holdOptimize.map((x) => x.symbol).join(', ') || 'tiền mặt'}) và chờ xác nhận dòng tiền >130% TB20.`,
    disclaimer:
      'Phân tích tổng hợp tự động theo 4 trụ cột định lượng (ROE, Định giá ngành, MA/RSI, Dòng tiền & Tin tức) phục vụ tham khảo, không phải khuyến nghị mua/bán trực tiếp.',
  };
}

export async function synthesizeWatchlistPortfolioStrategy(params: {
  watchlist: WatchlistItemConfig[];
  quotes: Record<string, StockQuoteSnapshot>;
  analytics?: Record<string, WatchlistStockAnalytics>;
  taggedArticles?: FinanceTaggedArticle[];
  storedArticles?: Array<Pick<StoredNewsArticle, 'title' | 'summary' | 'sentimentLabel'>>;
  forceRefresh?: boolean;
}): Promise<WatchlistPortfolioStrategyResponse> {
  const { watchlist, quotes, taggedArticles = [], storedArticles = [], forceRefresh = false } = params;
  if (watchlist.length === 0) {
    return buildQuantitativePortfolioStrategy({
      watchlist: [],
      quotes: {},
      analytics: {},
      taggedArticles,
    });
  }

  let analyticsMap = params.analytics;
  if (!analyticsMap || Object.keys(analyticsMap).length === 0) {
    analyticsMap = await computeWatchlistStockAnalyticsBatch({
      symbols: watchlist.map((w) => w.symbol),
      quotes,
      taggedArticles,
      storedArticles,
    });
  }

  const hash = computeStrategyDataHash(watchlist, quotes, analyticsMap);
  const cacheEntry = portfolioStrategyCache.get(hash);
  if (!forceRefresh && cacheEntry && cacheEntry.expiresAt > Date.now()) {
    return { ...cacheEntry.data, cached: true };
  }

  const quantFallback = buildQuantitativePortfolioStrategy({
    watchlist,
    quotes,
    analytics: analyticsMap,
    taggedArticles,
  });

  const ai = getGeminiClient();
  if (!ai || isApiInCooldown('gemini')) {
    portfolioStrategyCache.set(hash, {
      data: quantFallback,
      expiresAt: Date.now() + 30 * 60_000,
    });
    return quantFallback;
  }

  const start = Date.now();
  try {
    const rowsPrompt = watchlist
      .map((w) => {
        const q = quotes[w.symbol];
        const an = analyticsMap![w.symbol];
        const relNews = taggedArticles
          .filter((a) => a.matchedTickers.includes(w.symbol))
          .slice(0, 2)
          .map((a) => `[${a.impactLabel}] ${a.title}`)
          .join('; ');
        if (!an) return `- ${w.symbol}: Giá ${q?.price || 'N/A'} đ`;
        return `- ${w.symbol} (${an.sectorLabel}): Giá ${q?.price?.toLocaleString('vi-VN') || 'N/A'} đ (${q?.changePct ?? 0}%), Thanh khoản ${an.liquidity.ma20VolPct}% MA20 (${an.liquidity.valueBillionVnd} tỷ), Ngoại ${q?.foreignNetVol ?? 0} cp | ROE=${an.fundamentals.roePct}%, ${an.fundamentals.primaryMetric}=${an.fundamentals.primaryValue} (${an.fundamentals.diffVsSectorPct >= 0 ? '+' : ''}${an.fundamentals.diffVsSectorPct}% vs ngành) | ${an.timing.maPositionLabel}, RSI=${an.timing.rsi14 ?? 'N/A'} | Điểm 4 trụ cột=${an.recommendation.totalScore}/100 (${an.recommendation.verdict}) | Tin: ${relNews || 'Bình thường'}`;
      })
      .join('\n');

    const prompt = `Bạn là Giám đốc Chiến lược Danh mục Chứng khoán Việt Nam tại "Lăng Kính".
Dựa trên bảng phân tích 4 trụ cột thực tế của danh mục Watchlist dưới đây, hãy luận giải chi tiết chiến lược phân bổ vốn tối ưu cho từng mã (tổng suggestedWeightPct các mã = 100%):

${rowsPrompt}

Yêu cầu trả về JSON chuẩn:
- marketContextNote: Nhận xét ngắn 1-2 câu về bức tranh dòng tiền & định giá toàn danh mục.
- overallStrategySummary: Kết luận chiến lược điều phối vốn tổng thể (2-3 câu súc tích).
- aiDetailedAllocation: Mảng đầy đủ cho từng mã gồm symbol, suggestedWeightPct (số nguyên, tổng = 100), stance (VD: MUA MẠNH, MUA THĂM DÒ, NẮM GIỮ, HẠ TỶ TRỌNG), capitalPlan (khuyến nghị cụ thể vùng giá mua MA20, ngưỡng dừng lỗ/chốt lời < 30 từ).`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              marketContextNote: { type: Type.STRING },
              overallStrategySummary: { type: Type.STRING },
              aiDetailedAllocation: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    symbol: { type: Type.STRING },
                    suggestedWeightPct: { type: Type.INTEGER },
                    stance: { type: Type.STRING },
                    capitalPlan: { type: Type.STRING },
                  },
                  required: ['symbol', 'suggestedWeightPct', 'stance', 'capitalPlan'],
                },
              },
            },
            required: ['marketContextNote', 'overallStrategySummary', 'aiDetailedAllocation'],
          },
        },
      }),
      6500,
      'watchlist-strategy'
    );

    recordApiCall({
      apiId: 'gemini',
      endpoint: `/api/finance/watchlist-strategy (${watchlist.length} mã)`,
      statusCode: 200,
      ok: true,
      latencyMs: Date.now() - start,
    });

    const parsed = JSON.parse(response.text || '{}') as {
      marketContextNote?: string;
      overallStrategySummary?: string;
      aiDetailedAllocation?: Array<{
        symbol?: string;
        suggestedWeightPct?: number;
        stance?: string;
        capitalPlan?: string;
      }>;
    };

    const allocList =
      Array.isArray(parsed.aiDetailedAllocation) && parsed.aiDetailedAllocation.length > 0
        ? parsed.aiDetailedAllocation.map((item) => ({
            symbol: String(item.symbol || '').toUpperCase(),
            suggestedWeightPct: Math.max(0, Math.min(100, Math.round(Number(item.suggestedWeightPct || 0)))),
            stance: String(item.stance || 'THEO DÕI'),
            capitalPlan: String(item.capitalPlan || ''),
          }))
        : quantFallback.aiDetailedAllocation;

    const result: WatchlistPortfolioStrategyResponse = {
      ...quantFallback,
      generatedAt: new Date().toISOString(),
      mode: 'gemini',
      cached: false,
      marketContextNote: String(parsed.marketContextNote || quantFallback.marketContextNote),
      overallStrategySummary: String(
        parsed.overallStrategySummary || quantFallback.overallStrategySummary
      ),
      aiDetailedAllocation: allocList,
      disclaimer:
        'Chiến lược danh mục được Gemini AI luận giải từ 4 trụ cột (ROE, Định giá ngành, MA/RSI, Dòng tiền & Kho Tin); chỉ mang tính tham khảo thông tin, không phải khuyến nghị đầu tư tài chính.',
    };

    portfolioStrategyCache.set(hash, {
      data: result,
      expiresAt: Date.now() + 30 * 60_000,
    });
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const is429 = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');
    const isTimeout = msg.includes('GEMINI_TIMEOUT_');
    recordApiCall({
      apiId: 'gemini',
      endpoint: `/api/finance/watchlist-strategy (${watchlist.length} mã)`,
      statusCode: is429 ? 429 : isTimeout ? 504 : 500,
      ok: false,
      latencyMs: Date.now() - start,
      cooldownSeconds: is429 ? 45 : isTimeout ? 15 : 0,
    });
    portfolioStrategyCache.set(hash, {
      data: quantFallback,
      expiresAt: Date.now() + 30 * 60_000,
    });
    return quantFallback;
  }
}



