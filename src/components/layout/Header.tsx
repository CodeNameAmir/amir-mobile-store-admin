import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Bell, Menu, Moon, Plus, Search, Sun } from 'lucide-react';
import { useRouter } from '../../router';
import { useAuth } from '../../context/AuthContext';
import { adminApi } from '../../services/adminApi';
import type { AdminNotification } from '../../types/admin';
import { toPersianDigits } from '../../utils/formatters';
import { Button } from '../ui/Button';

interface HeaderProps {
  onOpenMobileMenu: () => void;
}

interface LiveAlertItem {
  id: string;
  title: string;
  description: string;
  link: string;
  isRead: boolean;
  fromApi?: boolean;
}

export function Header({ onOpenMobileMenu }: HeaderProps) {
  const { navigate } = useRouter();
  const { preferences, updatePreferences, isAdmin } = useAuth();
  const [query, setQuery] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const [notifOpen, setNotifOpen] = useState(false);
  const [alerts, setAlerts] = useState<LiveAlertItem[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const notifRef = useRef<HTMLDivElement | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingAlerts(true);
    try {
      const nextAlerts: LiveAlertItem[] = [];
      const [dashRes, apiNotifs] = await Promise.all([
        adminApi.getDashboard(preferences.lowStockThreshold).catch(() => null),
        adminApi
          .listAdminNotifications()
          .then((res) => res.notifications)
          .catch(() => [] as AdminNotification[]),
      ]);

      for (const n of apiNotifs) {
        nextAlerts.push({
          id: n.id,
          title: n.title,
          description: n.description || '',
          link: n.link || '/',
          isRead: n.isRead,
          fromApi: true,
        });
      }

      if (dashRes) {
        if (dashRes.metrics.pendingOrdersCount > 0) {
          nextAlerts.push({
            id: 'live-pending-orders',
            title: `${toPersianDigits(dashRes.metrics.pendingOrdersCount)} سفارش در انتظار پردازش`,
            description: 'سفارش‌های ثبت‌شده آماده بسته‌بندی یا ارسال هستند.',
            link: '/orders',
            isRead: false,
          });
        }
        if (dashRes.metrics.lowStockCount > 0) {
          nextAlerts.push({
            id: 'live-low-stock',
            title: `${toPersianDigits(dashRes.metrics.lowStockCount)} کالا با موجودی کم`,
            description: `موجودی کمتر از آستانه ${toPersianDigits(preferences.lowStockThreshold)} عدد است.`,
            link: '/inventory',
            isRead: false,
          });
        }
      }

      setAlerts(nextAlerts);
    } finally {
      setLoadingAlerts(false);
    }
  }, [isAdmin, preferences.lowStockThreshold]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!notifOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNotifOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [notifOpen]);

  const handleAlertClick = async (alert: LiveAlertItem) => {
    setAlerts((prev) => prev.map((a) => (a.id === alert.id ? { ...a, isRead: true } : a)));
    if (alert.fromApi) {
      void adminApi.markNotificationRead(alert.id).catch(() => undefined);
    }
    setNotifOpen(false);
    navigate(alert.link);
  };

  const handleQuickSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    const encoded = encodeURIComponent(q);
    if (/^(#?AMIR-|09\d{4,}|\d{5,})/i.test(q)) {
      navigate(`/orders?search=${encoded}`);
    } else if (q.includes('@')) {
      const customerQuery =
        q.startsWith('@') && !q.slice(1).includes('@') ? q.slice(1).trim() : q;
      navigate(`/customers?search=${encodeURIComponent(customerQuery)}`);
    } else {
      navigate(`/products?search=${encoded}`);
    }
  };

  const unreadCount = alerts.filter((a) => !a.isRead).length;
  const isDark = preferences.theme === 'dark';

  return (
    <header className="ams-no-print sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-black/[0.08]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="باز کردن منوی ناوبری"
            className="lg:hidden h-9 w-9 inline-flex items-center justify-center rounded-lg border border-black/[0.1] text-[#111315] hover:bg-[#f1f2f4] transition-colors duration-150 shrink-0"
          >
            <Menu className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </button>

          <form
            onSubmit={handleQuickSearch}
            className="hidden sm:block relative flex-1 max-w-sm"
            role="search"
            aria-label="جستجوی سریع در پنل مدیریت"
          >
            <Search
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7c818c]"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجوی محصول، سفارش، نام کاربری یا ایمیل"
              aria-label="جستجوی سریع در محصولات، سفارش‌ها یا مشتریان"
              className="w-full h-9 pr-9 pl-3 rounded-lg bg-[#f6f6f7] border border-black/[0.08] text-xs text-[#111315] placeholder:text-[#7c818c] focus:outline-none focus:border-[#0f49bd] focus:bg-white transition-colors duration-150"
            />
          </form>

          <button
            type="button"
            onClick={() => setMobileSearchOpen((prev) => !prev)}
            aria-expanded={mobileSearchOpen}
            aria-label="جستجوی سریع"
            className="sm:hidden h-9 w-9 inline-flex items-center justify-center rounded-lg border border-black/[0.1] text-[#52565e] hover:bg-[#f1f2f4] hover:text-[#111315] transition-colors duration-150 shrink-0"
          >
            <Search className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => updatePreferences({ theme: isDark ? 'light' : 'dark' })}
            aria-label={isDark ? 'تغییر به تم روشن' : 'تغییر به تم تاریک'}
            title={isDark ? 'تم روشن' : 'تم تاریک'}
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-black/[0.1] text-[#52565e] hover:bg-[#f1f2f4] hover:text-[#111315] transition-colors duration-150"
          >
            {isDark ? (
              <Sun className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            )}
          </button>

          <div ref={notifRef} className="relative">
            <button
              type="button"
              onClick={() => {
                const next = !notifOpen;
                setNotifOpen(next);
                if (next) void loadNotifications();
              }}
              aria-expanded={notifOpen}
              aria-label="مرکز اعلانات مدیریت"
              className="relative h-9 w-9 inline-flex items-center justify-center rounded-lg border border-black/[0.1] text-[#52565e] hover:bg-[#f1f2f4] hover:text-[#111315] transition-colors duration-150"
            >
              <Bell className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -left-1 min-w-[16px] h-4 px-1 rounded-full bg-[#b42318] text-white text-[10px] font-medium flex items-center justify-center tabular-nums-fa">
                  {toPersianDigits(unreadCount)}
                </span>
              )}
            </button>

            {notifOpen && (
              <div
                role="region"
                aria-label="فهرست اعلانات"
                className="absolute left-0 mt-2 w-80 max-w-[90vw] rounded-xl border border-black/[0.12] bg-white shadow-[0_12px_32px_rgba(17,19,21,0.16)] overflow-hidden z-50"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.08] bg-[#f6f6f7]">
                  <p className="text-xs font-semibold text-[#111315]">اعلانات و هشدارهای عملیاتی</p>
                  <button
                    type="button"
                    onClick={() => void loadNotifications()}
                    className="text-[11px] text-[#0f49bd] hover:underline"
                  >
                    به‌روزرسانی
                  </button>
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-black/[0.06]">
                  {loadingAlerts && alerts.length === 0 ? (
                    <p className="p-4 text-xs text-[#52565e]">در حال بررسی هشدارها...</p>
                  ) : alerts.length === 0 ? (
                    <p className="p-4 text-xs text-[#52565e]">همه بخش‌ها در وضعیت عادی است.</p>
                  ) : (
                    alerts.map((alert) => (
                      <button
                        key={alert.id}
                        type="button"
                        onClick={() => void handleAlertClick(alert)}
                        className={`w-full text-right px-4 py-3 hover:bg-[#f7f8fa] transition-colors duration-150 flex items-start gap-2.5 ${
                          alert.isRead ? 'opacity-65' : ''
                        }`}
                      >
                        <span
                          className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                            alert.isRead ? 'bg-[#9aa0ab]' : 'bg-[#0f49bd]'
                          }`}
                          aria-hidden="true"
                        />
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold text-[#111315]">
                            {alert.title}
                          </span>
                          {alert.description && (
                            <span className="block mt-0.5 text-[11px] text-[#52565e]">
                              {alert.description}
                            </span>
                          )}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={() => navigate('/products/new')}
            icon={<Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
          >
            <span className="hidden sm:inline">افزودن محصول</span>
            <span className="sm:hidden">محصول جدید</span>
          </Button>
        </div>
      </div>

      {mobileSearchOpen && (
        <div className="sm:hidden border-t border-black/[0.08] px-4 py-2.5 bg-white">
          <form
            onSubmit={(e) => {
              handleQuickSearch(e);
              setMobileSearchOpen(false);
            }}
            className="relative"
            role="search"
            aria-label="جستجوی سریع موبایل"
          >
            <Search
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7c818c]"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجوی محصول، سفارش، نام کاربری یا ایمیل"
              aria-label="جستجوی سریع موبایل"
              className="w-full h-9 pr-9 pl-3 rounded-lg bg-[#f6f6f7] border border-black/[0.08] text-xs text-[#111315] placeholder:text-[#7c818c] focus:outline-none focus:border-[#0f49bd] focus:bg-white transition-colors duration-150"
            />
          </form>
        </div>
      )}
    </header>
  );
}
