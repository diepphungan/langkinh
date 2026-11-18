export type NewsCategoryId =
  | 'tong-hop'
  | 'viet-nam'
  | 'kinh-te'
  | 'cong-nghe'
  | 'the-gioi'
  | 'khoa-hoc';

export type VisualDesk = 'economy' | 'tech' | 'world' | 'climate';

export type ImpactLevel = 'Cao' | 'Trung bình' | 'Theo dõi';

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface SentimentBreakdown {
  positive: number;
  neutral: number;
  negative: number;
  toneLabel: string;
}

export interface StoryPerspective {
  actor: string;
  stance: string;
}

export interface ArticleLink {
  title: string;
  url: string;
  source: string;
}

export interface NewsStory {
  id: string;
  title: string;
  deck: string;
  category: string;
  visualDesk: VisualDesk;
  publishedRelative: string;
  readTimeMinutes: number;
  executiveTakeaways: string[];
  sentiment: SentimentBreakdown;
  perspectives: StoryPerspective[];
  keyEntities: string[];
  impactLevel: ImpactLevel;
  sourceOutlets: string[];
  contextSummary: string;
  articleLinks: ArticleLink[];
}

export interface DominantTheme {
  theme: string;
  storyCount: number;
  momentum: 'Tăng nhanh' | 'Ổn định' | 'Hạ nhiệt';
  brief: string;
}

export interface NewsDigestResponse {
  category: NewsCategoryId;
  query: string;
  generatedAt: string;
  editionSummary: string;
  dominantThemes: DominantTheme[];
  stories: NewsStory[];
  groundingSources: GroundingSource[];
}

export interface DeepPerspective {
  stakeholder: string;
  framing: string;
  summary: string;
}

export interface FactCheckClaim {
  claim: string;
  status: 'Đã xác thực' | 'Cần đối chiếu' | 'Quan điểm / Dự báo';
  context: string;
}

export interface DeepAnalysisReport {
  id: string;
  analyzedAt: string;
  headline: string;
  sourceSummary: string;
  executiveSummary: string[];
  sentiment: SentimentBreakdown & {
    objectivityNote: string;
  };
  perspectives: DeepPerspective[];
  factChecks: FactCheckClaim[];
  impactHorizon: {
    shortTerm: string;
    longTerm: string;
    affectedSectors: string[];
  };
  editorialQuestions: string[];
  groundingSources: GroundingSource[];
}

export interface FollowUpExchange {
  question: string;
  answer: string;
  sources: GroundingSource[];
  timestamp: string;
}

/* --- NLP Classification, Summarization & Sentiment Module Types --- */

export type PredefinedTopicCategory =
  | 'Kinh doanh'
  | 'Giải trí'
  | 'Khoa học'
  | 'Công nghệ'
  | 'Thể thao'
  | 'Sức khỏe'
  | 'Chính trị & Xã hội'
  | 'Thế giới';

export type SentimentVerdict = 'Tích cực' | 'Tiêu cực' | 'Trung lập';

export type SummaryLengthOption = 'ngan' | 'tieu-chuan';

export interface ArticleClassificationResult {
  primaryCategory: string;
  confidencePercent: number;
  secondaryCategory: string | null;
  topicSignals: string[];
  rationale: string;
}

export interface ArticleSummaryResult {
  generatedTitle: string;
  conciseSummary: string;
  keyPoints: string[];
  originalWordCount: number;
  summaryWordCount: number;
  compressionPercent: number;
}

export interface ArticleSentimentResult {
  label: SentimentVerdict;
  confidencePercent: number;
  scores: SentimentBreakdown;
  evidencePhrases: string[];
  explanation: string;
}

export interface ArticleProcessResult {
  id: string;
  processedAt: string;
  inputExcerpt: string;
  classification: ArticleClassificationResult;
  summary: ArticleSummaryResult;
  sentiment: ArticleSentimentResult;
  groundingSources: GroundingSource[];
}

export interface BatchClassifiedItem {
  index: number;
  title: string;
  excerpt: string;
  primaryCategory: string;
  confidencePercent: number;
  sentimentLabel: SentimentVerdict;
  sentimentScorePositive: number;
  sentimentScoreNeutral: number;
  sentimentScoreNegative: number;
  shortSummary: string;
  keyTakeaway: string;
}

export interface BatchClassifyResponse {
  processedAt: string;
  categoriesUsed: string[];
  items: BatchClassifiedItem[];
}

/* --- Custom News Sources Types --- */

export interface NewsSourceConfig {
  id: string;
  name: string;
  url: string;
  domain: string;
  defaultCategory: string;
  enabled: boolean;
  addedAt: string;
  lastFetchedAt?: string;
  packId?: TopicPackId;
  kind?: 'rss' | 'googlenews' | 'hackernews' | 'gdelt' | 'api';
  origin?: 'seed' | 'discovered' | 'watchlist' | 'keyword' | 'custom';
}

export interface FetchedSourceArticle {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceDomain: string;
  title: string;
  url: string;
  publishedRelative: string;
  category: string;
  summary: string;
  keyTakeaway: string;
  sentimentLabel: SentimentVerdict;
  sentiment: SentimentBreakdown;
  dedupStatus?: 'new' | 'updated';
  existingDocId?: string;
  updateReason?: string;
}

export interface SourceFetchStatus {
  sourceId: string;
  sourceName: string;
  method: 'RSS/Atom' | 'Public API' | 'Trích xuất web' | 'AI Biến động';
  articleCount: number;
  error?: string;
}

