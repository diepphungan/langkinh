import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  FileSearch,
  GitBranch,
  Link2,
  Loader2,
  MessageSquareQuote,
  RefreshCw,
  Scale,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type {
  DeepAnalysisReport,
  LabAskArchiveResponse,
  LabFactCheckCluster,
  LabFactCheckResponse,
  LabMacroRippleResponse,
  StoredNewsArticle,
} from '../types/news';
import { DeepAnalysisCanvas } from './DeepAnalysisCanvas';

interface CustomAnalyzerViewProps {
  initialReport: DeepAnalysisReport | null;
  pendingUrl?: { url: string; nonce: number } | null;
  onSaveReport: (report: DeepAnalysisReport) => void;
  isReportSaved: (id: string) => boolean;
  storedArticles?: StoredNewsArticle[];
  onOpenStockChart?: (symbol: string) => void;
}

type LabMode = 'fact_check' | 'macro_ripple' | 'ask_archive' | 'deep_url';

const MACRO_SCENARIO_CHIPS = [
  'Ngân hàng Nhà nước giữ ổn định hoặc giảm nhẹ lãi suất điều hành',
  'Fed trì hoãn hạ lãi suất, áp lực tỷ giá USD/VND gia tăng',
  'Giá dầu Brent vượt 90 USD/thùng và cước vận tải biển tăng',
  'Kỳ vọng nâng hạng thị trường chứng khoán Việt Nam & dòng vốn ngoại trở lại',
];

const ARCHIVE_QUERY_CHIPS = [
  'Tổng hợp diễn biến lãi suất, tỷ giá và dòng vốn ngoại 90 ngày qua',
  'Những rủi ro và cơ hội nổi bật của nhóm Ngân hàng & Chứng khoán',
  'Xu hướng đầu tư công, hạ tầng và thép trong Kho Tin',
];

