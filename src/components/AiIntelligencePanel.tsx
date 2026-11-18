import { useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Compass,
  ExternalLink,
  FileSearch,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import type {
  AiRecommendationResponse,
  AiSuggestedSource,
  AutoFetchIntervalMinutes,
  NewsCategoryId,
  NewsSourceConfig,
  VolatilityCollectionResponse,
  VolatilityScopeId,
} from '../types/news';

interface AiIntelligencePanelProps {
  recommendations: AiRecommendationResponse | null;
  recLoading: boolean;
  recError: string | null;
  onRefreshRecommendations: () => void;
  onSelectTopic: (topicQuery: string, category?: NewsCategoryId) => void;
  onAddSuggestedSource: (source: AiSuggestedSource) => void;
  existingSources: NewsSourceConfig[];

  volatilityResult: VolatilityCollectionResponse | null;
  volLoading: boolean;
  volError: string | null;
  volScope: VolatilityScopeId;
  onChangeVolScope: (scope: VolatilityScopeId) => void;
  volKeyword: string;
  onChangeVolKeyword: (kw: string) => void;
  onCollectVolatilityNow: () => void;

  autoCollectVolatility: boolean;
  onToggleAutoCollectVolatility: () => void;
  autoFetchInterval: AutoFetchIntervalMinutes;
  onChangeAutoFetchInterval: (mins: AutoFetchIntervalMinutes) => void;
  nextAutoFetchAt: number | null;

  onAnalyzeArticleUrl: (
    url: string,
    title?: string,
    sourceName?: string,
    category?: string
  ) => void;
  onGoToDatabase: () => void;
}

const VOLATILITY_SCOPES: { id: VolatilityScopeId; label: string }[] = [
  { id: 'tat-ca', label: 'Toàn cảnh' },
  { id: 'kinh-te-tai-chinh', label: 'Tài chính & Vàng/Tỷ giá' },
  { id: 'cong-nghe-an-ninh', label: 'Công nghệ & An ninh' },
  { id: 'dia-chinh-tri', label: 'Địa chính trị' },
  { id: 'thoi-tiet-nang-luong', label: 'Thời tiết & Năng lượng' },
];

const INTERVAL_OPTIONS: { value: AutoFetchIntervalMinutes; label: string }[] = [
  { value: 1, label: '1 phút' },
  { value: 5, label: '5 phút' },
  { value: 15, label: '15 phút' },
  { value: 30, label: '30 phút' },
  { value: 60, label: '60 phút' },
];

export function AiIntelligencePanel({
  recommendations,
  recLoading,
  recError,
  onRefreshRecommendations,
  onSelectTopic,
  onAddSuggestedSource,
  existingSources,
  volatilityResult,
  volLoading,
  volError,
  volScope,
  onChangeVolScope,
  volKeyword,
  onChangeVolKeyword,
  onCollectVolatilityNow,
  autoCollectVolatility,
  onToggleAutoCollectVolatility,
  autoFetchInterval,
  onChangeAutoFetchInterval,
  onAnalyzeArticleUrl,
  onGoToDatabase,
}: AiIntelligencePanelProps) {
  const [activeStudioTab, setActiveStudioTab] = useState<'both' | 'recommend' | 'volatility'>('both');

  return (
    <section
      className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8"
      aria-label="Trợ lý AI Đề xuất nội dung và Thu thập tin biến động"
    >
      <div className="border border-slate-200 bg-slate-50/90 dark:border-slate-800 dark:bg-slate-900/90">
        {/* Panel Top Strip */}
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-900 dark:text-amber-400">
              AI Biên tập &amp; Radar Biến động Thời gian thực
            </p>
            <h2 className="font-sans tracking-tight text-xl font-semibold text-slate-900 dark:text-slate-100">
              Tự động đề xuất nội dung &amp; Thu thập tin tức biến động
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900"
              role="tablist"
              aria-label="Hiển thị khối AI"
            >
              {(
                [
                  { id: 'both', label: 'Xem song song' },
                  { id: 'recommend', label: 'Đề xuất nội dung' },
                  { id: 'volatility', label: 'Tin biến động' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeStudioTab === tab.id}
                  onClick={() => setActiveStudioTab(tab.id)}
                  className={`rounded px-2.5 py-1 text-xs font-medium cursor-pointer whitespace-nowrap ${
                    activeStudioTab === tab.id
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div
          className={`grid grid-cols-1 divide-y divide-slate-200 dark:divide-slate-800 ${
            activeStudioTab === 'both'
              ? 'lg:grid-cols-12 lg:divide-y-0 lg:divide-x'
              : ''
          }`}
        >
          {/* LEFT: AI CONTENT RECOMMENDATION */}
          {(activeStudioTab === 'both' || activeStudioTab === 'recommend') && (
            <div
              className={`${
                activeStudioTab === 'both' ? 'lg:col-span-6' : ''
              } p-5 space-y-5`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Compass className="h-4 w-4 text-amber-900 dark:text-amber-400 shrink-0" />
                  <h3 className="font-sans tracking-tight text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Đề xuất nội dung cho bạn
                  </h3>
                </div>

                <button
                  type="button"
                  disabled={recLoading}
                  onClick={onRefreshRecommendations}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                >
                  {recLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  <span>{recLoading ? 'Đang phân tích...' : 'Làm mới đề xuất'}</span>
                </button>
              </div>

              {recError && (
                <div className="border border-red-800/30 bg-red-50/70 p-3 text-xs text-red-900 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-200">
                  {recError}
                </div>
              )}

              {recLoading && !recommendations && (
                <div className="space-y-3 py-4">
                  <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-800" />
                  <div className="h-16 w-full bg-slate-200 dark:bg-slate-800" />
                  <div className="h-16 w-full bg-slate-200 dark:bg-slate-800" />
                </div>
              )}

              {recommendations && (
                <div className="space-y-5">
                  <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                    {recommendations.personalizedBrief}
                  </p>

                  {/* Recommended Topics */}
                  {recommendations.recommendedTopics.length > 0 && (
                    <div className="space-y-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        Chủ đề nên theo dõi tiếp ({recommendations.recommendedTopics.length})
                      </p>
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {recommendations.recommendedTopics.map((topic) => (
                          <button
                            key={topic.id}
                            type="button"
                            onClick={() =>
                              onSelectTopic(topic.topicQuery, topic.suggestedCategory)
                            }
                            className="group text-left border border-slate-200 bg-white p-3 hover:border-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-600 transition-colors cursor-pointer"
                          >
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-[11px] font-medium text-amber-900 dark:text-amber-400">
                                {topic.priority}
                              </span>
                              <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-100 shrink-0" />
                            </div>
                            <p className="mt-1 text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">
                              {topic.angleTitle}
                            </p>
                            <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 line-clamp-2">
                              {topic.reason}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggested Articles */}
                  {recommendations.suggestedArticles.length > 0 && (
                    <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        Bài viết AI chọn lọc ({recommendations.suggestedArticles.length})
                      </p>
                      <ul className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
                        {recommendations.suggestedArticles.map((art, i) => (
                          <li
                            key={`${art.url}-${i}`}
                            className="py-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <a
                                href={art.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group inline-flex items-center gap-1 text-xs font-semibold text-slate-900 hover:text-amber-900 dark:text-slate-100 dark:hover:text-amber-400"
                              >
                                <span className="truncate">{art.title}</span>
                                <ExternalLink className="h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100" />
                              </a>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {art.source} · {art.category} — {art.whyRecommended}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                onAnalyzeArticleUrl(
                                  art.url,
                                  art.title,
                                  art.source,
                                  art.category
                                )
                              }
                              className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-800 hover:bg-slate-900 hover:text-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-100 dark:hover:text-slate-900 cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
                            >
                              <FileSearch className="h-3 w-3" />
                              <span>Phân tích nội dung</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Suggested RSS Sources */}
                  {recommendations.suggestedSources.length > 0 && (
                    <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        Đề xuất mở rộng nguồn trang
                      </p>
                      <div className="space-y-2">
                        {recommendations.suggestedSources.map((src) => {
                          const exists = existingSources.some(
                            (e) => e.url.toLowerCase() === src.url.toLowerCase()
                          );
                          return (
                            <div
                              key={src.url}
                              className="flex flex-wrap items-center justify-between gap-2 text-xs"
                            >
                              <div className="min-w-0 flex-1">
                                <span className="font-medium text-slate-900 dark:text-slate-100">
                                  {src.name}
                                </span>
                                <span className="mx-1.5 text-slate-400">·</span>
                                <span className="text-slate-500 dark:text-slate-400">
                                  {src.reason}
                                </span>
                              </div>
                              <button
                                type="button"
                                disabled={exists}
                                onClick={() => onAddSuggestedSource(src)}
                                className={`inline-flex items-center gap-1 rounded border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap shrink-0 ${
                                  exists
                                    ? 'border-slate-200 text-slate-400 dark:border-slate-800 dark:text-slate-600'
                                    : 'border-slate-300 bg-white text-slate-800 hover:border-slate-600 cursor-pointer dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                                }`}
                              >
                                <Plus className="h-3 w-3" />
                                <span>{exists ? 'Đã theo dõi' : 'Thêm nguồn'}</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!recommendations && !recLoading && !recError && (
                <div className="py-6 text-xs text-slate-600 dark:text-slate-400">
                  Nhấn <strong>Làm mới đề xuất</strong> để AI phân tích lịch sử đọc và Kho Tin hiện tại nhằm gợi ý các tuyến bài giá trị nhất.
                </div>
              )}
            </div>
          )}

          {/* RIGHT: AI VOLATILITY NEWS AUTO-COLLECTOR */}
          {(activeStudioTab === 'both' || activeStudioTab === 'volatility') && (
            <div
              className={`${
                activeStudioTab === 'both' ? 'lg:col-span-6' : ''
              } p-5 space-y-5`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-800 dark:text-amber-400 shrink-0" />
                  <h3 className="font-sans tracking-tight text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Thu thập tin tức biến động
                  </h3>
                  {volatilityResult && (
                    <span
                      className={`text-xs font-medium ${
                        volatilityResult.volatilityIndexLabel === 'Biến động mạnh'
                          ? 'text-red-700 dark:text-red-400'
                          : volatilityResult.volatilityIndexLabel === 'Chú ý cao'
                            ? 'text-amber-800 dark:text-amber-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      · {volatilityResult.volatilityIndexLabel}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={autoFetchInterval}
                    onChange={(e) =>
                      onChangeAutoFetchInterval(Number(e.target.value) as AutoFetchIntervalMinutes)
                    }
                    aria-label="Chu kỳ tự động thu thập tin biến động"
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    {INTERVAL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        Mỗi {opt.label}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={onToggleAutoCollectVolatility}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${
                      autoCollectVolatility
                        ? 'border-emerald-700 bg-emerald-800 text-white dark:border-emerald-500 dark:bg-emerald-600'
                        : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                    }`}
                  >
                    {autoCollectVolatility ? '✓ Tự động thu thập' : 'Bật tự động thu thập'}
                  </button>

                  <button
                    type="button"
                    disabled={volLoading}
                    onClick={onCollectVolatilityNow}
                    className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 cursor-pointer whitespace-nowrap"
                  >
                    {volLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Activity className="h-3.5 w-3.5" />
                    )}
                    <span>{volLoading ? 'Đang quét...' : 'Quét biến động'}</span>
                  </button>
                </div>
              </div>

              {/* Scope & Keyword Filter Row */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={volScope}
                  onChange={(e) => onChangeVolScope(e.target.value as VolatilityScopeId)}
                  aria-label="Chọn lĩnh vực biến động"
                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  {VOLATILITY_SCOPES.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.label}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  value={volKeyword}
                  onChange={(e) => onChangeVolKeyword(e.target.value)}
                  placeholder="Từ khóa biến động thêm (vd: vàng SJC, tỷ giá, VN-Index)..."
                  className="flex-1 min-w-[200px] rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>

              {volError && (
                <div className="border border-red-800/30 bg-red-50/70 p-3 text-xs text-red-900 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-200">
                  {volError}
                </div>
              )}

              {volLoading && !volatilityResult && (
                <div className="space-y-3 py-4">
                  <div className="h-4 w-2/3 bg-slate-200 dark:bg-slate-800" />
                  <div className="h-20 w-full bg-slate-200 dark:bg-slate-800" />
                  <div className="h-20 w-full bg-slate-200 dark:bg-slate-800" />
                </div>
              )}

              {volatilityResult && (
                <div className="space-y-4">
                  <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                    {volatilityResult.marketPulseSummary}
                  </p>

                  {volatilityResult.botReport && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                        <span>
                          Bot đã kiểm tra {volatilityResult.botReport.totalScanned} tin biến động: lưu{' '}
                          <strong className="font-mono tabular-nums">
                            {volatilityResult.botReport.newCount}
                          </strong>{' '}
                          mới, cập nhật{' '}
                          <strong className="font-mono tabular-nums">
                            {volatilityResult.botReport.updatedCount}
                          </strong>
                          , bỏ qua{' '}
                          <strong className="font-mono tabular-nums">
                            {volatilityResult.botReport.skippedDuplicateCount}
                          </strong>{' '}
                          trùng
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={onGoToDatabase}
                        className="font-medium text-amber-900 hover:underline underline-offset-4 dark:text-amber-400 cursor-pointer"
                      >
                        Mở Kho Tin →
                      </button>
                    </div>
                  )}

                  <ul className="divide-y divide-slate-200 border-t border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                    {volatilityResult.volatilityAlerts.map((alert) => {
                      const levelClass =
                        alert.volatilityLevel === 'Khẩn cấp'
                          ? 'text-red-700 dark:text-red-400 font-semibold'
                          : alert.volatilityLevel === 'Biến động cao'
                            ? 'text-amber-800 dark:text-amber-400 font-semibold'
                            : 'text-slate-700 dark:text-slate-300 font-medium';
                      return (
                        <li key={alert.id} className="py-3 space-y-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={levelClass}>{alert.volatilityLevel}</span>
                              <span aria-hidden="true">·</span>
                              <span>{alert.sector}</span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                                {alert.signalMetric}
                              </span>
                            </div>
                            <span className="font-mono tabular-nums">
                              {alert.sourceName} · {alert.publishedRelative}
                            </span>
                          </div>

                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1 space-y-1">
                              <a
                                href={alert.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group inline-flex items-baseline gap-1 text-sm font-sans tracking-tight font-semibold text-slate-900 hover:text-amber-900 dark:text-slate-100 dark:hover:text-amber-400"
                              >
                                <span>{alert.headline}</span>
                                <ExternalLink className="h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100" />
                              </a>
                              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                                {alert.impactSummary}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                onAnalyzeArticleUrl(
                                  alert.sourceUrl,
                                  alert.headline,
                                  alert.sourceName,
                                  alert.sector
                                )
                              }
                              className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-800 hover:bg-slate-900 hover:text-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-100 dark:hover:text-slate-900 cursor-pointer whitespace-nowrap shrink-0 self-start"
                            >
                              <FileSearch className="h-3 w-3" />
                              <span>Phân tích nội dung</span>
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {!volatilityResult && !volLoading && !volError && (
                <div className="py-6 text-xs text-slate-600 dark:text-slate-400">
                  Nhấn <strong>Quét biến động</strong> hoặc bật <strong>Tự động thu thập</strong> để AI tự động tìm tin nóng biến động, lọc trùng qua Bot và lưu vào Kho Tin.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
