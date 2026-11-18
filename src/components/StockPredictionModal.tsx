import { X } from 'lucide-react';
import type {
  CorporateEventItem,
  FinanceTaggedArticle,
  StockPredictionResponse,
  StoredNewsArticle,
  WatchlistItemConfig,
} from '../types/news';
import { StockTechnicalWorkspace } from './StockTechnicalWorkspace';

interface StockPredictionModalProps {
  open: boolean;
  loading: boolean;
  error: string | null;
  prediction: StockPredictionResponse | null;
  symbolTitle: string;
  watchlistItem?: WatchlistItemConfig;
  taggedArticles?: FinanceTaggedArticle[];
  storedArticles?: StoredNewsArticle[];
  corporateEvents?: CorporateEventItem[];
  autoTriggerCashflow?: boolean;
  onClose: () => void;
  onAnalyzeNewsUrl: (url: string, title?: string, sourceName?: string) => void;
}

export function StockPredictionModal({
  open,
  loading,
  error,
  prediction,
  symbolTitle,
  watchlistItem,
  taggedArticles = [],
  storedArticles = [],
  corporateEvents = [],
  autoTriggerCashflow = false,
  onClose,
  onAnalyzeNewsUrl,
}: StockPredictionModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stock-predict-modal-title"
    >
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-4 border-b border-slate-200 pb-3.5 dark:border-slate-800">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-xl bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white dark:bg-slate-100 dark:text-slate-900">
                {symbolTitle}
              </span>
              {prediction && (
                <>
                  <span className="rounded-xl border border-slate-300 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:border-slate-700 dark:text-slate-300">
                    {prediction.exchange}
                  </span>
                  <span className="rounded-xl border border-amber-800/30 bg-amber-50 px-2 py-0.5 font-mono text-[10px] font-medium text-amber-900 dark:border-amber-700/40 dark:bg-amber-950/40 dark:text-amber-300">
                    {prediction.marketDataMode === 'ssi'
                      ? 'Dữ liệu SSI FastConnect'
                      : 'Dữ liệu .VN + Multi-Timeframe'}
                  </span>
                  <span className="rounded-xl border border-slate-300 bg-white px-2 py-0.5 font-mono text-[10px] text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    {prediction.predictionMode === 'gemini'
                      ? 'AI Gemini + Định lượng'
                      : 'Định lượng kỹ thuật'}
                  </span>
                </>
              )}
            </div>
            <h2
              id="stock-predict-modal-title"
              className="mt-1.5 font-sans tracking-tight text-xl font-bold text-slate-900 dark:text-slate-100"
            >
              {prediction?.companyName
                ? `Đồ thị Kỹ thuật, Dòng tiền & Tín hiệu Nến ${symbolTitle} — ${prediction.companyName}`
                : `Đang phân tích cổ phiếu ${symbolTitle}`}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Đóng modal dự đoán"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <StockTechnicalWorkspace
          loading={loading}
          error={error}
          prediction={prediction}
          symbolTitle={symbolTitle}
          watchlistItem={watchlistItem}
          taggedArticles={taggedArticles}
          storedArticles={storedArticles}
          corporateEvents={corporateEvents}
          autoTriggerCashflow={autoTriggerCashflow}
          onAnalyzeNewsUrl={onAnalyzeNewsUrl}
        />
      </div>
    </div>
  );
}