export interface SourceFetchResponse {
  fetchedAt: string;
  statuses: SourceFetchStatus[];
  articles: FetchedSourceArticle[];
  botReport?: DedupBotReport;
}

export interface CrawledArticleResult {
  url: string;
  sourceDomain: string;
  title: string;
  publishedDate: string;
  keywords: string[];
  topImage: string | null;
  contentParagraphs: string[];
  wordCount: number;
  crawlMethod: 'HTML DOM' | 'Gemini URL Context';
  nlpAnalysis?: ArticleProcessResult;
}

export interface ReadingHistoryEntry {
  id: string;
  title: string;
  category: string;
  sourceName: string;
  url?: string;
  readAt: string;
  story?: NewsStory;
}

export interface StoryComment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface WeatherSnapshot {
  city: string;
  temperatureC: number;
  conditionLabel: string;
  humidityPercent: number;
  windKmh: number;
}

export type PublicApiProviderId = 'spaceflight' | 'hackernews' | 'devto' | 'gdelt';

export interface PublicApiCatalogItem {
  id: string;
  name: string;
  category: 'Tin tức' | 'Khoa học & Công nghệ' | 'Dữ liệu mở' | 'Phân tích văn bản';
  description: string;
  auth: 'Không cần key' | 'apiKey' | 'OAuth';
  https: boolean;
  cors: 'Yes' | 'No' | 'Unknown';
  docsUrl: string;
  endpointUrl?: string;
  liveProviderId?: PublicApiProviderId;
  defaultCategory: string;
}

export interface DiscoveredRssFeed {
  name: string;
  url: string;
  domain: string;
  defaultCategory: string;
}

export type StoredArticleStatus = 'unread' | 'reviewed' | 'archived';

export interface StoredNewsArticle {
  id: string;
  ownerId: string;
  title: string;
  url: string;
  sourceName: string;
  sourceDomain: string;
  category: string;
  publishedRelative: string;
  summary: string;
  keyTakeaway: string;
  sentimentLabel: SentimentVerdict;
  sentimentPositive: number;
  sentimentNeutral: number;
  sentimentNegative: number;
  fetchedMethod: string;
  notes: string;
  tags?: string[];
  status: StoredArticleStatus;
  createdAt: string;
  updatedAt: string;
  syncedToCloud?: boolean;
}

export type AutoFetchIntervalMinutes = 1 | 5 | 15 | 30 | 60;

export interface ApiUsageProviderSnapshot {
  id: string;
  name: string;
  category: string;
  limitDescription: string;
  windowLimit: number | null;
  windowSeconds: number;
  callsInWindow: number;
  totalCalls: number;
  successCalls: number;
  rateLimitedCalls: number;
  errorCalls: number;
  lastCalledAt: string | null;
  lastStatus: number | null;
  lastLatencyMs: number | null;
  cooldownRemainingSeconds: number;
}

export interface ApiCallRecord {
  id: string;
  timestamp: string;
  apiId: string;
  apiName: string;
  endpoint: string;
  statusCode: number;
  ok: boolean;
  latencyMs: number;
  detail?: string;
}

export interface ApiUsageResponse {
  snapshotAt: string;
  providers: ApiUsageProviderSnapshot[];
  recentCalls: ApiCallRecord[];
}

export interface ExistingArticleFingerprint {
  id: string;
  url: string;
  title: string;
  summary: string;
}

export type BotDecisionType = 'new' | 'skipped_duplicate' | 'updated_content';

export interface BotAuditEntry {
  id: string;
  timestamp: string;
  sourceName: string;
  title: string;
  url: string;
  decision: BotDecisionType;
  similarityPercent: number;
  reason: string;
  matchedArticleId?: string;
}

export interface DedupBotReport {
  checkedAt: string;
  totalScanned: number;
  newCount: number;
  updatedCount: number;
  skippedDuplicateCount: number;
  decisions: BotAuditEntry[];
}

/* --- AI Content Recommendation & Volatility News Collector Types --- */

export type VolatilityScopeId =
  | 'tat-ca'
  | 'kinh-te-tai-chinh'
  | 'cong-nghe-an-ninh'
  | 'dia-chinh-tri'
  | 'thoi-tiet-nang-luong';

export interface VolatilityAlertItem {
  id: string;
  headline: string;
  sector: string;
  volatilityLevel: 'Khẩn cấp' | 'Biến động cao' | 'Đáng chú ý';
  signalMetric: string;
  impactSummary: string;
  sourceName: string;
  sourceUrl: string;
  publishedRelative: string;
}

export interface VolatilityCollectionResponse {
  collectedAt: string;
  focusScope: VolatilityScopeId;
  volatilityIndexLabel: 'Biến động mạnh' | 'Chú ý cao' | 'Ổn định';
  marketPulseSummary: string;
  volatilityAlerts: VolatilityAlertItem[];
  collectedArticles: FetchedSourceArticle[];
  botReport?: DedupBotReport;
  groundingSources: GroundingSource[];
}

export interface AiTopicRecommendation {
  id: string;
  angleTitle: string;
  topicQuery: string;
  suggestedCategory: NewsCategoryId;
  priority: 'Nên đọc ngay' | 'Mở rộng góc nhìn' | 'Theo dõi xu hướng';
  reason: string;
}

