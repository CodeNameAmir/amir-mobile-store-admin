import {
  Boxes,
  ClipboardList,
  ExternalLink,
  History,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  Smartphone,
  Users,
  X,
} from 'lucide-react';
import { Link, useRouter } from '../../router';
import { useAuth } from '../../context/AuthContext';
import { STOREFRONT_URL } from '../../config/env';

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'داشبورد و آمار کلیدی', icon: LayoutDashboard },
  { to: '/products', label: 'مدیریت محصولات', icon: Package },
  { to: '/inventory', label: 'موجودی و انبار', icon: Boxes },
  { to: '/orders', label: 'مدیریت سفارش‌ها', icon: ClipboardList },
  { to: '/customers', label: 'مشتریان و دسترسی‌ها', icon: Users },
  { to: '/audit-logs', label: 'گزارش رویدادها', icon: History },
  { to: '/settings', label: 'تنظیمات و امنیت', icon: Settings },
];

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const { pathname } = useRouter();
  const { user, logout } = useAuth();

  const renderContent = (isMobile: boolean) => (
    <div className="flex h-full flex-col bg-white border-l border-[#c3c6d7]/60">
      <div className="flex items-center justify-between gap-3 px-5 py-5 border-b border-[#c3c6d7]/40">
        <Link
          to="/"
          onClick={isMobile ? onCloseMobile : undefined}
          className="flex items-center gap-3 min-w-0"
        >
          <div className="h-10 w-10 rounded-xl bg-[#eff4ff] border border-[#c3c6d7]/60 text-[#004ac6] flex items-center justify-center shrink-0">
            <Smartphone className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#0b1c30] truncate">فروشگاه موبایل امیر</p>
            <p className="text-xs text-[#434655] truncate">پنل مدیریت و انبارداری</p>
          </div>
        </Link>

        {isMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="بستن منوی ناوبری"
            className="h-9 w-9 inline-flex items-center justify-center rounded-xl text-[#434655] hover:bg-[#eff4ff]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="منوی اصلی مدیریت">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active =
            item.to === '/' ? pathname === '/' : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={isMobile ? onCloseMobile : undefined}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-colors whitespace-nowrap ${
                active
                  ? 'bg-[#eff4ff] text-[#004ac6] font-semibold'
                  : 'text-[#434655] hover:bg-[#f8f9ff] hover:text-[#0b1c30] font-medium'
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${active ? 'text-[#004ac6]' : 'text-[#737686]'}`}
                aria-hidden="true"
              />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-[#c3c6d7]/40 space-y-2.5">
        <a
          href={STOREFRONT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium text-[#434655] hover:bg-[#eff4ff] hover:text-[#004ac6] transition-colors"
        >
          <span>مشاهده فروشگاه آنلاین</span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </a>

        <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-[#f8f9ff] border border-[#c3c6d7]/50">
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#0b1c30] truncate">
              {user?.fullName || 'مدیر فروشگاه'}
            </p>
            <p className="text-[11px] text-[#434655] truncate" dir="ltr">
              {user?.email}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void logout(false)}
            aria-label="خروج از حساب کاربری"
            title="خروج از حساب کاربری"
            className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-[#434655] hover:bg-[#ffdad6]/60 hover:text-[#ba1a1a] transition-colors shrink-0"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {renderContent(false)}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-[#0b1c30]/40 backdrop-blur-[2px]"
            aria-hidden="true"
            onClick={onCloseMobile}
          />
          <aside className="relative z-10 w-72 max-w-[85vw] h-full shadow-2xl">
            {renderContent(true)}
          </aside>
        </div>
      )}
    </>
  );
}
