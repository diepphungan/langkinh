import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Compass,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import type {
  PortfolioStrategyBasketItem,
  StockQuoteSnapshot,
  WatchlistItemConfig,
  WatchlistPortfolioStrategyResponse,
  WatchlistStockAnalytics,
} from '../types/news';

interface PortfolioStrategySectionProps {
  watchlist: WatchlistItemConfig[];
  quotes: Record<string, StockQuoteSnapshot>;
  analytics: Record<string, WatchlistStockAnalytics>;
  strategy: WatchlistPortfolioStrategyResponse | null;
  strategyLoading: boolean;
  onSynthesizeStrategy: (forceRefresh?: boolean) => void;
  onOpenPrediction: (symbol: string) => void;
  compactAccordion?: boolean;
}

export function PortfolioStrategySection({
  watchlist,
  quotes,
  analytics,
  strategy,
  strategyLoading,
  onSynthesizeStrategy,
  onOpenPrediction,
  compactAccordion = true,
}: PortfolioStrategySectionProps) {
  const [basketsExpanded, setBasketsExpanded] = useState(!compactAccordion);
  const [strategyDrawerOpen, setStrategyDrawerOpen] = useState(false);

  const autoBaskets = useMemo(() => {
    if (strategy?.baskets) {
      return strategy.baskets;
    }

    const priorityBuy: PortfolioStrategyBasketItem[] = [];
    const holdOptimize: PortfolioStrategyBasketItem[] = [];
    const riskRestructure: PortfolioStrategyBasketItem[] = [];

    for (const w of watchlist) {
      const q = quotes[w.symbol];
      const an = analytics[w.symbol];
      if (!an) continue;
      const price = q?.price || 0;
      const changePct = q?.changePct || 0;
      const score = an.recommendation.totalScore;
      const verdict = an.recommendation.verdict;

      if (score >= 65) {
        priorityBuy.push({
          symbol: w.symbol,
          companyName: q?.companyName || w.companyName,
          price,
          changePct,
          score,
          verdict,
          buyZoneOrSupport: an.recommendation.suggestedBuyZone,
          rationale: `ROE ${an.fundamentals.roePct}% · ${an.fundamentals.primaryMetric} ${an.fundamentals.primaryValue} (${an.fundamentals.diffVsSectorPct >= 0 ? '+' : ''}${an.fundamentals.diffVsSectorPct}% vs ngành) · ${an.timing.maPositionLabel}`,
          allocationPct: 0,
        });
      } else if (score < 45 || (an.timing.maPosition === 'below_both' && score < 52)) {
        riskRestructure.push({
          symbol: w.symbol,
          companyName: q?.companyName || w.companyName,
          price,
          changePct,
          score,
          verdict,
          buyZoneOrSupport: an.timing.ma50
            ? `Kháng cự MA50: ${an.timing.ma50.toLocaleString('vi-VN')} đ`
            : 'Canh hồi hạ tỷ trọng',
          rationale:
            an.recommendation.riskWarning ||
            `${an.timing.maPositionLabel} · RSI(14) = ${an.timing.rsi14 ?? 'N/A'}`,
          allocationPct: 0,
        });
      } else {
        holdOptimize.push({
          symbol: w.symbol,
          companyName: q?.companyName || w.companyName,
          price,
          changePct,
          score,
          verdict,
          buyZoneOrSupport: an.timing.ma20
            ? `Hỗ trợ MA20: ${an.timing.ma20.toLocaleString('vi-VN')} đ`
            : 'Giữ theo hỗ trợ',
          rationale: `${an.timing.maPositionLabel} · RSI(14) ${an.timing.rsi14 ?? 'N/A'} · Vol ${an.liquidity.ma20VolPct}% TB20`,
          allocationPct: 0,
        });
      }
    }

    priorityBuy.sort((a, b) => b.score - a.score);
    holdOptimize.sort((a, b) => b.score - a.score);
    riskRestructure.sort((a, b) => a.score - b.score);

    return { priorityBuy, holdOptimize, riskRestructure };
  }, [watchlist, quotes, analytics, strategy]);

  if (watchlist.length === 0) return null;

  const hasAnyAnalytics = Object.keys(analytics).length > 0;

  const handleOpenAiDrawer = () => {
    setStrategyDrawerOpen(true);
    if (!strategy && !strategyLoading && hasAnyAnalytics) {
      onSynthesizeStrategy(false);
    }
  };

  return (
    <div className="mt-4 border-t border-slate-200 pt-3.5 dark:border-slate-800">
      {/* Compact Header & Accordion Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Compass className="h-4 w-4 text-amber-800 dark:text-amber-400" />
          <h3 className="font-sans tracking-tight text-base font-bold text-slate-900 dark:text-slate-100">
            Chiến lược Danh mục Watchlist (4 Trụ cột)
          </h3>
          {strategy && (
            <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
              {strategy.mode === 'gemini' ? 'Gemini AI' : 'Định lượng'}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={!hasAnyAnalytics}
            onClick={handleOpenAiDrawer}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-800/40 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Sparkles className={`h-3.5 w-3.5 ${strategyLoading ? 'animate-spin' : ''}`} />
            <span>{strategy ? 'Xem AI Luận giải Vốn' : 'AI Luận giải Phân bổ Vốn'}</span>
          </button>

          <button
            type="button"
            disabled={!hasAnyAnalytics}
            onClick={() => setBasketsExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>{basketsExpanded ? 'Thu gọn 3 giỏ' : 'Mở chi tiết 3 giỏ'}</span>
            {basketsExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* 3 Compact Summary Tiles (Always visible, click toggles accordion) */}
      {!hasAnyAnalytics ? (
        <div className="mt-2.5 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
          Đang tổng hợp dữ liệu 4 trụ cột cho Watchlist...
        </div>
      ) : (
        <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => setBasketsExpanded((p) => !p)}
            className="flex items-center justify-between gap-2 rounded-xl border border-emerald-300/70 bg-emerald-50/40 px-3 py-2 text-left hover:border-emerald-500 dark:border-emerald-800/60 dark:bg-emerald-950/20 cursor-pointer"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-900 dark:text-emerald-300">
                <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Ưu tiên Giải ngân</span>
              </div>
              <p className="mt-0.5 truncate font-mono text-[10px] text-emerald-800/80 dark:text-emerald-300/80">
                {autoBaskets.priorityBuy.length > 0
                  ? autoBaskets.priorityBuy.map((i) => i.symbol).join(', ')
                  : 'Chưa có mã ≥65đ'}
              </p>
            </div>
            <span className="shrink-0 rounded-md bg-emerald-700 px-2 py-0.5 font-mono text-xs font-bold text-white tabular-nums">
              {autoBaskets.priorityBuy.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setBasketsExpanded((p) => !p)}
            className="flex items-center justify-between gap-2 rounded-xl border border-amber-300/70 bg-amber-50/35 px-3 py-2 text-left hover:border-amber-500 dark:border-amber-800/60 dark:bg-amber-950/15 cursor-pointer"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-900 dark:text-amber-300">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Nắm giữ Tối ưu</span>
              </div>
              <p className="mt-0.5 truncate font-mono text-[10px] text-amber-900/80 dark:text-amber-300/80">
                {autoBaskets.holdOptimize.length > 0
                  ? autoBaskets.holdOptimize.map((i) => i.symbol).join(', ')
                  : 'Không có mã'}
              </p>
            </div>
            <span className="shrink-0 rounded-md bg-amber-600 px-2 py-0.5 font-mono text-xs font-bold text-white tabular-nums">
              {autoBaskets.holdOptimize.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setBasketsExpanded((p) => !p)}
            className="flex items-center justify-between gap-2 rounded-xl border border-red-300/70 bg-red-50/35 px-3 py-2 text-left hover:border-red-500 dark:border-red-800/60 dark:bg-red-950/15 cursor-pointer"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-900 dark:text-red-300">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Cảnh báo Rủi ro</span>
              </div>
              <p className="mt-0.5 truncate font-mono text-[10px] text-red-800/80 dark:text-red-300/80">
                {autoBaskets.riskRestructure.length > 0
                  ? autoBaskets.riskRestructure.map((i) => i.symbol).join(', ')
                  : 'Kiểm soát tốt'}
              </p>
            </div>
            <span className="shrink-0 rounded-md bg-red-700 px-2 py-0.5 font-mono text-xs font-bold text-white tabular-nums">
              {autoBaskets.riskRestructure.length}
            </span>
          </button>
        </div>
      )}

      {/* Expandable 3 Action Baskets */}
      {hasAnyAnalytics && basketsExpanded && (
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
          {/* Basket 1: Priority Buy */}
          <div className="rounded-xl border border-emerald-300/70 bg-emerald-50/40 p-3 dark:border-emerald-800/60 dark:bg-emerald-950/20">
            <div className="flex items-center justify-between gap-2 border-b border-emerald-200/80 pb-2 dark:border-emerald-800/50">
              <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
                1. Ưu tiên Giải ngân Mới
              </span>
              <span className="font-mono text-[10px] font-bold text-emerald-800 tabular-nums dark:text-emerald-300">
                {autoBaskets.priorityBuy.length} mã
              </span>
            </div>

            {autoBaskets.priorityBuy.length === 0 ? (
              <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400">
                Chưa có mã đạt chuẩn ≥65đ. Kiên nhẫn chờ điểm mua.
              </p>
            ) : (
              <div className="mt-2.5 space-y-2">
                {autoBaskets.priorityBuy.map((item) => (
                  <div
                    key={item.symbol}
                    className="rounded-xl border border-emerald-200 bg-white p-2 dark:border-emerald-900/50 dark:bg-slate-900"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenPrediction(item.symbol)}
                          className="rounded-xl bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 cursor-pointer"
                        >
                          {item.symbol}
                        </button>
                        <span className="font-mono text-xs font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                          {item.price > 0 ? item.price.toLocaleString('vi-VN') : '—'}
                        </span>
                        <span
                          className={`inline-flex items-center font-mono text-[10px] tabular-nums ${
                            item.changePct >= 0
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-red-700 dark:text-red-400'
                          }`}
                        >
                          {item.changePct >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {item.changePct > 0 ? '+' : ''}
                          {item.changePct}%
                        </span>
                      </div>
                      <span className="rounded-md bg-emerald-700 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white tabular-nums">
                        {item.score}/100
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-[10px] font-semibold text-emerald-800 dark:text-emerald-300">
                      Mua: {item.buyZoneOrSupport}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-slate-600 dark:text-slate-400">
                      {item.rationale}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Basket 2: Hold & Optimize */}
          <div className="rounded-xl border border-amber-300/70 bg-amber-50/35 p-3 dark:border-amber-800/60 dark:bg-amber-950/15">
            <div className="flex items-center justify-between gap-2 border-b border-amber-200/80 pb-2 dark:border-amber-800/50">
              <span className="text-xs font-bold text-amber-900 dark:text-amber-300">
                2. Nắm giữ Tối ưu Lợi nhuận
              </span>
              <span className="font-mono text-[10px] font-bold text-amber-900 tabular-nums dark:text-amber-300">
                {autoBaskets.holdOptimize.length} mã
              </span>
            </div>

            {autoBaskets.holdOptimize.length === 0 ? (
              <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400">
                Không có mã ở trạng thái nắm giữ trung tính.
              </p>
            ) : (
              <div className="mt-2.5 space-y-2">
                {autoBaskets.holdOptimize.map((item) => (
                  <div
                    key={item.symbol}
                    className="rounded-xl border border-amber-200/80 bg-white p-2 dark:border-amber-900/40 dark:bg-slate-900"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenPrediction(item.symbol)}
                          className="rounded-xl bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 cursor-pointer"
                        >
                          {item.symbol}
                        </button>
                        <span className="font-mono text-xs font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                          {item.price > 0 ? item.price.toLocaleString('vi-VN') : '—'}
                        </span>
                        <span
                          className={`font-mono text-[10px] tabular-nums ${
                            item.changePct >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'
                          }`}
                        >
                          {item.changePct > 0 ? '+' : ''}
                          {item.changePct}%
                        </span>
                      </div>
                      <span className="rounded-md bg-amber-600 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white tabular-nums">
                        {item.score}/100
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-[10px] font-semibold text-amber-900 dark:text-amber-300">
                      {item.buyZoneOrSupport}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-slate-600 dark:text-slate-400">
                      {item.rationale}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Basket 3: Risk Warning */}
          <div className="rounded-xl border border-red-300/70 bg-red-50/35 p-3 dark:border-red-800/60 dark:bg-red-950/15">
            <div className="flex items-center justify-between gap-2 border-b border-red-200/80 pb-2 dark:border-red-800/50">
              <span className="text-xs font-bold text-red-900 dark:text-red-300">
                3. Cảnh báo Rủi ro / Cơ cấu
              </span>
              <span className="font-mono text-[10px] font-bold text-red-800 tabular-nums dark:text-red-300">
                {autoBaskets.riskRestructure.length} mã
              </span>
            </div>

            {autoBaskets.riskRestructure.length === 0 ? (
              <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400">
                Chưa ghi nhận mã vi phạm hỗ trợ MA20/MA50.
              </p>
            ) : (
              <div className="mt-2.5 space-y-2">
                {autoBaskets.riskRestructure.map((item) => (
                  <div
                    key={item.symbol}
                    className="rounded-xl border border-red-200 bg-white p-2 dark:border-red-900/50 dark:bg-slate-900"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenPrediction(item.symbol)}
                          className="rounded-xl bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 cursor-pointer"
                        >
                          {item.symbol}
                        </button>
                        <span className="font-mono text-xs font-semibold text-slate-900 tabular-nums dark:text-slate-100">
                          {item.price > 0 ? item.price.toLocaleString('vi-VN') : '—'}
                        </span>
                        <span
                          className={`font-mono text-[10px] tabular-nums ${
                            item.changePct >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'
                          }`}
                        >
                          {item.changePct > 0 ? '+' : ''}
                          {item.changePct}%
                        </span>
                      </div>
                      <span className="rounded-md bg-red-700 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white tabular-nums">
                        {item.score}/100
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-[10px] font-semibold text-red-800 dark:text-red-300">
                      {item.buyZoneOrSupport}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-slate-600 dark:text-slate-400">
                      {item.rationale}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Slide-over Drawer for AI Detailed Portfolio Capital Allocation */}
      {strategyDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/55 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="AI Luận giải Phân bổ Vốn Watchlist"
        >
          <div className="flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-slate-200 bg-slate-50 p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3.5 dark:border-slate-800">
              <div>
                <h3 className="flex items-center gap-2 font-sans tracking-tight text-xl font-bold text-slate-900 dark:text-slate-100">
                  <CheckCircle2 className="h-4 w-4 text-amber-800 dark:text-amber-400" />
                  <span>AI Luận giải Phân bổ Vốn Watchlist</span>
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Đề xuất tỷ trọng NAV và kế hoạch giải ngân từng mã dựa trên 4 trụ cột định lượng.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={strategyLoading}
                  onClick={() => onSynthesizeStrategy(true)}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${strategyLoading ? 'animate-spin' : ''}`} />
                  <span>Làm mới</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStrategyDrawerOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                  aria-label="Đóng ngăn chiến lược"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {strategyLoading && !strategy ? (
              <div className="flex flex-1 flex-col items-center justify-center py-16 text-xs text-slate-500">
                <RefreshCw className="mb-2 h-5 w-5 animate-spin text-amber-800 dark:text-amber-400" />
                Đang tổng hợp phân bổ vốn tối ưu cho từng mã Watchlist...
              </div>
            ) : !strategy ? (
              <div className="py-12 text-center text-xs text-slate-500">
                Nhấn Làm mới để tạo báo cáo phân bổ vốn cho Watchlist.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="rounded-xl border border-amber-800/30 bg-white p-3.5 dark:border-amber-700/40 dark:bg-slate-950">
                  <p className="text-xs font-medium leading-relaxed text-slate-900 dark:text-slate-100">
                    {strategy.marketContextNote}
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    {strategy.overallStrategySummary}
                  </p>
                </div>

                <div className="space-y-2.5">
                  {strategy.aiDetailedAllocation.map((row) => (
                    <div
                      key={row.symbol}
                      className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setStrategyDrawerOpen(false);
                              onOpenPrediction(row.symbol);
                            }}
                            className="rounded-xl bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 cursor-pointer"
                          >
                            {row.symbol}
                          </button>
                          <span className="font-mono text-[11px] font-semibold text-amber-900 dark:text-amber-300">
                            {row.stance}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                          {row.capitalPlan}
                        </p>
                      </div>
                      <div className="shrink-0 text-right font-mono tabular-nums">
                        <div className="text-base font-bold text-slate-900 dark:text-slate-100">
                          {row.suggestedWeightPct}%
                        </div>
                        <div className="text-[10px] text-slate-500">NAV</div>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400">{strategy.disclaimer}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
