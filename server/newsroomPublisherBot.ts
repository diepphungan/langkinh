import type {
  EditionType,
  FetchedSourceArticle,
  FinanceTaggedArticle,
  GeographicRegion,
  NewsroomCategoryBucket,
  NewsroomDatePreset,
  NewsroomFeedResponse,
  PublishedNewsItem,
  SentimentBreakdown,
  SentimentVerdict,
  SocialTrendItem,
} from '../src/types/news.ts';
import { BUILTIN_VN_SECURITIES } from './ssiMarketService.ts';
import { fetchSocialTrendsFeed, formatVnTimestamp } from './socialTrendsEngine.ts';
import { evaluateArticleAgainstRules } from './automationRulesEngine.ts';
import { sendWatchlistNegativeWebhookAlert } from './webhookNotifier.ts';
import { getPersistedSourcesState } from './persistentSourcesStore.ts';

const KNOWN_TICKERS = new Set(BUILTIN_VN_SECURITIES.map((s) => s.symbol));
const MAX_ARCHIVE_ITEMS = 600;
const ARCHIVE_RETENTION_DAYS = 90;

const archiveMap = new Map<string, PublishedNewsItem>();
let lastSyncedAt: string | null = null;
let bootstrapPromise: Promise<void> | null = null;

export function canonicalizeFeedUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl.trim());
    u.hash = '';
    const host = u.hostname.replace(/^www\./i, '').toLowerCase();
    for (const p of [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'fbclid',
      'gclid',
      'ref',
    ]) {
      u.searchParams.delete(p);
    }
    const qs = u.searchParams.toString();
    const path = u.pathname.replace(/\/+$/, '') || '/';
    return `${host}${path}${qs ? `?${qs}` : ''}`;
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

export function classifyGeographicRegion(
  title: string,
  summary: string,
  sourceDomain: string
): GeographicRegion {
  const combined = normalizeText(`${title} ${summary}`);
  const domainLower = sourceDomain.toLowerCase();

  const isVnDomain =
    domainLower.endsWith('.vn') ||
    domainLower.includes('vnexpress') ||
    domainLower.includes('tuoitre') ||
    domainLower.includes('thanhnien') ||
    domainLower.includes('dantri') ||
    domainLower.includes('cafef') ||
    domainLower.includes('vietstock') ||
    domainLower.includes('vneconomy') ||
    domainLower.includes('baodautu') ||
    domainLower.includes('genk') ||
    domainLower.includes('vietnamplus') ||
    domainLower.includes('nhandan');

  if (
    /\b(my|hoa ky|washington|wall street|fed|trump|biden|chau au|eu|ecb|anh|phap|duc|nato|ukraine|nga|moscow|london|silicon valley)\b/.test(
      combined
    )
  ) {
    // If explicitly tied to Vietnam policy/trade, classify Vietnam if VN domain mentions Vietnam strongly
    if (
      /\b(viet nam|ha noi|tp hcm|tphcm|vn-index|ngan hang nha nuoc)\b/.test(combined) &&
      isVnDomain
    ) {
      return 'Việt Nam';
    }
    return 'Mỹ & Châu Âu';
  }

  if (
    /\b(trung quoc|bac kinh|nhat ban|tokyo|han quoc|seoul|dai loan|tsmc|asean|singapore|thai lan|indonesia|malaysia|an do|chau a|bien dong)\b/.test(
      combined
    )
  ) {
    if (/\b(viet nam|ha noi|tp hcm|tphcm)\b/.test(combined) && isVnDomain) {
      return 'Việt Nam';
    }
    return 'Châu Á';
  }

  if (
    isVnDomain ||
    /\b(viet nam|ha noi|tp hcm|sai gon|da nang|quoc hoi|chinh phu|thu tuong|hose|hnx|upcom|vn-index|vnd)\b/.test(
      combined
    )
  ) {
    return 'Việt Nam';
  }

  return 'Toàn cầu / Quốc tế';
}

