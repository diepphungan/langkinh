import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CandlestickChart,
  Check,
  ChevronRight,
  Cloud,
  CloudOff,
  ExternalLink,
  Flame,
  GitCompare,
  LayoutGrid,
  Newspaper,
  Pencil,
  Plus,
  Radar,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import type {
  AnomalyRadarResponse,
  CashflowAnomalyDirection,
  CorporateEventsResponse,
  DedupBotReport,
  ErraticMoversResponse,
  FinanceAlertItem,
  FinanceAlertSeverity,
  FinanceOverviewResponse,
  FinanceRuntimeSettingsStatus,
  FinanceTaggedArticle,
  MarketExchange,
  NewsSensitivity,
  SsiSecurityItem,
  StockPredictionResponse,
  StoredNewsArticle,
  WatchlistAiHealthResponse,
  WatchlistItemConfig,
  WatchlistPortfolioStrategyResponse,
} from '../types/news';
import { ErraticMoversSection } from './ErraticMoversSection';
import { PeerComparisonSection } from './PeerComparisonSection';
import { PortfolioStrategySection } from './PortfolioStrategySection';
import { StockTechnicalWorkspace } from './StockTechnicalWorkspace';

interface FinanceWorkspaceViewProps {
  user: User | null;
  onSignInGoogle: () => void;
  watchlist: WatchlistItemConfig[];
  watchlistLoading?: boolean;
  financeDbError?: string | null;
  localWatchlistPendingCount?: number;
  onSyncLocalWatchlist?: () => Promise<void>;
  onSeedStarterWatchlist?: () => Promise<void>;
  onUpsertWatchlistItem: (item: WatchlistItemConfig) => Promise<void> | void;
  onRemoveWatchlistItem: (symbol: string) => Promise<void> | void;
  alerts: FinanceAlertItem[];
  onMarkAlertRead: (id: string, read?: boolean) => Promise<void> | void;
  onMarkAllAlertsRead: () => Promise<void> | void;
  onDeleteAlert: (id: string) => Promise<void> | void;
  overview: FinanceOverviewResponse | null;
  overviewLoading: boolean;
  taggedArticles: FinanceTaggedArticle[];
  storedArticles: StoredNewsArticle[];
  lastBotReport: DedupBotReport | null;
  lastScannedAt: string | null;
  scanning: boolean;
  scanError: string | null;
  onScanNow: () => void;
  aiHealth: WatchlistAiHealthResponse | null;
  aiHealthLoading: boolean;
  onGenerateAiHealth: () => void;
  portfolioStrategy: WatchlistPortfolioStrategyResponse | null;
  portfolioStrategyLoading: boolean;
  onSynthesizePortfolioStrategy: (forceRefresh?: boolean) => void;
  anomalyRadar: AnomalyRadarResponse | null;
  anomalyRadarLoading: boolean;
  onRefreshAnomalyRadar: () => void;
  erraticMovers: ErraticMoversResponse | null;
  erraticMoversLoading: boolean;
  onRefreshErraticMovers: (forceRefresh?: boolean) => void;
  corporateEvents: CorporateEventsResponse | null;
  corporateEventsLoading: boolean;
  onRefreshCorporateEvents: (forceRefresh?: boolean) => void;
  settingsStatus: FinanceRuntimeSettingsStatus | null;
  onOpenSettings: () => void;
  onOpenPrediction: (symbol: string, autoCashflow?: boolean) => void;
  onAnalyzeArticleUrl: (url: string, title?: string, sourceName?: string, category?: string) => void;
  onGoToDatabase: () => void;
  initialTechnicalSymbol?: { symbol: string; nonce: number } | null;
}

type FinanceSubTabId = 'overview' | 'technical' | 'radar' | 'peer';

const VN30_QUICK_PICKS = ['SSI', 'FPT', 'VCB', 'HPG', 'MWG', 'TCB', 'MBB', 'VNM', 'VHM', 'DGC'];

const SENSITIVITY_LABELS: Record<NewsSensitivity, string> = {
  bearish: 'Tin tiêu cực',
  bullish: 'Tin tích cực',
  all: 'Mọi tin',
};

const ANOMALY_DIRECTION_LABELS: Record<CashflowAnomalyDirection, string> = {
  accumulation: 'Gom hàng',
  distribution: 'Xả hàng',
  foreign_spike: 'Đột biến Ngoại',
  cfo_divergence: 'Lệch CFO',
};

const SECTOR_GROUPS: string[][] = [
  ['VCB', 'TCB', 'MBB', 'ACB'],
  ['HPG', 'HSG', 'NKG'],
  ['FPT', 'MWG', 'DGW'],
  ['SSI', 'VND', 'VCI', 'HCM'],
];

function getSectorPeersForSymbol(symbol: string): string[] {
  const sym = symbol.trim().toUpperCase();
  const group = SECTOR_GROUPS.find((g) => g.includes(sym));
  if (group) return group;
  return [sym, 'SSI', 'FPT', 'VCB'].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 4);
}

