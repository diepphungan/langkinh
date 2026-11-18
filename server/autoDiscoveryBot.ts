import * as cheerio from 'cheerio';
import type {
  AutoDiscoveryScanResponse,
  CorporateEventCategory,
  CorporateEventItem,
  CorporateEventsResponse,
  CrawlerLogEntry,
  DiscoveredRssFeed,
  ExistingArticleFingerprint,
  FetchedSourceArticle,
  FinanceTaggedArticle,
  SentimentBreakdown,
  SentimentVerdict,
  SmartDiscoveryResponse,
  SourceFetchStatus,
  SsiSecurityItem,
  TopicPackId,
  TopicPackMeta,
} from '../src/types/news.ts';
import { isApiInCooldown, recordApiCall } from './apiQuotaTracker.ts';
import { evaluateBatchWithDedupBot } from './dedupBot.ts';
import {
  extractMatchedTickers,
  scoreFinanceArticleImpact,
} from './financeWatchlistService.ts';
import { parseRssOrAtomItems, validatePublicHttpUrl } from './newsSources.ts';
import { getSecuritiesCatalog } from './ssiMarketService.ts';
import {
  getPersistedSourcesState,
  syncWatchlistDynamicSources,
  touchSourceLastFetched,
} from './persistentSourcesStore.ts';
import {
  buildGoogleNewsDynamicRssUrl,
  canonicalizeSourceUrl,
  normalizeTopicPackIds,
  OFFICIAL_TOPIC_PACK_CATALOG,
} from '../src/lib/defaultSeedSources.ts';

import { publishFetchedArticlesToFeed } from './newsroomPublisherBot.ts';

interface BotFeedSeed {
  id: string;
  packId: TopicPackId;
  name: string;
  domain: string;
  url: string;
  defaultCategory: string;
  kind?: 'rss' | 'googlenews' | 'hackernews' | 'gdelt';
}

export const TOPIC_PACK_CATALOG: TopicPackMeta[] = OFFICIAL_TOPIC_PACK_CATALOG;

// Seed catalog is loaded and persisted via persistentSourcesStore.ts + DEFAULT_SEED_SOURCES

let roundRobinCursor = 0;

function hashShort(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function formatNowHHmm(): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date());
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

function inferGeneralCategory(
  title: string,
  description: string,
  fallbackCategory: string
): string {
  const lower = `${title} ${description}`.toLowerCase();
  if (/chứng khoán|vn-index|cổ phiếu|ngân hàng|lãi suất|doanh thu|lợi nhuận|tỷ giá|gdp|vàng sjc/.test(lower)) {
    return 'Kinh doanh';
  }
  if (/trí tuệ nhân tạo|\bai\b|bán dẫn|phần mềm|công nghệ|chip|robot|cyber/.test(lower)) {
    return 'Công nghệ';
  }
  if (/khoa học|vũ trụ|nasa|khí hậu|năng lượng tái tạo/.test(lower)) {
    return 'Khoa học';
  }
  if (/mỹ|trung quốc|châu âu|nga|ukraine|fed|biển đông|quốc tế/.test(lower)) {
    return 'Thế giới';
  }
  return fallbackCategory;
}

export function buildGoogleNewsRssUrl(query: string): string {
  const encoded = encodeURIComponent(query.trim());
  return `https://news.google.com/rss/search?q=${encoded}&hl=vi&gl=VN&ceid=VN:vi`;
}

