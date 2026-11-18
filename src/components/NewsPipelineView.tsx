import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BellRing,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Filter,
  FlaskConical,
  Loader2,
  Pencil,
  Plus,
  Radio,
  RotateCcw,
  Send,
  ShieldAlert,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import type {
  AutomationActionType,
  AutomationConditionType,
  AutomationRule,
  AutomationRulesState,
  AutomationSandboxResult,
  ArticleProcessResult,
  WebhookChannelsStatus,
} from '../types/news';

interface NewsPipelineViewProps {
  watchlistSymbols: string[];
  enabledSourcesCount: number;
  totalSourcesCount: number;
  storedArticlesCount: number;
  newsroomCount: number;
  unreadAlertsCount: number;
  botSessionStats: {
    totalScanned: number;
    newCount: number;
    updatedCount: number;
    skippedDuplicateCount: number;
  };
  webhookStatus: WebhookChannelsStatus | null;
  onOpenWebhookSettings: () => void;
}

const CONDITION_LABELS: Record<AutomationConditionType, string> = {
  keyword_exclude: 'Chứa từ khóa nhiễu / PR / giật gân',
  watchlist_or_macro: 'Nhắc mã Watchlist hoặc từ khóa Vĩ mô',
  negative_watchlist_alert: 'Tin Tiêu cực mạnh nhắc mã Watchlist',
  custom_keyword_tag: 'Khớp từ khóa chuyên đề tùy chỉnh',
};

const ACTION_LABELS: Record<AutomationActionType, string> = {
  block_noise: 'Loại bỏ khỏi Bản tin chính',
  pin_priority: 'Gắn nhãn "Ưu tiên cao" & Ghim đầu trang',
  send_webhook_alert: 'Bắn cảnh báo tức thời Telegram / Lark',
  auto_tag: 'Tự động gắn Tag phân loại',
};

const SANDBOX_SAMPLES: { label: string; title: string; text: string }[] = [
  {
    label: 'Tin xấu Watchlist (Luật 3)',
    title: 'HPG đối mặt áp lực chi phí nguyên liệu, biên lợi nhuận quý giảm sâu kỷ lục',
    text: 'Giá quặng sắt biến động mạnh kết hợp điều tra chống bán phá giá khiến lợi nhuận HPG suy giảm đáng kể, rủi ro áp lực bán tháo gia tăng trong ngắn hạn.',
  },
  {
    label: 'Tin Vĩ mô & SSI (Luật 2)',
    title: 'Ngân hàng Nhà nước giữ ổn định lãi suất, thanh khoản SSI và nhóm chứng khoán bứt phá',
    text: 'Dòng vốn ngoại quay trở lại mua ròng mạnh khi kỳ vọng nâng hạng thị trường chứng khoán và quyết định điều hành lãi suất của SBV tạo lực đẩy cho cổ phiếu SSI và FPT.',
  },
  {
    label: 'Tin nhiễu PR (Luật 1)',
    title: 'Tài trợ độc quyền livestream săn khuyến mãi và dự đoán xổ số cuối tuần',
    text: 'Bài viết quảng cáo chương trình ưu đãi trúng thưởng mini game và thông cáo báo chí PR không liên quan tới vĩ mô hay chứng khoán.',
  },
];

