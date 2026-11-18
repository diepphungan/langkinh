import { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Flame,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  CorporateEventItem,
  ErraticMoverAiDiagnosis,
  ErraticMoversResponse,
  ErraticPatternType,
  FinanceTaggedArticle,
  IntradayErraticMover,
  StoredNewsArticle,
} from '../types/news';

interface ErraticMoversSectionProps {
  data: ErraticMoversResponse | null;
  loading: boolean;
  onRefresh: (forceRefresh?: boolean) => void;
  watchlistSymbols: string[];
  taggedArticles: FinanceTaggedArticle[];
  storedArticles: StoredNewsArticle[];
  corporateEvents: CorporateEventItem[];
  onOpenPrediction: (symbol: string) => void;
  compactSplit?: boolean;
}

type PatternFilterId = 'all' | 'va_reversal' | 'whipsaw' | 'gap_vacuum';

export function ErraticMoversSection({
  data,
  loading,
  onRefresh,
  watchlistSymbols,
  taggedArticles,
  storedArticles,
  corporateEvents,
  onOpenPrediction,
  compactSplit = true,
}: ErraticMoversSectionProps) {
  const [patternFilter, setPatternFilter] = useState<PatternFilterId>('all');
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<ErraticMoverAiDiagnosis | null>(null);
  const [diagnoseLoading, setDiagnoseLoading] = useState(false);
  const [diagnoseError, setDiagnoseError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const watchlistSet = useMemo(
    () => new Set(watchlistSymbols.map((s) => s.trim().toUpperCase())),
    [watchlistSymbols]
  );

  const movers = data?.movers || [];

  const filteredMovers = useMemo(() => {
    if (patternFilter === 'all') return movers;
    if (patternFilter === 'va_reversal') {
      return movers.filter(
        (m) =>
          m.patternType === 'v_shape_reversal' ||
          m.patternType === 'inverted_v_pullback'
      );
    }
    if (patternFilter === 'whipsaw') {
      return movers.filter((m) => m.patternType === 'whipsaw_stophunt');
    }
    return movers.filter((m) => m.patternType === 'gap_liquidity_vacuum');
  }, [movers, patternFilter]);

  const activeMover: IntradayErraticMover | null = useMemo(() => {
    if (movers.length === 0) return null;
    if (selectedSymbol) {
      return movers.find((m) => m.symbol === selectedSymbol) || movers[0];
    }
    return movers[0];
  }, [movers, selectedSymbol]);

  const runDiagnose = async (
    scope: 'single' | 'group',
    mover?: IntradayErraticMover
  ) => {
    if (diagnoseLoading) return;
    if (scope === 'single' && mover) {
      setSelectedSymbol(mover.symbol);
    }
    setDrawerOpen(true);
    setDiagnoseLoading(true);
    setDiagnoseError(null);
    try {
      const res = await fetch('/api/finance/erratic-diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope,
          mover,
          movers: movers.slice(0, 12),
          taggedArticles: taggedArticles.slice(0, 35),
          storedArticles: storedArticles.slice(0, 50).map((s) => ({
            title: s.title,
            summary: s.summary,
            sourceName: s.sourceName,
            sentimentLabel: s.sentimentLabel,
            createdAt: s.createdAt,
          })),
          corporateEvents: corporateEvents.slice(0, 20),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof json?.error === 'string'
            ? json.error
            : 'Không thể giải mã biến động thất thường lúc này.'
        );
      }
      setDiagnosis(json as ErraticMoverAiDiagnosis);
    } catch (err) {
      setDiagnoseError(
        err instanceof Error
          ? err.message
          : 'Lỗi kết nối khi giải mã biến động cổ phiếu.'
      );
    } finally {
      setDiagnoseLoading(false);
    }
  };

  const getPatternStyle = (patternType: ErraticPatternType) => {
    switch (patternType) {
      case 'v_shape_reversal':
        return 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800/70 dark:bg-emerald-950/50 dark:text-emerald-400';
      case 'inverted_v_pullback':
        return 'border-red-300 bg-red-50 text-red-900 dark:border-red-800/70 dark:bg-red-950/50 dark:text-red-300';
      case 'whipsaw_stophunt':
        return 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800/70 dark:bg-amber-950/50 dark:text-amber-300';
      case 'gap_liquidity_vacuum':
        return 'border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-800/70 dark:bg-violet-950/50 dark:text-violet-300';
    }
  };

  return (
    <section className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-200 pb-3 dark:border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex items-center gap-1.5 font-sans tracking-tight text-lg font-bold text-slate-900 dark:text-slate-100">
              <Zap className="h-4 w-4 text-amber-800 dark:text-amber-400" />
              <span>Biến Động Thất Thường Trong Phiên</span>
            </h2>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
              &gt;10 tỷ · 0 token
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Đảo chiều chữ V/A, giật lắc quét thanh khoản 15m, nhảy Gap &amp; lệch pha VN-Index.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            type="button"
            disabled={diagnoseLoading || movers.length === 0}
            onClick={() => void runDiagnose('group')}
            className="inline-flex items-center gap-1 rounded-xl border border-amber-800/40 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Sparkles className={`h-3 w-3 ${diagnoseLoading ? 'animate-spin' : ''}`} />
            <span>AI Giải mã Nhóm</span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => onRefresh(true)}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Đang quét...' : 'Quét phiên'}</span>
          </button>
        </div>
      </div>

      {/* Compact Stats + Pattern Filters */}
      {data && (
        <div className="mt-3 flex flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 font-mono tabular-nums text-[11px]">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-[10px] text-slate-500">Thanh khoản</p>
              <p className="font-bold text-slate-900 dark:text-slate-100">
                {data.qualifiedLiquidityCount}/{data.scannedUniverseCount} mã
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-[10px] text-slate-500">Chữ V / Kéo xả A</p>
              <p className="font-bold">
                <span className="text-emerald-700 dark:text-emerald-400">{data.summaryStats.vShapeCount} V</span>
                {' · '}
                <span className="text-red-700 dark:text-red-400">{data.summaryStats.invertedVCount} A</span>
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-[10px] text-slate-500">Lắc / Gap</p>
              <p className="font-bold text-slate-900 dark:text-slate-100">
                {data.summaryStats.whipsawCount} lắc · {data.summaryStats.gapVacuumCount} gap
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-[10px] text-slate-500">VN-Index</p>
              <p
                className={`font-bold ${
                  data.vnIndexChangePct >= 0
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-red-700 dark:text-red-400'
                }`}
              >
                {data.vnIndexChangePct > 0 ? '+' : ''}
                {data.vnIndexChangePct}%
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            {(
              [
                { id: 'all', label: `Tất cả (${movers.length})` },
                { id: 'va_reversal', label: 'Rút chân / Kéo xả' },
                { id: 'whipsaw', label: 'Giật lắc 2 đầu' },
                { id: 'gap_vacuum', label: 'Trần-Sàn / Gap' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPatternFilter(tab.id)}
                className={`rounded-xl border px-2 py-0.5 font-medium cursor-pointer whitespace-nowrap shrink-0 ${
                  patternFilter === tab.id
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Movers Compact Table */}
      {loading && movers.length === 0 ? (
        <div className="py-10 text-center text-xs text-slate-500">
          <Activity className="mx-auto mb-2 h-5 w-5 animate-spin text-amber-800 dark:text-amber-400" />
          Đang tính ATR14 &amp; quét nến 15 phút...
        </div>
      ) : filteredMovers.length === 0 ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-5 text-center text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
          <p>Chưa ghi nhận mã vượt ngưỡng biến động thất thường trong nhóm lọc này.</p>
          <button
            type="button"
            onClick={() => {
              setPatternFilter('all');
              onRefresh(true);
            }}
            className="mt-2 font-medium text-amber-900 hover:underline dark:text-amber-400 cursor-pointer"
          >
            Xem toàn bộ hoặc quét lại →
          </button>
        </div>
      ) : (
        <div className="mt-3 max-h-[340px] overflow-auto border-t border-slate-200 dark:border-slate-800">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-white dark:bg-slate-900">
              <tr className="border-b border-slate-200 font-mono text-[10px] uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="py-2 pr-2">Mã CP</th>
                <th className="py-2 px-2 text-right">Giá &amp; %</th>
                <th className="py-2 px-2 min-w-[135px]">Biên độ phiên</th>
                <th className="py-2 px-2">Mẫu hình</th>
                {!compactSplit && <th className="py-2 px-2">Lệch VN-Index</th>}
                <th className="py-2 pl-2 text-right">Giải mã</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredMovers.map((m) => {
                const isUp = m.change > 0;
                const isDown = m.change < 0;
                const isWatched = watchlistSet.has(m.symbol);
                const isSelected = activeMover?.symbol === m.symbol;

                return (
                  <tr
                    key={m.symbol}
                    onClick={() => setSelectedSymbol(m.symbol)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-amber-50/50 dark:bg-amber-950/25'
                        : 'hover:bg-slate-50/70 dark:hover:bg-slate-950/60'
                    }`}
                  >
                    <td className="py-2 pr-2 align-middle">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenPrediction(m.symbol);
                          }}
                          className="rounded-xl bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 cursor-pointer"
                        >
                          {m.symbol}
                        </button>
                        {isWatched && (
                          <span className="rounded-md border border-amber-700/40 bg-amber-50 px-1 font-mono text-[9px] font-semibold text-amber-900 dark:border-amber-600/50 dark:bg-amber-950/50 dark:text-amber-300">
                            WL
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 font-mono text-[10px] text-slate-500 tabular-nums">
                        <Flame className="h-2.5 w-2.5 text-amber-700 dark:text-amber-400" />
                        <span>{m.erraticScore}/100</span>
                        <span>· {m.betaDeviationPct > 0 ? '+' : ''}{m.betaDeviationPct}% VNI</span>
                      </div>
                    </td>

                    <td className="py-2 px-2 text-right align-middle font-mono tabular-nums">
                      <div className="font-bold text-slate-900 dark:text-slate-100">
                        {m.price.toLocaleString('vi-VN')}
                      </div>
                      <div
                        className={`inline-flex items-center justify-end text-[11px] font-semibold ${
                          isUp
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : isDown
                              ? 'text-red-700 dark:text-red-400'
                              : 'text-amber-700 dark:text-amber-400'
                        }`}
                      >
                        {isUp ? <ArrowUpRight className="h-3 w-3" /> : isDown ? <ArrowDownRight className="h-3 w-3" /> : null}
                        {m.changePct > 0 ? '+' : ''}
                        {m.changePct}%
                      </div>
                    </td>

                    <td className="py-2 px-2 align-middle">
                      <div className="flex items-center justify-between font-mono text-[10px] tabular-nums">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">{m.intradayAmplitudePct}%</span>
                        <span className="text-slate-500">{m.amplitudeVsAtrRatio}x ATR</span>
                      </div>
                      <div className="relative mt-1 h-1.5 w-full rounded-md bg-slate-200 dark:bg-slate-800">
                        <div
                          className={`h-full rounded-md ${
                            m.pricePositionInRangePct >= 66
                              ? 'bg-emerald-600/80'
                              : m.pricePositionInRangePct <= 34
                                ? 'bg-red-600/80'
                                : 'bg-amber-600/80'
                          }`}
                          style={{ width: `${Math.max(4, m.pricePositionInRangePct)}%` }}
                        />
                      </div>
                      <div className="mt-0.5 flex items-center justify-between font-mono text-[9px] text-slate-400 tabular-nums">
                        <span>{m.dayLow.toLocaleString('vi-VN')}</span>
                        <span>{m.dayHigh.toLocaleString('vi-VN')}</span>
                      </div>
                    </td>

                    <td className="py-2 px-2 align-middle">
                      <span
                        className={`inline-block rounded-xl border px-1.5 py-0.5 font-mono text-[10px] font-bold ${getPatternStyle(
                          m.patternType
                        )}`}
                      >
                        {m.patternLabel}
                      </span>
                    </td>

                    {!compactSplit && (
                      <td className="py-2 px-2 align-middle font-mono text-[11px] tabular-nums">
                        {m.betaDeviationPct > 0 ? '+' : ''}
                        {m.betaDeviationPct}%
                      </td>
                    )}

                    <td className="py-2 pl-2 text-right align-middle">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void runDiagnose('single', m);
                        }}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-900 hover:bg-slate-900 hover:text-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-100 dark:hover:text-slate-900 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <Sparkles className="h-3 w-3" />
                        <span>Giải mã AI</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Compact Intraday 15m Chart for selected activeMover */}
      {activeMover && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
            <div>
              <h3 className="font-sans tracking-tight text-sm font-bold text-slate-900 dark:text-slate-100">
                Nhịp 15 phút: {activeMover.symbol} · {activeMover.patternLabel}
              </h3>
              <p className="font-mono text-[10px] text-slate-500 tabular-nums">
                TC {activeMover.refPrice.toLocaleString('vi-VN')} · KL 15m {activeMover.volumeRatio15m}x · NN{' '}
                {activeMover.foreignNetVol > 0 ? '+' : ''}
                {activeMover.foreignNetVol.toLocaleString('vi-VN')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void runDiagnose('single', activeMover)}
                className="inline-flex items-center gap-1 rounded-xl border border-amber-800/40 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-950 hover:bg-amber-100 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200 cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="h-3 w-3" /> Giải mã {activeMover.symbol}
              </button>
              <button
                type="button"
                onClick={() => onOpenPrediction(activeMover.symbol)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-900 hover:underline dark:text-amber-400 cursor-pointer whitespace-nowrap"
              >
                <TrendingUp className="h-3 w-3" /> Đồ thị đầy đủ
              </button>
            </div>
          </div>

          <div className="mt-2.5 h-36 w-full">
            {activeMover.intradayPath.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={activeMover.intradayPath} margin={{ top: 4, right: 6, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d6d3d1" opacity={0.4} />
                  <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#78716c' }} minTickGap={18} />
                  <YAxis
                    yAxisId="price"
                    domain={['auto', 'auto']}
                    tick={{ fontSize: 9, fill: '#78716c' }}
                    width={42}
                    tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                  />
                  <YAxis
                    yAxisId="vol"
                    orientation="right"
                    hide
                    domain={[0, (dataMax: number) => Math.max(100, dataMax * 3.5)]}
                  />
                  <Tooltip
                    formatter={(val: unknown, name: unknown) =>
                      name === 'price'
                        ? [`${Number(val).toLocaleString('vi-VN')} đ`, 'Giá']
                        : [Number(val).toLocaleString('vi-VN'), 'Khối lượng']
                    }
                    contentStyle={{
                      fontSize: '11px',
                      backgroundColor: '#0f172a',
                      borderColor: '#44403c',
                      color: '#f8fafc',
                    }}
                  />
                  <ReferenceLine yAxisId="price" y={activeMover.refPrice} stroke="#d97706" strokeDasharray="4 4" />
                  <Bar yAxisId="vol" dataKey="volume" fill="#a8a29e" opacity={0.35} barSize={8} />
                  <Area
                    yAxisId="price"
                    type="monotone"
                    dataKey="price"
                    stroke={activeMover.changePct >= 0 ? '#059669' : '#dc2626'}
                    strokeWidth={2}
                    fill={activeMover.changePct >= 0 ? '#10b981' : '#ef4444'}
                    fillOpacity={0.14}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-slate-500">
                Chưa có chuỗi nến 15 phút trong phiên cho {activeMover.symbol}.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Slide-over Drawer for AI Root-Cause & Action Diagnosis */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/55 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Giải mã Nguyên nhân Biến động Thất thường"
        >
          <div className="flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-slate-200 bg-slate-50 p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
              <div>
                <h3 className="flex items-center gap-2 font-sans tracking-tight text-xl font-bold text-slate-900 dark:text-slate-100">
                  <Sparkles className="h-4 w-4 text-amber-800 dark:text-amber-400" />
                  <span>AI Giải mã Nguyên nhân &amp; Bẫy giá Trong Phiên</span>
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Đối chiếu IntradayOhlc 15m, Khối ngoại &amp; Kho Tin 7 ngày.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 cursor-pointer shrink-0"
                aria-label="Đóng ngăn giải mã"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {diagnoseError && (
              <div className="mt-4 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
                {diagnoseError}
              </div>
            )}

            {diagnoseLoading ? (
              <div className="flex flex-1 flex-col items-center justify-center py-16 text-xs text-slate-500">
                <Activity className="mb-2 h-6 w-6 animate-spin text-amber-800 dark:text-amber-400" />
                Đang đối chiếu IntradayOhlc, Khối ngoại &amp; Kho Tin 7 ngày bằng AI...
              </div>
            ) : diagnosis ? (
              <div className="mt-4 space-y-3.5 text-xs leading-relaxed">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-xl bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white dark:bg-slate-100 dark:text-slate-900">
                      {diagnosis.scope === 'group' ? 'TOÀN NHÓM BIẾN ĐỘNG' : diagnosis.symbol}
                    </span>
                    <span className="rounded-xl border border-slate-300 bg-white px-2 py-0.5 font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                      {diagnosis.rootCauseCategory}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {diagnosis.mode === 'gemini' ? 'Gemini AI' : 'Định lượng cục bộ'}
                    </span>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 rounded-xl px-2 py-0.5 font-mono text-[11px] font-bold ${
                      diagnosis.trapRiskLevel === 'Cao'
                        ? 'bg-red-700 text-white'
                        : diagnosis.trapRiskLevel === 'Trung bình'
                          ? 'bg-amber-700 text-white'
                          : 'bg-emerald-700 text-white dark:bg-emerald-500 dark:text-slate-950'
                    }`}
                  >
                    <ShieldAlert className="h-3 w-3" />
                    Bẫy giá: {diagnosis.trapRiskLevel}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-950">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    1. Bản chất nhịp giật lắc (Root Cause Diagnosis)
                  </p>
                  <p className="mt-1 text-slate-700 dark:text-slate-300">{diagnosis.rootCauseAnalysis}</p>
                </div>

                <div className="rounded-xl border border-amber-300/80 bg-amber-50/70 p-3 dark:border-amber-800/60 dark:bg-amber-950/30">
                  <p className="flex items-center gap-1.5 font-semibold text-amber-950 dark:text-amber-200">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>2. Cảnh báo Bẫy giá &amp; Dòng tiền</span>
                  </p>
                  <p className="mt-1 text-slate-800 dark:text-slate-200">{diagnosis.trapRiskWarning}</p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">Đang nắm giữ cổ phiếu</p>
                    <p className="mt-1 text-slate-700 dark:text-slate-300">{diagnosis.holderAction}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">Đang cầm tiền mua mới</p>
                    <p className="mt-1 text-slate-700 dark:text-slate-300">{diagnosis.cashAction}</p>
                    <p className="mt-1.5 font-mono text-[11px] font-semibold text-amber-900 dark:text-amber-400">
                      Vùng cân bằng T+1: {diagnosis.tPlus1BalanceZone}
                    </p>
                  </div>
                </div>

                {diagnosis.groupHighlights && diagnosis.groupHighlights.length > 0 && (
                  <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      Tóm tắt từng mã nổi bật trong nhóm:
                    </p>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {diagnosis.groupHighlights.map((gh) => (
                        <div
                          key={gh.symbol}
                          className="rounded-xl border border-slate-200 bg-white p-2.5 text-[11px] dark:border-slate-800 dark:bg-slate-950"
                        >
                          <div className="flex items-center justify-between font-mono">
                            <strong className="text-slate-900 dark:text-slate-100">
                              {gh.symbol} · {gh.patternLabel}
                            </strong>
                            <span
                              className={
                                gh.trapRisk === 'Cao'
                                  ? 'font-bold text-red-700 dark:text-red-400'
                                  : gh.trapRisk === 'Trung bình'
                                    ? 'font-bold text-amber-800 dark:text-amber-400'
                                    : 'font-bold text-emerald-700 dark:text-emerald-400'
                              }
                            >
                              Bẫy: {gh.trapRisk}
                            </span>
                          </div>
                          <p className="mt-1 text-slate-600 dark:text-slate-400">{gh.diagnosis}</p>
                          <p className="mt-1 font-medium text-slate-800 dark:text-slate-200">→ {gh.action}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {diagnosis.foreignAndNewsContext} · {diagnosis.disclaimer}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}
