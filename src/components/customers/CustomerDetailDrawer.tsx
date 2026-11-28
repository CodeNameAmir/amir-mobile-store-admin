import { useEffect, useState, type FormEvent } from 'react';
import {
  Ban,
  CheckCircle2,
  Eye,
  EyeOff,
  Heart,
  Lock,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react';
import type { AdminCustomerDetail, RbacRole, UserRole } from '../../types/admin';
import { adminApi } from '../../services/adminApi';
import { ApiError, isEndpointUnsupportedError } from '../../services/apiClient';
import { useToast } from '../../context/ToastContext';
import {
  formatPersianDate,
  formatPersianDateTime,
  formatToman,
  toPersianDigits,
} from '../../utils/formatters';
import { classifyCustomerSegment } from '../../utils/crmAndSla';
import {
  maskAddress,
  maskEmail,
  maskNationalId,
  maskPhone,
  maskPostalCode,
} from '../../utils/masking';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { OrderStatusBadge, RoleTag, StatusTag } from '../ui/StatusBadge';
import { LoadingSkeleton } from '../ui/StateViews';

interface CustomerDetailDrawerProps {
  open: boolean;
  loading: boolean;
  customer: AdminCustomerDetail | null;
  currentAdminId?: string;
  availableRoles?: RbacRole[];
  canManageAdmins?: boolean;
  canUpdateStatus?: boolean;
  canViewFullPii?: boolean;
  onClose: () => void;
  onRequestRoleChange: (customer: AdminCustomerDetail, nextRole: UserRole) => void;
  onRequestStatusToggle?: (customer: AdminCustomerDetail, nextBlocked: boolean) => void;
  onAssignRbacRoles?: (customerId: string, roleIds: string[]) => Promise<void>;
  onNoteSaved?: (customerId: string, note: string) => void;
}

export function CustomerDetailDrawer({
  open,
  loading,
  customer,
  currentAdminId,
  availableRoles = [],
  canManageAdmins = false,
  canUpdateStatus = false,
  canViewFullPii = false,
  onClose,
  onRequestRoleChange,
  onRequestStatusToggle,
  onAssignRbacRoles,
  onNoteSaved,
}: CustomerDetailDrawerProps) {
  const { pushToast } = useToast();
  const [revealPii, setRevealPii] = useState(false);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [savingRoles, setSavingRoles] = useState(false);
  const [crmNote, setCrmNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const isSelf = Boolean(customer && currentAdminId && customer.id === currentAdminId);
  const safeAddresses = Array.isArray(customer?.addresses) ? customer.addresses : [];
  const safeOrders = Array.isArray(customer?.orders) ? customer.orders : [];
  const safeWishlist = Array.isArray(customer?.wishlist) ? customer.wishlist : [];

  useEffect(() => {
    setRevealPii(false);
    setCrmNote(customer?.internalNote || '');
    if (!customer || availableRoles.length === 0) {
      setSelectedRoleIds([]);
      return;
    }
    const customerRoles = Array.isArray(customer.roles) ? customer.roles : [];
    const matchedIds = availableRoles
      .filter((r) =>
        customerRoles.some((cr) => cr.id === r.id || cr.name === r.name)
      )
      .map((r) => r.id);
    setSelectedRoleIds(matchedIds);
  }, [customer, availableRoles]);

  const showFull = canViewFullPii && revealPii;

  const handleToggleReveal = () => {
    if (!canViewFullPii || !customer) return;
    const next = !revealPii;
    setRevealPii(next);
    if (next) {
      void adminApi.recordSensitiveAccess({
        targetType: 'user',
        targetId: customer.id,
        field: 'full_profile_pii',
      });
    }
  };

  const toggleRoleId = (id: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSaveRbacRoles = async () => {
    if (!customer || !onAssignRbacRoles) return;
    setSavingRoles(true);
    try {
      await onAssignRbacRoles(customer.id, selectedRoleIds);
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'خطا در ذخیره نقش‌های دسترسی',
        description:
          err instanceof ApiError
            ? err.message
            : 'در صورت عدم پشتیبانی مسیر /roles در Backend، نیاز به به‌روزرسانی سرور است.',
      });
    } finally {
      setSavingRoles(false);
    }
  };

  const handleSaveCrmNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    setSavingNote(true);
    try {
      const res = await adminApi.updateCustomerNote(customer.id, crmNote);
      onNoteSaved?.(customer.id, res.internalNote);
      pushToast({
        tone: 'success',
        title: 'یادداشت CRM مشتری ذخیره شد',
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'خطا در ذخیره یادداشت مشتری',
        description: isEndpointUnsupportedError(err)
          ? 'مسیر PATCH /api/admin/customers/:id/notes هنوز در Backend فعال نشده است.'
          : err instanceof ApiError
            ? err.message
            : 'لطفاً دوباره تلاش کنید.',
      });
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={customer?.fullName || 'جزئیات کاربر'}
      subtitle={
        customer ? (
          customer.username ? (
            <span className="inline-flex items-center gap-1.5 max-w-full" dir="ltr">
              <span className="font-mono font-medium text-[#0f49bd] shrink-0">
                @{customer.username}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono truncate">
                {showFull ? customer.email : maskEmail(customer.email)}
              </span>
            </span>
          ) : (
            <span className="inline-block font-mono max-w-full truncate" dir="ltr">
              {showFull ? customer.email : maskEmail(customer.email)}
            </span>
          )
        ) : undefined
      }
      widthClass="max-w-xl"
      footer={
        customer && (
          <>
            <Button variant="outline" onClick={onClose}>
              بستن
            </Button>
            {!isSelf && canUpdateStatus && onRequestStatusToggle && (
              <Button
                variant={customer.isBlocked ? 'secondary' : 'outline'}
                onClick={() => onRequestStatusToggle(customer, !customer.isBlocked)}
                icon={
                  customer.isBlocked ? (
                    <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                  ) : (
                    <Ban className="h-4 w-4 text-[#b42318]" strokeWidth={1.5} aria-hidden="true" />
                  )
                }
              >
                {customer.isBlocked ? 'رفع مسدودیت حساب' : 'مسدود کردن حساب'}
              </Button>
            )}
            {!isSelf && canManageAdmins && (
              <Button
                variant={customer.role === 'admin' ? 'danger' : 'secondary'}
                onClick={() =>
                  onRequestRoleChange(
                    customer,
                    customer.role === 'admin' ? 'customer' : 'admin'
                  )
                }
                icon={
                  customer.role === 'admin' ? (
                    <ShieldOff className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                  )
                }
              >
                {customer.role === 'admin' ? 'لغو دسترسی مدیریت' : 'ارتقا به مدیر سیستم'}
              </Button>
            )}
          </>
        )
      }
    >
      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : !customer ? null : (
        <div className="space-y-6 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[#f6f6f7] border border-black/[0.08]">
            <div className="flex items-center gap-3">
              {customer.avatarUrl ? (
                <img
                  src={customer.avatarUrl}
                  alt={customer.fullName}
                  referrerPolicy="no-referrer"
                  className="h-11 w-11 rounded-full object-cover border border-black/[0.1] bg-white shrink-0"
                />
              ) : (
                <div className="h-11 w-11 rounded-full bg-white border border-black/[0.1] text-[#111315] font-semibold flex items-center justify-center shrink-0 text-sm">
                  {(customer.fullName || 'ک').trim().charAt(0)}
                </div>
              )}
              <div className="space-y-1">
                <p className="text-[#52565e]">سطح دسترسی و سگمنت</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <RoleTag role={customer.role} />
                  {(() => {
                    const seg = classifyCustomerSegment(customer);
                    return <StatusTag tone={seg.tone}>{seg.label}</StatusTag>;
                  })()}
                  {customer.isActive === false && !customer.isBlocked && (
                    <StatusTag tone="warning">غیرفعال</StatusTag>
                  )}
                </div>
              </div>
            </div>
            <div className="text-left tabular-nums-fa">
              <p className="text-[#52565e]">مجموع خرید ثبت‌شده</p>
              <p className="mt-1 text-base font-semibold text-[#0f49bd]">
                {formatToman(customer.totalSpent)}
              </p>
            </div>
          </div>

          {/* PII Reveal Control */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg bg-[#f6f6f7] border border-black/[0.06]">
            <div className="flex items-center gap-2 text-[#52565e]">
              <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
              <span>
                {showFull
                  ? 'اطلاعات کامل هویتی و تماس نمایش داده می‌شود (رویداد ممیزی ثبت شد).'
                  : 'اطلاعات حساس (موبایل، کد ملی، ایمیل و نشانی) به‌صورت پیش‌فرض پوشانده شده‌اند.'}
              </span>
            </div>
            {canViewFullPii && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleToggleReveal}
                icon={
                  showFull ? (
                    <EyeOff className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                  )
                }
              >
                {showFull ? 'پوشاندن مجدد' : 'نمایش کامل اطلاعات'}
              </Button>
            )}
          </div>

          <dl className="divide-y divide-black/[0.06] rounded-xl border border-black/[0.08]">
            {[
              {
                label: 'نام کاربری',
                val: customer.username ? `@${customer.username}` : 'تنظیم نشده',
                isLtrMono: Boolean(customer.username),
              },
              {
                label: 'ایمیل',
                val: showFull ? customer.email : maskEmail(customer.email),
                isLtrMono: true,
              },
              {
                label: 'شماره موبایل',
                val: customer.phone
                  ? showFull
                    ? toPersianDigits(customer.phone)
                    : maskPhone(customer.phone)
                  : 'ثبت نشده',
                isLtrMono: false,
              },
              {
                label: 'کد ملی',
                val: customer.nationalId
                  ? showFull
                    ? toPersianDigits(customer.nationalId)
                    : maskNationalId(customer.nationalId)
                  : 'ثبت نشده',
                isLtrMono: false,
              },
              {
                label: 'تاریخ تولد',
                val: customer.birthDate ? formatPersianDate(customer.birthDate) : 'ثبت نشده',
                isLtrMono: false,
              },
              {
                label: 'عضویت خبرنامه',
                val: customer.newsletterOptIn ? 'عضو فعال' : 'غیرعضو',
                isLtrMono: false,
              },
              {
                label: 'تایید ایمیل',
                val: customer.emailVerified ? 'تاییدشده' : 'در انتظار تایید',
                isLtrMono: false,
              },
              {
                label: 'تایید دومرحله‌ای (2FA)',
                val: customer.twoFactorEnabled ? 'فعال' : 'غیرفعال',
                isLtrMono: false,
              },
              ...(customer.usernameChangedAt
                ? [
                    {
                      label: 'آخرین تغییر نام کاربری',
                      val: formatPersianDateTime(customer.usernameChangedAt),
                      isLtrMono: false,
                    },
                  ]
                : []),
              {
                label: 'تاریخ عضویت',
                val: formatPersianDateTime(customer.createdAt),
                isLtrMono: false,
              },
              {
                label: 'آخرین ورود',
                val: formatPersianDateTime(customer.lastLoginAt),
                isLtrMono: false,
              },
            ].map(({ label, val, isLtrMono }) => (
              <div key={label} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <dt className="text-[#52565e]">{label}</dt>
                <dd
                  className={`font-medium text-[#111315] tabular-nums-fa ${
                    isLtrMono ? 'font-mono' : ''
                  }`}
                  dir={isLtrMono ? 'ltr' : undefined}
                >
                  {val}
                </dd>
              </div>
            ))}
          </dl>

          {/* Granular RBAC Roles Assignment */}
          {canManageAdmins && availableRoles.length > 0 && !isSelf && onAssignRbacRoles && (
            <div className="p-4 rounded-xl border border-black/[0.08] bg-[#f6f6f7] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-[#111315]">تخصیص نقش‌های دسترسی (RBAC)</h3>
                  <p className="text-[11px] text-[#52565e]">
                    انتخاب نقش‌های جزئی برای دسترسی تفکیک‌شده در پنل
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  loading={savingRoles}
                  onClick={() => void handleSaveRbacRoles()}
                >
                  ذخیره نقش‌ها
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {availableRoles.map((role) => {
                  const checked = selectedRoleIds.includes(role.id);
                  return (
                    <label
                      key={role.id}
                      className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors duration-150 ${
                        checked
                          ? 'bg-white border-[#0f49bd]'
                          : 'bg-white/70 border-black/[0.08] hover:bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRoleId(role.id)}
                        className="mt-0.5 h-3.5 w-3.5 accent-[#0f49bd]"
                      />
                      <span className="min-w-0">
                        <span className="block font-medium text-[#111315]">{role.titleFa}</span>
                        <span className="block font-mono text-[10px] text-[#52565e]" dir="ltr">
                          {role.name}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Internal CRM Note */}
          <form
            onSubmit={handleSaveCrmNote}
            className="p-4 rounded-xl border border-black/[0.08] bg-[#f6f6f7] space-y-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="customer-crm-note" className="font-semibold text-[#111315]">
                یادداشت داخلی CRM (مخفی از مشتری)
              </label>
              <Button type="submit" size="sm" variant="secondary" loading={savingNote}>
                ذخیره یادداشت
              </Button>
            </div>
            <textarea
              id="customer-crm-note"
              rows={2}
              value={crmNote}
              onChange={(e) => setCrmNote(e.target.value)}
              placeholder="سابقه تماس، ترجیحات خرید یا نکات پشتیبانی برای تیم..."
              className="w-full p-2.5 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] leading-5 focus:outline-none focus:border-[#0f49bd]"
            />
          </form>

          <div className="space-y-2">
            <h3 className="font-semibold text-[#111315] inline-flex items-center gap-1.5">
              <Heart className="h-3.5 w-3.5 text-[#52565e]" strokeWidth={1.5} aria-hidden="true" />
              <span>لیست علاقه‌مندی‌ها ({toPersianDigits(safeWishlist.length)})</span>
            </h3>
            {safeWishlist.length === 0 ? (
              <p className="text-[#52565e] p-3 rounded-lg bg-[#f6f6f7]">
                محصولی در لیست علاقه‌مندی‌های این کاربر ذخیره نشده است.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {safeWishlist.map((productSlug) => (
                  <span
                    key={productSlug}
                    dir="ltr"
                    className="px-2.5 py-1 rounded-md bg-[#f6f6f7] border border-black/[0.08] font-mono text-[11px] text-[#0f49bd]"
                  >
                    {productSlug}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-[#111315]">
              آدرس‌های ذخیره‌شده ({toPersianDigits(safeAddresses.length)})
            </h3>
            {safeAddresses.length === 0 ? (
              <p className="text-[#52565e] p-3 rounded-lg bg-[#f6f6f7]">
                هنوز آدرسی در حساب این کاربر ثبت نشده است.
              </p>
            ) : (
              <div className="space-y-2">
                {safeAddresses.map((addr, idx) => (
                  <div
                    key={addr.id || `addr-${idx}`}
                    className="p-3 rounded-xl border border-black/[0.08] space-y-1"
                  >
                    <p className="font-semibold text-[#111315]">
                      {addr.label} · {addr.receiverName}
                    </p>
                    <p className="text-[#52565e] leading-5">
                      {showFull
                        ? `${addr.city}، ${addr.address}`
                        : maskAddress(addr.address, addr.city)}
                    </p>
                    <p className="text-[#52565e] tabular-nums-fa">
                      کد پستی: {showFull ? toPersianDigits(addr.postalCode) : maskPostalCode(addr.postalCode)}{' '}
                      · تلفن:{' '}
                      {showFull ? toPersianDigits(addr.phone) : maskPhone(addr.phone)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold text-[#111315]">
              سفارش‌های این کاربر ({toPersianDigits(safeOrders.length)})
            </h3>
            {safeOrders.length === 0 ? (
              <p className="text-[#52565e] p-3 rounded-lg bg-[#f6f6f7]">
                سفارشی با شناسه این حساب ثبت نشده است.
              </p>
            ) : (
              <div className="divide-y divide-black/[0.06] rounded-xl border border-black/[0.08]">
                {safeOrders.map((order, idx) => (
                  <div
                    key={order.orderCode || `order-${idx}`}
                    className="p-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-mono font-medium text-[#0f49bd] tabular-nums-fa" dir="ltr">
                        #{order.orderCode}
                      </p>
                      <p className="text-[11px] text-[#52565e] mt-0.5">{order.createdAt}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-[#111315] tabular-nums-fa">
                        {formatToman(order.totalAmount)}
                      </span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