export interface AiSuggestedArticle {
  title: string;
  url: string;
  source: string;
  category: string;
  whyRecommended: string;
}

export interface AiSuggestedSource {
  name: string;
  url: string;
  defaultCategory: string;
  reason: string;
}

export interface AiRecommendationResponse {
  generatedAt: string;
  personalizedBrief: string;
  recommendedTopics: AiTopicRecommendation[];
  suggestedArticles: AiSuggestedArticle[];
  suggestedSources: AiSuggestedSource[];
  groundingSources: GroundingSource[];
}

/* --- Finance, SSI FastConnect Data & Watchlist Alert Types --- */

export type MarketExchange = 'HOSE' | 'HNX' | 'UPCOM';
export type NewsSensitivity = 'bearish' | 'bullish' | 'all';
export type FinanceAlertSeverity = 'critical' | 'warning' | 'opportunity';
export type MarketDataSourceMode = 'ssi' | 'fallback';

export interface SsiSecurityItem {
  symbol: string;
  exchange: MarketExchange;
  companyName: string;
  companyNameEn?: string;
}

export interface MarketIndexQuote {
  indexId: 'VN-Index' | 'VN30' | 'HNX-Index';
  value: number;
  change: number;
  changePct: number;
  volume: number;
  tradingDate: string;
  sourceMode: MarketDataSourceMode;
}

export interface MacroQuoteItem {
  id: 'USD/VND' | 'Vàng SJC';
  valueText: string;
  changePct: number;
  sourceNote: string;
}

export interface StockQuoteSnapshot {
  symbol: string;
  exchange: MarketExchange;
  companyName: string;
  price: number; // VND
  refPrice: number;
  ceilingPrice: number;
  floorPrice: number;
  change: number;
  changePct: number;
  volume: number;
  valueVnd: number;
  foreignBuyVol: number;
  foreignSellVol: number;
  foreignNetVol: number;
  tradingDate: string;
  sourceMode: MarketDataSourceMode;
}

export type ChartTimeframe = 'intraday' | '1D' | '1W' | '1M' | '3M';

export type CorporateEventCategory =
  | 'dividend_dilution'
  | 'insider_trading'
  | 'ma_restructuring'
  | 'contracts_projects';

export type CashflowAnomalyDirection =
  | 'accumulation'
  | 'distribution'
  | 'foreign_spike'
  | 'cfo_divergence';

export interface CashflowAnomalyItem {
  id: string;
  symbol: string;
  companyName: string;
  exchange: MarketExchange;
  direction: CashflowAnomalyDirection;
  title: string;
  detail: string;
  price: number;
  changePct: number;
  volumeRatio20: number;
  foreignNetVol: number;
  severity: 'critical' | 'warning' | 'opportunity';
  detectedAt: string;
}

export interface AnomalyRadarResponse {
  scannedAt: string;
  scannedSymbolsCount: number;
  anomalies: CashflowAnomalyItem[];
  summaryCounts: {
    accumulation: number;
    distribution: number;
    foreignSpike: number;
    cfoDivergence: number;
  };
}

export type ErraticPatternType =
  | 'v_shape_reversal'
  | 'inverted_v_pullback'
  | 'whipsaw_stophunt'
  | 'gap_liquidity_vacuum';

export type ErraticPatternDisplayLabel =
  | 'Rút chân đảo chiều mạnh'
  | 'Kéo xả cuối phiên'
  | 'Giật lắc 2 đầu'
  | 'Tăng trần/Giảm sàn đột biến';

export interface IntradaySessionPoint {
  time: string;
  price: number;
  volume: number;
  changePctFromRef: number;
}

export interface IntradayErraticMover {
  symbol: string;
  exchange: MarketExchange;
  companyName: string;
  price: number;
  refPrice: number;
  openPrice: number;
  dayHigh: number;
  dayLow: number;
  change: number;
  changePct: number;
  intradayAmplitudePct: number;
  pricePositionInRangePct: number;
  atr14Pct: number;
  amplitudeVsAtrRatio: number;
  volume: number;
  valueVnd: number;
  volumeRatio15m: number;
  foreignNetVol: number;
  vnIndexChangePct: number;
  betaDeviationPct: number;
  patternType: ErraticPatternType;
  patternLabel: ErraticPatternDisplayLabel;
  erraticScore: number;
  signalsTriggered: string[];
  intradayPath: IntradaySessionPoint[];
  sourceMode: MarketDataSourceMode;
}

export interface ErraticMoversResponse {
  scannedAt: string;
  marketDataMode: MarketDataSourceMode;
  vnIndexChangePct: number;
  scannedUniverseCount: number;
  qualifiedLiquidityCount: number;
  movers: IntradayErraticMover[];
  summaryStats: {
    totalDetected: number;
    vShapeCount: number;
    invertedVCount: number;
    whipsawCount: number;
    gapVacuumCount: number;
  };
}

export type ErraticRootCauseCategory =
  | 'Hấp thụ tin tức / Sự kiện bất ngờ'
  | 'Rũ bỏ kỹ thuật / Gom hàng (Shakeout)'
  | 'Bẫy tăng giá / Phân phối đỉnh (Bull Trap / Distribution)'
  | 'Nhiễu thanh khoản / Đáo hạn phái sinh & ETF';

export type TrapRiskLevel = 'Thấp' | 'Trung bình' | 'Cao';

