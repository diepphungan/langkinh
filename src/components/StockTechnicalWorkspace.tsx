import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calculator,
  Calendar,
  Compass,
  Crosshair,
  ExternalLink,
  FileText,
  Newspaper,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  CandlestickSignalItem,
  CashflowAnomalyItem,
  ChartTimeframe,
  CorporateCashflowTimingResponse,
  CorporateEventCategory,
  CorporateEventItem,
  FinanceTaggedArticle,
  FourAngleStrategyResponse,
  OhlcBar,
  ReversalSignalItem,
  RiskRewardSummary,
  StockChartTechnicalResponse,
  StockPredictionResponse,
  StoredNewsArticle,
  TechnicalIndicatorsSnapshot,
  TradeSetupPlan,
  WatchlistItemConfig,
} from '../types/news';

export interface StockTechnicalWorkspaceProps {
  loading: boolean;
  error: string | null;
  prediction: StockPredictionResponse | null;
  symbolTitle: string;
  watchlistItem?: WatchlistItemConfig;
  taggedArticles?: FinanceTaggedArticle[];
  storedArticles?: StoredNewsArticle[];
  corporateEvents?: CorporateEventItem[];
  corporateEventsLoading?: boolean;
  onRefreshCorporateEvents?: (forceRefresh?: boolean) => void;
  autoTriggerCashflow?: boolean;
  onAnalyzeNewsUrl: (url: string, title?: string, sourceName?: string) => void;
  onSelectSymbol?: (symbol: string) => void;
}

const TIMEFRAME_OPTIONS: Array<{ id: ChartTimeframe; label: string }> = [
  { id: 'intraday', label: 'Intraday (15m)' },
  { id: '1D', label: '1D' },
  { id: '1W', label: '1W' },
  { id: '1M', label: '1M' },
  { id: '3M', label: '3M' },
];

const GOVERNANCE_FILTER_TABS: Array<{ id: 'all' | CorporateEventCategory; label: string }> = [
  { id: 'all', label: 'Tất cả' },
  { id: 'dividend_dilution', label: 'Kế hoạch & Cổ tức' },
  { id: 'insider_trading', label: 'Cổ đông Nội bộ' },
  { id: 'ma_restructuring', label: 'M&A / Tái cấu trúc' },
  { id: 'contracts_projects', label: 'Hợp đồng & Dự án' },
];

interface CustomChartTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: OhlcBar }>;
}

