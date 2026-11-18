import { ArrowUpRight, BookmarkX, Clock, Trash2 } from 'lucide-react';
import type { DeepAnalysisReport, NewsStory, ReadingHistoryEntry } from '../types/news';
import { SentimentBar } from './SentimentBar';

interface SavedDossierViewProps {
  savedStories: NewsStory[];
  savedReports: DeepAnalysisReport[];
  readingHistory: ReadingHistoryEntry[];
  onOpenStory: (story: NewsStory) => void;
  onAnalyzeArticleUrl: (
    url: string,
    title?: string,
    sourceName?: string,
    category?: string
  ) => void;
  onRemoveStory: (id: string) => void;
  onOpenReport: (report: DeepAnalysisReport) => void;
  onRemoveReport: (id: string) => void;
  onClearHistory: () => void;
  onGoToFeed: () => void;
}

export function SavedDossierView({
  savedStories,
  savedReports,
  readingHistory,
  onOpenStory,
  onAnalyzeArticleUrl,
  onRemoveStory,
  onOpenReport,
  onRemoveReport,
  onClearHistory,
  onGoToFeed,
}: SavedDossierViewProps) {
  const isEmpty =
    savedStories.length === 0 &&
    savedReports.length === 0 &&
    readingHistory.length === 0;

  if (isEmpty) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">
          Thư viện cá nhân
        </p>
        <h1 className="mt-3 font-sans tracking-tight text-3xl font-semibold text-slate-900 dark:text-slate-100">
          Chưa có hồ sơ tin tức hoặc lịch sử đọc
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Nhấn biểu tượng lưu hoặc mở đọc bất kỳ bản tin nào để lưu trữ phục vụ tra cứu và đối chiếu sau này.
        </p>
        <button
          type="button"
          onClick={onGoToFeed}
          className="mt-6 rounded-md bg-slate-900 px-5 py-2.5 text-xs font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 cursor-pointer"
        >
          Quay lại bản tin hôm nay
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="border-b border-slate-200 pb-6 dark:border-slate-800">
        <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">
          Thư viện lưu trữ &amp; Lịch sử đọc
        </p>
        <h1 className="mt-2 font-sans tracking-tight text-3xl font-semibold text-slate-900 dark:text-slate-100">
          Hồ sơ đã lưu &amp; Nhật ký đọc tin
        </h1>
      </div>

      {savedStories.length > 0 && (
        <section className="mt-8">
          <h2 className="font-sans tracking-tight text-xl font-semibold text-slate-900 dark:text-slate-100">
            Bản tin thời sự đã lưu ({savedStories.length})
          </h2>
          <div className="mt-4 divide-y divide-slate-200 border-t border-b border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {savedStories.map((story) => (
              <div
                key={story.id}
                className="flex flex-col gap-4 py-5 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {story.category}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{story.publishedRelative}</span>
                    <span aria-hidden="true">·</span>
                    <span>Tác động: {story.impactLevel}</span>
                  </div>
                  <h3
                    onClick={() => onOpenStory(story)}
                    className="mt-1.5 cursor-pointer font-sans tracking-tight text-xl font-semibold text-slate-900 hover:text-amber-900 dark:text-slate-100 dark:hover:text-amber-400"
                  >
                    {story.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {story.deck}
                  </p>
                  <div className="mt-3 max-w-md">
                    <SentimentBar sentiment={story.sentiment} compact />
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenStory(story)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                  >
                    <span>Đọc hồ sơ</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveStory(story.id)}
                    aria-label="Xóa khỏi danh sách đã lưu"
                    className="p-2 text-slate-400 hover:text-red-700 dark:hover:text-red-400 cursor-pointer"
                  >
                    <BookmarkX className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {savedReports.length > 0 && (
        <section className="mt-12">
          <h2 className="font-sans tracking-tight text-xl font-semibold text-slate-900 dark:text-slate-100">
            Hồ sơ phân tích chuyên sâu ({savedReports.length})
          </h2>
          <div className="mt-4 divide-y divide-slate-200 border-t border-b border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {savedReports.map((report) => (
              <div
                key={report.id}
                className="flex flex-col gap-4 py-5 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex-1">
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    Phân tích ngày{' '}
                    {new Intl.DateTimeFormat('vi-VN').format(new Date(report.analyzedAt))}
                  </p>
                  <h3
                    onClick={() => onOpenReport(report)}
                    className="mt-1 cursor-pointer font-sans tracking-tight text-xl font-semibold text-slate-900 hover:text-amber-900 dark:text-slate-100 dark:hover:text-amber-400"
                  >
                    {report.headline}
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
                    {report.sourceSummary}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenReport(report)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                  >
                    <span>Mở phân tích</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveReport(report.id)}
                    aria-label="Xóa hồ sơ phân tích"
                    className="p-2 text-slate-400 hover:text-red-700 dark:hover:text-red-400 cursor-pointer"
                  >
                    <BookmarkX className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {readingHistory.length > 0 && (
        <section className="mt-12">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-500" />
              <h2 className="font-sans tracking-tight text-xl font-semibold text-slate-900 dark:text-slate-100">
                Lịch sử đã đọc gần đây ({readingHistory.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={onClearHistory}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-red-700 dark:text-slate-400 dark:hover:text-red-400 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Xóa lịch sử</span>
            </button>
          </div>

          <div className="mt-4 divide-y divide-slate-200 border-t border-b border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {readingHistory.map((item) => (
              <div
                key={`${item.id}-${item.readAt}`}
                className="flex items-center justify-between gap-4 py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {item.category}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{item.sourceName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {new Intl.DateTimeFormat('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit',
                      }).format(new Date(item.readAt))}
                    </span>
                  </div>
                  <p className="mt-1 truncate font-sans tracking-tight text-base font-medium text-slate-900 dark:text-slate-100">
                    {item.title}
                  </p>
                </div>

                {item.story ? (
                  <button
                    type="button"
                    onClick={() => onOpenStory(item.story!)}
                    className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <span>Đọc lại</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                ) : item.url ? (
                  <button
                    type="button"
                    onClick={() =>
                      onAnalyzeArticleUrl(
                        item.url!,
                        item.title,
                        item.sourceName,
                        item.category
                      )
                    }
                    className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <span>Phân tích lại</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
