import { ArrowUpRight } from 'lucide-react';
import type { NewsDigestResponse, NewsStory } from '../types/news';

interface OverviewTrendsViewProps {
  digest: NewsDigestResponse | null;
  onOpenStory: (story: NewsStory) => void;
  onSearchTopic: (topic: string) => void;
}

export function OverviewTrendsView({
  digest,
  onOpenStory,
  onSearchTopic,
}: OverviewTrendsViewProps) {
  if (!digest || digest.stories.length === 0) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <h2 className="font-sans tracking-tight text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Chưa có dữ liệu toàn cảnh
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Hãy tổng hợp bản tin trước để xem phân tích phân bổ sắc thái và thực thể nổi bật.
        </p>
      </main>
    );
  }

  const stories = digest.stories;
  const count = stories.length;
  const avgPositive = Math.round(
    stories.reduce((acc, s) => acc + s.sentiment.positive, 0) / count
  );
  const avgNeutral = Math.round(
    stories.reduce((acc, s) => acc + s.sentiment.neutral, 0) / count
  );
  const avgNegative = Math.max(0, 100 - avgPositive - avgNeutral);
  const highImpactCount = stories.filter((s) => s.impactLevel === 'Cao').length;

  // Compute category breakdown
  const categoryMap = new Map<
    string,
    { count: number; posSum: number; negSum: number }
  >();
  for (const s of stories) {
    const existing = categoryMap.get(s.category) || { count: 0, posSum: 0, negSum: 0 };
    existing.count += 1;
    existing.posSum += s.sentiment.positive;
    existing.negSum += s.sentiment.negative;
    categoryMap.set(s.category, existing);
  }
  const categoryStats = Array.from(categoryMap.entries()).map(([name, val]) => ({
    name,
    count: val.count,
    avgPos: Math.round(val.posSum / val.count),
    avgNeg: Math.round(val.negSum / val.count),
  }));

  // Compute entity frequency
  const entityMap = new Map<string, number>();
  for (const s of stories) {
    for (const ent of s.keyEntities) {
      entityMap.set(ent, (entityMap.get(ent) || 0) + 1);
    }
  }
  const topEntities = Array.from(entityMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="border-b border-slate-200 pb-6 dark:border-slate-800">
        <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">
          Bảng tổng hợp định lượng phiên tin hiện tại
        </p>
        <h1 className="mt-2 font-sans tracking-tight text-3xl font-semibold text-slate-900 dark:text-slate-100">
          Toàn cảnh sắc thái &amp; thực thể trọng tâm
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Tổng hợp số liệu trực tiếp từ {count} cụm sự kiện vừa thu thập, phản ánh tỷ trọng giọng điệu báo chí, mức độ tác động và các chủ thể xuất hiện nhiều nhất.
        </p>
      </div>

      {/* 4-column structured KPI strip */}
      <section className="grid grid-cols-2 gap-6 border-b border-slate-200 py-8 lg:grid-cols-4 dark:border-slate-800">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Số cụm sự kiện</p>
          <p className="mt-1 font-mono text-3xl font-medium tabular-nums text-slate-900 dark:text-slate-100">
            {count}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Từ {digest.groundingSources.length} nguồn đối chiếu
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Tác động mức Cao</p>
          <p className="mt-1 font-mono text-3xl font-medium tabular-nums text-slate-900 dark:text-slate-100">
            {highImpactCount}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Cần ưu tiên theo dõi diễn biến
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Tỷ trọng Trung lập</p>
          <p className="mt-1 font-mono text-3xl font-medium tabular-nums text-slate-900 dark:text-slate-100">
            {avgNeutral}%
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Giọng điệu thông tin khách quan
          </p>
        </div>

        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Cân bằng Tích cực / Thận trọng</p>
          <p className="mt-1 font-mono text-3xl font-medium tabular-nums text-slate-900 dark:text-slate-100">
            {avgPositive}% / {avgNegative}%
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Trung bình toàn phiên tin
          </p>
        </div>
      </section>

      {/* Two-column Analytics Matrix */}
      <section className="grid grid-cols-1 gap-10 border-b border-slate-200 py-10 lg:grid-cols-12 dark:border-slate-800">
        {/* Category Sentiment Table */}
        <div className="lg:col-span-7">
          <h2 className="font-sans tracking-tight text-xl font-semibold text-slate-900 dark:text-slate-100">
            Phân bổ sắc thái theo lĩnh vực
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-300 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="py-2.5 font-medium">Lĩnh vực</th>
                  <th className="py-2.5 text-right font-medium">Số tin</th>
                  <th className="py-2.5 text-right font-medium">Tích cực</th>
                  <th className="py-2.5 text-right font-medium">Thận trọng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {categoryStats.map((row) => (
                  <tr key={row.name} className="hover:bg-slate-100/60 dark:hover:bg-slate-900/50">
                    <td className="py-3 font-medium text-slate-900 dark:text-slate-100">
                      {row.name}
                    </td>
                    <td className="py-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {row.count}
                    </td>
                    <td className="py-3 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                      {row.avgPos}%
                    </td>
                    <td className="py-3 text-right font-mono tabular-nums text-amber-800 dark:text-amber-400">
                      {row.avgNeg}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Key Entities Index */}
        <div className="lg:col-span-5">
          <h2 className="font-sans tracking-tight text-xl font-semibold text-slate-900 dark:text-slate-100">
            Thực thể &amp; Từ khóa xuất hiện nhiều
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Nhấn vào tên thực thể để tổng hợp dòng tin chuyên biệt.
          </p>
          <div className="mt-4 divide-y divide-slate-200 border-t border-b border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {topEntities.map(([entity, freq]) => (
              <button
                key={entity}
                type="button"
                onClick={() => onSearchTopic(entity)}
                className="flex w-full items-center justify-between py-2.5 text-left text-sm hover:bg-slate-100/60 dark:hover:bg-slate-900/50 px-1 cursor-pointer transition-colors"
              >
                <span className="font-medium text-slate-800 dark:text-slate-200">{entity}</span>
                <span className="font-mono text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {freq} bản tin
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Story Comparison Matrix */}
      <section className="pt-10">
        <h2 className="font-sans tracking-tight text-xl font-semibold text-slate-900 dark:text-slate-100">
          Ma trận đối chiếu sự kiện
        </h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <th className="py-2.5 pr-4 font-medium">Sự kiện</th>
                <th className="py-2.5 px-3 font-medium">Lĩnh vực</th>
                <th className="py-2.5 px-3 font-medium">Mức tác động</th>
                <th className="py-2.5 px-3 font-medium">Giọng điệu chính</th>
                <th className="py-2.5 pl-3 text-right font-medium">Hồ sơ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {stories.map((story) => (
                <tr
                  key={story.id}
                  onClick={() => onOpenStory(story)}
                  className="cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-900/60 transition-colors"
                >
                  <td className="py-3.5 pr-4 font-medium text-slate-900 dark:text-slate-100 max-w-md">
                    {story.title}
                  </td>
                  <td className="py-3.5 px-3 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {story.category}
                  </td>
                  <td className="py-3.5 px-3 text-xs font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                    {story.impactLevel}
                  </td>
                  <td className="py-3.5 px-3 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {story.sentiment.toneLabel}
                  </td>
                  <td className="py-3.5 pl-3 text-right">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-900 dark:text-amber-400 whitespace-nowrap">
                      Mở <ArrowUpRight className="h-3.5 w-3.5" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
