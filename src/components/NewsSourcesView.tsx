import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Cloud,
  Compass,
  Database,
  Download,
  ExternalLink,
  FileSearch,
  Globe,
  HardDrive,
  Loader2,
  Minus,
  Play,
  Power,
  RefreshCw,
  RotateCcw,
  Rss,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Upload,
} from 'lucide-react';
import type {
  AutoFetchIntervalMinutes,
  CrawledArticleResult,
  CrawlerLogEntry,
  DiscoveredRssFeed,
  ExistingArticleFingerprint,
  FetchedSourceArticle,
  NewsSourceConfig,
  PublicApiCatalogItem,
  PublicApiProviderId,
  SentimentVerdict,
  SmartDiscoveryResponse,
  SourceFetchResponse,
  SourcesSyncBadgeStatus,
  TopicPackId,
  TopicPackMeta,
} from '../types/news';
import {
  DEFAULT_SEED_SOURCES,
  OFFICIAL_TOPIC_PACK_CATALOG,
} from '../lib/defaultSeedSources';
import { SentimentBar } from './SentimentBar';

export const PRESET_SOURCES: NewsSourceConfig[] = DEFAULT_SEED_SOURCES;

const FALLBACK_TOPIC_PACKS: TopicPackMeta[] = OFFICIAL_TOPIC_PACK_CATALOG;

const INTERVAL_OPTIONS: Array<{ value: AutoFetchIntervalMinutes; label: string }> = [
  { value: 5, label: '5 phút' },
  { value: 15, label: '15 phút' },
  { value: 30, label: '30 phút' },
  { value: 60, label: '60 phút' },
];

interface NewsSourcesViewProps {
  sources: NewsSourceConfig[];
  onAddSource: (source: NewsSourceConfig) => void;
  onToggleSource: (id: string) => void;
  onRemoveSource: (id: string) => void;
  onAnalyzeArticleUrl: (
    url: string,
    title?: string,
    sourceName?: string,
    category?: string
  ) => void;
  onDeepAnalyzeArticleUrl: (url: string) => void;
  onApplyToDigest: () => void;
  existingFingerprints?: ExistingArticleFingerprint[];
  dedupBotEnabled?: boolean;
  onPersistFetchedResult?: (res: SourceFetchResponse) => Promise<void> | void;
  // Auto-Discovery Bot Control Props
  botAutoScanEnabled: boolean;
  onToggleBotAutoScan: () => void;
  autoFetchInterval: AutoFetchIntervalMinutes;
  onChangeInterval: (minutes: AutoFetchIntervalMinutes) => void;
  botScanning: boolean;
  botScanError: string | null;
  lastBotScanAt: string | null;
  nextBotScanAt: number | null;
  activeTopicPacks: TopicPackId[];
  onToggleTopicPack: (packId: TopicPackId) => void;
  botCustomKeywords: string[];
  onAddBotKeyword: (keyword: string) => void;
  onRemoveBotKeyword: (keyword: string) => void;
  botCrawlerLogs: CrawlerLogEntry[];
  botDiscoveredArticles: FetchedSourceArticle[];
  botSessionStats: {
    totalScanned: number;
    newCount: number;
    updatedCount: number;
    skippedDuplicateCount: number;
  };
  watchlistSymbols: string[];
  onScanBotAllNow: () => void;
  onClearBotLogs: () => void;
  // 3-Layer Persistence Controls
  sourcesSyncStatus: SourcesSyncBadgeStatus;
  userSignedIn: boolean;
  onResetDefaultSources: () => Promise<void> | void;
  onExportSourcesConfig: () => void;
  onImportSourcesConfig: (rawPayload: unknown) => Promise<{ ok: boolean; message: string }>;
}

function extractDomain(rawUrl: string): string {
  const normalized = /^https?:\/\//i.test(rawUrl.trim())
    ? rawUrl.trim()
    : `https://${rawUrl.trim()}`;
  const parsed = new URL(normalized);
  return parsed.hostname.replace(/^www\./, '');
}

function SentimentLabel({ label }: { label: SentimentVerdict }) {
  if (label === 'Tích cực') {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
        <ThumbsUp className="h-3 w-3" aria-hidden="true" />
        <span>Tích cực</span>
      </span>
    );
  }
  if (label === 'Tiêu cực') {
    return (
      <span className="inline-flex items-center gap-1 font-medium text-red-700 dark:text-red-400">
        <ThumbsDown className="h-3 w-3" aria-hidden="true" />
        <span>Tiêu cực</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300">
      <Minus className="h-3 w-3" aria-hidden="true" />
      <span>Trung lập</span>
    </span>
  );
}

