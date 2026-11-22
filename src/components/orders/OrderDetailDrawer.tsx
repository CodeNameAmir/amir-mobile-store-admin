import { useEffect, useState, type FormEvent } from 'react';
import type { OrderRecord, OrderStatus } from '../../types/admin';
import {
  DELIVERY_SLOT_LABELS,
  formatToman,
  ORDER_STATUS_LABELS,
  toPersianDigits,
} from '../../utils/formatters';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { OrderStatusBadge } from '../ui/StatusBadge';
import { ProductThumb } from '../ui/ProductThumb';

interface OrderDetailDrawerProps {
  order: OrderRecord | null;
  onClose: () => void;
  onUpdateOrder: (
    orderCode: string,
    payload: { status: OrderStatus; adminNote: string },
    orderId?: string
  ) => Promise<void>;
}

const STATUS_OPTIONS: OrderStatus[] = ['paid', 'preparing', 'shipped', 'delivered'];

export function OrderDetailDrawer({
  order,
  onClose,
  onUpdateOrder,
}: OrderDetailDrawerProps) {
  const [status, setStatus] = useState<string>('preparing');
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);

  const safeItems = Array.isArray(order?.items) ? order.items : [];
  const hasKnownStatus = STATUS_OPTIONS.includes(status as OrderStatus);

  useEffect(() => {
    if (!order) return;
    setStatus(order.status || 'preparing');
    setAdminNote(order.adminNote || '');
  }, [order]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!order) return;
    setSaving(true);
    try {
      await onUpdateOrder(
        order.orderCode,
        {
          status: (STATUS_OPTIONS.includes(status as OrderStatus) ? status : 'preparing') as OrderStatus,
          adminNote: adminNote.trim(),
        },
        order.id
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={Boolean(order)}
      onClose={onClose}
      title={order ? `جزئیات سفارش #${order.orderCode}` : ''}
      subtitle={order?.createdAt}
      widthClass="max-w-2xl"
      footer={
        order && (
          <>
            <Button variant="outline" onClick={onClose} disabled={saving}>
              بستن
            </Button>
            <Button type="submit" form="order-update-form" variant="primary" loading={saving}>
              ذخیره وضعیت و یادداشت
            </Button>
          </>
        )
      }
    >
      {order && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[#f6f6f7] border border-black/[0.08]">
            <div className="space-y-1">
              <p className="text-xs text-[#52565e]">وضعیت فعلی سفارش</p>
              <OrderStatusBadge status={order.status} />
            </div>
            <div className="text-left">
              <p className="text-xs text-[#52565e]">مبلغ قابل پرداخت</p>
              <p className="mt-1 text-base font-semibold text-[#0f49bd] tabular-nums-fa">
                {formatToman(order.totalAmount)}
              </p>
            </div>
          </div>

          {/* Customer & Shipping Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl border border-black/[0.08] space-y-2">
              <h3 className="font-semibold text-[#111315]">اطلاعات خریدار و ارسال</h3>
              <p className="text-[#52565e]">
                نام تحویل‌گیرنده:{' '}
                <span className="font-medium text-[#111315]">{order.customerName}</span>
              </p>
              <p className="text-[#52565e] tabular-nums-fa">
                تلفن تماس:{' '}
                <span className="font-medium text-[#111315]" dir="ltr">
                  {toPersianDigits(order.customerPhone)}
                </span>
              </p>
              <p className="text-[#52565e]">
                روش ارسال:{' '}
                <span className="font-medium text-[#111315]">
                  {DELIVERY_SLOT_LABELS[order.deliverySlot] || order.deliverySlot || '—'}
                </span>
              </p>
              <p className="text-[#52565e] tabular-nums-fa">
                کد پستی:{' '}
                <span className="font-medium text-[#111315]">
                  {toPersianDigits(order.postalCode)}
                </span>
              </p>
              <p className="text-[#52565e] leading-5">
                نشانی:{' '}
                <span className="text-[#111315]">
                  {order.city ? `${order.city}، ` : ''}
                  {order.shippingAddress}
                </span>
              </p>
            </div>

            <div className="p-4 rounded-xl border border-black/[0.08] space-y-2">
              <h3 className="font-semibold text-[#111315]">اطلاعات پرداخت و تحویل</h3>
              <p className="text-[#52565e] tabular-nums-fa">
                کد رهگیری شاپرک:{' '}
                <span className="font-mono font-medium text-[#111315]" dir="ltr">
                  {order.shaparakRef || '—'}
                </span>
              </p>
              <p className="text-[#52565e] tabular-nums-fa">
                پین تحویل مرسوله:{' '}
                <span className="font-medium text-[#111315]">
                  {order.deliveryPin ? toPersianDigits(order.deliveryPin) : '—'}
                </span>
              </p>
              <p className="text-[#52565e] tabular-nums-fa">
                شناسه IMEI / سریال:{' '}
                <span className="font-mono font-medium text-[#111315]" dir="ltr">
                  {order.imeiSample || '—'}
                </span>
              </p>
              <p className="text-[#52565e]">
                کد تخفیف:{' '}
                <span className="font-mono font-medium text-[#111315]" dir="ltr">
                  {order.couponCode || 'بدون کد تخفیف'}
                </span>
              </p>
              <p className="text-[#52565e] tabular-nums-fa">
                هزینه ارسال:{' '}
                <span className="font-medium text-[#111315]">
                  {order.shippingCost > 0 ? formatToman(order.shippingCost) : 'رایگان'}
                </span>
              </p>
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-[#111315]">
              اقلام سفارش ({toPersianDigits(safeItems.length)} کالا)
            </h3>
            {safeItems.length === 0 ? (
              <p className="p-3 rounded-lg bg-[#f6f6f7] text-xs text-[#52565e]">
                فهرست اقلام برای این سفارش ثبت نشده است.
              </p>
            ) : (
              <div className="divide-y divide-black/[0.06] rounded-xl border border-black/[0.08]">
                {safeItems.map((item, idx) => (
                  <div key={item.key || `${item.productId}-${idx}`} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <ProductThumb src={item.image} alt={item.nameFa} sizeClass="h-11 w-11" />
                      <div className="min-w-0">
                        <p className="font-semibold text-[#111315] truncate">{item.nameFa}</p>
                        <p className="mt-0.5 text-[11px] text-[#52565e]">
                          {item.colorName || '—'} · {item.storageLabel || '—'} · تعداد: {toPersianDigits(item.qty)}
                        </p>
                        {(item.sku || item.partNumber || item.simType || item.variantId) && (
                          <p className="mt-1 text-[11px] text-[#52565e] flex flex-wrap items-center gap-x-2 gap-y-0.5 tabular-nums-fa">
                            {item.sku && (
                              <span dir="ltr" className="inline-flex items-center gap-1">
                                <span>SKU:</span>
                                <span className="font-mono font-medium text-[#111315]">{item.sku}</span>
                              </span>
                            )}
                            {item.partNumber && (
                              <span>
                                · پارت‌نامبر:{' '}
                                <span className="font-mono font-medium text-[#111315]" dir="ltr">
                                  {item.partNumber}
                                </span>
                              </span>
                            )}
                            {item.simType && (
                              <span>
                                · سیم‌کارت: <span className="font-medium text-[#111315]">{item.simType}</span>
                              </span>
                            )}
                            {item.variantId && (
                              <span>
                                · شناسه تنوع:{' '}
                                <span className="font-mono text-[#52565e]" dir="ltr">
                                  {item.variantId}
                                </span>
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-left shrink-0 tabular-nums-fa">
                      <p className="font-semibold text-[#111315]">
                        {formatToman(item.unitPrice * item.qty)}
                      </p>
                      <p className="text-[11px] text-[#52565e]">
                        واحد: {formatToman(item.unitPrice)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status & Admin Note Form */}
          <form
            id="order-update-form"
            onSubmit={handleSubmit}
            className="p-4 rounded-xl bg-[#f6f6f7] border border-black/[0.08] space-y-4"
          >
            <h3 className="text-xs font-semibold text-[#111315]">به‌روزرسانی وضعیت سفارش</h3>

            <div>
              <label htmlFor="order-status-select" className="block text-xs font-medium text-[#111315] mb-1.5">
                وضعیت پردازش
              </label>
              <select
                id="order-status-select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-sm text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              >
                {!hasKnownStatus && status && (
                  <option value={status}>وضعیت نامشخص ({status})</option>
                )}
                {STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {ORDER_STATUS_LABELS[st]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="order-admin-note" className="block text-xs font-medium text-[#111315] mb-1.5">
                یادداشت داخلی مدیر
              </label>
              <textarea
                id="order-admin-note"
                rows={3}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="مثال: کد رهگیری پستی یا توضیحات هماهنگی پیک"
                className="w-full p-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] leading-5 focus:outline-none focus:border-[#0f49bd]"
              />
            </div>
          </form>
        </div>
      )}
    </Drawer>
  );
}