export interface ErraticMoverAiDiagnosis {
  generatedAt: string;
  mode: 'gemini' | 'quantitative';
  cached: boolean;
  symbol: string;
  scope: 'single' | 'group';
  rootCauseCategory: ErraticRootCauseCategory;
  rootCauseAnalysis: string;
  trapRiskLevel: TrapRiskLevel;
  trapRiskWarning: string;
  holderAction: string;
  cashAction: string;
  tPlus1BalanceZone: string;
  foreignAndNewsContext: string;
  matchedNewsCount: number;
  groupHighlights?: Array<{
    symbol: string;
    patternLabel: string;
    diagnosis: string;
    trapRisk: TrapRiskLevel;
    action: string;
  }>;
  disclaimer: string;
}

export interface CorporateEventItem {
  id: string;
  symbol: string;
  category: CorporateEventCategory;
  categoryLabel: string;
  title: string;
  summary: string;
  sourceName: string;
  url: string;
  publishedRelative: string;
  eventDate: string;
  impactLabel: FinanceArticleImpactLabel;
  keyMetrics: string[];
}

export interface CorporateEventsResponse {
  scannedAt: string;
  totalScanned: number;
  events: CorporateEventItem[];
  botReport: DedupBotReport;
  byCategoryCount: Record<CorporateEventCategory, number>;
}

export type CandlestickPatternId =
  | 'hammer'
  | 'dragonfly_doji'
  | 'bullish_engulfing'
  | 'morning_star'
  | 'piercing_line'
  | 'shooting_star'
  | 'gravestone_doji'
  | 'bearish_engulfing'
  | 'evening_star'
  | 'dark_cloud_cover'
  | 'three_white_soldiers'
  | 'marubozu_breakout';

export interface CandlestickSignalItem {
  id: string;
  date: string;
  patternId: CandlestickPatternId;
  patternName: string;
  signalType: 'BUY' | 'SELL';
  price: number;
  confidencePct: number;
  confluenceNotes: string[];
  reason: string;
}

export type TradeSetupStatus =
  | 'ĐANG TRONG VÙNG MUA'
  | 'ĐÃ CHẠM TP1'
  | 'VI PHẠM CẮT LỖ'
  | 'TÍN HIỆU THOÁT LỆNH';

export interface TradeSetupPlan {
  activePatternName: string;
  signalType: 'BUY' | 'SELL' | 'NEUTRAL';
  confidencePct: number;
  status: TradeSetupStatus;
  entryZoneLow: number;
  entryZoneHigh: number;
  tp1Price: number;
  tp1Pct: number;
  tp2Price: number;
  tp2Pct: number;
  slPrice: number;
  slPct: number;
  riskRewardRatio: number;
  explanation: string;
}

export type PricedInStatus =
  | 'Chưa phản ánh'
  | 'Phản ánh một phần'
  | 'Đã phản ánh vào giá';

export type SectorPosition = 'Đầu tàu dẫn dắt' | 'Theo sóng ngành' | 'Chạy sau';

export interface FourAngleStrategyResponse {
  generatedAt: string;
  symbol: string;
  mode: 'gemini' | 'quantitative';
  cached: boolean;
  pricedInStatus: PricedInStatus;
  sectorPosition: SectorPosition;
  winRatePct: number;
  riskRewardRatio: number;
  angles: {
    internalGovernance: {
      title: string;
      score: number;
      summary: string;
      catalysts: string[];
    };
    sectorPositioning: {
      title: string;
      score: number;
      summary: string;
      peerNote: string;
    };
    macroRegional: {
      title: string;
      score: number;
      summary: string;
      keyDrivers: string[];
    };
    marketReaction: {
      title: string;
      score: number;
      summary: string;
      strategyAction: string;
    };
  };
  executiveVerdict: string;
  disclaimer: string;
}

export type PeerTimeframe = '1W' | '1M' | '3M';

export interface NormalizedPerformancePoint {
  date: string;
  [symbol: string]: string | number;
}

export interface PeerStockRow {
  symbol: string;
  companyName: string;
  exchange: MarketExchange;
  price: number;
  changePct: number;
  perf1W: number;
  perf1M: number;
  perf3M: number;
  volumeRatio20: number;
  anomalyLabel: string;
  foreignNetVol: number;
  ma20Status: string;
  rsi14: number | null;
  bbPosition: string;
  latestSignalLabel: string;
  cashflowScore: number;
  corporateEvents30dCount: number;
  corporateEventsSummary: string;
  pricedInStatus: PricedInStatus;
  winRatePct: number;
  entryPrice: number;
  tp1Price: number;
  slPrice: number;
  riskRewardRatio: number;
  action: MarketTimingAction;
}

export interface PeerComparisonResponse {
  generatedAt: string;
  timeframe: PeerTimeframe;
  symbols: string[];
  normalizedSeries: NormalizedPerformancePoint[];
  rows: PeerStockRow[];
  leaders: {
    bestPerfSymbol: string;
    strongestFlowSymbol: string;
    bestTechnicalSymbol: string;
    bestRiskRewardSymbol: string;
  };
}

export interface PeerAiRankingResponse {
  generatedAt: string;
  timeframe: PeerTimeframe;
  mode: 'gemini' | 'quantitative';
  cached: boolean;
  top_pick_ticker: string;
  marketMacroNote: string;
  rankings: Array<{
    rank: number;
    symbol: string;
    score: number;
    allocationPct: number;
    reason: string;
  }>;
}

