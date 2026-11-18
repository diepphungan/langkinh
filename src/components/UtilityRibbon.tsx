import { FormEvent, useEffect, useState } from 'react';
import { CloudSun, Search, X } from 'lucide-react';
import { CATEGORIES } from '../lib/editorialAssets';
import type { NewsCategoryId, WeatherSnapshot } from '../types/news';

interface UtilityRibbonProps {
  selectedCategory: NewsCategoryId;
  onSelectCategory: (cat: NewsCategoryId) => void;
  activeQuery: string;
  onSearchQuery: (q: string) => void;
  generatedAt?: string;
}

const WEATHER_CITIES = [
  { label: 'TP. Hồ Chí Minh', query: 'Ho Chi Minh City' },
  { label: 'Hà Nội', query: 'Hanoi' },
  { label: 'Đà Nẵng', query: 'Da Nang' },
];

export function UtilityRibbon({
  selectedCategory,
  onSelectCategory,
  activeQuery,
  onSearchQuery,
  generatedAt,
}: UtilityRibbonProps) {
  const [draftQuery, setDraftQuery] = useState(activeQuery);
  const [weatherCity, setWeatherCity] = useState(WEATHER_CITIES[0].query);
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);

  useEffect(() => {
    setDraftQuery(activeQuery);
  }, [activeQuery]);

  useEffect(() => {
    let active = true;
    fetch(`/api/weather?city=${encodeURIComponent(weatherCity)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data && typeof data.temperatureC === 'number') {
          setWeather(data as WeatherSnapshot);
        }
      })
      .catch(() => {
        // fail silently for optional weather utility
      });
    return () => {
      active = false;
    };
  }, [weatherCity]);

  const formattedDate = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const formattedTime = generatedAt
    ? new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(generatedAt))
    : null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSearchQuery(draftQuery.trim());
  };

  const handleClear = () => {
    setDraftQuery('');
    onSearchQuery('');
  };

  return (
    <section className="border-b border-slate-200/80 bg-white dark:border-slate-800/80 dark:bg-slate-900/60">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        {/* Date & Weather strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="capitalize font-semibold text-slate-800 dark:text-slate-200">
              {formattedDate}
            </span>
            <span aria-hidden="true">·</span>
            <span>Tòa soạn số &amp; Đối chiếu đa nguồn</span>
            {formattedTime && (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums text-slate-600 dark:text-slate-300">
                  Cập nhật lúc {formattedTime}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <CloudSun className="h-3.5 w-3.5 text-amber-500 shrink-0" aria-hidden="true" />
            <select
              value={weatherCity}
              onChange={(e) => setWeatherCity(e.target.value)}
              aria-label="Chọn thành phố xem thời tiết"
              className="bg-transparent font-medium text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              {WEATHER_CITIES.map((c) => (
                <option key={c.query} value={c.query} className="bg-white dark:bg-slate-900">
                  {c.label}
                </option>
              ))}
            </select>
            {weather && (
              <span className="tabular-nums whitespace-nowrap text-slate-600 dark:text-slate-300">
                {weather.temperatureC}°C · {weather.conditionLabel}
              </span>
            )}
          </div>
        </div>

        {/* Category segmented controls + Search bar */}
        <div className="mt-2.5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div
            className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0"
            role="tablist"
            aria-label="Chuyên mục tin tức"
          >
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id && !activeQuery;
              return (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => {
                    setDraftQuery('');
                    onSelectCategory(cat.id);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                    isSelected
                      ? 'bg-slate-900 text-white dark:bg-emerald-500 dark:text-slate-950'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} className="flex w-full max-w-md items-center gap-2">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="text"
                value={draftQuery}
                onChange={(e) => setDraftQuery(e.target.value)}
                placeholder="Tìm chủ đề cần phân tích (vd: giá vàng, AI, chứng khoán)..."
                aria-label="Tìm chủ đề tin tức"
                className="w-full rounded-lg border border-slate-200/80 bg-slate-50 py-2 pl-9 pr-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-emerald-500"
              />
              {(draftQuery || activeQuery) && (
                <button
                  type="button"
                  onClick={handleClear}
                  aria-label="Xóa từ khóa tìm kiếm"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="rounded-lg border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 whitespace-nowrap shrink-0 cursor-pointer transition-colors"
            >
              Tìm kiếm
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
