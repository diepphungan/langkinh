import { FormEvent, useEffect, useState } from 'react';
import { Bookmark, BookmarkCheck, Loader2, MessageSquare, Send, Sparkles, X } from 'lucide-react';
import type { DeepAnalysisReport, FollowUpExchange, NewsStory, StoryComment } from '../types/news';
import { EditorialImage } from './EditorialImage';
import { SentimentBar } from './SentimentBar';
import { DeepAnalysisCanvas } from './DeepAnalysisCanvas';

const COMMENTS_STORAGE_KEY = 'langkinh_story_comments_v1';

interface StoryDossierModalProps {
  story: NewsStory | null;
  onClose: () => void;
  onToggleSaveStory: (story: NewsStory) => void;
  isStorySaved: (id: string) => boolean;
  onSaveReport: (report: DeepAnalysisReport) => void;
  isReportSaved: (id: string) => boolean;
}

export function StoryDossierModal({
  story,
  onClose,
  onToggleSaveStory,
  isStorySaved,
  onSaveReport,
  isReportSaved,
}: StoryDossierModalProps) {
  const [deepReport, setDeepReport] = useState<DeepAnalysisReport | null>(null);
  const [analyzingDeep, setAnalyzingDeep] = useState(false);
  const [deepError, setDeepError] = useState<string | null>(null);

  const [questionInput, setQuestionInput] = useState('');
  const [asking, setAsking] = useState(false);
  const [exchanges, setExchanges] = useState<FollowUpExchange[]>([]);
  const [askError, setAskError] = useState<string | null>(null);

  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('base');
  const [commentAuthor, setCommentAuthor] = useState('Độc giả');
  const [commentContent, setCommentContent] = useState('');
  const [commentsByStory, setCommentsByStory] = useState<Record<string, StoryComment[]>>(() => {
    try {
      const raw = localStorage.getItem(COMMENTS_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, StoryComment[]>) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    setDeepReport(null);
    setDeepError(null);
    setExchanges([]);
    setAskError(null);
    setQuestionInput('');
  }, [story?.id]);

  useEffect(() => {
    if (!story) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [story, onClose]);

  if (!story) return null;

  const saved = isStorySaved(story.id);

  const handleRunDeepAnalysis = async () => {
    setAnalyzingDeep(true);
    setDeepError(null);
    try {
      const res = await fetch('/api/news/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: story.title,
          topicContext: `${story.deck}\n\n${story.contextSummary}\n\nCác điểm chính: ${story.executiveTakeaways.join(' | ')}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể chạy phân tích chuyên sâu.');
      }
      setDeepReport(data as DeepAnalysisReport);
    } catch (err) {
      setDeepError(err instanceof Error ? err.message : 'Lỗi phân tích chuyên sâu.');
    } finally {
      setAnalyzingDeep(false);
    }
  };

  const askFollowUp = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed) return;
    setAsking(true);
    setAskError(null);
    try {
      const res = await fetch('/api/news/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyTitle: story.title,
          storyContext: `${story.deck} ${story.contextSummary}`,
          question: trimmed,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể trả lời câu hỏi.');
      }
      setExchanges((prev) => [...prev, data as FollowUpExchange]);
      setQuestionInput('');
    } catch (err) {
      setAskError(err instanceof Error ? err.message : 'Lỗi kết nối giải đáp.');
    } finally {
      setAsking(false);
    }
  };

  const handleAskSubmit = (e: FormEvent) => {
    e.preventDefault();
    askFollowUp(questionInput);
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dossier-title"
      onClick={onClose}
    >
      <div
        className="mx-auto my-4 max-w-6xl bg-slate-50 shadow-2xl sm:my-8 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Action Bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-6 py-3.5 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/95">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 truncate">
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {story.category}
            </span>
            <span aria-hidden="true">·</span>
            <span>{story.publishedRelative}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{story.readTimeMinutes} phút đọc</span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Font size adjustment */}
            <div
              className="hidden sm:inline-flex items-center rounded border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900"
              role="group"
              aria-label="Điều chỉnh cỡ chữ đọc bài"
            >
              {(
                [
                  { id: 'sm', label: 'A-' },
                  { id: 'base', label: 'A' },
                  { id: 'lg', label: 'A+' },
                ] as const
              ).map((sz) => (
                <button
                  key={sz.id}
                  type="button"
                  onClick={() => setFontSize(sz.id)}
                  className={`px-2 py-1 text-xs font-medium cursor-pointer ${
                    fontSize === sz.id
                      ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {sz.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => onToggleSaveStory(story)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100 cursor-pointer"
            >
              {saved ? (
                <>
                  <BookmarkCheck className="h-4 w-4 text-amber-800 dark:text-amber-400" />
                  <span>Đã lưu</span>
                </>
              ) : (
                <>
                  <Bookmark className="h-4 w-4" />
                  <span>Lưu tin</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng hồ sơ"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-8 sm:px-10">
          {deepReport ? (
            <div className="space-y-8">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
                <span className="text-xs font-medium text-amber-900 dark:text-amber-400">
                  Đang xem Hồ sơ Kiểm chứng &amp; Phân tích Chuyên sâu
                </span>
                <button
                  type="button"
                  onClick={() => setDeepReport(null)}
                  className="text-xs font-medium text-slate-600 underline underline-offset-4 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer"
                >
                  Quay lại bản tóm tắt nhanh
                </button>
              </div>
              <DeepAnalysisCanvas
                report={deepReport}
                onToggleSave={onSaveReport}
                isSaved={isReportSaved(deepReport.id)}
                onSelectQuestion={(q) => askFollowUp(q)}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
              {/* Left 70% Narrative */}
              <div className="lg:col-span-8 space-y-8">
                <div>
                  <h1
                    id="dossier-title"
                    className="font-sans tracking-tight text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl dark:text-slate-100"
                  >
                    {story.title}
                  </h1>
                  <p className="mt-3 text-lg leading-relaxed text-slate-600 dark:text-slate-300">
                    {story.deck}
                  </p>
                </div>

                <EditorialImage
                  desk={story.visualDesk}
                  alt={story.title}
                  aspectClass="aspect-[16/9]"
                />

                <section>
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Bối cảnh &amp; Diễn biến chính
                  </h2>
                  <p
                    className={`mt-3 leading-relaxed text-slate-800 dark:text-slate-200 max-w-prose ${
                      fontSize === 'sm'
                        ? 'text-sm'
                        : fontSize === 'lg'
                        ? 'text-[17px]'
                        : 'text-[15px]'
                    }`}
                  >
                    {story.contextSummary}
                  </p>
                </section>

                {story.executiveTakeaways.length > 0 && (
                  <section className="border-t border-slate-200 pt-6 dark:border-slate-800">
                    <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Điểm cốt lõi cần nắm
                    </h2>
                    <ul className="mt-4 space-y-3 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                      {story.executiveTakeaways.map((point, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <span className="font-mono text-xs text-slate-400 pt-0.5 tabular-nums">
                            0{idx + 1}.
                          </span>
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {story.perspectives.length > 0 && (
                  <section className="border-t border-slate-200 pt-6 dark:border-slate-800">
                    <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Đa góc nhìn các bên liên quan
                    </h2>
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {story.perspectives.map((p, idx) => (
                        <div
                          key={idx}
                          className="border border-slate-200 bg-slate-50/90 p-4 dark:border-slate-800 dark:bg-slate-900/90"
                        >
                          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {p.actor}
                          </p>
                          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                            {p.stance}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              {/* Right 30% Margin Rail */}
              <aside className="lg:col-span-4 space-y-6">
                <div className="border border-slate-200 bg-slate-50/90 p-5 dark:border-slate-800 dark:bg-slate-900/90">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Sắc thái đưa tin
                  </h3>
                  <div className="mt-4">
                    <SentimentBar sentiment={story.sentiment} />
                  </div>
                  <div className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400 flex justify-between">
                    <span>Mức độ tác động</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {story.impactLevel}
                    </span>
                  </div>
                </div>

                {/* Deep Analysis Trigger */}
                <div className="border border-slate-200 p-5 dark:border-slate-800">
                  <h3 className="font-sans tracking-tight text-lg font-semibold text-slate-900 dark:text-slate-100">
                    Kiểm chứng &amp; Dự báo sâu
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    Đối chiếu dữ kiện qua nhiều nguồn độc lập và lập ma trận tác động ngắn hạn / dài hạn.
                  </p>
                  <button
                    type="button"
                    onClick={handleRunDeepAnalysis}
                    disabled={analyzingDeep}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 cursor-pointer"
                  >
                    {analyzingDeep ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Đang đối chiếu nguồn...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Phân tích kiểm chứng chuyên sâu</span>
                      </>
                    )}
                  </button>
                  {deepError && (
                    <p className="mt-2 text-xs text-red-700 dark:text-red-400">{deepError}</p>
                  )}
                </div>

                {story.keyEntities.length > 0 && (
                  <div className="border border-slate-200 p-5 dark:border-slate-800">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Thực thể liên quan
                    </h3>
                    <p className="mt-2.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                      {story.keyEntities.join(' · ')}
                    </p>
                  </div>
                )}

                {story.sourceOutlets.length > 0 && (
                  <div className="border border-slate-200 p-5 dark:border-slate-800">
                    <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Cơ quan báo chí ghi nhận
                    </h3>
                    <p className="mt-2.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                      {story.sourceOutlets.join(' · ')}
                    </p>
                  </div>
                )}
              </aside>
            </div>
          )}

          {/* Interactive Follow-up Q&A */}
          <section className="mt-10 border-t border-slate-200 pt-8 dark:border-slate-800">
            <h2 className="font-sans tracking-tight text-xl font-semibold text-slate-900 dark:text-slate-100">
              Hỏi đáp &amp; Tra cứu bổ sung về sự kiện
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Đặt câu hỏi cụ thể về hệ quả thị trường, bối cảnh lịch sử hoặc số liệu liên quan.
            </p>

            {exchanges.length > 0 && (
              <div className="mt-5 space-y-4">
                {exchanges.map((ex, idx) => (
                  <div
                    key={idx}
                    className="border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/90"
                  >
                    <p className="text-xs font-semibold text-amber-900 dark:text-amber-400">
                      Hỏi: {ex.question}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-line">
                      {ex.answer}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleAskSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                placeholder="Ví dụ: Sự kiện này tác động như thế nào đến doanh nghiệp trong nước?"
                aria-label="Câu hỏi bổ sung về bản tin"
                className="flex-1 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-200"
              />
              <button
                type="submit"
                disabled={asking || !questionInput.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-5 py-2.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {asking ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Đang tra cứu</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    <span>Gửi câu hỏi</span>
                  </>
                )}
              </button>
            </form>
            {askError && (
              <p className="mt-2 text-xs text-red-700 dark:text-red-400">{askError}</p>
            )}
          </section>

          {/* Reader Notes & Comments */}
          <section className="mt-10 border-t border-slate-200 pt-8 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-slate-500" />
              <h2 className="font-sans tracking-tight text-xl font-semibold text-slate-900 dark:text-slate-100">
                Bình luận &amp; Ghi chú độc giả ({(commentsByStory[story.id] || []).length})
              </h2>
            </div>

            {(commentsByStory[story.id] || []).length > 0 && (
              <div className="mt-4 divide-y divide-slate-200 border-t border-b border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {(commentsByStory[story.id] || []).map((c) => (
                  <div key={c.id} className="py-3.5">
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {c.author}
                      </span>
                      <span className="font-mono tabular-nums">
                        {new Intl.DateTimeFormat('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          day: '2-digit',
                          month: '2-digit',
                        }).format(new Date(c.createdAt))}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                      {c.content}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!commentContent.trim()) return;
                const newComment: StoryComment = {
                  id: `cmt-${Date.now()}`,
                  author: commentAuthor.trim() || 'Độc giả',
                  content: commentContent.trim(),
                  createdAt: new Date().toISOString(),
                };
                const updated = {
                  ...commentsByStory,
                  [story.id]: [newComment, ...(commentsByStory[story.id] || [])],
                };
                setCommentsByStory(updated);
                try {
                  localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(updated));
                } catch {
                  // ignore
                }
                setCommentContent('');
              }}
              className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-12"
            >
              <input
                type="text"
                value={commentAuthor}
                onChange={(e) => setCommentAuthor(e.target.value)}
                placeholder="Tên của bạn"
                aria-label="Tên người bình luận"
                className="sm:col-span-3 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <input
                type="text"
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                placeholder="Viết nhận định hoặc ghi chú cho bài viết này..."
                aria-label="Nội dung bình luận"
                className="sm:col-span-7 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={!commentContent.trim()}
                className="sm:col-span-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
              >
                Gửi ghi chú
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