export interface OhlcBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ma20?: number | null;
  ma50?: number | null;
  bbUpper?: number | null;
  bbMiddle?: number | null;
  bbLower?: number | null;
  volMa20?: number | null;
  rsi14?: number | null;
  newsMarkerImpact?: FinanceArticleImpactLabel;
  newsMarkerTitles?: string[];
  candleSignalType?: 'BUY' | 'SELL';
  candlePatternName?: string;
  candleConfidencePct?: number;
  candleReason?: string;
  corpEventTitle?: string;
  corpEventCategory?: CorporateEventCategory;
}

export interface TechnicalIndicatorsSnapshot {
  ma20: number | null;
  ma50: number | null;
  bbUpper: number | null;
  bbMiddle: number | null;
  bbLower: number | null;
  volMa20: number | null;
  rsi14: number | null;
  support: number;
  resistance: number;
  priceVsMa20Pct: number | null;
  volumeRatio20: number | null;
  trendSignal: 'Tăng' | 'Tích lũy' | 'Suy yếu';
}

export type ReversalSignalType =
  | 'rsi_bullish_div'
  | 'rsi_bearish_div'
  | 'golden_cross_vol'
  | 'hammer_support'
  | 'engulfing_bull'
  | 'engulfing_bear';

export interface ReversalSignalItem {
  id: string;
  date: string;
  type: ReversalSignalType;
  direction: 'bullish' | 'bearish';
  label: string;
  price: number;
  description: string;
  strength: 'Cao' | 'Trung bình';
}

export interface RiskRewardSummary {
  sampleSessions: number;
  sampleSignalsCount: number;
  winProbabilityPct: number;
  tp1Price: number;
  tp1Pct: number;
  tp2Price: number;
  tp2Pct: number;
  slPrice: number;
  slPct: number;
  riskRewardRatio: number;
  signalBasis: string;
}

export type MarketTimingAction =
  | 'MUA THĂM DÒ'
  | 'GIA TĂNG TỶ TRỌNG'
  | 'CHỜ ĐIỀU CHỈNH'
  | 'CHỐT LỜI / ĐỨNG NGOÀI';

export interface CashflowPillarScore {
  score: number;
  summary: string;
}

export interface CorporateCashflowTimingResponse {
  generatedAt: string;
  symbol: string;
  mode: 'gemini' | 'quantitative';
  cached: boolean;
  cashflowScore: number;
  pillars: {
    operatingCashflow: CashflowPillarScore;
    foreignInstitutionalFlow: CashflowPillarScore;
    newsGrowthMomentum: CashflowPillarScore;
  };
  timingAction: MarketTimingAction;
  optimalEntryZone: string;
  liquidityCondition: string;
  summaryThesis: string;
  evidenceFromNewsCount: number;
  disclaimer: string;
}

export interface StockChartTechnicalResponse {
  generatedAt: string;
  symbol: string;
  timeframe: ChartTimeframe;
  marketDataMode: MarketDataSourceMode;
  quote: StockQuoteSnapshot;
  ohlc: OhlcBar[];
  indicators: TechnicalIndicatorsSnapshot;
  reversalSignals: ReversalSignalItem[];
  riskReward: RiskRewardSummary;
  candlestickSignals: CandlestickSignalItem[];
  tradeSetup: TradeSetupPlan;
  anomalies: CashflowAnomalyItem[];
}

export interface WatchlistItemConfig {
  symbol: string;
  exchange: MarketExchange;
  companyName: string;
  priceChangeThresholdPct: number;
  targetPrice: number;
  stopLossPrice: number;
  newsSensitivity: NewsSensitivity;
  notes: string;
  createdAt: string;
  updatedAt: string;
  syncedToCloud?: boolean;
}

export type FinanceArticleImpactLabel = 'Rủi ro cao' | 'Hỗ trợ tăng' | 'Trung lập';

export interface FinanceTaggedArticle {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceDomain: string;
  title: string;
  url: string;
  publishedRelative: string;
  summary: string;
  impactLabel: FinanceArticleImpactLabel;
  sentimentLabel: SentimentVerdict;
  matchedTickers: string[];
  dedupStatus?: 'new' | 'updated';
  existingDocId?: string;
  updateReason?: string;
  fetchedArticle: FetchedSourceArticle;
}

export type FinanceAlertTriggerType =
  | 'price_drop'
  | 'price_breakout'
  | 'volume_spike'
  | 'news_bearish'
  | 'news_bullish'
  | 'news_any'
  | 'target_hit'
  | 'stop_loss';

export interface FinanceAlertItem {
  id: string;
  symbol: string;
  severity: FinanceAlertSeverity;
  title: string;
  message: string;
  triggerType: FinanceAlertTriggerType;
  articleUrl: string;
  priceSnapshot: number;
  changePctSnapshot: number;
  read: boolean;
  createdAt: string;
  updatedAt: string;
  webhookSent?: boolean;
}

export interface FinanceRuntimeSettingsStatus {
  ssiConfigured: boolean;
  ssiSource: 'env' | 'runtime' | 'none';
  ssiConsumerIdMasked: string;
  tokenCached: boolean;
  tokenExpiresAt: string | null;
  webhookConfigured: boolean;
  webhookUrlMasked: string;
  securitiesCount: number;
  securitiesCachedAt: string | null;
  marketDataMode: MarketDataSourceMode;
}