export function mapNewsroomCategoryBucket(
  rawCategory: string,
  title: string,
  summary: string,
  sourceDomain: string,
  hasSocialPlatform = false
): NewsroomCategoryBucket {
  if (hasSocialPlatform) return 'Mạng xã hội';
  const catNorm = normalizeText(rawCategory);
  const full = normalizeText(`${rawCategory} ${title} ${summary}`);

  if (catNorm.includes('mang xa hoi')) return 'Mạng xã hội';
  if (catNorm.includes('chinh tri') || catNorm.includes('thoi su')) {
    return 'Thời sự & Vĩ mô';
  }
  if (catNorm.includes('cong nghe') || catNorm.includes('so hoa') || catNorm.includes('khoa hoc')) {
    return 'Công nghệ & AI';
  }
  if (catNorm.includes('the gioi') || catNorm.includes('quoc te')) {
    return 'Thế giới';
  }

  if (/\b(tiktok|facebook|threads|google trends|reddit|mang xa hoi|gay bao)\b/.test(full)) {
    return 'Mạng xã hội';
  }
  if (
    catNorm.includes('chung khoan') ||
    catNorm.includes('tai chinh') ||
    catNorm.includes('kinh doanh') ||
    /\b(chung khoan|vn-index|co phieu|hose|hnx|trai phieu|ngan hang|khoi ngoai|dhdcd|loi nhuan|ssi|fpt|vcb|hpg)\b/.test(
      full
    )
  ) {
    return 'Tài chính & Chứng khoán';
  }
  if (
    /\b(ai|tri tue nhan tao|ban dan|chip|openai|nvidia|google|apple|phan mem|an ninh mang|cong nghe)\b/.test(
      full
    )
  ) {
    return 'Công nghệ & AI';
  }
  if (
    sourceDomain.includes('reuters') ||
    sourceDomain.includes('bbc') ||
    sourceDomain.includes('cnbc') ||
    sourceDomain.includes('gdelt') ||
    /\b(the gioi|dia chinh tri|quoc te|ngoai giao|xung dot|my|trung quoc|eu|fed)\b/.test(full)
  ) {
    return 'Thế giới';
  }
  if (
    catNorm.includes('vi mo') ||
    catNorm.includes('kinh te') ||
    catNorm.includes('viet nam') ||
    /\b(gdp|lam phat|lai suat|ty gia|chinh phu|quoc hoi|dau tu cong|xuat khau|gia vang|thoi su)\b/.test(
      full
    )
  ) {
    return 'Thời sự & Vĩ mô';
  }
  return 'Chuyên mục Động';
}

function parseRelativeToDate(rawRelative: string | undefined): Date {
  const now = Date.now();
  if (!rawRelative) return new Date(now);
  const direct = new Date(rawRelative);
  if (!Number.isNaN(direct.getTime())) return direct;

  const lower = rawRelative.toLowerCase();
  const minMatch = lower.match(/(\d+)\s*phút/);
  if (minMatch) return new Date(now - Number(minMatch[1]) * 60_000);
  const hrMatch = lower.match(/(\d+)\s*giờ/);
  if (hrMatch) return new Date(now - Number(hrMatch[1]) * 3_600_000);
  const dayMatch = lower.match(/(\d+)\s*ngày/);
  if (dayMatch) return new Date(now - Number(dayMatch[1]) * 86_400_000);
  if (lower.includes('hôm qua')) return new Date(now - 86_400_000);
  return new Date(now);
}

function extractTickers(text: string): string[] {
  const matches = text.match(/\b[A-Z]{3,4}\b/g);
  if (!matches) return [];
  const res = new Set<string>();
  for (const m of matches) {
    if (KNOWN_TICKERS.has(m)) res.add(m);
  }
  return Array.from(res).slice(0, 6);
}

