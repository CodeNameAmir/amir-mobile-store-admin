import {
  Boxes,
  ClipboardList,
  ExternalLink,
  FolderTree,
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

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'فروش و کاتالوگ',
    items: [
      { to: '/', label: 'داشبورد عملکرد', icon: LayoutDashboard },
      { to: '/products', label: 'محصولات', icon: Package },
      { to: '/catalog', label: 'کاتالوگ و مشخصات پایه', icon: FolderTree },
      { to: '/inventory', label: 'انبار و موجودی', icon: Boxes },
      { to: '/orders', label: 'سفارش‌ها', icon: ClipboardList },
    ],
  },
  {
    title: 'کاربران و سامانه',
    items: [
      { to: '/customers', label: 'مشتریان و دسترسی‌ها', icon: Users },
      { to: '/audit-logs', label: 'گزارش رویدادها', icon: History },
      { to: '/settings', label: 'تنظیمات و امنیت', icon: Settings },
    ],
  },
];

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const { pathname } = useRouter();
  const { user, logout } = useAuth();

  const renderContent = (isMobile: boolean) => (
    <div className="flex h-full flex-col bg-white border-l border-black/[0.08]">
      <div className="flex items-center justify-between gap-3 px-4 h-14 border-b border-black/[0.08] shrink-0">
        <Link
          to="/"
          onClick={isMobile ? onCloseMobile : undefined}
          className="flex items-center gap-2.5 min-w-0"
        >
          <div className="h-8 w-8 rounded-lg bg-[#111315] text-white flex items-center justify-center shrink-0">
            <Smartphone className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#111315] truncate">فروشگاه موبایل امیر</p>
            <p className="text-[11px] text-[#7c818c] truncate">کنسول مدیریت</p>
          </div>
        </Link>

        {isMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="بستن منوی ناوبری"
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-[#52565e] hover:bg-[#f1f2f4] transition-colors duration-150"
          >
            <X className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="منوی اصلی مدیریت">
        {NAV_GROUPS.map((group, groupIdx) => (
          <div key={group.title} className={groupIdx > 0 ? 'mt-6' : ''}>
            <p className="px-2.5 mb-2 text-[11px] font-medium text-[#7c818c]">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active =
                  item.to === '/' ? pathname === '/' : pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={isMobile ? onCloseMobile : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-2.5 h-9 px-2.5 rounded-lg text-xs transition-colors duration-150 whitespace-nowrap ${
                      active
                        ? 'bg-[#f1f2f4] text-[#111315] font-semibold border border-black/[0.08]'
                        : 'text-[#52565e] hover:bg-[#f6f6f7] hover:text-[#111315] font-medium border border-transparent'
                    }`}
                  >
                    <span className="w-4 flex items-center justify-center shrink-0">
                      <Icon
                        className={`h-4 w-4 ${active ? 'text-[#0f49bd]' : 'text-[#7c818c]'}`}
                        strokeWidth={1.5}
                        aria-hidden="true"
                      />
                    </span>
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-black/[0.08] space-y-2">
        <a
          href={STOREFRONT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-2 h-8 px-2.5 rounded-lg text-xs font-medium text-[#52565e] hover:bg-[#f1f2f4] hover:text-[#111315] transition-colors duration-150"
        >
          <span>مشاهده فروشگاه</span>
          <ExternalLink className="h-3.5 w-3.5 text-[#7c818c] shrink-0" strokeWidth={1.5} aria-hidden="true" />
        </a>

        <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[#f6f6f7] border border-black/[0.07]">
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#111315] truncate">
              {user?.fullName || 'مدیر فروشگاه'}
            </p>
            <p className="text-[11px] text-[#7c818c] truncate font-mono" dir="ltr">
              {user?.email}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void logout(false)}
            aria-label="خروج از حساب کاربری"
            title="خروج از حساب کاربری"
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-[#52565e] hover:bg-[#fef3f2] hover:text-[#b42318] transition-colors duration-150 shrink-0"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block w-60 shrink-0 sticky top-0 h-screen">
        {renderContent(false)}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-[#111315]/35 backdrop-blur-[2px]"
            aria-hidden="true"
            onClick={onCloseMobile}
          />
          <aside className="relative z-10 w-64 max-w-[85vw] h-full shadow-[0_16px_48px_rgba(17,19,21,0.18)]">
            {renderContent(true)}
          </aside>
        </div>
      )}
    </>
  );
}
