import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Award,
  BarChart3,
  Check,
  GitCompare,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  CorporateEventItem,
  FinanceTaggedArticle,
  PeerAiRankingResponse,
  PeerComparisonResponse,
  PeerTimeframe,
  SsiSecurityItem,
  StoredNewsArticle,
} from '../types/news';

interface PeerComparisonSectionProps {
  securities: SsiSecurityItem[];
  watchlistSymbols: string[];
  corporateEvents: CorporateEventItem[];
  taggedArticles: FinanceTaggedArticle[];
  storedArticles: StoredNewsArticle[];
  presetSymbols?: string[];
  onOpenPrediction: (symbol: string) => void;
}

const SECTOR_BASKETS: Array<{ id: string; label: string; symbols: string[] }> = [
  { id: 'bank', label: 'Ngân hàng (VCB, TCB, MBB, ACB)', symbols: ['VCB', 'TCB', 'MBB', 'ACB'] },
  { id: 'steel', label: 'Thép (HPG, HSG, NKG)', symbols: ['HPG', 'HSG', 'NKG'] },
  { id: 'tech', label: 'Công nghệ & Bán lẻ (FPT, MWG, DGW)', symbols: ['FPT', 'MWG', 'DGW'] },
  { id: 'broker', label: 'Chứng khoán (SSI, VND, VCI, HCM)', symbols: ['SSI', 'VND', 'VCI', 'HCM'] },
];

const LINE_COLORS = ['#059669', '#d97706', '#0284c7', '#7c3aed'];

interface PeerTooltipProps {
  active?: boolean;
  label?: string;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
}