export type StockSectorGroup =
  | 'BANK'
  | 'SECURITIES'
  | 'STEEL'
  | 'TECH_RETAIL'
  | 'REAL_ESTATE'
  | 'OIL_GAS'
  | 'CONSUMER'
  | 'INDUSTRIAL'
  | 'OTHER';

export type ValuationMetricKind = 'P/B' | 'P/E';

export type WatchlistVerdictLabel =
  | 'MUA MẠNH / TÍCH LŨY'
  | 'MUA THĂM DÒ'
  | 'NẮM GIỮ / THEO DÕI'
  | 'CHỐT LỜI / HẠ TỶ TRỌNG';

export type WatchlistLiquidityTier = 'strong' | 'stable' | 'low';
export type WatchlistRoeTier = 'high' | 'medium' | 'low';
export type WatchlistValuationTier = 'cheap' | 'fair' | 'expensive';
export type WatchlistMaPosition = 'above_both' | 'cross_up_ma20' | 'below_both' | 'mixed';

export interface WatchlistStockAnalytics {
  symbol: string;
  sectorGroup: StockSectorGroup;
  sectorLabel: string;
  liquidity: {
    volume: number;
    valueBillionVnd: number;
    ma20Vol: number;
    ma20VolPct: number;
    tier: WatchlistLiquidityTier;
    label: string;
  };
  fundamentals: {
    roePct: number;
    roeTier: WatchlistRoeTier;
    roeLabel: string;
    roeSource: 'ssi_details' | 'kho_tin' | 'baseline';
    quarterLabel: string;
    pe: number | null;
    pb: number | null;
    primaryMetric: ValuationMetricKind;
    primaryValue: number;
    sectorAvgValue: number;
    diffVsSectorPct: number;
    valuationTier: WatchlistValuationTier;
    valuationLabel: string;
  };
  timing: {
    ma20: number | null;
    ma50: number | null;
    maPosition: WatchlistMaPosition;
    maPositionLabel: string;
    rsi14: number | null;
    rsiZoneLabel: string;
  };
  recommendation: {
    totalScore: number;
    verdict: WatchlistVerdictLabel;
    breakdown: {
      fundamentalScore: number;
      timingScore: number;
      liquidityScore: number;
      newsScore: number;
    };
    reasons: string[];
    suggestedBuyZone: string;
    riskWarning?: string;
  };
}

export interface PortfolioStrategyBasketItem {
  symbol: string;
  companyName: string;
  price: number;
  changePct: number;
  score: number;
  verdict: WatchlistVerdictLabel;
  buyZoneOrSupport: string;
  rationale: string;
  allocationPct: number;
}

export interface WatchlistPortfolioStrategyResponse {
  generatedAt: string;
  mode: 'gemini' | 'quantitative';
  cached: boolean;
  marketContextNote: string;
  baskets: {
    priorityBuy: PortfolioStrategyBasketItem[];
    holdOptimize: PortfolioStrategyBasketItem[];
    riskRestructure: PortfolioStrategyBasketItem[];
  };
  aiDetailedAllocation: Array<{
    symbol: string;
    suggestedWeightPct: number;
    stance: string;
    capitalPlan: string;
  }>;
  overallStrategySummary: string;
  disclaimer: string;
}

export interface FinanceOverviewResponse {
  fetchedAt: string;
  marketDataMode: MarketDataSourceMode;
  warningNote?: string;
  indices: MarketIndexQuote[];
  macroQuotes?: MacroQuoteItem[];
  quotes: Record<string, StockQuoteSnapshot>;
  analytics?: Record<string, WatchlistStockAnalytics>;
}

export interface WatchlistScanResponse {
  scannedAt: string;
  marketDataMode: MarketDataSourceMode;
  warningNote?: string;
  indices: MarketIndexQuote[];
  macroQuotes?: MacroQuoteItem[];
  quotes: Record<string, StockQuoteSnapshot>;
  analytics?: Record<string, WatchlistStockAnalytics>;
  taggedArticles: FinanceTaggedArticle[];
  fetchedForStorage: FetchedSourceArticle[];
  statuses: SourceFetchStatus[];
  alerts: FinanceAlertItem[];
  botReport: DedupBotReport;
  webhookDeliveries: {
    attempted: number;
    sent: number;
    failed: number;
  };
  sourcesScanned: Array<{
    name: string;
    domain: string;
    count: number;
    error?: string;
  }>;
}

export interface WatchlistAiHealthResponse {
  generatedAt: string;
  mode: 'gemini' | 'quantitative';
  overallStance: 'Phòng thủ' | 'Cân bằng' | 'Tích cực';
  strongestSymbol: string;
  riskiestSymbol: string;
  bullets: string[];
  disclaimer: string;
}

export interface StockPredictionHorizon {
  direction: 'Tăng' | 'Đi ngang' | 'Giảm';
  probUp: number;
  probSideways: number;
  probDown: number;
  targetRange: string;
  thesis: string;
}

export interface StockPredictionResponse {
  generatedAt: string;
  symbol: string;
  companyName: string;
  exchange: MarketExchange;
  timeframe: ChartTimeframe;
  marketDataMode: MarketDataSourceMode;
  predictionMode: 'gemini' | 'quantitative';
  quote: StockQuoteSnapshot;
  ohlc: OhlcBar[];
  indicators: TechnicalIndicatorsSnapshot;
  reversalSignals: ReversalSignalItem[];
  riskReward: RiskRewardSummary;
  candlestickSignals: CandlestickSignalItem[];
  tradeSetup: TradeSetupPlan;
  anomalies: CashflowAnomalyItem[];
  corporateEvents?: CorporateEventItem[];
  newsMarkers: Array<{
    title: string;
    impactLabel: FinanceArticleImpactLabel;
    publishedRelative: string;
    url: string;
    sourceName: string;
    barDate?: string;
  }>;
  outlookT3: StockPredictionHorizon;
  outlookT10: StockPredictionHorizon;
  catalysts: string[];
  risks: string[];
  actionPlan: string;
}