async function fetchRssFeedDirect(
  seed: BotFeedSeed,
  maxItems = 8
): Promise<Array<{ title: string; url: string; description: string; pubDate: string }>> {
  const apiId = seed.kind === 'googlenews' ? 'googlenews' : 'rss';
  const start = Date.now();
  const res = await fetch(seed.url, {
    signal: AbortSignal.timeout(5500),
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; LangKinhAutoBot/2.0)',
      Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html',
    },
  });
  const text = await res.text();
  let endpointLabel = seed.domain;
  try {
    const u = new URL(seed.url);
    endpointLabel = `${u.hostname}${u.pathname}`;
  } catch {
    // keep domain
  }
  recordApiCall({
    apiId,
    endpoint: endpointLabel,
    statusCode: res.status,
    ok: res.ok,
    latencyMs: Date.now() - start,
    detail: seed.name,
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  if (text.includes('<item') || text.includes('<entry')) {
    return parseRssOrAtomItems(text, maxItems).map((it) => ({
      title: it.title,
      url: it.link,
      description: it.description || it.title,
      pubDate: it.pubDate,
    }));
  }

  // Fallback parse XML <url><loc> from Sitemap
  if (text.includes('<urlset') || text.includes('<news:news')) {
    const urlMatches = text.match(/<url>[\s\S]*?<\/url>/gi) || [];
    const results: Array<{ title: string; url: string; description: string; pubDate: string }> = [];
    for (const block of urlMatches.slice(0, maxItems)) {
      const loc = block.match(/<loc[^>]*>([\s\S]*?)<\/loc>/i)?.[1]?.trim() || '';
      const newsTitle =
        block.match(/<news:title[^>]*>([\s\S]*?)<\/news:title>/i)?.[1]
          ?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
          .trim() || '';
      const lastmod =
        block.match(/<news:publication_date[^>]*>([\s\S]*?)<\/news:publication_date>/i)?.[1]?.trim() ||
        block.match(/<lastmod[^>]*>([\s\S]*?)<\/lastmod>/i)?.[1]?.trim() ||
        '';
      if (loc && /^https?:\/\//i.test(loc)) {
        const slugTitle =
          newsTitle ||
          loc
            .split('/')
            .pop()
            ?.replace(/\.(html|htm)$/i, '')
            .replace(/[-_]+/g, ' ') ||
          loc;
        results.push({
          title: slugTitle,
          url: loc,
          description: slugTitle,
          pubDate: lastmod,
        });
      }
    }
    return results;
  }

  return [];
}

async function fetchHackerNewsDirect(
  maxItems = 8
): Promise<Array<{ title: string; url: string; description: string; pubDate: string }>> {
  const start = Date.now();
  const topRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json', {
    signal: AbortSignal.timeout(5000),
  });
  const ids = ((await topRes.json()) as number[]).slice(0, maxItems);
  const stories = await Promise.all(
    ids.map(async (id) => {
      const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, {
        signal: AbortSignal.timeout(4500),
      });
      return (await r.json()) as {
        id: number;
        title?: string;
        url?: string;
        time?: number;
        score?: number;
      };
    })
  );
  recordApiCall({
    apiId: 'hackernews',
    endpoint: '/v0/topstories.json',
    statusCode: topRes.status,
    ok: topRes.ok,
    latencyMs: Date.now() - start,
  });

  return stories
    .filter((s) => Boolean(s?.title))
    .map((s) => ({
      title: s.title || 'Hacker News',
      url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
      description: `Thảo luận nổi bật trên Hacker News (${s.score ?? 0} điểm).`,
      pubDate: s.time ? new Date(s.time * 1000).toISOString() : '',
    }));
}

async function fetchGdeltDirect(
  maxItems = 8
): Promise<Array<{ title: string; url: string; description: string; pubDate: string }>> {
  if (isApiInCooldown('gdelt')) {
    return [];
  }
  const start = Date.now();
  const res = await fetch(
    `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(
      'Vietnam OR economy OR semiconductor'
    )}&mode=ArtList&maxrecords=${maxItems}&format=json&sort=DateDesc`,
    { signal: AbortSignal.timeout(5500) }
  );
  const json = (await res.json().catch(() => ({}))) as {
    articles?: Array<{ url?: string; title?: string; domain?: string; seendate?: string }>;
  };
  recordApiCall({
    apiId: 'gdelt',
    endpoint: '/api/v2/doc/doc',
    statusCode: res.status,
    ok: res.ok,
    latencyMs: Date.now() - start,
    cooldownSeconds: res.status === 429 ? 10 : 0,
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return (json.articles || [])
    .filter((a) => Boolean(a.title && a.url))
    .map((a) => ({
      title: a.title || '',
      url: a.url || '',
      description: `Nguồn ${a.domain || 'Quốc tế'} qua GDELT DOC 2.0.`,
      pubDate: '',
    }));
}

async function runConcurrencyPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function runNext() {
    while (cursor < items.length) {
      const idx = cursor;
      cursor += 1;
      results[idx] = await worker(items[idx], idx);
    }
  }

  const runners = Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, () =>
    runNext()
  );
  await Promise.all(runners);
  return results;
}

