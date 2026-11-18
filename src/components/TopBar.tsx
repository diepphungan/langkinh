import { useState } from 'react';
import { Menu, Moon, RefreshCw, Sun, X } from 'lucide-react';

export type ActiveTab =
  | 'feed'
  | 'finance'
  | 'database'
  | 'pipeline'
  | 'analyzer'
  | 'sources'
  | 'saved';

interface TopBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onRefreshDigest: () => void;
  isRefreshing: boolean;
  isDark: boolean;
  onToggleTheme: () => void;
  savedCount: number;
  databaseCount: number;
  unreadAlertsCount?: number;
}

export function TopBar({
  activeTab,
  onSelectTab,
  onRefreshDigest,
  isRefreshing,
  isDark,
  onToggleTheme,
  savedCount,
  databaseCount,
  unreadAlertsCount = 0,
}: TopBarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { id: ActiveTab; label: string; badgeCount?: number }[] = [
    { id: 'feed', label: 'Bản tin' },
    { id: 'finance', label: 'Tài chính', badgeCount: unreadAlertsCount },
    { id: 'database', label: databaseCount > 0 ? `Kho Tin (${databaseCount})` : 'Kho Tin' },
    { id: 'pipeline', label: 'Tự động hóa' },
    { id: 'analyzer', label: 'Phòng Nghiên cứu' },
    { id: 'sources', label: 'Nguồn trang' },
    { id: 'saved', label: savedCount > 0 ? `Đã lưu (${savedCount})` : 'Đã lưu' },
  ];

  const handleNavClick = (tab: ActiveTab) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/90">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleNavClick('feed')}
          className="flex items-center gap-2.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-lg"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold tracking-tight text-white dark:bg-emerald-500 dark:text-slate-950">
            LK
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Lăng Kính
          </span>
        </button>

        {/* Zone 2: Clean single-row navigation */}
        <nav className="hidden lg:flex items-center gap-1" aria-label="Điều hướng chính">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`relative inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                  isActive
                    ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                    : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <span>{item.label}</span>
                {typeof item.badgeCount === 'number' && item.badgeCount > 0 && (
                  <span
                    className="inline-flex min-w-[18px] items-center justify-center rounded-md bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white tabular-nums"
                    title={`${item.badgeCount} cảnh báo cổ phiếu chưa đọc`}
                  >
                    {item.badgeCount > 99 ? '99+' : item.badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Refresh Action + Light/Dark Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            aria-label={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            title={isDark ? 'Chế độ Sáng' : 'Chế độ Tối'}
          >
            {isDark ? (
              <Sun className="h-4 w-4 text-amber-400" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4 text-slate-600" aria-hidden="true" />
            )}
            <span className="hidden xl:inline">{isDark ? 'Sáng' : 'Tối'}</span>
          </button>

          <button
            type="button"
            onClick={onRefreshDigest}
            disabled={isRefreshing}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-3.5 text-xs font-semibold text-white transition-colors duration-150 hover:bg-slate-800 disabled:opacity-60 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{isRefreshing ? 'Đang cập nhật...' : 'Cập nhật ngay'}</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200/80 bg-white text-slate-700 lg:hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
            aria-label={mobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile navigation drawer */}
      {mobileMenuOpen && (
        <nav
          className="border-t border-slate-200/80 bg-white px-4 py-3 lg:hidden dark:border-slate-800/80 dark:bg-slate-950"
          aria-label="Điều hướng di động"
        >
          <div className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`flex min-h-[42px] items-center justify-between px-3 py-2 text-left text-sm font-semibold rounded-lg ${
                    isActive
                      ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                      : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-900'
                  }`}
                >
                  <span>{item.label}</span>
                  {typeof item.badgeCount === 'number' && item.badgeCount > 0 && (
                    <span className="rounded-md bg-rose-600 px-1.5 py-0.5 text-[11px] font-bold text-white tabular-nums">
                      {item.badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
