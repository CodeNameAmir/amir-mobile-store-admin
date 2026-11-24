import { Heart, ShieldCheck, ShieldOff } from 'lucide-react';
import type { AdminCustomerDetail, UserRole } from '../../types/admin';
import {
  formatPersianDate,
  formatPersianDateTime,
  formatToman,
  toPersianDigits,
} from '../../utils/formatters';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { OrderStatusBadge, RoleTag } from '../ui/StatusBadge';
import { LoadingSkeleton } from '../ui/StateViews';

interface CustomerDetailDrawerProps {
  open: boolean;
  loading: boolean;
  customer: AdminCustomerDetail | null;
  currentAdminId?: string;
  onClose: () => void;
  onRequestRoleChange: (customer: AdminCustomerDetail, nextRole: UserRole) => void;
}

export function CustomerDetailDrawer({
  open,
  loading,
  customer,
  currentAdminId,
  onClose,
  onRequestRoleChange,
}: CustomerDetailDrawerProps) {
  const isSelf = Boolean(customer && currentAdminId && customer.id === currentAdminId);
  const safeAddresses = Array.isArray(customer?.addresses) ? customer.addresses : [];
  const safeOrders = Array.isArray(customer?.orders) ? customer.orders : [];
  const safeWishlist = Array.isArray(customer?.wishlist) ? customer.wishlist : [];

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
              <span className="font-mono truncate">{customer.email}</span>
            </span>
          ) : (
            <span className="inline-block font-mono max-w-full truncate" dir="ltr">
              {customer.email}
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
            {!isSelf && (
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
          <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-[#f6f6f7] border border-black/[0.08]">
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
                <p className="text-[#52565e]">سطح دسترسی فعلی</p>
                <RoleTag role={customer.role} />
              </div>
            </div>
            <div className="text-left tabular-nums-fa">
              <p className="text-[#52565e]">مجموع خرید ثبت‌شده</p>
              <p className="mt-1 text-base font-semibold text-[#0f49bd]">
                {formatToman(customer.totalSpent)}
              </p>
            </div>
          </div>

          <dl className="divide-y divide-black/[0.06] rounded-xl border border-black/[0.08]">
            {[
              {
                label: 'نام کاربری',
                val: customer.username ? `@${customer.username}` : 'تنظیم نشده',
                isLtrMono: Boolean(customer.username),
              },
              { label: 'ایمیل', val: customer.email, isLtrMono: true },
              {
                label: 'شماره موبایل',
                val: customer.phone ? toPersianDigits(customer.phone) : 'ثبت نشده',
                isLtrMono: false,
              },
              {
                label: 'کد ملی',
                val: customer.nationalId ? toPersianDigits(customer.nationalId) : 'ثبت نشده',
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
                      {addr.city}، {addr.address}
                    </p>
                    <p className="text-[#52565e] tabular-nums-fa">
                      کد پستی: {toPersianDigits(addr.postalCode)} · تلفن:{' '}
                      {toPersianDigits(addr.phone)}
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