export async function smartDiscoverSource(rawInput: string): Promise<SmartDiscoveryResponse> {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw new Error('Vui lòng nhập tên miền trang báo (vd: baodautu.vn) hoặc từ khóa chủ đề (vd: Giá vàng SJC).');
  }

  const looksLikeDomain =
    /^https?:\/\//i.test(trimmed) ||
    (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(trimmed) && !trimmed.includes(' '));

  if (!looksLikeDomain) {
    const gnewsUrl = buildGoogleNewsRssUrl(trimmed);
    const items = await fetchRssFeedDirect(
      {
        id: `disc-kw-${hashShort(trimmed)}`,
        packId: 'watchlist',
        name: `Chủ đề: ${trimmed}`,
        domain: 'news.google.com',
        url: gnewsUrl,
        defaultCategory: inferGeneralCategory(trimmed, '', 'Kinh doanh'),
        kind: 'googlenews',
      },
      6
    ).catch(() => []);

    return {
      input: trimmed,
      resolvedType: 'keyword',
      discoveredFeeds: [
        {
          name: `Google News · ${trimmed}`,
          url: gnewsUrl,
          domain: 'news.google.com',
          defaultCategory: inferGeneralCategory(trimmed, '', 'Kinh doanh'),
        },
      ],
      message: `Đã tạo nguồn RSS tự động cho chủ đề "${trimmed}" (${items.length} tin mới kiểm tra trực tiếp).`,
    };
  }

  const parsedBase = validatePublicHttpUrl(trimmed);
  const domain = parsedBase.hostname.replace(/^www\./, '').toLowerCase();
  const candidateEndpoints = Array.from(
    new Set([
      parsedBase.toString(),
      `https://${parsedBase.hostname}/rss`,
      `https://${parsedBase.hostname}/feed`,
      `https://${parsedBase.hostname}/sitemap.xml`,
    ])
  );

  const discoveredMap = new Map<string, DiscoveredRssFeed>();

  for (const probeUrl of candidateEndpoints) {
    try {
      const start = Date.now();
      const res = await fetch(probeUrl, {
        signal: AbortSignal.timeout(4500),
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LangKinhAutoBot/2.0)',
          Accept: 'text/html,application/xml,application/rss+xml',
        },
      });
      const body = await res.text();
      recordApiCall({
        apiId: 'rss',
        endpoint: `${domain} (auto-discover)`,
        statusCode: res.status,
        ok: res.ok,
        latencyMs: Date.now() - start,
      });
      if (!res.ok) continue;

      if (body.includes('<item') || body.includes('<entry')) {
        discoveredMap.set(probeUrl, {
          name: `${domain.toUpperCase()} — RSS Feed`,
          url: probeUrl,
          domain,
          defaultCategory: inferGeneralCategory(domain, body.slice(0, 400), 'Kinh doanh'),
        });
        continue;
      }

      if (body.includes('<urlset') && probeUrl.endsWith('sitemap.xml')) {
        discoveredMap.set(probeUrl, {
          name: `${domain.toUpperCase()} — Sitemap Tin tức`,
          url: probeUrl,
          domain,
          defaultCategory: 'Kinh doanh',
        });
        continue;
      }

      const $ = cheerio.load(body);
      $('link[type*="rss"], link[type*="atom"], a[href*=".rss"], a[href*="/rss/"], a[href*="/feed"]').each(
        (_, el) => {
          const href = $(el).attr('href');
          if (!href) return;
          try {
            const abs = new URL(href.trim(), probeUrl).toString();
            if (!/^https?:\/\//i.test(abs)) return;
            if (discoveredMap.has(abs)) return;
            const rawTitle = $(el).attr('title') || $(el).text() || '';
            const cleanTitle = rawTitle.replace(/RSS/gi, '').replace(/\s+/g, ' ').trim();
            discoveredMap.set(abs, {
              name: `${domain.split('.')[0].toUpperCase()} — ${cleanTitle || 'Tin mới'}`,
              url: abs,
              domain,
              defaultCategory: inferGeneralCategory(cleanTitle, abs, 'Kinh doanh'),
            });
          } catch {
            // ignore invalid link
          }
        }
      );

      if (discoveredMap.size >= 8) break;
    } catch {
      // continue probing next path
    }
  }

  // Always guarantee a working live Google News site:domain fallback if native RSS isn't exposed
  if (discoveredMap.size === 0) {
    const siteRss = buildGoogleNewsRssUrl(`site:${domain}`);
    discoveredMap.set(siteRss, {
      name: `${domain.toUpperCase()} (Auto Google News RSS)`,
      url: siteRss,
      domain,
      defaultCategory: 'Kinh doanh',
    });
  }

  const feeds = Array.from(discoveredMap.values()).slice(0, 10);
  return {
    input: trimmed,
    resolvedType: 'domain',
    discoveredFeeds: feeds,
    message: `Bot đã tự động khám phá ${feeds.length} luồng tin từ ${domain} (0 cần dán link chuyên mục thủ công).`,
  };
}

