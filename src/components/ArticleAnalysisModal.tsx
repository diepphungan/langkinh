import { useEffect, useState } from 'react';
import {
  ExternalLink,
  Loader2,
  Minus,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import type {
  CrawledArticleResult,
  DeepAnalysisReport,
  SentimentVerdict,
} from '../types/news';
import { SentimentBar } from './SentimentBar';
import { DeepAnalysisCanvas } from './DeepAnalysisCanvas';

interface ArticleAnalysisModalProps {
  target: { url: string; title?: string } | null;
  onClose: () => void;
  onSaveReport: (report: DeepAnalysisReport) => void;
  isReportSaved: (id: string) => boolean;
}

function SentimentVerdictText({ label }: { label: SentimentVerdict }) {
  if (label === 'Tích cực') {
    return (
      <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
        <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Tích cực</span>
      </span>
    );
  }
  if (label === 'Tiêu cực') {
    return (
      <span className="inline-flex items-center gap-1.5 font-semibold text-red-700 dark:text-red-400">
        <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Tiêu cực</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
      <Minus className="h-3.5 w-3.5" aria-hidden="true" />
      <span>Trung lập</span>
    </span>
  );
}

export function ArticleAnalysisModal({
  target,
  onClose,
  onSaveReport,
  isReportSaved,
}: ArticleAnalysisModalProps) {
  const [viewMode, setViewMode] = useState<'summary' | 'deep'>('summary');
  const [loadingCrawl, setLoadingCrawl] = useState(false);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [crawled, setCrawled] = useState<CrawledArticleResult | null>(null);

  const [loadingDeep, setLoadingDeep] = useState(false);
  const [deepError, setDeepError] = useState<string | null>(null);
  const [deepReport, setDeepReport] = useState<DeepAnalysisReport | null>(null);

  useEffect(() => {
    if (!target?.url) return;
    let active = true;
    setViewMode('summary');
    setCrawled(null);
    setDeepReport(null);
    setCrawlError(null);
    setDeepError(null);
    setLoadingCrawl(true);

    fetch('/api/news/crawl-article', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: target.url, runNlp: true }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Không thể trích xuất và phân tích bài viết.');
        }
        return data as CrawledArticleResult;
      })
      .then((data) => {
        if (active) setCrawled(data);
      })
      .catch((err) => {
        if (active) {
          setCrawlError(err instanceof Error ? err.message : 'Lỗi phân tích bài viết.');
        }
      })
      .finally(() => {
        if (active) setLoadingCrawl(false);
      });

    return () => {
      active = false;
    };
  }, [target?.url]);

  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [target, onClose]);

  if (!target) return null;

  const handleLoadDeepReport = async () => {
    setViewMode('deep');
    if (deepReport || loadingDeep) return;
    setLoadingDeep(true);
    setDeepError(null);
    try {
      const res = await fetch('/api/news/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: target.url,
          title: crawled?.title || target.title,
          text: crawled?.contentParagraphs.join('\n\n'),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể chạy phân tích đa chiều.');
      }
      setDeepReport(data as DeepAnalysisReport);
    } catch (err) {
      setDeepError(err instanceof Error ? err.message : 'Lỗi phân tích chuyên sâu.');
    } finally {
      setLoadingDeep(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Phân tích nội dung bài viết"
      onClick={onClose}
    >
      <div
        className="mx-auto my-4 max-w-5xl border border-slate-200 bg-slate-50 shadow-2xl sm:my-8 dark:border-slate-800 dark:bg-slate-950"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-6 py-3.5 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/95">
          <div className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-900/90">
            <button
              type="button"
              onClick={() => setViewMode('summary')}
              className={`rounded px-3 py-1 text-xs font-medium cursor-pointer whitespace-nowrap ${
                viewMode === 'summary'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              Tổng hợp trang &amp; Cảm xúc
            </button>
            <button
              type="button"
              onClick={handleLoadDeepReport}
              className={`inline-flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium cursor-pointer whitespace-nowrap ${
                viewMode === 'deep'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <Sparkles className="h-3 w-3" />
              <span>Đối chiếu đa góc nhìn &amp; Kiểm chứng</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={target.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 whitespace-nowrap"
            >
              <span>Mở bài gốc</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng cửa sổ phân tích"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8">
          {viewMode === 'summary' && (
            <>
              {loadingCrawl && (
                <div className="py-16 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-700 dark:text-slate-300" />
                  <p className="mt-3 font-sans tracking-tight text-lg text-slate-900 dark:text-slate-100">
                    Đang thu thập nội dung trang báo &amp; chạy phân tích tự động...
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate max-w-md mx-auto">
                    {target.url}
                  </p>
                </div>
              )}

              {crawlError && !loadingCrawl && (
                <div className="space-y-4 border border-red-800/30 bg-red-50/70 p-5 text-sm text-red-900 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-200">
                  <p>{crawlError}</p>
                  <button
                    type="button"
                    onClick={handleLoadDeepReport}
                    className="rounded-md bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 cursor-pointer"
                  >
                    Thử phân tích qua đối chiếu tìm kiếm
                  </button>
                </div>
              )}

              {crawled && !loadingCrawl && (
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                  <div className="lg:col-span-7 space-y-6">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {crawled.sourceDomain}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{crawled.publishedDate}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{crawled.wordCount} từ</span>
                      </div>
                      <h2 className="mt-2 font-sans tracking-tight text-2xl font-semibold leading-snug text-slate-900 dark:text-slate-100">
                        {crawled.title}
                      </h2>
                    </div>

                    {crawled.nlpAnalysis && (
                      <div className="border-t border-slate-200 pt-5 dark:border-slate-800">
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                          Tóm tắt nội dung bài viết
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                          {crawled.nlpAnalysis.summary.conciseSummary}
                        </p>
                        <ul className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                          {crawled.nlpAnalysis.summary.keyPoints.map((pt, idx) => (
                            <li key={idx} className="flex items-start gap-2.5">
                              <span className="font-mono text-xs text-slate-400 pt-0.5 tabular-nums">
                                0{idx + 1}.
                              </span>
                              <span>{pt}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="border-t border-slate-200 pt-5 dark:border-slate-800">
                      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        Nội dung trích xuất từ trang ({crawled.crawlMethod})
                      </p>
                      <div className="mt-3 max-h-80 space-y-3 overflow-y-auto pr-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                        {crawled.contentParagraphs.map((para, idx) => (
                          <p key={idx}>{para}</p>
                        ))}
                      </div>
                    </div>
                  </div>

                  <aside className="lg:col-span-5 space-y-5">
                    {crawled.nlpAnalysis && (
                      <>
                        <div className="border border-slate-200 bg-slate-50/90 p-5 dark:border-slate-800 dark:bg-slate-900/90">
                          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                            Phân loại chủ đề
                          </p>
                          <div className="mt-2 flex items-baseline justify-between">
                            <span className="font-sans tracking-tight text-2xl font-semibold text-slate-900 dark:text-slate-100">
                              {crawled.nlpAnalysis.classification.primaryCategory}
                            </span>
                            <span className="font-mono text-xs tabular-nums text-amber-900 dark:text-amber-400">
                              {crawled.nlpAnalysis.classification.confidencePercent}%
                            </span>
                          </div>
                          <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                            {crawled.nlpAnalysis.classification.rationale}
                          </p>
                        </div>

                        <div className="border border-slate-200 p-5 dark:border-slate-800 space-y-3">
                          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                            Phân tích cảm xúc
                          </p>
                          <SentimentVerdictText
                            label={crawled.nlpAnalysis.sentiment.label}
                          />
                          <SentimentBar sentiment={crawled.nlpAnalysis.sentiment.scores} />
                          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                            {crawled.nlpAnalysis.sentiment.explanation}
                          </p>
                        </div>
                      </>
                    )}

                    {crawled.keywords.length > 0 && (
                      <div className="border border-slate-200 p-5 dark:border-slate-800">
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                          Từ khóa bài viết
                        </p>
                        <p className="mt-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                          {crawled.keywords.join(' · ')}
                        </p>
                      </div>
                    )}
                  </aside>
                </div>
              )}
            </>
          )}

          {viewMode === 'deep' && (
            <>
              {loadingDeep && (
                <div className="py-16 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-700 dark:text-slate-300" />
                  <p className="mt-3 font-sans tracking-tight text-lg text-slate-900 dark:text-slate-100">
                    Đang kiểm chứng dữ kiện và đối chiếu đa góc nhìn...
                  </p>
                </div>
              )}
              {deepError && !loadingDeep && (
                <div className="border border-red-800/30 bg-red-50/70 p-4 text-sm text-red-900 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-200">
                  {deepError}
                </div>
              )}
              {deepReport && !loadingDeep && (
                <DeepAnalysisCanvas
                  report={deepReport}
                  onToggleSave={onSaveReport}
                  isSaved={isReportSaved(deepReport.id)}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
