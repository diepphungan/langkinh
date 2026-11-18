import { Bookmark, BookmarkCheck, CheckCircle2, Clock, ExternalLink, HelpCircle, Scale } from 'lucide-react';
import type { DeepAnalysisReport } from '../types/news';
import { SentimentBar } from './SentimentBar';

interface DeepAnalysisCanvasProps {
  report: DeepAnalysisReport;
  onToggleSave?: (report: DeepAnalysisReport) => void;
  isSaved?: boolean;
  onSelectQuestion?: (question: string) => void;
}

export function DeepAnalysisCanvas({
  report,
  onToggleSave,
  isSaved = false,
  onSelectQuestion,
}: DeepAnalysisCanvasProps) {
  const statusIcon = (status: string) => {
    if (status === 'Đã xác thực') {
      return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />;
    }
    if (status === 'Cần đối chiếu') {
      return <Scale className="h-3.5 w-3.5 text-amber-800 dark:text-amber-400 shrink-0" />;
    }
    return <HelpCircle className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0" />;
  };

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
      {/* 70% Main Analytical Narrative */}
      <div className="lg:col-span-8 space-y-8">
        <header className="border-b border-slate-200 pb-6 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Hồ sơ phân tích chuyên sâu
            </span>
            {onToggleSave && (
              <button
                type="button"
                onClick={() => onToggleSave(report)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100 cursor-pointer"
              >
                {isSaved ? (
                  <>
                    <BookmarkCheck className="h-4 w-4 text-amber-800 dark:text-amber-400" />
                    <span>Đã lưu hồ sơ</span>
                  </>
                ) : (
                  <>
                    <Bookmark className="h-4 w-4" />
                    <span>Lưu hồ sơ phân tích</span>
                  </>
                )}
              </button>
            )}
          </div>

          <h2 className="mt-3 font-sans tracking-tight text-2xl font-semibold leading-snug text-slate-900 sm:text-3xl dark:text-slate-100">
            {report.headline}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            {report.sourceSummary}
          </p>
        </header>

        {/* Executive Summary */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            01. Tóm tắt điều hành
          </h3>
          <ul className="mt-4 space-y-3 text-[15px] leading-relaxed text-slate-800 dark:text-slate-200 max-w-prose">
            {report.executiveSummary.map((item, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <span className="font-mono text-xs text-slate-400 pt-1 tabular-nums">
                  0{idx + 1}.
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Multi-Perspective Comparison */}
        {report.perspectives.length > 0 && (
          <section className="border-t border-slate-200 pt-8 dark:border-slate-800">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              02. Đối chiếu đa góc nhìn &amp; Lập trường
            </h3>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {report.perspectives.map((p, idx) => (
                <div
                  key={idx}
                  className="border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/90"
                >
                  <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {p.stakeholder}
                  </p>
                  <p className="mt-0.5 text-xs text-amber-900 dark:text-amber-400">
                    {p.framing}
                  </p>
                  <p className="mt-2.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {p.summary}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Fact-Check & Claims */}
        {report.factChecks.length > 0 && (
          <section className="border-t border-slate-200 pt-8 dark:border-slate-800">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              03. Kiểm chứng dữ kiện &amp; Bối cảnh
            </h3>
            <div className="mt-4 divide-y divide-slate-200 border-t border-b border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {report.factChecks.map((fc, idx) => (
                <div key={idx} className="py-4 space-y-1.5">
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {fc.claim}
                    </p>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap shrink-0">
                      {statusIcon(fc.status)}
                      <span>{fc.status}</span>
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {fc.context}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Impact Horizon */}
        <section className="border-t border-slate-200 pt-8 dark:border-slate-800">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            04. Dự báo tác động theo chu kỳ
          </h3>
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                <Clock className="h-3.5 w-3.5 text-slate-500" />
                <span>Ngắn hạn (1–3 tháng)</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {report.impactHorizon.shortTerm}
              </p>
            </div>
            <div className="border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                <Clock className="h-3.5 w-3.5 text-slate-500" />
                <span>Trung &amp; Dài hạn (6–24 tháng)</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {report.impactHorizon.longTerm}
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* 30% Margin Notes Sidebar */}
      <aside className="lg:col-span-4 space-y-6">
        <div className="border border-slate-200 bg-slate-50/90 p-5 dark:border-slate-800 dark:bg-slate-900/90">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Phân tích sắc thái &amp; Khách quan
          </h3>
          <div className="mt-4">
            <SentimentBar sentiment={report.sentiment} />
          </div>
          <p className="mt-4 border-t border-slate-200 pt-3 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:text-slate-400">
            {report.sentiment.objectivityNote}
          </p>
        </div>

        {report.impactHorizon.affectedSectors.length > 0 && (
          <div className="border border-slate-200 p-5 dark:border-slate-800">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Lĩnh vực chịu tác động
            </h3>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-800 dark:text-slate-200">
              {report.impactHorizon.affectedSectors.map((sector, idx) => (
                <li key={idx} className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-400 tabular-nums">
                    {idx + 1}.
                  </span>
                  <span>{sector}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {report.editorialQuestions.length > 0 && (
          <div className="border border-slate-200 p-5 dark:border-slate-800">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Câu hỏi mở cần theo dõi
            </h3>
            <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
              {report.editorialQuestions.map((q, idx) => (
                <li key={idx}>
                  {onSelectQuestion ? (
                    <button
                      type="button"
                      onClick={() => onSelectQuestion(q)}
                      className="text-left hover:text-amber-900 dark:hover:text-amber-400 underline-offset-4 hover:underline cursor-pointer"
                    >
                      {q}
                    </button>
                  ) : (
                    <span>{q}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {report.groundingSources.length > 0 && (
          <div className="border border-slate-200 p-5 dark:border-slate-800">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
              Nguồn đối chiếu ({report.groundingSources.length})
            </h3>
            <ul className="mt-3 divide-y divide-slate-200/80 dark:divide-slate-800/80">
              {report.groundingSources.map((src) => (
                <li key={src.uri} className="py-2">
                  <a
                    href={src.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 text-xs text-slate-700 hover:text-amber-900 dark:text-slate-300 dark:hover:text-amber-400"
                  >
                    <span className="truncate">{src.title}</span>
                    <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