/* --- Auto-Discovery Crawler Bot & Topic Packs Types --- */

export type TopicPackId =
  | 'thoi-su'
  | 'chung-khoan'
  | 'tai-chinh'
  | 'bat-dong-san'
  | 'cong-nghe'
  | 'the-gioi'
  | 'mang-xa-hoi'
  | 'watchlist';

export interface TopicPackMeta {
  id: TopicPackId;
  name: string;
  description: string;
  feedCount: number;
  sampleDomains: string[];
}

export interface PersistentSourcesState {
  version: number;
  updatedAt: string;
  sources: NewsSourceConfig[];
  activeTopicPacks: TopicPackId[];
  customKeywords: string[];
  botAutoScanEnabled: boolean;
  autoFetchInterval: AutoFetchIntervalMinutes;
}

export interface SourcesSyncBadgeStatus {
  diskSaved: boolean;
  localSaved: boolean;
  cloudSaved: boolean;
  cloudSyncing: boolean;
  lastSavedAt: string | null;
}

export interface CrawlerLogEntry {
  id: string;
  timestamp: string;
  sourceName: string;
  status: 'ok' | 'error' | 'skipped';
  newCount: number;
  updatedCount: number;
  skippedCount: number;
  matchedTickers: string[];
  message: string;
}

export interface AutoDiscoveryScanResponse {
  scannedAt: string;
  activePacks: TopicPackId[];
  scannedSourcesCount: number;
  newCount: number;
  updatedCount: number;
  skippedDuplicateCount: number;
  matchedTickers: string[];
  articles: FetchedSourceArticle[];
  taggedArticles: FinanceTaggedArticle[];
  logs: CrawlerLogEntry[];
  statuses: SourceFetchStatus[];
  botReport: DedupBotReport;
}

export interface SmartDiscoveryResponse {
  input: string;
  resolvedType: 'domain' | 'keyword';
  discoveredFeeds: DiscoveredRssFeed[];
  message: string;
}

/* --- Editorial Newsroom, Social Trends & Scheduled Editions Types --- */

export type NewsroomViewMode = 'live' | 'morning' | 'afternoon';

export type GeographicRegion =
  | 'Việt Nam'
  | 'Châu Á'
  | 'Mỹ & Châu Âu'
  | 'Toàn cầu / Quốc tế';

export type NewsroomCategoryBucket =
  | 'Thời sự & Vĩ mô'
  | 'Tài chính & Chứng khoán'
  | 'Thế giới'
  | 'Công nghệ & AI'
  | 'Mạng xã hội'
  | 'Chuyên mục Động';

export type NewsroomDatePreset =
  | 'latest'
  | 'today'
  | 'yesterday'
  | '7d'
  | '30d'
  | '90d'
  | 'custom';

export type SocialPlatformTag =
  | 'TikTok'
  | 'Facebook'
  | 'Threads'
  | 'Google Trends'
  | 'Reddit'
  | 'Cộng đồng VN';

export interface SocialTrendItem {
  id: string;
  title: string;
  platform: SocialPlatformTag;
  viralScore: number;
  growthMetric: string;
  originSummary: string;
  relatedUrl: string;
  sourceName: string;
  sourceDomain: string;
  publishedAtIso: string;
  displayTimestamp: string;
  region: GeographicRegion;
  sentimentLabel: SentimentVerdict;
  streamSource: 'google-news-social' | 'google-trends' | 'vn-community' | 'reddit';
  matchedTickers: string[];
}

export interface PublishedNewsItem {
  id: string;
  title: string;
  summary: string;
  keyTakeaways: string[];
  url: string;
  canonicalUrl: string;
  sourceName: string;
  sourceDomain: string;
  publishedAtIso: string;
  displayTimestamp: string;
  publishedRelative: string;
  category: string;
  newsroomCategory: NewsroomCategoryBucket;
  region: GeographicRegion;
  priorityScore: number;
  viralScore: number;
  platformTag?: SocialPlatformTag;
  growthMetric?: string;
  sourceCount: number;
  sourceOutlets: string[];
  matchedTickers: string[];
  sentimentLabel: SentimentVerdict;
  sentiment: SentimentBreakdown;
  fetchedMethod: string;
  updatedReason?: string;
  priorityBadge?: string;
}

export interface NewsroomFeedResponse {
  fetchedAt: string;
  lastSyncedAt: string | null;
  totalInArchive: number;
  filteredCount: number;
  breakingWire: PublishedNewsItem[];
  leadStory: PublishedNewsItem | null;
  highlightStories: PublishedNewsItem[];
  items: PublishedNewsItem[];
  categoryCounts: Record<NewsroomCategoryBucket, number>;
  regionCounts: Record<GeographicRegion, number>;
  socialTrends: SocialTrendItem[];
  socialStreamsStatus: Array<{
    stream: string;
    ok: boolean;
    count: number;
    note?: string;
  }>;
  syncNote: string;
}

