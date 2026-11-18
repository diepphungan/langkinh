import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import type {
  AiRecommendationResponse,
  AiSuggestedSource,
  AnomalyRadarResponse,
  AutoDiscoveryScanResponse,
  AutoFetchIntervalMinutes,
  BotAuditEntry,
  CorporateEventsResponse,
  CrawlerLogEntry,
  DedupBotReport,
  DeepAnalysisReport,
  ErraticMoversResponse,
  ExistingArticleFingerprint,
  FetchedSourceArticle,
  FinanceAlertItem,
  FinanceOverviewResponse,
  FinanceRuntimeSettingsStatus,
  FinanceTaggedArticle,
  GeographicRegion,
  NewsCategoryId,
  NewsDigestResponse,
  NewsroomCategoryBucket,
  NewsroomDatePreset,
  NewsroomEdition,
  NewsroomFeedResponse,
  NewsroomViewMode,
  NewsSourceConfig,
  NewsStory,
  PersistentSourcesState,
  ReadingHistoryEntry,
  SentimentVerdict,
  SourceFetchResponse,
  SourcesSyncBadgeStatus,
  StockPredictionResponse,
  StoredArticleStatus,
  StoredNewsArticle,
  TopicPackId,
  VolatilityCollectionResponse,
  VolatilityScopeId,
  WatchlistAiHealthResponse,
  WatchlistItemConfig,
  WatchlistPortfolioStrategyResponse,
  WatchlistScanResponse,
  WebhookChannelsStatus,
} from './types/news';
import { auth, googleProvider } from './firebase';
import {
  batchUpdateArticleTagsInFirestore,
  deleteArticleFromFirestore,
  deleteFinanceAlertFromFirestore,
  deleteWatchlistItemFromFirestore,
  makeSafeArticleDocId,
  markFinanceAlertReadInFirestore,
  saveFinanceAlertsToFirestore,
  saveNewsroomEditionToFirestore,
  saveStoredArticlesBatchToFirestore,
  saveWatchlistBatchToFirestore,
  subscribeFetchedArticles,
  subscribeFinanceAlerts,
  subscribeNewsroomEditions,
  subscribeUserNewsSources,
  subscribeWatchlistItems,
  syncUserNewsSourcesToFirestore,
  updateArticleInFirestore,
  upsertFetchedArticlesToFirestore,
  upsertWatchlistItemToFirestore,
} from './lib/firestoreNewsDb';
import {
  DEFAULT_ACTIVE_TOPIC_PACKS,
  DEFAULT_SEED_SOURCES,
  buildGoogleNewsDynamicRssUrl,
  canonicalizeSourceUrl,
  ensureSeedChannelsPresent,
  mergeSourcesStates,
  normalizeNewsSourceList,
  normalizeScanInterval,
  normalizeTopicPackIds,
} from './lib/defaultSeedSources';
import { extractArticleTags, sanitizeTagList } from './lib/articleAutoTagger';
import { TopBar, type ActiveTab } from './components/TopBar';
import { UtilityRibbon } from './components/UtilityRibbon';
import { DigestDashboardView } from './components/DigestDashboardView';
import { AiIntelligencePanel } from './components/AiIntelligencePanel';
import { ArticleAnalysisModal } from './components/ArticleAnalysisModal';
import { NewsSourcesView } from './components/NewsSourcesView';
import { NewsDatabaseView } from './components/NewsDatabaseView';
import { NewsPipelineView } from './components/NewsPipelineView';
import { CustomAnalyzerView } from './components/CustomAnalyzerView';
import { SavedDossierView } from './components/SavedDossierView';
import { StoryDossierModal } from './components/StoryDossierModal';
import { FinanceWorkspaceView } from './components/FinanceWorkspaceView';
import { FinanceSettingsModal } from './components/FinanceSettingsModal';
import { StockPredictionModal } from './components/StockPredictionModal';

const STORAGE_STORIES_KEY = 'langkinh_saved_stories_v1';
const STORAGE_REPORTS_KEY = 'langkinh_saved_reports_v1';
const STORAGE_SOURCES_KEY = 'langkinh_news_sources_v1';
const STORAGE_SOURCES_META_KEY = 'langkinh_news_sources_meta_v1';
const STORAGE_HISTORY_KEY = 'langkinh_reading_history_v1';
const STORAGE_THEME_KEY = 'langkinh_theme_v1';
const STORAGE_LOCAL_DB_KEY = 'langkinh_fetched_db_v1';
const STORAGE_AUTOFETCH_ENABLED_KEY = 'langkinh_autofetch_enabled_v1';
const STORAGE_AUTOFETCH_INTERVAL_KEY = 'langkinh_autofetch_interval_v1';
const STORAGE_DEDUP_BOT_ENABLED_KEY = 'langkinh_dedup_bot_enabled_v1';
const STORAGE_BOT_AUDIT_KEY = 'langkinh_bot_audit_v1';
const STORAGE_AUTO_VOLATILITY_KEY = 'langkinh_auto_volatility_v1';
const STORAGE_LOCAL_WATCHLIST_KEY = 'langkinh_watchlist_v1';
const STORAGE_LOCAL_ALERTS_KEY = 'langkinh_finance_alerts_v1';
const STORAGE_BOT_PACKS_KEY = 'langkinh_bot_packs_v1';
const STORAGE_BOT_KEYWORDS_KEY = 'langkinh_bot_keywords_v1';
const STORAGE_BOT_LOGS_KEY = 'langkinh_bot_logs_v1';

const STARTER_WATCHLIST_DATE = '2026-01-01T00:00:00.000Z';
const INITIAL_STARTER_WATCHLIST: WatchlistItemConfig[] = [
  {
    symbol: 'SSI',
    exchange: 'HOSE',
    companyName: 'Chứng khoán SSI',
    priceChangeThresholdPct: 3,
    targetPrice: 0,
    stopLossPrice: 0,
    newsSensitivity: 'all',
    notes: '',
    createdAt: STARTER_WATCHLIST_DATE,
    updatedAt: STARTER_WATCHLIST_DATE,
  },
  {
    symbol: 'FPT',
    exchange: 'HOSE',
    companyName: 'Tập đoàn FPT',
    priceChangeThresholdPct: 2.5,
    targetPrice: 0,
    stopLossPrice: 0,
    newsSensitivity: 'all',
    notes: '',
    createdAt: STARTER_WATCHLIST_DATE,
    updatedAt: STARTER_WATCHLIST_DATE,
  },
  {
    symbol: 'VCB',
    exchange: 'HOSE',
    companyName: 'Ngân hàng Vietcombank',
    priceChangeThresholdPct: 2.5,
    targetPrice: 0,
    stopLossPrice: 0,
    newsSensitivity: 'bearish',
    notes: '',
    createdAt: STARTER_WATCHLIST_DATE,
    updatedAt: STARTER_WATCHLIST_DATE,
  },
  {
    symbol: 'HPG',
    exchange: 'HOSE',
    companyName: 'Tập đoàn Hòa Phát',
    priceChangeThresholdPct: 3,
    targetPrice: 0,
    stopLossPrice: 0,
    newsSensitivity: 'all',
    notes: '',
    createdAt: STARTER_WATCHLIST_DATE,
    updatedAt: STARTER_WATCHLIST_DATE,
  },
];

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

interface BootSourcesSnapshot {
  hadSavedLocalData: boolean;
  updatedAt: string;
  sources: NewsSourceConfig[];
  activeTopicPacks: TopicPackId[];
  customKeywords: string[];
  botAutoScanEnabled: boolean;
  autoFetchInterval: AutoFetchIntervalMinutes;
}

function makeSourcesStateSignature(state: {
  sources: NewsSourceConfig[];
  activeTopicPacks: TopicPackId[];
  customKeywords: string[];
  botAutoScanEnabled: boolean;
  autoFetchInterval: number;
}): string {
  const sortedPacks = [...state.activeTopicPacks].sort();
  const sortedKw = [...state.customKeywords].map((k) => k.trim()).sort();
  const sortedSources = state.sources
    .map((s) => `${s.id}|${canonicalizeSourceUrl(s.url)}|${s.enabled ? 1 : 0}|${s.name}|${s.packId || ''}|${s.origin || ''}`)
    .sort();
  return JSON.stringify([
    sortedPacks,
    sortedKw,
    Boolean(state.botAutoScanEnabled),
    normalizeScanInterval(state.autoFetchInterval),
    sortedSources,
  ]);
}

function readInitialBootSourcesSnapshot(): BootSourcesSnapshot {
  let hadSavedSources = false;
  let parsedSources: NewsSourceConfig[] = [];
  let updatedAt = new Date().toISOString();

  try {
    const rawMeta = localStorage.getItem(STORAGE_SOURCES_META_KEY);
    if (rawMeta) {
      const meta = JSON.parse(rawMeta) as { updatedAt?: string; version?: number };
      if (typeof meta?.updatedAt === 'string' && meta.updatedAt.length > 0) {
        updatedAt = meta.updatedAt;
        hadSavedSources = true;
      }
    }
    const rawSourcesStr = localStorage.getItem(STORAGE_SOURCES_KEY);
    if (rawSourcesStr) {
      const normalized = normalizeNewsSourceList(JSON.parse(rawSourcesStr));
      if (normalized.length > 0) {
        hadSavedSources = true;
        // Ensure all 35+ official seed channels exist cleanly when upgrading from old 3-preset list
        const isLegacySmallSeed =
          normalized.length <= 8 &&
          normalized.every((s) => s.id.startsWith('default-src-') || s.origin === 'discovered');
        parsedSources = ensureSeedChannelsPresent(normalized, isLegacySmallSeed);
      }
    }
  } catch {
    // fallback to clean seed below
  }

  const finalSources =
    parsedSources.length > 0 ? parsedSources : DEFAULT_SEED_SOURCES.map((s) => ({ ...s }));

  const rawPacks = readStorage<unknown>(STORAGE_BOT_PACKS_KEY, null);
  const activeTopicPacks = rawPacks
    ? normalizeTopicPackIds(rawPacks)
    : [...DEFAULT_ACTIVE_TOPIC_PACKS];

  const rawKeywords = readStorage<unknown>(STORAGE_BOT_KEYWORDS_KEY, []);
  const customKeywords = Array.isArray(rawKeywords)
    ? rawKeywords.filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
    : [];

  let botAutoScanEnabled = true;
  try {
    const rawEnabled = localStorage.getItem(STORAGE_AUTOFETCH_ENABLED_KEY);
    if (rawEnabled !== null) {
      botAutoScanEnabled = Boolean(JSON.parse(rawEnabled));
    }
  } catch {
    botAutoScanEnabled = true;
  }

  const savedInterval = readStorage<number>(STORAGE_AUTOFETCH_INTERVAL_KEY, 15);
  const autoFetchInterval = normalizeScanInterval(savedInterval);

  return {
    hadSavedLocalData: hadSavedSources,
    updatedAt,
    sources: finalSources,
    activeTopicPacks,
    customKeywords,
    botAutoScanEnabled,
    autoFetchInterval,
  };
}