export function computeEditorialPriorityScore(params: {
  title: string;
  summary: string;
  sourceCount: number;
  viralScore: number;
  matchedTickers: string[];
  sentimentLabel: SentimentVerdict;
  publishedAtIso: string;
  watchlistSymbols?: string[];
  customKeywords?: string[];
}): number {
  let score = 52;
  const full = normalizeText(`${params.title} ${params.summary}`);

  // Multi-source coverage weight
  score += Math.min(18, Math.max(0, (params.sourceCount - 1) * 7));

  // Recency boost
  const ageHours = Math.max(0, (Date.now() - new Date(params.publishedAtIso).getTime()) / 3_600_000);
  if (ageHours <= 3) score += 14;
  else if (ageHours <= 8) score += 10;
  else if (ageHours <= 24) score += 6;
  else if (ageHours > 72) score -= 8;

  // Impact keywords
  if (
    /\b(khan|ky luc|bien dong|fed|lai suat|ty gia|gia vang|vn-index|gdp|thue quan|dhdcd|bat thuong|loi nhuan|nghi quyet|chinh phu)\b/.test(
      full
    )
  ) {
    score += 11;
  }

  // Quantitative figures present
  if (/\d+(?:[.,]\d+)?\s*(?:%|ty|nghin ty|trieu|usd|diem)/.test(full)) {
    score += 6;
  }

  // Watchlist / custom keyword relevance
  const wlSet = new Set((params.watchlistSymbols || []).map((s) => s.toUpperCase()));
  if (params.matchedTickers.some((t) => wlSet.has(t))) {
    score += 14;
  } else if (params.matchedTickers.length > 0) {
    score += 6;
  }

  for (const kw of params.customKeywords || []) {
    const clean = normalizeText(kw);
    if (clean && full.includes(clean)) {
      score += 10;
      break;
    }
  }

  // Viral social score influence
  if (params.viralScore > 0) {
    score += Math.round((params.viralScore - 50) * 0.25);
  }

  if (params.sentimentLabel === 'Tiêu cực') {
    score += 4; // risk stories merit editorial visibility
  }

  return Math.max(25, Math.min(99, Math.round(score)));
}

function pruneArchiveIfNeeded() {
  const cutoffMs = Date.now() - ARCHIVE_RETENTION_DAYS * 86_400_000;
  for (const [key, item] of archiveMap.entries()) {
    if (new Date(item.publishedAtIso).getTime() < cutoffMs) {
      archiveMap.delete(key);
    }
  }
  if (archiveMap.size <= MAX_ARCHIVE_ITEMS) return;
  const sorted = Array.from(archiveMap.entries()).sort(
    (a, b) => new Date(b[1].publishedAtIso).getTime() - new Date(a[1].publishedAtIso).getTime()
  );
  archiveMap.clear();
  for (const [k, v] of sorted.slice(0, MAX_ARCHIVE_ITEMS)) {
    archiveMap.set(k, v);
  }
}

export interface PublishInputItem {
  id?: string;
  title: string;
  summary?: string;
  keyTakeaway?: string;
  url: string;
  sourceName?: string;
  sourceDomain?: string;
  publishedAtIso?: string;
  publishedRelative?: string;
  category?: string;
  sentimentLabel?: SentimentVerdict;
  sentiment?: SentimentBreakdown;
  matchedTickers?: string[];
  fetchedMethod?: string;
  viralScore?: number;
  platformTag?: SocialTrendItem['platform'];
  growthMetric?: string;
  updatedReason?: string;
}