export function CustomAnalyzerView({
  initialReport,
  pendingUrl,
  onSaveReport,
  isReportSaved,
  storedArticles = [],
  onOpenStockChart,
}: CustomAnalyzerViewProps) {
  const [labMode, setLabMode] = useState<LabMode>(() =>
    initialReport || pendingUrl ? 'deep_url' : 'fact_check'
  );

  // Mode 1: Multi-source Fact Check & Framing Bias
  const [clusters, setClusters] = useState<LabFactCheckCluster[]>([]);
  const [clustersLoading, setClustersLoading] = useState<boolean>(false);
  const [selectedClusterId, setSelectedClusterId] = useState<string>('');
  const [factCheckCustomInput, setFactCheckCustomInput] = useState<string>('');
  const [factCheckLoading, setFactCheckLoading] = useState<boolean>(false);
  const [factCheckResult, setFactCheckResult] = useState<LabFactCheckResponse | null>(null);
  const [factCheckError, setFactCheckError] = useState<string | null>(null);

  // Mode 2: Macro-to-Ticker Ripple Effect Map
  const [macroScenario, setMacroScenario] = useState<string>(MACRO_SCENARIO_CHIPS[0]);
  const [selectedMacroArticleId, setSelectedMacroArticleId] = useState<string>('');
  const [macroLoading, setMacroLoading] = useState<boolean>(false);
  const [macroResult, setMacroResult] = useState<LabMacroRippleResponse | null>(null);
  const [macroError, setMacroError] = useState<string | null>(null);

  // Mode 3: Ask Archive & Synthesis (RAG over Kho Tin)
  const [archiveQuery, setArchiveQuery] = useState<string>(ARCHIVE_QUERY_CHIPS[0]);
  const [archiveLoading, setArchiveLoading] = useState<boolean>(false);
  const [archiveResult, setArchiveResult] = useState<LabAskArchiveResponse | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  // Mode 4 / Fallback: Direct DeepAnalysisCanvas for links sent from other tabs
  const [urlInput, setUrlInput] = useState<string>('');
  const [deepLoading, setDeepLoading] = useState<boolean>(false);
  const [deepError, setDeepError] = useState<string | null>(null);
  const [deepReport, setDeepReport] = useState<DeepAnalysisReport | null>(initialReport);

  const clientArticlesPayload = useMemo(
    () =>
      storedArticles.slice(0, 100).map((a) => ({
        id: a.id,
        title: a.title,
        summary: a.summary || a.keyTakeaway || '',
        url: a.url,
        sourceName: a.sourceName,
        publishedRelative: a.publishedRelative,
        createdAt: a.createdAt,
        sentimentLabel: a.sentimentLabel,
        tags: a.tags,
      })),
    [storedArticles]
  );

  const loadClusters = useCallback(async () => {
    setClustersLoading(true);
    try {
      const res = await fetch('/api/lab/clusters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articles: clientArticlesPayload }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.clusters)) {
        const list = data.clusters as LabFactCheckCluster[];
        setClusters(list);
        if (list.length > 0 && !selectedClusterId) {
          setSelectedClusterId(list[0].id);
        }
      }
    } catch {
      // ignore initial load error cleanly
    } finally {
      setClustersLoading(false);
    }
  }, [clientArticlesPayload, selectedClusterId]);

  useEffect(() => {
    void loadClusters();
  }, [loadClusters]);

  const runDeepUrlAnalysis = useCallback(async (payload: { url?: string; text?: string; title?: string }) => {
    setDeepLoading(true);
    setDeepError(null);
    try {
      const res = await fetch('/api/news/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể phân tích hồ sơ.');
      setDeepReport(data as DeepAnalysisReport);
    } catch (err) {
      setDeepError(err instanceof Error ? err.message : 'Lỗi phân tích chuyên sâu.');
    } finally {
      setDeepLoading(false);
    }
  }, []);

  useEffect(() => {
    if (pendingUrl?.url) {
      setLabMode('deep_url');
      setUrlInput(pendingUrl.url);
      void runDeepUrlAnalysis({ url: pendingUrl.url });
    }
  }, [pendingUrl?.nonce, pendingUrl?.url, runDeepUrlAnalysis]);

  useEffect(() => {
    if (initialReport) {
      setDeepReport(initialReport);
      setLabMode('deep_url');
    }
  }, [initialReport]);

  const handleRunFactCheck = async (clusterOverride?: LabFactCheckCluster) => {
    const cluster =
      clusterOverride || clusters.find((c) => c.id === selectedClusterId);
    const customTrim = factCheckCustomInput.trim();
    if (!cluster && !customTrim) {
      setFactCheckError('Vui lòng chọn một cụm sự kiện hoặc nhập URL / tiêu đề để kiểm chứng.');
      return;
    }

    setFactCheckLoading(true);
    setFactCheckError(null);
    try {
      const isUrl = /^https?:\/\//i.test(customTrim);
      const res = await fetch('/api/lab/fact-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicTitle: cluster?.topicTitle || (!isUrl ? customTrim : undefined),
          url: isUrl ? customTrim : undefined,
          articles: cluster?.articles,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể kiểm chứng đa nguồn.');
      setFactCheckResult(data as LabFactCheckResponse);
    } catch (err) {
      setFactCheckError(err instanceof Error ? err.message : 'Lỗi kiểm chứng đa nguồn.');
    } finally {
      setFactCheckLoading(false);
    }
  };

  const handleRunMacroRipple = async (e?: FormEvent) => {
    e?.preventDefault();
    const pickedArticle = storedArticles.find((a) => a.id === selectedMacroArticleId);
    const scenarioText = pickedArticle
      ? `${pickedArticle.title}. ${pickedArticle.summary || pickedArticle.keyTakeaway || ''}`
      : macroScenario.trim();

    if (!scenarioText) {
      setMacroError('Vui lòng chọn bài viết vĩ mô từ Kho Tin hoặc nhập kịch bản.');
      return;
    }

    setMacroLoading(true);
    setMacroError(null);
    try {
      const res = await fetch('/api/lab/macro-ripple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarioText,
          sourceArticleTitle: pickedArticle?.title,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể lập bản đồ tác động dây chuyền.');
      setMacroResult(data as LabMacroRippleResponse);
    } catch (err) {
      setMacroError(err instanceof Error ? err.message : 'Lỗi phân tích tác động dây chuyền.');
    } finally {
      setMacroLoading(false);
    }
  };

  const handleRunAskArchive = async (e?: FormEvent, queryOverride?: string) => {
    e?.preventDefault();
    const q = (queryOverride ?? archiveQuery).trim();
    if (!q) return;

    setArchiveLoading(true);
    setArchiveError(null);
    try {
      const res = await fetch('/api/lab/ask-archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          articles: clientArticlesPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể truy vấn Kho Tin.');
      setArchiveResult(data as LabAskArchiveResponse);
    } catch (err) {
      setArchiveError(err instanceof Error ? err.message : 'Lỗi truy vấn Kho Tin.');
    } finally {
      setArchiveLoading(false);
    }
  };

  const macroStoredCandidates = useMemo(
    () =>
      storedArticles
        .filter((a) => {
          const cat = (a.category || '').toLowerCase();
          return (
            cat.includes('kinh') ||
            cat.includes('tài') ||
            cat.includes('thế giới') ||
            (a.tags || []).some((t) =>
              ['Vĩ mô', 'Chứng khoán', 'Ngân hàng', 'Bất động sản', 'Năng lượng'].includes(t)
            )
          );
        })
        .slice(0, 15),
    [storedArticles]
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Intelligence Lab Header & Mode Switcher */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              <FileSearch className="h-3.5 w-3.5" />
              <span>Intelligence Lab · Kết nối Kho Tin ({storedArticles.length} bài) &amp; SSI Live</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Phòng Nghiên cứu &amp; Đối chiếu Chuyên sâu
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Soi độ lệch giữa các tòa soạn, truy vết tác động dây chuyền vĩ mô tới cổ phiếu niêm yết và hỏi đáp trực tiếp trên dữ liệu Kho Tin.
            </p>
          </div>
        </div>

        <div
          className="mt-5 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-4 dark:border-slate-800"
          role="tablist"
          aria-label="Chế độ Phòng Nghiên cứu"
        >
          {(
            [
              {
                id: 'fact_check',
                label: '1. Kiểm chứng Đa nguồn & Độ lệch Báo chí',
                icon: Scale,
              },
              {
                id: 'macro_ripple',
                label: '2. Bản đồ Tác động Dây chuyền tới Cổ phiếu',
                icon: GitBranch,
              },
              {
                id: 'ask_archive',
                label: '3. Hỏi đáp & Tổng hợp Kho Tin',
                icon: BookOpen,
              },
              {
                id: 'deep_url',
                label: 'Hồ sơ URL Chuyên sâu',
                icon: Link2,
              },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = labMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setLabMode(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950'
                    : 'border border-slate-200/80 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ================================================================= */}
      {/* MODE 1: MULTI-SOURCE FACT CHECK & FRAMING BIAS                    */}
      {/* ================================================================= */}
      {labMode === 'fact_check' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          {/* Left: Auto-clustered events from Kho Tin + Custom URL/topic */}
          <section className="lg:col-span-5 rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Cụm Sự kiện Đa nguồn từ Kho Tin
              </h2>
              <button
                type="button"
                onClick={() => void loadClusters()}
                disabled={clustersLoading}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
              >
                <RefreshCw className={`h-3 w-3 ${clustersLoading ? 'animate-spin' : ''}`} />
                <span>Gom cụm lại</span>
              </button>
            </div>

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {clusters.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  Chưa đủ cụm sự kiện trong phiên. Bạn có thể dán URL hoặc nhập chủ đề bên dưới để kiểm chứng ngay.
                </p>
              ) : (
                clusters.map((cl) => {
                  const selected = selectedClusterId === cl.id;
                  return (
                    <div
                      key={cl.id}
                      onClick={() => setSelectedClusterId(cl.id)}
                      className={`rounded-xl border p-3.5 cursor-pointer transition-colors ${
                        selected
                          ? 'border-emerald-500 bg-emerald-50/40 dark:border-emerald-500/70 dark:bg-emerald-950/20'
                          : 'border-slate-200/80 bg-slate-50/60 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                        <span className="text-emerald-700 dark:text-emerald-400">
                          {cl.sources.length} nguồn báo · {cl.articleCount} bài
                        </span>
                        {cl.sharedKeywords.length > 0 && (
                          <span className="text-slate-500 dark:text-slate-400 truncate max-w-[160px]">
                            {cl.sharedKeywords.slice(0, 3).join(', ')}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-1.5 text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug">
                        {cl.topicTitle}
                      </h3>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        Nguồn: {cl.sources.join(' · ')}
                      </p>
                      <div className="mt-2.5 flex justify-end">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedClusterId(cl.id);
                            void handleRunFactCheck(cl);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white hover:bg-slate-800 dark:bg-emerald-500 dark:text-slate-950 cursor-pointer"
                        >
                          <Scale className="h-3 w-3" />
                          <span>Kiểm chứng cụm này</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-slate-100 pt-4 dark:border-slate-800 space-y-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Hoặc dán URL / Chủ đề cụ thể muốn đối chiếu
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={factCheckCustomInput}
                  onChange={(e) => setFactCheckCustomInput(e.target.value)}
                  placeholder="https://... hoặc nhập tên sự kiện"
                  className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
                <button
                  type="button"
                  disabled={factCheckLoading}
                  onClick={() => void handleRunFactCheck()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer shrink-0"
                >
                  {factCheckLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Search className="h-3.5 w-3.5" />
                  )}
                  <span>Kiểm chứng</span>
                </button>
              </div>
            </div>
          </section>

          {/* Right: Fact Check & Framing Bias Output */}
          <section className="lg:col-span-7 rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
            {factCheckError && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200">
                {factCheckError}
              </div>
            )}

            {factCheckLoading ? (
              <div className="py-16 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-600" />
                <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  Đang đối chiếu chéo dữ kiện giữa các tòa soạn...
                </p>
              </div>
            ) : !factCheckResult ? (
              <div className="py-16 text-center space-y-2">
                <Scale className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Sẵn sàng kiểm chứng đa nguồn
                </h3>
                <p className="mx-auto max-w-md text-xs text-slate-500 dark:text-slate-400">
                  Chọn một cụm sự kiện ở cột bên trái và nhấn &ldquo;Kiểm chứng cụm này&rdquo; để bóc tách sự thật lõi, độ lệch góc nhìn giữa các báo và cảnh báo giật tít.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      Hồ sơ Kiểm chứng Đa nguồn · {factCheckResult.verdictLabel}
                    </span>
                    <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                      {factCheckResult.topicHeadline}
                    </h2>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-2 text-center dark:border-emerald-800/60 dark:bg-emerald-950/30 shrink-0">
                    <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                      Độ tin cậy
                    </div>
                    <div className="text-xl font-bold text-emerald-800 dark:text-emerald-300 tabular-nums">
                      {factCheckResult.reliabilityScore}/100
                    </div>
                  </div>
                </div>

                {/* Confirmed Facts */}
                <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                  <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Sự kiện Đã xác nhận Đồng thuận</span>
                  </h3>
                  <ul className="mt-2.5 space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                    {factCheckResult.confirmedFacts.map((fact, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="font-bold text-emerald-600 tabular-nums">0{idx + 1}.</span>
                        <span>{fact}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Outlet Framing Divergences */}
                {factCheckResult.outletDivergences.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Soi Độ lệch Góc nhìn giữa Các Tờ báo
                    </h3>
                    <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {factCheckResult.outletDivergences.map((div, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/60"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {div.outlet}
                            </span>
                            <span className="rounded-md bg-slate-200/80 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {div.framing}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                            {div.keyDifference}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Clickbait / Speculation Warnings */}
                {factCheckResult.clickbaitWarnings.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-800/60 dark:bg-amber-950/20">
                    <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Cảnh báo Giật tít &amp; Điểm cần thận trọng</span>
                    </h3>
                    <ul className="mt-2 space-y-1 text-xs text-amber-900 dark:text-amber-200">
                      {factCheckResult.clickbaitWarnings.map((w, i) => (
                        <li key={i}>• {w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Cited Articles */}
                {factCheckResult.sourcesUsed.length > 0 && (
                  <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Nguồn tham chiếu:
                    </span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {factCheckResult.sourcesUsed.map((ca, idx) => (
                        <a
                          key={idx}
                          href={ca.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-emerald-500 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        >
                          <span>{ca.sourceName}</span>
                          <ArrowUpRight className="h-3 w-3" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODE 2: MACRO-TO-TICKER RIPPLE EFFECT MAP                         */}
      {/* ================================================================= */}
      {labMode === 'macro_ripple' && (
        <div className="space-y-6">
          <form
            onSubmit={handleRunMacroRipple}
            className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-slate-900 space-y-4"
          >
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Chọn bài viết vĩ mô từ Kho Tin (tùy chọn)
                </label>
                <select
                  value={selectedMacroArticleId}
                  onChange={(e) => {
                    setSelectedMacroArticleId(e.target.value);
                    const picked = storedArticles.find((a) => a.id === e.target.value);
                    if (picked) setMacroScenario(picked.title);
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="">-- Nhập kịch bản tự do bên cạnh --</option>
                  {macroStoredCandidates.map((art) => (
                    <option key={art.id} value={art.id}>
                      [{art.sourceName}] {art.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-7">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Sự kiện / Kịch bản Vĩ mô cần truy vết tác động
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={macroScenario}
                    onChange={(e) => {
                      setSelectedMacroArticleId('');
                      setMacroScenario(e.target.value);
                    }}
                    placeholder="VD: SBV giảm lãi suất, giá dầu tăng, Fed giữ nguyên lãi suất..."
                    className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                  <button
                    type="submit"
                    disabled={macroLoading}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-emerald-500 dark:text-slate-950 cursor-pointer shrink-0"
                  >
                    {macroLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <GitBranch className="h-3.5 w-3.5" />
                    )}
                    <span>Vẽ Bản đồ Tác động</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Kịch bản mẫu:
              </span>
              {MACRO_SCENARIO_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => {
                    setSelectedMacroArticleId('');
                    setMacroScenario(chip);
                  }}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>
          </form>

          {macroError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200">
              {macroError}
            </div>
          )}

          {macroLoading ? (
            <div className="rounded-xl border border-slate-200/80 bg-white py-16 text-center shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-600" />
              <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
                Đang lập chuỗi truyền dẫn Vĩ mô → Ngành → Cổ phiếu SSI Live...
              </p>
            </div>
          ) : macroResult ? (
            <div className="space-y-5">
              {/* Macro Thesis + Sector Split */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-slate-900 space-y-4">
                <div>
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    Cơ chế Truyền dẫn Vĩ mô
                  </span>
                  <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
                    {macroResult.scenarioTitle}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    {macroResult.macroThesis}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
                    <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                      <TrendingUp className="h-4 w-4" />
                      <span>Ngành Hưởng Lợi</span>
                    </h3>
                    <div className="mt-2.5 space-y-2">
                      {macroResult.beneficiarySectors.map((sec, i) => (
                        <div key={i} className="text-xs">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {sec.sector} ({sec.impactLevel}):
                          </span>{' '}
                          <span className="text-slate-600 dark:text-slate-300">{sec.mechanism}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-rose-200/80 bg-rose-50/40 p-4 dark:border-rose-900/60 dark:bg-rose-950/20">
                    <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                      <TrendingDown className="h-4 w-4" />
                      <span>Ngành Chịu Áp Lực</span>
                    </h3>
                    <div className="mt-2.5 space-y-2">
                      {macroResult.riskSectors.map((sec, i) => (
                        <div key={i} className="text-xs">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {sec.sector} ({sec.riskLevel}):
                          </span>{' '}
                          <span className="text-slate-600 dark:text-slate-300">{sec.mechanism}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Impacted VN Tickers enriched with live SSI prices */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Cổ phiếu Niêm yết Ảnh hưởng Trực tiếp (Dữ liệu Giá SSI Live)
                </h3>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {macroResult.impactedTickers.map((t) => {
                    const isPositive = t.impact === 'positive';
                    const isNeg = t.impact === 'negative';
                    const impactLabel = isPositive
                      ? 'Hưởng lợi'
                      : isNeg
                        ? 'Chịu áp lực'
                        : 'Đa chiều';
                    return (
                      <div
                        key={t.symbol}
                        className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/50"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="rounded-md bg-slate-900 px-2 py-0.5 text-xs font-bold text-white dark:bg-slate-100 dark:text-slate-950">
                                {t.symbol}
                              </span>
                              <span
                                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                                  isPositive
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : isNeg
                                      ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                      : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                }`}
                              >
                                {impactLabel}
                              </span>
                            </div>

                            {t.price > 0 && (
                              <div className="text-right tabular-nums">
                                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                  {t.price.toLocaleString('vi-VN')} đ
                                </div>
                                <div
                                  className={`text-[11px] font-semibold ${
                                    t.changePct >= 0
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-rose-600 dark:text-rose-400'
                                  }`}
                                >
                                  {t.changePct > 0 ? '+' : ''}
                                  {t.changePct}%
                                </div>
                              </div>
                            )}
                          </div>

                          <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            {t.reason}
                          </p>
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-slate-200/70 pt-2.5 text-xs dark:border-slate-800">
                          <span className="text-[11px] font-medium text-slate-500 tabular-nums">
                            {t.verdict}
                          </span>
                          {onOpenStockChart && (
                            <button
                              type="button"
                              onClick={() => onOpenStockChart(t.symbol)}
                              className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline dark:text-emerald-400 cursor-pointer"
                            >
                              <span>Xem biểu đồ</span>
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ================================================================= */}
      {/* MODE 3: ASK ARCHIVE & SYNTHESIS (RAG OVER KHO TIN)                */}
      {/* ================================================================= */}
      {labMode === 'ask_archive' && (
        <div className="space-y-6">
          <form
            onSubmit={(e) => void handleRunAskArchive(e)}
            className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-slate-900 space-y-4"
          >
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Đặt câu hỏi tổng hợp chuyên đề từ toàn bộ dữ liệu Kho Tin (90 ngày gần nhất)
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={archiveQuery}
                onChange={(e) => setArchiveQuery(e.target.value)}
                placeholder="VD: Tổng hợp nhận định về lãi suất, tỷ giá và triển vọng ngành ngân hàng..."
                className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={archiveLoading}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-emerald-500 dark:text-slate-950 cursor-pointer shrink-0"
              >
                {archiveLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <MessageSquareQuote className="h-3.5 w-3.5" />
                )}
                <span>Tổng hợp Kho Tin</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Gợi ý nghiên cứu:
              </span>
              {ARCHIVE_QUERY_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => {
                    setArchiveQuery(chip);
                    void handleRunAskArchive(undefined, chip);
                  }}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>
          </form>

          {archiveError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200">
              {archiveError}
            </div>
          )}

          {archiveLoading ? (
            <div className="rounded-xl border border-slate-200/80 bg-white py-16 text-center shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-600" />
              <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
                Đang truy xuất Kho Tin và tổng hợp báo cáo có trích dẫn...
              </p>
            </div>
          ) : archiveResult ? (
            <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800/80 dark:bg-slate-900 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Báo cáo Tổng hợp: {archiveResult.question}
                </h2>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                  Truy xuất từ {archiveResult.totalArchiveSearched} bài trong Kho Tin
                </span>
              </div>

              <div className="whitespace-pre-line text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                {archiveResult.executiveAnswer}
              </div>

              {archiveResult.keyFindings.length > 0 && (
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Điểm nhấn Trọng tâm
                  </h3>
                  <ul className="mt-2 space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                    {archiveResult.keyFindings.map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="font-bold text-emerald-600">•</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {archiveResult.citations.length > 0 && (
                <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Nguồn Trích dẫn Gốc ({archiveResult.citations.length})
                  </h3>
                  <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {archiveResult.citations.map((c) => (
                      <div
                        key={c.index}
                        className="flex items-start justify-between gap-2 rounded-lg border border-slate-200/80 bg-slate-50/60 p-3 text-xs dark:border-slate-800 dark:bg-slate-950/50"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                            [{c.index}]
                          </span>{' '}
                          <span className="font-semibold text-slate-900 dark:text-slate-100">
                            {c.title}
                          </span>
                          <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {c.sourceName} · {c.publishedLabel}
                          </div>
                        </div>
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-400 hover:text-emerald-600 shrink-0"
                          aria-label="Mở bài gốc"
                        >
                          <ArrowUpRight className="h-4 w-4" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* ================================================================= */}
      {/* MODE 4: DIRECT DEEP ANALYSIS CANVAS (URL / SAVED REPORT HANDOFF)  */}
      {/* ================================================================= */}
      {labMode === 'deep_url' && (
        <div className="space-y-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (urlInput.trim()) void runDeepUrlAnalysis({ url: urlInput.trim() });
            }}
            className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-slate-900"
          >
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Phân tích chuyên sâu theo đường dẫn bài báo (URL)
            </label>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <input
                type="url"
                required
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://vnexpress.net/... hoặc đường dẫn bài báo quốc tế"
                className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={deepLoading}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-emerald-500 dark:text-slate-950 cursor-pointer shrink-0"
              >
                {deepLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                <span>Lập hồ sơ chuyên sâu</span>
              </button>
            </div>
          </form>

          {deepLoading && (
            <div className="rounded-xl border border-slate-200/80 bg-white py-16 text-center shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-600" />
              <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
                Đang đọc nội dung, đối chiếu nguồn tin và tổng hợp các góc nhìn...
              </p>
            </div>
          )}

          {deepError && !deepLoading && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200">
              {deepError}
            </div>
          )}

          {deepReport && !deepLoading && (
            <DeepAnalysisCanvas
              report={deepReport}
              onToggleSave={onSaveReport}
              isSaved={isReportSaved(deepReport.id)}
            />
          )}
        </div>
      )}
    </main>
  );
}