export function FinanceWorkspaceView({
  user,
  onSignInGoogle,
  watchlist,
  watchlistLoading = false,
  financeDbError = null,
  localWatchlistPendingCount = 0,
  onSyncLocalWatchlist,
  onSeedStarterWatchlist,
  onUpsertWatchlistItem,
  onRemoveWatchlistItem,
  alerts,
  onMarkAlertRead,
  onMarkAllAlertsRead,
  onDeleteAlert,
  overview,
  overviewLoading,
  taggedArticles,
  storedArticles,
  lastBotReport,
  lastScannedAt,
  scanning,
  scanError,
  onScanNow,
  aiHealth,
  aiHealthLoading,
  onGenerateAiHealth,
  portfolioStrategy,
  portfolioStrategyLoading,
  onSynthesizePortfolioStrategy,
  anomalyRadar,
  anomalyRadarLoading,
  onRefreshAnomalyRadar,
  erraticMovers,
  erraticMoversLoading,
  onRefreshErraticMovers,
  corporateEvents,
  corporateEventsLoading,
  onRefreshCorporateEvents,
  settingsStatus,
  onOpenSettings,
  onAnalyzeArticleUrl,
  onGoToDatabase,
  initialTechnicalSymbol,
}: FinanceWorkspaceViewProps) {
  const [financeSubTab, setFinanceSubTab] = useState<FinanceSubTabId>('overview');
  const [peerPresetSymbols, setPeerPresetSymbols] = useState<string[] | undefined>(undefined);

  // Sub-Tab 2 Technical Analysis inline state
  const [techSymbol, setTechSymbol] = useState<string>(() => watchlist[0]?.symbol || 'SSI');
  const [techSearchInput, setTechSearchInput] = useState<string>('');
  const [techAutoCashflow, setTechAutoCashflow] = useState<boolean>(false);
  const [techPrediction, setTechPrediction] = useState<StockPredictionResponse | null>(null);
  const [techLoading, setTechLoading] = useState<boolean>(false);
  const [techError, setTechError] = useState<string | null>(null);
  const techFetchNonceRef = useRef(0);

  // Sub-Tab 3 Radar filter
  const [radarDirectionFilter, setRadarDirectionFilter] = useState<'all' | CashflowAnomalyDirection>('all');

  // Watchlist Add / Edit state
  const [securities, setSecurities] = useState<SsiSecurityItem[]>([]);
  const [newSymbol, setNewSymbol] = useState('');
  const [newThreshold, setNewThreshold] = useState('3');
  const [newTargetPrice, setNewTargetPrice] = useState('');
  const [newStopLoss, setNewStopLoss] = useState('');
  const [newSensitivity, setNewSensitivity] = useState<NewsSensitivity>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [addingTicker, setAddingTicker] = useState(false);
  const [syncingWatchlist, setSyncingWatchlist] = useState(false);
  const [addTickerError, setAddTickerError] = useState<string | null>(null);

  const [editingSymbol, setEditingSymbol] = useState<string | null>(null);
  const [editThreshold, setEditThreshold] = useState('3');
  const [editTarget, setEditTarget] = useState('0');
  const [editStopLoss, setEditStopLoss] = useState('0');
  const [editSensitivity, setEditSensitivity] = useState<NewsSensitivity>('all');

  // News & Drawers
  const [newsFilter, setNewsFilter] = useState<'all' | 'watchlist' | 'governance'>('all');
  const [newsTickerFilter, setNewsTickerFilter] = useState<string>('ALL');
  const [alertFilter, setAlertFilter] = useState<'all' | FinanceAlertSeverity>('all');
  const [alertsDrawerOpen, setAlertsDrawerOpen] = useState(false);
  const [aiHealthDrawerOpen, setAiHealthDrawerOpen] = useState(false);
  const [quickStockSymbol, setQuickStockSymbol] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/finance/securities')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data && Array.isArray(data.items)) {
          setSecurities(data.items as SsiSecurityItem[]);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [settingsStatus?.ssiConfigured]);

  useEffect(() => {
    if (watchlist.length > 0 && !techSymbol) {
      setTechSymbol(watchlist[0].symbol);
    }
  }, [watchlist, techSymbol]);

  const loadTechnicalForSymbol = useCallback(
    async (symbol: string) => {
      const cleanSym = symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!cleanSym) return;
      const nonce = ++techFetchNonceRef.current;
      setTechLoading(true);
      setTechError(null);
      try {
        const watchItem = watchlist.find((w) => w.symbol === cleanSym);
        const relatedNews = taggedArticles
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
        const data = await res.json().catch(() => ({}));
        if (techFetchNonceRef.current !== nonce) return;
        if (!res.ok) {
          throw new Error(data.error || `Không thể tải đồ thị kỹ thuật cho ${cleanSym}.`);
        }
        setTechPrediction(data as StockPredictionResponse);
      } catch (err) {
        if (techFetchNonceRef.current !== nonce) return;
        setTechError(
          err instanceof Error ? err.message : 'Lỗi kết nối khi tải đồ thị kỹ thuật.'
        );
      } finally {
        if (techFetchNonceRef.current === nonce) {
          setTechLoading(false);
        }
      }
    },
    [watchlist, taggedArticles, corporateEvents]
  );

  // Trigger fetch when Sub-Tab 2 is active and symbol changes or has no loaded prediction yet
  useEffect(() => {
    if (financeSubTab === 'technical' && techSymbol) {
      if (!techPrediction || techPrediction.symbol !== techSymbol) {
        void loadTechnicalForSymbol(techSymbol);
      }
    }
  }, [financeSubTab, techSymbol]); // eslint-disable-line react-hooks/exhaustive-deps

  const openTechnicalTab = useCallback(
    (symbol: string, autoCashflow = false) => {
      const clean = symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!clean) return;
      setQuickStockSymbol(null);
      setAlertsDrawerOpen(false);
      setTechAutoCashflow(autoCashflow);
      setTechSymbol(clean);
      setFinanceSubTab('technical');
      if (techPrediction?.symbol !== clean) {
        void loadTechnicalForSymbol(clean);
      }
    },
    [techPrediction?.symbol, loadTechnicalForSymbol]
  );

  // Deep-link from Intelligence Lab ("Xem biểu đồ") -> Sub-Tab 2
  useEffect(() => {
    if (initialTechnicalSymbol?.symbol) {
      openTechnicalTab(initialTechnicalSymbol.symbol, false);
    }
  }, [initialTechnicalSymbol?.nonce, initialTechnicalSymbol?.symbol, openTechnicalTab]);

  const unreadAlertsCount = useMemo(
    () => alerts.filter((a) => !a.read).length,
    [alerts]
  );

  const filteredAlerts = useMemo(() => {
    if (alertFilter === 'all') return alerts;
    return alerts.filter((a) => a.severity === alertFilter);
  }, [alerts, alertFilter]);

  const watchlistSymbolSet = useMemo(
    () => new Set(watchlist.map((w) => w.symbol.toUpperCase())),
    [watchlist]
  );

  const filteredNews = useMemo(() => {
    if (newsFilter === 'governance') return [];
    return taggedArticles.filter((art) => {
      if (newsTickerFilter !== 'ALL' && !art.matchedTickers.includes(newsTickerFilter)) {
        return false;
      }
      if (newsFilter === 'watchlist') {
        return art.matchedTickers.some((t) => watchlistSymbolSet.has(t));
      }
      return true;
    });
  }, [taggedArticles, newsFilter, newsTickerFilter, watchlistSymbolSet]);

  const filteredGovernanceForSidebar = useMemo(() => {
    const evs = corporateEvents?.events || [];
    if (newsTickerFilter !== 'ALL') {
      return evs.filter((e) => e.symbol === newsTickerFilter);
    }
    return evs;
  }, [corporateEvents, newsTickerFilter]);

  // HERO BLOCK A: Top 3-4 Hot Alerts combining Watchlist Alerts + 4-Pillar Risks + Anomaly Radar + Erratic Movers
  const heroHotAlerts = useMemo(() => {
    const items: Array<{
      id: string;
      symbol: string;
      severity: 'Khẩn cấp' | 'Cơ hội' | 'Chú ý';
      reason: string;
      metricChip?: string;
      priority: number;
    }> = [];
    const seenSymbols = new Set<string>();

    // 1. Unread critical/opportunity alerts from Watchlist Alerts
    for (const al of alerts) {
      if (al.read) continue;
      if (seenSymbols.has(al.symbol)) continue;
      seenSymbols.add(al.symbol);
      items.push({
        id: `al-${al.id}`,
        symbol: al.symbol,
        severity:
          al.severity === 'critical'
            ? 'Khẩn cấp'
            : al.severity === 'opportunity'
              ? 'Cơ hội'
              : 'Chú ý',
        reason: al.title || al.message,
        metricChip:
          al.changePctSnapshot !== 0
            ? `${al.changePctSnapshot > 0 ? '+' : ''}${al.changePctSnapshot}%`
            : undefined,
        priority: al.severity === 'critical' ? 100 : al.severity === 'opportunity' ? 85 : 70,
      });
    }

    // 2. Risk & technical timing warnings from 4-Pillar Analytics (Breaking MA20 / RSI > 72 / Risk Warning)
    for (const w of watchlist) {
      if (seenSymbols.has(w.symbol)) continue;
      const an = overview?.analytics?.[w.symbol];
      if (!an) continue;
      const rsi = an.timing.rsi14;
      if (an.timing.maPosition === 'below_both') {
        seenSymbols.add(w.symbol);
        items.push({
          id: `risk-ma-${w.symbol}`,
          symbol: w.symbol,
          severity: 'Khẩn cấp',
          reason: an.recommendation.riskWarning || 'Thủng MA20 & MA50, động lượng suy yếu cần theo dõi rủi ro.',
          metricChip: rsi ? `RSI ${rsi}` : 'Dưới MA20/50',
          priority: 92,
        });
      } else if (rsi !== null && rsi >= 72) {
        seenSymbols.add(w.symbol);
        items.push({
          id: `risk-rsi-${w.symbol}`,
          symbol: w.symbol,
          severity: 'Chú ý',
          reason: `RSI(14) đạt ${rsi} vào vùng quá mua ngắn hạn, cân nhắc chốt lời từng phần.`,
          metricChip: `RSI ${rsi}`,
          priority: 78,
        });
      } else if (an.recommendation.totalScore >= 72) {
        seenSymbols.add(w.symbol);
        items.push({
          id: `opp-score-${w.symbol}`,
          symbol: w.symbol,
          severity: 'Cơ hội',
          reason: `Đạt ${an.recommendation.totalScore}/100đ 4 trụ cột · ${an.recommendation.suggestedBuyZone}`,
          metricChip: `${an.liquidity.ma20VolPct}% TB20`,
          priority: 74,
        });
      }
    }

    // 3. Anomaly Cashflow Radar (+Vol%)
    for (const an of anomalyRadar?.anomalies || []) {
      if (seenSymbols.has(an.symbol)) continue;
      seenSymbols.add(an.symbol);
      items.push({
        id: `rad-${an.id}`,
        symbol: an.symbol,
        severity:
          an.severity === 'critical'
            ? 'Khẩn cấp'
            : an.severity === 'opportunity'
              ? 'Cơ hội'
              : 'Chú ý',
        reason: `${ANOMALY_DIRECTION_LABELS[an.direction]}: ${an.detail}`,
        metricChip: `${an.volumeRatio20}x TB20 (${an.changePct > 0 ? '+' : ''}${an.changePct}%)`,
        priority: an.severity === 'critical' ? 88 : 76,
      });
    }

    // 4. Intraday Erratic Movers
    for (const mv of erraticMovers?.movers || []) {
      if (seenSymbols.has(mv.symbol)) continue;
      seenSymbols.add(mv.symbol);
      items.push({
        id: `err-${mv.symbol}`,
        symbol: mv.symbol,
        severity: mv.patternType === 'inverted_v_pullback' ? 'Khẩn cấp' : 'Chú ý',
        reason: `${mv.patternLabel} · Biên độ ${mv.intradayAmplitudePct}% (${mv.amplitudeVsAtrRatio}x ATR)`,
        metricChip: `${mv.changePct > 0 ? '+' : ''}${mv.changePct}%`,
        priority: 72,
      });
    }

    return items.sort((a, b) => b.priority - a.priority).slice(0, 4);
  }, [alerts, watchlist, overview, anomalyRadar, erraticMovers]);

  // HERO BLOCK B: Auto-Synthesized 3-Group Golden Recommendation Board (MUA / GIỮ / BÁN)
  const heroRecommendationBoard = useMemo(() => {
    type BoardEntry = {
      symbol: string;
      score: number;
      entryZone: string;
      tp1: string;
      winRatePct: number;
      note: string;
    };

    const buyList: BoardEntry[] = [];
    const holdList: BoardEntry[] = [];
    const sellList: BoardEntry[] = [];

    for (const w of watchlist) {
      const an = overview?.analytics?.[w.symbol];
      const q = overview?.quotes?.[w.symbol];
      if (!an) continue;

      const score = an.recommendation.totalScore;
      const verdict = an.recommendation.verdict;
      const currentPrice = q?.price || 0;
      const estTp1 =
        w.targetPrice > 0
          ? `${w.targetPrice.toLocaleString('vi-VN')} đ`
          : currentPrice > 0
            ? `${Math.round((currentPrice * 1.1) / 100) * 100} đ`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
            : '+10%';
      const winRate = Math.min(84, Math.max(52, Math.round(50 + (score - 55) * 0.72)));

      const entry: BoardEntry = {
        symbol: w.symbol,
        score,
        entryZone: an.recommendation.suggestedBuyZone || 'Quanh tham chiếu',
        tp1: estTp1,
        winRatePct: winRate,
        note: an.recommendation.reasons[0] || an.timing.maPositionLabel,
      };

      if (verdict === 'MUA MẠNH / TÍCH LŨY' || verdict === 'MUA THĂM DÒ' || score >= 65) {
        buyList.push(entry);
      } else if (verdict === 'NẮM GIỮ / THEO DÕI' || score >= 50) {
        holdList.push(entry);
      } else {
        sellList.push(entry);
      }
    }

    buyList.sort((a, b) => b.score - a.score);
    holdList.sort((a, b) => b.score - a.score);
    sellList.sort((a, b) => a.score - b.score);

    return {
      buyList: buyList.slice(0, 3),
      holdList: holdList.slice(0, 3),
      sellList: sellList.slice(0, 3),
    };
  }, [watchlist, overview]);

  // Top 3 combined hottest signals for Mini Radar Box
  const miniRadarSignals = useMemo(() => {
    const list: Array<{
      id: string;
      symbol: string;
      price: number;
      changePct: number;
      tag: string;
      metricText: string;
      tone: 'bull' | 'bear' | 'warn';
    }> = [];

    for (const an of anomalyRadar?.anomalies || []) {
      list.push({
        id: `an-${an.id}`,
        symbol: an.symbol,
        price: an.price,
        changePct: an.changePct,
        tag: ANOMALY_DIRECTION_LABELS[an.direction],
        metricText: `${an.volumeRatio20}x TB20`,
        tone: an.severity === 'opportunity' ? 'bull' : an.severity === 'critical' ? 'bear' : 'warn',
      });
    }

    for (const mv of erraticMovers?.movers || []) {
      if (list.some((x) => x.symbol === mv.symbol)) continue;
      list.push({
        id: `mv-${mv.symbol}`,
        symbol: mv.symbol,
        price: mv.price,
        changePct: mv.changePct,
        tag: mv.patternLabel,
        metricText: `Biên ${mv.intradayAmplitudePct}% (${mv.amplitudeVsAtrRatio}x ATR)`,
        tone:
          mv.patternType === 'v_shape_reversal'
            ? 'bull'
            : mv.patternType === 'inverted_v_pullback'
              ? 'bear'
              : 'warn',
      });
    }

    return list.slice(0, 3);
  }, [anomalyRadar, erraticMovers]);

  const filteredAnomalies = useMemo(() => {
    const list = anomalyRadar?.anomalies || [];
    if (radarDirectionFilter === 'all') return list;
    return list.filter((a) => a.direction === radarDirectionFilter);
  }, [anomalyRadar, radarDirectionFilter]);

  const handleJumpCompare = (symbol: string) => {
    setQuickStockSymbol(null);
    setPeerPresetSymbols(getSectorPeersForSymbol(symbol));
    setFinanceSubTab('peer');
  };

  const handleAddTicker = async (symbolOverride?: string) => {
    if (addingTicker) return;
    const raw = symbolOverride ?? newSymbol;
    const cleanSym = raw
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 12);

    if (!cleanSym || !/^[A-Z0-9]{1,12}$/.test(cleanSym)) {
      setAddTickerError('Vui lòng nhập mã cổ phiếu hợp lệ (VD: SSI, FPT, VCB, PVS).');
      return;
    }

    const match = securities.find((s) => s.symbol === cleanSym);
    const nowIso = new Date().toISOString();
    const item: WatchlistItemConfig = {
      symbol: cleanSym,
      exchange: (match?.exchange || 'HOSE') as MarketExchange,
      companyName: match?.companyName || cleanSym,
      priceChangeThresholdPct: Math.max(0.5, Math.min(50, Number(newThreshold) || 3)),
      targetPrice: Math.max(0, Math.min(10000000, Number(newTargetPrice) || 0)),
      stopLossPrice: Math.max(0, Math.min(10000000, Number(newStopLoss) || 0)),
      newsSensitivity: newSensitivity,
      notes: '',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    setAddingTicker(true);
    setAddTickerError(null);
    try {
      await onUpsertWatchlistItem(item);
      if (!symbolOverride) {
        setNewSymbol('');
        setNewTargetPrice('');
        setNewStopLoss('');
        setAddOpen(false);
      }
    } catch (err) {
      setAddTickerError(
        err instanceof Error && err.message
          ? err.message
          : `Không thể thêm mã ${cleanSym} vào Watchlist. Vui lòng thử lại.`
      );
    } finally {
      setAddingTicker(false);
    }
  };

  const handleSyncOrSeed = async (action: 'sync' | 'seed') => {
    if (syncingWatchlist) return;
    setSyncingWatchlist(true);
    setAddTickerError(null);
    try {
      if (action === 'sync' && onSyncLocalWatchlist) {
        await onSyncLocalWatchlist();
      } else if (action === 'seed' && onSeedStarterWatchlist) {
        await onSeedStarterWatchlist();
      }
    } catch (err) {
      setAddTickerError(
        err instanceof Error && err.message
          ? err.message
          : 'Không thể đồng bộ danh mục Watchlist lúc này.'
      );
    } finally {
      setSyncingWatchlist(false);
    }
  };

  const startEditRow = (item: WatchlistItemConfig) => {
    setAddTickerError(null);
    setEditingSymbol(item.symbol);
    setEditThreshold(String(item.priceChangeThresholdPct));
    setEditTarget(String(item.targetPrice || 0));
    setEditStopLoss(String(item.stopLossPrice || 0));
    setEditSensitivity(item.newsSensitivity);
  };

  const saveEditRow = async (item: WatchlistItemConfig) => {
    setAddTickerError(null);
    try {
      await onUpsertWatchlistItem({
        ...item,
        priceChangeThresholdPct: Math.max(0.5, Math.min(50, Number(editThreshold) || 3)),
        targetPrice: Math.max(0, Math.min(10000000, Number(editTarget) || 0)),
        stopLossPrice: Math.max(0, Math.min(10000000, Number(editStopLoss) || 0)),
        newsSensitivity: editSensitivity,
        updatedAt: new Date().toISOString(),
      });
      setEditingSymbol(null);
    } catch (err) {
      setAddTickerError(
        err instanceof Error && err.message
          ? err.message
          : `Không thể cập nhật cấu hình cho mã ${item.symbol}.`
      );
    }
  };

  const quickWatchItem = quickStockSymbol
    ? watchlist.find((w) => w.symbol === quickStockSymbol)
    : undefined;
  const quickQuote = quickStockSymbol ? overview?.quotes[quickStockSymbol] : undefined;
  const quickAnalytics = quickStockSymbol ? overview?.analytics?.[quickStockSymbol] : undefined;

  const isSsiLive = overview?.marketDataMode === 'ssi' || Boolean(settingsStatus?.ssiConfigured);

  return (
    <div className="min-h-[calc(100vh-140px)] bg-slate-50 dark:bg-slate-950">
      {/* STICKY COMMAND HEADER: Row 1 (Macro Ticker Strip) + Row 2 (4 Sub-Tabs) */}
      <div className="border-b border-slate-200/80 bg-white/95 backdrop-blur-md lg:sticky lg:top-16 lg:z-20 dark:border-slate-800/80 dark:bg-slate-950/95">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Row 1: Single-Line Macro Ticker Strip */}
          <div className="flex min-h-[44px] flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-1.5 dark:border-slate-800/80">
            <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto py-0.5 text-xs">
              <div
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                title={
                  isSsiLive
                    ? 'Đã kết nối SSI FastConnect Data'
                    : 'Đang dùng dữ liệu giá dự phòng (.VN / VPS)'
                }
              >
                <span
                  className={`inline-block h-2 w-2 rounded-xs ${
                    isSsiLive ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
                <span>{isSsiLive ? 'SSI Live' : 'SSI Dự phòng'}</span>
              </div>

              {(overview?.indices || []).map((idxQuote) => {
                const up = idxQuote.change > 0;
                const down = idxQuote.change < 0;
                return (
                  <div
                    key={idxQuote.indexId}
                    className="inline-flex shrink-0 items-baseline gap-1.5 text-xs tabular-nums"
                  >
                    <span className="font-semibold text-slate-500 dark:text-slate-400">
                      {idxQuote.indexId}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {idxQuote.value.toLocaleString('vi-VN')}
                    </span>
                    <span
                      className={`font-semibold ${
                        up
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : down
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {idxQuote.changePct > 0 ? '+' : ''}
                      {idxQuote.changePct}%
                    </span>
                  </div>
                );
              })}

              {(!overview || overview.indices.length === 0) && overviewLoading && (
                <span className="text-xs text-slate-400">Đang tải VN-Index...</span>
              )}

              {(overview?.macroQuotes || []).map((mq) => {
                const up = mq.changePct > 0;
                const down = mq.changePct < 0;
                return (
                  <div
                    key={mq.id}
                    className="inline-flex shrink-0 items-baseline gap-1.5 border-l border-slate-200 pl-3 text-xs tabular-nums dark:border-slate-800"
                    title={mq.sourceNote}
                  >
                    <span className="font-semibold text-slate-500 dark:text-slate-400">{mq.id}</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{mq.valueText}</span>
                    <span
                      className={`font-semibold ${
                        up
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : down
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-500'
                      }`}
                    >
                      {mq.changePct > 0 ? '+' : ''}
                      {mq.changePct}%
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Compact Action Bar */}
            <div className="flex shrink-0 items-center gap-1.5">
              {user ? (
                <span
                  className="hidden xl:inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50/70 px-2 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-800/70 dark:bg-emerald-950/40 dark:text-emerald-300 whitespace-nowrap"
                  title={`Firestore Cloud Synced (${user.email})`}
                >
                  <Cloud className="h-3 w-3" /> Cloud
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onSignInGoogle}
                  className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 cursor-pointer whitespace-nowrap shrink-0"
                  title="Đăng nhập Google để đồng bộ Watchlist Firestore"
                >
                  <CloudOff className="h-3 w-3" /> Đồng bộ Cloud
                </button>
              )}

              <button
                type="button"
                onClick={() => setAlertsDrawerOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Bell className="h-3.5 w-3.5 text-amber-500" />
                <span>Cảnh báo</span>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                    unreadAlertsCount > 0
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {unreadAlertsCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAiHealthDrawerOpen(true);
                  if (!aiHealth && !aiHealthLoading && watchlist.length > 0) {
                    onGenerateAiHealth();
                  }
                }}
                disabled={watchlist.length === 0}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Sparkles className={`h-3.5 w-3.5 ${aiHealthLoading ? 'animate-spin' : ''}`} />
                <span className="hidden md:inline">Sức khỏe AI</span>
              </button>

              <button
                type="button"
                onClick={onScanNow}
                disabled={scanning}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-emerald-500 dark:text-slate-950 cursor-pointer whitespace-nowrap shrink-0"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${scanning ? 'animate-spin' : ''}`} />
                <span>{scanning ? 'Đang quét...' : 'Quét ngay'}</span>
              </button>

              <button
                type="button"
                onClick={onOpenSettings}
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 cursor-pointer shrink-0"
                title="Cài đặt SSI FastConnect & Webhook"
                aria-label="Cài đặt SSI & Webhook"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Row 2: 4 Workspace Sub-Tabs */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto py-2">
            <nav className="flex items-center gap-1.5" aria-label="Phân hệ Tài chính">
              {(
                [
                  {
                    id: 'overview',
                    label: 'Tổng quan & Watchlist',
                    icon: LayoutGrid,
                  },
                  {
                    id: 'technical',
                    label: `Đồ thị Kỹ thuật & Tín hiệu Nến${techSymbol ? ` (${techSymbol})` : ''}`,
                    icon: CandlestickChart,
                  },
                  {
                    id: 'radar',
                    label: 'Radar Dòng tiền & Biến động Thất thường',
                    icon: Radar,
                  },
                  {
                    id: 'peer',
                    label: 'So sánh Cùng Ngành',
                    icon: GitCompare,
                  },
                ] as const
              ).map((tab) => {
                const Icon = tab.icon;
                const active = financeSubTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFinanceSubTab(tab.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                      active
                        ? 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            {lastScannedAt && (
              <span className="hidden lg:inline text-[11px] font-medium text-slate-400 tabular-nums whitespace-nowrap shrink-0">
                Đồng bộ: {new Date(lastScannedAt).toLocaleTimeString('vi-VN')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* MAIN WORKSPACE BODY */}
      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 space-y-5">
        {scanError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200">
            {scanError}
          </div>
        )}

        {/* ================================================================= */}
        {/* SUB-TAB 1: TỔNG QUAN & WATCHLIST (HERO ACTION ZONE ABOVE THE FOLD)*/}
        {/* ================================================================= */}
        {financeSubTab === 'overview' && (
          <div className="space-y-5">
            {/* TOP HERO ACTION ZONE: 2 EQUAL BLOCKS ABOVE THE FOLD */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch">
              {/* HERO LEFT (6 cols): CẢNH BÁO NÓNG CẦN XỬ LÝ NGAY */}
              <section className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm lg:col-span-6 dark:border-slate-800/80 dark:bg-slate-900">
                <div>
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
                        <Flame className="h-4 w-4" />
                      </span>
                      <div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          Cảnh Báo Nóng Cần Xử Lý Ngay
                        </h2>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Rủi ro kỹ thuật, đột biến thanh khoản &amp; biến động bất thường
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setAlertsDrawerOpen(true)}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer whitespace-nowrap"
                    >
                      Xem tất cả →
                    </button>
                  </div>

                  {heroHotAlerts.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                      Danh mục đang vận động ổn định, chưa có tín hiệu khẩn cấp nào cần xử lý ngay.
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2.5">
                      {heroHotAlerts.map((item) => {
                        const sevStyles =
                          item.severity === 'Khẩn cấp'
                            ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60'
                            : item.severity === 'Cơ hội'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60'
                              : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60';
                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-slate-50/70 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-950/50"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${sevStyles}`}>
                                  {item.severity}
                                </span>
                                <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white dark:bg-slate-100 dark:text-slate-950">
                                  {item.symbol}
                                </span>
                                {item.metricChip && (
                                  <span className="text-[11px] font-semibold text-slate-600 tabular-nums dark:text-slate-300">
                                    {item.metricChip}
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 truncate text-xs text-slate-600 dark:text-slate-300">
                                {item.reason}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => openTechnicalTab(item.symbol, false)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 hover:border-emerald-500 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
                            >
                              <CandlestickChart className="h-3.5 w-3.5" />
                              <span>Xem biểu đồ</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>

              {/* HERO RIGHT (6 cols): BẢNG VÀNG KHUYẾN NGHỊ ĐẦU TƯ TỰ ĐỘNG */}
              <section className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm lg:col-span-6 dark:border-slate-800/80 dark:bg-slate-900">
                <div>
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                        <Target className="h-4 w-4" />
                      </span>
                      <div>
                        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          Bảng Vàng Khuyến Nghị Đầu Tư Tự Động
                        </h2>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Tổng hợp 4 Trụ cột (ROE, Định giá, Thanh khoản, MA/RSI)
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSynthesizePortfolioStrategy(true)}
                      disabled={portfolioStrategyLoading || watchlist.length === 0}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400 cursor-pointer whitespace-nowrap disabled:opacity-50"
                    >
                      <RefreshCw className={`h-3 w-3 ${portfolioStrategyLoading ? 'animate-spin' : ''}`} />
                      <span>Đồng bộ AI</span>
                    </button>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    {/* Group 1: MUA */}
                    <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        Ưu tiên Giải ngân (MUA)
                      </div>
                      {heroRecommendationBoard.buyList.length === 0 ? (
                        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                          Chưa có mã đạt điểm giải ngân cao (&ge;65đ).
                        </p>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {heroRecommendationBoard.buyList.map((b) => (
                            <button
                              key={b.symbol}
                              type="button"
                              onClick={() => openTechnicalTab(b.symbol, false)}
                              className="w-full rounded-lg border border-emerald-200/80 bg-white p-2 text-left hover:border-emerald-500 dark:border-emerald-800/60 dark:bg-slate-900 cursor-pointer transition-colors"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                  {b.symbol}
                                </span>
                                <span className="text-[11px] font-bold text-emerald-600 tabular-nums dark:text-emerald-400">
                                  {b.score}đ · WR {b.winRatePct}%
                                </span>
                              </div>
                              <div className="mt-0.5 truncate text-[10px] text-slate-500 tabular-nums dark:text-slate-400">
                                Vùng mua: {b.entryZone}
                              </div>
                              <div className="text-[10px] font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">
                                TP1: {b.tp1}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Group 2: GIỮ */}
                    <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-3 dark:border-amber-900/60 dark:bg-amber-950/20">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                        Tiếp tục Nắm giữ (GIỮ)
                      </div>
                      {heroRecommendationBoard.holdList.length === 0 ? (
                        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                          Không có mã ở trạng thái trung tính.
                        </p>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {heroRecommendationBoard.holdList.map((h) => (
                            <button
                              key={h.symbol}
                              type="button"
                              onClick={() => openTechnicalTab(h.symbol, false)}
                              className="w-full rounded-lg border border-amber-200/80 bg-white p-2 text-left hover:border-amber-500 dark:border-amber-800/60 dark:bg-slate-900 cursor-pointer transition-colors"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                  {h.symbol}
                                </span>
                                <span className="text-[11px] font-bold text-amber-600 tabular-nums dark:text-amber-400">
                                  {h.score}/100đ
                                </span>
                              </div>
                              <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500 dark:text-slate-400">
                                {h.note}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Group 3: BÁN */}
                    <div className="rounded-xl border border-rose-200/80 bg-rose-50/40 p-3 dark:border-rose-900/60 dark:bg-rose-950/20">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                        Hạ tỷ trọng / Chốt lời (BÁN)
                      </div>
                      {heroRecommendationBoard.sellList.length === 0 ? (
                        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                          Chưa có mã cảnh báo suy yếu cần cơ cấu.
                        </p>
                      ) : (
                        <div className="mt-2 space-y-2">
                          {heroRecommendationBoard.sellList.map((s) => (
                            <button
                              key={s.symbol}
                              type="button"
                              onClick={() => openTechnicalTab(s.symbol, false)}
                              className="w-full rounded-lg border border-rose-200/80 bg-white p-2 text-left hover:border-rose-500 dark:border-rose-800/60 dark:bg-slate-900 cursor-pointer transition-colors"
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                  {s.symbol}
                                </span>
                                <span className="text-[11px] font-bold text-rose-600 tabular-nums dark:text-rose-400">
                                  {s.score}/100đ
                                </span>
                              </div>
                              <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500 dark:text-slate-400">
                                {s.note}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </div>

            {/* CENTER: CLEAN FULL-WIDTH WATCHLIST TABLE */}
            <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 pb-3.5 dark:border-slate-800">
                <div>
                  <h1 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Bảng Watchlist 4 Trụ Cột ({watchlist.length})
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Bấm vào bất kỳ mã nào để mở nhanh bảng tóm tắt Kỹ thuật &amp; Nến Nhật · Thanh khoản · ROE · P/E·P/B · MA/RSI
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {user && localWatchlistPendingCount > 0 && watchlist.length > 0 && onSyncLocalWatchlist && (
                    <button
                      type="button"
                      disabled={syncingWatchlist}
                      onClick={() => void handleSyncOrSeed('sync')}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300 cursor-pointer whitespace-nowrap"
                    >
                      <Cloud className="h-3.5 w-3.5" />
                      <span>+{localWatchlistPendingCount} mã cục bộ</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setAddTickerError(null);
                      setAddOpen((prev) => !prev);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-emerald-500 dark:text-slate-950 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>{addOpen ? 'Đóng' : 'Thêm mã'}</span>
                  </button>
                </div>
              </div>

              {(financeDbError || addTickerError) && (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200">
                  {addTickerError || financeDbError}
                </div>
              )}

              {addOpen && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleAddTicker();
                  }}
                  className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60"
                >
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        Mã CK
                      </label>
                      <input
                        list="vn-securities-datalist"
                        type="text"
                        value={newSymbol}
                        onChange={(e) => {
                          setAddTickerError(null);
                          setNewSymbol(e.target.value.toUpperCase());
                        }}
                        placeholder="SSI, FPT"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold uppercase text-slate-900 focus:border-emerald-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                      <datalist id="vn-securities-datalist">
                        {securities.map((s) => (
                          <option key={s.symbol} value={s.symbol}>
                            {s.symbol} ({s.exchange}) — {s.companyName}
                          </option>
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        Ngưỡng (±%)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max="15"
                        value={newThreshold}
                        onChange={(e) => setNewThreshold(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs tabular-nums text-slate-900 focus:border-emerald-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        Mục tiêu (đ)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="500"
                        placeholder="0"
                        value={newTargetPrice}
                        onChange={(e) => setNewTargetPrice(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs tabular-nums text-slate-900 focus:border-emerald-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        Cắt lỗ (đ)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="500"
                        placeholder="0"
                        value={newStopLoss}
                        onChange={(e) => setNewStopLoss(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs tabular-nums text-slate-900 focus:border-emerald-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        Độ nhạy tin
                      </label>
                      <select
                        value={newSensitivity}
                        onChange={(e) => setNewSensitivity(e.target.value as NewsSensitivity)}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      >
                        <option value="all">Mọi tin</option>
                        <option value="bearish">Tiêu cực</option>
                        <option value="bullish">Tích cực</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-slate-500">Gợi ý nhanh:</span>
                      {VN30_QUICK_PICKS.filter((sym) => !watchlistSymbolSet.has(sym)).map((sym) => (
                        <button
                          key={sym}
                          type="button"
                          disabled={addingTicker}
                          onClick={() => void handleAddTicker(sym)}
                          className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:border-emerald-500 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer"
                        >
                          +{sym}
                        </button>
                      ))}
                    </div>

                    <button
                      type="submit"
                      disabled={!newSymbol.trim() || addingTicker}
                      className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer whitespace-nowrap"
                    >
                      {addingTicker ? 'Đang thêm...' : 'Lưu vào Watchlist'}
                    </button>
                  </div>
                </form>
              )}

              {watchlistLoading && watchlist.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400">
                  <Activity className="mx-auto mb-2 h-5 w-5 animate-spin text-emerald-600" />
                  Đang đồng bộ danh mục Watchlist từ Firestore Cloud...
                </div>
              ) : watchlist.length === 0 ? (
                <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center dark:border-slate-700 dark:bg-slate-950">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Danh mục Watchlist đang trống.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    {onSeedStarterWatchlist && (
                      <button
                        type="button"
                        disabled={syncingWatchlist}
                        onClick={() => void handleSyncOrSeed('seed')}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-emerald-500 dark:text-slate-950 cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Nạp mẫu (SSI, FPT, VCB, HPG)</span>
                      </button>
                    )}
                    {user && localWatchlistPendingCount > 0 && onSyncLocalWatchlist && (
                      <button
                        type="button"
                        disabled={syncingWatchlist}
                        onClick={() => void handleSyncOrSeed('sync')}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 cursor-pointer"
                      >
                        <Cloud className="h-3.5 w-3.5" />
                        <span>Đồng bộ {localWatchlistPendingCount} mã cục bộ</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[820px] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
                        <th className="py-2.5 pr-3">Mã CP</th>
                        <th className="py-2.5 px-2 text-right">Giá &amp; %</th>
                        <th className="py-2.5 px-2 text-right">Thanh khoản</th>
                        <th className="py-2.5 px-2 text-right">ROE %</th>
                        <th className="py-2.5 px-2 text-right">Định giá</th>
                        <th className="py-2.5 px-3">MA &amp; RSI</th>
                        <th className="py-2.5 px-2">Khuyến nghị</th>
                        <th className="py-2.5 pl-2 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {watchlist.map((item) => {
                        const q = overview?.quotes[item.symbol];
                        const an = overview?.analytics?.[item.symbol];
                        const up = (q?.changePct ?? 0) > 0;
                        const down = (q?.changePct ?? 0) < 0;
                        const isEditing = editingSymbol === item.symbol;
                        const rsiVal = an?.timing.rsi14 ?? null;
                        const verdict = an?.recommendation.verdict;
                        const totalScore = an?.recommendation.totalScore;

                        const shortVerdict =
                          verdict === 'MUA MẠNH / TÍCH LŨY'
                            ? 'MUA MẠNH'
                            : verdict === 'MUA THĂM DÒ'
                              ? 'MUA THĂM DÒ'
                              : verdict === 'NẮM GIỮ / THEO DÕI'
                                ? 'NẮM GIỮ'
                                : verdict
                                  ? 'CƠ CẤU'
                                  : '';

                        return (
                          <tr
                            key={item.symbol}
                            onClick={() => {
                              if (!isEditing) setQuickStockSymbol(item.symbol);
                            }}
                            className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
                          >
                            <td className="py-3 pr-3 align-middle">
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openTechnicalTab(item.symbol, false);
                                  }}
                                  className="rounded-md bg-slate-900 px-2 py-0.5 text-xs font-bold text-white hover:bg-emerald-600 dark:bg-slate-100 dark:text-slate-950 cursor-pointer"
                                  title={`Mở Đồ thị Kỹ thuật ${item.symbol}`}
                                >
                                  {item.symbol}
                                </button>
                                <span className="text-[11px] font-medium text-slate-400">
                                  {q?.exchange || item.exchange}
                                </span>
                              </div>
                              <p className="mt-0.5 max-w-[140px] truncate text-[11px] text-slate-500 dark:text-slate-400">
                                {an?.sectorLabel || q?.companyName || item.companyName}
                              </p>
                            </td>

                            <td className="py-3 px-2 text-right align-middle tabular-nums">
                              {q && q.price > 0 ? (
                                <>
                                  <div className="font-bold text-slate-900 dark:text-slate-100">
                                    {q.price.toLocaleString('vi-VN')}
                                  </div>
                                  <div
                                    className={`text-[11px] font-semibold ${
                                      up
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : down
                                          ? 'text-rose-600 dark:text-rose-400'
                                          : 'text-amber-600 dark:text-amber-400'
                                    }`}
                                  >
                                    {q.changePct > 0 ? '+' : ''}
                                    {q.changePct}%
                                  </div>
                                </>
                              ) : overviewLoading ? (
                                <span className="text-xs text-slate-400">...</span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>

                            <td className="py-3 px-2 text-right align-middle tabular-nums">
                              {an ? (
                                <>
                                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                                    {an.liquidity.valueBillionVnd.toLocaleString('vi-VN')} tỷ
                                  </div>
                                  <span
                                    className={`inline-block rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                                      an.liquidity.tier === 'strong'
                                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                        : an.liquidity.tier === 'stable'
                                          ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                    }`}
                                  >
                                    {an.liquidity.ma20VolPct}% TB20
                                  </span>
                                </>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>

                            <td className="py-3 px-2 text-right align-middle tabular-nums">
                              {an ? (
                                <>
                                  <div className="font-bold text-slate-900 dark:text-slate-100">
                                    {an.fundamentals.roePct.toFixed(1)}%
                                  </div>
                                  <span
                                    className={`text-[11px] font-semibold ${
                                      an.fundamentals.roeTier === 'high'
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : an.fundamentals.roeTier === 'medium'
                                          ? 'text-amber-600 dark:text-amber-400'
                                          : 'text-rose-600 dark:text-rose-400'
                                    }`}
                                  >
                                    {an.fundamentals.roeLabel}
                                  </span>
                                </>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>

                            <td className="py-3 px-2 text-right align-middle tabular-nums">
                              {an ? (
                                <>
                                  <div className="font-bold text-slate-900 dark:text-slate-100">
                                    <span className="text-[11px] font-normal text-slate-500">
                                      {an.fundamentals.primaryMetric}{' '}
                                    </span>
                                    {an.fundamentals.primaryValue > 0
                                      ? an.fundamentals.primaryValue.toFixed(1)
                                      : 'Âm'}
                                  </div>
                                  <div
                                    className={`text-[11px] font-semibold ${
                                      an.fundamentals.diffVsSectorPct <= -5
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : an.fundamentals.diffVsSectorPct >= 15
                                          ? 'text-rose-600 dark:text-rose-400'
                                          : 'text-slate-500 dark:text-slate-400'
                                    }`}
                                  >
                                    {an.fundamentals.diffVsSectorPct > 0 ? '+' : ''}
                                    {an.fundamentals.diffVsSectorPct}% ngành
                                  </div>
                                </>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>

                            <td className="py-3 px-3 align-middle">
                              {an ? (
                                <div className="min-w-[115px]">
                                  <div className="flex items-center justify-between gap-1 text-[11px]">
                                    <span
                                      className={`truncate font-semibold ${
                                        an.timing.maPosition === 'above_both' ||
                                        an.timing.maPosition === 'cross_up_ma20'
                                          ? 'text-emerald-600 dark:text-emerald-400'
                                          : an.timing.maPosition === 'below_both'
                                            ? 'text-rose-600 dark:text-rose-400'
                                            : 'text-amber-600 dark:text-amber-400'
                                      }`}
                                    >
                                      {an.timing.maPosition === 'above_both'
                                        ? 'Trên MA20/50'
                                        : an.timing.maPosition === 'cross_up_ma20'
                                          ? 'Vượt MA20'
                                          : an.timing.maPosition === 'below_both'
                                            ? 'Dưới MA20/50'
                                            : 'Giằng co MA'}
                                    </span>
                                    <span className="font-bold text-slate-800 tabular-nums dark:text-slate-200">
                                      {rsiVal ?? '—'}
                                    </span>
                                  </div>
                                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-xs bg-slate-200 dark:bg-slate-800">
                                    <div
                                      className={
                                        rsiVal !== null && rsiVal > 70
                                          ? 'h-full bg-rose-500'
                                          : rsiVal !== null && rsiVal >= 45
                                            ? 'h-full bg-emerald-500'
                                            : 'h-full bg-amber-500'
                                      }
                                      style={{ width: `${Math.max(6, Math.min(100, rsiVal ?? 50))}%` }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>

                            <td className="py-3 px-2 align-middle">
                              {an && totalScore !== undefined ? (
                                <div className="space-y-0.5">
                                  <div className="text-[11px] font-bold text-slate-900 tabular-nums dark:text-slate-100">
                                    {totalScore}/100đ
                                  </div>
                                  <span
                                    className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold tracking-tight whitespace-nowrap ${
                                      verdict === 'MUA MẠNH / TÍCH LŨY'
                                        ? 'bg-emerald-600 text-white'
                                        : verdict === 'MUA THĂM DÒ'
                                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300'
                                          : verdict === 'NẮM GIỮ / THEO DÕI'
                                            ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                                            : 'bg-rose-600 text-white'
                                    }`}
                                  >
                                    {shortVerdict}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>

                            <td
                              className="py-3 pl-2 text-right align-middle"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {isEditing ? (
                                <div className="w-40 space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-left dark:border-slate-700 dark:bg-slate-950">
                                  <div className="grid grid-cols-3 gap-1">
                                    <input
                                      type="number"
                                      step="0.5"
                                      value={editThreshold}
                                      onChange={(e) => setEditThreshold(e.target.value)}
                                      title="Ngưỡng %"
                                      className="w-full rounded border border-slate-200 px-1 py-0.5 text-[10px] tabular-nums dark:border-slate-700 dark:bg-slate-900"
                                    />
                                    <input
                                      type="number"
                                      step="500"
                                      value={editTarget}
                                      onChange={(e) => setEditTarget(e.target.value)}
                                      title="TP (đ)"
                                      className="w-full rounded border border-slate-200 px-1 py-0.5 text-[10px] tabular-nums dark:border-slate-700 dark:bg-slate-900"
                                    />
                                    <input
                                      type="number"
                                      step="500"
                                      value={editStopLoss}
                                      onChange={(e) => setEditStopLoss(e.target.value)}
                                      title="SL (đ)"
                                      className="w-full rounded border border-slate-200 px-1 py-0.5 text-[10px] tabular-nums dark:border-slate-700 dark:bg-slate-900"
                                    />
                                  </div>
                                  <div className="flex items-center justify-between gap-1">
                                    <select
                                      value={editSensitivity}
                                      onChange={(e) =>
                                        setEditSensitivity(e.target.value as NewsSensitivity)
                                      }
                                      className="rounded border border-slate-200 px-1 py-0.5 text-[10px] dark:border-slate-700 dark:bg-slate-900"
                                    >
                                      <option value="all">Mọi tin</option>
                                      <option value="bearish">Tiêu cực</option>
                                      <option value="bullish">Tích cực</option>
                                    </select>
                                    <div className="flex items-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => setEditingSymbol(null)}
                                        className="text-[10px] text-slate-500 cursor-pointer"
                                      >
                                        Hủy
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void saveEditRow(item)}
                                        className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white cursor-pointer"
                                      >
                                        Lưu
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="inline-flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => openTechnicalTab(item.symbol, false)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300 cursor-pointer whitespace-nowrap"
                                    title="Mở Đồ thị & Nến Nhật"
                                  >
                                    <TrendingUp className="h-3 w-3" />
                                    <span>Đồ thị</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => startEditRow(item)}
                                    className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:hover:bg-slate-800 cursor-pointer"
                                    title="Cài đặt ngưỡng cảnh báo"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void onRemoveWatchlistItem(item.symbol)}
                                    className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:border-rose-300 hover:text-rose-600 dark:border-slate-700 dark:hover:text-rose-400 cursor-pointer"
                                    title="Xóa khỏi Watchlist"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Compact Portfolio Strategy Accordion */}
              <PortfolioStrategySection
                watchlist={watchlist}
                quotes={overview?.quotes || {}}
                analytics={overview?.analytics || {}}
                strategy={portfolioStrategy}
                strategyLoading={portfolioStrategyLoading}
                onSynthesizeStrategy={onSynthesizePortfolioStrategy}
                onOpenPrediction={(sym) => openTechnicalTab(sym, false)}
                compactAccordion={true}
              />
            </section>

            {/* BOTTOM BALANCED ROW: MINI RADAR + TAGGED NEWS FEED */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
              {/* Mini Radar Box (5 cols) */}
              <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm lg:col-span-5 dark:border-slate-800/80 dark:bg-slate-900">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                  <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-slate-100">
                    <Radar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Tín hiệu Dòng tiền Nóng Hôm Nay</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => setFinanceSubTab('radar')}
                    className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <span>Mở Radar</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {anomalyRadarLoading && miniRadarSignals.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-500">Đang quét Radar dòng tiền...</p>
                ) : miniRadarSignals.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    Thị trường chưa ghi nhận đột biến thanh khoản hoặc giật lắc lớn.
                  </p>
                ) : (
                  <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
                    {miniRadarSignals.map((sig) => (
                      <button
                        key={sig.id}
                        type="button"
                        onClick={() => openTechnicalTab(sig.symbol, false)}
                        className="flex w-full items-center justify-between gap-2 py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-lg px-2 cursor-pointer transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white dark:bg-slate-100 dark:text-slate-950">
                              {sig.symbol}
                            </span>
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                                sig.tone === 'bull'
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : sig.tone === 'bear'
                                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                    : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              }`}
                            >
                              {sig.tag}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-xs text-slate-500 tabular-nums dark:text-slate-400">
                            {sig.metricText}
                          </p>
                        </div>
                        <div className="shrink-0 text-right tabular-nums">
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                            {sig.price.toLocaleString('vi-VN')}
                          </div>
                          <div
                            className={`text-[11px] font-semibold ${
                              sig.changePct > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : sig.changePct < 0
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-amber-600'
                            }`}
                          >
                            {sig.changePct > 0 ? '+' : ''}
                            {sig.changePct}%
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </section>

              {/* Tagged Financial News & Governance Events Feed (7 cols) */}
              <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm lg:col-span-7 dark:border-slate-800/80 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                  <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-slate-100">
                    <Newspaper className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Tin Tài chính Gắn Mã &amp; ĐHĐCĐ</span>
                  </h2>
                  {lastBotReport && (
                    <button
                      type="button"
                      onClick={onGoToDatabase}
                      className="text-xs font-semibold text-slate-500 hover:text-emerald-700 dark:text-slate-400 dark:hover:text-emerald-400 cursor-pointer whitespace-nowrap"
                    >
                      +{lastBotReport.newCount} mới → Kho Tin
                    </button>
                  )}
                </div>

                {/* Filter Bar */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-1">
                    {(
                      [
                        { id: 'all', label: 'Tất cả' },
                        { id: 'watchlist', label: 'Chỉ mã Watchlist' },
                        { id: 'governance', label: 'Tin ĐHĐCĐ & Nội bộ' },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setNewsFilter(f.id)}
                        className={`rounded-lg px-2.5 py-1 font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                          newsFilter === f.id
                            ? 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950'
                            : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <select
                    value={newsTickerFilter}
                    onChange={(e) => setNewsTickerFilter(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                    aria-label="Lọc tin theo mã cổ phiếu"
                  >
                    <option value="ALL">Mã: Tất cả</option>
                    {watchlist.map((w) => (
                      <option key={w.symbol} value={w.symbol}>
                        {w.symbol}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Scrollable Feed */}
                <div className="mt-3 max-h-[360px] divide-y divide-slate-100 overflow-y-auto pr-1 dark:divide-slate-800">
                  {newsFilter === 'governance' ? (
                    filteredGovernanceForSidebar.length === 0 ? (
                      <p className="py-8 text-center text-xs text-slate-500">
                        Chưa có văn bản ĐHĐCĐ / cổ đông nội bộ. Bấm Quét ngay để cập nhật.
                      </p>
                    ) : (
                      filteredGovernanceForSidebar.slice(0, 18).map((ev) => (
                        <article key={ev.id} className="py-3">
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            <button
                              type="button"
                              onClick={() => openTechnicalTab(ev.symbol, false)}
                              className="rounded-md bg-slate-900 px-2 py-0.5 font-bold text-white dark:bg-slate-100 dark:text-slate-950 cursor-pointer"
                            >
                              {ev.symbol}
                            </button>
                            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {ev.categoryLabel}
                            </span>
                            {ev.keyMetrics[0] && (
                              <span className="font-semibold text-amber-600 dark:text-amber-400">
                                {ev.keyMetrics[0]}
                              </span>
                            )}
                          </div>
                          <h3 className="mt-1 line-clamp-1 text-xs font-bold text-slate-900 dark:text-slate-100">
                            {ev.title}
                          </h3>
                          <p className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                            {ev.summary || 'Thông báo quản trị doanh nghiệp từ HOSE / HNX / CafeF.'}
                          </p>
                          <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                            <span className="truncate">
                              {ev.sourceName} · {ev.eventDate}
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  onAnalyzeArticleUrl(ev.url, ev.title, ev.sourceName, 'Kinh doanh')
                                }
                                className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400 cursor-pointer"
                              >
                                Phân tích
                              </button>
                              <a
                                href={ev.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                                aria-label="Đọc văn bản gốc"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </div>
                          </div>
                        </article>
                      ))
                    )
                  ) : filteredNews.length === 0 ? (
                    <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                      {scanning
                        ? 'Đang quét nguồn báo tài chính và gắn mã cổ phiếu...'
                        : 'Chưa có bài báo khớp bộ lọc. Nhấn Quét ngay để tải tin mới.'}
                    </p>
                  ) : (
                    filteredNews.slice(0, 20).map((art) => (
                      <article key={art.id} className="py-3">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          {art.matchedTickers.slice(0, 3).map((sym) => {
                            const sq = overview?.quotes[sym];
                            return (
                              <button
                                key={sym}
                                type="button"
                                onClick={() => openTechnicalTab(sym, false)}
                                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-bold cursor-pointer tabular-nums ${
                                  watchlistSymbolSet.has(sym)
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-300'
                                    : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                }`}
                              >
                                <span>{sym}</span>
                                {sq && sq.price > 0 && (
                                  <span
                                    className={
                                      sq.changePct >= 0
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-rose-600 dark:text-rose-400'
                                    }
                                  >
                                    {sq.changePct > 0 ? '+' : ''}
                                    {sq.changePct}%
                                  </span>
                                )}
                              </button>
                            );
                          })}
                          <span
                            className={`rounded-md px-2 py-0.5 font-semibold ${
                              art.impactLabel === 'Rủi ro cao'
                                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                : art.impactLabel === 'Hỗ trợ tăng'
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {art.impactLabel}
                          </span>
                        </div>

                        <h3 className="mt-1 line-clamp-1 text-xs font-bold text-slate-900 dark:text-slate-100">
                          {art.title}
                        </h3>
                        {art.summary && (
                          <p className="line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                            {art.summary}
                          </p>
                        )}

                        <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                          <span className="truncate">
                            {art.sourceName} · {art.publishedRelative}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() =>
                                onAnalyzeArticleUrl(
                                  art.url,
                                  art.title,
                                  art.sourceName,
                                  'Kinh doanh'
                                )
                              }
                              className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400 cursor-pointer"
                            >
                              Phân tích
                            </button>
                            <a
                              href={art.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                              aria-label="Mở bài viết gốc"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </div>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* SUB-TAB 2: ĐỒ THỊ KỸ THUẬT & TÍN HIỆU NẾN + ĐHĐCĐ               */}
        {/* ================================================================= */}
        {financeSubTab === 'technical' && (
          <div className="space-y-4">
            <section className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1">
                  Watchlist:
                </span>
                {watchlist.map((w) => (
                  <button
                    key={w.symbol}
                    type="button"
                    onClick={() => openTechnicalTab(w.symbol, false)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold cursor-pointer whitespace-nowrap transition-colors ${
                      techSymbol === w.symbol
                        ? 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950'
                        : 'border border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                    }`}
                  >
                    {w.symbol}
                  </button>
                ))}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (techSearchInput.trim()) {
                    openTechnicalTab(techSearchInput, false);
                    setTechSearchInput('');
                  }
                }}
                className="flex items-center gap-1.5 shrink-0"
              >
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    list="tech-securities-datalist"
                    type="text"
                    value={techSearchInput}
                    onChange={(e) => setTechSearchInput(e.target.value.toUpperCase())}
                    placeholder="Nhập mã bất kỳ (VD: VNM)..."
                    className="w-48 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-2 text-xs font-semibold uppercase text-slate-900 focus:border-emerald-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                  <datalist id="tech-securities-datalist">
                    {securities.map((s) => (
                      <option key={s.symbol} value={s.symbol}>
                        {s.symbol} ({s.exchange}) — {s.companyName}
                      </option>
                    ))}
                  </datalist>
                </div>
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-emerald-500 dark:text-slate-950 cursor-pointer whitespace-nowrap"
                >
                  Phân tích
                </button>
                <button
                  type="button"
                  disabled={techLoading}
                  onClick={() => void loadTechnicalForSymbol(techSymbol)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer whitespace-nowrap"
                  title="Làm mới đồ thị & tín hiệu"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${techLoading ? 'animate-spin' : ''}`} />
                </button>
              </form>
            </section>

            <StockTechnicalWorkspace
              loading={techLoading}
              error={techError}
              prediction={techPrediction}
              symbolTitle={techSymbol}
              watchlistItem={watchlist.find((w) => w.symbol === techSymbol)}
              taggedArticles={taggedArticles}
              storedArticles={storedArticles}
              corporateEvents={corporateEvents?.events || []}
              corporateEventsLoading={corporateEventsLoading}
              onRefreshCorporateEvents={onRefreshCorporateEvents}
              autoTriggerCashflow={techAutoCashflow}
              onAnalyzeNewsUrl={(url, title, sourceName) =>
                onAnalyzeArticleUrl(url, title, sourceName, 'Kinh doanh')
              }
              onSelectSymbol={(sym) => openTechnicalTab(sym, false)}
            />
          </div>
        )}

        {/* ================================================================= */}
        {/* SUB-TAB 3: RADAR DÒNG TIỀN & BIẾN ĐỘNG THẤT THƯỜNG (50/50 SPLIT)  */}
        {/* ================================================================= */}
        {financeSubTab === 'radar' && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
            <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm lg:col-span-6 dark:border-slate-800/80 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 pb-3 dark:border-slate-800">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="flex items-center gap-1.5 text-base font-bold text-slate-900 dark:text-slate-100">
                      <Radar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Radar Dòng Tiền Bất Thường</span>
                    </h2>
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      0 token Gemini
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Đột biến thanh khoản ≥2.0x TB20, Khối ngoại ≥2.5x và cảnh báo lệch pha CFO.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={anomalyRadarLoading}
                  onClick={onRefreshAnomalyRadar}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${anomalyRadarLoading ? 'animate-spin' : ''}`} />
                  <span>{anomalyRadarLoading ? 'Đang quét...' : 'Cập nhật Radar'}</span>
                </button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs tabular-nums">
                <button
                  type="button"
                  onClick={() => setRadarDirectionFilter('all')}
                  className={`rounded-lg px-2.5 py-1 font-semibold cursor-pointer whitespace-nowrap ${
                    radarDirectionFilter === 'all'
                      ? 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950'
                      : 'border border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                  }`}
                >
                  Tất cả ({anomalyRadar?.anomalies.length ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setRadarDirectionFilter('accumulation')}
                  className={`rounded-lg border px-2.5 py-1 font-semibold cursor-pointer whitespace-nowrap ${
                    radarDirectionFilter === 'accumulation'
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300'
                  }`}
                >
                  Gom: {anomalyRadar?.summaryCounts.accumulation ?? 0}
                </button>
                <button
                  type="button"
                  onClick={() => setRadarDirectionFilter('distribution')}
                  className={`rounded-lg border px-2.5 py-1 font-semibold cursor-pointer whitespace-nowrap ${
                    radarDirectionFilter === 'distribution'
                      ? 'border-rose-600 bg-rose-600 text-white'
                      : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800/50 dark:bg-rose-950/40 dark:text-rose-300'
                  }`}
                >
                  Xả: {anomalyRadar?.summaryCounts.distribution ?? 0}
                </button>
                <button
                  type="button"
                  onClick={() => setRadarDirectionFilter('foreign_spike')}
                  className={`rounded-lg border px-2.5 py-1 font-semibold cursor-pointer whitespace-nowrap ${
                    radarDirectionFilter === 'foreign_spike'
                      ? 'border-sky-600 bg-sky-600 text-white'
                      : 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800/50 dark:bg-sky-950/40 dark:text-sky-300'
                  }`}
                >
                  Ngoại: {anomalyRadar?.summaryCounts.foreignSpike ?? 0}
                </button>
                <button
                  type="button"
                  onClick={() => setRadarDirectionFilter('cfo_divergence')}
                  className={`rounded-lg border px-2.5 py-1 font-semibold cursor-pointer whitespace-nowrap ${
                    radarDirectionFilter === 'cfo_divergence'
                      ? 'border-amber-600 bg-amber-600 text-white'
                      : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-300'
                  }`}
                >
                  CFO: {anomalyRadar?.summaryCounts.cfoDivergence ?? 0}
                </button>
              </div>

              {anomalyRadarLoading && !anomalyRadar ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  <Activity className="mx-auto mb-2 h-5 w-5 animate-spin text-emerald-600" />
                  Đang quét đột biến khối lượng &amp; khối ngoại Watchlist + VN30...
                </div>
              ) : filteredAnomalies.length === 0 ? (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  Thị trường đang giao dịch ổn định trong nhóm lọc này (chưa ghi nhận mã vượt ≥2.0x TB20 hoặc lệch CFO).
                </div>
              ) : (
                <div className="mt-3 max-h-[580px] space-y-2.5 overflow-y-auto pr-1">
                  {filteredAnomalies.map((an) => (
                    <div
                      key={an.id}
                      className={`rounded-xl border p-3.5 ${
                        an.severity === 'opportunity'
                          ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-800/60 dark:bg-emerald-950/20'
                          : an.severity === 'critical'
                            ? 'border-rose-200 bg-rose-50/40 dark:border-rose-800/60 dark:bg-rose-950/20'
                            : 'border-amber-200 bg-amber-50/40 dark:border-amber-800/60 dark:bg-amber-950/20'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openTechnicalTab(an.symbol, false)}
                            className="rounded-md bg-slate-900 px-2 py-0.5 text-xs font-bold text-white hover:bg-emerald-600 dark:bg-slate-100 dark:text-slate-950 cursor-pointer"
                          >
                            {an.symbol}
                          </button>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                              an.severity === 'opportunity'
                                ? 'bg-emerald-600 text-white'
                                : an.severity === 'critical'
                                  ? 'bg-rose-600 text-white'
                                  : 'bg-amber-600 text-white'
                            }`}
                          >
                            {ANOMALY_DIRECTION_LABELS[an.direction]}
                          </span>
                          <span className="text-xs font-medium text-slate-500 tabular-nums">
                            {an.volumeRatio20}x TB20
                          </span>
                        </div>
                        <span className="text-xs font-bold text-slate-900 tabular-nums dark:text-slate-100">
                          {an.price.toLocaleString('vi-VN')} đ{' '}
                          <span
                            className={
                              an.changePct >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }
                          >
                            ({an.changePct > 0 ? '+' : ''}
                            {an.changePct}%)
                          </span>
                        </span>
                      </div>

                      <p className="mt-1.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                        {an.detail}
                      </p>

                      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-200/70 pt-2 text-xs dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => openTechnicalTab(an.symbol, false)}
                          className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline dark:text-emerald-400 cursor-pointer"
                        >
                          <TrendingUp className="h-3.5 w-3.5" /> Mở Đồ thị
                        </button>
                        <button
                          type="button"
                          onClick={() => handleJumpCompare(an.symbol)}
                          className="inline-flex items-center gap-1 font-medium text-slate-600 hover:underline dark:text-slate-300 cursor-pointer"
                        >
                          <GitCompare className="h-3.5 w-3.5" /> So sánh ngành
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="lg:col-span-6">
              <ErraticMoversSection
                data={erraticMovers}
                loading={erraticMoversLoading}
                onRefresh={onRefreshErraticMovers}
                watchlistSymbols={watchlist.map((w) => w.symbol)}
                taggedArticles={taggedArticles}
                storedArticles={storedArticles}
                corporateEvents={corporateEvents?.events || []}
                onOpenPrediction={(sym) => openTechnicalTab(sym, false)}
                compactSplit={true}
              />
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* SUB-TAB 4: SO SÁNH CÙNG NGÀNH (PEER COMPARISON)                   */}
        {/* ================================================================= */}
        {financeSubTab === 'peer' && (
          <PeerComparisonSection
            securities={securities}
            watchlistSymbols={watchlist.map((w) => w.symbol)}
            corporateEvents={corporateEvents?.events || []}
            taggedArticles={taggedArticles}
            storedArticles={storedArticles}
            presetSymbols={peerPresetSymbols}
            onOpenPrediction={(sym) => openTechnicalTab(sym, false)}
          />
        )}
      </main>

      {/* ================================================================= */}
      {/* DRAWER 1: QUICK STOCK 4-PILLAR & CANDLESTICK SLIDE-OVER           */}
      {/* ================================================================= */}
      {quickStockSymbol && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label={`Phân tích nhanh ${quickStockSymbol}`}
          onClick={() => setQuickStockSymbol(null)}
        >
          <div
            className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-slate-900 px-2.5 py-0.5 text-sm font-bold text-white dark:bg-emerald-500 dark:text-slate-950">
                    {quickStockSymbol}
                  </span>
                  <span className="text-xs font-medium text-slate-500">
                    {quickQuote?.exchange || quickWatchItem?.exchange || 'HOSE'}
                  </span>
                </div>
                <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                  {quickQuote?.companyName || quickWatchItem?.companyName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickStockSymbol(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {quickQuote && quickQuote.price > 0 && (
              <div className="mt-4 flex items-baseline justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 tabular-nums dark:border-slate-800 dark:bg-slate-950">
                <div>
                  <span className="text-[11px] font-semibold uppercase text-slate-500">
                    Giá khớp lệnh
                  </span>
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {quickQuote.price.toLocaleString('vi-VN')} đ
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-flex items-center text-sm font-bold ${
                      quickQuote.changePct >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {quickQuote.changePct >= 0 ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4" />
                    )}
                    {quickQuote.changePct > 0 ? '+' : ''}
                    {quickQuote.changePct}%
                  </span>
                  <div className="text-[11px] text-slate-500">
                    NN: {quickQuote.foreignNetVol > 0 ? '+' : ''}
                    {quickQuote.foreignNetVol.toLocaleString('vi-VN')} cp
                  </div>
                </div>
              </div>
            )}

            {quickAnalytics && (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex items-center justify-between text-xs tabular-nums">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Điểm Tổng hợp 4 Trụ cột
                    </span>
                    <span className="text-base font-bold text-emerald-700 dark:text-emerald-400">
                      {quickAnalytics.recommendation.totalScore}/100đ
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-bold text-slate-900 dark:text-slate-100">
                    {quickAnalytics.recommendation.verdict}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    Vùng mua tham chiếu: {quickAnalytics.recommendation.suggestedBuyZone}
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                    {quickAnalytics.recommendation.reasons.map((r, i) => (
                      <li key={i}>• {r}</li>
                    ))}
                  </ul>
                  {quickAnalytics.recommendation.riskWarning && (
                    <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50/70 p-2.5 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                      {quickAnalytics.recommendation.riskWarning}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs tabular-nums">
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950">
                    <span className="text-[11px] text-slate-500">GTGD &amp; TB20</span>
                    <p className="mt-0.5 font-bold text-slate-900 dark:text-slate-100">
                      {quickAnalytics.liquidity.valueBillionVnd.toLocaleString('vi-VN')} tỷ ({quickAnalytics.liquidity.ma20VolPct}%)
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950">
                    <span className="text-[11px] text-slate-500">ROE &amp; {quickAnalytics.fundamentals.primaryMetric}</span>
                    <p className="mt-0.5 font-bold text-slate-900 dark:text-slate-100">
                      {quickAnalytics.fundamentals.roePct.toFixed(1)}% · {quickAnalytics.fundamentals.primaryValue.toFixed(1)}x
                    </p>
                  </div>
                </div>
              </div>
            )}

            {quickWatchItem && (
              <div className="mt-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-950">
                <p className="text-[11px] font-semibold uppercase text-slate-500">
                  Cài đặt Cảnh báo Cá nhân
                </p>
                <div className="mt-1.5 flex flex-wrap gap-3 text-xs font-medium tabular-nums text-slate-700 dark:text-slate-300">
                  <span>Ngưỡng ±{quickWatchItem.priceChangeThresholdPct}%</span>
                  <span>TP: {quickWatchItem.targetPrice ? quickWatchItem.targetPrice.toLocaleString('vi-VN') : '—'}</span>
                  <span>SL: {quickWatchItem.stopLossPrice ? quickWatchItem.stopLossPrice.toLocaleString('vi-VN') : '—'}</span>
                  <span>{SENSITIVITY_LABELS[quickWatchItem.newsSensitivity]}</span>
                </div>
              </div>
            )}

            <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => openTechnicalTab(quickStockSymbol, false)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-emerald-500 dark:text-slate-950 cursor-pointer"
              >
                <CandlestickChart className="h-4 w-4" />
                <span>Mở Đồ thị Kỹ thuật &amp; Tín hiệu Nến {quickStockSymbol} →</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => openTechnicalTab(quickStockSymbol, true)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300 cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>AI Dòng tiền</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleJumpCompare(quickStockSymbol)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 cursor-pointer"
                >
                  <GitCompare className="h-3.5 w-3.5" />
                  <span>So sánh Ngành</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* DRAWER 2: MULTI-TIER ALERT CENTER DRAWER                          */}
      {/* ================================================================= */}
      {alertsDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Trung tâm Cảnh báo Đa tầng"
          onClick={() => setAlertsDrawerOpen(false)}
        >
          <div
            className="flex h-full w-full max-w-lg flex-col overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
                  <Activity className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  <span>Cảnh báo Đa tầng ({alerts.length})</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lastScannedAt
                    ? `Cập nhật: ${new Date(lastScannedAt).toLocaleTimeString('vi-VN')}`
                    : 'Chờ lượt quét Watchlist tự động hoặc thủ công.'}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {unreadAlertsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void onMarkAllAlertsRead()}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer whitespace-nowrap"
                  >
                    <Check className="h-3.5 w-3.5" /> Đọc tất cả
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAlertsDrawerOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                  aria-label="Đóng ngăn cảnh báo"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
              {(
                [
                  { id: 'all', label: `Tất cả (${alerts.length})` },
                  { id: 'critical', label: `Khẩn cấp (${alerts.filter((a) => a.severity === 'critical').length})` },
                  { id: 'warning', label: `Chú ý (${alerts.filter((a) => a.severity === 'warning').length})` },
                  { id: 'opportunity', label: `Cơ hội (${alerts.filter((a) => a.severity === 'opportunity').length})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAlertFilter(tab.id)}
                  className={`rounded-lg px-2.5 py-1 font-semibold cursor-pointer whitespace-nowrap ${
                    alertFilter === tab.id
                      ? 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950'
                      : 'border border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="mt-3 flex-1 space-y-2.5 overflow-y-auto pr-1">
              {filteredAlerts.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 py-10 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  Chưa có cảnh báo nào ở cấp độ đang chọn.
                </div>
              ) : (
                filteredAlerts.map((al) => {
                  const isCrit = al.severity === 'critical';
                  const isOpp = al.severity === 'opportunity';
                  return (
                    <div
                      key={al.id}
                      className={`rounded-xl border p-3.5 ${
                        al.read
                          ? 'border-slate-200 bg-slate-50/50 opacity-75 dark:border-slate-800 dark:bg-slate-950/40'
                          : isCrit
                            ? 'border-rose-200 bg-rose-50/40 dark:border-rose-900/70 dark:bg-rose-950/20'
                            : isOpp
                              ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/70 dark:bg-emerald-950/20'
                              : 'border-amber-200 bg-amber-50/40 dark:border-amber-900/70 dark:bg-amber-950/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                              isCrit
                                ? 'bg-rose-600 text-white'
                                : isOpp
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-amber-500 text-slate-950'
                            }`}
                          >
                            {isCrit ? (
                              <AlertOctagon className="h-3 w-3" />
                            ) : isOpp ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <AlertTriangle className="h-3 w-3" />
                            )}
                            {isCrit ? 'Khẩn cấp' : isOpp ? 'Cơ hội' : 'Chú ý'}
                          </span>
                          <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                            {al.symbol}
                          </span>
                          {al.priceSnapshot > 0 && (
                            <span className="text-xs text-slate-600 tabular-nums dark:text-slate-400">
                              {al.priceSnapshot.toLocaleString('vi-VN')} đ ({al.changePctSnapshot > 0 ? '+' : ''}
                              {al.changePctSnapshot}%)
                            </span>
                          )}
                        </div>
                        {!al.read && (
                          <button
                            type="button"
                            onClick={() => void onMarkAlertRead(al.id, true)}
                            className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 cursor-pointer shrink-0"
                          >
                            Đã đọc
                          </button>
                        )}
                      </div>

                      <h3 className="mt-1.5 text-xs font-bold leading-snug text-slate-900 dark:text-slate-100">
                        {al.title}
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{al.message}</p>

                      <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => openTechnicalTab(al.symbol, false)}
                            className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400 cursor-pointer"
                          >
                            Mở Đồ thị {al.symbol} →
                          </button>
                          {al.articleUrl && (
                            <a
                              href={al.articleUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 dark:text-slate-400"
                            >
                              Tin gốc <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => void onDeleteAlert(al.id)}
                          className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                          aria-label="Xóa cảnh báo"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* DRAWER 3: AI WATCHLIST HEALTH BRIEF DRAWER                        */}
      {/* ================================================================= */}
      {aiHealthDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Đánh giá Sức khỏe Danh mục Watchlist bằng AI"
          onClick={() => setAiHealthDrawerOpen(false)}
        >
          <div
            className="flex h-full w-full max-w-lg flex-col overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-100">
                  <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Đánh giá Sức khỏe Watchlist (AI)</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tổng hợp nhanh sức khỏe giá, thanh khoản &amp; tin tức toàn bộ Watchlist.
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={aiHealthLoading || watchlist.length === 0}
                  onClick={onGenerateAiHealth}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${aiHealthLoading ? 'animate-spin' : ''}`} />
                  <span>Cập nhật</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAiHealthDrawerOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                  aria-label="Đóng"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {aiHealthLoading && !aiHealth ? (
              <div className="flex flex-1 flex-col items-center justify-center py-16 text-xs text-slate-500">
                <Activity className="mb-2 h-5 w-5 animate-spin text-emerald-600" />
                Đang phân tích sức khỏe danh mục Watchlist...
              </div>
            ) : !aiHealth ? (
              <div className="py-12 text-center text-xs text-slate-500">
                Bấm Cập nhật để AI tóm tắt sức khỏe Watchlist.
              </div>
            ) : (
              <div className="mt-4 space-y-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950">
                  <span
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                      aiHealth.overallStance === 'Tích cực'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : aiHealth.overallStance === 'Phòng thủ'
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                          : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                    }`}
                  >
                    Trạng thái: {aiHealth.overallStance}
                  </span>
                  <div className="flex items-center gap-3 text-xs tabular-nums">
                    <span className="text-emerald-700 dark:text-emerald-400">
                      Khỏe: <strong>{aiHealth.strongestSymbol}</strong>
                    </span>
                    <span className="text-rose-700 dark:text-rose-400">
                      Lưu ý: <strong>{aiHealth.riskiestSymbol}</strong>
                    </span>
                  </div>
                </div>

                <ul className="space-y-2 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 text-xs leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
                  {aiHealth.bullets.map((b, i) => (
                    <li key={i}>• {b}</li>
                  ))}
                </ul>

                <p className="text-[11px] text-slate-500 dark:text-slate-400">{aiHealth.disclaimer}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