function canonicalizeUrlClient(rawUrl: string): string {
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
    const p = u.pathname.replace(/\/+$/, '') || '/';
    return `${host}${p}${qs ? `?${qs}` : ''}`;
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

function normalizeTitleClient(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function App() {
  const bootSourcesRef = useRef<BootSourcesSnapshot | null>(null);
  if (!bootSourcesRef.current) {
    bootSourcesRef.current = readInitialBootSourcesSnapshot();
  }
  const bootSources = bootSourcesRef.current;

  const [activeTab, setActiveTab] = useState<ActiveTab>('feed');
  const [selectedCategory, setSelectedCategory] = useState<NewsCategoryId>('tong-hop');
  const [activeQuery, setActiveQuery] = useState<string>('');
  const [prioritizeCustomSources, setPrioritizeCustomSources] = useState<boolean>(false);

  const [digest, setDigest] = useState<NewsDigestResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedStory, setSelectedStory] = useState<NewsStory | null>(null);
  const [analyzingArticleTarget, setAnalyzingArticleTarget] = useState<{
    url: string;
    title?: string;
  } | null>(null);
  const [selectedReportForAnalyzer, setSelectedReportForAnalyzer] =
    useState<DeepAnalysisReport | null>(null);
  const [pendingAnalyzerUrl, setPendingAnalyzerUrl] = useState<{
    url: string;
    nonce: number;
  } | null>(null);
  const [pendingFinanceTechnicalSymbol, setPendingFinanceTechnicalSymbol] = useState<{
    symbol: string;
    nonce: number;
  } | null>(null);

  const [newsSources, setNewsSources] = useState<NewsSourceConfig[]>(bootSources.sources);
  const [savedStories, setSavedStories] = useState<NewsStory[]>(() =>
    readStorage<NewsStory[]>(STORAGE_STORIES_KEY, [])
  );
  const [savedReports, setSavedReports] = useState<DeepAnalysisReport[]>(() =>
    readStorage<DeepAnalysisReport[]>(STORAGE_REPORTS_KEY, [])
  );
  const [readingHistory, setReadingHistory] = useState<ReadingHistoryEntry[]>(() =>
    readStorage<ReadingHistoryEntry[]>(STORAGE_HISTORY_KEY, [])
  );

  // Firebase Auth & Persistent Kho Tin State
  const [user, setUser] = useState<User | null>(null);
  const [cloudArticles, setCloudArticles] = useState<StoredNewsArticle[]>([]);
  const [loadingCloud, setLoadingCloud] = useState<boolean>(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [localArticles, setLocalArticles] = useState<StoredNewsArticle[]>(() => {
    const raw = readStorage<StoredNewsArticle[]>(STORAGE_LOCAL_DB_KEY, []);
    return raw.map((art) =>
      Array.isArray(art.tags) && art.tags.length > 0
        ? art
        : {
            ...art,
            tags: extractArticleTags({
              title: art.title,
              summary: art.summary,
              keyTakeaway: art.keyTakeaway,
              category: art.category,
            }),
          }
    );
  });

  // Auto-Fetch Scheduler State
  const [autoFetchEnabled, setAutoFetchEnabled] = useState<boolean>(
    bootSources.botAutoScanEnabled
  );
  const [autoFetchInterval, setAutoFetchInterval] = useState<AutoFetchIntervalMinutes>(
    bootSources.autoFetchInterval
  );
  const [autoFetchRunning, setAutoFetchRunning] = useState<boolean>(false);
  const [lastAutoFetchAt, setLastAutoFetchAt] = useState<string | null>(null);
  const [nextAutoFetchAt, setNextAutoFetchAt] = useState<number | null>(null);
  const [lastAutoFetchSummary, setLastAutoFetchSummary] = useState<string | null>(null);

  // 3-Layer Sources Sync Status & Refs
  const [sourcesSyncStatus, setSourcesSyncStatus] = useState<SourcesSyncBadgeStatus>({
    diskSaved: false,
    localSaved: true,
    cloudSaved: false,
    cloudSyncing: false,
    lastSavedAt: bootSources.hadSavedLocalData ? bootSources.updatedAt : null,
  });
  const sourcesHydratedRef = useRef<boolean>(false);
  const sourcesUpdatedAtRef = useRef<string>(bootSources.updatedAt);
  const lastDiskSyncedSigRef = useRef<string>('');
  const lastCloudPushedSigRef = useRef<string>('');

  // Dedup & Update Bot State
  const [dedupBotEnabled, setDedupBotEnabled] = useState<boolean>(() =>
    readStorage<boolean>(STORAGE_DEDUP_BOT_ENABLED_KEY, true)
  );
  const [botAuditHistory, setBotAuditHistory] = useState<BotAuditEntry[]>(() =>
    readStorage<BotAuditEntry[]>(STORAGE_BOT_AUDIT_KEY, [])
  );
  const [botSessionStats, setBotSessionStats] = useState<{
    totalScanned: number;
    newCount: number;
    updatedCount: number;
    skippedDuplicateCount: number;
  }>({
    totalScanned: 0,
    newCount: 0,
    updatedCount: 0,
    skippedDuplicateCount: 0,
  });

  // AI Recommendations & Volatility Collector State
  const [recommendations, setRecommendations] = useState<AiRecommendationResponse | null>(null);
  const [recLoading, setRecLoading] = useState<boolean>(false);
  const [recError, setRecError] = useState<string | null>(null);

  const [volatilityResult, setVolatilityResult] =
    useState<VolatilityCollectionResponse | null>(null);
  const [volLoading, setVolLoading] = useState<boolean>(false);
  const [volError, setVolError] = useState<string | null>(null);
  const [volScope, setVolScope] = useState<VolatilityScopeId>('tat-ca');
  const [volKeyword, setVolKeyword] = useState<string>('');
  const [autoCollectVolatility, setAutoCollectVolatility] = useState<boolean>(() =>
    readStorage<boolean>(STORAGE_AUTO_VOLATILITY_KEY, true)
  );

  // Finance, SSI FastConnect & Watchlist State
  const [localWatchlist, setLocalWatchlist] = useState<WatchlistItemConfig[]>(() =>
    readStorage<WatchlistItemConfig[]>(STORAGE_LOCAL_WATCHLIST_KEY, INITIAL_STARTER_WATCHLIST)
  );
  const [cloudWatchlist, setCloudWatchlist] = useState<WatchlistItemConfig[]>([]);
  const [cloudWatchlistLoading, setCloudWatchlistLoading] = useState<boolean>(false);
  const [financeDbError, setFinanceDbError] = useState<string | null>(null);
  const [localAlerts, setLocalAlerts] = useState<FinanceAlertItem[]>(() =>
    readStorage<FinanceAlertItem[]>(STORAGE_LOCAL_ALERTS_KEY, [])
  );
  const [cloudAlerts, setCloudAlerts] = useState<FinanceAlertItem[]>([]);
  const [financeOverview, setFinanceOverview] = useState<FinanceOverviewResponse | null>(null);
  const [financeOverviewLoading, setFinanceOverviewLoading] = useState<boolean>(false);
  const [financeTaggedArticles, setFinanceTaggedArticles] = useState<FinanceTaggedArticle[]>([]);
  const [financeBotReport, setFinanceBotReport] = useState<DedupBotReport | null>(null);
  const [financeLastScannedAt, setFinanceLastScannedAt] = useState<string | null>(null);
  const [financeScanning, setFinanceScanning] = useState<boolean>(false);
  const [financeScanError, setFinanceScanError] = useState<string | null>(null);
  const [financeAiHealth, setFinanceAiHealth] = useState<WatchlistAiHealthResponse | null>(null);
  const [financeAiHealthLoading, setFinanceAiHealthLoading] = useState<boolean>(false);
  const [portfolioStrategy, setPortfolioStrategy] =
    useState<WatchlistPortfolioStrategyResponse | null>(null);
  const [portfolioStrategyLoading, setPortfolioStrategyLoading] = useState<boolean>(false);
  const [financeSettingsStatus, setFinanceSettingsStatus] =
    useState<FinanceRuntimeSettingsStatus | null>(null);
  const [financeSettingsOpen, setFinanceSettingsOpen] = useState<boolean>(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<'ssi' | 'channels'>('ssi');
  const [predictModalSymbol, setPredictModalSymbol] = useState<string | null>(null);
  const [predictModalAutoCashflow, setPredictModalAutoCashflow] = useState<boolean>(false);
  const [predictModalLoading, setPredictModalLoading] = useState<boolean>(false);
  const [predictModalError, setPredictModalError] = useState<string | null>(null);
  const [predictModalData, setPredictModalData] = useState<StockPredictionResponse | null>(null);
  const [anomalyRadar, setAnomalyRadar] = useState<AnomalyRadarResponse | null>(null);
  const [anomalyRadarLoading, setAnomalyRadarLoading] = useState<boolean>(false);
  const [erraticMovers, setErraticMovers] = useState<ErraticMoversResponse | null>(null);
  const [erraticMoversLoading, setErraticMoversLoading] = useState<boolean>(false);
  const [corporateEvents, setCorporateEvents] = useState<CorporateEventsResponse | null>(null);
  const [corporateEventsLoading, setCorporateEventsLoading] = useState<boolean>(false);

  // Editorial Newsroom, Social Trends, Daily Editions & Webhook Channels State
  const [newsroomFeed, setNewsroomFeed] = useState<NewsroomFeedResponse | null>(null);
  const [newsroomLoading, setNewsroomLoading] = useState<boolean>(true);
  const [newsroomSyncing, setNewsroomSyncing] = useState<boolean>(false);
  const [newsroomError, setNewsroomError] = useState<string | null>(null);
  const [socialRefreshing, setSocialRefreshing] = useState<boolean>(false);
  const [newsroomViewMode, setNewsroomViewMode] = useState<NewsroomViewMode>('live');
  const [newsroomDatePreset, setNewsroomDatePreset] =
    useState<NewsroomDatePreset>('latest');
  const [newsroomSelectedDate, setNewsroomSelectedDate] = useState<string>(() =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
  );
  const [newsroomRegion, setNewsroomRegion] = useState<GeographicRegion | 'all'>('all');
  const [newsroomBucket, setNewsroomBucket] =
    useState<NewsroomCategoryBucket | 'all'>('all');
  const [newsroomSentiment, setNewsroomSentiment] =
    useState<SentimentVerdict | 'all'>('all');
  const [activeEdition, setActiveEdition] = useState<NewsroomEdition | null>(null);
  const [cloudEditions, setCloudEditions] = useState<NewsroomEdition[]>([]);
  const [editionLoading, setEditionLoading] = useState<boolean>(false);
  const [editionError, setEditionError] = useState<string | null>(null);
  const [webhookStatus, setWebhookStatus] = useState<WebhookChannelsStatus | null>(null);

  // Auto-Discovery Bot State
  const [activeTopicPacks, setActiveTopicPacks] = useState<TopicPackId[]>(
    bootSources.activeTopicPacks
  );
  const [botCustomKeywords, setBotCustomKeywords] = useState<string[]>(
    bootSources.customKeywords
  );
  const [botCrawlerLogs, setBotCrawlerLogs] = useState<CrawlerLogEntry[]>(() =>
    readStorage<CrawlerLogEntry[]>(STORAGE_BOT_LOGS_KEY, [])
  );
  const [botDiscoveredArticles, setBotDiscoveredArticles] = useState<FetchedSourceArticle[]>([]);
  const [botScanning, setBotScanning] = useState<boolean>(false);
  const [botScanError, setBotScanError] = useState<string | null>(null);
  const [lastBotScanAt, setLastBotScanAt] = useState<string | null>(null);

  const [isDark, setIsDark] = useState<boolean>(() => {
    const stored = readStorage<string | null>(STORAGE_THEME_KEY, null);
    return stored === 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(STORAGE_THEME_KEY, JSON.stringify(isDark ? 'dark' : 'light'));
    } catch {
      // ignore storage errors
    }
  }, [isDark]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_STORIES_KEY, JSON.stringify(savedStories));
    } catch {
      // ignore
    }
  }, [savedStories]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_REPORTS_KEY, JSON.stringify(savedReports));
    } catch {
      // ignore
    }
  }, [savedReports]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SOURCES_KEY, JSON.stringify(newsSources));
    } catch {
      // ignore
    }
  }, [newsSources]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(readingHistory));
    } catch {
      // ignore
    }
  }, [readingHistory]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_LOCAL_DB_KEY, JSON.stringify(localArticles));
    } catch {
      // ignore
    }
  }, [localArticles]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_AUTOFETCH_ENABLED_KEY, JSON.stringify(autoFetchEnabled));
    } catch {
      // ignore
    }
  }, [autoFetchEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_AUTOFETCH_INTERVAL_KEY, JSON.stringify(autoFetchInterval));
    } catch {
      // ignore
    }
  }, [autoFetchInterval]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_DEDUP_BOT_ENABLED_KEY, JSON.stringify(dedupBotEnabled));
    } catch {
      // ignore
    }
  }, [dedupBotEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_BOT_AUDIT_KEY, JSON.stringify(botAuditHistory.slice(0, 120)));
    } catch {
      // ignore
    }
  }, [botAuditHistory]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_AUTO_VOLATILITY_KEY, JSON.stringify(autoCollectVolatility));
    } catch {
      // ignore
    }
  }, [autoCollectVolatility]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_LOCAL_WATCHLIST_KEY, JSON.stringify(localWatchlist));
    } catch {
      // ignore
    }
  }, [localWatchlist]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_LOCAL_ALERTS_KEY, JSON.stringify(localAlerts.slice(0, 80)));
    } catch {
      // ignore
    }
  }, [localAlerts]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_BOT_PACKS_KEY, JSON.stringify(activeTopicPacks));
    } catch {
      // ignore
    }
  }, [activeTopicPacks]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_BOT_KEYWORDS_KEY, JSON.stringify(botCustomKeywords));
    } catch {
      // ignore
    }
  }, [botCustomKeywords]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_BOT_LOGS_KEY, JSON.stringify(botCrawlerLogs.slice(0, 120)));
    } catch {
      // ignore
    }
  }, [botCrawlerLogs]);

  const currentSourcesStateObj = useMemo<PersistentSourcesState>(
    () => ({
      version: 1,
      updatedAt: sourcesUpdatedAtRef.current,
      sources: newsSources,
      activeTopicPacks,
      customKeywords: botCustomKeywords,
      botAutoScanEnabled: autoFetchEnabled,
      autoFetchInterval: normalizeScanInterval(autoFetchInterval),
    }),
    [newsSources, activeTopicPacks, botCustomKeywords, autoFetchEnabled, autoFetchInterval]
  );

  const currentSourcesStateRef = useRef<PersistentSourcesState>(currentSourcesStateObj);
  currentSourcesStateRef.current = currentSourcesStateObj;

  const currentSourcesSignature = useMemo(
    () => makeSourcesStateSignature(currentSourcesStateObj),
    [currentSourcesStateObj]
  );

  const applyResolvedSourcesState = useCallback(
    (nextState: PersistentSourcesState, markUpdatedAt?: string) => {
      const normalizedSources =
        nextState.sources.length > 0
          ? normalizeNewsSourceList(nextState.sources)
          : DEFAULT_SEED_SOURCES.map((s) => ({ ...s }));
      const normalizedPacks = normalizeTopicPackIds(nextState.activeTopicPacks);
      const normalizedKw = Array.isArray(nextState.customKeywords)
        ? nextState.customKeywords.slice(0, 20)
        : [];
      const normalizedInterval = normalizeScanInterval(nextState.autoFetchInterval);
      const updatedIso = markUpdatedAt || nextState.updatedAt || new Date().toISOString();

      sourcesUpdatedAtRef.current = updatedIso;
      setNewsSources(normalizedSources);
      setActiveTopicPacks(normalizedPacks);
      setBotCustomKeywords(normalizedKw);
      setAutoFetchEnabled(Boolean(nextState.botAutoScanEnabled));
      setAutoFetchInterval(normalizedInterval);
    },
    []
  );

  // Layer 2: Immediate localStorage write-through for news sources + config
  useEffect(() => {
    const nowIso = sourcesHydratedRef.current
      ? new Date().toISOString()
      : sourcesUpdatedAtRef.current;
    if (sourcesHydratedRef.current) {
      sourcesUpdatedAtRef.current = nowIso;
    }
    try {
      localStorage.setItem(
        STORAGE_SOURCES_META_KEY,
        JSON.stringify({ updatedAt: nowIso, version: 1 })
      );
    } catch {
      // ignore
    }
    setSourcesSyncStatus((prev) => ({
      ...prev,
      localSaved: true,
      lastSavedAt: nowIso,
    }));
  }, [currentSourcesSignature]);

  // Layer 1 Boot Reconciliation: GET /api/sources <-> localStorage (never clobber user config)
  useEffect(() => {
    let cancelled = false;
    const bootLocal = bootSourcesRef.current!;

    const reconcileOnBoot = async () => {
      try {
        const res = await fetch('/api/sources');
        if (!res.ok) {
          sourcesHydratedRef.current = true;
          return;
        }
        const data = (await res.json()) as {
          state: PersistentSourcesState;
          hadExistingDiskStore: boolean;
        };
        if (cancelled || !data?.state) return;

        const serverState = data.state;
        const localState: PersistentSourcesState = {
          version: 1,
          updatedAt: bootLocal.updatedAt,
          sources: bootLocal.sources,
          activeTopicPacks: bootLocal.activeTopicPacks,
          customKeywords: bootLocal.customKeywords,
          botAutoScanEnabled: bootLocal.botAutoScanEnabled,
          autoFetchInterval: normalizeScanInterval(bootLocal.autoFetchInterval),
        };

        const localTime = new Date(localState.updatedAt || 0).getTime() || 0;
        const serverTime = new Date(serverState.updatedAt || 0).getTime() || 0;

        let finalState: PersistentSourcesState = serverState;

        if (!data.hadExistingDiskStore && bootLocal.hadSavedLocalData) {
          // Server is fresh/empty while client localStorage has saved user config -> restore Backend disk
          const syncRes = await fetch('/api/sources/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: localState, mode: 'replace' }),
          });
          if (syncRes.ok) {
            const syncData = (await syncRes.json()) as { state: PersistentSourcesState };
            finalState = syncData.state || localState;
          } else {
            finalState = localState;
          }
        } else if (bootLocal.hadSavedLocalData && localTime > serverTime + 2000) {
          // Client localStorage has newer edits -> merge & persist cleanly to disk
          const merged = mergeSourcesStates(localState, serverState);
          const syncRes = await fetch('/api/sources/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: merged, mode: 'merge' }),
          });
          if (syncRes.ok) {
            const syncData = (await syncRes.json()) as { state: PersistentSourcesState };
            finalState = syncData.state || merged;
          } else {
            finalState = merged;
          }
        }

        if (cancelled) return;
        const sig = makeSourcesStateSignature(finalState);
        lastDiskSyncedSigRef.current = sig;
        applyResolvedSourcesState(finalState, finalState.updatedAt);
        setSourcesSyncStatus((prev) => ({
          ...prev,
          diskSaved: true,
          localSaved: true,
          lastSavedAt: finalState.updatedAt || new Date().toISOString(),
        }));
      } catch {
        // Fallback smoothly to LocalStorage state if backend temporarily unreachable
      } finally {
        if (!cancelled) {
          sourcesHydratedRef.current = true;
        }
      }
    };

    void reconcileOnBoot();
    return () => {
      cancelled = true;
    };
  }, [applyResolvedSourcesState]);

  // Layer 1 Atomic Write-Through: push changes to server/data/sources_store.json on any mutation
  useEffect(() => {
    if (!sourcesHydratedRef.current) return;
    if (currentSourcesSignature === lastDiskSyncedSigRef.current) return;

    const timer = window.setTimeout(async () => {
      const snapshot: PersistentSourcesState = {
        ...currentSourcesStateRef.current,
        updatedAt: new Date().toISOString(),
      };
      const sig = makeSourcesStateSignature(snapshot);
      try {
        const res = await fetch('/api/sources/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: snapshot, mode: 'replace' }),
        });
        if (res.ok) {
          const data = (await res.json()) as { state?: PersistentSourcesState };
          lastDiskSyncedSigRef.current = sig;
          setSourcesSyncStatus((prev) => ({
            ...prev,
            diskSaved: true,
            lastSavedAt: data.state?.updatedAt || snapshot.updatedAt,
          }));
        }
      } catch {
        // ignore transient network failure; localStorage still holds state
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [currentSourcesSignature]);

  // Layer 3 Cloud Write-Through when user is signed in
  useEffect(() => {
    if (!user || !sourcesHydratedRef.current) return;
    if (currentSourcesSignature === lastCloudPushedSigRef.current) return;

    const timer = window.setTimeout(async () => {
      const snapshot: PersistentSourcesState = {
        ...currentSourcesStateRef.current,
        updatedAt: sourcesUpdatedAtRef.current || new Date().toISOString(),
      };
      const sig = makeSourcesStateSignature(snapshot);
      setSourcesSyncStatus((prev) => ({ ...prev, cloudSyncing: true }));
      try {
        await syncUserNewsSourcesToFirestore(user.uid, snapshot);
        lastCloudPushedSigRef.current = sig;
        setSourcesSyncStatus((prev) => ({
          ...prev,
          cloudSaved: true,
          cloudSyncing: false,
          lastSavedAt: new Date().toISOString(),
        }));
      } catch {
        setSourcesSyncStatus((prev) => ({ ...prev, cloudSyncing: false }));
      }
    }, 700);

    return () => window.clearTimeout(timer);
  }, [user, currentSourcesSignature]);

  // Listen to Firebase Auth state & subscribe Firestore collections (including Layer 3 user_news_sources)
  useEffect(() => {
    let unsubDb: (() => void) | null = null;
    let unsubWatchlist: (() => void) | null = null;
    let unsubAlerts: (() => void) | null = null;
    let unsubEditions: (() => void) | null = null;
    let unsubUserSources: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setCloudError(null);
      if (unsubDb) {
        unsubDb();
        unsubDb = null;
      }
      if (unsubWatchlist) {
        unsubWatchlist();
        unsubWatchlist = null;
      }
      if (unsubAlerts) {
        unsubAlerts();
        unsubAlerts = null;
      }
      if (unsubEditions) {
        unsubEditions();
        unsubEditions = null;
      }
      if (unsubUserSources) {
        unsubUserSources();
        unsubUserSources = null;
      }

      if (currentUser) {
        setLoadingCloud(true);
        setCloudWatchlistLoading(true);
        setFinanceDbError(null);
        setSourcesSyncStatus((prev) => ({ ...prev, cloudSyncing: true }));

        unsubDb = subscribeFetchedArticles(
          currentUser.uid,
          (items) => {
            setCloudArticles(items);
            setLoadingCloud(false);
          },
          (err) => {
            setCloudError(
              err.message.includes('permission')
                ? 'Tài khoản chưa đủ quyền truy cập Kho Tin trên Firestore hoặc email chưa xác thực.'
                : 'Không thể đồng bộ dữ liệu từ Firestore.'
            );
            setLoadingCloud(false);
          }
        );

        unsubWatchlist = subscribeWatchlistItems(
          currentUser.uid,
          (items) => {
            setCloudWatchlist(items);
            setCloudWatchlistLoading(false);
            setFinanceDbError(null);
          },
          (err) => {
            const msg = err.message.toLowerCase();
            setFinanceDbError(
              msg.includes('permission')
                ? 'Chưa đủ quyền đồng bộ Watchlist trên Firestore (kiểm tra email đã xác thực hoặc quy tắc bảo mật Firestore).'
                : 'Không thể tải danh mục Watchlist từ Firestore Cloud lúc này.'
            );
            setCloudWatchlistLoading(false);
          }
        );

        unsubAlerts = subscribeFinanceAlerts(
          currentUser.uid,
          (items) => {
            setCloudAlerts(items);
          },
          (err) => {
            console.warn('Firestore financeAlerts listener warning:', err.message);
          }
        );

        unsubEditions = subscribeNewsroomEditions(
          currentUser.uid,
          (eds) => {
            setCloudEditions(eds);
          },
          (err) => {
            console.warn('Firestore newsroomEditions listener warning:', err.message);
          }
        );

        unsubUserSources = subscribeUserNewsSources(
          currentUser.uid,
          (snapshot) => {
            const localNow = currentSourcesStateRef.current;
            if (!snapshot.hasRemoteConfig) {
              // Cloud empty for this user -> push local/disk configuration up immediately
              void syncUserNewsSourcesToFirestore(currentUser.uid, localNow)
                .then(() => {
                  lastCloudPushedSigRef.current = makeSourcesStateSignature(localNow);
                  setSourcesSyncStatus((prev) => ({
                    ...prev,
                    cloudSaved: true,
                    cloudSyncing: false,
                    lastSavedAt: new Date().toISOString(),
                  }));
                })
                .catch(() => {
                  setSourcesSyncStatus((prev) => ({ ...prev, cloudSyncing: false }));
                });
              return;
            }

            const remoteSig = makeSourcesStateSignature(snapshot.state);
            const localSig = makeSourcesStateSignature(localNow);
            if (remoteSig !== localSig) {
              const merged = mergeSourcesStates(snapshot.state, localNow);
              const mergedSig = makeSourcesStateSignature(merged);
              if (mergedSig === remoteSig) {
                lastCloudPushedSigRef.current = remoteSig;
              }
              applyResolvedSourcesState(merged, merged.updatedAt);
            } else {
              lastCloudPushedSigRef.current = remoteSig;
            }
            setSourcesSyncStatus((prev) => ({
              ...prev,
              cloudSaved: true,
              cloudSyncing: false,
            }));
          },
          () => {
            setSourcesSyncStatus((prev) => ({ ...prev, cloudSyncing: false }));
          }
        );
      } else {
        setCloudArticles([]);
        setCloudWatchlist([]);
        setCloudAlerts([]);
        setCloudEditions([]);
        setLoadingCloud(false);
        setCloudWatchlistLoading(false);
        setFinanceDbError(null);
        lastCloudPushedSigRef.current = '';
        setSourcesSyncStatus((prev) => ({
          ...prev,
          cloudSaved: false,
          cloudSyncing: false,
        }));
      }
    });

    return () => {
      unsubAuth();
      if (unsubDb) unsubDb();
      if (unsubWatchlist) unsubWatchlist();
      if (unsubAlerts) unsubAlerts();
      if (unsubEditions) unsubEditions();
      if (unsubUserSources) unsubUserSources();
    };
  }, [applyResolvedSourcesState]);

  const storedArticles = useMemo(
    () => (user ? cloudArticles : localArticles),
    [user, cloudArticles, localArticles]
  );

  const activeWatchlist = useMemo(
    () => (user ? cloudWatchlist : localWatchlist),
    [user, cloudWatchlist, localWatchlist]
  );

  const activeFinanceAlerts = useMemo(
    () => (user ? cloudAlerts : localAlerts),
    [user, cloudAlerts, localAlerts]
  );

  const unreadAlertsCount = useMemo(
    () => activeFinanceAlerts.filter((a) => !a.read).length,
    [activeFinanceAlerts]
  );

  const localPendingSyncCount = useMemo(() => {
    if (!user || localArticles.length === 0) return 0;
    const cloudUrlSet = new Set(cloudArticles.map((c) => canonicalizeUrlClient(c.url)));
    return localArticles.filter((l) => !cloudUrlSet.has(canonicalizeUrlClient(l.url))).length;
  }, [user, localArticles, cloudArticles]);

  const localWatchlistPendingCount = useMemo(() => {
    if (!user || localWatchlist.length === 0) return 0;
    const cloudSymSet = new Set(cloudWatchlist.map((w) => w.symbol.toUpperCase()));
    return localWatchlist.filter((l) => !cloudSymSet.has(l.symbol.toUpperCase())).length;
  }, [user, localWatchlist, cloudWatchlist]);

  const existingFingerprints = useMemo<ExistingArticleFingerprint[]>(
    () =>
      storedArticles.map((art) => ({
        id: art.id,
        url: art.url,
        title: art.title,
        summary: art.summary,
      })),
    [storedArticles]
  );

  const handleSignInGoogle = async () => {
    setCloudError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setCloudError(
        err instanceof Error
          ? `Đăng nhập Google không thành công (${err.message.slice(0, 80)}).`
          : 'Không thể đăng nhập Google lúc này.'
      );
    }
  };

  const handleSignOutGoogle = async () => {
    try {
      await signOut(auth);
    } catch {
      // ignore
    }
  };

  const handleSyncLocalToCloud = async () => {
    if (!user || localArticles.length === 0) return;
    setCloudError(null);
    const cloudUrlSet = new Set(cloudArticles.map((c) => canonicalizeUrlClient(c.url)));
    const pending = localArticles.filter(
      (l) => !cloudUrlSet.has(canonicalizeUrlClient(l.url))
    );
    if (pending.length === 0) return;
    try {
      await saveStoredArticlesBatchToFirestore(user.uid, pending);
    } catch {
      setCloudError('Có lỗi xảy ra khi đồng bộ bài viết cục bộ lên Firestore.');
    }
  };

  const persistFetchedResult = useCallback(
    async (result: SourceFetchResponse) => {
      // Record Dedup Bot audit decisions
      if (result.botReport) {
        const rep = result.botReport;
        setBotSessionStats((prev) => ({
          totalScanned: prev.totalScanned + rep.totalScanned,
          newCount: prev.newCount + rep.newCount,
          updatedCount: prev.updatedCount + rep.updatedCount,
          skippedDuplicateCount: prev.skippedDuplicateCount + rep.skippedDuplicateCount,
        }));
        if (rep.decisions.length > 0) {
          setBotAuditHistory((prev) => [...rep.decisions, ...prev].slice(0, 120));
        }
      }

      if (result.articles.length === 0) return;

      const methodBySource = new Map<string, string>();
      for (const st of result.statuses) {
        methodBySource.set(st.sourceId, st.method);
      }

      const items = result.articles.map((article) => ({
        article,
        method: methodBySource.get(article.sourceId) || 'RSS/Atom',
      }));

      if (user) {
        try {
          await upsertFetchedArticlesToFirestore(user.uid, items);
        } catch {
          setCloudError('Không thể lưu toàn bộ bài mới vào Firestore Cloud.');
        }
      } else {
        setLocalArticles((prev) => {
          const next = [...prev];
          const urlIndexMap = new Map<string, number>();
          next.forEach((ex, i) => {
            urlIndexMap.set(canonicalizeUrlClient(ex.url), i);
          });

          const nowIso = new Date().toISOString();

          for (const { article, method } of items) {
            if (!article.url || !/^https?:\/\//i.test(article.url)) continue;
            const canon = canonicalizeUrlClient(article.url);
            const existingIdxById = article.existingDocId
              ? next.findIndex((x) => x.id === article.existingDocId)
              : -1;
            const existingIdx =
              existingIdxById !== -1 ? existingIdxById : (urlIndexMap.get(canon) ?? -1);

            if (existingIdx !== -1) {
              const target = next[existingIdx];
              if (article.dedupStatus === 'updated' && target.status !== 'archived') {
                const badge = article.updateReason
                  ? `[Bot cập nhật] ${article.updateReason}`
                  : '[Bot cập nhật] Phát hiện sửa đổi nội dung mới';
                const nextNotes = target.notes.includes(badge)
                  ? target.notes
                  : [badge, target.notes].filter(Boolean).join(' · ').slice(0, 1000);
                const mergedTags = sanitizeTagList([
                  ...(target.tags || []),
                  ...extractArticleTags({
                    title: article.title,
                    summary: article.summary,
                    keyTakeaway: article.keyTakeaway,
                    category: article.category,
                  }),
                ]);
                next[existingIdx] = {
                  ...target,
                  title: article.title,
                  summary: article.summary,
                  keyTakeaway: article.keyTakeaway,
                  category: article.category,
                  sentimentLabel: article.sentimentLabel,
                  sentimentPositive: article.sentiment.positive,
                  sentimentNeutral: article.sentiment.neutral,
                  sentimentNegative: article.sentiment.negative,
                  notes: nextNotes,
                  tags: mergedTags,
                  updatedAt: nowIso,
                };
              }
              continue;
            }

            const newItem: StoredNewsArticle = {
              id: makeSafeArticleDocId(article.url),
              ownerId: 'local',
              title: article.title,
              url: article.url,
              sourceName: article.sourceName,
              sourceDomain: article.sourceDomain,
              category: article.category,
              publishedRelative: article.publishedRelative,
              summary: article.summary,
              keyTakeaway: article.keyTakeaway,
              sentimentLabel: article.sentimentLabel,
              sentimentPositive: article.sentiment.positive,
              sentimentNeutral: article.sentiment.neutral,
              sentimentNegative: article.sentiment.negative,
              fetchedMethod: method,
              notes:
                article.dedupStatus === 'updated' && article.updateReason
                  ? `[Bot cập nhật] ${article.updateReason}`
                  : '',
              tags: extractArticleTags({
                title: article.title,
                summary: article.summary,
                keyTakeaway: article.keyTakeaway,
                category: article.category,
              }),
              status: 'unread',
              createdAt: nowIso,
              updatedAt: nowIso,
              syncedToCloud: false,
            };
            next.unshift(newItem);
            urlIndexMap.set(canon, 0);
          }

          return next.slice(0, 300);
        });
      }
    },
    [user]
  );

  const handleUpdateStoredArticle = async (
    id: string,
    patch: { status?: StoredArticleStatus; notes?: string; tags?: string[] }
  ) => {
    const cleanPatch = {
      ...patch,
      tags: Array.isArray(patch.tags) ? sanitizeTagList(patch.tags) : undefined,
    };
    if (user) {
      await updateArticleInFirestore(user.uid, id, cleanPatch);
    } else {
      setLocalArticles((prev) =>
        prev.map((art) =>
          art.id === id
            ? {
                ...art,
                status: cleanPatch.status ?? art.status,
                notes: typeof cleanPatch.notes === 'string' ? cleanPatch.notes : art.notes,
                tags: Array.isArray(cleanPatch.tags) ? cleanPatch.tags : art.tags,
                updatedAt: new Date().toISOString(),
              }
            : art
        )
      );
    }
  };

  const handleBatchUpdateArticleTags = async (
    updates: Array<{ id: string; tags: string[] }>
  ): Promise<number> => {
    if (updates.length === 0) return 0;
    if (user) {
      return batchUpdateArticleTagsInFirestore(user.uid, updates);
    }
    const updateMap = new Map(updates.map((u) => [u.id, sanitizeTagList(u.tags)]));
    const nowIso = new Date().toISOString();
    setLocalArticles((prev) =>
      prev.map((art) => {
        if (art.status === 'archived') return art;
        const nextTags = updateMap.get(art.id);
        return nextTags ? { ...art, tags: nextTags, updatedAt: nowIso } : art;
      })
    );
    return updates.length;
  };

  const handleDeleteStoredArticle = async (id: string) => {
    if (user) {
      await deleteArticleFromFirestore(user.uid, id);
    } else {
      setLocalArticles((prev) => prev.filter((art) => art.id !== id));
    }
  };

  const handleScanExistingDuplicates = async (): Promise<number> => {
    const seenUrls = new Set<string>();
    const seenTitles = new Set<string>();
    const duplicateIds: string[] = [];

    for (const art of storedArticles) {
      const canon = canonicalizeUrlClient(art.url);
      const normTitle = normalizeTitleClient(art.title);
      if (seenUrls.has(canon) || (normTitle.length > 10 && seenTitles.has(normTitle))) {
        duplicateIds.push(art.id);
      } else {
        seenUrls.add(canon);
        if (normTitle.length > 10) seenTitles.add(normTitle);
      }
    }

    if (duplicateIds.length === 0) return 0;

    if (user) {
      for (const id of duplicateIds) {
        await deleteArticleFromFirestore(user.uid, id);
      }
    } else {
      const dropSet = new Set(duplicateIds);
      setLocalArticles((prev) => prev.filter((a) => !dropSet.has(a.id)));
    }
    return duplicateIds.length;
  };

  // Watchlist & Finance Handlers
  const refreshFinanceSettingsStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/finance/settings');
      if (res.ok) {
        setFinanceSettingsStatus((await res.json()) as FinanceRuntimeSettingsStatus);
      }
    } catch {
      // ignore
    }
  }, []);

  const refreshFinanceOverview = useCallback(async (symbols: string[]) => {
    setFinanceOverviewLoading(true);
    try {
      const { financeTaggedArticles: currTagged, storedArticles: currStored } =
        financeRef.current;
      const res = await fetch('/api/finance/overview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols,
          taggedArticles: currTagged.slice(0, 40),
          storedArticles: currStored.slice(0, 50).map((s) => ({
            title: s.title,
            summary: s.summary,
            sentimentLabel: s.sentimentLabel,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data?.error === 'string'
            ? data.error
            : 'Không thể tải dữ liệu chỉ số và bảng giá thị trường.'
        );
      }
      setFinanceOverview(data as FinanceOverviewResponse);
    } catch (err) {
      setFinanceScanError(
        err instanceof Error
          ? err.message
          : 'Lỗi kết nối máy chủ khi tải dữ liệu thị trường.'
      );
    } finally {
      setFinanceOverviewLoading(false);
    }
  }, []);

  const financeRef = useRef({
    activeWatchlist,
    existingFingerprints,
    dedupBotEnabled,
    persistFetchedResult,
    user,
    financeScanning,
    financeOverview,
    financeTaggedArticles,
    storedArticles,
  });
  financeRef.current = {
    activeWatchlist,
    existingFingerprints,
    dedupBotEnabled,
    persistFetchedResult,
    user,
    financeScanning,
    financeOverview,
    financeTaggedArticles,
    storedArticles,
  };

  const scanWatchlistNow = useCallback(async () => {
    const {
      activeWatchlist: wl,
      existingFingerprints: currFp,
      dedupBotEnabled: botOn,
      persistFetchedResult: persistFn,
      user: currUser,
      financeScanning: busy,
    } = financeRef.current;

    if (busy) return;
    setFinanceScanning(true);
    setFinanceScanError(null);
    try {
      const res = await fetch('/api/finance/watchlist-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          watchlist: wl,
          existingItems: botOn ? currFp : [],
          dedupBotEnabled: botOn,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể quét Watchlist.');
      }
      const parsed = data as WatchlistScanResponse;

      setFinanceOverview({
        fetchedAt: parsed.scannedAt,
        marketDataMode: parsed.marketDataMode,
        warningNote: parsed.warningNote,
        indices: parsed.indices,
        macroQuotes: parsed.macroQuotes,
        quotes: parsed.quotes,
        analytics: parsed.analytics,
      });
      setFinanceTaggedArticles(parsed.taggedArticles);
      setFinanceBotReport(parsed.botReport);
      setFinanceLastScannedAt(parsed.scannedAt);

      if (parsed.fetchedForStorage.length > 0 || parsed.botReport) {
        await persistFn({
          fetchedAt: parsed.scannedAt,
          statuses: parsed.statuses,
          articles: parsed.fetchedForStorage,
          botReport: parsed.botReport,
        });
      }

      if (parsed.alerts.length > 0) {
        if (currUser) {
          await saveFinanceAlertsToFirestore(currUser.uid, parsed.alerts).catch(() => {});
        } else {
          setLocalAlerts((prev) => {
            const existingIds = new Set(prev.map((a) => a.id));
            const newOnes = parsed.alerts.filter((a) => !existingIds.has(a.id));
            return [...newOnes, ...prev].slice(0, 80);
          });
        }
      }
    } catch (err) {
      setFinanceScanError(
        err instanceof Error ? err.message : 'Lỗi kết nối máy chủ khi quét Watchlist.'
      );
    } finally {
      setFinanceScanning(false);
    }
  }, []);

  const formatWatchlistDbError = (err: unknown, fallback: string): string => {
    const raw = err instanceof Error ? err.message : String(err);
    const lower = raw.toLowerCase();
    if (lower.includes('permission') || lower.includes('insufficient')) {
      return 'Firestore từ chối quyền ghi/đọc Watchlist. Vui lòng đảm bảo tài khoản Google đã xác thực email và thử lại.';
    }
    if (lower.includes('offline') || lower.includes('network')) {
      return 'Không thể kết nối tới Firestore Cloud. Kiểm tra kết nối mạng rồi thử lại.';
    }
    if (!raw.startsWith('{')) {
      return raw || fallback;
    }
    return fallback;
  };

  const handleUpsertWatchlistItem = async (item: WatchlistItemConfig) => {
    const cleanSym = item.symbol
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 12);
    if (!cleanSym) {
      throw new Error('Mã cổ phiếu không hợp lệ.');
    }
    setFinanceDbError(null);
    const normalized = { ...item, symbol: cleanSym };
    if (user) {
      try {
        await upsertWatchlistItemToFirestore(user.uid, normalized);
      } catch (err) {
        const msg = formatWatchlistDbError(err, `Không thể lưu mã ${cleanSym} lên Firestore.`);
        setFinanceDbError(msg);
        throw new Error(msg);
      }
    } else {
      setLocalWatchlist((prev) => {
        const idx = prev.findIndex((x) => x.symbol === cleanSym);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = { ...prev[idx], ...normalized };
          return next;
        }
        return [normalized, ...prev];
      });
    }
    void refreshFinanceOverview(
      Array.from(new Set([...activeWatchlist.map((w) => w.symbol), cleanSym]))
    );
  };

  const handleRemoveWatchlistItem = async (symbol: string) => {
    setFinanceDbError(null);
    if (user) {
      try {
        await deleteWatchlistItemFromFirestore(user.uid, symbol);
      } catch (err) {
        const msg = formatWatchlistDbError(err, `Không thể xóa mã ${symbol} trên Firestore.`);
        setFinanceDbError(msg);
        throw new Error(msg);
      }
    } else {
      setLocalWatchlist((prev) => prev.filter((w) => w.symbol !== symbol));
    }
  };

  const handleSyncLocalWatchlistToCloud = async () => {
    if (!user || localWatchlist.length === 0) return;
    setFinanceDbError(null);
    const cloudSymSet = new Set(cloudWatchlist.map((w) => w.symbol.toUpperCase()));
    const pending = localWatchlist.filter((l) => !cloudSymSet.has(l.symbol.toUpperCase()));
    if (pending.length === 0) return;
    try {
      await saveWatchlistBatchToFirestore(user.uid, pending);
      void refreshFinanceOverview(
        Array.from(new Set([...cloudWatchlist.map((w) => w.symbol), ...pending.map((p) => p.symbol)]))
      );
    } catch (err) {
      const msg = formatWatchlistDbError(err, 'Không thể đồng bộ Watchlist cục bộ lên Cloud.');
      setFinanceDbError(msg);
      throw new Error(msg);
    }
  };

  const handleSeedStarterWatchlist = async () => {
    setFinanceDbError(null);
    if (user) {
      try {
        await saveWatchlistBatchToFirestore(user.uid, INITIAL_STARTER_WATCHLIST);
        void refreshFinanceOverview(INITIAL_STARTER_WATCHLIST.map((w) => w.symbol));
      } catch (err) {
        const msg = formatWatchlistDbError(err, 'Không thể nạp danh mục mẫu lên Firestore.');
        setFinanceDbError(msg);
        throw new Error(msg);
      }
    } else {
      setLocalWatchlist((prev) => {
        const existing = new Set(prev.map((w) => w.symbol.toUpperCase()));
        const additions = INITIAL_STARTER_WATCHLIST.filter((s) => !existing.has(s.symbol));
        return [...prev, ...additions];
      });
      void refreshFinanceOverview(INITIAL_STARTER_WATCHLIST.map((w) => w.symbol));
    }
  };

  const handleMarkFinanceAlertRead = async (id: string, read = true) => {
    if (user) {
      await markFinanceAlertReadInFirestore(user.uid, id, read);
    } else {
      setLocalAlerts((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, read, updatedAt: new Date().toISOString() } : a
        )
      );
    }
  };

  const handleMarkAllFinanceAlertsRead = async () => {
    const unread = activeFinanceAlerts.filter((a) => !a.read);
    if (unread.length === 0) return;
    if (user) {
      for (const al of unread) {
        await markFinanceAlertReadInFirestore(user.uid, al.id, true);
      }
    } else {
      const nowIso = new Date().toISOString();
      setLocalAlerts((prev) => prev.map((a) => ({ ...a, read: true, updatedAt: nowIso })));
    }
  };

  const handleDeleteFinanceAlert = async (id: string) => {
    if (user) {
      await deleteFinanceAlertFromFirestore(user.uid, id);
    } else {
      setLocalAlerts((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const handleGenerateWatchlistHealth = async () => {
    setFinanceAiHealthLoading(true);
    setFinanceScanError(null);
    try {
      const res = await fetch('/api/finance/watchlist-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          watchlist: activeWatchlist,
          quotes: financeOverview?.quotes || {},
          taggedArticles: financeTaggedArticles,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data?.error === 'string'
            ? data.error
            : 'Không thể tạo tóm tắt sức khỏe Watchlist bằng AI.'
        );
      }
      setFinanceAiHealth(data as WatchlistAiHealthResponse);
    } catch (err) {
      setFinanceScanError(
        err instanceof Error
          ? err.message
          : 'Lỗi kết nối khi phân tích sức khỏe Watchlist.'
      );
    } finally {
      setFinanceAiHealthLoading(false);
    }
  };

  const handleSynthesizePortfolioStrategy = async (forceRefresh = false) => {
    setPortfolioStrategyLoading(true);
    setFinanceScanError(null);
    try {
      const res = await fetch('/api/finance/watchlist-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          watchlist: activeWatchlist,
          quotes: financeOverview?.quotes || {},
          analytics: financeOverview?.analytics || {},
          taggedArticles: financeTaggedArticles.slice(0, 50),
          storedArticles: storedArticles.slice(0, 60).map((s) => ({
            title: s.title,
            summary: s.summary,
            sentimentLabel: s.sentimentLabel,
          })),
          forceRefresh,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data?.error === 'string'
            ? data.error
            : 'Không thể tổng hợp chiến lược danh mục Watchlist.'
        );
      }
      setPortfolioStrategy(data as WatchlistPortfolioStrategyResponse);
    } catch (err) {
      setFinanceScanError(
        err instanceof Error
          ? err.message
          : 'Lỗi kết nối khi tổng hợp chiến lược danh mục Watchlist.'
      );
    } finally {
      setPortfolioStrategyLoading(false);
    }
  };

  const refreshAnomalyRadar = useCallback(async () => {
    setAnomalyRadarLoading(true);
    try {
      const {
        activeWatchlist: wl,
        financeTaggedArticles: tagged,
      } = financeRef.current;
      const res = await fetch('/api/finance/anomaly-radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols: wl.map((w) => w.symbol),
          taggedArticles: tagged.slice(0, 30),
          storedArticles: storedArticles.slice(0, 40).map((s) => ({
            title: s.title,
            summary: s.summary,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data?.error === 'string'
            ? data.error
            : 'Không thể tải Radar dòng tiền bất thường.'
        );
      }
      setAnomalyRadar(data as AnomalyRadarResponse);
    } catch (err) {
      setFinanceScanError(
        err instanceof Error
          ? err.message
          : 'Lỗi kết nối khi quét Radar dòng tiền bất thường.'
      );
    } finally {
      setAnomalyRadarLoading(false);
    }
  }, [storedArticles]);

  const refreshErraticMovers = useCallback(async (forceRefresh = false) => {
    setErraticMoversLoading(true);
    try {
      const { activeWatchlist: wl } = financeRef.current;
      const res = await fetch('/api/finance/erratic-movers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols: wl.map((w) => w.symbol),
          forceRefresh,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data?.error === 'string'
            ? data.error
            : 'Không thể tải danh sách biến động thất thường trong ngày.'
        );
      }
      setErraticMovers(data as ErraticMoversResponse);
    } catch (err) {
      setFinanceScanError(
        err instanceof Error
          ? err.message
          : 'Lỗi kết nối khi quét cổ phiếu biến động thất thường.'
      );
    } finally {
      setErraticMoversLoading(false);
    }
  }, []);

  const refreshCorporateEvents = useCallback(async (forceRefresh = false) => {
    setCorporateEventsLoading(true);
    try {
      const {
        activeWatchlist: wl,
        existingFingerprints: currFp,
        dedupBotEnabled: botOn,
      } = financeRef.current;
      const res = await fetch('/api/finance/corporate-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          watchlistSymbols: wl.map((w) => w.symbol),
          existingItems: botOn ? currFp : [],
          forceRefresh,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data?.error === 'string'
            ? data.error
            : 'Không thể tải tin ĐHĐCĐ & văn bản nội bộ.'
        );
      }
      setCorporateEvents(data as CorporateEventsResponse);
    } catch (err) {
      setFinanceScanError(
        err instanceof Error
          ? err.message
          : 'Lỗi kết nối khi tải sự kiện ĐHĐCĐ & nội bộ.'
      );
    } finally {
      setCorporateEventsLoading(false);
    }
  }, []);

  const handleOpenStockPrediction = async (symbol: string, autoCashflow = false) => {
    const cleanSym = symbol.trim().toUpperCase();
    if (!cleanSym) return;
    setPredictModalSymbol(cleanSym);
    setPredictModalAutoCashflow(autoCashflow);
    setPredictModalLoading(true);
    setPredictModalError(null);
    setPredictModalData(null);

    const watchItem = activeWatchlist.find((w) => w.symbol === cleanSym);
    const relatedNews = financeTaggedArticles
      .filter((a) => a.matchedTickers.includes(cleanSym))
      .slice(0, 6)
      .map((a) => ({
        title: a.title,
        summary: a.summary,
        impactLabel: a.impactLabel,
        publishedRelative: a.publishedRelative,
        url: a.url,
        sourceName: a.sourceName,
      }));
    const relatedCorpEvents = (corporateEvents?.events || [])
      .filter((e) => e.symbol === cleanSym)
      .slice(0, 10);

    try {
      const res = await fetch('/api/finance/stock-predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: cleanSym,
          watchlistItem: watchItem,
          recentNews: relatedNews,
          corporateEvents: relatedCorpEvents,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể phân tích cổ phiếu.');
      }
      setPredictModalData(data as StockPredictionResponse);
    } catch (err) {
      setPredictModalError(
        err instanceof Error ? err.message : 'Lỗi kết nối phân tích cổ phiếu.'
      );
    } finally {
      setPredictModalLoading(false);
    }
  };

  const activeWatchlistSymbolsKey = useMemo(
    () =>
      activeWatchlist
        .map((w) => w.symbol.toUpperCase())
        .sort()
        .join(','),
    [activeWatchlist]
  );

  // Load Finance Overview, Settings, Anomaly Radar & Corporate Events after Cloud Watchlist hydrates
  useEffect(() => {
    if (activeTab !== 'finance') return;
    if (user && cloudWatchlistLoading) return;
    void refreshFinanceSettingsStatus();
    if (financeTaggedArticles.length === 0 && !financeScanning) {
      void scanWatchlistNow();
    }
    if (!anomalyRadar && !anomalyRadarLoading) {
      void refreshAnomalyRadar();
    }
    if (!erraticMovers && !erraticMoversLoading) {
      void refreshErraticMovers(false);
    }
    if (!corporateEvents && !corporateEventsLoading) {
      void refreshCorporateEvents(false);
    }
  }, [activeTab, user, cloudWatchlistLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch live quotes whenever Watchlist symbols load from Firestore or change while Finance tab is active
  useEffect(() => {
    if (activeTab !== 'finance') return;
    if (user && cloudWatchlistLoading) return;
    const syms = activeWatchlistSymbolsKey ? activeWatchlistSymbolsKey.split(',') : [];
    void refreshFinanceOverview(syms);
  }, [activeTab, user, cloudWatchlistLoading, activeWatchlistSymbolsKey, refreshFinanceOverview]);

  // Sync dynamic Google News RSS streams whenever Watchlist symbols change
  useEffect(() => {
    if (!sourcesHydratedRef.current) return;
    const syms = activeWatchlistSymbolsKey ? activeWatchlistSymbolsKey.split(',') : [];
    if (syms.length === 0) return;

    setNewsSources((prev) => {
      const byUrl = new Set(prev.map((s) => canonicalizeSourceUrl(s.url)));
      const additions: NewsSourceConfig[] = [];
      for (const sym of syms.slice(0, 12)) {
        const rssUrl = buildGoogleNewsDynamicRssUrl(`${sym} chứng khoán`);
        const canon = canonicalizeSourceUrl(rssUrl);
        if (!byUrl.has(canon)) {
          additions.push({
            id: `wl-gnews-${sym.toLowerCase()}`,
            name: `Google News · Watchlist ${sym}`,
            url: rssUrl,
            domain: 'news.google.com',
            defaultCategory: 'Kinh doanh',
            enabled: true,
            addedAt: new Date().toISOString(),
            packId: 'watchlist',
            kind: 'googlenews',
            origin: 'watchlist',
          });
        }
      }
      return additions.length > 0 ? [...prev, ...additions] : prev;
    });
  }, [activeWatchlistSymbolsKey]);

  const enabledSourcesCount = useMemo(
    () => newsSources.filter((s) => s.enabled).length,
    [newsSources]
  );

  const botStateRef = useRef({
    activeTopicPacks,
    activeWatchlist,
    botCustomKeywords,
    newsSources,
    existingFingerprints,
    dedupBotEnabled,
    persistFetchedResult,
    botScanning,
  });
  botStateRef.current = {
    activeTopicPacks,
    activeWatchlist,
    botCustomKeywords,
    newsSources,
    existingFingerprints,
    dedupBotEnabled,
    persistFetchedResult,
    botScanning,
  };

  const runBotScanNow = useCallback(async () => {
    const {
      activeTopicPacks: packs,
      activeWatchlist: wl,
      botCustomKeywords: kws,
      newsSources: srcs,
      existingFingerprints: currFp,
      dedupBotEnabled: botOn,
      persistFetchedResult: persistFn,
      botScanning: busy,
    } = botStateRef.current;

    if (busy) return;
    setBotScanning(true);
    setBotScanError(null);
    try {
      const res = await fetch('/api/bot/scan-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packs,
          watchlistSymbols: wl.map((w) => w.symbol),
          customKeywords: kws,
          customFeeds: srcs
            .filter((s) => s.enabled)
            .map((s) => ({
              name: s.name,
              url: s.url,
              domain: s.domain,
              defaultCategory: s.defaultCategory,
            })),
          existingItems: botOn ? currFp : [],
          dedupBotEnabled: botOn,
          maxFeedsPerRun: 14,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Bot không thể hoàn tất lượt quét nguồn tin.');
      }
      const parsed = data as AutoDiscoveryScanResponse;

      setBotCrawlerLogs((prev) => [...parsed.logs, ...prev].slice(0, 120));
      if (parsed.articles.length > 0) {
        setBotDiscoveredArticles((prev) => {
          const seen = new Set(parsed.articles.map((a) => canonicalizeUrlClient(a.url)));
          const kept = prev.filter((a) => !seen.has(canonicalizeUrlClient(a.url)));
          return [...parsed.articles, ...kept].slice(0, 80);
        });
      }
      if (parsed.taggedArticles.length > 0) {
        setFinanceTaggedArticles((prev) => {
          const seen = new Set(parsed.taggedArticles.map((a) => canonicalizeUrlClient(a.url)));
          const kept = prev.filter((a) => !seen.has(canonicalizeUrlClient(a.url)));
          return [...parsed.taggedArticles, ...kept].slice(0, 60);
        });
      }

      setLastBotScanAt(parsed.scannedAt);
      setLastAutoFetchAt(parsed.scannedAt);
      setLastAutoFetchSummary(
        `Bot quét ${parsed.scannedSourcesCount} nguồn: +${parsed.newCount} mới, ${parsed.updatedCount} cập nhật, chặn ${parsed.skippedDuplicateCount} trùng`
      );

      await persistFn({
        fetchedAt: parsed.scannedAt,
        statuses: parsed.statuses,
        articles: parsed.articles,
        botReport: parsed.botReport,
      });

      // Push live updates immediately into Editorial Newsroom feed
      void fetch(
        `/api/newsroom/feed?datePreset=${encodeURIComponent(newsroomDatePreset)}&date=${encodeURIComponent(newsroomSelectedDate)}&region=${encodeURIComponent(newsroomRegion)}&category=${encodeURIComponent(newsroomBucket)}&sentiment=${encodeURIComponent(newsroomSentiment)}&q=${encodeURIComponent(activeQuery)}`
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((feedData) => {
          if (feedData) setNewsroomFeed(feedData as NewsroomFeedResponse);
        })
        .catch(() => {});
    } catch (err) {
      setBotScanError(err instanceof Error ? err.message : 'Lỗi kết nối Bot quét tin.');
    } finally {
      setBotScanning(false);
    }
  }, [
    newsroomDatePreset,
    newsroomSelectedDate,
    newsroomRegion,
    newsroomBucket,
    newsroomSentiment,
    activeQuery,
  ]);

  // Auto-Fetch trigger using unified Auto-Discovery Bot + Watchlist sync
  const autoFetchStateRef = useRef({
    autoFetchRunning,
  });
  autoFetchStateRef.current = {
    autoFetchRunning,
  };

  const triggerAutoFetchNow = useCallback(async () => {
    if (autoFetchStateRef.current.autoFetchRunning) return;
    setAutoFetchRunning(true);
    try {
      await runBotScanNow();
      if (financeRef.current.activeWatchlist.length > 0) {
        void scanWatchlistNow();
      }
    } finally {
      setAutoFetchRunning(false);
    }
  }, [runBotScanNow, scanWatchlistNow]);

  // Fresh refs for AI Recommendations & Volatility Auto-Collector
  const aiStateRef = useRef({
    selectedCategory,
    activeQuery,
    readingHistory,
    storedArticles,
    newsSources,
    volScope,
    volKeyword,
    existingFingerprints,
    dedupBotEnabled,
    persistFetchedResult,
    volLoading,
    recLoading,
    autoFetchEnabled,
    enabledSourcesCount,
    autoCollectVolatility,
  });
  aiStateRef.current = {
    selectedCategory,
    activeQuery,
    readingHistory,
    storedArticles,
    newsSources,
    volScope,
    volKeyword,
    existingFingerprints,
    dedupBotEnabled,
    persistFetchedResult,
    volLoading,
    recLoading,
    autoFetchEnabled,
    enabledSourcesCount,
    autoCollectVolatility,
  };

  const fetchAiRecommendations = useCallback(async (forceRefresh = false) => {
    const {
      selectedCategory: cat,
      activeQuery: q,
      readingHistory: hist,
      storedArticles: stored,
      newsSources: srcs,
      recLoading: busy,
    } = aiStateRef.current;

    if (busy) return;
    setRecLoading(true);
    setRecError(null);
    try {
      const res = await fetch('/api/ai/recommend-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentCategory: cat,
          activeQuery: q,
          forceRefresh,
          recentTopics: hist.slice(0, 8).map((h) => `${h.category}: ${h.title}`),
          storedHeadlines: stored.slice(0, 8).map((s) => s.title),
          enabledSourceDomains: srcs.filter((s) => s.enabled).map((s) => s.domain),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể tải đề xuất nội dung từ AI.');
      }
      setRecommendations(data as AiRecommendationResponse);
    } catch (err) {
      setRecError(err instanceof Error ? err.message : 'Lỗi kết nối AI đề xuất nội dung.');
    } finally {
      setRecLoading(false);
    }
  }, []);

  const collectVolatilityNow = useCallback(
    async (overrideScope?: VolatilityScopeId, overrideKeyword?: string) => {
      const {
        volScope: currentScope,
        volKeyword: currentKw,
        existingFingerprints: currFingerprints,
        dedupBotEnabled: botOn,
        persistFetchedResult: persistFn,
        volLoading: busy,
      } = aiStateRef.current;

      if (busy) return;
      setVolLoading(true);
      setVolError(null);
      try {
        const res = await fetch('/api/ai/collect-volatility', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            focusScope: overrideScope ?? currentScope,
            customKeyword: overrideKeyword ?? currentKw,
            existingItems: botOn ? currFingerprints : [],
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Không thể thu thập tin biến động từ AI.');
        }
        const parsed = data as VolatilityCollectionResponse;
        setVolatilityResult(parsed);

        await persistFn({
          fetchedAt: parsed.collectedAt,
          statuses: [
            {
              sourceId: 'ai-volatility-radar',
              sourceName: 'AI Radar Biến động',
              method: 'AI Biến động',
              articleCount: parsed.collectedArticles.length,
            },
          ],
          articles: parsed.collectedArticles,
          botReport: parsed.botReport,
        });

        if (!aiStateRef.current.autoFetchEnabled) {
          setLastAutoFetchAt(new Date().toISOString());
          if (parsed.botReport) {
            setLastAutoFetchSummary(
              `AI biến động: +${parsed.botReport.newCount} mới, ${parsed.botReport.updatedCount} cập nhật, bỏ qua ${parsed.botReport.skippedDuplicateCount} trùng`
            );
          }
        }
      } catch (err) {
        setVolError(
          err instanceof Error ? err.message : 'Lỗi kết nối AI thu thập tin biến động.'
        );
      } finally {
        setVolLoading(false);
      }
    },
    []
  );

  // Scheduled Auto-Fetch & AI Volatility Timer Loop
  const activeScheduleSourcesCount = enabledSourcesCount + activeTopicPacks.length;
  useEffect(() => {
    const shouldScheduleRss = autoFetchEnabled && activeScheduleSourcesCount > 0;
    const shouldScheduleVolatility = autoCollectVolatility;

    if (!shouldScheduleRss && !shouldScheduleVolatility) {
      setNextAutoFetchAt(null);
      return;
    }

    const intervalMs = autoFetchInterval * 60 * 1000;
    let cancelled = false;
    let timeoutId: number;

    const scheduleNext = () => {
      if (cancelled) return;
      const targetTime = Date.now() + intervalMs;
      setNextAutoFetchAt(targetTime);
      timeoutId = window.setTimeout(async () => {
        if (cancelled) return;
        if (shouldScheduleRss) {
          await triggerAutoFetchNow();
        }
        if (shouldScheduleVolatility && !cancelled) {
          await collectVolatilityNow();
        }
        scheduleNext();
      }, intervalMs);
    };

    scheduleNext();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    autoFetchEnabled,
    autoFetchInterval,
    activeScheduleSourcesCount,
    autoCollectVolatility,
    triggerAutoFetchNow,
    collectVolatilityNow,
  ]);

  const handleOpenStory = useCallback((story: NewsStory) => {
    setSelectedStory(story);
    setReadingHistory((prev) => {
      const filtered = prev.filter((item) => item.id !== story.id);
      const entry: ReadingHistoryEntry = {
        id: story.id,
        title: story.title,
        category: story.category,
        sourceName: story.sourceOutlets[0] || 'Tổng hợp đa nguồn',
        readAt: new Date().toISOString(),
        story,
      };
      return [entry, ...filtered].slice(0, 25);
    });
  }, []);

  const handleAnalyzeArticleUrl = useCallback(
    (url: string, title?: string, sourceName?: string, category?: string) => {
      setAnalyzingArticleTarget({ url, title });
      setReadingHistory((prev) => {
        const entryId = `link-${url}`;
        const filtered = prev.filter((item) => item.id !== entryId);
        let domainLabel = sourceName || 'Liên kết báo chí';
        if (!sourceName) {
          try {
            domainLabel = new URL(url).hostname.replace(/^www\./, '');
          } catch {
            // keep default
          }
        }
        const entry: ReadingHistoryEntry = {
          id: entryId,
          title: title || url,
          category: category || 'Phân tích bài viết',
          sourceName: domainLabel,
          url,
          readAt: new Date().toISOString(),
        };
        return [entry, ...filtered].slice(0, 25);
      });
    },
    []
  );

  const enabledSourceDomains = useMemo(() => {
    const unique = new Set<string>();
    for (const s of newsSources) {
      if (s.enabled && s.domain) {
        unique.add(s.domain);
      }
    }
    return Array.from(unique);
  }, [newsSources]);

  const fetchDigest = useCallback(
    async (
      category: NewsCategoryId,
      query: string,
      forceRefresh = false,
      preferredDomains: string[] = []
    ) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/news/aggregate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category, query, forceRefresh, preferredDomains }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Không thể tải bản tin tổng hợp.');
        }
        setDigest(data as NewsDigestResponse);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ.');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchDigest(
      selectedCategory,
      activeQuery,
      false,
      prioritizeCustomSources ? enabledSourceDomains : []
    );
  }, [
    selectedCategory,
    activeQuery,
    prioritizeCustomSources,
    enabledSourceDomains,
    fetchDigest,
  ]);

  // Newsroom Live Feed, Social Trends, Editions & Webhook Channels loaders
  const refreshWebhookStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/webhooks');
      if (res.ok) {
        setWebhookStatus((await res.json()) as WebhookChannelsStatus);
      }
    } catch {
      // ignore webhook status fetch failure
    }
  }, []);

  const fetchNewsroomFeed = useCallback(async () => {
    setNewsroomLoading(true);
    setNewsroomError(null);
    try {
      const params = new URLSearchParams({
        datePreset: newsroomDatePreset,
        date: newsroomSelectedDate,
        region: newsroomRegion,
        category: newsroomBucket,
        sentiment: newsroomSentiment,
        q: activeQuery,
        watchlist: activeWatchlistSymbolsKey,
      });
      const res = await fetch(`/api/newsroom/feed?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể tải dòng tin Bản tin.');
      }
      setNewsroomFeed(data as NewsroomFeedResponse);
    } catch (err) {
      setNewsroomError(
        err instanceof Error ? err.message : 'Lỗi tải Bản tin trực tiếp.'
      );
    } finally {
      setNewsroomLoading(false);
    }
  }, [
    newsroomDatePreset,
    newsroomSelectedDate,
    newsroomRegion,
    newsroomBucket,
    newsroomSentiment,
    activeQuery,
    activeWatchlistSymbolsKey,
  ]);

  useEffect(() => {
    if (activeTab === 'feed') {
      void fetchNewsroomFeed();
      void refreshWebhookStatus();
    }
  }, [activeTab, fetchNewsroomFeed, refreshWebhookStatus]);

  const syncNewsroomNow = useCallback(async () => {
    if (newsroomSyncing) return;
    setNewsroomSyncing(true);
    setNewsroomError(null);
    try {
      const {
        activeTopicPacks: packs,
        activeWatchlist: wl,
        botCustomKeywords: kws,
        newsSources: srcs,
        existingFingerprints: currFp,
        dedupBotEnabled: botOn,
        persistFetchedResult: persistFn,
      } = botStateRef.current;

      const res = await fetch('/api/newsroom/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packs,
          watchlistSymbols: wl.map((w) => w.symbol),
          customKeywords: kws,
          customFeeds: srcs
            .filter((s) => s.enabled)
            .map((s) => ({
              name: s.name,
              url: s.url,
              domain: s.domain,
              defaultCategory: s.defaultCategory,
            })),
          existingItems: botOn ? currFp : [],
          dedupBotEnabled: botOn,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể đồng bộ nguồn trang & Mạng xã hội.');
      }
      if (data.feed) {
        setNewsroomFeed(data.feed as NewsroomFeedResponse);
      }
      if (data.scanResult) {
        const parsed = data.scanResult as AutoDiscoveryScanResponse;
        setBotCrawlerLogs((prev) => [...parsed.logs, ...prev].slice(0, 120));
        if (parsed.articles.length > 0) {
          setBotDiscoveredArticles((prev) => {
            const seen = new Set(parsed.articles.map((a) => canonicalizeUrlClient(a.url)));
            const kept = prev.filter((a) => !seen.has(canonicalizeUrlClient(a.url)));
            return [...parsed.articles, ...kept].slice(0, 80);
          });
        }
        setLastBotScanAt(parsed.scannedAt);
        setLastAutoFetchAt(parsed.scannedAt);
        setLastAutoFetchSummary(
          `Đồng bộ Bản tin: +${parsed.newCount} mới, ${parsed.updatedCount} cập nhật, chặn ${parsed.skippedDuplicateCount} trùng`
        );
        await persistFn({
          fetchedAt: parsed.scannedAt,
          statuses: parsed.statuses,
          articles: parsed.articles,
          botReport: parsed.botReport,
        });
      }
    } catch (err) {
      setNewsroomError(
        err instanceof Error ? err.message : 'Lỗi kết nối đồng bộ Bản tin.'
      );
    } finally {
      setNewsroomSyncing(false);
    }
  }, [newsroomSyncing]);

  const refreshSocialTrendsNow = useCallback(async () => {
    setSocialRefreshing(true);
    try {
      const res = await fetch('/api/newsroom/social-trends?refresh=1');
      if (res.ok) {
        await fetchNewsroomFeed();
      }
    } finally {
      setSocialRefreshing(false);
    }
  }, [fetchNewsroomFeed]);

  const fetchEdition = useCallback(
    async (forceRefresh = false) => {
      if (newsroomViewMode === 'live') return;
      const editionType = newsroomViewMode === 'afternoon' ? 'afternoon' : 'morning';
      const targetKey = `${newsroomSelectedDate}_${editionType}`;

      if (!forceRefresh) {
        const cachedCloud = cloudEditions.find((e) => e.editionKey === targetKey);
        if (cachedCloud && cachedCloud.stories.length > 0) {
          setActiveEdition(cachedCloud);
        }
      }

      setEditionLoading(true);
      setEditionError(null);
      try {
        const params = new URLSearchParams({
          date: newsroomSelectedDate,
          type: editionType,
          refresh: forceRefresh ? '1' : '0',
          watchlist: activeWatchlistSymbolsKey,
        });
        const res = await fetch(`/api/newsroom/edition?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Không thể tải Ấn bản định kỳ.');
        }
        const ed = data as NewsroomEdition;
        setActiveEdition(ed);
        if (user && ed.stories.length > 0) {
          void saveNewsroomEditionToFirestore(user.uid, ed).catch(() => {});
        }
      } catch (err) {
        setEditionError(
          err instanceof Error ? err.message : 'Lỗi kết nối tải Ấn bản.'
        );
      } finally {
        setEditionLoading(false);
      }
    },
    [
      newsroomViewMode,
      newsroomSelectedDate,
      activeWatchlistSymbolsKey,
      cloudEditions,
      user,
    ]
  );

  useEffect(() => {
    if (activeTab === 'feed' && newsroomViewMode !== 'live') {
      void fetchEdition(false);
    }
  }, [activeTab, newsroomViewMode, newsroomSelectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendEditionNow = useCallback(
    async (channels: Array<'telegram' | 'lark'>) => {
      const editionType = newsroomViewMode === 'afternoon' ? 'afternoon' : 'morning';
      try {
        const res = await fetch('/api/newsroom/edition/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dateStr: newsroomSelectedDate,
            editionType,
            channels,
            watchlistSymbols: activeWatchlist.map((w) => w.symbol),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          return {
            ok: false,
            message: data.error || 'Không thể gửi Ấn bản qua Bot.',
          };
        }
        if (data.status) {
          setWebhookStatus(data.status as WebhookChannelsStatus);
        }
        if (data.edition) {
          setActiveEdition(data.edition as NewsroomEdition);
        }

        const parts: string[] = [];
        let anyOk = false;
        if (data.telegram?.attempted) {
          parts.push(`Telegram: ${data.telegram.message}`);
          if (data.telegram.ok) anyOk = true;
        }
        if (data.lark?.attempted) {
          parts.push(`Lark: ${data.lark.message}`);
          if (data.lark.ok) anyOk = true;
        }
        if (parts.length === 0) {
          return {
            ok: false,
            message:
              'Chưa cấu hình Telegram Bot hoặc Lark Webhook. Bấm nút "Kết nối Telegram / Lark" để thiết lập.',
          };
        }
        return {
          ok: anyOk,
          message: parts.join(' · '),
        };
      } catch (err) {
        return {
          ok: false,
          message: err instanceof Error ? err.message : 'Lỗi kết nối gửi Bot.',
        };
      }
    },
    [newsroomViewMode, newsroomSelectedDate, activeWatchlist]
  );

  // Staggered initial auto-trigger for AI Recommendations & Volatility Collector after first Digest loads
  const autoAiBootedRef = useRef(false);
  useEffect(() => {
    if (loading || !digest || autoAiBootedRef.current) return;
    autoAiBootedRef.current = true;

    const recTimer = window.setTimeout(() => {
      void fetchAiRecommendations(false);
    }, 900);

    let volTimer: number | undefined;
    if (autoCollectVolatility) {
      volTimer = window.setTimeout(() => {
        void collectVolatilityNow();
      }, 2400);
    }

    return () => {
      window.clearTimeout(recTimer);
      if (volTimer !== undefined) window.clearTimeout(volTimer);
    };
  }, [loading, digest, autoCollectVolatility, fetchAiRecommendations, collectVolatilityNow]);

  // Refresh AI content recommendations smoothly when category/query shifts post-boot (uses server 3m cache when unchanged)
  useEffect(() => {
    if (!autoAiBootedRef.current) return;
    const t = window.setTimeout(() => {
      void fetchAiRecommendations(false);
    }, 600);
    return () => window.clearTimeout(t);
  }, [selectedCategory, activeQuery, fetchAiRecommendations]);

  const handleAddSuggestedSource = useCallback((suggested: AiSuggestedSource) => {
    let domain = 'rss.feed';
    try {
      domain = new URL(suggested.url).hostname.replace(/^www\./, '');
    } catch {
      // fallback domain
    }
    setNewsSources((prev) => {
      const exists = prev.some(
        (s) => s.url.trim().toLowerCase() === suggested.url.trim().toLowerCase()
      );
      if (exists) return prev;
      const newSrc: NewsSourceConfig = {
        id: `ai-src-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: suggested.name,
        url: suggested.url,
        domain,
        defaultCategory: suggested.defaultCategory || 'Tổng hợp',
        enabled: true,
        addedAt: new Date().toISOString(),
      };
      return [newSrc, ...prev];
    });
  }, []);

  const CATEGORY_TO_NEWSROOM_BUCKET: Record<NewsCategoryId, NewsroomCategoryBucket | 'all'> = {
    'tong-hop': 'all',
    'viet-nam': 'Thời sự & Vĩ mô',
    'kinh-te': 'Tài chính & Chứng khoán',
    'cong-nghe': 'Công nghệ & AI',
    'the-gioi': 'Thế giới',
    'khoa-hoc': 'Công nghệ & AI',
  };

  const handleSelectCategory = (cat: NewsCategoryId) => {
    setActiveQuery('');
    setSelectedCategory(cat);
    setNewsroomViewMode('live');
    setNewsroomBucket(CATEGORY_TO_NEWSROOM_BUCKET[cat] ?? 'all');
    if (activeTab !== 'feed') {
      setActiveTab('feed');
    }
  };

  const handleChangeNewsroomBucket = (bucket: NewsroomCategoryBucket | 'all') => {
    setNewsroomBucket(bucket);
    if (bucket === 'all') setSelectedCategory('tong-hop');
    else if (bucket === 'Tài chính & Chứng khoán') setSelectedCategory('kinh-te');
    else if (bucket === 'Công nghệ & AI') setSelectedCategory('cong-nghe');
    else if (bucket === 'Thế giới') setSelectedCategory('the-gioi');
    else if (bucket === 'Thời sự & Vĩ mô') setSelectedCategory('viet-nam');
  };

  const handleSearchQuery = (q: string) => {
    setActiveQuery(q);
    if (activeTab !== 'feed') {
      setActiveTab('feed');
    }
  };

  const handleRefreshDigest = () => {
    setActiveTab('feed');
    fetchDigest(
      selectedCategory,
      activeQuery,
      true,
      prioritizeCustomSources ? enabledSourceDomains : []
    );
  };

  const isStorySaved = (id: string) => savedStories.some((s) => s.id === id);

  const toggleSaveStory = (story: NewsStory) => {
    setSavedStories((prev) =>
      prev.some((s) => s.id === story.id)
        ? prev.filter((s) => s.id !== story.id)
        : [story, ...prev]
    );
  };

  const isReportSaved = (id: string) => savedReports.some((r) => r.id === id);

  const toggleSaveReport = (report: DeepAnalysisReport) => {
    setSavedReports((prev) =>
      prev.some((r) => r.id === report.id)
        ? prev.filter((r) => r.id !== report.id)
        : [report, ...prev]
    );
  };

  const handleDeepAnalyzeFromSource = (url: string) => {
    setPendingAnalyzerUrl({ url, nonce: Date.now() });
    setActiveTab('analyzer');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onRefreshDigest={handleRefreshDigest}
        isRefreshing={loading}
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
        savedCount={savedStories.length + savedReports.length}
        databaseCount={storedArticles.length}
        unreadAlertsCount={unreadAlertsCount}
      />

      {activeTab === 'feed' && (
        <UtilityRibbon
          selectedCategory={selectedCategory}
          onSelectCategory={handleSelectCategory}
          activeQuery={activeQuery}
          onSearchQuery={handleSearchQuery}
          generatedAt={digest?.generatedAt}
        />
      )}

      <div className="flex-1">
        {activeTab === 'feed' && (
          <>
            {/* Custom Source Scope Bar above Quantitative Dashboard */}
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 pt-5 sm:px-6 lg:px-8">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Chế độ hiển thị:{' '}
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  Bản tin Tòa soạn &amp; Đối chiếu Đa nguồn
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs">
                {enabledSourceDomains.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPrioritizeCustomSources((prev) => !prev)}
                    className={`rounded-lg border px-3 py-1.5 font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                      prioritizeCustomSources
                        ? 'border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-slate-950'
                        : 'border-slate-200/80 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
                    }`}
                  >
                    {prioritizeCustomSources
                      ? `✓ Đang ưu tiên ${enabledSourceDomains.length} nguồn đã bật`
                      : `Ưu tiên nguồn đã bật (${enabledSourceDomains.length})`}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActiveTab('sources')}
                  className="font-semibold text-emerald-700 hover:underline underline-offset-4 dark:text-emerald-400 cursor-pointer whitespace-nowrap"
                >
                  + Quản lý Nguồn trang
                </button>
              </div>
            </div>

            <DigestDashboardView
              digest={digest}
              loading={loading}
              error={error}
              onRetry={handleRefreshDigest}
              onOpenStorySummary={handleOpenStory}
              onAnalyzeArticleUrl={handleAnalyzeArticleUrl}
              onToggleSaveStory={toggleSaveStory}
              isStorySaved={isStorySaved}
              onSearchTopic={handleSearchQuery}
              activeQuery={activeQuery}
              newsroomFeed={newsroomFeed}
              newsroomLoading={newsroomLoading}
              newsroomSyncing={newsroomSyncing}
              newsroomError={newsroomError}
              viewMode={newsroomViewMode}
              onChangeViewMode={setNewsroomViewMode}
              datePreset={newsroomDatePreset}
              onChangeDatePreset={setNewsroomDatePreset}
              selectedDate={newsroomSelectedDate}
              onChangeSelectedDate={setNewsroomSelectedDate}
              selectedRegion={newsroomRegion}
              onChangeRegion={setNewsroomRegion}
              selectedBucket={newsroomBucket}
              onChangeBucket={handleChangeNewsroomBucket}
              selectedSentiment={newsroomSentiment}
              onChangeSentiment={setNewsroomSentiment}
              onSyncNewsroomNow={syncNewsroomNow}
              onRefreshSocialTrends={refreshSocialTrendsNow}
              socialRefreshing={socialRefreshing}
              edition={activeEdition}
              editionLoading={editionLoading}
              editionError={editionError}
              onRefreshEdition={fetchEdition}
              onSendEditionNow={sendEditionNow}
              webhookStatus={webhookStatus}
              onOpenWebhookSettings={() => {
                setSettingsInitialTab('channels');
                setFinanceSettingsOpen(true);
              }}
              lastAutoFetchSummary={lastAutoFetchSummary}
              lastAutoFetchAt={lastAutoFetchAt}
              onGoToSources={() => setActiveTab('sources')}
            />

            <AiIntelligencePanel
              recommendations={recommendations}
              recLoading={recLoading}
              recError={recError}
              onRefreshRecommendations={() => void fetchAiRecommendations(true)}
              onSelectTopic={(topicQuery, cat) => {
                if (cat) setSelectedCategory(cat);
                setActiveQuery(topicQuery);
              }}
              onAddSuggestedSource={handleAddSuggestedSource}
              existingSources={newsSources}
              volatilityResult={volatilityResult}
              volLoading={volLoading}
              volError={volError}
              volScope={volScope}
              onChangeVolScope={(nextScope) => {
                setVolScope(nextScope);
                void collectVolatilityNow(nextScope, volKeyword);
              }}
              volKeyword={volKeyword}
              onChangeVolKeyword={setVolKeyword}
              onCollectVolatilityNow={() => void collectVolatilityNow()}
              autoCollectVolatility={autoCollectVolatility}
              onToggleAutoCollectVolatility={() => setAutoCollectVolatility((prev) => !prev)}
              autoFetchInterval={autoFetchInterval}
              onChangeAutoFetchInterval={setAutoFetchInterval}
              nextAutoFetchAt={nextAutoFetchAt}
              onAnalyzeArticleUrl={handleAnalyzeArticleUrl}
              onGoToDatabase={() => setActiveTab('database')}
            />
          </>
        )}

        {activeTab === 'finance' && (
          <FinanceWorkspaceView
            user={user}
            onSignInGoogle={() => void handleSignInGoogle()}
            watchlist={activeWatchlist}
            watchlistLoading={Boolean(user && cloudWatchlistLoading)}
            financeDbError={financeDbError}
            localWatchlistPendingCount={localWatchlistPendingCount}
            onSyncLocalWatchlist={handleSyncLocalWatchlistToCloud}
            onSeedStarterWatchlist={handleSeedStarterWatchlist}
            onUpsertWatchlistItem={handleUpsertWatchlistItem}
            onRemoveWatchlistItem={handleRemoveWatchlistItem}
            alerts={activeFinanceAlerts}
            onMarkAlertRead={handleMarkFinanceAlertRead}
            onMarkAllAlertsRead={handleMarkAllFinanceAlertsRead}
            onDeleteAlert={handleDeleteFinanceAlert}
            overview={financeOverview}
            overviewLoading={financeOverviewLoading}
            taggedArticles={financeTaggedArticles}
            storedArticles={storedArticles}
            lastBotReport={financeBotReport}
            lastScannedAt={financeLastScannedAt}
            scanning={financeScanning}
            scanError={financeScanError}
            onScanNow={() => {
              void scanWatchlistNow();
              void refreshAnomalyRadar();
              void refreshErraticMovers(true);
              void refreshCorporateEvents(false);
            }}
            aiHealth={financeAiHealth}
            aiHealthLoading={financeAiHealthLoading}
            onGenerateAiHealth={() => void handleGenerateWatchlistHealth()}
            portfolioStrategy={portfolioStrategy}
            portfolioStrategyLoading={portfolioStrategyLoading}
            onSynthesizePortfolioStrategy={(force) =>
              void handleSynthesizePortfolioStrategy(force)
            }
            anomalyRadar={anomalyRadar}
            anomalyRadarLoading={anomalyRadarLoading}
            onRefreshAnomalyRadar={() => void refreshAnomalyRadar()}
            erraticMovers={erraticMovers}
            erraticMoversLoading={erraticMoversLoading}
            onRefreshErraticMovers={(force) => void refreshErraticMovers(force)}
            corporateEvents={corporateEvents}
            corporateEventsLoading={corporateEventsLoading}
            onRefreshCorporateEvents={(force) => void refreshCorporateEvents(force)}
            settingsStatus={financeSettingsStatus}
            onOpenSettings={() => {
              setSettingsInitialTab('ssi');
              setFinanceSettingsOpen(true);
            }}
            onOpenPrediction={(sym, autoCashflow) =>
              void handleOpenStockPrediction(sym, autoCashflow)
            }
            onAnalyzeArticleUrl={handleAnalyzeArticleUrl}
            onGoToDatabase={() => setActiveTab('database')}
            initialTechnicalSymbol={pendingFinanceTechnicalSymbol}
          />
        )}

        {activeTab === 'sources' && (
          <NewsSourcesView
            sources={newsSources}
            onAddSource={(src) =>
              setNewsSources((prev) => {
                const canon = canonicalizeSourceUrl(src.url);
                if (prev.some((s) => canonicalizeSourceUrl(s.url) === canon)) {
                  return prev;
                }
                return [
                  {
                    ...src,
                    origin: src.origin || 'discovered',
                    kind:
                      src.kind ||
                      (src.url.includes('news.google.com') ? 'googlenews' : 'rss'),
                  },
                  ...prev,
                ];
              })
            }
            onToggleSource={(id) =>
              setNewsSources((prev) =>
                prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
              )
            }
            onRemoveSource={(id) =>
              setNewsSources((prev) => prev.filter((s) => s.id !== id))
            }
            onAnalyzeArticleUrl={handleAnalyzeArticleUrl}
            onDeepAnalyzeArticleUrl={handleDeepAnalyzeFromSource}
            onApplyToDigest={() => {
              setPrioritizeCustomSources(true);
              setActiveTab('feed');
            }}
            existingFingerprints={existingFingerprints}
            dedupBotEnabled={dedupBotEnabled}
            onPersistFetchedResult={persistFetchedResult}
            botAutoScanEnabled={autoFetchEnabled}
            onToggleBotAutoScan={() => setAutoFetchEnabled((prev) => !prev)}
            autoFetchInterval={autoFetchInterval}
            onChangeInterval={setAutoFetchInterval}
            botScanning={botScanning}
            botScanError={botScanError}
            lastBotScanAt={lastBotScanAt}
            nextBotScanAt={nextAutoFetchAt}
            activeTopicPacks={activeTopicPacks}
            onToggleTopicPack={(packId) =>
              setActiveTopicPacks((prev) =>
                prev.includes(packId)
                  ? prev.filter((p) => p !== packId)
                  : [...prev, packId]
              )
            }
            botCustomKeywords={botCustomKeywords}
            onAddBotKeyword={(kw) => {
              const clean = kw.trim();
              if (!clean) return;
              setBotCustomKeywords((prev) => {
                if (prev.some((x) => x.toLowerCase() === clean.toLowerCase())) {
                  return prev;
                }
                return [clean, ...prev].slice(0, 12);
              });
              const kwUrl = buildGoogleNewsDynamicRssUrl(clean);
              setNewsSources((prev) => {
                const canon = canonicalizeSourceUrl(kwUrl);
                if (prev.some((s) => canonicalizeSourceUrl(s.url) === canon)) {
                  return prev;
                }
                return [
                  {
                    id: `kw-gnews-${Date.now().toString(36)}`,
                    name: `Google News · ${clean}`,
                    url: kwUrl,
                    domain: 'news.google.com',
                    defaultCategory: 'Tổng hợp',
                    enabled: true,
                    addedAt: new Date().toISOString(),
                    packId: 'watchlist',
                    kind: 'googlenews',
                    origin: 'keyword',
                  },
                  ...prev,
                ];
              });
            }}
            onRemoveBotKeyword={(kw) =>
              setBotCustomKeywords((prev) => prev.filter((x) => x !== kw))
            }
            botCrawlerLogs={botCrawlerLogs}
            botDiscoveredArticles={botDiscoveredArticles}
            botSessionStats={botSessionStats}
            watchlistSymbols={activeWatchlist.map((w) => w.symbol)}
            onScanBotAllNow={() => void runBotScanNow()}
            onClearBotLogs={() => setBotCrawlerLogs([])}
            sourcesSyncStatus={sourcesSyncStatus}
            userSignedIn={Boolean(user)}
            onResetDefaultSources={async () => {
              const res = await fetch('/api/sources/reset-defaults', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keepCustomSources: true }),
              });
              if (!res.ok) {
                throw new Error('Không thể khôi phục Bộ Nguồn Tiêu Chuẩn.');
              }
              const data = (await res.json()) as { state: PersistentSourcesState };
              if (data.state) {
                lastDiskSyncedSigRef.current = makeSourcesStateSignature(data.state);
                applyResolvedSourcesState(data.state, data.state.updatedAt);
                setSourcesSyncStatus((prev) => ({
                  ...prev,
                  diskSaved: true,
                  localSaved: true,
                  lastSavedAt: data.state.updatedAt,
                }));
              }
            }}
            onExportSourcesConfig={() => {
              const payload: PersistentSourcesState = {
                ...currentSourcesStateRef.current,
                updatedAt: new Date().toISOString(),
              };
              const blob = new Blob([JSON.stringify(payload, null, 2)], {
                type: 'application/json;charset=utf-8',
              });
              const objectUrl = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = objectUrl;
              link.download = `langkinh_news_sources_backup_${new Date()
                .toISOString()
                .slice(0, 10)}.json`;
              document.body.appendChild(link);
              link.click();
              link.remove();
              URL.revokeObjectURL(objectUrl);
            }}
            onImportSourcesConfig={async (rawPayload) => {
              const obj =
                rawPayload &&
                typeof rawPayload === 'object' &&
                'state' in (rawPayload as Record<string, unknown>)
                  ? (rawPayload as { state: unknown }).state
                  : rawPayload;
              if (!obj || typeof obj !== 'object') {
                return { ok: false, message: 'Cấu trúc tệp JSON sao lưu không hợp lệ.' };
              }
              const rec = obj as Record<string, unknown>;
              const normalizedSources = normalizeNewsSourceList(rec.sources);
              if (normalizedSources.length === 0) {
                return {
                  ok: false,
                  message: 'Tệp JSON không chứa danh sách nguồn trang hợp lệ nào.',
                };
              }
              const importedState: PersistentSourcesState = {
                version: 1,
                updatedAt: new Date().toISOString(),
                sources: normalizedSources,
                activeTopicPacks: Array.isArray(rec.activeTopicPacks)
                  ? normalizeTopicPackIds(rec.activeTopicPacks)
                  : DEFAULT_ACTIVE_TOPIC_PACKS,
                customKeywords: Array.isArray(rec.customKeywords)
                  ? rec.customKeywords
                      .filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
                      .slice(0, 20)
                  : [],
                botAutoScanEnabled:
                  typeof rec.botAutoScanEnabled === 'boolean' ? rec.botAutoScanEnabled : true,
                autoFetchInterval: normalizeScanInterval(rec.autoFetchInterval),
              };
              const res = await fetch('/api/sources/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state: importedState, mode: 'replace' }),
              });
              if (!res.ok) {
                return {
                  ok: false,
                  message: 'Không thể lưu cấu hình khôi phục xuống máy chủ.',
                };
              }
              const data = (await res.json()) as { state: PersistentSourcesState };
              const applied = data.state || importedState;
              lastDiskSyncedSigRef.current = makeSourcesStateSignature(applied);
              applyResolvedSourcesState(applied, applied.updatedAt);
              setSourcesSyncStatus((prev) => ({
                ...prev,
                diskSaved: true,
                localSaved: true,
                lastSavedAt: applied.updatedAt,
              }));
              return {
                ok: true,
                message: `Đã khôi phục thành công ${applied.sources.length} kênh tin và ${applied.activeTopicPacks.length} gói chuyên mục.`,
              };
            }}
          />
        )}

        {activeTab === 'database' && (
          <NewsDatabaseView
            articles={storedArticles}
            loadingCloud={loadingCloud}
            cloudError={cloudError}
            user={user}
            onSignInGoogle={() => void handleSignInGoogle()}
            onSignOutGoogle={() => void handleSignOutGoogle()}
            onSyncLocalToCloud={handleSyncLocalToCloud}
            localPendingSyncCount={localPendingSyncCount}
            onUpdateArticle={handleUpdateStoredArticle}
            onBatchUpdateArticleTags={handleBatchUpdateArticleTags}
            onDeleteArticle={handleDeleteStoredArticle}
            onAnalyzeArticleUrl={handleAnalyzeArticleUrl}
            autoFetchEnabled={autoFetchEnabled}
            onToggleAutoFetch={() => setAutoFetchEnabled((prev) => !prev)}
            autoFetchInterval={autoFetchInterval}
            onChangeInterval={setAutoFetchInterval}
            autoFetchRunning={autoFetchRunning}
            lastAutoFetchAt={lastAutoFetchAt}
            nextAutoFetchAt={nextAutoFetchAt}
            lastAutoFetchSummary={lastAutoFetchSummary}
            enabledSourcesCount={activeScheduleSourcesCount}
            onTriggerAutoFetchNow={() => void triggerAutoFetchNow()}
            onGoToSources={() => setActiveTab('sources')}
            dedupBotEnabled={dedupBotEnabled}
            onToggleDedupBot={() => setDedupBotEnabled((prev) => !prev)}
            botAuditHistory={botAuditHistory}
            botSessionStats={botSessionStats}
            onClearBotAudit={() => {
              setBotAuditHistory([]);
              setBotSessionStats({
                totalScanned: 0,
                newCount: 0,
                updatedCount: 0,
                skippedDuplicateCount: 0,
              });
            }}
            onScanExistingDuplicates={handleScanExistingDuplicates}
            autoCollectVolatility={autoCollectVolatility}
            onToggleAutoCollectVolatility={() => setAutoCollectVolatility((prev) => !prev)}
          />
        )}

        {activeTab === 'pipeline' && (
          <NewsPipelineView
            watchlistSymbols={activeWatchlist.map((w) => w.symbol)}
            enabledSourcesCount={newsSources.filter((s) => s.enabled).length}
            totalSourcesCount={newsSources.length}
            storedArticlesCount={storedArticles.length}
            newsroomCount={newsroomFeed?.totalInArchive || 0}
            unreadAlertsCount={unreadAlertsCount}
            botSessionStats={botSessionStats}
            webhookStatus={webhookStatus}
            onOpenWebhookSettings={() => {
              setSettingsInitialTab('channels');
              setFinanceSettingsOpen(true);
            }}
          />
        )}

        {activeTab === 'analyzer' && (
          <CustomAnalyzerView
            initialReport={selectedReportForAnalyzer}
            pendingUrl={pendingAnalyzerUrl}
            onSaveReport={toggleSaveReport}
            isReportSaved={isReportSaved}
            storedArticles={storedArticles}
            onOpenStockChart={(sym) => {
              setPendingFinanceTechnicalSymbol({ symbol: sym, nonce: Date.now() });
              setActiveTab('finance');
            }}
          />
        )}

        {activeTab === 'saved' && (
          <SavedDossierView
            savedStories={savedStories}
            savedReports={savedReports}
            readingHistory={readingHistory}
            onOpenStory={handleOpenStory}
            onAnalyzeArticleUrl={handleAnalyzeArticleUrl}
            onRemoveStory={(id) =>
              setSavedStories((prev) => prev.filter((s) => s.id !== id))
            }
            onOpenReport={(report) => {
              setSelectedReportForAnalyzer(report);
              setActiveTab('analyzer');
            }}
            onRemoveReport={(id) =>
              setSavedReports((prev) => prev.filter((r) => r.id !== id))
            }
            onClearHistory={() => setReadingHistory([])}
            onGoToFeed={() => setActiveTab('feed')}
          />
        )}
      </div>

      <footer className="mt-16 border-t border-slate-200/80 bg-white py-8 dark:border-slate-800/80 dark:bg-slate-900">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-4 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <div>
            <span className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Lăng Kính
            </span>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Tòa soạn số, phân tích chứng khoán SSI FastConnect &amp; tự động hóa tri thức.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-xs font-medium text-slate-600 dark:text-slate-400">
            <button
              type="button"
              onClick={() => setActiveTab('feed')}
              className="hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
            >
              Bản tin
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('finance')}
              className="hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
            >
              Tài chính
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('database')}
              className="hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
            >
              Kho Tin
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pipeline')}
              className="hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
            >
              Tự động hóa
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('analyzer')}
              className="hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
            >
              Phòng Nghiên cứu
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sources')}
              className="hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
            >
              Nguồn trang
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('saved')}
              className="hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
            >
              Đã lưu
            </button>
          </div>
        </div>
      </footer>

      <StoryDossierModal
        story={selectedStory}
        onClose={() => setSelectedStory(null)}
        onToggleSaveStory={toggleSaveStory}
        isStorySaved={isStorySaved}
        onSaveReport={toggleSaveReport}
        isReportSaved={isReportSaved}
      />

      <ArticleAnalysisModal
        target={analyzingArticleTarget}
        onClose={() => setAnalyzingArticleTarget(null)}
        onSaveReport={toggleSaveReport}
        isReportSaved={isReportSaved}
      />

      <FinanceSettingsModal
        open={financeSettingsOpen}
        onClose={() => setFinanceSettingsOpen(false)}
        initialTab={settingsInitialTab}
        status={financeSettingsStatus}
        onStatusUpdated={(nextStatus) => {
          setFinanceSettingsStatus(nextStatus);
          void refreshFinanceOverview(activeWatchlist.map((w) => w.symbol));
        }}
        webhookStatus={webhookStatus}
        onWebhookStatusUpdated={(nextWebhook) => {
          setWebhookStatus(nextWebhook);
        }}
      />

      <StockPredictionModal
        open={predictModalSymbol !== null}
        loading={predictModalLoading}
        error={predictModalError}
        prediction={predictModalData}
        symbolTitle={predictModalSymbol || ''}
        watchlistItem={
          predictModalSymbol
            ? activeWatchlist.find((w) => w.symbol === predictModalSymbol)
            : undefined
        }
        taggedArticles={financeTaggedArticles}
        storedArticles={storedArticles}
        corporateEvents={corporateEvents?.events || []}
        autoTriggerCashflow={predictModalAutoCashflow}
        onClose={() => {
          setPredictModalSymbol(null);
          setPredictModalAutoCashflow(false);
          setPredictModalData(null);
          setPredictModalError(null);
        }}
        onAnalyzeNewsUrl={(url, title, sourceName) => {
          setPredictModalSymbol(null);
          setPredictModalAutoCashflow(false);
          handleAnalyzeArticleUrl(url, title, sourceName, 'Kinh doanh');
        }}
      />
    </div>
  );
}