export function NewsPipelineView({
  watchlistSymbols,
  enabledSourcesCount,
  totalSourcesCount,
  storedArticlesCount,
  newsroomCount,
  unreadAlertsCount,
  botSessionStats,
  webhookStatus,
  onOpenWebhookSettings,
}: NewsPipelineViewProps) {
  const [rulesState, setRulesState] = useState<AutomationRulesState | null>(null);
  const [archiveCount, setArchiveCount] = useState<number>(newsroomCount);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Add new custom rule form
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newCondition, setNewCondition] =
    useState<AutomationConditionType>('custom_keyword_tag');
  const [newAction, setNewAction] = useState<AutomationActionType>('auto_tag');
  const [newKeywordsText, setNewKeywordsText] = useState<string>('');
  const [newCustomTag, setNewCustomTag] = useState<string>('');
  const [newSentimentTrigger, setNewSentimentTrigger] = useState<
    'any' | 'Tích cực' | 'Tiêu cực' | 'Trung lập'
  >('any');

  // Inline edit keywords for existing rule
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editingKeywordsStr, setEditingKeywordsStr] = useState<string>('');

  // Collapsible Sandbox Test
  const [sandboxOpen, setSandboxOpen] = useState<boolean>(false);
  const [sandboxTitle, setSandboxTitle] = useState<string>(SANDBOX_SAMPLES[0].title);
  const [sandboxText, setSandboxText] = useState<string>(SANDBOX_SAMPLES[0].text);
  const [sandboxRunning, setSandboxRunning] = useState<boolean>(false);
  const [sandboxResult, setSandboxResult] = useState<AutomationSandboxResult | null>(null);
  const [nlpRunning, setNlpRunning] = useState<boolean>(false);
  const [nlpResult, setNlpResult] = useState<ArticleProcessResult | null>(null);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/automation/rules');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể tải cấu hình tự động hóa.');
      setRulesState(data.state as AutomationRulesState);
      if (typeof data.liveMetrics?.archiveCount === 'number') {
        setArchiveCount(data.liveMetrics.archiveCount);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tải quy tắc tự động.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRules();
  }, [fetchRules]);

  const mutateRules = async (payload: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/automation/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể cập nhật quy tắc.');
      setRulesState(data.state as AutomationRulesState);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi cập nhật quy tắc.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateRule = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const keywords = newKeywordsText
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    await mutateRules({
      action: 'add',
      name: newName.trim(),
      conditionType: newCondition,
      actionType: newAction,
      keywords,
      customTag: newCustomTag.trim() || undefined,
      sentimentTrigger: newSentimentTrigger,
    });
    setNewName('');
    setNewKeywordsText('');
    setNewCustomTag('');
    setShowAddForm(false);
  };

  const handleSaveRuleKeywords = async (ruleId: string) => {
    const keywords = editingKeywordsStr
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    await mutateRules({ action: 'update_keywords', ruleId, keywords });
    setEditingRuleId(null);
  };

  const handleRunSandbox = async (e: FormEvent) => {
    e.preventDefault();
    if (!sandboxTitle.trim() && !sandboxText.trim()) return;
    setSandboxRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/automation/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: sandboxTitle.trim(),
          text: sandboxText.trim(),
          watchlistSymbols,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể chạy thử bộ lọc.');
      setSandboxResult(data as AutomationSandboxResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi chạy thử bộ lọc.');
    } finally {
      setSandboxRunning(false);
    }
  };

  const handleRunNlpSandbox = async () => {
    if (!sandboxText.trim() && !sandboxTitle.trim()) return;
    setNlpRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/news/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: sandboxTitle.trim() || undefined,
          text: sandboxText.trim() || sandboxTitle.trim(),
          categories: ['Kinh doanh', 'Tài chính', 'Công nghệ', 'Thế giới', 'Chính trị & Xã hội'],
          summaryLength: 'ngan',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể tóm tắt NLP mẫu.');
      setNlpResult(data as ArticleProcessResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tóm tắt AI.');
    } finally {
      setNlpRunning(false);
    }
  };

  const rules = rulesState?.rules || [];
  const stats = rulesState?.stats;
  const activeRulesCount = rules.filter((r) => r.enabled).length;
  const webhookReady = Boolean(
    webhookStatus?.telegramConfigured || webhookStatus?.larkConfigured
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Studio Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            <Cpu className="h-3.5 w-3.5" />
            <span>AI Pipeline Studio · 0 Token Gemini</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Tự động hóa Luồng Tin &amp; Quy tắc Cảnh báo
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Thiết lập quy tắc &ldquo;Nếu — Thì&rdquo; để tự động chặn tin nhiễu, ghim tin Watchlist/Vĩ mô và gửi cảnh báo tức thời qua Telegram/Lark.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenWebhookSettings}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
          >
            <BellRing className="h-3.5 w-3.5 text-amber-500" />
            <span>
              Kênh gửi:{' '}
              {webhookReady ? 'Đã kết nối' : 'Chưa cấu hình'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddForm((prev) => !prev)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400 cursor-pointer whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Thêm quy tắc mới</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800 dark:border-rose-800/70 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </div>
      )}

      {/* 1. LIVE 4-STEP PIPELINE FLOW BANNER */}
      <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Đường ống Xử lý Thời gian thực (Live Pipeline)
            </h2>
          </div>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
            Đang kích hoạt {activeRulesCount}/{rules.length} luật · {watchlistSymbols.length} mã Watchlist
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Step 1 */}
          <div className="relative rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span>01. Nguồn quét</span>
              <Radio className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {enabledSourcesCount}
              <span className="text-sm font-medium text-slate-400">/{totalSourcesCount}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Kênh RSS &amp; Google News đang bật
            </p>
          </div>

          {/* Step 2 */}
          <div className="relative rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span>02. Lọc trùng lặp (dedupBot)</span>
              <Filter className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {botSessionStats.newCount + storedArticlesCount}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              Đã lưu Kho · Lọc trùng {botSessionStats.skippedDuplicateCount} bài phiên này
            </p>
          </div>

          {/* Step 3 */}
          <div className="relative rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span>03. Quy tắc &amp; Gắn nhãn</span>
              <Tag className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {stats?.totalEvaluated ?? 0}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              Chặn nhiễu {stats?.blockedNoiseCount ?? 0} · Ghim ưu tiên {stats?.prioritizedCount ?? 0}
            </p>
          </div>

          {/* Step 4 */}
          <div className="relative rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span>04. Xuất bản &amp; Cảnh báo</span>
              <Send className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {Math.max(newsroomCount, archiveCount)}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              Tin xuất bản · Đã gửi {stats?.webhookAlertsTriggered ?? 0} cảnh báo Telegram/Lark · {unreadAlertsCount} mới
            </p>
          </div>
        </div>
      </section>

      {/* ADD NEW RULE FORM (Collapsible) */}
      {showAddForm && (
        <form
          onSubmit={handleCreateRule}
          className="rounded-xl border border-emerald-200 bg-white p-5 shadow-sm dark:border-emerald-800/70 dark:bg-slate-900 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Tạo Quy tắc Tự động Mới (&ldquo;Nếu — Thì&rdquo;)
            </h3>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tên quy tắc
              </label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="VD: Theo dõi tin Năng lượng tái tạo & Điện"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                NẾU (Điều kiện kích hoạt)
              </label>
              <select
                value={newCondition}
                onChange={(e) => setNewCondition(e.target.value as AutomationConditionType)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="custom_keyword_tag">Khớp từ khóa chuyên đề</option>
                <option value="watchlist_or_macro">Nhắc mã Watchlist / Vĩ mô</option>
                <option value="negative_watchlist_alert">Tin Tiêu cực về Watchlist</option>
                <option value="keyword_exclude">Chứa từ khóa nhiễu</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                THÌ (Hành động thực thi)
              </label>
              <select
                value={newAction}
                onChange={(e) => setNewAction(e.target.value as AutomationActionType)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="auto_tag">Tự động gắn Tag</option>
                <option value="pin_priority">Gắn nhãn Ưu tiên cao &amp; Ghim</option>
                <option value="send_webhook_alert">Bắn cảnh báo Telegram/Lark</option>
                <option value="block_noise">Chặn &amp; Loại khỏi Bản tin</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Danh sách từ khóa (phân cách bằng dấu phẩy)
              </label>
              <input
                type="text"
                value={newKeywordsText}
                onChange={(e) => setNewKeywordsText(e.target.value)}
                placeholder="VD: quy hoạch điện, năng lượng sạch, LNG, EVN"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tên Tag gắn thêm (tùy chọn)
              </label>
              <input
                type="text"
                value={newCustomTag}
                onChange={(e) => setNewCustomTag(e.target.value)}
                placeholder="VD: Năng lượng"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Điều kiện Sắc thái
              </label>
              <select
                value={newSentimentTrigger}
                onChange={(e) =>
                  setNewSentimentTrigger(
                    e.target.value as 'any' | 'Tích cực' | 'Tiêu cực' | 'Trung lập'
                  )
                }
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="any">Mọi sắc thái</option>
                <option value="Tiêu cực">Chỉ khi Tiêu cực</option>
                <option value="Tích cực">Chỉ khi Tích cực</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              <span>Lưu quy tắc</span>
            </button>
          </div>
        </form>
      )}

      {/* 2. INTERACTIVE IF-THIS-THEN-THAT RULES LIST */}
      <section className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Bộ Quy tắc Xử lý &amp; Cảnh báo Tự động ({rules.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Áp dụng tự động lên mọi bài báo mới từ Auto-Discovery Bot trước khi xuất bản lên Bản tin.
            </p>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={() => void mutateRules({ action: 'reset' })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Khôi phục 3 luật mặc định</span>
          </button>
        </div>

        {loading ? (
          <div className="py-10 text-center text-xs text-slate-500">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-emerald-600" />
            Đang tải bộ quy tắc tự động hóa...
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {rules.map((rule: AutomationRule) => {
              const isEditing = editingRuleId === rule.id;
              const toneBadge =
                rule.actionType === 'block_noise'
                  ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60'
                  : rule.actionType === 'send_webhook_alert'
                    ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60';

              return (
                <div
                  key={rule.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    rule.enabled
                      ? 'border-slate-200/80 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/40'
                      : 'border-slate-200/50 bg-slate-50/20 opacity-65 dark:border-slate-800/50 dark:bg-slate-950/20'
                  }`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {rule.name}
                        </span>
                        {rule.builtin && (
                          <span className="rounded-md bg-slate-200/80 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            Cốt lõi
                          </span>
                        )}
                        <span className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${toneBadge}`}>
                          {ACTION_LABELS[rule.actionType]}
                        </span>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                          · Khớp {rule.hitCount} lần
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {rule.conditionSummary} → {rule.actionSummary}
                      </p>

                      {/* IF -> THEN flow visual strip */}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                          <span className="font-bold text-slate-500">NẾU:</span>
                          {CONDITION_LABELS[rule.conditionType]}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">THÌ:</span>
                          {rule.customTag ? `Gắn tag "${rule.customTag}"` : ACTION_LABELS[rule.actionType]}
                        </span>
                      </div>

                      {/* Keywords list or editor */}
                      {isEditing ? (
                        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                          <input
                            type="text"
                            value={editingKeywordsStr}
                            onChange={(e) => setEditingKeywordsStr(e.target.value)}
                            placeholder="Nhập từ khóa phân cách bởi dấu phẩy..."
                            className="flex-1 rounded-lg border border-emerald-500 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none dark:bg-slate-900 dark:text-slate-100"
                          />
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => void handleSaveRuleKeywords(rule.id)}
                              disabled={saving}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
                            >
                              Lưu từ khóa
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingRuleId(null)}
                              className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                            >
                              Hủy
                            </button>
                          </div>
                        </div>
                      ) : (
                        rule.keywords.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                              Từ khóa ({rule.keywords.length}):
                            </span>
                            {rule.keywords.slice(0, 10).map((kw) => (
                              <span
                                key={kw}
                                className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                              >
                                {kw}
                              </span>
                            ))}
                            {rule.keywords.length > 10 && (
                              <span className="text-[11px] text-slate-400">
                                +{rule.keywords.length - 10} nữa
                              </span>
                            )}
                          </div>
                        )
                      )}
                    </div>

                    {/* Right actions: Edit keywords, Delete custom, Toggle Switch */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRuleId(rule.id);
                          setEditingKeywordsStr(rule.keywords.join(', '));
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                        title="Sửa danh sách từ khóa"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>Sửa từ khóa</span>
                      </button>

                      {!rule.builtin && (
                        <button
                          type="button"
                          onClick={() => void mutateRules({ action: 'delete', ruleId: rule.id })}
                          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:border-rose-300 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 cursor-pointer"
                          title="Xóa quy tắc"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        role="switch"
                        aria-checked={rule.enabled}
                        disabled={saving}
                        onClick={() => void mutateRules({ action: 'toggle', ruleId: rule.id })}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer transition-colors ${
                          rule.enabled
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                            : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
                        }`}
                      >
                        {rule.enabled ? 'Đang bật' : 'Đang tắt'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. COMPACT COLLAPSIBLE SANDBOX TEST */}
      <section className="rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900 overflow-hidden">
        <button
          type="button"
          onClick={() => setSandboxOpen((prev) => !prev)}
          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <FlaskConical className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Chạy thử bộ lọc trên văn bản mẫu (Sandbox Test)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Kiểm tra ngay bài viết mẫu sẽ bị chặn, ghim ưu tiên hay kích hoạt cảnh báo Telegram/Lark theo bộ luật hiện tại.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 shrink-0">
            {sandboxOpen ? (
              <>
                <span>Thu gọn</span>
                <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                <span>Mở Sandbox</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </span>
        </button>

        {sandboxOpen && (
          <div className="border-t border-slate-100 p-5 dark:border-slate-800 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Nạp kịch bản mẫu:
              </span>
              {SANDBOX_SAMPLES.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => {
                    setSandboxTitle(s.title);
                    setSandboxText(s.text);
                    setSandboxResult(null);
                    setNlpResult(null);
                  }}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  {s.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleRunSandbox} className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="lg:col-span-6 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Tiêu đề bài viết thử nghiệm
                  </label>
                  <input
                    type="text"
                    value={sandboxTitle}
                    onChange={(e) => setSandboxTitle(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nội dung tóm tắt / Toàn văn
                  </label>
                  <textarea
                    rows={4}
                    value={sandboxText}
                    onChange={(e) => setSandboxText(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="submit"
                    disabled={sandboxRunning}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-emerald-500 dark:text-slate-950 cursor-pointer"
                  >
                    {sandboxRunning ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FlaskConical className="h-3.5 w-3.5" />
                    )}
                    <span>Chạy thử bộ luật (0 token)</span>
                  </button>

                  <button
                    type="button"
                    disabled={nlpRunning}
                    onClick={() => void handleRunNlpSandbox()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    {nlpRunning ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    )}
                    <span>Tóm tắt &amp; Phân loại AI</span>
                  </button>
                </div>
              </div>

              <div className="lg:col-span-6 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Kết quả đánh giá đầu ra
                </div>

                {!sandboxResult && !nlpResult ? (
                  <p className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    Nhấn &ldquo;Chạy thử bộ luật&rdquo; để xem quyết định định tuyến của hệ thống.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {sandboxResult && (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          {sandboxResult.decision === 'blocked' ? (
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-2.5 py-1 text-xs font-bold text-white">
                              <ShieldAlert className="h-3.5 w-3.5" />
                              BỊ CHẶN KHỎI BẢN TIN
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              {sandboxResult.decisionLabel}
                            </span>
                          )}

                          {sandboxResult.decision === 'prioritized' && (
                            <span className="rounded-md bg-amber-500 px-2.5 py-1 text-xs font-bold text-slate-950">
                              Điểm ưu tiên: {sandboxResult.priorityScore}
                            </span>
                          )}

                          {sandboxResult.decision === 'alerted' && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-200">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Bắn Cảnh báo Telegram/Lark
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                          <span>
                            Sắc thái:{' '}
                            <strong className="text-slate-900 dark:text-slate-100">
                              {sandboxResult.sentimentLabel}
                            </strong>
                          </span>
                          {sandboxResult.matchedTickers.length > 0 && (
                            <span>
                              · Mã CK:{' '}
                              <strong className="text-emerald-700 dark:text-emerald-400">
                                {sandboxResult.matchedTickers.join(', ')}
                              </strong>
                            </span>
                          )}
                        </div>

                        {sandboxResult.resultingTags.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {sandboxResult.resultingTags.map((t) => (
                              <span
                                key={t}
                                className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="space-y-1.5 border-t border-slate-200 pt-2.5 dark:border-slate-800">
                          {sandboxResult.matchedRules.length === 0 ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Không có quy tắc chặn/ưu tiên nào kích hoạt — xuất bản bình thường.
                            </p>
                          ) : (
                            sandboxResult.matchedRules.map((rb) => (
                              <div
                                key={rb.ruleId}
                                className="flex items-start justify-between gap-2 text-xs"
                              >
                                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                  ✓ {rb.ruleName}
                                </span>
                                <span className="text-right text-[11px] text-slate-500 dark:text-slate-400">
                                  {rb.detail}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    )}

                    {nlpResult && (
                      <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900 space-y-1">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          AI Tóm tắt: {nlpResult.classification.primaryCategory} ({nlpResult.sentiment.label})
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                          {nlpResult.summary.conciseSummary}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </form>
          </div>
        )}
      </section>
    </main>
  );
}