export function publishToFeed(
  items: PublishInputItem[],
  options?: {
    watchlistSymbols?: string[];
    customKeywords?: string[];
    sourceContext?: string;
  }
): PublishedNewsItem[] {
  const updatedItems: PublishedNewsItem[] = [];

  for (const raw of items) {
    if (!raw.url || !/^https?:\/\//i.test(raw.url.trim()) || !raw.title?.trim()) continue;
    const canonicalUrl = canonicalizeFeedUrl(raw.url);
    const existing = archiveMap.get(canonicalUrl);

    const parsedDate = raw.publishedAtIso
      ? new Date(raw.publishedAtIso)
      : parseRelativeToDate(raw.publishedRelative);
    const ts = formatVnTimestamp(parsedDate);
    const sourceDomain =
      raw.sourceDomain ||
      (() => {
        try {
          return new URL(raw.url).hostname.replace(/^www\./i, '');
        } catch {
          return 'news.source';
        }
      })();
    const sourceName = raw.sourceName?.trim() || sourceDomain;
    const summary = (raw.summary || raw.keyTakeaway || raw.title).trim().slice(0, 600);
    const keyTakeaways = [
      raw.keyTakeaway?.trim() || summary.slice(0, 220),
      `Nguồn: ${sourceName} · Cập nhật ${ts.display}`,
    ].filter(Boolean);

    const matchedTickers =
      raw.matchedTickers && raw.matchedTickers.length > 0
        ? raw.matchedTickers
        : extractTickers(`${raw.title} ${summary}`);

    const sentimentLabel: SentimentVerdict = raw.sentimentLabel || 'Trung lập';
    const sentiment: SentimentBreakdown = raw.sentiment || {
      positive: sentimentLabel === 'Tích cực' ? 68 : 24,
      neutral: sentimentLabel === 'Trung lập' ? 64 : 44,
      negative: sentimentLabel === 'Tiêu cực' ? 68 : 16,
      toneLabel: sentimentLabel,
    };

    // Evaluate against active user Automation Rules (0 tokens)
    const activeWatchlist =
      options?.watchlistSymbols && options.watchlistSymbols.length > 0
        ? options.watchlistSymbols
        : getPersistedSourcesState()
            .state.sources.filter((s) => s.origin === 'watchlist')
            .map((s) => s.name.replace(/^Watchlist\s*[·:]?\s*/i, '').trim().toUpperCase())
            .filter(Boolean);

    const ruleEval = evaluateArticleAgainstRules(
      {
        title: raw.title.trim(),
        summary,
        sentimentLabel,
        matchedTickers,
      },
      activeWatchlist,
      { recordStats: !existing }
    );

    if (ruleEval.blocked) {
      continue;
    }

    if (ruleEval.triggerWebhookAlert && !existing) {
      void sendWatchlistNegativeWebhookAlert({
        symbols: ruleEval.matchedTickersForAlert,
        title: raw.title.trim(),
        sourceName,
        url: raw.url.trim(),
        summary,
      });
    }

    const outletsSet = new Set<string>(existing?.sourceOutlets || []);
    outletsSet.add(sourceName);

    const region = classifyGeographicRegion(raw.title, summary, sourceDomain);
    const newsroomCategory = mapNewsroomCategoryBucket(
      raw.category || 'Tổng hợp',
      raw.title,
      summary,
      sourceDomain,
      Boolean(raw.platformTag)
    );
    const viralScore = Math.max(existing?.viralScore || 0, raw.viralScore || 0);
    const basePriorityScore = computeEditorialPriorityScore({
      title: raw.title,
      summary,
      sourceCount: outletsSet.size,
      viralScore,
      matchedTickers,
      sentimentLabel,
      publishedAtIso: existing?.publishedAtIso || ts.iso,
      watchlistSymbols: options?.watchlistSymbols,
      customKeywords: options?.customKeywords,
    });
    const priorityScore = Math.min(99, basePriorityScore + ruleEval.priorityBoost);

    const publishedItem: PublishedNewsItem = {
      id: existing?.id || raw.id || `pub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: raw.title.trim(),
      summary,
      keyTakeaways,
      url: raw.url.trim(),
      canonicalUrl,
      sourceName: existing?.sourceName || sourceName,
      sourceDomain,
      publishedAtIso: existing ? existing.publishedAtIso : ts.iso,
      displayTimestamp: existing ? existing.displayTimestamp : ts.display,
      publishedRelative: raw.publishedRelative || existing?.publishedRelative || 'Vừa cập nhật',
      category: raw.category || existing?.category || 'Tổng hợp',
      newsroomCategory,
      region,
      priorityScore,
      viralScore,
      platformTag: raw.platformTag || existing?.platformTag,
      growthMetric: raw.growthMetric || existing?.growthMetric,
      sourceCount: outletsSet.size,
      sourceOutlets: Array.from(outletsSet).slice(0, 6),
      matchedTickers: Array.from(
        new Set([...(existing?.matchedTickers || []), ...matchedTickers])
      ).slice(0, 6),
      sentimentLabel,
      sentiment,
      fetchedMethod: raw.fetchedMethod || options?.sourceContext || 'Auto-Discovery',
      updatedReason: raw.updatedReason || existing?.updatedReason,
      priorityBadge: ruleEval.priorityBadge || existing?.priorityBadge,
    };

    archiveMap.set(canonicalUrl, publishedItem);
    updatedItems.push(publishedItem);
  }

  lastSyncedAt = new Date().toISOString();
  pruneArchiveIfNeeded();
  return updatedItems;
}

export function publishSocialTrendsToFeed(trends: SocialTrendItem[]): PublishedNewsItem[] {
  return publishToFeed(
    trends.map((t) => ({
      id: t.id,
      title: t.title,
      summary: `${t.originSummary} (${t.growthMetric})`,
      keyTakeaway: t.originSummary,
      url: t.relatedUrl,
      sourceName: t.sourceName,
      sourceDomain: t.sourceDomain,
      publishedAtIso: t.publishedAtIso,
      publishedRelative: t.displayTimestamp,
      category: 'Mạng xã hội',
      sentimentLabel: t.sentimentLabel,
      matchedTickers: t.matchedTickers,
      fetchedMethod: 'Social Trends',
      viralScore: t.viralScore,
      platformTag: t.platform,
      growthMetric: t.growthMetric,
    })),
    { sourceContext: 'Social Trends' }
  );
}

export function publishFetchedArticlesToFeed(
  articles: Array<FetchedSourceArticle | FinanceTaggedArticle>,
  options?: {
    watchlistSymbols?: string[];
    customKeywords?: string[];
    sourceContext?: string;
  }
): PublishedNewsItem[] {
  return publishToFeed(
    articles.map((a) => {
      const base = 'fetchedArticle' in a ? a.fetchedArticle : a;
      return {
        id: a.id,
        title: a.title,
        summary: a.summary,
        keyTakeaway: base.keyTakeaway,
        url: a.url,
        sourceName: a.sourceName,
        sourceDomain: a.sourceDomain,
        publishedRelative: a.publishedRelative,
        category: base.category,
        sentimentLabel: a.sentimentLabel,
        sentiment: base.sentiment,
        matchedTickers: 'matchedTickers' in a ? a.matchedTickers : undefined,
        fetchedMethod: options?.sourceContext || 'Nguồn trang',
        updatedReason: a.updateReason,
      };
    }),
    options
  );
}

export function toVnDateString(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value || '2026';
  const m = parts.find((p) => p.type === 'month')?.value || '01';
  const d = parts.find((p) => p.type === 'day')?.value || '01';
  return `${y}-${m}-${d}`;
}

function getVnHourMinute(date: Date = new Date()): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  return {
    hour: Number(parts.find((p) => p.type === 'hour')?.value || 0),
    minute: Number(parts.find((p) => p.type === 'minute')?.value || 0),
  };
}

export function getVnClockNow(): { dateStr: string; hour: number; minute: number } {
  const now = new Date();
  return {
    dateStr: toVnDateString(now),
    ...getVnHourMinute(now),
  };
}

export async function ensureNewsroomBootstrapped(
  triggerFn?: () => Promise<void>
): Promise<void> {
  if (archiveMap.size >= 12) return;
  if (bootstrapPromise) {
    await bootstrapPromise;
    return;
  }
  bootstrapPromise = (async () => {
    try {
      const social = await fetchSocialTrendsFeed(false);
      publishSocialTrendsToFeed(social.trends);
      if (triggerFn) {
        await triggerFn();
      }
    } finally {
      bootstrapPromise = null;
    }
  })();
  await bootstrapPromise;
}

export interface NewsroomQueryOptions {
  datePreset?: NewsroomDatePreset;
  specificDate?: string;
  region?: GeographicRegion | 'all';
  category?: NewsroomCategoryBucket | 'all';
  sentiment?: SentimentVerdict | 'all';
  searchQuery?: string;
  watchlistSymbols?: string[];
  bootstrapScan?: () => Promise<void>;
}

export async function getNewsroomFeed(
  options: NewsroomQueryOptions = {}
): Promise<NewsroomFeedResponse> {
  if (archiveMap.size < 12 && options.bootstrapScan) {
    await ensureNewsroomBootstrapped(options.bootstrapScan);
  }

  const socialRes = await fetchSocialTrendsFeed(false);
  if (socialRes.trends.length > 0) {
    publishSocialTrendsToFeed(socialRes.trends);
  }

  const allItems = Array.from(archiveMap.values());
  const nowMs = Date.now();
  const todayStr = toVnDateString(new Date(nowMs));
  const yesterdayStr = toVnDateString(new Date(nowMs - 86_400_000));

  const datePreset = options.datePreset || 'latest';
  const specificDate = (options.specificDate || '').trim();

  // First filter by date window
  const dateFiltered = allItems.filter((item) => {
    const itemMs = new Date(item.publishedAtIso).getTime();
    const itemVnDate = toVnDateString(new Date(itemMs));
    if (specificDate && datePreset === 'custom') {
      return itemVnDate === specificDate;
    }
    if (datePreset === 'today') return itemVnDate === todayStr || nowMs - itemMs <= 24 * 3_600_000;
    if (datePreset === 'yesterday') return itemVnDate === yesterdayStr;
    if (datePreset === '7d') return nowMs - itemMs <= 7 * 86_400_000;
    if (datePreset === '30d') return nowMs - itemMs <= 30 * 86_400_000;
    if (datePreset === '90d') return nowMs - itemMs <= 90 * 86_400_000;
    return true;
  });

  // Compute counts on date-filtered pool
  const categoryCounts: Record<NewsroomCategoryBucket, number> = {
    'Thời sự & Vĩ mô': 0,
    'Tài chính & Chứng khoán': 0,
    'Thế giới': 0,
    'Công nghệ & AI': 0,
    'Mạng xã hội': 0,
    'Chuyên mục Động': 0,
  };
  const regionCounts: Record<GeographicRegion, number> = {
    'Việt Nam': 0,
    'Châu Á': 0,
    'Mỹ & Châu Âu': 0,
    'Toàn cầu / Quốc tế': 0,
  };

  for (const it of dateFiltered) {
    categoryCounts[it.newsroomCategory] = (categoryCounts[it.newsroomCategory] || 0) + 1;
    regionCounts[it.region] = (regionCounts[it.region] || 0) + 1;
  }

  const searchNorm = normalizeText(options.searchQuery || '');

  const filtered = dateFiltered.filter((item) => {
    if (options.region && options.region !== 'all' && item.region !== options.region) {
      return false;
    }
    if (
      options.category &&
      options.category !== 'all' &&
      item.newsroomCategory !== options.category
    ) {
      return false;
    }
    if (
      options.sentiment &&
      options.sentiment !== 'all' &&
      item.sentimentLabel !== options.sentiment
    ) {
      return false;
    }
    if (searchNorm) {
      const hay = normalizeText(
        `${item.title} ${item.summary} ${item.sourceName} ${item.matchedTickers.join(' ')}`
      );
      if (!hay.includes(searchNorm)) return false;
    }
    return true;
  });

  // Sort: Lead / Editorial salience by priorityScore + recency
  const bySalience = [...filtered].sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    return new Date(b.publishedAtIso).getTime() - new Date(a.publishedAtIso).getTime();
  });

  // Sort by pure recency for Breaking Wire ticker
  const breakingWire = [...allItems]
    .sort((a, b) => new Date(b.publishedAtIso).getTime() - new Date(a.publishedAtIso).getTime())
    .slice(0, 12);

  // Prefer press lead (non-pure-reddit) for Front-Page Lead Cover if available
  const leadCandidate =
    bySalience.find((x) => x.newsroomCategory !== 'Mạng xã hội') || bySalience[0] || null;
  const remaining = bySalience.filter((x) => x.id !== leadCandidate?.id);
  const highlightStories = remaining.slice(0, 3);
  const restItems = remaining.slice(3, 80);

  return {
    fetchedAt: new Date().toISOString(),
    lastSyncedAt,
    totalInArchive: allItems.length,
    filteredCount: filtered.length,
    breakingWire,
    leadStory: leadCandidate,
    highlightStories,
    items: restItems,
    categoryCounts,
    regionCounts,
    socialTrends: socialRes.trends.slice(0, 7),
    socialStreamsStatus: socialRes.streamsStatus,
    syncNote: `Đã đồng bộ ${allItems.length} tin vào Bản tin chính · ${socialRes.trends.length} xu hướng mạng xã hội`,
  };
}

export function getEditionCandidates(params: {
  dateStr: string;
  editionType: EditionType;
  watchlistSymbols?: string[];
}): {
  windowLabel: string;
  candidates: PublishedNewsItem[];
  totalReviewed: number;
} {
  const allItems = Array.from(archiveMap.values());

  // Compute UTC range corresponding to Asia/Ho_Chi_Minh (+07:00)
  // Morning (08:00): [D-1 17:00+07:00, D 08:30+07:00]
  // Afternoon (17:00): [D 08:00+07:00, D 17:30+07:00]
  const baseDate = new Date(`${params.dateStr}T00:00:00+07:00`);
  const baseMs = Number.isNaN(baseDate.getTime()) ? Date.now() : baseDate.getTime();
  const dayStartIso = toVnDateString(new Date(baseMs));
  const prevDayIso = toVnDateString(new Date(baseMs - 86_400_000));

  let startMs: number;
  let endMs: number;
  let windowLabel: string;

  if (params.editionType === 'morning') {
    startMs = new Date(`${prevDayIso}T17:00:00+07:00`).getTime();
    endMs = new Date(`${dayStartIso}T08:30:00+07:00`).getTime();
    windowLabel = `17:00 (${prevDayIso.split('-').reverse().join('/')}) → 08:00 (${dayStartIso.split('-').reverse().join('/')})`;
  } else {
    startMs = new Date(`${dayStartIso}T08:00:00+07:00`).getTime();
    endMs = new Date(`${dayStartIso}T17:30:00+07:00`).getTime();
    windowLabel = `08:00 → 17:00 (${dayStartIso.split('-').reverse().join('/')})`;
  }

  let inWindow = allItems.filter((it) => {
    const ms = new Date(it.publishedAtIso).getTime();
    return ms >= startMs && ms <= endMs;
  });

  // If fewer than 10 stories exist in the narrow window (e.g. first run today or future/archive day), supplement with nearest top stories
  if (inWindow.length < 10) {
    const inSet = new Set(inWindow.map((x) => x.canonicalUrl));
    const supplement = [...allItems]
      .filter((it) => !inSet.has(it.canonicalUrl))
      .sort((a, b) => {
        const distA = Math.abs(new Date(a.publishedAtIso).getTime() - endMs);
        const distB = Math.abs(new Date(b.publishedAtIso).getTime() - endMs);
        if (Math.abs(distA - distB) < 6 * 3_600_000) {
          return b.priorityScore - a.priorityScore;
        }
        return distA - distB;
      });
    inWindow = [...inWindow, ...supplement].slice(0, 24);
  }

  const wlSet = new Set((params.watchlistSymbols || []).map((s) => s.toUpperCase()));
  const ranked = [...inWindow]
    .map((item) => {
      let editionBonus = 0;
      if (params.editionType === 'morning') {
        if (item.region === 'Mỹ & Châu Âu' || item.region === 'Toàn cầu / Quốc tế') {
          editionBonus += 6;
        }
        if (/vang|ty gia|fed|dau|chung khoan|dhdcd/i.test(normalizeText(item.title))) {
          editionBonus += 5;
        }
      } else {
        if (item.newsroomCategory === 'Tài chính & Chứng khoán') editionBonus += 6;
        if (item.newsroomCategory === 'Mạng xã hội') editionBonus += 4;
      }
      if (item.matchedTickers.some((t) => wlSet.has(t))) {
        editionBonus += 10;
      }
      return {
        ...item,
        priorityScore: Math.min(99, item.priorityScore + editionBonus),
      };
    })
    .sort((a, b) => b.priorityScore - a.priorityScore);

  return {
    windowLabel,
    candidates: ranked.slice(0, 10),
    totalReviewed: allItems.length,
  };
}

export function getArchiveSize(): number {
  return archiveMap.size;
}

export function getPublishedArchiveSnapshot(): PublishedNewsItem[] {
  return Array.from(archiveMap.values()).sort(
    (a, b) => new Date(b.publishedAtIso).getTime() - new Date(a.publishedAtIso).getTime()
  );
}

