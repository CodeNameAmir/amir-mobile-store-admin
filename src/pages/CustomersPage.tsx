import { useCallback, useEffect, useState } from 'react';
import { Download, Eye, EyeOff, Lock, Search } from 'lucide-react';
import type {
  AdminCustomerDetail,
  AdminCustomerSummary,
  RbacRole,
  UserRole,
} from '../types/admin';
import { adminApi } from '../services/adminApi';
import { fetchWithDedupe, getCachedValue } from '../services/adminCache';
import { ApiError } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useRouter } from '../router';
import {
  downloadCsvFile,
  formatPersianDateTime,
  formatToman,
  toPersianDigits,
  USER_ROLE_LABELS,
} from '../utils/formatters';
import { buildCustomersCsv, classifyCustomerSegment } from '../utils/crmAndSla';
import { maskEmail, maskPhone } from '../utils/masking';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Pagination } from '../components/ui/Pagination';
import { RoleTag, StatusTag } from '../components/ui/StatusBadge';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/ui/StateViews';
import { CustomerDetailDrawer } from '../components/customers/CustomerDetailDrawer';
import { RbacRolesPanel } from '../components/rbac/RbacRolesPanel';

export function CustomersPage() {
  const { user: currentAdmin, preferences, can, canViewFullPii } = useAuth();
  const { searchParams } = useRouter();
  const { pushToast } = useToast();

  const [search, setSearch] = useState(() => searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(() => searchParams.get('search') || '');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [page, setPage] = useState(1);
  const [revealPii, setRevealPii] = useState(false);

  const [items, setItems] = useState<AdminCustomerSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [availableRoles, setAvailableRoles] = useState<RbacRole[]>([]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [customerDetail, setCustomerDetail] = useState<AdminCustomerDetail | null>(null);

  const [roleTarget, setRoleTarget] = useState<{
    customer: AdminCustomerSummary;
    nextRole: UserRole;
  } | null>(null);
  const [updatingRole, setUpdatingRole] = useState(false);

  const [statusTarget, setStatusTarget] = useState<{
    customer: AdminCustomerSummary;
    nextBlocked: boolean;
  } | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const canManageAdmins = can('admins.manage');
  const canUpdateCustomerStatus = can('customers.update') || canManageAdmins;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const querySearch = searchParams.get('search');
    if (querySearch !== null) {
      setSearch(querySearch);
      setDebouncedSearch(querySearch);
      setPage(1);
    }
  }, [searchParams]);

  useEffect(() => {
    void adminApi
      .listRoles()
      .then((res) => setAvailableRoles(Array.isArray(res.roles) ? res.roles : []))
      .catch(() => setAvailableRoles([]));
  }, []);

  const loadCustomers = useCallback(
    async (forceRefresh = false) => {
      const cacheKey = `customers:${debouncedSearch.trim()}:${roleFilter}:${page}`;
      const cached = !forceRefresh
        ? getCachedValue<{
            items: AdminCustomerSummary[];
            total: number;
            totalPages: number;
          }>(cacheKey)
        : null;

      if (cached) {
        setItems(Array.isArray(cached.data.items) ? cached.data.items : []);
        setTotal(cached.data.total);
        setTotalPages(cached.data.totalPages);
        setLoading(false);
        setError(null);
        if (cached.isFresh) return;
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const res = await fetchWithDedupe(cacheKey, () =>
          adminApi.listCustomers({
            search: debouncedSearch.trim() || undefined,
            role: roleFilter,
            page,
            pageSize: 12,
          })
        );
        setItems(Array.isArray(res.items) ? res.items : []);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      } catch (err) {
        if (!cached) {
          setError(err instanceof ApiError ? err.message : 'خطا در دریافت لیست کاربران.');
        }
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, roleFilter, page]
  );

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const handleToggleRevealPii = () => {
    if (!canViewFullPii) return;
    const next = !revealPii;
    setRevealPii(next);
    if (next) {
      void adminApi.recordSensitiveAccess({
        targetType: 'customer_list',
        targetId: `page-${page}`,
        field: 'phone_and_email',
      });
    }
  };

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

  const handleConfirmStatusChange = async () => {
    if (!statusTarget) return;
    setUpdatingStatus(true);
    try {
      const res = await adminApi.updateCustomerStatus(statusTarget.customer.id, {
        isBlocked: statusTarget.nextBlocked,
        isActive: !statusTarget.nextBlocked,
      });
      setItems((prev) =>
        prev.map((c) => (c.id === res.customer.id ? res.customer : c))
      );
      if (customerDetail && customerDetail.id === res.customer.id) {
        setCustomerDetail((prev) =>
          prev
            ? {
                ...prev,
                isBlocked: res.customer.isBlocked,
                isActive: res.customer.isActive,
              }
            : prev
        );
      }
      pushToast({
        tone: 'success',
        title: statusTarget.nextBlocked ? 'حساب کاربر مسدود شد' : 'حساب کاربر فعال شد',
        description: `وضعیت حساب «${res.customer.fullName}» در سرور ثبت شد.`,
      });
      setStatusTarget(null);
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'خطا در تغییر وضعیت حساب',
        description:
          err instanceof ApiError
            ? err.message
            : 'در صورت عدم پشتیبانی مسیر /status در Backend، این قابلیت پس از به‌روزرسانی سرور فعال می‌شود.',
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAssignRbacRoles = async (customerId: string, roleIds: string[]) => {
    const res = await adminApi.assignCustomerRoles(customerId, roleIds);
    if (res.customer) {
      setItems((prev) => prev.map((c) => (c.id === customerId ? res.customer! : c)));
      setCustomerDetail((prev) =>
        prev && prev.id === customerId
          ? {
              ...prev,
              roles: res.customer?.roles ?? res.roles ?? prev.roles,
            }
          : prev
      );
    } else {
      const refreshed = await adminApi.getCustomer(customerId).catch(() => null);
      if (refreshed) {
        setCustomerDetail(refreshed.customer);
        setItems((prev) =>
          prev.map((c) => (c.id === customerId ? { ...c, roles: refreshed.customer.roles } : c))
        );
      }
    }
    pushToast({
      tone: 'success',
      title: 'نقش‌های RBAC کاربر ذخیره شد',
      description: 'ماتریس دسترسی کاربر در سامانه به‌روزرسانی شد.',
    });
  };

  const safeItems = Array.isArray(items) ? items : [];
  const showFullPii = canViewFullPii && revealPii;

  const handleExportCustomersCsv = () => {
    const csv = buildCustomersCsv(safeItems, showFullPii);
    downloadCsvFile(
      `ams-customers-${new Date().toISOString().slice(0, 10)}.csv`,
      csv
    );
    pushToast({
      tone: 'success',
      title: 'خروجی CSV مشتریان دانلود شد',
      description: showFullPii
        ? 'شامل اطلاعات کامل تماس (با ثبت رویداد ممیزی)'
        : 'با پوشاندن خودکار اطلاعات حساس (PII Masked)',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#111315]">مدیریت مشتریان و سطح دسترسی</h1>
          <p className="mt-1 text-xs text-[#52565e]">
            مشاهده اطلاعات کاربران، سگمنت وفاداری، سوابق سفارش‌ها و مدیریت نقش‌های دسترسی
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={safeItems.length === 0}
            onClick={handleExportCustomersCsv}
            icon={<Download className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
          >
            خروجی CSV
          </Button>
          {canViewFullPii ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleToggleRevealPii}
              icon={
                showFullPii ? (
                  <EyeOff className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                ) : (
                  <Eye className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                )
              }
            >
              {showFullPii ? 'پوشاندن اطلاعات تماس' : 'نمایش کامل اطلاعات تماس'}
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-[#f6f6f7] px-3 h-8 text-[11px] text-[#52565e]">
              <Lock className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
              <span>مشاهده کامل PII محدود به مجوز ویژه</span>
            </span>
          )}
        </div>
      </div>

      <Card padding="sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7c818c]"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="جستجو با نام، نام کاربری، ایمیل یا شماره موبایل"
              aria-label="جستجوی کاربر"
              className="w-full h-9 pr-9 pl-3 rounded-lg border border-black/[0.14] bg-[#f6f6f7] text-xs text-[#111315] placeholder:text-[#7c818c] focus:bg-white focus:outline-none focus:border-[#0f49bd]"
            />
          </div>

          <div
            className="flex items-center gap-1 p-1 rounded-lg bg-[#f1f2f4] border border-black/[0.06]"
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
                className={`px-3 h-7 rounded-md text-xs transition-colors duration-150 whitespace-nowrap ${
                  roleFilter === key
                    ? 'bg-white text-[#111315] shadow-[0_1px_2px_rgba(17,19,21,0.06)] font-semibold'
                    : 'text-[#52565e] hover:text-[#111315] font-medium'
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
          <ErrorState message={error} onRetry={() => void loadCustomers(true)} />
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
                  <tr className="border-b border-black/[0.08] text-xs font-medium text-[#52565e]">
                    <th className="py-3 px-3">کاربر</th>
                    <th className="py-3 px-3">ایمیل و موبایل</th>
                    <th className="py-3 px-3">نقش و وضعیت</th>
                    <th className="py-3 px-3">سفارش‌ها و خرید</th>
                    <th className="py-3 px-3">آخرین ورود</th>
                    <th className="py-3 px-3 text-left">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.06] text-xs">
                  {safeItems.map((c) => {
                    const emailDisplay = showFullPii ? c.email : maskEmail(c.email);
                    const phoneDisplay = c.phone
                      ? showFullPii
                        ? toPersianDigits(c.phone)
                        : maskPhone(c.phone)
                      : 'بدون موبایل';

                    return (
                      <tr key={c.id} className="hover:bg-[#f7f8fa] transition-colors duration-150">
                        <td className={`${preferences.compactRows ? 'py-2' : 'py-3.5'} px-3`}>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="font-semibold text-[#111315]">{c.fullName}</p>
                            {c.username && (
                              <span
                                className="text-[11px] font-mono text-[#0f49bd] bg-[#eef3fc] border border-[#c7d7f8] px-1.5 py-0.5 rounded"
                                dir="ltr"
                              >
                                @{c.username}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#52565e]">
                            {c.twoFactorEnabled ? '2FA فعال' : '2FA غیرفعال'}
                          </p>
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-mono text-[#111315]" dir="ltr">
                            {emailDisplay}
                          </p>
                          <p className="text-[11px] text-[#52565e] tabular-nums-fa">
                            {phoneDisplay}
                          </p>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <RoleTag role={c.role} />
                            {(() => {
                              const seg = classifyCustomerSegment(c);
                              return <StatusTag tone={seg.tone}>{seg.label}</StatusTag>;
                            })()}
                            {c.isActive === false && !c.isBlocked && (
                              <StatusTag tone="warning">غیرفعال</StatusTag>
                            )}
                          </div>
                          {Array.isArray(c.roles) && c.roles.length > 0 && (
                            <p className="mt-1 text-[10px] text-[#52565e]">
                              {c.roles.map((r) => r.titleFa || r.name).join('، ')}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap tabular-nums-fa">
                          <p className="font-semibold text-[#111315]">
                            {toPersianDigits(c.ordersCount)} سفارش
                          </p>
                          <p className="text-[11px] text-[#52565e]">
                            {formatToman(c.totalSpent)}
                          </p>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-[#52565e]">
                          {formatPersianDateTime(c.lastLoginAt)}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-left">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void openCustomerDrawer(c.id)}
                            icon={<Eye className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
                          >
                            پرونده کاربر
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
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

      <RbacRolesPanel />

      <CustomerDetailDrawer
        open={drawerOpen}
        loading={drawerLoading}
        customer={customerDetail}
        currentAdminId={currentAdmin?.id}
        availableRoles={availableRoles}
        canManageAdmins={canManageAdmins}
        canUpdateStatus={canUpdateCustomerStatus}
        canViewFullPii={canViewFullPii}
        onClose={() => setDrawerOpen(false)}
        onRequestRoleChange={(customer, nextRole) => setRoleTarget({ customer, nextRole })}
        onRequestStatusToggle={(customer, nextBlocked) =>
          setStatusTarget({ customer, nextBlocked })
        }
        onAssignRbacRoles={handleAssignRbacRoles}
        onNoteSaved={(customerId, note) => {
          setItems((prev) =>
            prev.map((c) => (c.id === customerId ? { ...c, internalNote: note } : c))
          );
          setCustomerDetail((prev) =>
            prev && prev.id === customerId ? { ...prev, internalNote: note } : prev
          );
        }}
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
            ? `آیا مطمئن هستید که می‌خواهید حساب «${roleTarget.customer.fullName}» به مدیر سیستم ارتقا یابد؟`
            : `آیا از لغو دسترسی مدیریت حساب «${roleTarget?.customer.fullName || ''}» اطمینان دارید؟`
        }
        confirmLabel="تایید تغییر نقش"
      />

      <ConfirmDialog
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        onConfirm={() => void handleConfirmStatusChange()}
        loading={updatingStatus}
        tone={statusTarget?.nextBlocked ? 'danger' : 'primary'}
        title={statusTarget?.nextBlocked ? 'تایید مسدودسازی حساب کاربر' : 'تایید رفع مسدودیت حساب'}
        description={
          statusTarget?.nextBlocked
            ? `حساب «${statusTarget.customer.fullName}» مسدود شده و امکان ورود و ثبت سفارش جدید نخواهد داشت.`
            : `دسترسی حساب «${statusTarget?.customer.fullName || ''}» مجدداً فعال خواهد شد.`
        }
        confirmLabel={statusTarget?.nextBlocked ? 'مسدود کردن حساب' : 'فعال‌سازی حساب'}
      />
    </div>
  );
}