export async function runAutoDiscoveryScan(params: {
  packs?: TopicPackId[];
  watchlistSymbols?: string[];
  customKeywords?: string[];
  customFeeds?: Array<{ name: string; url: string; domain?: string; defaultCategory?: string }>;
  existingItems?: ExistingArticleFingerprint[];
  dedupBotEnabled?: boolean;
  maxFeedsPerRun?: number;
}): Promise<AutoDiscoveryScanResponse> {
  // Sync dynamic Watchlist Google News RSS into persistent store if symbols provided
  if (params.watchlistSymbols && params.watchlistSymbols.length > 0) {
    syncWatchlistDynamicSources(params.watchlistSymbols);
  }

  const persisted = getPersistedSourcesState().state;
  const activePacks: TopicPackId[] =
    params.packs && params.packs.length > 0
      ? normalizeTopicPackIds(params.packs)
      : persisted.activeTopicPacks.length > 0
        ? persisted.activeTopicPacks
        : ['thoi-su', 'chung-khoan', 'tai-chinh'];
  const packSet = new Set(activePacks);

  const selectedSeeds: BotFeedSeed[] = [];
  const seenSeedUrls = new Set<string>();

  const pushSeed = (seed: BotFeedSeed) => {
    const canon = canonicalizeSourceUrl(seed.url);
    if (seenSeedUrls.has(canon)) return;
    seenSeedUrls.add(canon);
    selectedSeeds.push(seed);
  };

  // Load persisted enabled sources matching active packs (or custom/discovered sources without a packId)
  for (const src of persisted.sources) {
    if (!src.enabled) continue;
    if (src.packId && !packSet.has(src.packId)) continue;
    pushSeed({
      id: src.id,
      packId: src.packId || 'chung-khoan',
      name: src.name,
      domain: src.domain,
      url: src.url,
      defaultCategory: src.defaultCategory,
      kind:
        src.kind === 'hackernews'
          ? 'hackernews'
          : src.kind === 'gdelt'
            ? 'gdelt'
            : src.kind === 'googlenews' || src.url.includes('news.google.com')
              ? 'googlenews'
              : 'rss',
    });
  }

  // Dynamic Google News RSS seeds for Watchlist symbols & custom keywords
  if (packSet.has('watchlist')) {
    const watchSymbols = (params.watchlistSymbols || [])
      .map((s) => s.trim().toUpperCase())
      .filter((s) => /^[A-Z0-9]{2,8}$/.test(s))
      .slice(0, 5);
    for (const sym of watchSymbols) {
      pushSeed({
        id: `bot-gnews-wl-${sym}`,
        packId: 'watchlist',
        name: `Watchlist RSS · ${sym}`,
        domain: 'news.google.com',
        url: buildGoogleNewsDynamicRssUrl(`${sym} chứng khoán`),
        defaultCategory: 'Kinh doanh',
        kind: 'googlenews',
      });
    }
  }

  const effectiveKeywords =
    params.customKeywords && params.customKeywords.length > 0
      ? params.customKeywords
      : persisted.customKeywords;

  for (const kw of effectiveKeywords.slice(0, 4)) {
    if (!kw.trim()) continue;
    pushSeed({
      id: `bot-gnews-kw-${hashShort(kw)}`,
      packId: 'watchlist',
      name: `Từ khóa · ${kw.trim()}`,
      domain: 'news.google.com',
      url: buildGoogleNewsDynamicRssUrl(kw.trim()),
      defaultCategory: inferGeneralCategory(kw, '', 'Kinh doanh'),
      kind: 'googlenews',
    });
  }

  for (const cf of (params.customFeeds || []).slice(0, 12)) {
    if (!cf.url) continue;
    let domain = cf.domain || 'rss.feed';
    try {
      domain = cf.domain || new URL(cf.url).hostname.replace(/^www\./, '');
    } catch {
      // keep fallback
    }
    pushSeed({
      id: `bot-custom-${hashShort(cf.url)}`,
      packId: 'chung-khoan',
      name: cf.name || domain,
      domain,
      url: cf.url,
      defaultCategory: cf.defaultCategory || 'Kinh doanh',
      kind: cf.url.includes('news.google.com') ? 'googlenews' : 'rss',
    });
  }

  // Stratified round-robin across active packs up to maxFeedsPerRun so every cycle covers all 7 packs + watchlist evenly
  const maxFeeds = Math.max(4, Math.min(20, params.maxFeedsPerRun || 14));
  let runSeeds = selectedSeeds;
  if (selectedSeeds.length > maxFeeds) {
    const byPack = new Map<string, BotFeedSeed[]>();
    for (const seed of selectedSeeds) {
      const list = byPack.get(seed.packId) || [];
      list.push(seed);
      byPack.set(seed.packId, list);
    }
    const interleaved: BotFeedSeed[] = [];
    const packLists = Array.from(byPack.values());
    const maxLen = Math.max(...packLists.map((l) => l.length));
    for (let depth = 0; depth < maxLen && interleaved.length < maxFeeds; depth += 1) {
      for (const list of packLists) {
        if (list.length === 0) continue;
        const candidate = list[(roundRobinCursor + depth) % list.length];
        if (!interleaved.some((s) => s.id === candidate.id)) {
          interleaved.push(candidate);
          if (interleaved.length >= maxFeeds) break;
        }
      }
    }
    roundRobinCursor = (roundRobinCursor + 1) % Math.max(1, maxLen);
    runSeeds = interleaved;
  }

  // Also avoid hitting vnexpress.net more than 2 times in the same burst
  let vneCount = 0;
  runSeeds = runSeeds.filter((s) => {
    if (s.domain === 'vnexpress.net') {
      vneCount += 1;
      return vneCount <= 2;
    }
    return true;
  });

  const catalogRes = await getSecuritiesCatalog(false);
  const catalogSet = new Set(catalogRes.items.map((i: SsiSecurityItem) => i.symbol));
  for (const sym of params.watchlistSymbols || []) {
    if (sym) catalogSet.add(sym.toUpperCase());
  }

  const fetchedResults = await runConcurrencyPool(runSeeds, 5, async (seed) => {
    try {
      let items: Array<{ title: string; url: string; description: string; pubDate: string }> = [];
      if (seed.kind === 'hackernews') {
        items = await fetchHackerNewsDirect(6);
      } else if (seed.kind === 'gdelt') {
        items = await fetchGdeltDirect(6);
      } else {
        items = await fetchRssFeedDirect(seed, 8);
      }
      return { seed, items, error: undefined as string | undefined };
    } catch (err) {
      return {
        seed,
        items: [],
        error: err instanceof Error ? err.message : 'Lỗi kết nối nguồn',
      };
    }
  });

  interface EnrichedRawCandidate {
    seed: BotFeedSeed;
    title: string;
    url: string;
    description: string;
    pubDate: string;
    category: string;
    matchedTickers: string[];
    impactLabel: 'Rủi ro cao' | 'Hỗ trợ tăng' | 'Trung lập';
    sentimentLabel: SentimentVerdict;
    sentiment: SentimentBreakdown;
  }

  const allCandidates: EnrichedRawCandidate[] = [];
  const statuses: SourceFetchStatus[] = [];

  for (const fr of fetchedResults) {
    statuses.push({
      sourceId: fr.seed.id,
      sourceName: fr.seed.name,
      method: fr.seed.kind === 'hackernews' || fr.seed.kind === 'gdelt' ? 'Public API' : 'RSS/Atom',
      articleCount: fr.items.length,
      error: fr.error,
    });

    for (const item of fr.items) {
      if (!item.title || !item.url) continue;
      const matchedTickers = extractMatchedTickers(item.title, item.description, catalogSet);
      const scored = scoreFinanceArticleImpact(item.title, item.description);
      const category = inferGeneralCategory(
        item.title,
        item.description,
        fr.seed.defaultCategory
      );
      allCandidates.push({
        seed: fr.seed,
        title: item.title,
        url: item.url,
        description: item.description || item.title,
        pubDate: item.pubDate,
        category,
        matchedTickers,
        ...scored,
      });
    }
  }

  const { accepted, report } = evaluateBatchWithDedupBot(
    allCandidates.map((c) => ({
      title: c.title,
      url: c.url,
      description: c.description,
      sourceName: c.seed.name,
      ref: c,
    })),
    params.dedupBotEnabled !== false ? params.existingItems || [] : []
  );

  // Build per-source logs: [HH:mm] Source -> +N tin mới (Mã: ...) | Chặn K tin trùng
  const timeStr = formatNowHHmm();
  const acceptedUrlSet = new Map(accepted.map((a) => [a.item.url, a]));
  const logs: CrawlerLogEntry[] = [];
  const globalMatchedTickers = new Set<string>();

  for (const fr of fetchedResults) {
    if (fr.error) {
      logs.push({
        id: `log-${fr.seed.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: timeStr,
        sourceName: fr.seed.name,
        status: 'error',
        newCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        matchedTickers: [],
        message: `[${timeStr}] ${fr.seed.name} → Lỗi tạm thời (${fr.error}), bỏ qua an toàn.`,
      });
      continue;
    }

    let srcNew = 0;
    let srcUpd = 0;
    let srcSkip = 0;
    const srcTickers = new Set<string>();

    for (const item of fr.items) {
      const acc = acceptedUrlSet.get(item.url);
      if (acc) {
        if (acc.dedupStatus === 'updated') srcUpd += 1;
        else srcNew += 1;
        for (const t of acc.item.ref.matchedTickers) {
          srcTickers.add(t);
          globalMatchedTickers.add(t);
        }
      } else {
        srcSkip += 1;
      }
    }

    const tickerLabel =
      srcTickers.size > 0 ? ` (Mã: ${Array.from(srcTickers).slice(0, 5).join(', ')})` : '';
    const updLabel = srcUpd > 0 ? ` · ${srcUpd} cập nhật` : '';
    logs.push({
      id: `log-${fr.seed.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: timeStr,
      sourceName: fr.seed.name,
      status: srcNew + srcUpd > 0 ? 'ok' : 'skipped',
      newCount: srcNew,
      updatedCount: srcUpd,
      skippedCount: srcSkip,
      matchedTickers: Array.from(srcTickers),
      message: `[${timeStr}] ${fr.seed.name} → +${srcNew} tin mới${updLabel}${tickerLabel} | Chặn ${srcSkip} tin trùng`,
    });
  }

  const articles: FetchedSourceArticle[] = [];
  const taggedArticles: FinanceTaggedArticle[] = [];

  for (const acc of accepted) {
    const c = acc.item.ref;
    const rel = formatRelativeTime(c.pubDate);
    const tickerPrefix =
      c.matchedTickers.length > 0 ? `[${c.matchedTickers.join(', ')}] ` : '';
    const fetchedArt: FetchedSourceArticle = {
      id: `bot-art-${hashShort(c.url)}`,
      sourceId: c.seed.id,
      sourceName: c.seed.name,
      sourceDomain: c.seed.domain,
      title: c.title,
      url: c.url,
      publishedRelative: rel,
      category: c.category,
      summary: `${tickerPrefix}${c.description}`.slice(0, 1400),
      keyTakeaway: `${c.impactLabel}${c.matchedTickers.length > 0 ? ` · Mã: ${c.matchedTickers.join(', ')}` : ''}`,
      sentimentLabel: c.sentimentLabel,
      sentiment: c.sentiment,
      dedupStatus: acc.dedupStatus,
      existingDocId: acc.existingDocId,
      updateReason: acc.updateReason,
    };
    articles.push(fetchedArt);

    if (
      c.matchedTickers.length > 0 ||
      c.seed.packId === 'chung-khoan' ||
      c.seed.packId === 'tai-chinh'
    ) {
      taggedArticles.push({
        id: fetchedArt.id,
        sourceId: c.seed.id,
        sourceName: c.seed.name,
        sourceDomain: c.seed.domain,
        title: c.title,
        url: c.url,
        publishedRelative: rel,
        summary: c.description,
        impactLabel: c.impactLabel,
        sentimentLabel: c.sentimentLabel,
        matchedTickers: c.matchedTickers,
        dedupStatus: acc.dedupStatus,
        existingDocId: acc.existingDocId,
        updateReason: acc.updateReason,
        fetchedArticle: fetchedArt,
      });
    }
  }

  // Auto-publish scanned articles directly into Editorial Newsroom Live Feed
  if (articles.length > 0) {
    publishFetchedArticlesToFeed(articles, {
      watchlistSymbols: params.watchlistSymbols,
      customKeywords: params.customKeywords,
      sourceContext: 'Auto-Discovery Bot',
    });
  }

  const touchedUrls = fetchedResults
    .filter((fr) => !fr.error && fr.items.length > 0)
    .map((fr) => fr.seed.url);
  touchSourceLastFetched(touchedUrls);

  return {
    scannedAt: new Date().toISOString(),
    activePacks,
    scannedSourcesCount: runSeeds.length,
    newCount: report.newCount,
    updatedCount: report.updatedCount,
    skippedDuplicateCount: report.skippedDuplicateCount,
    matchedTickers: Array.from(globalMatchedTickers),
    articles: articles.slice(0, 48),
    taggedArticles: taggedArticles.slice(0, 24),
    logs,
    statuses,
    botReport: report,
  };
}

/* --- Corporate Governance Events & Filings Crawler (ĐHĐCĐ, HĐQT, Nội bộ, M&A) --- */

const GOVERNANCE_CATEGORY_LABELS: Record<CorporateEventCategory, string> = {
  dividend_dilution: 'Kế hoạch KD & Cổ tức / Pha loãng',
  insider_trading: 'Giao dịch Cổ đông Nội bộ',
  ma_restructuring: 'Tái cấu trúc / M&A / Pháp lý',
  contracts_projects: 'Hợp đồng & Dự án mới',
};

const GOVERNANCE_KEYWORDS_RE =
  /đại hội đồng cổ đông|đhđcđ|nghị quyết hđqt|cổ đông nội bộ|cổ đông lớn|mua lại cổ phiếu|phát hành thêm|chia cổ tức|tạm ứng cổ tức|chào bán cổ phần|esop|sáp nhập|m&a|chuyển nhượng vốn|thâu tóm|trúng thầu|ký kết hợp đồng|khởi công|xử phạt|ubck|hose|hnx|kế hoạch lợi nhuận|tăng vốn điều lệ/i;

function classifyGovernanceCategory(text: string): CorporateEventCategory {
  const lower = text.toLowerCase();
  if (/cổ đông nội bộ|cổ đông lớn|người nội bộ|chủ tịch.*mua|chủ tịch.*bán|tgđ.*mua|tgđ.*bán|đăng ký giao dịch|mua vào|bán ra.*cổ phiếu/.test(lower)) {
    return 'insider_trading';
  }
  if (/m&a|sáp nhập|thoái vốn|thâu tóm|tái cấu trúc|xử phạt|ubck|vi phạm|thanh tra|kiểm soát|hạn chế giao dịch|pháp lý/.test(lower)) {
    return 'ma_restructuring';
  }
  if (/trúng thầu|hợp đồng|dự án|khởi công|nhà máy|xuất khẩu|đơn hàng|bàn giao|mở rộng/.test(lower)) {
    return 'contracts_projects';
  }
  return 'dividend_dilution';
}

function extractCorporateKeyMetrics(text: string): string[] {
  const metrics: string[] = [];
  const pctMatches = text.match(/\b\d+(?:[.,]\d+)?%/g);
  if (pctMatches) {
    for (const p of pctMatches.slice(0, 2)) {
      metrics.push(p);
    }
  }
  const moneyMatches = text.match(/\b\d+(?:[.,]\d+)?\s*(?:nghìn tỷ|tỷ đồng|triệu cổ phiếu|triệu cp|đồng\/cp)/gi);
  if (moneyMatches) {
    for (const m of moneyMatches.slice(0, 2)) {
      metrics.push(m.trim());
    }
  }
  return Array.from(new Set(metrics)).slice(0, 3);
}

let corporateEventsCache: {
  key: string;
  data: CorporateEventsResponse;
  expiresAt: number;
} | null = null;

export async function scanCorporateEvents(params: {
  watchlistSymbols?: string[];
  existingItems?: ExistingArticleFingerprint[];
  forceRefresh?: boolean;
}): Promise<CorporateEventsResponse> {
  const watchSyms = Array.from(
    new Set(
      (params.watchlistSymbols || [])
        .map((s) => s.trim().toUpperCase())
        .filter((s) => /^[A-Z0-9]{2,8}$/.test(s))
    )
  ).slice(0, 8);

  const cacheKey = watchSyms.sort().join(',') || 'market';
  if (
    !params.forceRefresh &&
    corporateEventsCache &&
    corporateEventsCache.key === cacheKey &&
    corporateEventsCache.expiresAt > Date.now()
  ) {
    return corporateEventsCache.data;
  }

  const governanceSeeds: BotFeedSeed[] = [
    {
      id: 'corp-cafef-dn',
      packId: 'chung-khoan',
      name: 'CafeF — Doanh nghiệp & Công bố',
      domain: 'cafef.vn',
      url: 'https://cafef.vn/doanh-nghiep.rss',
      defaultCategory: 'Kinh doanh',
    },
    {
      id: 'corp-vietstock-cp',
      packId: 'chung-khoan',
      name: 'Vietstock — Cổ phiếu & ĐHĐCĐ',
      domain: 'vietstock.vn',
      url: 'https://vietstock.vn/830/chung-khoan/co-phieu.rss',
      defaultCategory: 'Kinh doanh',
    },
    {
      id: 'corp-tnck',
      packId: 'chung-khoan',
      name: 'Tin Nhanh Chứng Khoán',
      domain: 'tinnhanhchungkhoan.vn',
      url: 'https://www.tinnhanhchungkhoan.vn/rss/home.rss',
      defaultCategory: 'Kinh doanh',
    },
    {
      id: 'corp-gnews-dhdcd',
      packId: 'watchlist',
      name: 'HOSE/HNX/SSC — ĐHĐCĐ & Nghị quyết HĐQT',
      domain: 'news.google.com',
      url: buildGoogleNewsRssUrl('"Đại hội đồng cổ đông" OR "Nghị quyết HĐQT" OR "Trả cổ tức" OR "Phát hành thêm" chứng khoán'),
      defaultCategory: 'Kinh doanh',
      kind: 'googlenews',
    },
    {
      id: 'corp-gnews-insider',
      packId: 'watchlist',
      name: 'Giao dịch Cổ đông nội bộ & M&A',
      domain: 'news.google.com',
      url: buildGoogleNewsRssUrl('"Giao dịch cổ đông nội bộ" OR "cổ đông lớn" OR "M&A" cổ phiếu HOSE HNX'),
      defaultCategory: 'Kinh doanh',
      kind: 'googlenews',
    },
  ];

  if (watchSyms.length > 0) {
    governanceSeeds.push({
      id: 'corp-gnews-wl',
      packId: 'watchlist',
      name: `Sự kiện Quản trị Watchlist (${watchSyms.slice(0, 4).join(', ')})`,
      domain: 'news.google.com',
      url: buildGoogleNewsRssUrl(
        `(${watchSyms.slice(0, 4).join(' OR ')}) ("cổ tức" OR "ĐHĐCĐ" OR "HĐQT" OR "nội bộ" OR "dự án" OR "M&A")`
      ),
      defaultCategory: 'Kinh doanh',
      kind: 'googlenews',
    });
  }

  const catalogRes = await getSecuritiesCatalog(false);
  const catalogSet = new Set(catalogRes.items.map((i: SsiSecurityItem) => i.symbol));
  for (const sym of watchSyms) catalogSet.add(sym);

  const fetched = await runConcurrencyPool(governanceSeeds, 4, async (seed) => {
    try {
      const items = await fetchRssFeedDirect(seed, 10);
      return { seed, items };
    } catch {
      return { seed, items: [] as Array<{ title: string; url: string; description: string; pubDate: string }> };
    }
  });

  interface RawGovCandidate {
    seed: BotFeedSeed;
    title: string;
    url: string;
    description: string;
    pubDate: string;
    matchedTickers: string[];
    category: CorporateEventCategory;
    impactLabel: 'Rủi ro cao' | 'Hỗ trợ tăng' | 'Trung lập';
  }

  const candidates: RawGovCandidate[] = [];
  for (const fr of fetched) {
    for (const it of fr.items) {
      const combined = `${it.title} ${it.description}`;
      const matchedTickers = extractMatchedTickers(it.title, it.description, catalogSet);
      const isGov =
        GOVERNANCE_KEYWORDS_RE.test(combined) ||
        fr.seed.kind === 'googlenews' ||
        matchedTickers.some((t) => watchSyms.includes(t));
      if (!isGov) continue;

      const scored = scoreFinanceArticleImpact(it.title, it.description);
      candidates.push({
        seed: fr.seed,
        title: it.title,
        url: it.url,
        description: it.description || it.title,
        pubDate: it.pubDate,
        matchedTickers,
        category: classifyGovernanceCategory(combined),
        impactLabel: scored.impactLabel,
      });
    }
  }

  const watchSet = new Set(watchSyms);
  candidates.sort((a, b) => {
    const aHit = a.matchedTickers.some((t) => watchSet.has(t)) ? 1 : 0;
    const bHit = b.matchedTickers.some((t) => watchSet.has(t)) ? 1 : 0;
    if (bHit !== aHit) return bHit - aHit;
    return b.matchedTickers.length - a.matchedTickers.length;
  });

  const { accepted, report } = evaluateBatchWithDedupBot(
    candidates.slice(0, 40).map((c) => ({
      title: c.title,
      url: c.url,
      description: c.description,
      sourceName: c.seed.name,
      ref: c,
    })),
    params.existingItems || []
  );

  const byCategoryCount: Record<CorporateEventCategory, number> = {
    dividend_dilution: 0,
    insider_trading: 0,
    ma_restructuring: 0,
    contracts_projects: 0,
  };

  const events: CorporateEventItem[] = accepted.slice(0, 28).map((acc) => {
    const c = acc.item.ref;
    byCategoryCount[c.category] += 1;
    let eventDate = new Date().toISOString().split('T')[0];
    if (c.pubDate) {
      const d = new Date(c.pubDate);
      if (!Number.isNaN(d.getTime())) {
        eventDate = d.toISOString().split('T')[0];
      }
    }
    return {
      id: `corp-ev-${hashShort(c.url)}`,
      symbol: c.matchedTickers[0] || watchSyms[0] || 'VN',
      category: c.category,
      categoryLabel: GOVERNANCE_CATEGORY_LABELS[c.category],
      title: c.title,
      summary: c.description.slice(0, 320),
      sourceName: c.seed.name,
      url: c.url,
      publishedRelative: formatRelativeTime(c.pubDate),
      eventDate,
      impactLabel: c.impactLabel,
      keyMetrics: extractCorporateKeyMetrics(`${c.title} ${c.description}`),
    };
  });

  const result: CorporateEventsResponse = {
    scannedAt: new Date().toISOString(),
    totalScanned: candidates.length,
    events,
    botReport: report,
    byCategoryCount,
  };

  corporateEventsCache = {
    key: cacheKey,
    data: result,
    expiresAt: Date.now() + 15 * 60_000,
  };

  return result;
}