export type EditionType = 'morning' | 'afternoon';

export interface EditionRankedStory {
  rank: number;
  title: string;
  oneLineSummary: string;
  url: string;
  sourceName: string;
  newsroomCategory: NewsroomCategoryBucket;
  region: GeographicRegion;
  priorityScore: number;
  displayTimestamp: string;
  sentimentLabel: SentimentVerdict;
  matchedTickers: string[];
}

export interface NewsroomEdition {
  editionKey: string;
  dateStr: string;
  editionType: EditionType;
  editionLabel: string;
  windowLabel: string;
  generatedAt: string;
  mode: 'gemini' | 'quantitative';
  executiveHighlights: string[];
  quickMetrics: {
    vnIndexText: string;
    watchlistHighlight: string;
    topSocialTrend: string;
  };
  stories: EditionRankedStory[];
  totalCandidatesReviewed: number;
  sentTelegramAt: string | null;
  sentLarkAt: string | null;
  syncedToCloud?: boolean;
}

export interface WebhookChannelsStatus {
  telegramConfigured: boolean;
  telegramBotTokenMasked: string;
  telegramChatIdMasked: string;
  larkConfigured: boolean;
  larkWebhookUrlMasked: string;
  autoSendEnabled: boolean;
  morningScheduleTime: string;
  afternoonScheduleTime: string;
  timezone: string;
  lastMorningDeliveryAt: string | null;
  lastAfternoonDeliveryAt: string | null;
  lastDeliverySummary: string | null;
}

/* --- Smart Automation Rules Engine Types --- */

export type AutomationConditionType =
  | 'keyword_exclude'
  | 'watchlist_or_macro'
  | 'negative_watchlist_alert'
  | 'custom_keyword_tag';

export type AutomationActionType =
  | 'block_noise'
  | 'pin_priority'
  | 'send_webhook_alert'
  | 'auto_tag';

export interface AutomationRule {
  id: string;
  name: string;
  conditionSummary: string;
  actionSummary: string;
  enabled: boolean;
  conditionType: AutomationConditionType;
  actionType: AutomationActionType;
  keywords: string[];
  sentimentTrigger?: SentimentVerdict | 'any';
  customTag?: string;
  hitCount: number;
  lastTriggeredAt?: string;
  builtin?: boolean;
}

export interface AutomationRulesStats {
  totalEvaluated: number;
  blockedNoiseCount: number;
  prioritizedCount: number;
  webhookAlertsTriggered: number;
}

export interface AutomationRulesState {
  version: number;
  updatedAt: string;
  rules: AutomationRule[];
  stats: AutomationRulesStats;
}

export interface AutomationSandboxResult {
  inputTitle: string;
  sentimentLabel: SentimentVerdict;
  matchedTickers: string[];
  decision: 'blocked' | 'prioritized' | 'alerted' | 'passed';
  decisionLabel: string;
  matchedRules: Array<{
    ruleId: string;
    ruleName: string;
    actionType: AutomationActionType;
    detail: string;
  }>;
  resultingTags: string[];
  priorityScore: number;
}

/* --- Intelligence Lab Types --- */

export interface LabClusterArticle {
  id: string;
  title: string;
  summary: string;
  url: string;
  sourceName: string;
  publishedLabel: string;
  sentimentLabel: SentimentVerdict;
  matchedTickers: string[];
}

export interface LabFactCheckCluster {
  id: string;
  topicTitle: string;
  articleCount: number;
  sources: string[];
  sharedKeywords: string[];
  articles: LabClusterArticle[];
}

export interface LabFactCheckResponse {
  generatedAt: string;
  mode: 'gemini' | 'quantitative';
  topicHeadline: string;
  reliabilityScore: number;
  verdictLabel: 'Đồng thuận cao' | 'Có sai khác góc nhìn' | 'Cần kiểm chứng thêm';
  confirmedFacts: string[];
  outletDivergences: Array<{
    outlet: string;
    framing: string;
    keyDifference: string;
  }>;
  clickbaitWarnings: string[];
  sourcesUsed: Array<{
    title: string;
    url: string;
    sourceName: string;
  }>;
}

export interface LabMacroRippleResponse {
  generatedAt: string;
  mode: 'gemini' | 'quantitative';
  scenarioTitle: string;
  macroThesis: string;
  beneficiarySectors: Array<{
    sector: string;
    impactLevel: 'Mạnh' | 'Trung bình';
    mechanism: string;
  }>;
  riskSectors: Array<{
    sector: string;
    riskLevel: 'Cao' | 'Trung bình';
    mechanism: string;
  }>;
  impactedTickers: Array<{
    symbol: string;
    companyName: string;
    sector: string;
    impact: 'positive' | 'negative' | 'mixed';
    reason: string;
    price: number;
    changePct: number;
    rsi14: number | null;
    maPositionLabel: string;
    verdict: string;
  }>;
}

export interface LabAskArchiveResponse {
  generatedAt: string;
  mode: 'gemini' | 'quantitative';
  question: string;
  executiveAnswer: string;
  keyFindings: string[];
  timelineHighlights: Array<{
    dateLabel: string;
    event: string;
    sourceName: string;
    url: string;
  }>;
  citations: Array<{
    index: number;
    title: string;
    sourceName: string;
    url: string;
    publishedLabel: string;
    sentimentLabel: SentimentVerdict;
  }>;
  totalArchiveSearched: number;
}

