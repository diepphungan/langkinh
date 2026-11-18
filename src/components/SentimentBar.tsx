import type { SentimentBreakdown } from '../types/news';

interface SentimentBarProps {
  sentiment: SentimentBreakdown;
  compact?: boolean;
}

export function SentimentBar({ sentiment, compact = false }: SentimentBarProps) {
  const { positive, neutral, negative, toneLabel } = sentiment;

  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-xs">
        <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
          Sắc thái: {toneLabel}
        </span>
        {!compact && (
          <span className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
            +{positive}% / ={neutral}% / -{negative}%
          </span>
        )}
      </div>

      <div
        className="flex h-1.5 w-full overflow-hidden bg-slate-200 dark:bg-slate-800"
        role="img"
        aria-label={`Phân bổ sắc thái: Tích cực ${positive}%, Trung lập ${neutral}%, Thận trọng ${negative}%`}
      >
        <div
          style={{ width: `${positive}%` }}
          className="h-full bg-emerald-700 dark:bg-emerald-500 transition-all duration-300"
        />
        <div
          style={{ width: `${neutral}%` }}
          className="h-full bg-slate-400 dark:bg-slate-500 transition-all duration-300"
        />
        <div
          style={{ width: `${negative}%` }}
          className="h-full bg-amber-800 dark:bg-amber-500 transition-all duration-300"
        />
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 bg-emerald-700 dark:bg-emerald-500" aria-hidden="true" />
          Tích cực {positive}%
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 bg-slate-400 dark:bg-slate-500" aria-hidden="true" />
          Trung lập {neutral}%
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 bg-amber-800 dark:bg-amber-500" aria-hidden="true" />
          Thận trọng {negative}%
        </span>
      </div>
    </div>
  );
}