export function NewsSourcesView({
  sources,
  onAddSource,
  onToggleSource,
  onRemoveSource,
  onAnalyzeArticleUrl,
  onDeepAnalyzeArticleUrl,
  onApplyToDigest,
  existingFingerprints = [],
  dedupBotEnabled = true,
  onPersistFetchedResult,
  botAutoScanEnabled,
  onToggleBotAutoScan,
  autoFetchInterval,
  onChangeInterval,
  botScanning,
  botScanError,
  lastBotScanAt,
  nextBotScanAt,
  activeTopicPacks,
  onToggleTopicPack,
  botCustomKeywords,
  onAddBotKeyword,
  onRemoveBotKeyword,
  botCrawlerLogs,
  botDiscoveredArticles,
  botSessionStats,
  watchlistSymbols,
  onScanBotAllNow,
  onClearBotLogs,
  sourcesSyncStatus,
  userSignedIn,
  onResetDefaultSources,
  onExportSourcesConfig,
  onImportSourcesConfig,
}: NewsSourcesViewProps) {
  const [subMode, setSubMode] = useState<'sources' | 'crawler' | 'public-apis'>('sources');

  // Topic Packs catalog from backend
  const [topicPacks, setTopicPacks] = useState<TopicPackMeta[]>(FALLBACK_TOPIC_PACKS);
  const [inspectedPackId, setInspectedPackId] = useState<TopicPackId | null>(null);
  const [sourceListTab, setSourceListTab] = useState<'custom' | 'all'>('custom');

  // JSON Import / Reset feedback
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const [configActionMsg, setConfigActionMsg] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [resettingDefaults, setResettingDefaults] = useState(false);

  // Smart Domain / Keyword Auto-Discovery bar
  const [smartInput, setSmartInput] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [discoveryResult, setDiscoveryResult] = useState<SmartDiscoveryResponse | null>(null);

  // Manual single-source fetch (for discovered custom feeds)
  const [fetching, setFetching] = useState(false);
  const [fetchingSourceId, setFetchingSourceId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [manualFetchArticles, setManualFetchArticles] = useState<FetchedSourceArticle[] | null>(
    null
  );

  // Live Articles Filter
  const [filterSourceName, setFilterSourceName] = useState<string>('all');
  const [filterSentiment, setFilterSentiment] = useState<string>('all');

  // Countdown tick for next scheduled bot scan
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!botAutoScanEnabled || !nextBotScanAt) return;
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [botAutoScanEnabled, nextBotScanAt]);

  useEffect(() => {
    fetch('/api/bot/topic-packs')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.packs)) {
          setTopicPacks(data.packs as TopicPackMeta[]);
        }
      })
      .catch(() => {
        // fallback catalog already populated
      });
  }, []);

  // Direct Article URL Crawler state (inspired by behitek/news-crawler)
  const [crawlUrlInput, setCrawlUrlInput] = useState('');
  const [crawling, setCrawling] = useState(false);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [crawledArticle, setCrawledArticle] = useState<CrawledArticleResult | null>(null);
  const [crawlImageFailed, setCrawlImageFailed] = useState(false);

  // Public APIs Catalog & Live Feed state (inspired by public-apis/public-apis)
  const [catalogItems, setCatalogItems] = useState<PublicApiCatalogItem[]>([]);
  const [catalogCategory, setCatalogCategory] = useState<string>('Tất cả');
  const [onlyKeyless, setOnlyKeyless] = useState<boolean>(false);
  const [gdeltQuery, setGdeltQuery] = useState<string>('Vietnam OR economy OR AI');
  const [loadingPublicApi, setLoadingPublicApi] = useState<PublicApiProviderId | null>(null);
  const [publicApiError, setPublicApiError] = useState<string | null>(null);
  const [publicApiFeed, setPublicApiFeed] = useState<SourceFetchResponse | null>(null);

  useEffect(() => {
    if (subMode !== 'public-apis' || catalogItems.length > 0) return;
    fetch('/api/public-apis/catalog')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.items)) {
          setCatalogItems(data.items as PublicApiCatalogItem[]);
        }
      })
      .catch(() => {
        // ignore catalog error
      });
  }, [subMode, catalogItems.length]);

  const handleRunPublicApi = async (provider: PublicApiProviderId) => {
    setLoadingPublicApi(provider);
    setPublicApiError(null);
    try {
      const res = await fetch('/api/public-apis/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          query: provider === 'gdelt' ? gdeltQuery.trim() : undefined,
          existingItems: dedupBotEnabled ? existingFingerprints : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể lấy dữ liệu từ Public API.');
      }
      const parsed = data as SourceFetchResponse;
      setPublicApiFeed(parsed);
      await onPersistFetchedResult?.(parsed);
    } catch (err) {
      setPublicApiError(err instanceof Error ? err.message : 'Lỗi kết nối Public API.');
    } finally {
      setLoadingPublicApi(null);
    }
  };

  const handleAddPublicApiSource = (api: PublicApiCatalogItem) => {
    if (!api.endpointUrl) return;
    if (sources.some((s) => s.url.toLowerCase() === api.endpointUrl!.toLowerCase())) {
      return;
    }
    onAddSource({
      id: `pubapi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: api.name,
      url: api.endpointUrl,
      domain: extractDomain(api.endpointUrl),
      defaultCategory: api.defaultCategory,
      enabled: true,
      addedAt: new Date().toISOString(),
      kind:
        api.liveProviderId === 'hackernews'
          ? 'hackernews'
          : api.liveProviderId === 'gdelt'
            ? 'gdelt'
            : 'api',
      origin: 'custom',
    });
  };

  const handleSmartDiscover = async (e: FormEvent) => {
    e.preventDefault();
    const cleaned = smartInput.trim();
    if (!cleaned) return;
    setDiscovering(true);
    setDiscoverError(null);
    try {
      const res = await fetch('/api/bot/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: cleaned }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể tự khám phá nguồn tin từ đầu vào này.');
      }
      setDiscoveryResult(data as SmartDiscoveryResponse);
    } catch (err) {
      setDiscoverError(
        err instanceof Error ? err.message : 'Lỗi kết nối khi khám phá nguồn tin.'
      );
    } finally {
      setDiscovering(false);
    }
  };

  const handleAddDiscoveredFeed = (feed: DiscoveredRssFeed, isKeyword = false) => {
    if (sources.some((s) => s.url.toLowerCase() === feed.url.toLowerCase())) {
      return;
    }
    onAddSource({
      id: `${isKeyword ? 'kw' : 'bot-feed'}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: feed.name,
      url: feed.url,
      domain: feed.domain,
      defaultCategory: feed.defaultCategory,
      enabled: true,
      addedAt: new Date().toISOString(),
      kind: feed.url.includes('news.google.com') ? 'googlenews' : 'rss',
      origin: isKeyword ? 'keyword' : 'discovered',
    });
  };

  const handleAddAllDiscovered = () => {
    if (!discoveryResult) return;
    const isKw = discoveryResult.resolvedType === 'keyword';
    if (isKw) {
      onAddBotKeyword(discoveryResult.input);
    }
    for (const feed of discoveryResult.discoveredFeeds.slice(0, 6)) {
      handleAddDiscoveredFeed(feed, isKw);
    }
  };

  const handleImportFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const result = await onImportSourcesConfig(parsed);
      setConfigActionMsg({ ok: result.ok, text: result.message });
    } catch {
      setConfigActionMsg({
        ok: false,
        text: 'Tệp JSON không hợp lệ hoặc bị hỏng cấu trúc. Vui lòng kiểm tra lại.',
      });
    }
  };

  const handleResetDefaultsClick = async () => {
    setResettingDefaults(true);
    setConfigActionMsg(null);
    try {
      await onResetDefaultSources();
      setConfigActionMsg({
        ok: true,
        text: 'Đã khôi phục đầy đủ Bộ Nguồn Tiêu Chuẩn (7 Gói Chủ đề · 35+ kênh chính thống) và giữ nguyên nguồn tự dò của bạn.',
      });
    } catch {
      setConfigActionMsg({
        ok: false,
        text: 'Không thể nạp lại Bộ Nguồn Tiêu Chuẩn lúc này.',
      });
    } finally {
      setResettingDefaults(false);
    }
  };

  const runFetchSingleSource = async (src: NewsSourceConfig) => {
    setFetching(true);
    setFetchingSourceId(src.id);
    setFetchError(null);
    try {
      const res = await fetch('/api/news/fetch-source', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: [
            {
              id: src.id,
              name: src.name,
              url: src.url,
              defaultCategory: src.defaultCategory,
            },
          ],
          existingItems: dedupBotEnabled ? existingFingerprints : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể lấy tin từ nguồn đã chọn.');
      }
      const parsed = data as SourceFetchResponse;
      setManualFetchArticles(parsed.articles);
      setFilterSourceName('all');
      setFilterSentiment('all');
      await onPersistFetchedResult?.(parsed);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ.');
    } finally {
      setFetching(false);
      setFetchingSourceId(null);
    }
  };

  const runCrawlArticle = async (targetUrl: string) => {
    const cleaned = targetUrl.trim();
    if (!cleaned) return;
    setSubMode('crawler');
    setCrawlUrlInput(cleaned);
    setCrawling(true);
    setCrawlError(null);
    setCrawlImageFailed(false);
    try {
      const res = await fetch('/api/news/crawl-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleaned, runNlp: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể thu thập bài viết từ đường dẫn này.');
      }
      setCrawledArticle(data as CrawledArticleResult);
    } catch (err) {
      setCrawlError(err instanceof Error ? err.message : 'Lỗi thu thập bài viết.');
    } finally {
      setCrawling(false);
    }
  };

  const handleCrawlSubmit = (e: FormEvent) => {
    e.preventDefault();
    runCrawlArticle(crawlUrlInput);
  };

  const enabledSources = useMemo(() => sources.filter((s) => s.enabled), [sources]);

  const sourcesByPack = useMemo(() => {
    const map = new Map<TopicPackId, NewsSourceConfig[]>();
    for (const s of sources) {
      const pId: TopicPackId | undefined =
        s.packId ?? (s.origin === 'watchlist' ? 'watchlist' : undefined);
      if (!pId) continue;
      const list = map.get(pId) || [];
      list.push(s);
      map.set(pId, list);
    }
    return map;
  }, [sources]);

  const customAndWatchlistSources = useMemo(
    () => sources.filter((s) => s.origin !== 'seed'),
    [sources]
  );

  const displayedManagedSources = useMemo(
    () => (sourceListTab === 'custom' ? customAndWatchlistSources : sources),
    [sourceListTab, customAndWatchlistSources, sources]
  );

  const activePackFeedsCount = useMemo(() => {
    let total = 0;
    const activePackSet = new Set(activeTopicPacks);
    for (const s of enabledSources) {
      if (!s.packId || activePackSet.has(s.packId)) {
        total += 1;
      }
    }
    if (activePackSet.has('watchlist')) {
      total += botCustomKeywords.length;
    }
    return total;
  }, [activeTopicPacks, enabledSources, botCustomKeywords.length]);

  const displayedArticles = useMemo(() => {
    const list = manualFetchArticles ?? botDiscoveredArticles;
    return list.filter((art) => {
      const matchSrc = filterSourceName === 'all' || art.sourceName === filterSourceName;
      const matchSent = filterSentiment === 'all' || art.sentimentLabel === filterSentiment;
      return matchSrc && matchSent;
    });
  }, [manualFetchArticles, botDiscoveredArticles, filterSourceName, filterSentiment]);

  const availableArticleSources = useMemo(() => {
    const list = manualFetchArticles ?? botDiscoveredArticles;
    return Array.from(new Set(list.map((a) => a.sourceName)));
  }, [manualFetchArticles, botDiscoveredArticles]);

  const countdownText = useMemo(() => {
    if (!botAutoScanEnabled || !nextBotScanAt) return null;
    const remSec = Math.max(0, Math.floor((nextBotScanAt - nowMs) / 1000));
    const m = Math.floor(remSec / 60);
    const s = remSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, [botAutoScanEnabled, nextBotScanAt, nowMs]);

  const inspectedPackMeta = useMemo(
    () => topicPacks.find((p) => p.id === inspectedPackId) || null,
    [topicPacks, inspectedPackId]
  );

  const inspectedPackSources = useMemo(
    () => (inspectedPackId ? sourcesByPack.get(inspectedPackId) || [] : []),
    [inspectedPackId, sourcesByPack]
  );

  const persistenceBadgeLabel = sourcesSyncStatus.cloudSyncing
    ? 'Đang đồng bộ Cloud & Disk...'
    : userSignedIn && sourcesSyncStatus.cloudSaved
      ? 'Đã lưu an toàn: Disk + Cloud'
      : sourcesSyncStatus.diskSaved && sourcesSyncStatus.localSaved
        ? 'Đã lưu cục bộ: Disk + LocalStorage'
        : 'Đã lưu trình duyệt: LocalStorage';

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header & Mode Tabs */}
      <div className="flex flex-col gap-5 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between dark:border-slate-800">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Bot Tự động Khám phá Nguồn tin &amp; Hệ thống Lưu trữ Bền vững 3 Lớp
          </p>
          <h1 className="mt-2 font-sans tracking-tight text-3xl font-semibold text-slate-900 dark:text-slate-100">
            Nguồn trang &amp; Bot Quét Toàn Mạng
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Tích hợp sẵn 7 gói chuyên mục chính thống (35+ kênh Việt Nam &amp; Quốc tế) cùng Watchlist RSS động. Mọi chỉnh sửa được lưu tức thời xuống Đĩa máy chủ, trình duyệt và Cloud.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900/90"
            role="tablist"
            aria-label="Chế độ thu thập tin"
          >
            <button
              type="button"
              role="tab"
              aria-selected={subMode === 'sources'}
              onClick={() => setSubMode('sources')}
              className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer ${
                subMode === 'sources'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <Bot className="h-3.5 w-3.5" />
              <span>Bot Khám phá ({activePackFeedsCount})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={subMode === 'crawler'}
              onClick={() => setSubMode('crawler')}
              className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer ${
                subMode === 'crawler'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <Download className="h-3.5 w-3.5" />
              <span>Thu thập từ URL bài viết</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={subMode === 'public-apis'}
              onClick={() => setSubMode('public-apis')}
              className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer ${
                subMode === 'public-apis'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <Database className="h-3.5 w-3.5" />
              <span>Public APIs mở</span>
            </button>
          </div>
        </div>
      </div>

      {/* Persistence Status Strip + Backup / Restore / Reset Defaults */}
      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <span
            className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 font-mono text-[11px] font-semibold ${
              userSignedIn && sourcesSyncStatus.cloudSaved
                ? 'border-emerald-700/40 bg-emerald-50 text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-950/50 dark:text-emerald-300'
                : 'border-amber-800/30 bg-amber-50 text-amber-950 dark:border-amber-700/40 dark:bg-amber-950/40 dark:text-amber-300'
            }`}
          >
            {sourcesSyncStatus.cloudSyncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : userSignedIn && sourcesSyncStatus.cloudSaved ? (
              <Cloud className="h-3.5 w-3.5" />
            ) : (
              <HardDrive className="h-3.5 w-3.5" />
            )}
            <span>{persistenceBadgeLabel}</span>
          </span>

          <span className="font-mono text-[11px] text-slate-600 tabular-nums dark:text-slate-400">
            {enabledSources.length}/{sources.length} kênh đang bật
          </span>

          {sourcesSyncStatus.lastSavedAt && (
            <span className="font-mono text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
              · Lưu lúc {new Date(sourcesSyncStatus.lastSavedAt).toLocaleTimeString('vi-VN')}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={importFileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={(e) => void handleImportFileChange(e)}
            className="hidden"
          />

          <button
            type="button"
            onClick={onExportSourcesConfig}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Sao lưu JSON</span>
          </button>

          <button
            type="button"
            onClick={() => importFileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Khôi phục JSON</span>
          </button>

          <button
            type="button"
            disabled={resettingDefaults}
            onClick={() => void handleResetDefaultsClick()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 hover:border-amber-800 hover:text-amber-900 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-amber-400 cursor-pointer whitespace-nowrap"
          >
            {resettingDefaults ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            <span>Nạp lại Bộ Nguồn Tiêu Chuẩn</span>
          </button>
        </div>
      </div>

      {configActionMsg && (
        <div
          className={`mt-3 rounded-xl border px-3.5 py-2 text-xs ${
            configActionMsg.ok
              ? 'border-emerald-700/40 bg-emerald-50 text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'border-red-700/40 bg-red-50 text-red-900 dark:border-red-600/40 dark:bg-red-950/40 dark:text-red-200'
          }`}
        >
          {configActionMsg.text}
        </div>
      )}

      {/* SUBMODE 1: AUTO-DISCOVERY BOT CONTROL CENTER */}
      {subMode === 'sources' && (
        <div className="mt-6 space-y-8">
          {/* 1. Bot Control Center + Live KPI Strip */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-white dark:bg-slate-100 dark:text-slate-900">
                    <Bot className="h-3.5 w-3.5" /> Trung tâm Điều khiển Bot
                  </span>
                  <span
                    className={`rounded-xl px-2 py-0.5 font-mono text-[11px] font-semibold ${
                      botAutoScanEnabled
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {botAutoScanEnabled ? 'TỰ ĐỘNG: ĐANG BẬT' : 'TỰ ĐỘNG: TẠM DỪNG'}
                  </span>
                  {countdownText && (
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-amber-900 tabular-nums dark:text-amber-400">
                      <Clock className="h-3 w-3" /> Lượt kế tiếp: {countdownText}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {lastBotScanAt
                    ? `Quét toàn mạng gần nhất lúc ${new Date(lastBotScanAt).toLocaleTimeString('vi-VN')}. Mọi tin mới được lọc trùng qua DedupBot trước khi lưu vào Kho Tin.`
                    : 'Bấm "Quét Toàn Bộ Ngay" hoặc bật chế độ tự động để Bot thu thập đồng loạt từ các gói nguồn đang kích hoạt.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={onToggleBotAutoScan}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium cursor-pointer whitespace-nowrap ${
                    botAutoScanEnabled
                      ? 'border-emerald-700/50 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-600/50 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200'
                  }`}
                >
                  <Power className="h-3.5 w-3.5" />
                  <span>
                    {botAutoScanEnabled
                      ? 'Tắt Bot Quét Tin Tự Động'
                      : 'Bật Bot Quét Tin Tự Động Toàn Mạng'}
                  </span>
                </button>

                <select
                  value={autoFetchInterval}
                  onChange={(e) =>
                    onChangeInterval(Number(e.target.value) as AutoFetchIntervalMinutes)
                  }
                  aria-label="Chu kỳ quét tự động của Bot"
                  className="rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-2 font-mono text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                >
                  {INTERVAL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      Chu kỳ: {opt.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={onApplyToDigest}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                >
                  Áp dụng Bản tin
                </button>

                <button
                  type="button"
                  disabled={botScanning}
                  onClick={onScanBotAllNow}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 cursor-pointer whitespace-nowrap"
                >
                  {botScanning ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Bot đang quét toàn mạng...</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" />
                      <span>Quét Toàn Bộ Ngay</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 3 KPI Tiles */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 font-mono tabular-nums">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
                <p className="font-sans text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Số kênh đang kích hoạt
                </p>
                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
                  {activePackFeedsCount}{' '}
                  <span className="font-sans text-xs font-normal text-slate-500">
                    kênh ({activeTopicPacks.length} gói · {customAndWatchlistSources.length} tùy chỉnh)
                  </span>
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
                <p className="font-sans text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Tin mới &amp; Cập nhật phiên này
                </p>
                <p className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-400">
                  +{botSessionStats.newCount}{' '}
                  <span className="font-sans text-xs font-normal text-slate-600 dark:text-slate-400">
                    tin mới · {botSessionStats.updatedCount} cập nhật
                  </span>
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
                <p className="font-sans text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Tin trùng đã chặn (DedupBot)
                </p>
                <p className="mt-1 text-xl font-bold text-amber-900 dark:text-amber-400">
                  {botSessionStats.skippedDuplicateCount}{' '}
                  <span className="font-sans text-xs font-normal text-slate-600 dark:text-slate-400">
                    / {botSessionStats.totalScanned} lượt kiểm tra
                  </span>
                </p>
              </div>
            </div>

            {botScanError && (
              <div className="mt-3 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
                {botScanError}
              </div>
            )}
          </section>

          {/* 2. 7 Official Topic Packs + Watchlist Dynamic Pack */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-sans tracking-tight text-xl font-semibold text-slate-900 dark:text-slate-100">
                Bộ 7 Gói Chuyên mục Chính thống &amp; Watchlist Động
              </h2>
              <span className="font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
                Bấm thẻ để Bật/Tắt gói · Bấm &ldquo;Kênh tin&rdquo; để bật/tắt lẻ từng báo · 0 token AI
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              {topicPacks.map((pack) => {
                const isOn = activeTopicPacks.includes(pack.id);
                const packSources = sourcesByPack.get(pack.id) || [];
                const enabledInPack = packSources.filter((s) => s.enabled).length;
                const totalInPack =
                  pack.id === 'watchlist'
                    ? packSources.length + botCustomKeywords.length
                    : packSources.length || pack.feedCount;
                const activeCountLabel =
                  pack.id === 'watchlist'
                    ? `${enabledInPack + botCustomKeywords.length}/${Math.max(
                        totalInPack,
                        watchlistSymbols.length
                      )}`
                    : `${enabledInPack}/${totalInPack}`;
                const isInspecting = inspectedPackId === pack.id;

                return (
                  <div
                    key={pack.id}
                    className={`flex flex-col justify-between rounded-xl border p-4 transition-colors ${
                      isOn
                        ? 'border-slate-900 bg-emerald-50/50 dark:border-amber-500/70 dark:bg-slate-900'
                        : 'border-slate-200 bg-white opacity-80 hover:opacity-100 dark:border-slate-800 dark:bg-slate-900'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-sans tracking-tight text-[15px] font-bold leading-snug text-slate-900 dark:text-slate-100">
                          {pack.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => onToggleTopicPack(pack.id)}
                          className={`inline-flex items-center gap-1 rounded-xl px-2 py-0.5 font-mono text-[10px] font-bold uppercase shrink-0 cursor-pointer ${
                            isOn
                              ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                              : 'border border-slate-300 text-slate-500 hover:border-slate-600 dark:border-slate-700 dark:text-slate-400'
                          }`}
                        >
                          {isOn ? <Check className="h-3 w-3" /> : null}
                          {isOn ? 'Đang bật' : 'Tắt'}
                        </button>
                      </div>
                      <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                        {pack.description}
                      </p>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200/80 pt-2.5 font-mono text-[11px] text-slate-600 tabular-nums dark:border-slate-800 dark:text-slate-400">
                      <span>{activeCountLabel} kênh</span>
                      <button
                        type="button"
                        onClick={() =>
                          setInspectedPackId((prev) => (prev === pack.id ? null : pack.id))
                        }
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-2 py-0.5 font-sans text-[11px] font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <span>Kênh tin</span>
                        {isInspecting ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Expandable Pack Channel Drawer */}
            {inspectedPackMeta && (
              <div className="rounded-xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
                  <div>
                    <h3 className="font-sans tracking-tight text-base font-semibold text-slate-900 dark:text-slate-100">
                      Danh sách kênh thuộc gói: {inspectedPackMeta.name} ({inspectedPackSources.length})
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Mọi thay đổi bật/tắt từng kênh được lưu ngay lập tức xuống Đĩa, LocalStorage và Cloud.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInspectedPackId(null)}
                    className="rounded-xl border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Đóng chi tiết
                  </button>
                </div>

                {inspectedPackSources.length === 0 ? (
                  <p className="py-4 text-xs text-slate-500 dark:text-slate-400">
                    {inspectedPackMeta.id === 'watchlist'
                      ? 'Chưa có luồng RSS động cho Watchlist. Thêm cổ phiếu vào Watchlist ở mục Tài chính hoặc bấm "Nạp lại Bộ Nguồn Tiêu Chuẩn".'
                      : 'Chưa có kênh nào trong gói này. Bấm "Nạp lại Bộ Nguồn Tiêu Chuẩn" ở thanh công cụ phía trên để khôi phục.'}
                  </p>
                ) : (
                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                    {inspectedPackSources.map((src) => {
                      const isThisFetching = fetching && fetchingSourceId === src.id;
                      return (
                        <div
                          key={src.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                        >
                          <div className="min-w-0 flex-1">
                            <p
                              className={`font-medium truncate ${
                                src.enabled
                                  ? 'text-slate-900 dark:text-slate-100'
                                  : 'text-slate-400 line-through'
                              }`}
                            >
                              {src.name}
                            </p>
                            <p className="truncate font-mono text-[10px] text-slate-500 tabular-nums">
                              {src.domain}
                              {src.lastFetchedAt
                                ? ` · Quét ${new Date(src.lastFetchedAt).toLocaleTimeString('vi-VN')}`
                                : ''}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => onToggleSource(src.id)}
                              className={`rounded-xl border px-2 py-0.5 text-[11px] font-medium cursor-pointer ${
                                src.enabled
                                  ? 'border-emerald-700/40 bg-emerald-50 text-emerald-900 dark:border-emerald-600/40 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  : 'border-slate-300 text-slate-500 dark:border-slate-700 dark:text-slate-400'
                              }`}
                            >
                              {src.enabled ? 'Bật' : 'Tắt'}
                            </button>
                            <button
                              type="button"
                              disabled={fetching}
                              onClick={() => void runFetchSingleSource(src)}
                              className="rounded-xl border border-slate-300 p-1 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                              title="Quét riêng nguồn này"
                            >
                              {isThisFetching ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* 3. Smart Domain/Keyword Auto-Discovery + Live Crawler Logs */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left 6 cols: Smart Discovery & Active Custom Sources/Keywords */}
            <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-6 dark:border-slate-800 dark:bg-slate-900">
              <div>
                <h2 className="flex items-center gap-2 font-sans tracking-tight text-xl font-semibold text-slate-900 dark:text-slate-100">
                  <Compass className="h-4 w-4 text-amber-900 dark:text-amber-400" />
                  <span>Khám phá Nguồn Thông minh (Zero-Config)</span>
                </h2>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  Chỉ cần nhập <strong>tên miền</strong> (vd: <code>baodautu.vn</code>, <code>cafebiz.vn</code>) hoặc <strong>từ khóa</strong> (vd: <code>Giá vàng SJC</code>, <code>Lãi suất Fed</code>). Bot tự dò RSS, sitemap hoặc sinh luồng Google News RSS.
                </p>
              </div>

              <form onSubmit={handleSmartDiscover} className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={smartInput}
                    onChange={(e) => setSmartInput(e.target.value)}
                    placeholder="Nhập tên miền (baodautu.vn) hoặc từ khóa (Giá vàng SJC)..."
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <button
                  type="submit"
                  disabled={discovering}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-60 dark:bg-amber-600 cursor-pointer whitespace-nowrap"
                >
                  {discovering ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  <span>Tự khám phá nguồn</span>
                </button>
              </form>

              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-slate-500">Thử nhanh:</span>
                {['baodautu.vn', 'cafebiz.vn', 'Giá vàng SJC', 'Bán dẫn Việt Nam'].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => setSmartInput(sample)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700 hover:border-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 cursor-pointer"
                  >
                    {sample}
                  </button>
                ))}
              </div>

              {discoverError && (
                <p className="text-xs text-red-700 dark:text-red-400">{discoverError}</p>
              )}

              {discoveryResult && (
                <div className="rounded-xl border border-amber-800/30 bg-emerald-50/50 p-3.5 space-y-2.5 dark:border-amber-700/40 dark:bg-slate-900">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                      {discoveryResult.message}
                    </span>
                    <button
                      type="button"
                      onClick={handleAddAllDiscovered}
                      className="rounded-xl bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 cursor-pointer"
                    >
                      + Kích hoạt tất cả vào Bot
                    </button>
                  </div>

                  <div className="max-h-40 space-y-1.5 overflow-y-auto">
                    {discoveryResult.discoveredFeeds.map((feed) => {
                      const exists = sources.some(
                        (s) => s.url.toLowerCase() === feed.url.toLowerCase()
                      );
                      return (
                        <div
                          key={feed.url}
                          className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate dark:text-slate-100">
                              {feed.name}
                            </p>
                            <p className="font-mono text-[10px] text-slate-500 truncate">
                              {feed.url}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={exists}
                            onClick={() => handleAddDiscoveredFeed(feed, discoveryResult.resolvedType === 'keyword')}
                            className={`rounded-xl border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${
                              exists
                                ? 'border-slate-200 text-slate-400 dark:border-slate-800'
                                : 'border-slate-300 text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 cursor-pointer'
                            }`}
                          >
                            {exists ? '✓ Đã thêm' : '+ Thêm'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Active Custom Keywords */}
              {botCustomKeywords.length > 0 && (
                <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Từ khóa Bot đang theo dõi tự động ({botCustomKeywords.length})
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {botCustomKeywords.map((kw) => (
                      <span
                        key={kw}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-800/30 bg-amber-50 px-2 py-0.5 text-xs text-amber-950 dark:border-amber-700/40 dark:bg-amber-950/40 dark:text-amber-200"
                      >
                        <span>{kw}</span>
                        <button
                          type="button"
                          onClick={() => onRemoveBotKeyword(kw)}
                          className="text-amber-800 hover:text-red-700 dark:text-amber-300 cursor-pointer"
                          aria-label={`Xóa từ khóa ${kw}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Active Discovered / Watchlist / All Sources List */}
              <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-800 dark:bg-slate-950">
                    <button
                      type="button"
                      onClick={() => setSourceListTab('custom')}
                      className={`rounded-xl px-2 py-0.5 text-[11px] font-medium cursor-pointer ${
                        sourceListTab === 'custom'
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Tự dò &amp; Watchlist ({customAndWatchlistSources.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSourceListTab('all')}
                      className={`rounded-xl px-2 py-0.5 text-[11px] font-medium cursor-pointer ${
                        sourceListTab === 'all'
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Tất cả kênh ({sources.length})
                    </button>
                  </div>
                  <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                    {enabledSources.length}/{sources.length} bật
                  </span>
                </div>

                {displayedManagedSources.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Chưa có nguồn tự dò riêng — Bot đang chạy toàn bộ {sources.length} kênh chính thống trong 7 gói chuyên mục phía trên.
                  </p>
                ) : (
                  <div className="mt-2 max-h-60 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                    {displayedManagedSources.map((src) => {
                      const isThisFetching = fetching && fetchingSourceId === src.id;
                      const originTag =
                        src.origin === 'watchlist'
                          ? 'Watchlist'
                          : src.origin === 'keyword'
                            ? 'Từ khóa'
                            : src.origin === 'discovered'
                              ? 'Tự dò'
                              : src.origin === 'custom'
                                ? 'Ghim riêng'
                                : 'Chính thống';
                      return (
                        <div
                          key={src.id}
                          className="flex items-center justify-between gap-2 py-2 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <Rss className="h-3 w-3 shrink-0 text-amber-800 dark:text-amber-400" />
                              <span
                                className={`font-medium truncate ${
                                  src.enabled
                                    ? 'text-slate-900 dark:text-slate-100'
                                    : 'text-slate-400 line-through'
                                }`}
                              >
                                {src.name}
                              </span>
                              <span className="rounded-xl border border-slate-200 px-1.5 py-0 font-mono text-[10px] text-slate-500 dark:border-slate-700 dark:text-slate-400 shrink-0">
                                {originTag}
                              </span>
                            </div>
                            <p className="truncate font-mono text-[10px] text-slate-400">
                              {src.domain} · {src.defaultCategory}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => onToggleSource(src.id)}
                              className={`rounded-xl border px-2 py-0.5 text-[11px] cursor-pointer ${
                                src.enabled
                                  ? 'border-emerald-700/40 text-emerald-800 dark:text-emerald-400'
                                  : 'border-slate-300 text-slate-500 dark:border-slate-700'
                              }`}
                            >
                              {src.enabled ? 'Bật' : 'Tắt'}
                            </button>
                            <button
                              type="button"
                              disabled={fetching}
                              onClick={() => void runFetchSingleSource(src)}
                              className="rounded-xl border border-slate-300 p-1 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                              title="Quét riêng nguồn này"
                            >
                              {isThisFetching ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3 w-3" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => onRemoveSource(src.id)}
                              className="p-1 text-slate-400 hover:text-red-700 cursor-pointer"
                              aria-label={`Xóa nguồn ${src.name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right 6 cols: Live Crawler Logs Console */}
            <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 lg:col-span-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
                <div>
                  <h2 className="flex items-center gap-2 font-sans tracking-tight text-xl font-semibold text-slate-900 dark:text-slate-100">
                    <Terminal className="h-4 w-4 text-amber-900 dark:text-amber-400" />
                    <span>Nhật ký Quét Trực tiếp (Live Crawler Logs)</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Theo dõi từng nguồn Bot vừa chạm, số tin mới, mã cổ phiếu nhận diện và tin trùng bị chặn.
                  </p>
                </div>
                {botCrawlerLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearBotLogs}
                    className="rounded-xl border border-slate-300 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Xóa log
                  </button>
                )}
              </div>

              <div className="mt-4 flex-1 max-h-[420px] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] leading-relaxed tabular-nums dark:border-slate-800 dark:bg-slate-950">
                {botCrawlerLogs.length === 0 ? (
                  <div className="py-12 text-center font-sans text-xs text-slate-500 dark:text-slate-400">
                    Chưa có nhật ký quét nào trong phiên. Nhấn <strong>&ldquo;Quét Toàn Bộ Ngay&rdquo;</strong> để xem Bot hoạt động theo thời gian thực.
                  </div>
                ) : (
                  <ul className="space-y-1.5">
                    {botCrawlerLogs.map((log) => (
                      <li
                        key={log.id}
                        className={`border-b border-slate-200/60 pb-1.5 last:border-b-0 dark:border-slate-800/60 ${
                          log.status === 'error'
                            ? 'text-red-700 dark:text-red-400'
                            : log.newCount > 0 || log.updatedCount > 0
                              ? 'text-emerald-800 dark:text-emerald-300'
                              : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {log.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>

          {/* 4. Fetched / Discovered Articles Stream */}
          <section className="pt-2">
            {fetchError && (
              <div className="mb-4 rounded-xl border border-red-800/30 bg-red-50/70 p-4 text-xs text-red-900 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-200">
                {fetchError}
              </div>
            )}

            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
              <div>
                <h2 className="font-sans tracking-tight text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  Tin tức Bot vừa thu thập ({displayedArticles.length})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Mọi bài viết mới đã được kiểm tra qua DedupBot và lưu tự động vào Kho Tin.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {manualFetchArticles && (
                  <button
                    type="button"
                    onClick={() => setManualFetchArticles(null)}
                    className="rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Xem luồng Bot toàn mạng
                  </button>
                )}

                <select
                  value={filterSourceName}
                  onChange={(e) => setFilterSourceName(e.target.value)}
                  aria-label="Lọc theo nguồn trang"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <option value="all">Tất cả nguồn ({availableArticleSources.length})</option>
                  {availableArticleSources.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1 rounded-xl border border-slate-300 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-900/90">
                  {[
                    { id: 'all', label: 'Tất cả' },
                    { id: 'Tích cực', label: 'Tích cực' },
                    { id: 'Trung lập', label: 'Trung lập' },
                    { id: 'Tiêu cực', label: 'Tiêu cực' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setFilterSentiment(opt.id)}
                      className={`rounded-xl px-2.5 py-1 text-xs font-medium cursor-pointer whitespace-nowrap ${
                        filterSentiment === opt.id
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {displayedArticles.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
                {botScanning
                  ? 'Bot đang quét đồng thời các nguồn tin & lọc trùng qua DedupBot...'
                  : 'Chưa có bài viết mới nào trong luồng hiển thị. Nhấn "Quét Toàn Bộ Ngay" để Bot thu thập dữ liệu.'}
              </div>
            ) : (
              <div className="divide-y divide-slate-200 border-b border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {displayedArticles.slice(0, 40).map((art) => (
                  <article
                    key={art.id}
                    className="grid grid-cols-1 gap-6 py-5 lg:grid-cols-12"
                  >
                    <div className="lg:col-span-8 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
                          <Globe className="h-3 w-3 text-slate-400" />
                          {art.sourceName}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{art.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{art.publishedRelative}</span>
                        <span aria-hidden="true">·</span>
                        <SentimentLabel label={art.sentimentLabel} />
                        {art.dedupStatus === 'updated' && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-medium text-amber-800 dark:text-amber-400">
                              Cập nhật nội dung mới
                            </span>
                          </>
                        )}
                      </div>

                      <h3 className="font-sans tracking-tight text-xl font-semibold leading-snug text-slate-900 dark:text-slate-100">
                        <a
                          href={art.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group inline-flex items-baseline gap-1.5 hover:text-amber-900 dark:hover:text-amber-400 transition-colors"
                        >
                          <span>{art.title}</span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60 group-hover:opacity-100" />
                        </a>
                      </h3>

                      {art.summary && (
                        <p className="line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                          {art.summary}
                        </p>
                      )}
                    </div>

                    <div className="lg:col-span-4 flex flex-col justify-between gap-3 border-t border-slate-200/70 pt-3 lg:border-t-0 lg:pt-0 dark:border-slate-800/70">
                      <SentimentBar sentiment={art.sentiment} compact />

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            onAnalyzeArticleUrl(
                              art.url,
                              art.title,
                              art.sourceName,
                              art.category
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-900 hover:text-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-100 dark:hover:text-slate-900 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <FileSearch className="h-3.5 w-3.5" />
                          <span>Phân tích nội dung</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => runCrawlArticle(art.url)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Trích xuất trang</span>
                        </button>

                        <a
                          href={art.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 whitespace-nowrap ml-auto"
                        >
                          <span>Mở gốc</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* SUBMODE 2: DIRECT ARTICLE CRAWLER (behitek/news-crawler style) */}
      {subMode === 'crawler' && (
        <div className="mt-8 space-y-8">
          <form onSubmit={handleCrawlSubmit} className="max-w-3xl space-y-3">
            <label
              htmlFor="direct-crawl-url"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Nhập đường dẫn URL bài báo bất kỳ để thu thập toàn bộ dữ liệu (Tiêu đề, Ngày đăng, Từ khóa, Ảnh &amp; Nội dung)
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="direct-crawl-url"
                type="url"
                required
                value={crawlUrlInput}
                onChange={(e) => setCrawlUrlInput(e.target.value)}
                placeholder="https://vnexpress.net/... hoặc đường dẫn bài báo bất kỳ"
                className="flex-1 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={crawling}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-5 py-2.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {crawling ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Đang thu thập &amp; phân tích...</span>
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" />
                    <span>Thu thập bài viết</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {crawlError && (
            <div className="border border-red-800/30 bg-red-50/70 p-4 text-xs text-red-900 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-200">
              {crawlError}
            </div>
          )}

          {crawling && (
            <div className="py-16 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-700 dark:text-slate-300" />
              <p className="mt-3 font-sans tracking-tight text-lg text-slate-900 dark:text-slate-100">
                Đang tải HTML bài báo, bóc tách nội dung, từ khóa và chạy phân tích...
              </p>
            </div>
          )}

          {crawledArticle && !crawling && (
            <div className="grid grid-cols-1 gap-10 border-t border-slate-200 pt-8 lg:grid-cols-12 dark:border-slate-800">
              {/* Left 70%: Extracted Article Body */}
              <article className="lg:col-span-8 space-y-6">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {crawledArticle.sourceDomain}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{crawledArticle.publishedDate}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {crawledArticle.wordCount} từ
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>Phương thức: {crawledArticle.crawlMethod}</span>
                </div>

                <h2 className="font-sans tracking-tight text-3xl font-semibold leading-tight text-slate-900 dark:text-slate-100">
                  {crawledArticle.title}
                </h2>

                {crawledArticle.keywords.length > 0 && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Từ khóa bài viết: {crawledArticle.keywords.join(' · ')}
                  </p>
                )}

                {crawledArticle.topImage && !crawlImageFailed && (
                  <div className="overflow-hidden bg-slate-200 dark:bg-slate-800">
                    <img
                      src={crawledArticle.topImage}
                      alt={crawledArticle.title}
                      referrerPolicy="no-referrer"
                      onError={() => setCrawlImageFailed(true)}
                      className="max-h-96 w-full object-cover"
                    />
                  </div>
                )}

                <div className="space-y-4 text-[15px] leading-relaxed text-slate-800 dark:text-slate-200 max-w-prose">
                  {crawledArticle.contentParagraphs.map((para, idx) => (
                    <p key={idx}>{para}</p>
                  ))}
                </div>
              </article>

              {/* Right 30%: Automated NLP Results */}
              <aside className="lg:col-span-4 space-y-6">
                {crawledArticle.nlpAnalysis && (
                  <>
                    <div className="border border-slate-200 bg-slate-50/90 p-5 dark:border-slate-800 dark:bg-slate-900/90">
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        Phân loại tự động
                      </p>
                      <p className="mt-2 font-sans tracking-tight text-2xl font-semibold text-slate-900 dark:text-slate-100">
                        {crawledArticle.nlpAnalysis.classification.primaryCategory}
                      </p>
                      <p className="mt-1 font-mono text-xs tabular-nums text-amber-900 dark:text-amber-400">
                        Độ tin cậy {crawledArticle.nlpAnalysis.classification.confidencePercent}%
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                        {crawledArticle.nlpAnalysis.classification.rationale}
                      </p>
                    </div>

                    <div className="border border-slate-200 p-5 dark:border-slate-800">
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        Tóm tắt &amp; Điểm chính
                      </p>
                      <p className="mt-2.5 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                        {crawledArticle.nlpAnalysis.summary.conciseSummary}
                      </p>
                      <ul className="mt-3 space-y-2 border-t border-slate-200 pt-3 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:text-slate-300">
                        {crawledArticle.nlpAnalysis.summary.keyPoints.map((pt, idx) => (
                          <li key={idx}>
                            <span className="font-mono text-slate-400 mr-1.5">0{idx + 1}.</span>
                            {pt}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="border border-slate-200 p-5 dark:border-slate-800 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        Module cảm xúc
                      </p>
                      <div className="text-base">
                        <SentimentLabel label={crawledArticle.nlpAnalysis.sentiment.label} />
                      </div>
                      <SentimentBar sentiment={crawledArticle.nlpAnalysis.sentiment.scores} />
                      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                        {crawledArticle.nlpAnalysis.sentiment.explanation}
                      </p>
                    </div>
                  </>
                )}

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => onDeepAnalyzeArticleUrl(crawledArticle.url)}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-xs font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 cursor-pointer"
                  >
                    <span>Kiểm chứng &amp; Phân tích đa góc nhìn</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                  <a
                    href={crawledArticle.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <span>Mở bài gốc trên trình duyệt</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </aside>
            </div>
          )}
        </div>
      )}

      {/* SUBMODE 3: PUBLIC APIS DIRECTORY & LIVE JSON NEWS CONNECTORS (public-apis) */}
      {subMode === 'public-apis' && (
        <div className="mt-8 space-y-8">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between dark:border-slate-800">
            <div className="space-y-1.5">
              <h2 className="font-sans tracking-tight text-2xl font-semibold text-slate-900 dark:text-slate-100">
                Danh mục API Công Khai (Public APIs)
              </h2>
              <p className="max-w-2xl text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Chọn lọc các API tin tức, khoa học công nghệ và phân tích văn bản mở. Các nguồn đánh dấu không cần key có thể kết nối trực tiếp để lấy link bài viết và chạy phân tích nội dung ngay.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={catalogCategory}
                onChange={(e) => setCatalogCategory(e.target.value)}
                aria-label="Lọc danh mục Public API"
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                {['Tất cả', 'Tin tức', 'Khoa học & Công nghệ', 'Dữ liệu mở', 'Phân tích văn bản'].map(
                  (cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  )
                )}
              </select>

              <button
                type="button"
                onClick={() => setOnlyKeyless((prev) => !prev)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium cursor-pointer whitespace-nowrap ${
                  onlyKeyless
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                    : 'border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                }`}
              >
                {onlyKeyless ? '✓ Chỉ hiện API không cần key' : 'Chỉ hiện API không cần key'}
              </button>
            </div>
          </div>

          {/* GDELT keyword box */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border border-slate-200 bg-slate-50/90 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/90">
            <label
              htmlFor="gdelt-query-input"
              className="text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap"
            >
              Từ khóa truy vấn GDELT DOC 2.0:
            </label>
            <input
              id="gdelt-query-input"
              type="text"
              value={gdeltQuery}
              onChange={(e) => setGdeltQuery(e.target.value)}
              placeholder="Vietnam OR economy OR AI"
              className="flex-1 max-w-md rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Public APIs Directory Table */}
          <div className="overflow-x-auto border-t border-b border-slate-200 dark:border-slate-800">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-300 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="py-3 pr-4 font-medium">Tên API &amp; Mô tả</th>
                  <th className="py-3 px-3 font-medium whitespace-nowrap">Nhóm</th>
                  <th className="py-3 px-3 font-medium whitespace-nowrap">Xác thực</th>
                  <th className="py-3 px-3 font-medium whitespace-nowrap">HTTPS / CORS</th>
                  <th className="py-3 pl-3 text-right font-medium whitespace-nowrap">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {catalogItems
                  .filter((item) => {
                    const matchCat =
                      catalogCategory === 'Tất cả' || item.category === catalogCategory;
                    const matchAuth = !onlyKeyless || item.auth === 'Không cần key';
                    return matchCat && matchAuth;
                  })
                  .map((api) => {
                    const alreadyAdded = Boolean(
                      api.endpointUrl &&
                        sources.some(
                          (s) => s.url.toLowerCase() === api.endpointUrl!.toLowerCase()
                        )
                    );
                    const isFetchingThis =
                      Boolean(api.liveProviderId) &&
                      loadingPublicApi === api.liveProviderId;

                    return (
                      <tr key={api.id} className="align-top">
                        <td className="py-4 pr-4">
                          <a
                            href={api.docsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-sans tracking-tight text-base font-semibold text-slate-900 hover:text-amber-900 dark:text-slate-100 dark:hover:text-amber-400"
                          >
                            <span>{api.name}</span>
                            <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                          </a>
                          <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400 max-w-xl">
                            {api.description}
                          </p>
                        </td>
                        <td className="py-4 px-3 text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {api.category}
                        </td>
                        <td className="py-4 px-3 text-xs whitespace-nowrap">
                          <span
                            className={`font-medium ${
                              api.auth === 'Không cần key'
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {api.auth}
                          </span>
                        </td>
                        <td className="py-4 px-3 font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {api.https ? 'HTTPS' : 'HTTP'} / {api.cors}
                        </td>
                        <td className="py-4 pl-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-2">
                            {api.liveProviderId ? (
                              <>
                                <button
                                  type="button"
                                  disabled={loadingPublicApi !== null}
                                  onClick={() => handleRunPublicApi(api.liveProviderId!)}
                                  className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 cursor-pointer"
                                >
                                  {isFetchingThis ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-3.5 w-3.5" />
                                  )}
                                  <span>Lấy link tin ngay</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={alreadyAdded}
                                  onClick={() => handleAddPublicApiSource(api)}
                                  className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                                    alreadyAdded
                                      ? 'border-slate-200 text-slate-400 dark:border-slate-800 dark:text-slate-600 cursor-default'
                                      : 'border-slate-300 text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer'
                                  }`}
                                >
                                  {alreadyAdded ? '✓ Đã thêm nguồn' : '+ Thêm nguồn'}
                                </button>
                              </>
                            ) : (
                              <a
                                href={api.docsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                              >
                                <span>Tài liệu API</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {publicApiError && (
            <div className="border border-red-800/30 bg-red-50/70 p-4 text-xs text-red-900 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-200">
              {publicApiError}
            </div>
          )}

          {loadingPublicApi && (
            <div className="py-12 text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-700 dark:text-slate-300" />
              <p className="mt-3 font-sans tracking-tight text-lg text-slate-900 dark:text-slate-100">
                Đang truy xuất dữ liệu trực tiếp từ Public API &amp; chuẩn hóa phân loại...
              </p>
            </div>
          )}

          {publicApiFeed && !loadingPublicApi && (
            <section className="space-y-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-sans tracking-tight text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Kết quả từ {publicApiFeed.statuses[0]?.sourceName} ({publicApiFeed.articles.length} link)
                </h3>
                <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  Phương thức: {publicApiFeed.statuses[0]?.method}
                </span>
              </div>

              {publicApiFeed.botReport && (
                <div className="flex items-center gap-2 border border-slate-200 bg-slate-50/90 px-4 py-2.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-300">
                  <ShieldCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                  <span>
                    Bot rà soát {publicApiFeed.botReport.totalScanned} tin:{' '}
                    {publicApiFeed.botReport.newCount} mới ·{' '}
                    {publicApiFeed.botReport.updatedCount} cập nhật nội dung ·{' '}
                    {publicApiFeed.botReport.skippedDuplicateCount} trùng lặp đã bỏ qua
                  </span>
                </div>
              )}

              <div className="divide-y divide-slate-200 border-t border-b border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {publicApiFeed.articles.map((art) => (
                  <div
                    key={art.id}
                    className="grid grid-cols-1 gap-4 py-4 lg:grid-cols-12 lg:items-center"
                  >
                    <div className="lg:col-span-8 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {art.sourceName}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{art.category}</span>
                        <span aria-hidden="true">·</span>
                        <SentimentLabel label={art.sentimentLabel} />
                      </div>
                      <a
                        href={art.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group inline-flex items-baseline gap-1.5 font-sans tracking-tight text-lg font-semibold text-slate-900 hover:text-amber-900 dark:text-slate-100 dark:hover:text-amber-400"
                      >
                        <span>{art.title}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60 group-hover:opacity-100" />
                      </a>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {art.url}
                      </p>
                    </div>

                    <div className="lg:col-span-4 flex flex-wrap items-center justify-end gap-3">
                      <div className="w-40">
                        <SentimentBar sentiment={art.sentiment} compact />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onAnalyzeArticleUrl(
                            art.url,
                            art.title,
                            art.sourceName,
                            art.category
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-900 hover:text-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-100 dark:hover:text-slate-900 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <FileSearch className="h-3.5 w-3.5" />
                        <span>Phân tích nội dung</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}
