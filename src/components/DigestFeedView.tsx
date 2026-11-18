import { ArrowUpRight, Bookmark, BookmarkCheck, ExternalLink, RefreshCw } from 'lucide-react';
import type { NewsDigestResponse, NewsStory } from '../types/news';
import { EditorialImage } from './EditorialImage';
import { SentimentBar } from './SentimentBar';
import { DESK_ASSETS } from '../lib/editorialAssets';

interface DigestFeedViewProps {
  digest: NewsDigestResponse | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenStory: (story: NewsStory) => void;
  onToggleSaveStory: (story: NewsStory) => void;
  isStorySaved: (id: string) => boolean;
  onSearchTopic: (topic: string) => void;
}

function DigestSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 border-b border-slate-200/80 pb-6 dark:border-slate-800">
        <div className="h-3 w-40 bg-slate-200 dark:bg-slate-800 mb-3" />
        <div className="h-6 w-3/4 bg-slate-200 dark:bg-slate-800 mb-2" />
        <div className="h-6 w-1/2 bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 pb-10 border-b border-slate-200 dark:border-slate-800">
        <div className="lg:col-span-7 aspect-[16/9] bg-slate-200 dark:bg-slate-800" />
        <div className="lg:col-span-5 flex flex-col justify-between gap-4">
          <div>
            <div className="h-3 w-36 bg-slate-200 dark:bg-slate-800 mb-4" />
            <div className="h-9 w-full bg-slate-200 dark:bg-slate-800 mb-3" />
            <div className="h-9 w-4/5 bg-slate-200 dark:bg-slate-800 mb-4" />
            <div className="h-4 w-full bg-slate-200 dark:bg-slate-800 mb-2" />
            <div className="h-4 w-5/6 bg-slate-200 dark:bg-slate-800" />
          </div>
          <div className="h-14 w-full bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>
      <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3">
        {[0, 1, 2].map((idx) => (
          <div key={idx} className="space-y-3">
            <div className="aspect-[4/3] w-full bg-slate-200 dark:bg-slate-800" />
            <div className="h-3 w-28 bg-slate-200 dark:bg-slate-800" />
            <div className="h-6 w-full bg-slate-200 dark:bg-slate-800" />
            <div className="h-4 w-5/6 bg-slate-200 dark:bg-slate-800" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DigestFeedView({
  digest,
  loading,
  error,
  onRetry,
  onOpenStory,
  onToggleSaveStory,
  isStorySaved,
  onSearchTopic,
}: DigestFeedViewProps) {
  if (loading && !digest) {
    return <DigestSkeleton />;
  }

  if (error && !digest) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <p className="text-xs font-medium uppercase tracking-widest text-slate-500 dark:text-slate-400">
          Gián đoạn kết nối bản tin
        </p>
        <h2 className="mt-3 font-sans tracking-tight text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Không thể tải bản tổng hợp thời sự
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {error}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-slate-900 px-5 py-2.5 text-xs font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Thử tổng hợp lại</span>
        </button>
      </div>
    );
  }

  if (!digest || digest.stories.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
        <h2 className="font-sans tracking-tight text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Chưa tìm thấy tin tức phù hợp
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Hãy thử từ khóa rộng hơn hoặc quay lại mục Tổng hợp.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 rounded-md border border-slate-300 px-4 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
        >
          Tải lại bản tin
        </button>
      </div>
    );
  }

  const [leadStory, ...restStories] = digest.stories;
  const secondaryStories = restStories.slice(0, 3);
  const wireStories = restStories.slice(3);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Inline error notice if refreshing failed while old digest is visible */}
      {error && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border border-amber-800/30 bg-amber-50/70 px-4 py-3 text-xs text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
          <span>{error}</span>
          <button
            type="button"
            onClick={onRetry}
            className="font-medium underline underline-offset-4 cursor-pointer whitespace-nowrap"
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Editorial Cycle Briefing & Macro Themes */}
      <section className="border-b border-slate-200 pb-8 dark:border-slate-800">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">
              {digest.query
                ? `Hồ sơ chuyên đề · Từ khóa: "${digest.query}"`
                : 'Tổng quan dòng chảy sự kiện'}
            </p>
            <p className="mt-2.5 font-sans tracking-tight text-xl leading-relaxed text-slate-900 sm:text-2xl dark:text-slate-100">
              {digest.editionSummary}
            </p>
          </div>

          {digest.dominantThemes.length > 0 && (
            <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {digest.dominantThemes.map((item) => (
                <button
                  key={item.theme}
                  type="button"
                  onClick={() => onSearchTopic(item.theme)}
                  className="group text-left border border-slate-200 bg-slate-50/90 p-3.5 transition-colors hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-slate-600 cursor-pointer"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900 group-hover:text-amber-900 dark:text-slate-100 dark:group-hover:text-amber-400">
                      {item.theme}
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
                      {item.momentum}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400 line-clamp-2">
                    {item.brief}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Tier 1: Lead Story */}
      {leadStory && (
        <section className="border-b border-slate-200 py-10 dark:border-slate-800">
          <article className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
            <div
              onClick={() => onOpenStory(leadStory)}
              className="group lg:col-span-7 cursor-pointer"
            >
              <EditorialImage
                desk={leadStory.visualDesk}
                alt={leadStory.title}
                aspectClass="aspect-[16/9] lg:h-full lg:aspect-auto"
                caption={`Ảnh minh họa chuyên đề · ${DESK_ASSETS[leadStory.visualDesk]?.caption || ''}`}
              />
            </div>

            <div className="lg:col-span-5 flex flex-col justify-between gap-6">
              <div>
                {/* Zero-pill unboxed metadata */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-amber-900 dark:text-amber-400">
                    Tiêu điểm · {leadStory.category}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{leadStory.publishedRelative}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{leadStory.readTimeMinutes} phút đọc</span>
                  <span aria-hidden="true">·</span>
                  <span>Tác động: {leadStory.impactLevel}</span>
                </div>

                <h1
                  onClick={() => onOpenStory(leadStory)}
                  className="mt-3 cursor-pointer font-sans tracking-tight text-3xl font-semibold leading-tight tracking-tight text-slate-900 hover:text-amber-900 sm:text-4xl dark:text-slate-100 dark:hover:text-amber-400 transition-colors"
                >
                  {leadStory.title}
                </h1>

                <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-300">
                  {leadStory.deck}
                </p>

                {/* Executive Takeaways */}
                {leadStory.executiveTakeaways.length > 0 && (
                  <ul className="mt-5 space-y-2 border-t border-slate-200 pt-4 text-sm leading-relaxed text-slate-700 dark:border-slate-800 dark:text-slate-300">
                    {leadStory.executiveTakeaways.slice(0, 3).map((point, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <span className="font-mono text-xs text-slate-400 pt-0.5 tabular-nums">
                          0{idx + 1}.
                        </span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-4 border-t border-slate-200 pt-4 dark:border-slate-800">
                <SentimentBar sentiment={leadStory.sentiment} />

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => onOpenStory(leadStory)}
                    className="inline-flex items-center gap-2 bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 rounded-md whitespace-nowrap cursor-pointer transition-colors"
                  >
                    <span>Mở hồ sơ phân tích</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggleSaveStory(leadStory)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer whitespace-nowrap"
                  >
                    {isStorySaved(leadStory.id) ? (
                      <>
                        <BookmarkCheck className="h-4 w-4 text-amber-800 dark:text-amber-400" />
                        <span>Đã lưu hồ sơ</span>
                      </>
                    ) : (
                      <>
                        <Bookmark className="h-4 w-4" />
                        <span>Lưu tin</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </article>
        </section>
      )}

      {/* Tier 2: Secondary Features (3-Column Grid) */}
      {secondaryStories.length > 0 && (
        <section className="border-b border-slate-200 py-10 dark:border-slate-800">
          <div className="mb-6 flex items-baseline justify-between gap-4">
            <h2 className="font-sans tracking-tight text-xl font-semibold text-slate-900 dark:text-slate-100">
              Phân tích chuyên mục nổi bật
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              {secondaryStories.length} tuyến bài trọng tâm
            </span>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {secondaryStories.map((story) => {
              const saved = isStorySaved(story.id);
              return (
                <article
                  key={story.id}
                  className="group flex flex-col justify-between border-b border-slate-200 pb-6 md:border-b-0 md:pb-0 dark:border-slate-800"
                >
                  <div>
                    <div onClick={() => onOpenStory(story)} className="cursor-pointer">
                      <EditorialImage
                        desk={story.visualDesk}
                        alt={story.title}
                        aspectClass="aspect-[4/3]"
                      />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {story.category}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{story.publishedRelative}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{story.readTimeMinutes} phút</span>
                    </div>

                    <h3
                      onClick={() => onOpenStory(story)}
                      className="mt-2 cursor-pointer font-sans tracking-tight text-xl font-semibold leading-snug text-slate-900 group-hover:text-amber-900 dark:text-slate-100 dark:group-hover:text-amber-400 transition-colors"
                    >
                      {story.title}
                    </h3>

                    <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                      {story.deck}
                    </p>

                    {/* Preview of multi-perspective angle */}
                    {story.perspectives[0] && (
                      <div className="mt-4 border-t border-slate-200/80 pt-3 text-xs leading-relaxed text-slate-600 dark:border-slate-800/80 dark:text-slate-400">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {story.perspectives[0].actor}:{' '}
                        </span>
                        <span>{story.perspectives[0].stance}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 space-y-3 border-t border-slate-200 pt-3.5 dark:border-slate-800">
                    <SentimentBar sentiment={story.sentiment} compact />

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => onOpenStory(story)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-900 hover:text-amber-900 dark:text-slate-100 dark:hover:text-amber-400 cursor-pointer"
                      >
                        <span>Xem đối chiếu đa chiều</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onToggleSaveStory(story)}
                        aria-label={saved ? 'Bỏ lưu tin' : 'Lưu tin'}
                        className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer"
                      >
                        {saved ? (
                          <BookmarkCheck className="h-4 w-4 text-amber-800 dark:text-amber-400" />
                        ) : (
                          <Bookmark className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Tier 3: Wire Dispatch Archive List */}
      {wireStories.length > 0 && (
        <section className="border-b border-slate-200 py-10 dark:border-slate-800">
          <div className="mb-6 flex items-baseline justify-between gap-4">
            <h2 className="font-sans tracking-tight text-xl font-semibold text-slate-900 dark:text-slate-100">
              Điểm tin nhanh &amp; Tín hiệu chính sách
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              {wireStories.length} bản tin bổ sung
            </span>
          </div>

          <div className="divide-y divide-slate-200 border-t border-b border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {wireStories.map((story, idx) => {
              const saved = isStorySaved(story.id);
              return (
                <article
                  key={story.id}
                  className="grid grid-cols-1 gap-4 py-5 lg:grid-cols-12 lg:items-center"
                >
                  <div className="lg:col-span-2 flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-mono tabular-nums text-slate-400">
                      0{idx + 1} / {story.category}
                    </span>
                    <span>{story.publishedRelative}</span>
                    <span>Tác động: {story.impactLevel}</span>
                  </div>

                  <div className="lg:col-span-6">
                    <h3
                      onClick={() => onOpenStory(story)}
                      className="cursor-pointer font-sans tracking-tight text-lg font-semibold text-slate-900 hover:text-amber-900 dark:text-slate-100 dark:hover:text-amber-400 transition-colors"
                    >
                      {story.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                      {story.deck}
                    </p>
                  </div>

                  <div className="lg:col-span-3">
                    <SentimentBar sentiment={story.sentiment} compact />
                  </div>

                  <div className="lg:col-span-1 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleSaveStory(story)}
                      aria-label={saved ? 'Bỏ lưu tin' : 'Lưu tin'}
                      className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer"
                    >
                      {saved ? (
                        <BookmarkCheck className="h-4 w-4 text-amber-800 dark:text-amber-400" />
                      ) : (
                        <Bookmark className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenStory(story)}
                      aria-label={`Mở phân tích ${story.title}`}
                      className="inline-flex h-9 w-9 items-center justify-center border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 rounded-md cursor-pointer"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Grounding Sources Ledger */}
      {digest.groundingSources.length > 0 && (
        <section className="pt-8">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Nguồn tham chiếu &amp; Đối chiếu trực tuyến ({digest.groundingSources.length})
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {digest.groundingSources.map((src) => (
              <a
                key={src.uri}
                href={src.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-2 border-b border-slate-200/70 py-2 text-xs text-slate-700 hover:text-amber-900 dark:border-slate-800/70 dark:text-slate-300 dark:hover:text-amber-400"
              >
                <span className="truncate">{src.title}</span>
                <ExternalLink className="h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100" />
              </a>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