function TechnicalTooltip({ active, payload }: CustomChartTooltipProps) {
  if (!active || !payload || !payload[0]?.payload) return null;
  const bar = payload[0].payload;
  const isUp = bar.close >= bar.open;

  return (
    <div className="max-w-xs rounded-xl border border-slate-300 bg-white/95 p-3 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900/95">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-1.5 font-mono dark:border-slate-800">
        <span className="font-bold text-slate-900 dark:text-slate-100">{bar.date}</span>
        <span className={isUp ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}>
          {bar.close.toLocaleString('vi-VN')} đ
        </span>
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] tabular-nums text-slate-700 dark:text-slate-300">
        <span>Mở: {bar.open.toLocaleString('vi-VN')}</span>
        <span>Cao: {bar.high.toLocaleString('vi-VN')}</span>
        <span>Thấp: {bar.low.toLocaleString('vi-VN')}</span>
        <span>KL: {bar.volume.toLocaleString('vi-VN')}</span>
        {bar.ma20 ? <span className="text-amber-700 dark:text-amber-400">MA20: {bar.ma20.toLocaleString('vi-VN')}</span> : null}
        {bar.ma50 ? <span className="text-sky-700 dark:text-sky-400">MA50: {bar.ma50.toLocaleString('vi-VN')}</span> : null}
        {bar.rsi14 !== null && bar.rsi14 !== undefined ? <span>RSI(14): {bar.rsi14}</span> : null}
        {bar.bbUpper ? <span>BB: {bar.bbLower?.toLocaleString('vi-VN')}–{bar.bbUpper.toLocaleString('vi-VN')}</span> : null}
      </div>
      {bar.candlePatternName && bar.candleSignalType && (
        <div className="mt-2 border-t border-slate-200 pt-1.5 dark:border-slate-800">
          <p
            className={`font-mono text-[10px] font-bold uppercase ${
              bar.candleSignalType === 'BUY'
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-red-700 dark:text-red-400'
            }`}
          >
            {bar.candleSignalType === 'BUY' ? '▲ Tín hiệu MUA' : '▼ Tín hiệu BÁN'}: {bar.candlePatternName} (
            {bar.candleConfidencePct ?? 70}%)
          </p>
          {bar.candleReason && (
            <p className="mt-0.5 text-[11px] leading-snug text-slate-700 dark:text-slate-300">
              {bar.candleReason}
            </p>
          )}
        </div>
      )}
      {bar.corpEventTitle && (
        <div className="mt-2 border-t border-slate-200 pt-1.5 dark:border-slate-800">
          <p className="font-mono text-[10px] font-bold uppercase text-violet-700 dark:text-violet-400">
            ◆ Sự kiện Quản trị ({bar.corpEventCategory || 'ĐHĐCĐ/Nội bộ'}):
          </p>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-800 dark:text-slate-200">
            {bar.corpEventTitle}
          </p>
        </div>
      )}
      {bar.newsMarkerTitles && bar.newsMarkerTitles.length > 0 && (
        <div className="mt-2 border-t border-slate-200 pt-1.5 dark:border-slate-800">
          <p
            className={`font-mono text-[10px] font-bold uppercase ${
              bar.newsMarkerImpact === 'Rủi ro cao'
                ? 'text-red-700 dark:text-red-400'
                : bar.newsMarkerImpact === 'Hỗ trợ tăng'
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-amber-800 dark:text-amber-400'
            }`}
          >
            Điểm rơi tin ({bar.newsMarkerImpact}):
          </p>
          {bar.newsMarkerTitles.slice(0, 2).map((t, i) => (
            <p key={i} className="mt-0.5 text-[11px] leading-snug text-slate-800 dark:text-slate-200">
              • {t}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function InteractiveTechnicalChart({
  ohlc,
  indicators,
  timeframe,
  loadingTf,
  onSelectTimeframe,
}: {
  ohlc: OhlcBar[];
  indicators: TechnicalIndicatorsSnapshot;
  timeframe: ChartTimeframe;
  loadingTf: boolean;
  onSelectTimeframe: (tf: ChartTimeframe) => void;
}) {
  const [showMa20, setShowMa20] = useState(true);
  const [showMa50, setShowMa50] = useState(true);
  const [showBollinger, setShowBollinger] = useState(true);
  const [showNewsMarkers, setShowNewsMarkers] = useState(true);
  const [showCandleSignals, setShowCandleSignals] = useState(true);
  const [showCorpEvents, setShowCorpEvents] = useState(true);

  const chartData = useMemo(
    () =>
      ohlc.map((b) => ({
        ...b,
        isUp: b.close >= b.open,
      })),
    [ohlc]
  );

  const domainBounds = useMemo<[number, number]>(() => {
    if (chartData.length === 0) return [0, 100];
    const values: number[] = [];
    for (const b of chartData) {
      values.push(b.low, b.high, b.close);
      if (showBollinger && b.bbUpper) values.push(b.bbUpper);
      if (showBollinger && b.bbLower) values.push(b.bbLower);
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.max(100, (max - min) * 0.1);
    return [Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad)];
  }, [chartData, showBollinger]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-2.5 border-b border-slate-200 pb-2.5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-1.5">
          {TIMEFRAME_OPTIONS.map((tf) => (
            <button
              key={tf.id}
              type="button"
              disabled={loadingTf}
              onClick={() => onSelectTimeframe(tf.id)}
              className={`rounded-xl border px-2.5 py-1 font-mono text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                timeframe === tf.id
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
              }`}
            >
              {tf.label}
            </button>
          ))}
          {loadingTf && (
            <span className="ml-1 inline-flex items-center gap-1 font-mono text-[11px] text-amber-800 dark:text-amber-400">
              <Activity className="h-3 w-3 animate-spin" /> Đang tải...
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <button
            type="button"
            onClick={() => setShowMa20((p) => !p)}
            className={`rounded-xl border px-2 py-0.5 font-mono cursor-pointer whitespace-nowrap shrink-0 ${
              showMa20
                ? 'border-amber-600/60 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
                : 'border-slate-200 text-slate-400 dark:border-slate-800'
            }`}
          >
            MA20
          </button>
          <button
            type="button"
            onClick={() => setShowMa50((p) => !p)}
            className={`rounded-xl border px-2 py-0.5 font-mono cursor-pointer whitespace-nowrap shrink-0 ${
              showMa50
                ? 'border-sky-600/60 bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-300'
                : 'border-slate-200 text-slate-400 dark:border-slate-800'
            }`}
          >
            MA50
          </button>
          <button
            type="button"
            onClick={() => setShowBollinger((p) => !p)}
            className={`rounded-xl border px-2 py-0.5 font-mono cursor-pointer whitespace-nowrap shrink-0 ${
              showBollinger
                ? 'border-violet-600/60 bg-violet-50 text-violet-900 dark:bg-violet-950/40 dark:text-violet-300'
                : 'border-slate-200 text-slate-400 dark:border-slate-800'
            }`}
          >
            Bollinger
          </button>
          <button
            type="button"
            onClick={() => setShowCandleSignals((p) => !p)}
            className={`rounded-xl border px-2 py-0.5 font-mono cursor-pointer whitespace-nowrap shrink-0 ${
              showCandleSignals
                ? 'border-emerald-700/60 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400'
                : 'border-slate-200 text-slate-400 dark:border-slate-800'
            }`}
          >
            Nến BUY/SELL
          </button>
          <button
            type="button"
            onClick={() => setShowCorpEvents((p) => !p)}
            className={`rounded-xl border px-2 py-0.5 font-mono cursor-pointer whitespace-nowrap shrink-0 ${
              showCorpEvents
                ? 'border-violet-600/60 bg-violet-50 text-violet-900 dark:bg-violet-950/40 dark:text-violet-300'
                : 'border-slate-200 text-slate-400 dark:border-slate-800'
            }`}
          >
            Mốc ĐHĐCĐ
          </button>
          <button
            type="button"
            onClick={() => setShowNewsMarkers((p) => !p)}
            className={`rounded-xl border px-2 py-0.5 font-mono cursor-pointer whitespace-nowrap shrink-0 ${
              showNewsMarkers
                ? 'border-amber-700/60 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
                : 'border-slate-200 text-slate-400 dark:border-slate-800'
            }`}
          >
            Tin tức
          </button>
        </div>
      </div>

      {chartData.length < 2 ? (
        <div className="flex h-56 items-center justify-center text-xs text-slate-500">
          Chưa đủ dữ liệu nến cho khung thời gian này.
        </div>
      ) : (
        <div className="mt-2.5 space-y-1">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#78716c" strokeOpacity={0.16} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#78716c' }}
                  minTickGap={26}
                  tickLine={false}
                />
                <YAxis
                  domain={domainBounds}
                  orientation="right"
                  tick={{ fontSize: 10, fill: '#78716c' }}
                  tickFormatter={(val: number) => val.toLocaleString('vi-VN')}
                  width={62}
                  tickLine={false}
                />
                <Tooltip content={<TechnicalTooltip />} />

                {indicators.resistance > 0 && (
                  <ReferenceLine
                    y={indicators.resistance}
                    stroke="#dc2626"
                    strokeDasharray="4 4"
                    strokeOpacity={0.55}
                  />
                )}
                {indicators.support > 0 && (
                  <ReferenceLine
                    y={indicators.support}
                    stroke="#059669"
                    strokeDasharray="4 4"
                    strokeOpacity={0.55}
                  />
                )}

                {showBollinger && (
                  <>
                    <Line
                      type="monotone"
                      dataKey="bbUpper"
                      stroke="#7c3aed"
                      strokeWidth={1.1}
                      strokeDasharray="3 3"
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="bbLower"
                      stroke="#7c3aed"
                      strokeWidth={1.1}
                      strokeDasharray="3 3"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </>
                )}

                <Area
                  type="monotone"
                  dataKey="close"
                  stroke="#d97706"
                  strokeWidth={2}
                  fill="#b45309"
                  fillOpacity={0.08}
                  isAnimationActive={false}
                  dot={(props) => {
                    const p = props.payload as OhlcBar | undefined;
                    if (!p || props.cx == null || props.cy == null) {
                      return <g key={`empty-${props.index}`} />;
                    }
                    const cx = props.cx;
                    const cy = props.cy;
                    const newsColor =
                      p.newsMarkerImpact === 'Rủi ro cao'
                        ? '#dc2626'
                        : p.newsMarkerImpact === 'Hỗ trợ tăng'
                          ? '#059669'
                          : '#d97706';

                    const hasNews = Boolean(showNewsMarkers && p.newsMarkerImpact);
                    const hasCorp = Boolean(showCorpEvents && p.corpEventTitle);
                    const hasBuy = Boolean(showCandleSignals && p.candleSignalType === 'BUY');
                    const hasSell = Boolean(showCandleSignals && p.candleSignalType === 'SELL');

                    if (!hasNews && !hasCorp && !hasBuy && !hasSell) {
                      return <g key={`none-${props.index}`} />;
                    }

                    return (
                      <g key={`markers-${props.index}`}>
                        {hasNews && (
                          <rect
                            x={cx - 4}
                            y={cy - 4}
                            width={8}
                            height={8}
                            fill={newsColor}
                            stroke="#ffffff"
                            strokeWidth={1.5}
                          />
                        )}
                        {hasCorp && (
                          <polygon
                            points={`${cx},${cy - 11} ${cx + 5},${cy - 6} ${cx},${cy - 1} ${cx - 5},${cy - 6}`}
                            fill="#7c3aed"
                            stroke="#ffffff"
                            strokeWidth={1.2}
                          />
                        )}
                        {hasBuy && (
                          <g>
                            <polygon
                              points={`${cx},${cy + 6} ${cx - 5.5},${cy + 15} ${cx + 5.5},${cy + 15}`}
                              fill="#10b981"
                              stroke="#ffffff"
                              strokeWidth={1}
                            />
                            <text
                              x={cx}
                              y={cy + 24}
                              textAnchor="middle"
                              fontSize={8}
                              fontWeight="bold"
                              fontFamily="monospace"
                              fill="#047857"
                            >
                              BUY
                            </text>
                          </g>
                        )}
                        {hasSell && (
                          <g>
                            <polygon
                              points={`${cx},${cy - 6} ${cx - 5.5},${cy - 15} ${cx + 5.5},${cy - 15}`}
                              fill="#dc2626"
                              stroke="#ffffff"
                              strokeWidth={1}
                            />
                            <text
                              x={cx}
                              y={cy - 18}
                              textAnchor="middle"
                              fontSize={8}
                              fontWeight="bold"
                              fontFamily="monospace"
                              fill="#b91c1c"
                            >
                              SELL
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  }}
                />

                {showMa20 && (
                  <Line
                    type="monotone"
                    dataKey="ma20"
                    stroke="#d97706"
                    strokeWidth={1.6}
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
                {showMa50 && (
                  <Line
                    type="monotone"
                    dataKey="ma50"
                    stroke="#0284c7"
                    strokeWidth={1.6}
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Synchronized Volume + VolMA20 Subchart */}
          <div className="h-20 w-full border-t border-slate-100 pt-1 dark:border-slate-800/80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                <XAxis dataKey="date" hide />
                <YAxis
                  orientation="right"
                  tick={{ fontSize: 9, fill: '#78716c' }}
                  tickFormatter={(v: number) =>
                    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${Math.round(v / 1000)}k`
                  }
                  width={62}
                  tickLine={false}
                />
                <Bar dataKey="volume" isAnimationActive={false}>
                  {chartData.map((entry, idx) => (
                    <Cell
                      key={`vol-${idx}`}
                      fill={entry.isUp ? '#059669' : '#dc2626'}
                      fillOpacity={0.55}
                    />
                  ))}
                </Bar>
                <Line
                  type="monotone"
                  dataKey="volMa20"
                  stroke="#d97706"
                  strokeWidth={1.4}
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 font-mono text-[10px] text-slate-500 tabular-nums dark:text-slate-400">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-emerald-700 dark:text-emerald-400">▲ BUY (Nến Nhật)</span>
              <span className="text-red-700 dark:text-red-400">▼ SELL (Nến Nhật)</span>
              <span className="text-violet-700 dark:text-violet-400">◆ ĐHĐCĐ/Nội bộ</span>
              <span className="text-amber-700 dark:text-amber-400">■ Tin tức</span>
            </div>
            <span>
              HT: {indicators.support.toLocaleString('vi-VN')} · KC:{' '}
              {indicators.resistance.toLocaleString('vi-VN')} đ ({chartData.length} nến)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function RiskRewardPanel({
  riskReward,
  currentPrice,
}: {
  riskReward: RiskRewardSummary;
  currentPrice: number;
}) {
  const [plannedCapital, setPlannedCapital] = useState<string>('100000000');

  const capitalNum = Math.max(0, Number(plannedCapital.replace(/[^\d]/g, '')) || 0);
  const estProfitTp1 = Math.round(capitalNum * (riskReward.tp1Pct / 100));
  const estProfitTp2 = Math.round(capitalNum * (riskReward.tp2Pct / 100));
  const estMaxLoss = Math.round(capitalNum * (Math.abs(riskReward.slPct) / 100));

  const riskShare = 1 / (1 + Math.max(0.2, riskReward.riskRewardRatio));
  const rewardShare = 1 - riskShare;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5 dark:border-slate-800">
        <div>
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            <Calculator className="h-3.5 w-3.5 text-amber-800 dark:text-amber-400" />
            <span>Xác suất Lợi nhuận &amp; Quản trị Rủi ro ({riskReward.sampleSessions} phiên)</span>
          </h3>
          <p className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
            Cơ sở: {riskReward.signalBasis}
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs tabular-nums">
          <span className="rounded-xl border border-emerald-700/40 bg-emerald-50 px-2 py-0.5 font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
            Win Rate: {riskReward.winProbabilityPct}%
          </span>
          <span className="rounded-xl border border-slate-300 bg-slate-50 px-2 py-0.5 font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
            R/R = 1 : {riskReward.riskRewardRatio}
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3 font-mono tabular-nums">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-2.5 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <p className="text-[10px] uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
            Chốt lời 1 (TP1)
          </p>
          <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">
            {riskReward.tp1Price.toLocaleString('vi-VN')} đ{' '}
            <span className="text-xs text-emerald-700 dark:text-emerald-400">(+{riskReward.tp1Pct}%)</span>
          </p>
          <p className="mt-0.5 text-[11px] text-emerald-800 dark:text-emerald-300">
            Lãi dự kiến: +{estProfitTp1.toLocaleString('vi-VN')} đ
          </p>
        </div>

        <div className="rounded-xl border border-emerald-300/70 bg-emerald-50/60 p-2.5 dark:border-emerald-800/60 dark:bg-emerald-950/30">
          <p className="text-[10px] uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
            Chốt lời 2 (TP2)
          </p>
          <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">
            {riskReward.tp2Price.toLocaleString('vi-VN')} đ{' '}
            <span className="text-xs text-emerald-700 dark:text-emerald-400">(+{riskReward.tp2Pct}%)</span>
          </p>
          <p className="mt-0.5 text-[11px] text-emerald-900 dark:text-emerald-300">
            Lãi kỳ vọng: +{estProfitTp2.toLocaleString('vi-VN')} đ
          </p>
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50/40 p-2.5 dark:border-red-900/50 dark:bg-red-950/20">
          <p className="text-[10px] uppercase tracking-wider text-red-800 dark:text-red-400">
            Cắt lỗ (Stop Loss)
          </p>
          <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-slate-100">
            {riskReward.slPrice.toLocaleString('vi-VN')} đ{' '}
            <span className="text-xs text-red-700 dark:text-red-400">({riskReward.slPct}%)</span>
          </p>
          <p className="mt-0.5 text-[11px] text-red-800 dark:text-red-300">
            Rủi ro tối đa: -{estMaxLoss.toLocaleString('vi-VN')} đ
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-6 space-y-1">
          <div className="flex items-center justify-between font-mono text-[11px] text-slate-600 tabular-nums dark:text-slate-400">
            <span>Rủi ro ({riskReward.slPct}%)</span>
            <span>Tham chiếu: {currentPrice.toLocaleString('vi-VN')} đ</span>
            <span>TP1 (+{riskReward.tp1Pct}%)</span>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
            <div style={{ width: `${Math.round(riskShare * 100)}%` }} className="bg-red-600" />
            <div style={{ width: `${Math.round(rewardShare * 100)}%` }} className="bg-emerald-600" />
          </div>
        </div>

        <div className="lg:col-span-6 flex flex-wrap items-center gap-1.5 sm:justify-end">
          <label
            htmlFor="planned-capital-input"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap"
          >
            <Wallet className="h-3.5 w-3.5 text-amber-800 dark:text-amber-400" />
            <span>Vốn (VNĐ):</span>
          </label>
          <input
            id="planned-capital-input"
            type="text"
            inputMode="numeric"
            value={capitalNum.toLocaleString('vi-VN')}
            onChange={(e) => setPlannedCapital(e.target.value.replace(/[^\d]/g, ''))}
            className="w-36 rounded-xl border border-slate-300 bg-slate-50 px-2 py-1 font-mono text-xs font-semibold text-slate-900 tabular-nums dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          {[
            { label: '50tr', val: '50000000' },
            { label: '100tr', val: '100000000' },
            { label: '300tr', val: '300000000' },
          ].map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setPlannedCapital(p.val)}
              className="rounded-xl border border-slate-300 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 cursor-pointer whitespace-nowrap shrink-0"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export function StockTechnicalWorkspace({
  loading,
  error,
  prediction,
  symbolTitle,
  watchlistItem,
  taggedArticles = [],
  storedArticles = [],
  corporateEvents = [],
  corporateEventsLoading = false,
  onRefreshCorporateEvents,
  autoTriggerCashflow = false,
  onAnalyzeNewsUrl,
  onSelectSymbol,
}: StockTechnicalWorkspaceProps) {
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('1D');
  const [loadingTf, setLoadingTf] = useState(false);
  const [overrideChart, setOverrideChart] = useState<StockChartTechnicalResponse | null>(null);

  const [detailTab, setDetailTab] = useState<'signals' | 'cashflow' | 'four_angles' | 'events'>('signals');
  const [corpScope, setCorpScope] = useState<'symbol' | 'all'>('symbol');
  const [corpCategory, setCorpCategory] = useState<'all' | CorporateEventCategory>('all');

  const [cashflowData, setCashflowData] = useState<CorporateCashflowTimingResponse | null>(null);
  const [cashflowLoading, setCashflowLoading] = useState(false);
  const [cashflowError, setCashflowError] = useState<string | null>(null);

  const [strategyData, setStrategyData] = useState<FourAngleStrategyResponse | null>(null);
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [strategyError, setStrategyError] = useState<string | null>(null);

  useEffect(() => {
    setTimeframe('1D');
    setOverrideChart(null);
    setCashflowData(null);
    setCashflowError(null);
    setStrategyData(null);
    setStrategyError(null);
    setDetailTab(autoTriggerCashflow ? 'cashflow' : 'signals');
  }, [symbolTitle, autoTriggerCashflow]);

  const handleSelectTimeframe = async (nextTf: ChartTimeframe) => {
    setTimeframe(nextTf);
    if (!symbolTitle) return;
    setLoadingTf(true);
    try {
      const res = await fetch('/api/finance/chart-technical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: symbolTitle,
          timeframe: nextTf,
          recentNews: (prediction?.newsMarkers || []).map((n) => ({
            title: n.title,
            impactLabel: n.impactLabel,
            publishedRelative: n.publishedRelative,
          })),
          corporateEvents: corporateEvents.filter((e) => e.symbol === symbolTitle).slice(0, 10),
        }),
      });
      if (res.ok) {
        setOverrideChart((await res.json()) as StockChartTechnicalResponse);
      }
    } finally {
      setLoadingTf(false);
    }
  };

  const handleRunCashflowTiming = async () => {
    if (!symbolTitle || cashflowLoading) return;
    setCashflowLoading(true);
    setCashflowError(null);
    try {
      const res = await fetch('/api/finance/cashflow-timing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: symbolTitle,
          watchlistItem,
          taggedArticles: taggedArticles.filter((a) => a.matchedTickers.includes(symbolTitle)).slice(0, 12),
          storedArticles: storedArticles
            .filter((sa) => `${sa.title} ${sa.summary}`.toUpperCase().includes(symbolTitle))
            .slice(0, 16)
            .map((sa) => ({
              title: sa.title,
              summary: sa.summary,
              sourceName: sa.sourceName,
              sentimentLabel: sa.sentimentLabel,
              url: sa.url,
            })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể phân tích dòng tiền.');
      }
      setCashflowData(data as CorporateCashflowTimingResponse);
    } catch (err) {
      setCashflowError(
        err instanceof Error ? err.message : 'Lỗi kết nối phân tích dòng tiền.'
      );
    } finally {
      setCashflowLoading(false);
    }
  };

  const handleRunFourAngles = async () => {
    if (!symbolTitle || strategyLoading) return;
    setStrategyLoading(true);
    setStrategyError(null);
    try {
      const res = await fetch('/api/finance/strategy-4angles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: symbolTitle,
          watchlistItem,
          corporateEvents: corporateEvents.filter((e) => e.symbol === symbolTitle).slice(0, 10),
          taggedArticles: taggedArticles.filter((a) => a.matchedTickers.includes(symbolTitle)).slice(0, 12),
          storedArticles: storedArticles
            .filter((sa) => `${sa.title} ${sa.summary}`.toUpperCase().includes(symbolTitle))
            .slice(0, 16)
            .map((sa) => ({
              title: sa.title,
              summary: sa.summary,
              sourceName: sa.sourceName,
              sentimentLabel: sa.sentimentLabel,
            })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể phân tích chiến lược 4 góc nhìn.');
      }
      setStrategyData(data as FourAngleStrategyResponse);
    } catch (err) {
      setStrategyError(
        err instanceof Error ? err.message : 'Lỗi kết nối chiến lược 4 góc nhìn.'
      );
    } finally {
      setStrategyLoading(false);
    }
  };

  useEffect(() => {
    if (autoTriggerCashflow && prediction && !cashflowData && !cashflowLoading) {
      setDetailTab('cashflow');
      void handleRunCashflowTiming();
    }
  }, [autoTriggerCashflow, prediction]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredCorpEvents = useMemo(() => {
    const base =
      corpScope === 'symbol'
        ? corporateEvents.filter((e) => e.symbol === symbolTitle)
        : corporateEvents;
    if (corpCategory === 'all') return base;
    return base.filter((e) => e.category === corpCategory);
  }, [corporateEvents, corpScope, corpCategory, symbolTitle]);

  const symbolCorpCount = useMemo(
    () => corporateEvents.filter((e) => e.symbol === symbolTitle).length,
    [corporateEvents, symbolTitle]
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-16 text-center dark:border-slate-800 dark:bg-slate-900">
        <Activity className="h-7 w-7 animate-spin text-amber-800 dark:text-amber-400" />
        <p className="mt-3 text-sm font-medium text-slate-800 dark:text-slate-200">
          Đang đồng bộ nến lịch sử OHLC (120 phiên) cho {symbolTitle}, tính MA20/MA50/Bollinger/RSI, quét tín hiệu nến &amp; lọc tin DedupBot...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
        {error}
      </div>
    );
  }

  const q = overrideChart?.quote || prediction?.quote;
  const ind = overrideChart?.indicators || prediction?.indicators;

  if (!prediction || !q || !ind) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        Chọn một mã cổ phiếu từ Watchlist hoặc thanh tìm kiếm ở trên để mở Đồ thị Kỹ thuật &amp; Tín hiệu Nến.
      </div>
    );
  }

  const ohlc = overrideChart?.ohlc || prediction.ohlc || [];
  const reversals: ReversalSignalItem[] =
    overrideChart?.reversalSignals || prediction.reversalSignals || [];
  const riskReward: RiskRewardSummary | undefined =
    overrideChart?.riskReward || prediction.riskReward;
  const candlestickSignals: CandlestickSignalItem[] =
    overrideChart?.candlestickSignals || prediction.candlestickSignals || [];
  const tradeSetup: TradeSetupPlan | undefined =
    overrideChart?.tradeSetup || prediction.tradeSetup;
  const anomalies: CashflowAnomalyItem[] =
    overrideChart?.anomalies || prediction.anomalies || [];

  const isUp = q.changePct > 0;
  const isDown = q.changePct < 0;

  return (
    <div className="space-y-3.5">
      {/* Compact 4 KPI Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {symbolTitle} · {prediction.exchange} ({prediction.marketDataMode === 'ssi' ? 'SSI' : '.VN'})
          </p>
          <div className="mt-1 flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {q.price.toLocaleString('vi-VN')} đ
            </span>
            <span
              className={`inline-flex items-center text-xs font-semibold ${
                isUp
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : isDown
                    ? 'text-red-700 dark:text-red-400'
                    : 'text-amber-700 dark:text-amber-400'
              }`}
            >
              {isUp ? <ArrowUpRight className="h-3.5 w-3.5" /> : isDown ? <ArrowDownRight className="h-3.5 w-3.5" /> : null}
              {q.changePct > 0 ? '+' : ''}
              {q.changePct}%
            </span>
          </div>
          <p className="mt-0.5 font-mono text-[10px] text-slate-500 tabular-nums">
            Sàn {q.floorPrice.toLocaleString('vi-VN')} · TC {q.refPrice.toLocaleString('vi-VN')} · Trần {q.ceilingPrice.toLocaleString('vi-VN')}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            MA20 / MA50 &amp; Xu hướng
          </p>
          <p className="mt-1 font-mono text-sm font-bold text-slate-900 tabular-nums dark:text-slate-100">
            {ind.ma20 ? ind.ma20.toLocaleString('vi-VN') : '—'} / {ind.ma50 ? ind.ma50.toLocaleString('vi-VN') : '—'}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
            <strong className="text-slate-900 dark:text-slate-200">{ind.trendSignal}</strong>
            {ind.priceVsMa20Pct !== null ? ` (${ind.priceVsMa20Pct >= 0 ? '+' : ''}${ind.priceVsMa20Pct}%)` : ''}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            RSI(14) &amp; Thanh khoản
          </p>
          <p className="mt-1 font-mono text-lg font-bold text-slate-900 tabular-nums dark:text-slate-100">
            {ind.rsi14 ?? '—'}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-slate-600 tabular-nums dark:text-slate-400">
            KL: {q.volume.toLocaleString('vi-VN')} cp{ind.volumeRatio20 ? ` (${ind.volumeRatio20}x)` : ''}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Bollinger &amp; Khối ngoại
          </p>
          <p className="mt-1 font-mono text-xs font-bold text-slate-900 tabular-nums dark:text-slate-100">
            {ind.bbLower ? ind.bbLower.toLocaleString('vi-VN') : '—'} – {ind.bbUpper ? ind.bbUpper.toLocaleString('vi-VN') : '—'}
          </p>
          <p
            className={`mt-0.5 font-mono text-[11px] tabular-nums ${
              q.foreignNetVol > 0
                ? 'text-emerald-700 dark:text-emerald-400'
                : q.foreignNetVol < 0
                  ? 'text-red-700 dark:text-red-400'
                  : 'text-slate-500'
            }`}
          >
            NN ròng: {q.foreignNetVol !== 0 ? `${q.foreignNetVol > 0 ? '+' : ''}${q.foreignNetVol.toLocaleString('vi-VN')} cp` : '0 cp'}
          </p>
        </div>
      </div>

      {/* Main Chart */}
      <InteractiveTechnicalChart
        ohlc={ohlc}
        indicators={ind}
        timeframe={timeframe}
        loadingTf={loadingTf}
        onSelectTimeframe={(tf) => void handleSelectTimeframe(tf)}
      />

      {/* Compact Trade Setup Plan Strip */}
      {tradeSetup && (
        <section className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2">
              <Crosshair className="h-3.5 w-3.5 text-amber-800 dark:text-amber-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Kế hoạch Vào/Ra Lệnh · {tradeSetup.activePatternName}
              </span>
              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                ({tradeSetup.confidencePct}% · R/R 1:{tradeSetup.riskRewardRatio})
              </span>
            </div>
            <span
              className={`rounded-xl px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                tradeSetup.status === 'ĐANG TRONG VÙNG MUA' || tradeSetup.status === 'ĐÃ CHẠM TP1'
                  ? 'bg-emerald-700 text-white dark:bg-emerald-500 dark:text-slate-950'
                  : tradeSetup.status === 'VI PHẠM CẮT LỖ' || tradeSetup.status === 'TÍN HIỆU THOÁT LỆNH'
                    ? 'bg-red-700 text-white'
                    : 'bg-amber-700 text-white'
              }`}
            >
              {tradeSetup.status}
            </span>
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-2.5 font-mono tabular-nums sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-950">
              <span className="text-[10px] uppercase text-slate-500">Vùng mua (Entry)</span>
              <p className="mt-0.5 text-xs font-bold text-slate-900 dark:text-slate-100">
                {tradeSetup.entryZoneLow.toLocaleString('vi-VN')} – {tradeSetup.entryZoneHigh.toLocaleString('vi-VN')} đ
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-2 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <span className="text-[10px] uppercase text-emerald-800 dark:text-emerald-400">TP1 (+{tradeSetup.tp1Pct}%)</span>
              <p className="mt-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-400">
                {tradeSetup.tp1Price.toLocaleString('vi-VN')} đ
              </p>
            </div>
            <div className="rounded-xl border border-emerald-300/70 bg-emerald-50/60 p-2 dark:border-emerald-800/60 dark:bg-emerald-950/30">
              <span className="text-[10px] uppercase text-emerald-900 dark:text-emerald-400">TP2 (+{tradeSetup.tp2Pct}%)</span>
              <p className="mt-0.5 text-xs font-bold text-emerald-900 dark:text-emerald-400">
                {tradeSetup.tp2Price.toLocaleString('vi-VN')} đ
              </p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50/40 p-2 dark:border-red-900/50 dark:bg-red-950/20">
              <span className="text-[10px] uppercase text-red-800 dark:text-red-400">Cắt lỗ SL ({tradeSetup.slPct}%)</span>
              <p className="mt-0.5 text-xs font-bold text-red-800 dark:text-red-400">
                {tradeSetup.slPrice.toLocaleString('vi-VN')} đ
              </p>
            </div>
          </div>

          <p className="mt-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
            {tradeSetup.explanation}
          </p>
        </section>
      )}

      {/* Inner Sub-Tabs to avoid infinite vertical scroll */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2 dark:border-slate-800">
        {(
          [
            {
              id: 'signals',
              label: `Tín hiệu Nến & Xác suất (${candlestickSignals.length + reversals.length})`,
              icon: BarChart3,
            },
            {
              id: 'cashflow',
              label: 'AI Dòng tiền & Thời điểm',
              icon: Sparkles,
            },
            {
              id: 'four_angles',
              label: 'AI Chiến lược 4 Góc nhìn',
              icon: Compass,
            },
            {
              id: 'events',
              label: `ĐHĐCĐ & Tin gắn mã (${symbolCorpCount + prediction.newsMarkers.length})`,
              icon: Calendar,
            },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = detailTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setDetailTab(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 ${
                active
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Candlestick + Reversal + Risk/Reward + T+3 / T+10 */}
      {detailTab === 'signals' && (
        <div className="space-y-3.5">
          {riskReward && <RiskRewardPanel riskReward={riskReward} currentPrice={q.price} />}

          {(candlestickSignals.length > 0 || anomalies.length > 0 || reversals.length > 0) && (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {candlestickSignals.slice(0, 6).map((cs) => (
                <div
                  key={cs.id}
                  className={`rounded-xl border p-3 ${
                    cs.signalType === 'BUY'
                      ? 'border-emerald-300/80 bg-emerald-50/40 dark:border-emerald-800/60 dark:bg-emerald-950/20'
                      : 'border-red-300/80 bg-red-50/40 dark:border-red-800/60 dark:bg-red-950/20'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`rounded-xl px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${
                        cs.signalType === 'BUY'
                          ? 'bg-emerald-700 text-white dark:bg-emerald-500 dark:text-slate-950'
                          : 'bg-red-700 text-white'
                      }`}
                    >
                      {cs.signalType === 'BUY' ? '▲ BUY' : '▼ SELL'} · {cs.patternName}
                    </span>
                    <span className="font-mono text-[11px] font-semibold text-slate-700 tabular-nums dark:text-slate-300">
                      {cs.date} · {cs.confidencePct}%
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">{cs.reason}</p>
                  {cs.confluenceNotes.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {cs.confluenceNotes.map((note, idx) => (
                        <span
                          key={idx}
                          className="rounded-xl border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                        >
                          {note}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {reversals.map((sig) => (
                <div
                  key={sig.id}
                  className={`rounded-xl border p-3 ${
                    sig.direction === 'bullish'
                      ? 'border-emerald-300/80 bg-emerald-50/40 dark:border-emerald-800/60 dark:bg-emerald-950/20'
                      : 'border-red-300/80 bg-red-50/40 dark:border-red-800/60 dark:bg-red-950/20'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`rounded-xl px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${
                        sig.direction === 'bullish' ? 'bg-emerald-700 text-white' : 'bg-red-700 text-white'
                      }`}
                    >
                      {sig.label}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                      {sig.date} · {sig.price.toLocaleString('vi-VN')} đ · {sig.strength}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">{sig.description}</p>
                </div>
              ))}

              {anomalies.map((an) => (
                <div
                  key={an.id}
                  className={`rounded-xl border p-3 text-xs ${
                    an.severity === 'opportunity'
                      ? 'border-emerald-300 bg-emerald-50/40 dark:border-emerald-800/60 dark:bg-emerald-950/20'
                      : an.severity === 'critical'
                        ? 'border-red-300 bg-red-50/40 dark:border-red-800/60 dark:bg-red-950/20'
                        : 'border-amber-300 bg-amber-50/40 dark:border-amber-800/60 dark:bg-amber-950/20'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono text-[11px] font-bold">
                    <span>{an.title}</span>
                    <span>KL {an.volumeRatio20}x</span>
                  </div>
                  <p className="mt-1 text-slate-700 dark:text-slate-300">{an.detail}</p>
                </div>
              ))}
            </div>
          )}

          {/* T+3 & T+10 + Catalysts & Risks */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {[
              { label: 'Kịch bản ngắn hạn T+3', data: prediction.outlookT3 },
              { label: 'Kịch bản trung hạn T+10', data: prediction.outlookT10 },
            ].map((block) => (
              <div
                key={block.label}
                className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {block.label}
                  </span>
                  <span
                    className={`rounded-xl px-2 py-0.5 font-mono text-[11px] font-semibold ${
                      block.data.direction === 'Tăng'
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : block.data.direction === 'Giảm'
                          ? 'bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                          : 'bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300'
                    }`}
                  >
                    {block.data.direction} · {block.data.targetRange}
                  </span>
                </div>

                <div className="mt-2.5 flex h-2 w-full overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
                  <div style={{ width: `${block.data.probUp}%` }} className="bg-emerald-600" />
                  <div style={{ width: `${block.data.probSideways}%` }} className="bg-amber-500" />
                  <div style={{ width: `${block.data.probDown}%` }} className="bg-red-600" />
                </div>
                <div className="mt-1 flex items-center justify-between font-mono text-[10px] tabular-nums text-slate-500 dark:text-slate-400">
                  <span>Tăng {block.data.probUp}%</span>
                  <span>Ngang {block.data.probSideways}%</span>
                  <span>Giảm {block.data.probDown}%</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{block.data.thesis}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                <TrendingUp className="h-3.5 w-3.5" /> Động lực hỗ trợ
              </h4>
              <ul className="mt-2 space-y-1 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                {prediction.catalysts.map((c, idx) => (
                  <li key={idx}>• {c}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-red-800 dark:text-red-400">
                <AlertTriangle className="h-3.5 w-3.5" /> Rủi ro &amp; Hành động
              </h4>
              <ul className="mt-2 space-y-1 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                {prediction.risks.map((r, idx) => (
                  <li key={idx}>• {r}</li>
                ))}
              </ul>
              <p className="mt-2 border-t border-slate-100 pt-2 text-xs font-medium text-slate-800 dark:border-slate-800 dark:text-slate-200">
                {prediction.actionPlan}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AI Corporate Cashflow Timing */}
      {detailTab === 'cashflow' && (
        <section className="rounded-xl border border-amber-800/35 bg-emerald-50/50 p-4 dark:border-amber-700/45 dark:bg-slate-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-950 dark:text-amber-300">
                <Sparkles className="h-3.5 w-3.5" />
                <span>AI Bot Dòng tiền Doanh nghiệp &amp; Định thời điểm Đầu tư ({symbolTitle})</span>
              </h3>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                Hợp nhất dòng tiền Khối ngoại/Thanh khoản SSI với dữ liệu doanh thu, lợi nhuận, cổ tức từ Kho Tin DedupBot.
              </p>
            </div>

            <button
              type="button"
              disabled={cashflowLoading}
              onClick={() => void handleRunCashflowTiming()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 cursor-pointer whitespace-nowrap shrink-0"
            >
              {cashflowLoading ? (
                <>
                  <Activity className="h-3.5 w-3.5 animate-spin" />
                  <span>Đang chấm điểm dòng tiền...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{cashflowData ? 'Phân tích lại Dòng tiền' : 'Phân tích Dòng tiền & Thời điểm'}</span>
                </>
              )}
            </button>
          </div>

          {cashflowError && (
            <p className="mt-3 text-xs text-red-700 dark:text-red-400">{cashflowError}</p>
          )}

          {cashflowData && (
            <div className="mt-4 space-y-3 border-t border-amber-800/20 pt-3.5 dark:border-amber-700/30">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="rounded-xl border border-slate-300 bg-white px-3 py-1 font-mono tabular-nums dark:border-slate-700 dark:bg-slate-950">
                    <span className="text-[10px] uppercase text-slate-500">Điểm Dòng tiền</span>
                    <p className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {cashflowData.cashflowScore}/100
                    </p>
                  </div>
                  <span
                    className={`rounded-xl px-2.5 py-1 font-mono text-xs font-bold uppercase ${
                      cashflowData.timingAction === 'GIA TĂNG TỶ TRỌNG' ||
                      cashflowData.timingAction === 'MUA THĂM DÒ'
                        ? 'bg-emerald-700 text-white'
                        : cashflowData.timingAction === 'CHỜ ĐIỀU CHỈNH'
                          ? 'bg-amber-700 text-white'
                          : 'bg-red-700 text-white'
                    }`}
                  >
                    {cashflowData.timingAction}
                  </span>
                  <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
                    Vùng tối ưu: <strong>{cashflowData.optimalEntryZone}</strong>
                  </span>
                </div>
                <span className="font-mono text-[10px] text-slate-500">
                  {cashflowData.mode === 'gemini' ? 'Gemini Structured' : 'Định lượng'}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {[
                  { title: '1. Dòng tiền cốt lõi', pillar: cashflowData.pillars.operatingCashflow },
                  { title: '2. Khối ngoại / Tổ chức', pillar: cashflowData.pillars.foreignInstitutionalFlow },
                  { title: '3. Động lực tin tức', pillar: cashflowData.pillars.newsGrowthMomentum },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="flex items-center justify-between gap-2 font-mono text-xs tabular-nums">
                      <span className="font-sans font-semibold text-slate-800 dark:text-slate-200">{item.title}</span>
                      <strong className="text-amber-900 dark:text-amber-400">{item.pillar.score}/100</strong>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full bg-slate-100 dark:bg-slate-800">
                      <div style={{ width: `${item.pillar.score}%` }} className="h-1.5 bg-amber-700 dark:bg-amber-500" />
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{item.pillar.summary}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                <p>
                  <strong>Điều kiện thanh khoản:</strong> {cashflowData.liquidityCondition}
                </p>
                <p className="mt-1">
                  <strong>Tổng luận:</strong> {cashflowData.summaryThesis}
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* TAB 3: AI 4-Angle Strategy */}
      {detailTab === 'four_angles' && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                <Compass className="h-3.5 w-3.5 text-amber-800 dark:text-amber-400" />
                <span>AI Chiến lược 4 Góc nhìn ({symbolTitle}: Nội tại · Ngành · Vĩ mô · Priced-in)</span>
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Đối chiếu văn bản ĐHĐCĐ/nội bộ, vị thế ngành, vĩ mô khu vực và mức độ chiết khấu vào giá.
              </p>
            </div>

            <button
              type="button"
              disabled={strategyLoading}
              onClick={() => void handleRunFourAngles()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-800/40 bg-amber-50 px-3.5 py-2 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200 cursor-pointer whitespace-nowrap shrink-0"
            >
              {strategyLoading ? (
                <>
                  <Activity className="h-3.5 w-3.5 animate-spin" />
                  <span>Đang tổng hợp...</span>
                </>
              ) : (
                <>
                  <FileText className="h-3.5 w-3.5" />
                  <span>{strategyData ? 'Phân tích lại 4 Góc nhìn' : 'Phân tích 4 Góc nhìn'}</span>
                </>
              )}
            </button>
          </div>

          {strategyError && <p className="mt-3 text-xs text-red-700 dark:text-red-400">{strategyError}</p>}

          {strategyData && (
            <div className="mt-4 space-y-3.5 border-t border-slate-200 pt-3.5 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] tabular-nums">
                <span className="rounded-xl border border-slate-300 bg-slate-50 px-2 py-0.5 font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                  Vị thế: {strategyData.sectorPosition}
                </span>
                <span
                  className={`rounded-xl px-2 py-0.5 font-bold ${
                    strategyData.pricedInStatus === 'Chưa phản ánh'
                      ? 'bg-emerald-700 text-white dark:bg-emerald-500 dark:text-slate-950'
                      : strategyData.pricedInStatus === 'Phản ánh một phần'
                        ? 'bg-amber-700 text-white'
                        : 'bg-red-700 text-white'
                  }`}
                >
                  Priced-in: {strategyData.pricedInStatus}
                </span>
                <span className="rounded-xl border border-emerald-700/40 bg-emerald-50 px-2 py-0.5 font-bold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                  Win Rate {strategyData.winRatePct}% · R/R 1:{strategyData.riskRewardRatio}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                    <span>{strategyData.angles.internalGovernance.title}</span>
                    <span className="font-mono text-amber-900 dark:text-amber-400">{strategyData.angles.internalGovernance.score}/100</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                    {strategyData.angles.internalGovernance.summary}
                  </p>
                  <ul className="mt-1.5 space-y-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                    {strategyData.angles.internalGovernance.catalysts.map((c, i) => (
                      <li key={i}>• {c}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                    <span>{strategyData.angles.sectorPositioning.title}</span>
                    <span className="font-mono text-amber-900 dark:text-amber-400">{strategyData.angles.sectorPositioning.score}/100</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                    {strategyData.angles.sectorPositioning.summary}
                  </p>
                  <p className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                    • {strategyData.angles.sectorPositioning.peerNote}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                    <span>{strategyData.angles.macroRegional.title}</span>
                    <span className="font-mono text-amber-900 dark:text-amber-400">{strategyData.angles.macroRegional.score}/100</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                    {strategyData.angles.macroRegional.summary}
                  </p>
                  <ul className="mt-1.5 space-y-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                    {strategyData.angles.macroRegional.keyDrivers.map((d, i) => (
                      <li key={i}>• {d}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                    <span>{strategyData.angles.marketReaction.title}</span>
                    <span className="font-mono text-amber-900 dark:text-amber-400">{strategyData.angles.marketReaction.score}/100</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                    {strategyData.angles.marketReaction.summary}
                  </p>
                  <p className="mt-1.5 text-[11px] font-medium text-emerald-800 dark:text-emerald-400">
                    • {strategyData.angles.marketReaction.strategyAction}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-amber-800/30 bg-emerald-50/50 p-3 text-xs leading-relaxed text-slate-800 dark:border-amber-700/40 dark:bg-slate-900 dark:text-slate-200">
                <strong>Kết luận 4 Góc nhìn:</strong> {strategyData.executiveVerdict}
              </div>
            </div>
          )}
        </section>
      )}

      {/* TAB 4: Corporate Governance (ĐHĐCĐ / Nội bộ) + News Markers */}
      {detailTab === 'events' && (
        <div className="space-y-3.5">
          {/* Corporate Events Section */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                <Calendar className="h-4 w-4 text-amber-800 dark:text-amber-400" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Lịch Sự Kiện ĐHĐCĐ &amp; Văn bản Nội bộ
                </h4>
                <div className="inline-flex rounded-xl border border-slate-300 bg-slate-50 p-0.5 text-[11px] dark:border-slate-700 dark:bg-slate-950">
                  <button
                    type="button"
                    onClick={() => setCorpScope('symbol')}
                    className={`rounded-md px-2 py-0.5 font-semibold cursor-pointer whitespace-nowrap ${
                      corpScope === 'symbol'
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Riêng {symbolTitle} ({symbolCorpCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCorpScope('all')}
                    className={`rounded-md px-2 py-0.5 font-semibold cursor-pointer whitespace-nowrap ${
                      corpScope === 'all'
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Toàn thị trường ({corporateEvents.length})
                  </button>
                </div>
              </div>

              {onRefreshCorporateEvents && (
                <button
                  type="button"
                  disabled={corporateEventsLoading}
                  onClick={() => onRefreshCorporateEvents(true)}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RefreshCw className={`h-3 w-3 ${corporateEventsLoading ? 'animate-spin' : ''}`} />
                  <span>Quét văn bản ĐHĐCĐ</span>
                </button>
              )}
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
              {GOVERNANCE_FILTER_TABS.map((gTab) => (
                <button
                  key={gTab.id}
                  type="button"
                  onClick={() => setCorpCategory(gTab.id)}
                  className={`rounded-xl border px-2 py-0.5 font-medium cursor-pointer whitespace-nowrap ${
                    corpCategory === gTab.id
                      ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                      : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                  }`}
                >
                  {gTab.label}
                </button>
              ))}
            </div>

            {filteredCorpEvents.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                Chưa có văn bản ĐHĐCĐ / cổ đông nội bộ khớp bộ lọc cho {corpScope === 'symbol' ? symbolTitle : 'toàn thị trường'}.
              </p>
            ) : (
              <div className="mt-3 max-h-[340px] divide-y divide-slate-100 overflow-y-auto pr-1 dark:divide-slate-800">
                {filteredCorpEvents.slice(0, 20).map((ev) => (
                  <article key={ev.id} className="py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {onSelectSymbol ? (
                          <button
                            type="button"
                            onClick={() => onSelectSymbol(ev.symbol)}
                            className="rounded-xl bg-slate-900 px-1.5 py-0.5 font-mono font-bold text-white dark:bg-slate-100 dark:text-slate-900 cursor-pointer"
                          >
                            {ev.symbol}
                          </button>
                        ) : (
                          <span className="rounded-xl bg-slate-900 px-1.5 py-0.5 font-mono font-bold text-white dark:bg-slate-100 dark:text-slate-900">
                            {ev.symbol}
                          </span>
                        )}
                        <span className="rounded-xl border border-violet-300 bg-violet-50 px-1.5 py-0.5 text-violet-900 dark:border-violet-800/70 dark:bg-violet-950/40 dark:text-violet-300">
                          {ev.categoryLabel}
                        </span>
                        {ev.keyMetrics.slice(0, 2).map((m, idx) => (
                          <span
                            key={idx}
                            className="rounded-xl border border-amber-800/30 bg-amber-50 px-1.5 py-0.5 font-mono font-semibold text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-300"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                      <span className="font-mono text-[10px] text-slate-500 tabular-nums">
                        {ev.eventDate} · {ev.sourceName}
                      </span>
                    </div>
                    <h5 className="mt-1 text-xs font-semibold text-slate-900 dark:text-slate-100">{ev.title}</h5>
                    {ev.summary && (
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-600 dark:text-slate-400">
                        {ev.summary}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-3 text-[11px]">
                      <button
                        type="button"
                        onClick={() => onAnalyzeNewsUrl(ev.url, ev.title, ev.sourceName)}
                        className="font-medium text-amber-900 hover:underline dark:text-amber-400 cursor-pointer"
                      >
                        Phân tích đa chiều
                      </button>
                      <a
                        href={ev.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 text-slate-500 hover:text-slate-900 dark:text-slate-400"
                      >
                        Văn bản gốc <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* News Markers for this ticker */}
          {prediction.newsMarkers.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                <Newspaper className="h-3.5 w-3.5" /> Điểm rơi Tin tức {symbolTitle} (Đã lọc DedupBot)
              </h4>
              <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
                {prediction.newsMarkers.map((nm, i) => (
                  <div key={i} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <span
                        className={`mr-2 inline-block rounded-xl px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                          nm.impactLabel === 'Rủi ro cao'
                            ? 'bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                            : nm.impactLabel === 'Hỗ trợ tăng'
                              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {nm.impactLabel}
                      </span>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{nm.title}</span>
                      <span className="ml-1.5 text-[11px] text-slate-500">
                        ({nm.sourceName} · {nm.publishedRelative})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onAnalyzeNewsUrl(nm.url, nm.title, nm.sourceName)}
                        className="text-amber-900 hover:underline dark:text-amber-400 cursor-pointer"
                      >
                        Phân tích
                      </button>
                      <a
                        href={nm.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 text-slate-500 hover:text-slate-900 dark:text-slate-400"
                      >
                        Mở <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
