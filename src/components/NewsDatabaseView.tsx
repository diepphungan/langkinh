import { useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Activity,
  Bot,
  Clock,
  Cloud,
  Database,
  Download,
  ExternalLink,
  FileSearch,
  HardDrive,
  Loader2,
  LogIn,
  LogOut,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  Trash2,
  X,
} from 'lucide-react';
import type {
  ApiUsageResponse,
  AutoFetchIntervalMinutes,
  BotAuditEntry,
  BotDecisionType,
  StoredArticleStatus,
  StoredNewsArticle,
} from '../types/news';
import {
  type AutoTagRule,
  DEFAULT_AUTO_TAG_RULES,
  extractArticleTags,
  loadTagRulesFromStorage,
  sanitizeTagLabel,
  sanitizeTagList,
  saveTagRulesToStorage,
} from '../lib/articleAutoTagger';
import { SentimentBar } from './SentimentBar';

interface NewsDatabaseViewProps {
  articles: StoredNewsArticle[];
  loadingCloud: boolean;
  cloudError: string | null;
  user: User | null;
  onSignInGoogle: () => void;
  onSignOutGoogle: () => void;
  onSyncLocalToCloud: () => Promise<void>;
  localPendingSyncCount: number;
  onUpdateArticle: (
    id: string,
    patch: { status?: StoredArticleStatus; notes?: string; tags?: string[] }
  ) => Promise<void>;
  onBatchUpdateArticleTags?: (
    updates: Array<{ id: string; tags: string[] }>
  ) => Promise<number>;
  onDeleteArticle: (id: string) => Promise<void>;
  onAnalyzeArticleUrl: (
    url: string,
    title?: string,
    sourceName?: string,
    category?: string
  ) => void;
  // Auto-Fetch Scheduler props
  autoFetchEnabled: boolean;
  onToggleAutoFetch: () => void;
  autoFetchInterval: AutoFetchIntervalMinutes;
  onChangeInterval: (mins: AutoFetchIntervalMinutes) => void;
  autoFetchRunning: boolean;
  lastAutoFetchAt: string | null;
  nextAutoFetchAt: number | null;
  lastAutoFetchSummary: string | null;
  enabledSourcesCount: number;
  onTriggerAutoFetchNow: () => void;
  onGoToSources: () => void;
  // Dedup & Update Bot props
  dedupBotEnabled: boolean;
  onToggleDedupBot: () => void;
  botAuditHistory: BotAuditEntry[];
  botSessionStats: {
    totalScanned: number;
    newCount: number;
    updatedCount: number;
    skippedDuplicateCount: number;
  };
  onClearBotAudit: () => void;
  onScanExistingDuplicates: () => Promise<number>;
  // AI Volatility Auto-Collect props
  autoCollectVolatility?: boolean;
  onToggleAutoCollectVolatility?: () => void;
}

const INTERVAL_OPTIONS: { value: AutoFetchIntervalMinutes; label: string }[] = [
  { value: 1, label: 'Mỗi 1 phút' },
  { value: 5, label: 'Mỗi 5 phút' },
  { value: 15, label: 'Mỗi 15 phút' },
  { value: 30, label: 'Mỗi 30 phút' },
  { value: 60, label: 'Mỗi 60 phút' },
];

const STATUS_LABELS: Record<StoredArticleStatus, string> = {
  unread: 'Chưa đọc',
  reviewed: 'Đã xem',
  archived: 'Lưu trữ',
};

