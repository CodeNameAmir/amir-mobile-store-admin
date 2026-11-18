import { ShieldCheck, ShieldOff } from 'lucide-react';
import type { AdminCustomerDetail, UserRole } from '../../types/admin';
import {
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

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={customer?.fullName || 'جزئیات کاربر'}
      subtitle={customer?.email}
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
                    <ShieldOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
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
          <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-[#f8f9ff] border border-[#c3c6d7]/50">
            <div className="space-y-1">
              <p className="text-[#434655]">سطح دسترسی فعلی</p>
              <RoleTag role={customer.role} />
            </div>
            <div className="text-left tabular-nums-fa">
              <p className="text-[#434655]">مجموع خرید ثبت‌شده</p>
              <p className="mt-1 text-base font-bold text-[#004ac6]">
                {formatToman(customer.totalSpent)}
              </p>
            </div>
          </div>

          <dl className="divide-y divide-[#c3c6d7]/40 rounded-2xl border border-[#c3c6d7]/60">
            {[
              ['ایمیل', customer.email],
              ['شماره موبایل', customer.phone ? toPersianDigits(customer.phone) : 'ثبت نشده'],
              ['تایید ایمیل', customer.emailVerified ? 'تاییدشده' : 'در انتظار تایید'],
              ['تایید دومرحله‌ای (2FA)', customer.twoFactorEnabled ? 'فعال' : 'غیرفعال'],
              ['تاریخ عضویت', formatPersianDateTime(customer.createdAt)],
              ['آخرین ورود', formatPersianDateTime(customer.lastLoginAt)],
            ].map(([label, val]) => (
              <div key={label} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <dt className="text-[#434655]">{label}</dt>
                <dd className="font-semibold text-[#0b1c30] tabular-nums-fa">{val}</dd>
              </div>
            ))}
          </dl>

          <div className="space-y-2">
            <h3 className="font-bold text-[#0b1c30]">
              آدرس‌های ذخیره‌شده ({toPersianDigits(safeAddresses.length)})
            </h3>
            {safeAddresses.length === 0 ? (
              <p className="text-[#434655] p-3 rounded-xl bg-[#f8f9ff]">
                هنوز آدرسی در حساب این کاربر ثبت نشده است.
              </p>
            ) : (
              <div className="space-y-2">
                {safeAddresses.map((addr, idx) => (
                  <div
                    key={addr.id || `addr-${idx}`}
                    className="p-3 rounded-xl border border-[#c3c6d7]/60 space-y-1"
                  >
                    <p className="font-bold text-[#0b1c30]">
                      {addr.label} · {addr.receiverName}
                    </p>
                    <p className="text-[#434655] leading-5">
                      {addr.city}، {addr.address}
                    </p>
                    <p className="text-[#434655] tabular-nums-fa">
                      کد پستی: {toPersianDigits(addr.postalCode)} · تلفن:{' '}
                      {toPersianDigits(addr.phone)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="font-bold text-[#0b1c30]">
              سفارش‌های این کاربر ({toPersianDigits(safeOrders.length)})
            </h3>
            {safeOrders.length === 0 ? (
              <p className="text-[#434655] p-3 rounded-xl bg-[#f8f9ff]">
                سفارشی با شناسه این حساب ثبت نشده است.
              </p>
            ) : (
              <div className="divide-y divide-[#c3c6d7]/40 rounded-2xl border border-[#c3c6d7]/60">
                {safeOrders.map((order, idx) => (
                  <div
                    key={order.orderCode || `order-${idx}`}
                    className="p-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-bold text-[#004ac6] tabular-nums-fa" dir="ltr">
                        #{order.orderCode}
                      </p>
                      <p className="text-[11px] text-[#434655] mt-0.5">{order.createdAt}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-[#0b1c30] tabular-nums-fa">
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
