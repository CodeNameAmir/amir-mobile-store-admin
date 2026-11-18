import { useCallback, useEffect, useState } from 'react';
import { Eye, Search } from 'lucide-react';
import type {
  AdminCustomerDetail,
  AdminCustomerSummary,
  UserRole,
} from '../types/admin';
import { adminApi } from '../services/adminApi';
import { ApiError } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useRouter } from '../router';
import {
  formatPersianDateTime,
  formatToman,
  toPersianDigits,
  USER_ROLE_LABELS,
} from '../utils/formatters';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Pagination } from '../components/ui/Pagination';
import { RoleTag } from '../components/ui/StatusBadge';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/ui/StateViews';
import { CustomerDetailDrawer } from '../components/customers/CustomerDetailDrawer';

export function CustomersPage() {
  const { user: currentAdmin, preferences } = useAuth();
  const { searchParams } = useRouter();
  const { pushToast } = useToast();

  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<AdminCustomerSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [customerDetail, setCustomerDetail] = useState<AdminCustomerDetail | null>(null);

  const [roleTarget, setRoleTarget] = useState<{
    customer: AdminCustomerSummary;
    nextRole: UserRole;
  } | null>(null);
  const [updatingRole, setUpdatingRole] = useState(false);

  useEffect(() => {
    const querySearch = searchParams.get('search');
    if (querySearch !== null) {
      setSearch(querySearch);
      setPage(1);
    }
  }, [searchParams]);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listCustomers({
        search: search.trim() || undefined,
        role: roleFilter,
        page,
        pageSize: 12,
      });
      setItems(Array.isArray(res.items) ? res.items : []);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'خطا در دریافت لیست کاربران.');
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, page]);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const openCustomerDrawer = async (id: string) => {
    setDrawerOpen(true);
    setDrawerLoading(true);
    setCustomerDetail(null);
    try {
      const res = await adminApi.getCustomer(id);
      setCustomerDetail(res.customer);
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'خطا در بارگذاری پرونده کاربر',
        description: err instanceof ApiError ? err.message : 'لطفاً دوباره تلاش کنید.',
      });
      setDrawerOpen(false);
    } finally {
      setDrawerLoading(false);
    }
  };

  const handleConfirmRoleChange = async () => {
    if (!roleTarget) return;
    setUpdatingRole(true);
    try {
      const res = await adminApi.updateCustomerRole(roleTarget.customer.id, roleTarget.nextRole);
      setItems((prev) =>
        prev.map((c) => (c.id === res.customer.id ? res.customer : c))
      );
      if (customerDetail && customerDetail.id === res.customer.id) {
        setCustomerDetail((prev) => (prev ? { ...prev, role: res.customer.role } : prev));
      }
      pushToast({
        tone: 'success',
        title: 'سطح دسترسی به‌روزرسانی شد',
        description: `نقش ${res.customer.fullName} به «${USER_ROLE_LABELS[res.customer.role]}» تغییر یافت.`,
      });
      setRoleTarget(null);
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'خطا در تغییر نقش کاربر',
        description: err instanceof ApiError ? err.message : 'تغییر نقش انجام نشد.',
      });
    } finally {
      setUpdatingRole(false);
    }
  };

  const safeItems = Array.isArray(items) ? items : [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#0b1c30]">مدیریت مشتریان و سطح دسترسی</h1>
        <p className="mt-1 text-xs text-[#434655]">
          مشاهده اطلاعات ایمن کاربران، سوابق سفارش‌ها و مدیریت نقش‌های دسترسی (RBAC)
        </p>
      </div>

      <Card padding="sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#737686]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="جستجو با نام، ایمیل یا شماره موبایل..."
              aria-label="جستجوی کاربر"
              className="w-full h-10 pr-9 pl-3 rounded-xl border border-[#c3c6d7] bg-[#f8f9ff] text-xs focus:bg-white focus:outline-none focus:border-[#2563eb]"
            />
          </div>

          <div
            className="flex items-center gap-1 p-1 rounded-xl bg-[#eff4ff]"
            role="group"
            aria-label="فیلتر نقش کاربر"
          >
            {(
              [
                ['all', 'همه کاربران'],
                ['customer', 'مشتریان'],
                ['admin', 'مدیران سیستم'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setRoleFilter(key);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  roleFilter === key
                    ? 'bg-white text-[#004ac6] shadow-sm font-semibold'
                    : 'text-[#434655] hover:text-[#0b1c30]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card padding="md">
        {loading ? (
          <LoadingSkeleton rows={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void loadCustomers()} />
        ) : safeItems.length === 0 ? (
          <EmptyState
            title="کاربری با این مشخصات یافت نشد"
            description="عبارت جستجو یا فیلتر نقش را تغییر دهید."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-[#c3c6d7]/60 text-xs font-semibold text-[#434655]">
                    <th className="py-3 px-3">کاربر</th>
                    <th className="py-3 px-3">ایمیل و موبایل</th>
                    <th className="py-3 px-3">نقش</th>
                    <th className="py-3 px-3">سفارش‌ها و خرید</th>
                    <th className="py-3 px-3">آخرین ورود</th>
                    <th className="py-3 px-3 text-left">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#c3c6d7]/40 text-xs">
                  {safeItems.map((c) => (
                    <tr key={c.id} className="hover:bg-[#f8f9ff] transition-colors">
                      <td className={`${preferences.compactRows ? 'py-2' : 'py-3.5'} px-3`}>
                        <p className="font-bold text-[#0b1c30]">{c.fullName}</p>
                        <p className="text-[11px] text-[#434655]">
                          {c.twoFactorEnabled ? '2FA فعال' : '2FA غیرفعال'}
                        </p>
                      </td>
                      <td className="py-3 px-3">
                        <p className="text-[#0b1c30]" dir="ltr">
                          {c.email}
                        </p>
                        <p className="text-[11px] text-[#434655] tabular-nums-fa">
                          {c.phone ? toPersianDigits(c.phone) : 'بدون موبایل'}
                        </p>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <RoleTag role={c.role} />
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap tabular-nums-fa">
                        <p className="font-bold text-[#0b1c30]">
                          {toPersianDigits(c.ordersCount)} سفارش
                        </p>
                        <p className="text-[11px] text-[#434655]">
                          {formatToman(c.totalSpent)}
                        </p>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-[#434655]">
                        {formatPersianDateTime(c.lastLoginAt)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-left">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void openCustomerDrawer(c.id)}
                          icon={<Eye className="h-3.5 w-3.5" aria-hidden="true" />}
                        >
                          پرونده کاربر
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={12}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      <CustomerDetailDrawer
        open={drawerOpen}
        loading={drawerLoading}
        customer={customerDetail}
        currentAdminId={currentAdmin?.id}
        onClose={() => setDrawerOpen(false)}
        onRequestRoleChange={(customer, nextRole) => setRoleTarget({ customer, nextRole })}
      />

      <ConfirmDialog
        open={Boolean(roleTarget)}
        onClose={() => setRoleTarget(null)}
        onConfirm={() => void handleConfirmRoleChange()}
        loading={updatingRole}
        tone={roleTarget?.nextRole === 'customer' ? 'danger' : 'primary'}
        title="تایید تغییر سطح دسترسی کاربر"
        description={
          roleTarget?.nextRole === 'admin'
            ? `آیا مطمئن هستید که می‌خواهید حساب «${roleTarget.customer.fullName}» (${roleTarget.customer.email}) به مدیر سیستم ارتقا یابد؟`
            : `آیا از لغو دسترسی مدیریت حساب «${roleTarget?.customer.fullName || ''}» اطمینان دارید؟`
        }
        confirmLabel="تایید تغییر نقش"
      />
    </div>
  );
}
