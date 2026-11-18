import { useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  RefreshCw,
  Send,
  Settings,
  Sparkles,
} from 'lucide-react';
import type {
  NewsroomEdition,
  WebhookChannelsStatus,
} from '../types/news';

interface NewsroomEditionViewProps {
  edition: NewsroomEdition | null;
  loading: boolean;
  error: string | null;
  onRefreshEdition: (force?: boolean) => Promise<void>;
  onAnalyzeArticleUrl: (
    url: string,
    title?: string,
    sourceName?: string,
    category?: string
  ) => void;
  onSendEditionNow: (
    channels: Array<'telegram' | 'lark'>
  ) => Promise<{ ok: boolean; message: string }>;
  webhookStatus: WebhookChannelsStatus | null;
  onOpenWebhookSettings: () => void;
}

export function NewsroomEditionView({
  edition,
  loading,
  error,
  onRefreshEdition,
  onAnalyzeArticleUrl,
  onSendEditionNow,
  webhookStatus,
  onOpenWebhookSettings,
}: NewsroomEditionViewProps) {
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deliveryFeedback, setDeliveryFeedback] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const handleCopyMarkdown = async () => {
    if (!edition) return;
    const lines: string[] = [
      `# LĂNG KÍNH · ${edition.editionLabel.toUpperCase()}`,
      `Khung thời gian: ${edition.windowLabel}`,
      '',
      '## Điểm nhấn điều hành',
      ...edition.executiveHighlights.map((h) => `- ${h}`),
      '',
      '## Chỉ số nhanh',
      `- Chứng khoán: ${edition.quickMetrics.vnIndexText}`,
      `- Watchlist: ${edition.quickMetrics.watchlistHighlight}`,
      `- Xu hướng Mạng xã hội #1: ${edition.quickMetrics.topSocialTrend}`,
      '',
      '## Top 10 tin quan trọng nhất',
      ...edition.stories.map(
        (s) =>
          `${String(s.rank).padStart(2, '0')}. **${s.title}** (${s.sourceName} · ${s.region})\n    ${s.oneLineSummary}\n    ${s.url}`
      ),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      // ignore clipboard fallback
    }
  };

  const handleTriggerSend = async () => {
    setSending(true);
    setDeliveryFeedback(null);
    try {
      const res = await onSendEditionNow(['telegram', 'lark']);
      setDeliveryFeedback(res);
    } finally {
      setSending(false);
    }
  };

  if (loading && !edition) {
    return (
      <div className="space-y-4 py-6">
        <div className="h-32 rounded-xl border border-slate-200/80 bg-white dark:border-slate-800/80 dark:bg-slate-900" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="h-24 rounded-xl border border-slate-200/80 bg-white dark:border-slate-800/80 dark:bg-slate-900" />
          <div className="h-24 rounded-xl border border-slate-200/80 bg-white dark:border-slate-800/80 dark:bg-slate-900" />
          <div className="h-24 rounded-xl border border-slate-200/80 bg-white dark:border-slate-800/80 dark:bg-slate-900" />
        </div>
        <div className="h-64 rounded-xl border border-slate-200/80 bg-white dark:border-slate-800/80 dark:bg-slate-900" />
      </div>
    );
  }

  if (error && !edition) {
    return (
      <div className="my-6 rounded-xl border border-red-200 bg-red-50/70 p-6 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
        <p className="font-semibold">Không thể tải Ấn bản định kỳ</p>
        <p className="mt-1 text-xs opacity-90">{error}</p>
        <button
          type="button"
          onClick={() => void onRefreshEdition(true)}
          className="mt-4 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white dark:bg-slate-100 dark:text-slate-900 cursor-pointer"
        >
          Thử tạo lại ấn bản
        </button>
      </div>
    );
  }

  if (!edition) return null;

  const isMorning = edition.editionType === 'morning';
  const hasChannel =
    Boolean(webhookStatus?.telegramConfigured) || Boolean(webhookStatus?.larkConfigured);

  return (
    <div className="space-y-6">
      {/* Editorial Broadsheet Edition Header */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between dark:border-slate-800">
          <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400">
              <span className={isMorning ? 'text-amber-800 dark:text-amber-400 font-semibold' : 'text-blue-900 dark:text-blue-400 font-semibold'}>
                {edition.editionLabel}
              </span>
              <span aria-hidden="true">·</span>
              <span>Khung tin: {edition.windowLabel}</span>
              <span aria-hidden="true">·</span>
              <span>
                {edition.mode === 'gemini' ? 'Biên tập AI' : 'Tổng hợp định lượng'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                Lọc từ {edition.totalCandidatesReviewed} tin
              </span>
            </div>
            <h2 className="mt-2 font-sans tracking-tight text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100">
              {isMorning
                ? 'Toàn cảnh đầu ngày — Top 10 tin tức trọng yếu'
                : 'Tổng kết cuối ngày — Top 10 chuyển động thị trường & xã hội'}
            </h2>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handleTriggerSend()}
              disabled={sending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 cursor-pointer whitespace-nowrap"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{sending ? 'Đang gửi...' : 'Gửi ngay qua Telegram / Lark'}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleCopyMarkdown()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                  <span>Đã chép Markdown</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Sao chép Markdown</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => void onRefreshEdition(true)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Tạo lại</span>
            </button>

            <button
              type="button"
              onClick={onOpenWebhookSettings}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>{hasChannel ? 'Cấu hình Bot' : 'Kết nối Telegram / Lark'}</span>
            </button>
          </div>
        </div>

        {deliveryFeedback && (
          <div
            className={`mt-4 rounded-xl border px-3.5 py-2.5 text-xs ${
              deliveryFeedback.ok
                ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
            }`}
          >
            {deliveryFeedback.message}
          </div>
        )}

        {/* Executive Highlights (3 bullets) */}
        <div className="mt-5">
          <h3 className="font-mono text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            03 Điểm nhấn điều hành
          </h3>
          <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
            {edition.executiveHighlights.map((bullet, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <span className="mt-0.5 font-mono text-xs font-semibold text-amber-800 dark:text-amber-400 tabular-nums">
                  0{idx + 1}
                </span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Quick Metrics Strip */}
        <div className="mt-6 grid grid-cols-1 gap-3 border-t border-slate-200 pt-5 md:grid-cols-3 dark:border-slate-800">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950">
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Chỉ số VN-Index
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
              {edition.quickMetrics.vnIndexText}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950">
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Watchlist nổi bật
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-900 dark:text-slate-100">
              {edition.quickMetrics.watchlistHighlight}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950">
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Xu hướng Mạng xã hội #1
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-900 dark:text-slate-100">
              {edition.quickMetrics.topSocialTrend}
            </p>
          </div>
        </div>
      </section>

      {/* Ranked 01 -> 10 Edition List */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <h3 className="font-sans tracking-tight text-lg font-bold text-slate-900 dark:text-slate-100">
            Bảng xếp hạng Top {edition.stories.length} tin tức quan trọng nhất
          </h3>
          <span className="font-mono text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Xếp hạng theo Điểm ưu tiên tòa soạn
          </span>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {edition.stories.map((story) => (
            <article
              key={`${story.rank}-${story.url}`}
              className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex items-start gap-4 min-w-0">
                <span className="font-sans tracking-tight text-2xl font-bold text-slate-300 dark:text-slate-700 tabular-nums shrink-0 leading-none pt-0.5">
                  {String(story.rank).padStart(2, '0')}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                      {story.newsroomCategory}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{story.region}</span>
                    <span aria-hidden="true">·</span>
                    <span>{story.sourceName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{story.displayTimestamp}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                      Ưu tiên {story.priorityScore}/100
                    </span>
                    {story.matchedTickers.length > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono font-semibold text-blue-900 dark:text-blue-300">
                          {story.matchedTickers.join(', ')}
                        </span>
                      </>
                    )}
                  </div>

                  <a
                    href={story.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 block font-sans tracking-tight text-lg font-bold leading-snug text-slate-900 hover:text-amber-900 dark:text-slate-100 dark:hover:text-amber-400"
                  >
                    {story.title}
                  </a>

                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {story.oneLineSummary}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 sm:pt-1">
                <button
                  type="button"
                  onClick={() =>
                    onAnalyzeArticleUrl(
                      story.url,
                      story.title,
                      story.sourceName,
                      story.newsroomCategory
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-800 dark:text-amber-400" />
                  <span>Phân tích</span>
                </button>
                <a
                  href={story.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:text-slate-100 whitespace-nowrap"
                >
                  <span>Bài gốc</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
