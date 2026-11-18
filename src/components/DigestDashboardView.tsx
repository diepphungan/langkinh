import { useMemo } from 'react';
import {
  Bookmark,
  Calendar,
  ExternalLink,
  Flame,
  Globe,
  RefreshCw,
  Send,
  Settings,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import type {
  GeographicRegion,
  NewsDigestResponse,
  NewsroomCategoryBucket,
  NewsroomDatePreset,
  NewsroomEdition,
  NewsroomFeedResponse,
  NewsroomViewMode,
  NewsStory,
  PublishedNewsItem,
  SentimentVerdict,
  WebhookChannelsStatus,
} from '../types/news';
import { NewsroomEditionView } from './NewsroomEditionView';

interface DigestDashboardViewProps {
  digest: NewsDigestResponse | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenStorySummary: (story: NewsStory) => void;
  onAnalyzeArticleUrl: (
    url: string,
    title?: string,
    sourceName?: string,
    category?: string
  ) => void;
  onToggleSaveStory: (story: NewsStory) => void;
  isStorySaved: (id: string) => boolean;
  onSearchTopic: (query: string) => void;
  activeQuery: string;

  // Editorial Newsroom & Multi-dimensional Control Bar props
  newsroomFeed: NewsroomFeedResponse | null;
  newsroomLoading: boolean;
  newsroomSyncing: boolean;
  newsroomError: string | null;
  viewMode: NewsroomViewMode;
  onChangeViewMode: (mode: NewsroomViewMode) => void;
  datePreset: NewsroomDatePreset;
  onChangeDatePreset: (preset: NewsroomDatePreset) => void;
  selectedDate: string;
  onChangeSelectedDate: (dateStr: string) => void;
  selectedRegion: GeographicRegion | 'all';
  onChangeRegion: (region: GeographicRegion | 'all') => void;
  selectedBucket: NewsroomCategoryBucket | 'all';
  onChangeBucket: (bucket: NewsroomCategoryBucket | 'all') => void;
  selectedSentiment: SentimentVerdict | 'all';
  onChangeSentiment: (sentiment: SentimentVerdict | 'all') => void;
  onSyncNewsroomNow: () => Promise<void>;
  onRefreshSocialTrends: () => Promise<void>;
  socialRefreshing: boolean;
  edition: NewsroomEdition | null;
  editionLoading: boolean;
  editionError: string | null;
  onRefreshEdition: (force?: boolean) => Promise<void>;
  onSendEditionNow: (
    channels: Array<'telegram' | 'lark'>
  ) => Promise<{ ok: boolean; message: string }>;
  webhookStatus: WebhookChannelsStatus | null;
  onOpenWebhookSettings: () => void;
  lastAutoFetchSummary: string | null;
  lastAutoFetchAt: string | null;
  onGoToSources: () => void;
}

const DATE_PRESETS: Array<{ id: NewsroomDatePreset; label: string }> = [
  { id: 'latest', label: 'Tất cả mới nhất' },
  { id: 'today', label: 'Hôm nay' },
  { id: 'yesterday', label: 'Hôm qua' },
  { id: '7d', label: '7 ngày' },
  { id: '30d', label: '30 ngày' },
  { id: '90d', label: '3 tháng' },
];

const REGION_OPTIONS: Array<{ id: GeographicRegion | 'all'; label: string }> = [
  { id: 'all', label: 'Tất cả khu vực' },
  { id: 'Việt Nam', label: 'Việt Nam' },
  { id: 'Châu Á', label: 'Châu Á' },
  { id: 'Mỹ & Châu Âu', label: 'Mỹ & Châu Âu' },
  { id: 'Toàn cầu / Quốc tế', label: 'Toàn cầu / Quốc tế' },
];

const CATEGORY_BUCKETS: NewsroomCategoryBucket[] = [
  'Thời sự & Vĩ mô',
  'Tài chính & Chứng khoán',
  'Thế giới',
  'Công nghệ & AI',
  'Mạng xã hội',
  'Chuyên mục Động',
];

function SentimentStrip({
  positive,
  neutral,
  negative,
}: {
  positive: number;
  neutral: number;
  negative: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex h-1 w-full overflow-hidden rounded-xl bg-slate-200 dark:bg-slate-800">
        <div
          className="bg-emerald-700 dark:bg-emerald-500"
          style={{ width: `${positive}%` }}
        />
        <div
          className="bg-slate-400 dark:bg-slate-600"
          style={{ width: `${neutral}%` }}
        />
        <div
          className="bg-red-700 dark:bg-red-500"
          style={{ width: `${negative}%` }}
        />
      </div>
      <div className="flex items-center justify-between font-mono text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
        <span>Tích cực {positive}%</span>
        <span>Trung lập {neutral}%</span>
        <span>Rủi ro {negative}%</span>
      </div>
    </div>
  );
}

function ArticleNewsroomCard({
  item,
  onAnalyze,
}: {
  item: PublishedNewsItem;
  onAnalyze: (item: PublishedNewsItem) => void;
}) {
  const sentimentToneClass =
    item.sentimentLabel === 'Tích cực'
      ? 'text-emerald-800 dark:text-emerald-400'
      : item.sentimentLabel === 'Tiêu cực'
        ? 'text-red-800 dark:text-red-400'
        : 'text-slate-600 dark:text-slate-400';

  return (
    <article className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm transition-colors hover:border-slate-300 dark:border-slate-800/80 dark:bg-slate-900 dark:hover:border-slate-600">
      <div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
          {item.priorityBadge && (
            <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
              {item.priorityBadge}
            </span>
          )}
          <span className="font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            {item.newsroomCategory}
          </span>
          <span aria-hidden="true">·</span>
          <span>{item.region}</span>
          <span aria-hidden="true">·</span>
          <span className={sentimentToneClass}>{item.sentimentLabel}</span>
          {item.platformTag && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-sky-700 dark:text-sky-400">
                {item.platformTag}
              </span>
            </>
          )}
        </div>

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block text-base font-bold leading-snug text-slate-900 hover:text-emerald-700 dark:text-slate-100 dark:hover:text-emerald-400 line-clamp-2"
        >
          {item.title}
        </a>

        <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300 line-clamp-2">
          {item.summary}
        </p>

        {item.matchedTickers.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            <span>Mã liên quan: {item.matchedTickers.join(', ')}</span>
          </div>
        )}
      </div>

      <div className="mt-3 space-y-2.5 border-t border-slate-100 pt-2.5 dark:border-slate-800">
        <SentimentStrip
          positive={item.sentiment.positive}
          neutral={item.sentiment.neutral}
          negative={item.sentiment.negative}
        />

        <div className="flex items-center justify-between gap-2 text-[11px]">
          <div className="min-w-0 truncate text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {item.sourceName}
            </span>{' '}
            · <span className="font-mono tabular-nums">{item.displayTimestamp}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onAnalyze(item)}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="h-3 w-3 text-amber-800 dark:text-amber-400" />
              <span>Phân tích</span>
            </button>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Mở bài gốc: ${item.title}`}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 p-1 text-slate-600 hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}

export function DigestDashboardView({
  digest,
  loading,
  error,
  onRetry,
  onOpenStorySummary,
  onAnalyzeArticleUrl,
  onToggleSaveStory,
  isStorySaved,
  onSearchTopic,
  activeQuery,
  newsroomFeed,
  newsroomLoading,
  newsroomSyncing,
  newsroomError,
  viewMode,
  onChangeViewMode,
  datePreset,
  onChangeDatePreset,
  selectedDate,
  onChangeSelectedDate,
  selectedRegion,
  onChangeRegion,
  selectedBucket,
  onChangeBucket,
  selectedSentiment,
  onChangeSentiment,
  onSyncNewsroomNow,
  onRefreshSocialTrends,
  socialRefreshing,
  edition,
  editionLoading,
  editionError,
  onRefreshEdition,
  onSendEditionNow,
  webhookStatus,
  onOpenWebhookSettings,
  lastAutoFetchSummary,
  lastAutoFetchAt,
  onGoToSources,
}: DigestDashboardViewProps) {
  // 90-day lookback boundaries in Asia/Ho_Chi_Minh
  const { minDateStr, maxDateStr } = useMemo(() => {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const now = new Date();
    const min = new Date(now.getTime() - 90 * 86_400_000);
    return {
      minDateStr: fmt.format(min),
      maxDateStr: fmt.format(now),
    };
  }, []);

  const groupedByCategory = useMemo(() => {
    const items = newsroomFeed?.items || [];
    const map = new Map<NewsroomCategoryBucket, PublishedNewsItem[]>();
    for (const b of CATEGORY_BUCKETS) map.set(b, []);
    for (const it of items) {
      const list = map.get(it.newsroomCategory);
      if (list) list.push(it);
    }
    return CATEGORY_BUCKETS.map((bucket) => ({
      bucket,
      items: map.get(bucket) || [],
    })).filter((g) => g.items.length > 0);
  }, [newsroomFeed]);

  const handleAnalyzeItem = (item: PublishedNewsItem) => {
    onAnalyzeArticleUrl(item.url, item.title, item.sourceName, item.newsroomCategory);
  };

  const lead = newsroomFeed?.leadStory || null;
  const highlights = newsroomFeed?.highlightStories || [];
  const socialTrends = newsroomFeed?.socialTrends || [];
  const breakingWire = newsroomFeed?.breakingWire || [];

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Newsroom Mode Switcher + 90-day Date Picker + Sync CTA */}
      <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* 3-Mode Top Switcher */}
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Chế độ Bản tin">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'live'}
              onClick={() => onChangeViewMode('live')}
              className={`rounded-lg border px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                viewMode === 'live'
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-slate-950'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              Dòng tin Trực tiếp (Live Feed)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'morning'}
              onClick={() => onChangeViewMode('morning')}
              className={`rounded-lg border px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                viewMode === 'morning'
                  ? 'border-amber-500 bg-amber-500 text-slate-950'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              Ấn bản Sáng (08:00)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === 'afternoon'}
              onClick={() => onChangeViewMode('afternoon')}
              className={`rounded-lg border px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                viewMode === 'afternoon'
                  ? 'border-sky-600 bg-sky-600 text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              Ấn bản Chiều (17:00)
            </button>
          </div>

          {/* Date Picker (90-day archive) + Sync & Channel Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
              <Calendar className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
              <span className="whitespace-nowrap">Ngày:</span>
              <input
                type="date"
                value={selectedDate}
                min={minDateStr}
                max={maxDateStr}
                onChange={(e) => {
                  const val = e.target.value;
                  onChangeSelectedDate(val);
                  if (val && viewMode === 'live') {
                    onChangeDatePreset('custom');
                  }
                }}
                className="bg-transparent text-xs font-semibold tabular-nums text-slate-900 focus:outline-none dark:text-slate-100"
              />
            </label>

            <button
              type="button"
              onClick={() => void onSyncNewsroomNow()}
              disabled={newsroomSyncing}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${newsroomSyncing ? 'animate-spin' : ''}`}
              />
              <span>
                {newsroomSyncing
                  ? 'Đang quét & đồng bộ...'
                  : 'Quét & Cập nhật Bản tin Ngay'}
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenWebhookSettings}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Telegram / Lark</span>
            </button>
          </div>
        </div>

        {/* Live Sync Status Strip */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              {newsroomFeed?.syncNote ||
                'Đang kết nối luồng đồng bộ tự động từ Nguồn trang & Mạng xã hội...'}
            </span>
            {lastAutoFetchSummary && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {lastAutoFetchSummary}
                </span>
              </>
            )}
            {lastAutoFetchAt && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {new Intl.DateTimeFormat('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(lastAutoFetchAt))}
                </span>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onGoToSources}
            className="font-medium text-amber-900 hover:underline dark:text-amber-400 cursor-pointer whitespace-nowrap"
          >
            Quản lý Nguồn trang &amp; Gói chủ đề →
          </button>
        </div>

        {/* Newsroom Control Bar (shown in Live Feed Mode) */}
        {viewMode === 'live' && (
          <div className="mt-3 space-y-2.5 border-t border-slate-200 pt-3 dark:border-slate-800">
            {/* Time presets + Region filters */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 font-mono text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Thời gian:
                </span>
                {DATE_PRESETS.map((p) => {
                  const active = datePreset === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onChangeDatePreset(p.id)}
                      className={`rounded-xl border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                        active
                          ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400'
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
                {datePreset === 'custom' && selectedDate && (
                  <span className="rounded-xl border border-amber-800 bg-amber-900 px-2.5 py-1 font-mono text-[11px] font-medium text-white dark:border-amber-400 dark:bg-amber-400 dark:text-slate-950">
                    Ngày {selectedDate.split('-').reverse().join('/')}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                <span className="mr-1 font-mono text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Khu vực:
                </span>
                {REGION_OPTIONS.map((r) => {
                  const active = selectedRegion === r.id;
                  const count =
                    r.id === 'all'
                      ? newsroomFeed?.totalInArchive
                      : newsroomFeed?.regionCounts?.[r.id] ?? 0;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => onChangeRegion(r.id)}
                      className={`rounded-xl border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap cursor-pointer transition-colors ${
                        active
                          ? 'border-amber-800 bg-amber-900 text-white dark:border-amber-400 dark:bg-amber-400 dark:text-slate-950'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400'
                      }`}
                    >
                      {r.label}
                      {typeof count === 'number' && count > 0 ? ` (${count})` : ''}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Category bucket + Sentiment filter */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 font-mono text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Mục:
                </span>
                <button
                  type="button"
                  onClick={() => onChangeBucket('all')}
                  className={`rounded-xl border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap cursor-pointer ${
                    selectedBucket === 'all'
                      ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
                  }`}
                >
                  Tất cả
                </button>
                {CATEGORY_BUCKETS.map((b) => {
                  const active = selectedBucket === b;
                  const count = newsroomFeed?.categoryCounts?.[b] ?? 0;
                  return (
                    <button
                      key={b}
                      type="button"
                      onClick={() => onChangeBucket(b)}
                      className={`rounded-xl border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap cursor-pointer ${
                        active
                          ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
                      }`}
                    >
                      {b} {count > 0 ? `(${count})` : ''}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Sắc thái:
                </span>
                {(['all', 'Tích cực', 'Trung lập', 'Tiêu cực'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onChangeSentiment(s)}
                    className={`rounded-xl border px-2 py-1 text-[11px] font-medium whitespace-nowrap cursor-pointer ${
                      selectedSentiment === s
                        ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
                    }`}
                  >
                    {s === 'all' ? 'Tất cả' : s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Morning (08:00) or Afternoon (17:00) Edition Mode */}
      {viewMode !== 'live' ? (
        <div className="mt-6">
          <NewsroomEditionView
            edition={edition}
            loading={editionLoading}
            error={editionError}
            onRefreshEdition={onRefreshEdition}
            onAnalyzeArticleUrl={onAnalyzeArticleUrl}
            onSendEditionNow={onSendEditionNow}
            webhookStatus={webhookStatus}
            onOpenWebhookSettings={onOpenWebhookSettings}
          />
        </div>
      ) : (
        /* Live Feed Editorial Press Grid Mode */
        <div className="mt-6 space-y-6">
          {/* Breaking & World Wire Ticker */}
          {breakingWire.length > 0 && (
            <section
              aria-label="Dòng tin nóng vừa cập nhật"
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900/90"
            >
              <div className="flex items-center gap-3 overflow-x-auto">
                <span className="shrink-0 font-mono text-[11px] font-bold uppercase tracking-widest text-red-800 dark:text-red-400">
                  Tin mới nhất
                </span>
                <div className="flex items-center gap-5 whitespace-nowrap text-xs">
                  {breakingWire.slice(0, 8).map((b) => (
                    <a
                      key={b.id}
                      href={b.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-slate-700 hover:text-amber-900 dark:text-slate-300 dark:hover:text-amber-400"
                    >
                      <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                        {b.displayTimestamp}
                      </span>
                      <span className="font-medium max-w-[300px] truncate">{b.title}</span>
                    </a>
                  ))}
                </div>
              </div>
            </section>
          )}

          {newsroomError && (
            <div className="rounded-xl border border-red-200 bg-red-50/70 p-4 text-xs text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
              {newsroomError}
            </div>
          )}

          {newsroomLoading && !newsroomFeed ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="h-80 rounded-xl border border-slate-200/80 bg-white lg:col-span-8 dark:border-slate-800/80 dark:bg-slate-900" />
              <div className="h-80 rounded-xl border border-slate-200/80 bg-white lg:col-span-4 dark:border-slate-800/80 dark:bg-slate-900" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* LEFT / MAIN EDITORIAL PRESS COLUMN (70%) */}
              <div className="space-y-8 lg:col-span-8">
                {/* Front-Page 60/40 Lead Cover Story + 3 Highlight Stories */}
                {lead ? (
                  <section className="rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
                    <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-2.5 dark:border-slate-800">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        Trang nhất · Tâm điểm tòa soạn
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        Hiển thị {newsroomFeed?.filteredCount || 0} / {newsroomFeed?.totalInArchive || 0} tin
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
                      {/* 60% Lead Cover Story */}
                      <article className="md:col-span-7 flex flex-col justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                            {lead.priorityBadge && (
                              <span className="rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                                {lead.priorityBadge}
                              </span>
                            )}
                            <span className="font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                              {lead.newsroomCategory}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{lead.region}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                              Ưu tiên {lead.priorityScore}/100
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">{lead.displayTimestamp}</span>
                          </div>

                          <a
                            href={lead.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2.5 block text-2xl font-bold leading-tight text-slate-900 hover:text-emerald-700 sm:text-3xl dark:text-slate-100 dark:hover:text-emerald-400"
                          >
                            {lead.title}
                          </a>

                          <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                            {lead.summary}
                          </p>

                          {lead.keyTakeaways.length > 0 && (
                            <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-700 dark:border-slate-800 dark:text-slate-300">
                              {lead.keyTakeaways.slice(0, 3).map((pt, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="font-mono text-[10px] font-semibold text-amber-800 dark:text-amber-400 mt-0.5">
                                    0{i + 1}
                                  </span>
                                  <span>{pt}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div className="mt-4 space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800">
                          <SentimentStrip
                            positive={lead.sentiment.positive}
                            neutral={lead.sentiment.neutral}
                            negative={lead.sentiment.negative}
                          />

                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                              {lead.sourceOutlets.join(' · ')}
                              {lead.matchedTickers.length > 0 && (
                                <span className="ml-2 font-mono text-blue-900 dark:text-blue-300">
                                  [{lead.matchedTickers.join(', ')}]
                                </span>
                              )}
                            </span>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleAnalyzeItem(lead)}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 cursor-pointer whitespace-nowrap"
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                                <span>Phân tích chuyên sâu</span>
                              </button>
                              <a
                                href={lead.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 whitespace-nowrap"
                              >
                                <span>Đọc gốc</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          </div>
                        </div>
                      </article>

                      {/* 40% Right Sub-column: 3 Highlight Stories */}
                      <div className="md:col-span-5 flex flex-col justify-between divide-y divide-slate-200 border-t border-slate-200 pt-4 md:border-t-0 md:border-l md:pl-5 md:pt-0 dark:divide-slate-800 dark:border-slate-800">
                        {highlights.map((h, idx) => (
                          <article key={h.id} className={idx === 0 ? 'pb-3.5' : idx === highlights.length - 1 ? 'pt-3.5' : 'py-3.5'}>
                            <div className="flex flex-wrap items-center gap-x-2 text-[10px] text-slate-500 dark:text-slate-400">
                              <span className="font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                                {h.newsroomCategory}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{h.region}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">{h.displayTimestamp}</span>
                            </div>

                            <a
                              href={h.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 block font-sans tracking-tight text-base font-bold leading-snug text-slate-900 hover:text-amber-900 dark:text-slate-100 dark:hover:text-amber-400 line-clamp-2"
                            >
                              {h.title}
                            </a>

                            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                              {h.summary}
                            </p>

                            <div className="mt-2 flex items-center justify-between text-[11px]">
                              <span className="text-slate-500 dark:text-slate-400 truncate">
                                {h.sourceName}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleAnalyzeItem(h)}
                                className="inline-flex items-center gap-1 font-medium text-amber-900 hover:underline dark:text-amber-400 cursor-pointer shrink-0"
                              >
                                <Sparkles className="h-3 w-3" />
                                <span>Phân tích</span>
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  </section>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
                    <p className="font-sans tracking-tight text-lg font-semibold text-slate-900 dark:text-slate-100">
                      Không tìm thấy bản tin khớp với bộ lọc hiện tại
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Thử chuyển thời gian sang &ldquo;Tất cả mới nhất&rdquo;, chọn &ldquo;Tất cả khu vực&rdquo; hoặc bấm &ldquo;Quét &amp; Cập nhật Bản tin Ngay&rdquo;.
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onChangeDatePreset('latest');
                          onChangeRegion('all');
                          onChangeBucket('all');
                          onChangeSentiment('all');
                        }}
                        className="rounded-xl border border-slate-300 px-3.5 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        Đặt lại bộ lọc
                      </button>
                      <button
                        type="button"
                        onClick={() => void onSyncNewsroomNow()}
                        className="rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white dark:bg-slate-100 dark:text-slate-900 cursor-pointer"
                      >
                        Quét nguồn ngay
                      </button>
                    </div>
                  </div>
                )}

                {/* Categorized Editorial Newsroom Grid */}
                {groupedByCategory.map((group) => (
                  <section key={group.bucket} className="space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-300 pb-2 dark:border-slate-700">
                      <h3 className="font-sans tracking-tight text-xl font-bold text-slate-900 dark:text-slate-100">
                        {group.bucket}
                      </h3>
                      <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {group.items.length} bài viết
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      {group.items.slice(0, 6).map((item) => (
                        <ArticleNewsroomCard
                          key={item.id}
                          item={item}
                          onAnalyze={handleAnalyzeItem}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>

              {/* RIGHT SIDEBAR (30%): Social Trends Widget + Scheduled Edition Card */}
              <aside className="space-y-6 lg:col-span-4">
                <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
                    <div>
                      <div className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-amber-800 dark:text-amber-400">
                        <Flame className="h-3.5 w-3.5" />
                        <span>4 luồng thời gian thực</span>
                      </div>
                      <h3 className="mt-1 font-sans tracking-tight text-lg font-bold text-slate-900 dark:text-slate-100">
                        Xu Hướng Mạng Xã Hội Hôm Nay
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => void onRefreshSocialTrends()}
                      disabled={socialRefreshing}
                      title="Làm mới luồng Mạng xã hội"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${socialRefreshing ? 'animate-spin' : ''}`}
                      />
                    </button>
                  </div>

                  {/* Streams status compact line */}
                  {newsroomFeed?.socialStreamsStatus &&
                    newsroomFeed.socialStreamsStatus.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-x-2.5 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400">
                        {newsroomFeed.socialStreamsStatus.map((st) => (
                          <span key={st.stream} className="font-mono">
                            {st.stream}: {st.count}
                          </span>
                        ))}
                      </div>
                    )}

                  <div className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
                    {socialTrends.length === 0 ? (
                      <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                        Đang tổng hợp xu hướng từ Google Trends VN, Cộng đồng VN &amp; Reddit...
                      </p>
                    ) : (
                      socialTrends.slice(0, 7).map((trend, idx) => (
                        <article key={trend.id} className="py-3 first:pt-1 last:pb-1">
                          <div className="flex items-center justify-between gap-2 text-[10px]">
                            <div className="flex items-center gap-1.5 font-mono">
                              <span className="font-bold text-slate-400 dark:text-slate-500 tabular-nums">
                                #{idx + 1}
                              </span>
                              <span className="font-semibold uppercase text-amber-800 dark:text-amber-400">
                                {trend.platform}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-semibold text-emerald-800 dark:text-emerald-400 tabular-nums">
                                {trend.growthMetric}
                              </span>
                            </div>
                            <span className="font-mono font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                              Viral {trend.viralScore}
                            </span>
                          </div>

                          <a
                            href={trend.relatedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 block font-sans tracking-tight text-sm font-bold leading-snug text-slate-900 hover:text-amber-900 dark:text-slate-100 dark:hover:text-amber-400"
                          >
                            {trend.title}
                          </a>

                          <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400 line-clamp-2">
                            {trend.originSummary}
                          </p>

                          <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                            <span>
                              {trend.sourceName} · {trend.displayTimestamp}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                onAnalyzeArticleUrl(
                                  trend.relatedUrl,
                                  trend.title,
                                  trend.sourceName,
                                  'Mạng xã hội'
                                )
                              }
                              className="font-medium text-amber-900 hover:underline dark:text-amber-400 cursor-pointer"
                            >
                              Phân tích →
                            </button>
                          </div>
                        </article>
                      ))
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onChangeBucket('Mạng xã hội');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-900 bg-slate-50 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-900 hover:text-white dark:border-slate-200 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-100 dark:hover:text-slate-900 cursor-pointer transition-colors"
                  >
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>Giải mã xu hướng (Lọc Mạng xã hội)</span>
                  </button>
                </section>

                {/* Scheduled Telegram / Lark Briefing Quick Card */}
                <section className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/90">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Bản tin tự động định kỳ
                  </p>
                  <h3 className="mt-1 font-sans tracking-tight text-lg font-bold text-slate-900 dark:text-slate-100">
                    Ấn bản 08:00 &amp; 17:00 qua Bot
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    Tự động tổng hợp Top 10 tin tức trọng yếu, VN-Index, Watchlist và xu hướng Mạng xã hội gửi thẳng tới Telegram &amp; Lark.
                  </p>

                  <div className="mt-3 space-y-1.5 border-t border-slate-200 pt-3 font-mono text-[11px] text-slate-700 dark:border-slate-800 dark:text-slate-300">
                    <div className="flex items-center justify-between">
                      <span>Telegram Bot:</span>
                      <span
                        className={
                          webhookStatus?.telegramConfigured
                            ? 'font-semibold text-emerald-800 dark:text-emerald-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }
                      >
                        {webhookStatus?.telegramConfigured ? 'Đã kết nối' : 'Chưa cấu hình'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Lark Custom Bot:</span>
                      <span
                        className={
                          webhookStatus?.larkConfigured
                            ? 'font-semibold text-emerald-800 dark:text-emerald-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }
                      >
                        {webhookStatus?.larkConfigured ? 'Đã kết nối' : 'Chưa cấu hình'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Lịch gửi tự động:</span>
                      <span>
                        {webhookStatus?.autoSendEnabled
                          ? '08:00 & 17:00 (GMT+7)'
                          : 'Đang tạm tắt'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onChangeViewMode('morning')}
                      className="rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      Xem Sáng 08:00
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeViewMode('afternoon')}
                      className="rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      Xem Chiều 17:00
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={onOpenWebhookSettings}
                    className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-2 text-xs font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Cấu hình Telegram &amp; Lark Bot</span>
                  </button>
                </section>
              </aside>
            </div>
          )}

          {/* Preserved Classic AI Topic Synthesis Section (below Editorial Grid or highlighted when user searches a custom topic) */}
          {digest && digest.stories.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Hồ sơ tổng hợp chuyên đề AI
                    {activeQuery ? ` · Từ khóa "${activeQuery}"` : ''}
                  </p>
                  <h3 className="mt-1 font-sans tracking-tight text-lg font-bold text-slate-900 dark:text-slate-100">
                    Đánh giá đa chiều &amp; Chủ đề vĩ mô
                  </h3>
                </div>
                {error && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="rounded-xl border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Thử làm mới
                  </button>
                )}
              </div>

              <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {digest.editionSummary}
              </p>

              {digest.dominantThemes.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {digest.dominantThemes.map((t) => (
                    <button
                      key={t.theme}
                      type="button"
                      onClick={() => onSearchTopic(t.theme)}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-left text-xs hover:border-slate-400 dark:border-slate-800 dark:bg-slate-950 cursor-pointer"
                    >
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {t.theme}
                      </span>{' '}
                      <span className="font-mono text-[10px] text-amber-800 dark:text-amber-400">
                        · {t.momentum}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {digest.stories.slice(0, 6).map((story) => {
                  const saved = isStorySaved(story.id);
                  return (
                    <article
                      key={story.id}
                      className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"
                    >
                      <div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                          <span className="font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                            {story.category}
                          </span>
                          <span className="font-mono">Tác động: {story.impactLevel}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onOpenStorySummary(story)}
                          className="mt-1.5 text-left font-sans tracking-tight text-base font-bold leading-snug text-slate-900 hover:text-amber-900 dark:text-slate-100 dark:hover:text-amber-400 cursor-pointer"
                        >
                          {story.title}
                        </button>
                        <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                          {story.deck}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-2.5 text-[11px] dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => onOpenStorySummary(story)}
                          className="font-medium text-slate-800 hover:underline dark:text-slate-200 cursor-pointer"
                        >
                          Mở hồ sơ →
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleSaveStory(story)}
                          className={`inline-flex items-center gap-1 cursor-pointer ${
                            saved
                              ? 'font-semibold text-amber-800 dark:text-amber-400'
                              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                          }`}
                        >
                          <Bookmark className="h-3 w-3" />
                          <span>{saved ? 'Đã lưu' : 'Lưu'}</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {loading && !digest && (
            <div className="text-center font-mono text-xs text-slate-500 dark:text-slate-400">
              Đang tải phân tích chuyên đề AI...
            </div>
          )}
        </div>
      )}
    </main>
  );
}