function formatCountdown(targetMs: number | null, nowMs: number): string {
  if (!targetMs) return '--:--';
  const diffSec = Math.max(0, Math.ceil((targetMs - nowMs) / 1000));
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function NewsDatabaseView({
  articles,
  loadingCloud,
  cloudError,
  user,
  onSignInGoogle,
  onSignOutGoogle,
  onSyncLocalToCloud,
  localPendingSyncCount,
  onUpdateArticle,
  onBatchUpdateArticleTags,
  onDeleteArticle,
  onAnalyzeArticleUrl,
  autoFetchEnabled,
  onToggleAutoFetch,
  autoFetchInterval,
  onChangeInterval,
  autoFetchRunning,
  lastAutoFetchAt,
  nextAutoFetchAt,
  lastAutoFetchSummary,
  enabledSourcesCount,
  onTriggerAutoFetchNow,
  onGoToSources,
  dedupBotEnabled,
  onToggleDedupBot,
  botAuditHistory,
  botSessionStats,
  onClearBotAudit,
  onScanExistingDuplicates,
  autoCollectVolatility,
  onToggleAutoCollectVolatility,
}: NewsDatabaseViewProps) {
  const [subTab, setSubTab] = useState<'records' | 'bot-audit' | 'api-monitor'>('records');
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Database filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Tất cả');
  const [sentimentFilter, setSentimentFilter] = useState('Tất cả');
  const [statusFilter, setStatusFilter] = useState<'all' | StoredArticleStatus>('all');
  const [tagFilter, setTagFilter] = useState<string>('Tất cả');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [syncing, setSyncing] = useState(false);

  // Auto-tagging & custom rules state
  const [tagRules, setTagRules] = useState<AutoTagRule[]>(() => loadTagRulesFromStorage());
  const [showTagRulesPanel, setShowTagRulesPanel] = useState(false);
  const [newRuleTag, setNewRuleTag] = useState('');
  const [newRuleKeywords, setNewRuleKeywords] = useState('');
  const [addingTagForId, setAddingTagForId] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');
  const [bulkTagging, setBulkTagging] = useState(false);
  const [bulkTagStatusMsg, setBulkTagStatusMsg] = useState<string | null>(null);

  // Bot audit filters & scan feedback
  const [botDecisionFilter, setBotDecisionFilter] = useState<'all' | BotDecisionType>('all');
  const [scanningDb, setScanningDb] = useState(false);
  const [scanResultMsg, setScanResultMsg] = useState<string | null>(null);

  // API Usage monitor state
  const [apiUsage, setApiUsage] = useState<ApiUsageResponse | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);

  useEffect(() => {
    saveTagRulesToStorage(tagRules);
  }, [tagRules]);

  useEffect(() => {
    if (!autoFetchEnabled) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [autoFetchEnabled]);

  const fetchApiUsage = async () => {
    setLoadingUsage(true);
    try {
      const res = await fetch('/api/system/api-usage');
      if (res.ok) {
        const data = (await res.json()) as ApiUsageResponse;
        setApiUsage(data);
      }
    } catch {
      // ignore transient error
    } finally {
      setLoadingUsage(false);
    }
  };

  useEffect(() => {
    void fetchApiUsage();
    if (subTab !== 'api-monitor') return;
    const timer = window.setInterval(() => {
      void fetchApiUsage();
    }, 8000);
    return () => window.clearInterval(timer);
  }, [subTab, lastAutoFetchAt]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const a of articles) {
      if (a.category) set.add(a.category);
    }
    return Array.from(set);
  }, [articles]);

  const getArticleTags = (art: StoredNewsArticle): string[] => {
    if (Array.isArray(art.tags)) {
      return sanitizeTagList(art.tags);
    }
    return extractArticleTags(art, tagRules);
  };

  const availableTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const art of articles) {
      const tags = Array.isArray(art.tags)
        ? sanitizeTagList(art.tags)
        : extractArticleTags(art, tagRules);
      for (const tag of tags) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'vi'));
  }, [articles, tagRules]);

  const filteredArticles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return articles.filter((a) => {
      const artTags = Array.isArray(a.tags)
        ? sanitizeTagList(a.tags)
        : extractArticleTags(a, tagRules);
      const matchSearch =
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.sourceName.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.notes.toLowerCase().includes(q) ||
        artTags.some((t) => t.toLowerCase().includes(q));
      const matchCat = categoryFilter === 'Tất cả' || a.category === categoryFilter;
      const matchSent =
        sentimentFilter === 'Tất cả' || a.sentimentLabel === sentimentFilter;
      const matchStatus = statusFilter === 'all' || a.status === statusFilter;
      const matchTag = tagFilter === 'Tất cả' || artTags.includes(tagFilter);
      return matchSearch && matchCat && matchSent && matchStatus && matchTag;
    });
  }, [articles, searchQuery, categoryFilter, sentimentFilter, statusFilter, tagFilter, tagRules]);

  const unreadCount = articles.filter((a) => a.status === 'unread').length;
  const reviewedCount = articles.filter((a) => a.status === 'reviewed').length;
  const positiveCount = articles.filter((a) => a.sentimentLabel === 'Tích cực').length;
  const distinctSources = new Set(articles.map((a) => a.sourceDomain)).size;

  const handleToggleRule = (ruleId: string) => {
    setTagRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const handleAddCustomRule = () => {
    const cleanTag = sanitizeTagLabel(newRuleTag);
    const cleanKeywords = newRuleKeywords
      .split(',')
      .map((kw) => kw.trim().toLowerCase())
      .filter(Boolean);
    if (!cleanTag || cleanKeywords.length === 0) return;

    const customRule: AutoTagRule = {
      id: `custom-${Date.now()}`,
      tag: cleanTag,
      keywords: Array.from(new Set(cleanKeywords)),
      enabled: true,
      isCustom: true,
    };
    setTagRules((prev) => [...prev, customRule]);
    setNewRuleTag('');
    setNewRuleKeywords('');
    setBulkTagStatusMsg(
      `Đã thêm quy tắc nhãn "${cleanTag}" với ${customRule.keywords.length} từ khóa.`
    );
  };

  const handleDeleteCustomRule = (ruleId: string) => {
    setTagRules((prev) => prev.filter((r) => r.id !== ruleId));
  };

  const handleResetDefaultRules = () => {
    setTagRules(DEFAULT_AUTO_TAG_RULES);
    setBulkTagStatusMsg('Đã khôi phục bộ quy tắc từ khóa mặc định.');
  };

  const handleRunBulkAutoTag = async () => {
    if (articles.length === 0 || bulkTagging) return;
    setBulkTagging(true);
    setBulkTagStatusMsg(null);
    try {
      const updates: Array<{ id: string; tags: string[] }> = [];
      for (const art of articles) {
        if (art.status === 'archived') continue;
        const existing = Array.isArray(art.tags) ? sanitizeTagList(art.tags) : [];
        const extracted = extractArticleTags(art, tagRules);
        const merged = sanitizeTagList([...existing, ...extracted]);
        if (JSON.stringify(merged) !== JSON.stringify(existing)) {
          updates.push({ id: art.id, tags: merged });
        }
      }

      if (updates.length === 0) {
        setBulkTagStatusMsg(
          'Toàn bộ bài viết chưa lưu trữ đã được gán đầy đủ nhãn theo quy tắc hiện hành.'
        );
        return;
      }

      let updatedCount = 0;
      if (onBatchUpdateArticleTags) {
        updatedCount = await onBatchUpdateArticleTags(updates);
      } else {
        for (const item of updates) {
          await onUpdateArticle(item.id, { tags: item.tags });
          updatedCount += 1;
        }
      }

      const activeRuleCount = tagRules.filter((r) => r.enabled).length;
      setBulkTagStatusMsg(
        `Đã tự động gán & đồng bộ nhãn cho ${updatedCount} bài viết theo ${activeRuleCount} quy tắc từ khóa.`
      );
    } catch (err) {
      setBulkTagStatusMsg(
        err instanceof Error
          ? `Không thể cập nhật nhãn hàng loạt: ${err.message}`
          : 'Không thể cập nhật nhãn hàng loạt lúc này.'
      );
    } finally {
      setBulkTagging(false);
    }
  };

  const handleRemoveArticleTag = async (art: StoredNewsArticle, tagToRemove: string) => {
    if (art.status === 'archived') return;
    const current = getArticleTags(art);
    const next = current.filter((t) => t !== tagToRemove);
    await onUpdateArticle(art.id, { tags: next });
    if (tagFilter === tagToRemove) {
      const stillExists = articles.some(
        (other) => other.id !== art.id && getArticleTags(other).includes(tagToRemove)
      );
      if (!stillExists) setTagFilter('Tất cả');
    }
  };

  const handleAddArticleTag = async (art: StoredNewsArticle) => {
    if (art.status === 'archived') return;
    const clean = sanitizeTagLabel(tagDraft);
    if (!clean) return;
    const current = getArticleTags(art);
    const next = sanitizeTagList([...current, clean]);
    await onUpdateArticle(art.id, { tags: next });
    setTagDraft('');
    setAddingTagForId(null);
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(filteredArticles, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lang-kinh-news-db-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const headers = [
      'Tiêu đề',
      'Nguồn',
      'Chủ đề',
      'Nhãn',
      'Cảm xúc',
      'Phương thức lấy',
      'Trạng thái',
      'URL',
      'Ngày lưu',
    ];
    const escapeCell = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;
    const rows = filteredArticles.map((a) =>
      [
        escapeCell(a.title),
        escapeCell(a.sourceName),
        escapeCell(a.category),
        escapeCell(getArticleTags(a).join('; ')),
        escapeCell(a.sentimentLabel),
        escapeCell(a.fetchedMethod),
        escapeCell(STATUS_LABELS[a.status]),
        escapeCell(a.url),
        escapeCell(a.createdAt),
      ].join(',')
    );
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lang-kinh-news-db-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSyncClick = async () => {
    setSyncing(true);
    try {
      await onSyncLocalToCloud();
    } finally {
      setSyncing(false);
    }
  };

  const totalApiCalls =
    apiUsage?.providers.reduce((acc, p) => acc + p.totalCalls, 0) ?? 0;
  const rateLimitedApis =
    apiUsage?.providers.filter((p) => p.rateLimitedCalls > 0 || p.cooldownRemainingSeconds > 0)
      .length ?? 0;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      {/* Header & Sub-tab switcher */}
      <div className="flex flex-col gap-5 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between dark:border-slate-800">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Cơ sở dữ liệu tin tức &amp; Điều phối lấy tin tự động
          </p>
          <h1 className="mt-2 font-sans tracking-tight text-3xl font-semibold text-slate-900 dark:text-slate-100">
            Kho Dữ Liệu Tin Tức &amp; Giám Sát API
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Lưu trữ tập trung toàn bộ bài viết đã thu thập từ RSS, VnExpress, Public APIs vào Firestore Cloud, đặt lịch lấy tin tự động và theo dõi hạn mức gọi của từng API.
          </p>
        </div>

        <div
          className="inline-flex flex-wrap items-center gap-1 rounded-md border border-slate-300 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900/90 shrink-0"
          role="tablist"
          aria-label="Chế độ xem Kho Tin"
        >
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'records'}
            onClick={() => setSubTab('records')}
            className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer ${
              subTab === 'records'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            <span>Kho dữ liệu tin ({articles.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'bot-audit'}
            onClick={() => setSubTab('bot-audit')}
            className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer ${
              subTab === 'bot-audit'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            <Bot className="h-3.5 w-3.5" />
            <span>
              Bot chống trùng ({botSessionStats.skippedDuplicateCount} chặn ·{' '}
              {botSessionStats.updatedCount} cập nhật)
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={subTab === 'api-monitor'}
            onClick={() => setSubTab('api-monitor')}
            className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer ${
              subTab === 'api-monitor'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            <Activity className="h-3.5 w-3.5" />
            <span>API đã gọi &amp; Giới hạn</span>
          </button>
        </div>
      </div>

      {/* Top Two Control Strips: Cloud Firestore Auth + Auto-Fetch Scheduler */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Cloud Firestore Connection Card */}
        <div className="lg:col-span-5 border border-slate-200 bg-slate-50/90 p-5 dark:border-slate-800 dark:bg-slate-900/90 flex flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                {user ? (
                  <>
                    <Cloud className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                    <span>Firestore Cloud Đã Kết Nối</span>
                  </>
                ) : (
                  <>
                    <HardDrive className="h-3.5 w-3.5 text-amber-800 dark:text-amber-400" />
                    <span>Lưu trữ Cục Bộ (Local DB)</span>
                  </>
                )}
              </span>
              {loadingCloud && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />}
            </div>

            {user ? (
              <p className="text-xs text-slate-700 dark:text-slate-300">
                Tài khoản: <strong className="font-semibold">{user.displayName || user.email}</strong> ({user.email})
              </p>
            ) : (
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                Đăng nhập Google để lưu và đồng bộ vĩnh viễn kho tin tức lên cơ sở dữ liệu Firebase Firestore theo tài khoản cá nhân.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {user ? (
              <>
                {localPendingSyncCount > 0 && (
                  <button
                    type="button"
                    disabled={syncing}
                    onClick={handleSyncClick}
                    className="inline-flex items-center gap-1.5 rounded-md bg-amber-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800 dark:bg-amber-500 dark:text-slate-950 cursor-pointer"
                  >
                    {syncing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Cloud className="h-3.5 w-3.5" />
                    )}
                    <span>Đồng bộ {localPendingSyncCount} bài cục bộ lên Cloud</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onSignOutGoogle}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Đăng xuất</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onSignInGoogle}
                className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 cursor-pointer"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Đăng nhập Google (Kết nối Firestore)</span>
              </button>
            )}
          </div>

          {cloudError && (
            <p className="text-xs text-red-700 dark:text-red-400">{cloudError}</p>
          )}
        </div>

        {/* Auto-Fetch Scheduler Control Panel */}
        <div className="lg:col-span-7 border border-slate-200 p-5 dark:border-slate-800 flex flex-col justify-between gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                <Clock className="h-3.5 w-3.5 text-amber-800 dark:text-amber-400" />
                <span>Lịch lấy tin tự động</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Đang theo dõi{' '}
                <button
                  type="button"
                  onClick={onGoToSources}
                  className="font-mono font-semibold text-amber-900 underline underline-offset-4 dark:text-amber-400 cursor-pointer"
                >
                  {enabledSourcesCount} nguồn đang bật
                </button>
                . Bài viết mới tự động được lưu vào Kho Tin.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={autoFetchInterval}
                onChange={(e) =>
                  onChangeInterval(Number(e.target.value) as AutoFetchIntervalMinutes)
                }
                aria-label="Chọn chu kỳ thời gian lấy tin tự động"
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                {INTERVAL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={onToggleAutoFetch}
                className={`rounded-md border px-3.5 py-1.5 text-xs font-medium cursor-pointer whitespace-nowrap transition-colors ${
                  autoFetchEnabled
                    ? 'border-emerald-700 bg-emerald-800 text-white dark:border-emerald-500 dark:bg-emerald-600'
                    : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                }`}
              >
                {autoFetchEnabled ? '✓ Đang bật tự động' : 'Bật lấy tin tự động'}
              </button>

              <button
                type="button"
                disabled={autoFetchRunning || enabledSourcesCount === 0}
                onClick={onTriggerAutoFetchNow}
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 cursor-pointer whitespace-nowrap"
              >
                {autoFetchRunning ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Đang lấy tin...</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    <span>Chạy ngay</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 border-t border-slate-200 pt-3 sm:grid-cols-3 text-xs dark:border-slate-800">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Lượt kế tiếp sau: </span>
              <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {autoFetchEnabled ? formatCountdown(nextAutoFetchAt, nowMs) : 'Đang tạm dừng'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Lần chạy gần nhất: </span>
              <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                {lastAutoFetchAt
                  ? new Intl.DateTimeFormat('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    }).format(new Date(lastAutoFetchAt))
                  : 'Chưa chạy'}
              </span>
            </div>
            <div className="truncate">
              <span className="text-slate-500 dark:text-slate-400">Kết quả: </span>
              <span className="text-slate-800 dark:text-slate-200">
                {lastAutoFetchSummary || 'Sẵn sàng'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-3 text-xs dark:border-slate-800/70">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <ShieldCheck
                className={`h-3.5 w-3.5 ${
                  dedupBotEnabled
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-slate-400'
                }`}
              />
              <span>
                Bot kiểm tra trùng lặp &amp; rà soát cập nhật:{' '}
                <strong className="font-medium text-slate-900 dark:text-slate-100">
                  {dedupBotEnabled ? 'Đang hoạt động' : 'Đang tắt'}
                </strong>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {typeof autoCollectVolatility === 'boolean' && onToggleAutoCollectVolatility && (
                <button
                  type="button"
                  onClick={onToggleAutoCollectVolatility}
                  className={`rounded border px-2 py-0.5 text-[11px] font-medium cursor-pointer transition-colors ${
                    autoCollectVolatility
                      ? 'border-amber-800 bg-amber-900 text-white dark:border-amber-500 dark:bg-amber-500 dark:text-slate-950'
                      : 'border-slate-300 bg-white text-slate-700 hover:border-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                  }`}
                >
                  {autoCollectVolatility
                    ? '✓ Kèm AI quét tin biến động'
                    : '+ Kèm AI quét tin biến động'}
                </button>
              )}
              <button
                type="button"
                onClick={onToggleDedupBot}
                className="text-xs font-medium text-amber-900 hover:underline underline-offset-4 dark:text-amber-400 cursor-pointer"
              >
                {dedupBotEnabled ? 'Tạm tắt Bot' : 'Bật Bot kiểm tra'}
              </button>
              <button
                type="button"
                onClick={() => setSubTab('bot-audit')}
                className="text-xs font-medium text-slate-700 hover:underline underline-offset-4 dark:text-slate-300 cursor-pointer"
              >
                Xem nhật ký Bot →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SUBTAB 1: STORED NEWS DATABASE */}
      {subTab === 'records' && (
        <div className="space-y-6">
          {/* Quantitative Database Strip */}
          <section className="grid grid-cols-2 gap-6 border-t border-b border-slate-200 py-5 lg:grid-cols-4 dark:border-slate-800">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Tổng bài trong Kho</p>
              <p className="mt-1 font-mono text-2xl font-medium tabular-nums text-slate-900 dark:text-slate-100">
                {articles.length}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Chưa đọc / Đã xem</p>
              <p className="mt-1 font-mono text-2xl font-medium tabular-nums text-slate-900 dark:text-slate-100">
                {unreadCount} <span className="text-base text-slate-400">/ {reviewedCount}</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Nguồn báo lưu trữ</p>
              <p className="mt-1 font-mono text-2xl font-medium tabular-nums text-slate-900 dark:text-slate-100">
                {distinctSources}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Tin sắc thái Tích cực</p>
              <p className="mt-1 font-mono text-2xl font-medium tabular-nums text-slate-900 dark:text-slate-100">
                {articles.length > 0 ? Math.round((positiveCount / articles.length) * 100) : 0}%
              </p>
            </div>
          </section>

          {/* Search, Filters, Auto-Tagging & Export Bar */}
          <div className="space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <div className="relative flex-1 min-w-[220px] max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm tiêu đề, nguồn, nhãn hoặc ghi chú..."
                    className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-9 pr-3 text-xs text-slate-900 focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  aria-label="Lọc theo chủ đề"
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <option value="Tất cả">Mọi chủ đề</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>

                <select
                  value={sentimentFilter}
                  onChange={(e) => setSentimentFilter(e.target.value)}
                  aria-label="Lọc theo sắc thái"
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <option value="Tất cả">Mọi sắc thái</option>
                  <option value="Tích cực">Tích cực</option>
                  <option value="Trung lập">Trung lập</option>
                  <option value="Tiêu cực">Tiêu cực</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | StoredArticleStatus)}
                  aria-label="Lọc theo trạng thái đọc"
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <option value="all">Mọi trạng thái</option>
                  <option value="unread">Chưa đọc</option>
                  <option value="reviewed">Đã xem</option>
                  <option value="archived">Lưu trữ</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={bulkTagging || articles.length === 0}
                  onClick={() => void handleRunBulkAutoTag()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-800 bg-amber-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800 disabled:opacity-50 dark:border-amber-500 dark:bg-amber-500 dark:text-slate-950 cursor-pointer whitespace-nowrap"
                >
                  {bulkTagging ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Tags className="h-3.5 w-3.5" />
                  )}
                  <span>Tự động gán nhãn toàn Kho</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowTagRulesPanel((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium cursor-pointer whitespace-nowrap ${
                    showTagRulesPanel
                      ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                      : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                  }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>
                    Quy tắc từ khóa ({tagRules.filter((r) => r.enabled).length}/{tagRules.length})
                  </span>
                </button>
                <button
                  type="button"
                  disabled={filteredArticles.length === 0}
                  onClick={handleExportCsv}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Xuất CSV</span>
                </button>
                <button
                  type="button"
                  disabled={filteredArticles.length === 0}
                  onClick={handleExportJson}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Xuất JSON</span>
                </button>
              </div>
            </div>

            {bulkTagStatusMsg && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50/80 px-3.5 py-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                <span>{bulkTagStatusMsg}</span>
                <button
                  type="button"
                  onClick={() => setBulkTagStatusMsg(null)}
                  aria-label="Đóng thông báo"
                  className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Collapsible Keyword Rule Manager */}
            {showTagRulesPanel && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-4 dark:border-slate-800 dark:bg-slate-900/90">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-700 dark:text-slate-300">
                      Bộ quy tắc tự động gán nhãn theo từ khóa
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                      Hệ thống đối chiếu từ khóa trong tiêu đề &amp; tóm tắt (kèm nhận diện mã cổ phiếu VN) để gắn tối đa 12 nhãn/bài.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleResetDefaultRules}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Khôi phục mặc định</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {tagRules.map((rule) => (
                    <div
                      key={rule.id}
                      className={`flex items-start justify-between gap-2 rounded-xl border p-2.5 text-xs ${
                        rule.enabled
                          ? 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900'
                          : 'border-slate-200 bg-slate-100/60 opacity-65 dark:border-slate-800 dark:bg-[#141210]'
                      }`}
                    >
                      <label className="flex items-start gap-2 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={() => handleToggleRule(rule.id)}
                          className="mt-0.5 h-3.5 w-3.5 accent-amber-900 dark:accent-amber-500 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {rule.tag}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                            {rule.keywords.slice(0, 6).join(', ')}
                            {rule.keywords.length > 6 ? ` (+${rule.keywords.length - 6})` : ''}
                          </p>
                        </div>
                      </label>
                      {rule.isCustom && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomRule(rule.id)}
                          aria-label={`Xóa quy tắc ${rule.tag}`}
                          className="p-0.5 text-slate-400 hover:text-red-700 dark:hover:text-red-400 cursor-pointer shrink-0"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-2 border-t border-slate-200 pt-3 sm:flex-row sm:items-center dark:border-slate-800">
                  <input
                    type="text"
                    value={newRuleTag}
                    onChange={(e) => setNewRuleTag(e.target.value)}
                    placeholder="Tên nhãn mới (vd: Chuỗi cung ứng)..."
                    className="sm:w-56 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <input
                    type="text"
                    value={newRuleKeywords}
                    onChange={(e) => setNewRuleKeywords(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomRule();
                      }
                    }}
                    placeholder="Từ khóa cách nhau bằng dấu phẩy (vd: logistics, cảng biển, vận tải)..."
                    className="flex-1 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    disabled={!newRuleTag.trim() || !newRuleKeywords.trim()}
                    onClick={handleAddCustomRule}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 cursor-pointer whitespace-nowrap"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Thêm quy tắc</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tag Filter Strip */}
            {availableTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-1">
                  <Tags className="h-3 w-3" />
                  <span>Nhãn phân loại:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setTagFilter('Tất cả')}
                  className={`rounded-xl border px-2 py-0.5 text-[11px] font-medium cursor-pointer transition-colors ${
                    tagFilter === 'Tất cả'
                      ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                      : 'border-slate-300 bg-white text-slate-700 hover:border-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                  }`}
                >
                  Tất cả ({articles.length})
                </button>
                {availableTags.slice(0, 20).map(({ tag, count }) => {
                  const active = tagFilter === tag;
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setTagFilter(active ? 'Tất cả' : tag)}
                      className={`rounded-xl border px-2 py-0.5 text-[11px] font-medium cursor-pointer transition-colors ${
                        active
                          ? 'border-amber-800 bg-amber-900 text-white dark:border-amber-500 dark:bg-amber-500 dark:text-slate-950'
                          : 'border-slate-300 bg-slate-50 text-slate-700 hover:border-slate-500 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300'
                      }`}
                    >
                      {tag} <span className="font-mono opacity-75">({count})</span>
                    </button>
                  );
                })}
                {tagFilter !== 'Tất cả' && (
                  <button
                    type="button"
                    onClick={() => setTagFilter('Tất cả')}
                    className="text-[11px] font-medium text-amber-900 hover:underline dark:text-amber-400 cursor-pointer ml-1"
                  >
                    Bỏ lọc nhãn
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Records List */}
          {filteredArticles.length === 0 ? (
            <div className="border border-slate-200 bg-slate-50/50 py-16 px-6 text-center dark:border-slate-800 dark:bg-slate-900/90">
              <h3 className="font-sans tracking-tight text-xl font-semibold text-slate-900 dark:text-slate-100">
                Kho dữ liệu tin tức chưa có bài viết phù hợp
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Hãy bật lịch lấy tin tự động ở trên hoặc qua mục Nguồn trang để lấy bài từ VnExpress RSS, Public APIs và tự động lưu tại đây.
              </p>
              <div className="mt-5 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={onTriggerAutoFetchNow}
                  disabled={enabledSourcesCount === 0 || autoFetchRunning}
                  className="rounded-md bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 cursor-pointer"
                >
                  Lấy tin từ nguồn đang bật ngay
                </button>
                <button
                  type="button"
                  onClick={onGoToSources}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer"
                >
                  Quản lý Nguồn trang
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 border-t border-b border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {filteredArticles.map((art) => {
                const isArchived = art.status === 'archived';
                const artTags = getArticleTags(art);
                return (
                  <article key={art.id} className="py-5 space-y-3">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
                      <div className="lg:col-span-8 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {art.sourceName}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{art.category}</span>
                          <span aria-hidden="true">·</span>
                          <span>{art.fetchedMethod}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {new Intl.DateTimeFormat('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              day: '2-digit',
                              month: '2-digit',
                            }).format(new Date(art.createdAt))}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="text-slate-700 dark:text-slate-300">
                            {art.syncedToCloud ? 'Firestore Cloud' : 'Local DB'}
                          </span>
                        </div>

                        <h3 className="font-sans tracking-tight text-lg font-semibold leading-snug text-slate-900 dark:text-slate-100">
                          <a
                            href={art.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group inline-flex items-baseline gap-1.5 hover:text-amber-900 dark:hover:text-amber-400"
                          >
                            <span>{art.title}</span>
                            <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60 group-hover:opacity-100" />
                          </a>
                        </h3>

                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {art.url}
                        </p>

                        {art.summary && (
                          <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400 line-clamp-2">
                            {art.summary}
                          </p>
                        )}

                        {/* Auto-extracted & editable article tags */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {artTags.map((tag) => {
                            const isFiltered = tagFilter === tag;
                            return (
                              <span
                                key={tag}
                                className={`inline-flex items-center gap-1 rounded-xl border px-2 py-0.5 text-[11px] font-medium ${
                                  isFiltered
                                    ? 'border-amber-800 bg-amber-900 text-white dark:border-amber-500 dark:bg-amber-500 dark:text-slate-950'
                                    : 'border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => setTagFilter(isFiltered ? 'Tất cả' : tag)}
                                  className="hover:underline cursor-pointer"
                                  title={`Lọc theo nhãn "${tag}"`}
                                >
                                  {tag}
                                </button>
                                {!isArchived && (
                                  <button
                                    type="button"
                                    onClick={() => void handleRemoveArticleTag(art, tag)}
                                    aria-label={`Gỡ nhãn ${tag}`}
                                    className="opacity-65 hover:opacity-100 cursor-pointer"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </span>
                            );
                          })}

                          {!isArchived && addingTagForId === art.id ? (
                            <span className="inline-flex items-center gap-1">
                              <input
                                type="text"
                                value={tagDraft}
                                onChange={(e) => setTagDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    void handleAddArticleTag(art);
                                  } else if (e.key === 'Escape') {
                                    setAddingTagForId(null);
                                    setTagDraft('');
                                  }
                                }}
                                placeholder="Nhãn mới..."
                                autoFocus
                                className="w-28 rounded-xl border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                              />
                              <button
                                type="button"
                                onClick={() => void handleAddArticleTag(art)}
                                className="rounded-xl bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-white dark:bg-slate-100 dark:text-slate-900 cursor-pointer"
                              >
                                Lưu
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setAddingTagForId(null);
                                  setTagDraft('');
                                }}
                                className="text-[11px] text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                              >
                                Hủy
                              </button>
                            </span>
                          ) : (
                            !isArchived && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAddingTagForId(art.id);
                                  setTagDraft('');
                                }}
                                className="inline-flex items-center gap-0.5 rounded-xl border border-dashed border-slate-300 px-2 py-0.5 text-[11px] text-slate-500 hover:border-slate-500 hover:text-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                              >
                                <Plus className="h-3 w-3" />
                                <span>Nhãn</span>
                              </button>
                            )
                          )}
                        </div>

                        {art.notes && editingNoteId !== art.id && (
                          <p className="text-xs italic text-amber-900 dark:text-amber-400">
                            Ghi chú: {art.notes}
                          </p>
                        )}

                        {editingNoteId === art.id && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              value={noteDraft}
                              onChange={(e) => setNoteDraft(e.target.value)}
                              placeholder="Nhập ghi chú lưu trữ..."
                              className="flex-1 min-w-[200px] rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                await onUpdateArticle(art.id, { notes: noteDraft });
                                setEditingNoteId(null);
                              }}
                              className="rounded bg-slate-900 px-2.5 py-1 text-xs font-medium text-white dark:bg-slate-100 dark:text-slate-900 cursor-pointer"
                            >
                              Lưu ghi chú
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingNoteId(null)}
                              className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                            >
                              Hủy
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="lg:col-span-4 space-y-3">
                        <SentimentBar
                          sentiment={{
                            positive: art.sentimentPositive,
                            neutral: art.sentimentNeutral,
                            negative: art.sentimentNegative,
                            toneLabel: art.sentimentLabel,
                          }}
                          compact
                        />

                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <select
                            value={art.status}
                            disabled={isArchived}
                            onChange={(e) =>
                              void onUpdateArticle(art.id, {
                                status: e.target.value as StoredArticleStatus,
                              })
                            }
                            aria-label="Trạng thái bài viết"
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                          >
                            <option value="unread">Chưa đọc</option>
                            <option value="reviewed">Đã xem</option>
                            <option value="archived">Lưu trữ</option>
                          </select>

                          {!isArchived && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNoteId(art.id);
                                setNoteDraft(art.notes || '');
                              }}
                              className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              Ghi chú
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() =>
                              onAnalyzeArticleUrl(
                                art.url,
                                art.title,
                                art.sourceName,
                                art.category
                              )
                            }
                            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-800 hover:bg-slate-900 hover:text-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-100 dark:hover:text-slate-900 cursor-pointer whitespace-nowrap"
                          >
                            <FileSearch className="h-3.5 w-3.5" />
                            <span>Phân tích nội dung</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => void onDeleteArticle(art.id)}
                            aria-label="Xóa bài khỏi kho"
                            className="p-1.5 text-slate-400 hover:text-red-700 dark:hover:text-red-400 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: DEDUPLICATION & CONTENT REVISION BOT */}
      {subTab === 'bot-audit' && (
        <div className="space-y-8">
          <div className="flex flex-col gap-4 border border-slate-200 bg-slate-50/90 p-6 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800 dark:bg-slate-900/90">
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                <Bot className="h-4 w-4 text-amber-800 dark:text-amber-400" />
                <span>Cơ chế hoạt động của Bot kiểm tra nội dung</span>
              </div>
              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                Trước mỗi lần lưu bài viết từ RSS hoặc Public API, Bot sẽ chuẩn hóa URL và đối chiếu tương đồng tiêu đề, số liệu và mô tả với toàn bộ Kho Tin. Tin trùng lặp hoàn toàn sẽ bị bỏ qua ngay (tiết kiệm hạn mức API), còn bài viết có cập nhật nội dung mới sẽ tự động ghi đè lên bản ghi cũ thay vì đăng 2 lần.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onToggleDedupBot}
                className={`rounded-md border px-3.5 py-2 text-xs font-medium cursor-pointer whitespace-nowrap ${
                  dedupBotEnabled
                    ? 'border-emerald-700 bg-emerald-800 text-white dark:border-emerald-500 dark:bg-emerald-600'
                    : 'border-slate-300 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                }`}
              >
                {dedupBotEnabled ? '✓ Bot đang bật' : 'Bật Bot kiểm tra'}
              </button>

              <button
                type="button"
                disabled={scanningDb || articles.length === 0}
                onClick={async () => {
                  setScanningDb(true);
                  setScanResultMsg(null);
                  try {
                    const removed = await onScanExistingDuplicates();
                    setScanResultMsg(
                      removed > 0
                        ? `Bot đã phát hiện và dọn sạch ${removed} bài trùng lặp trong Kho Tin.`
                        : 'Kho Tin hiện tại sạch hoàn toàn — không phát hiện bản ghi trùng lặp.'
                    );
                  } finally {
                    setScanningDb(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer whitespace-nowrap"
              >
                {scanningDb ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5" />
                )}
                <span>Quét dọn trùng lặp Kho Tin</span>
              </button>

              {botAuditHistory.length > 0 && (
                <button
                  type="button"
                  onClick={onClearBotAudit}
                  className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Xóa nhật ký
                </button>
              )}
            </div>
          </div>

          {scanResultMsg && (
            <div className="border border-slate-300 bg-white px-4 py-3 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              {scanResultMsg}
            </div>
          )}

          {/* Quantitative Bot Metrics */}
          <section className="grid grid-cols-2 gap-6 border-t border-b border-slate-200 py-5 lg:grid-cols-4 dark:border-slate-800">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Tổng tin Bot đã rà soát</p>
              <p className="mt-1 font-mono text-2xl font-medium tabular-nums text-slate-900 dark:text-slate-100">
                {botSessionStats.totalScanned}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Tin mới được tiếp nhận</p>
              <p className="mt-1 font-mono text-2xl font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
                {botSessionStats.newCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Tin phát hiện cập nhật mới</p>
              <p className="mt-1 font-mono text-2xl font-medium tabular-nums text-amber-800 dark:text-amber-400">
                {botSessionStats.updatedCount}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Tin trùng lặp đã bỏ qua</p>
              <p className="mt-1 font-mono text-2xl font-medium tabular-nums text-slate-700 dark:text-slate-300">
                {botSessionStats.skippedDuplicateCount}
              </p>
            </div>
          </section>

          {/* Decision filter */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Nhật ký rà soát trùng lặp &amp; cập nhật nội dung ({botAuditHistory.length})
            </h3>
            <div className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-900/90">
              {(
                [
                  { id: 'all', label: 'Tất cả' },
                  { id: 'skipped_duplicate', label: 'Đã bỏ qua trùng' },
                  { id: 'updated_content', label: 'Cập nhật nội dung' },
                  { id: 'new', label: 'Tin mới' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setBotDecisionFilter(opt.id)}
                  className={`rounded px-2.5 py-1 text-xs font-medium cursor-pointer whitespace-nowrap ${
                    botDecisionFilter === opt.id
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {botAuditHistory.filter(
            (e) => botDecisionFilter === 'all' || e.decision === botDecisionFilter
          ).length === 0 ? (
            <p className="py-10 text-center text-xs text-slate-500 dark:text-slate-400 border-t border-b border-slate-200 dark:border-slate-800">
              Chưa có bản ghi rà soát nào khớp bộ lọc. Hãy chạy lấy tin tự động hoặc lấy tin trong mục Nguồn trang để Bot hoạt động.
            </p>
          ) : (
            <div className="overflow-x-auto border-t border-b border-slate-200 dark:border-slate-800">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-300 text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <th className="py-3 pr-3 font-medium">Thời gian</th>
                    <th className="py-3 px-3 font-medium">Nguồn</th>
                    <th className="py-3 px-3 font-medium">Bài viết &amp; Lý do của Bot</th>
                    <th className="py-3 px-3 text-right font-medium whitespace-nowrap">Tương đồng</th>
                    <th className="py-3 pl-3 text-right font-medium whitespace-nowrap">Quyết định</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {botAuditHistory
                    .filter(
                      (e) => botDecisionFilter === 'all' || e.decision === botDecisionFilter
                    )
                    .map((entry) => {
                      const decisionLabel =
                        entry.decision === 'skipped_duplicate'
                          ? 'Bỏ qua trùng'
                          : entry.decision === 'updated_content'
                            ? 'Cập nhật mới'
                            : 'Tin mới';
                      const decisionColor =
                        entry.decision === 'skipped_duplicate'
                          ? 'text-slate-500 dark:text-slate-400'
                          : entry.decision === 'updated_content'
                            ? 'text-amber-800 dark:text-amber-400 font-semibold'
                            : 'text-emerald-700 dark:text-emerald-400 font-medium';

                      return (
                        <tr key={entry.id} className="align-top">
                          <td className="py-3 pr-3 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                            {new Intl.DateTimeFormat('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            }).format(new Date(entry.timestamp))}
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            {entry.sourceName}
                          </td>
                          <td className="py-3 px-3">
                            <a
                              href={entry.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-slate-900 hover:text-amber-900 dark:text-slate-100 dark:hover:text-amber-400"
                            >
                              {entry.title}
                            </a>
                            <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                              {entry.reason}
                            </p>
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                            {entry.similarityPercent}%
                          </td>
                          <td className={`py-3 pl-3 text-right whitespace-nowrap ${decisionColor}`}>
                            {decisionLabel}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: API CALL & RATE LIMIT MONITOR */}
      {subTab === 'api-monitor' && (
        <div className="space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-b border-slate-200 py-5 dark:border-slate-800">
            <div className="grid grid-cols-3 gap-8">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Tổng lượt gọi phiên</p>
                <p className="mt-1 font-mono text-2xl font-medium tabular-nums text-slate-900 dark:text-slate-100">
                  {totalApiCalls}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">API đang giám sát</p>
                <p className="mt-1 font-mono text-2xl font-medium tabular-nums text-slate-900 dark:text-slate-100">
                  {apiUsage?.providers.length || 7}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Cảnh báo giới hạn (429)</p>
                <p
                  className={`mt-1 font-mono text-2xl font-medium tabular-nums ${
                    rateLimitedApis > 0
                      ? 'text-amber-800 dark:text-amber-400'
                      : 'text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {rateLimitedApis}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void fetchApiUsage()}
              disabled={loadingUsage}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingUsage ? 'animate-spin' : ''}`} />
              <span>Cập nhật số liệu</span>
            </button>
          </div>

          {/* Per-API Quota Table */}
          <div className="overflow-x-auto border-b border-slate-200 dark:border-slate-800">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-300 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="py-3 pr-4 font-medium">API &amp; Giới hạn quy định</th>
                  <th className="py-3 px-3 font-medium whitespace-nowrap">Cửa sổ hiện tại</th>
                  <th className="py-3 px-3 text-right font-medium whitespace-nowrap">Tổng gọi</th>
                  <th className="py-3 px-3 text-right font-medium whitespace-nowrap">Thành công / 429</th>
                  <th className="py-3 px-3 text-right font-medium whitespace-nowrap">Độ trễ / Mã</th>
                  <th className="py-3 pl-3 text-right font-medium whitespace-nowrap">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {(apiUsage?.providers || []).map((p) => {
                  const pct =
                    p.windowLimit && p.windowLimit > 0
                      ? Math.min(100, Math.round((p.callsInWindow / p.windowLimit) * 100))
                      : 0;
                  return (
                    <tr key={p.id} className="align-top">
                      <td className="py-3.5 pr-4">
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {p.name}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {p.limitDescription}
                        </p>
                      </td>
                      <td className="py-3.5 px-3 w-44">
                        <div className="flex justify-between font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300">
                          <span>
                            {p.callsInWindow}
                            {p.windowLimit ? `/${p.windowLimit}` : ''}
                          </span>
                          <span className="text-slate-400">{p.windowSeconds}s</span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full bg-slate-200 dark:bg-slate-800">
                          <div
                            style={{ width: `${pct}%` }}
                            className={`h-full ${
                              pct >= 85
                                ? 'bg-red-700 dark:bg-red-500'
                                : pct >= 50
                                  ? 'bg-amber-700 dark:bg-amber-500'
                                  : 'bg-emerald-700 dark:bg-emerald-500'
                            }`}
                          />
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono text-xs tabular-nums text-slate-900 dark:text-slate-100">
                        {p.totalCalls}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono text-xs tabular-nums">
                        <span className="text-emerald-700 dark:text-emerald-400">
                          {p.successCalls}
                        </span>
                        <span className="text-slate-400"> / </span>
                        <span
                          className={
                            p.rateLimitedCalls > 0
                              ? 'text-red-700 dark:text-red-400 font-semibold'
                              : 'text-slate-500'
                          }
                        >
                          {p.rateLimitedCalls}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono text-xs tabular-nums text-slate-600 dark:text-slate-400">
                        {p.lastStatus ? `${p.lastStatus} · ${p.lastLatencyMs ?? 0}ms` : '—'}
                      </td>
                      <td className="py-3.5 pl-3 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                        {p.cooldownRemainingSeconds > 0 ? (
                          <span className="text-amber-800 dark:text-amber-400">
                            Chờ {p.cooldownRemainingSeconds}s
                          </span>
                        ) : (
                          <span className="text-emerald-700 dark:text-emerald-400">Sẵn sàng</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Recent API Calls Ledger */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Nhật ký các lần gọi API gần nhất ({apiUsage?.recentCalls.length || 0})
            </h3>
            {!apiUsage || apiUsage.recentCalls.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
                Chưa có lượt gọi API nào được ghi nhận trong phiên hiện tại.
              </p>
            ) : (
              <div className="overflow-x-auto border-t border-b border-slate-200 dark:border-slate-800">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      <th className="py-2 pr-3 font-medium">Thời gian</th>
                      <th className="py-2 px-3 font-medium">API</th>
                      <th className="py-2 px-3 font-medium">Endpoint / Tác vụ</th>
                      <th className="py-2 px-3 text-right font-medium">HTTP</th>
                      <th className="py-2 pl-3 text-right font-medium">Độ trễ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                    {apiUsage.recentCalls.map((call) => (
                      <tr key={call.id}>
                        <td className="py-2 pr-3 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                          {new Intl.DateTimeFormat('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          }).format(new Date(call.timestamp))}
                        </td>
                        <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                          {call.apiName}
                        </td>
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-400 truncate max-w-xs">
                          {call.endpoint}
                          {call.detail ? ` — ${call.detail}` : ''}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-mono tabular-nums ${
                            call.ok
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-red-700 dark:text-red-400 font-semibold'
                          }`}
                        >
                          {call.statusCode}
                        </td>
                        <td className="py-2 pl-3 text-right font-mono tabular-nums text-slate-500 whitespace-nowrap">
                          {call.latencyMs}ms
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