function PeerChartTooltip({ active, label, payload }: PeerTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-xl border border-slate-300 bg-white/95 p-2.5 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900/95">
      <p className="border-b border-slate-200 pb-1 font-mono text-[11px] font-bold text-slate-900 dark:border-slate-800 dark:text-slate-100">
        Phiên {label}
      </p>
      <div className="mt-1.5 space-y-1 font-mono text-[11px] tabular-nums">
        {payload.map((entry) => {
          const val = Number(entry.value ?? 0);
          return (
            <div key={entry.name} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                <span
                  className="inline-block h-2 w-2 rounded-md"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name}
              </span>
              <span
                className={
                  val >= 0
                    ? 'font-bold text-emerald-700 dark:text-emerald-400'
                    : 'font-bold text-red-700 dark:text-red-400'
                }
              >
                {val > 0 ? '+' : ''}
                {val.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PeerComparisonSection({
  securities,
  watchlistSymbols,
  corporateEvents,
  taggedArticles,
  storedArticles,
  presetSymbols,
  onOpenPrediction,
}: PeerComparisonSectionProps) {
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(() => {
    if (presetSymbols && presetSymbols.length >= 2) return presetSymbols.slice(0, 4);
    return ['SSI', 'VND', 'VCI', 'HCM'];
  });
  const [tickerInput, setTickerInput] = useState('');
  const [timeframe, setTimeframe] = useState<PeerTimeframe>('1M');
  const [comparison, setComparison] = useState<PeerComparisonResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [aiRank, setAiRank] = useState<PeerAiRankingResponse | null>(null);
  const [rankLoading, setRankLoading] = useState(false);
  const [rankError, setRankError] = useState<string | null>(null);

  const fetchComparison = useCallback(
    async (syms: string[], tf: PeerTimeframe) => {
      if (syms.length < 2) {
        setError('Vui lòng chọn tối thiểu 2 mã cổ phiếu để so sánh.');
        return;
      }
      setLoading(true);
      setError(null);
      setAiRank(null);
      setRankError(null);
      try {
        const res = await fetch('/api/finance/peer-compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbols: syms,
            timeframe: tf,
            corporateEvents: corporateEvents.slice(0, 30),
            taggedArticles: taggedArticles.slice(0, 40),
            storedArticles: storedArticles.slice(0, 40).map((s) => ({
              title: s.title,
              summary: s.summary,
              sourceName: s.sourceName,
              sentimentLabel: s.sentimentLabel,
            })),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Không thể tải dữ liệu so sánh.');
        }
        setComparison(data as PeerComparisonResponse);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Lỗi kết nối ma trận so sánh.');
      } finally {
        setLoading(false);
      }
    },
    [corporateEvents, taggedArticles, storedArticles]
  );

  // Sync presetSymbols when triggered from Anomaly Radar "So sánh"
  useEffect(() => {
    if (presetSymbols && presetSymbols.length >= 2) {
      const normalized = Array.from(
        new Set(presetSymbols.map((s) => s.trim().toUpperCase()))
      ).slice(0, 4);
      setSelectedSymbols(normalized);
      void fetchComparison(normalized, timeframe);
    }
  }, [presetSymbols]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-load initial basket once on mount
  useEffect(() => {
    if (!comparison && !loading) {
      void fetchComparison(selectedSymbols, timeframe);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddTicker = () => {
    const clean = tickerInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!clean) return;
    if (selectedSymbols.includes(clean)) {
      setTickerInput('');
      return;
    }
    if (selectedSymbols.length >= 4) {
      setError('Tối đa so sánh trực tiếp 4 cổ phiếu cùng lúc. Hãy bỏ bớt 1 mã trước khi thêm.');
      return;
    }
    const next = [...selectedSymbols, clean];
    setSelectedSymbols(next);
    setTickerInput('');
    setError(null);
    if (next.length >= 2) {
      void fetchComparison(next, timeframe);
    }
  };

  const handleRemoveTicker = (sym: string) => {
    if (selectedSymbols.length <= 2) {
      setError('Cần giữ ít nhất 2 cổ phiếu để lập ma trận đối chiếu.');
      return;
    }
    const next = selectedSymbols.filter((s) => s !== sym);
    setSelectedSymbols(next);
    void fetchComparison(next, timeframe);
  };

  const handleApplyBasket = (symbols: string[]) => {
    const next = symbols.slice(0, 4);
    setSelectedSymbols(next);
    void fetchComparison(next, timeframe);
  };

  const handleChangeTimeframe = (nextTf: PeerTimeframe) => {
    setTimeframe(nextTf);
    void fetchComparison(selectedSymbols, nextTf);
  };

  const handleRunAiRank = async () => {
    if (!comparison || rankLoading) return;
    setRankLoading(true);
    setRankError(null);
    try {
      const res = await fetch('/api/finance/peer-rank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comparison }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể xếp hạng AI.');
      }
      setAiRank(data as PeerAiRankingResponse);
    } catch (err) {
      setRankError(err instanceof Error ? err.message : 'Lỗi kết nối AI xếp hạng.');
    } finally {
      setRankLoading(false);
    }
  };

  const chartLegendSymbols = useMemo(
    () => comparison?.symbols || selectedSymbols,
    [comparison?.symbols, selectedSymbols]
  );

  return (
    <div className="space-y-6">
      {/* Control Strip: Sector Baskets + Ticker Multi-select + Timeframe */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800">
          <div>
            <h2 className="flex items-center gap-2 font-sans tracking-tight text-xl font-bold text-slate-900 dark:text-slate-100">
              <GitCompare className="h-4 w-4 text-amber-800 dark:text-amber-400" />
              <span>So sánh Trực tiếp 2–4 Cổ phiếu Cùng Ngành (Peer Comparison)</span>
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Chuẩn hóa hiệu suất từ gốc 0%, đối chiếu 4 nhóm chỉ tiêu dòng tiền – kỹ thuật – quản trị ĐHĐCĐ – R/R và xếp hạng phân bổ vốn tối ưu.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="inline-flex rounded-xl border border-slate-300 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-950">
              {(['1W', '1M', '3M'] as PeerTimeframe[]).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  disabled={loading}
                  onClick={() => handleChangeTimeframe(tf)}
                  className={`rounded-md px-2.5 py-1 font-mono text-xs font-semibold cursor-pointer ${
                    timeframe === tf
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={loading || !comparison}
              onClick={() => void handleRunAiRank()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 cursor-pointer whitespace-nowrap"
            >
              {rankLoading ? (
                <>
                  <Activity className="h-3.5 w-3.5 animate-spin" />
                  <span>Đang chấm điểm...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>AI Xếp hạng &amp; Chọn Mã Tối Ưu Nhất</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Sector Baskets */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Rổ ngành nhanh:
          </span>
          {SECTOR_BASKETS.map((b) => {
            const isActive =
              b.symbols.length === selectedSymbols.length &&
              b.symbols.every((s) => selectedSymbols.includes(s));
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => handleApplyBasket(b.symbols)}
                className={`rounded-xl border px-2.5 py-1 text-xs font-medium cursor-pointer ${
                  isActive
                    ? 'border-amber-800 bg-amber-50 text-amber-950 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-200'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                }`}
              >
                {b.label}
              </button>
            );
          })}
        </div>

        {/* Selected Ticker Chips + Add Picker */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {selectedSymbols.map((sym, idx) => (
              <div
                key={sym}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-1 font-mono text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-md"
                  style={{ backgroundColor: LINE_COLORS[idx % LINE_COLORS.length] }}
                />
                <span>{sym}</span>
                {selectedSymbols.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveTicker(sym)}
                    className="text-slate-400 hover:text-red-700 dark:hover:text-red-400 cursor-pointer"
                    aria-label={`Bỏ ${sym}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}

            {watchlistSymbols.length >= 2 && (
              <button
                type="button"
                onClick={() => handleApplyBasket(watchlistSymbols.slice(0, 4))}
                className="rounded-xl border border-dashed border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:border-slate-500 dark:border-slate-700 dark:text-slate-400 cursor-pointer"
              >
                Dùng mã từ Watchlist ({watchlistSymbols.slice(0, 4).join(', ')})
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <input
              list="peer-securities-datalist"
              type="text"
              value={tickerInput}
              onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTicker();
                }
              }}
              placeholder="Thêm mã (tối đa 4)..."
              className="w-40 rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-1 font-mono text-xs uppercase text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <datalist id="peer-securities-datalist">
              {securities.map((s) => (
                <option key={s.symbol} value={s.symbol}>
                  {s.symbol} ({s.exchange}) — {s.companyName}
                </option>
              ))}
            </datalist>
            <button
              type="button"
              disabled={loading || selectedSymbols.length >= 4 || !tickerInput.trim()}
              onClick={handleAddTicker}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" /> Thêm
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        )}
        {rankError && (
          <div className="mt-3 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
            {rankError}
          </div>
        )}
      </section>

      {/* AI Peer Ranking & Capital Allocation Card */}
      {aiRank && (
        <section className="rounded-xl border border-emerald-700/40 bg-emerald-50/40 p-5 dark:border-emerald-700/50 dark:bg-emerald-950/20">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-200 pb-3 dark:border-emerald-900/60">
            <div className="flex flex-wrap items-center gap-2.5">
              <Award className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
              <h3 className="font-sans tracking-tight text-lg font-bold text-slate-900 dark:text-slate-100">
                Xếp hạng Tối ưu Nhóm Ngành · Ưu tiên số 1:{' '}
                <button
                  type="button"
                  onClick={() => onOpenPrediction(aiRank.top_pick_ticker)}
                  className="rounded-xl bg-emerald-700 px-2 py-0.5 font-mono text-sm font-bold text-white hover:bg-emerald-800 dark:bg-emerald-500 dark:text-slate-950 cursor-pointer"
                >
                  {aiRank.top_pick_ticker}
                </button>
              </h3>
            </div>
            <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
              {aiRank.mode === 'gemini' ? 'Gemini AI Quantitative' : 'Định lượng đa yếu tố'}
              {aiRank.cached ? ' · Cache 30m' : ''}
            </span>
          </div>

          <p className="mt-2.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
            {aiRank.marketMacroNote}
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {aiRank.rankings.map((r) => {
              const isTop = r.symbol === aiRank.top_pick_ticker;
              return (
                <div
                  key={r.symbol}
                  className={`rounded-xl border p-3.5 ${
                    isTop
                      ? 'border-emerald-600 bg-white dark:border-emerald-500 dark:bg-slate-950'
                      : 'border-slate-200 bg-white/90 dark:border-slate-800 dark:bg-slate-950'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono text-xs tabular-nums">
                    <span className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] ${
                          isTop
                            ? 'bg-emerald-700 text-white dark:bg-emerald-500 dark:text-slate-950'
                            : 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                        }`}
                      >
                        #{r.rank}
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpenPrediction(r.symbol)}
                        className="hover:underline cursor-pointer"
                      >
                        {r.symbol}
                      </button>
                    </span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">
                      {r.score}/100
                    </span>
                  </div>

                  <div className="mt-2">
                    <div className="flex items-center justify-between font-mono text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                      <span>Tỷ trọng gợi ý</span>
                      <strong className="text-slate-900 dark:text-slate-100">
                        {r.allocationPct}%
                      </strong>
                    </div>
                    <div className="mt-1 h-1.5 w-full bg-slate-100 dark:bg-slate-800">
                      <div
                        style={{ width: `${r.allocationPct}%` }}
                        className={isTop ? 'h-1.5 bg-emerald-500' : 'h-1.5 bg-amber-700'}
                      />
                    </div>
                  </div>

                  <p className="mt-2 text-xs leading-snug text-slate-600 dark:text-slate-300">
                    {r.reason}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Normalized Performance Chart */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            <BarChart3 className="h-3.5 w-3.5 text-amber-800 dark:text-amber-400" />
            <span>Biểu đồ Hiệu suất Tương đối ({timeframe} · Mốc chuẩn 0%)</span>
          </h3>
          {comparison && (
            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
              Dẫn dắt {timeframe}:{' '}
              <strong className="text-emerald-700 dark:text-emerald-400">
                {comparison.leaders.bestPerfSymbol}
              </strong>
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex h-64 items-center justify-center text-xs text-slate-500">
            <Activity className="mr-2 h-4 w-4 animate-spin text-amber-800 dark:text-amber-400" />
            Đang đồng bộ OHLCV &amp; tính toán ma trận so sánh...
          </div>
        ) : comparison && comparison.normalizedSeries.length > 1 ? (
          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={comparison.normalizedSeries}
                margin={{ top: 8, right: 16, left: 4, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#78716c" strokeOpacity={0.18} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#78716c' }}
                  minTickGap={24}
                  tickLine={false}
                />
                <YAxis
                  orientation="right"
                  tick={{ fontSize: 10, fill: '#78716c' }}
                  tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v}%`}
                  width={54}
                  tickLine={false}
                />
                <ReferenceLine y={0} stroke="#78716c" strokeDasharray="4 4" strokeOpacity={0.65} />
                <Tooltip content={<PeerChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', fontFamily: 'monospace' }} />
                {chartLegendSymbols.map((sym, idx) => (
                  <Line
                    key={sym}
                    type="monotone"
                    dataKey={sym}
                    stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                    strokeWidth={2.2}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-52 items-center justify-center text-xs text-slate-500">
            Chưa có dữ liệu đường giá so sánh.
          </div>
        )}
      </section>

      {/* 4-Group Quantitative Comparison Matrix Table */}
      {comparison && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
            <h3 className="font-sans tracking-tight text-lg font-bold text-slate-900 dark:text-slate-100">
              Ma trận Đối chiếu Đa chiều (4 Nhóm Chỉ tiêu)
            </h3>
            <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
              ■ Ô màu ngọc lục bảo = Dẫn đầu chỉ tiêu trong nhóm
            </span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 font-mono text-[11px] uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="py-2.5 pr-4 w-56">Chỉ tiêu so sánh</th>
                  {comparison.rows.map((row) => (
                    <th key={row.symbol} className="py-2.5 px-3">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenPrediction(row.symbol)}
                          className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 cursor-pointer"
                        >
                          {row.symbol} <ArrowUpRight className="h-3 w-3" />
                        </button>
                        <span className="text-[10px] font-normal text-slate-500">
                          {row.exchange}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums dark:divide-slate-800/80">
                {/* GROUP 1: Price & Cashflow */}
                <tr className="bg-slate-50 font-sans text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                  <td colSpan={comparison.rows.length + 1} className="py-2 px-2">
                    1. Giá &amp; Dòng tiền Thông minh
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-sans text-slate-600 dark:text-slate-400">
                    Giá khớp &amp; % Phiên
                  </td>
                  {comparison.rows.map((r) => (
                    <td key={r.symbol} className="py-2.5 px-3">
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {r.price.toLocaleString('vi-VN')} đ
                      </span>{' '}
                      <span
                        className={
                          r.changePct >= 0
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-red-700 dark:text-red-400'
                        }
                      >
                        ({r.changePct > 0 ? '+' : ''}
                        {r.changePct}%)
                      </span>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-sans text-slate-600 dark:text-slate-400">
                    Hiệu suất 1W / 1M / 3M
                  </td>
                  {comparison.rows.map((r) => {
                    const isLeader = r.symbol === comparison.leaders.bestPerfSymbol;
                    return (
                      <td
                        key={r.symbol}
                        className={`py-2.5 px-3 ${
                          isLeader
                            ? 'bg-emerald-50/70 font-bold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {r.perf1W > 0 ? '+' : ''}
                        {r.perf1W}% / {r.perf1M > 0 ? '+' : ''}
                        {r.perf1M}% / {r.perf3M > 0 ? '+' : ''}
                        {r.perf3M}%
                        {isLeader && <Check className="ml-1 inline h-3.5 w-3.5" />}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-sans text-slate-600 dark:text-slate-400">
                    KL / TB20 &amp; Dòng tiền bất thường
                  </td>
                  {comparison.rows.map((r) => (
                    <td key={r.symbol} className="py-2.5 px-3 text-slate-800 dark:text-slate-200">
                      <span>{r.volumeRatio20}x</span> ·{' '}
                      <span className="font-sans text-[11px]">{r.anomalyLabel}</span>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-sans text-slate-600 dark:text-slate-400">
                    Khối ngoại mua/bán ròng
                  </td>
                  {comparison.rows.map((r) => (
                    <td
                      key={r.symbol}
                      className={`py-2.5 px-3 ${
                        r.foreignNetVol > 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : r.foreignNetVol < 0
                            ? 'text-red-700 dark:text-red-400'
                            : 'text-slate-500'
                      }`}
                    >
                      {r.foreignNetVol > 0 ? '+' : ''}
                      {r.foreignNetVol.toLocaleString('vi-VN')} cp
                    </td>
                  ))}
                </tr>

                {/* GROUP 2: Technicals & Candlestick Signals */}
                <tr className="bg-slate-50 font-sans text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                  <td colSpan={comparison.rows.length + 1} className="py-2 px-2">
                    2. Kỹ thuật &amp; Tín hiệu Nến Nhật
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-sans text-slate-600 dark:text-slate-400">
                    Vị thế MA20 &amp; Bollinger
                  </td>
                  {comparison.rows.map((r) => (
                    <td key={r.symbol} className="py-2.5 px-3 font-sans text-slate-800 dark:text-slate-200">
                      <div>{r.ma20Status}</div>
                      <div className="text-[11px] text-slate-500">{r.bbPosition}</div>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-sans text-slate-600 dark:text-slate-400">
                    RSI(14) &amp; Tín hiệu gần nhất
                  </td>
                  {comparison.rows.map((r) => {
                    const isLeader = r.symbol === comparison.leaders.bestTechnicalSymbol;
                    return (
                      <td
                        key={r.symbol}
                        className={`py-2.5 px-3 ${
                          isLeader
                            ? 'bg-emerald-50/70 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <div className="font-bold">RSI: {r.rsi14 ?? '—'}</div>
                        <div className="font-sans text-[11px]">{r.latestSignalLabel}</div>
                      </td>
                    );
                  })}
                </tr>

                {/* GROUP 3: Governance & News */}
                <tr className="bg-slate-50 font-sans text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                  <td colSpan={comparison.rows.length + 1} className="py-2 px-2">
                    3. Dòng tiền Doanh nghiệp, ĐHĐCĐ &amp; Priced-in
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-sans text-slate-600 dark:text-slate-400">
                    Điểm Lợi thế Dòng tiền
                  </td>
                  {comparison.rows.map((r) => {
                    const isLeader = r.symbol === comparison.leaders.strongestFlowSymbol;
                    return (
                      <td
                        key={r.symbol}
                        className={`py-2.5 px-3 ${
                          isLeader
                            ? 'bg-emerald-50/70 font-bold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {r.cashflowScore}/100
                        {isLeader && <Check className="ml-1 inline h-3.5 w-3.5" />}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-sans text-slate-600 dark:text-slate-400">
                    Sự kiện ĐHĐCĐ / Nội bộ
                  </td>
                  {comparison.rows.map((r) => (
                    <td key={r.symbol} className="py-2.5 px-3 font-sans text-slate-700 dark:text-slate-300">
                      <span className="font-mono font-semibold">{r.corporateEvents30dCount} văn bản</span>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">
                        {r.corporateEventsSummary}
                      </p>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-sans text-slate-600 dark:text-slate-400">
                    Chiết khấu tin tức (Priced-in)
                  </td>
                  {comparison.rows.map((r) => (
                    <td key={r.symbol} className="py-2.5 px-3 font-sans text-slate-800 dark:text-slate-200">
                      {r.pricedInStatus}
                    </td>
                  ))}
                </tr>

                {/* GROUP 4: Probability & Risk/Reward */}
                <tr className="bg-slate-50 font-sans text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                  <td colSpan={comparison.rows.length + 1} className="py-2 px-2">
                    4. Xác suất Thắng &amp; Kế hoạch Điểm vào/ra (Trade Setup)
                  </td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-sans text-slate-600 dark:text-slate-400">
                    Win Rate &amp; Tỷ lệ R/R
                  </td>
                  {comparison.rows.map((r) => {
                    const isLeader = r.symbol === comparison.leaders.bestRiskRewardSymbol;
                    return (
                      <td
                        key={r.symbol}
                        className={`py-2.5 px-3 ${
                          isLeader
                            ? 'bg-emerald-50/70 font-bold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {r.winRatePct}% · R/R 1:{r.riskRewardRatio}
                        {isLeader && <Check className="ml-1 inline h-3.5 w-3.5" />}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-sans text-slate-600 dark:text-slate-400">
                    Entry / TP1 / SL (đ)
                  </td>
                  {comparison.rows.map((r) => (
                    <td key={r.symbol} className="py-2.5 px-3 text-[11px] text-slate-700 dark:text-slate-300">
                      <div>Vào: {r.entryPrice.toLocaleString('vi-VN')}</div>
                      <div className="text-emerald-700 dark:text-emerald-400">
                        TP1: {r.tp1Price.toLocaleString('vi-VN')}
                      </div>
                      <div className="text-red-700 dark:text-red-400">
                        SL: {r.slPrice.toLocaleString('vi-VN')}
                      </div>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 font-sans text-slate-600 dark:text-slate-400">
                    Hành động tham chiếu
                  </td>
                  {comparison.rows.map((r) => (
                    <td key={r.symbol} className="py-2.5 px-3">
                      <span
                        className={`inline-block rounded-xl px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                          r.action === 'GIA TĂNG TỶ TRỌNG' || r.action === 'MUA THĂM DÒ'
                            ? 'bg-emerald-700 text-white dark:bg-emerald-500 dark:text-slate-950'
                            : r.action === 'CHỜ ĐIỀU CHỈNH'
                              ? 'bg-amber-700 text-white'
                              : 'bg-red-700 text-white'
                        }`}
                      >
                        {r.action}
                      </span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
