import { useEffect, useState, type FormEvent } from 'react';
import { Download, History, Printer } from 'lucide-react';
import type { OrderRecord, OrderStatus } from '../../types/admin';
import {
  buildSingleOrderCsv,
  DELIVERY_SLOT_LABELS,
  downloadCsvFile,
  formatPersianDateTime,
  formatToman,
  ORDER_STATUS_LABELS,
  toPersianDigits,
} from '../../utils/formatters';
import { Link } from '../../router';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { OrderPaymentBadge, OrderStatusBadge } from '../ui/StatusBadge';
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

  const handleExportSingleCsv = () => {
    if (!order) return;
    const csv = buildSingleOrderCsv(order);
    downloadCsvFile(`ams-order-${order.orderCode}.csv`, csv);
  };

  return (
    <Drawer
      open={Boolean(order)}
      onClose={onClose}
      title={order ? `جزئیات سفارش #${order.orderCode}` : ''}
      subtitle={order?.createdAt}
      widthClass="max-w-2xl"
      printable
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
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-[#f6f6f7] border border-black/[0.08]">
            <div className="flex flex-wrap items-center gap-5">
              <div className="space-y-1">
                <p className="text-[11px] text-[#52565e]">وضعیت پردازش سفارش</p>
                <OrderStatusBadge status={order.status} />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-[#52565e]">وضعیت پرداخت</p>
                <OrderPaymentBadge order={order} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-left">
                <p className="text-[11px] text-[#52565e]">مبلغ قابل پرداخت</p>
                <p className="mt-0.5 text-base font-semibold text-[#0f49bd] tabular-nums-fa">
                  {formatToman(order.totalAmount)}
                </p>
              </div>
            </div>
          </div>

          <div className="ams-no-print flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportSingleCsv}
              icon={<Download className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
            >
              خروجی CSV سفارش
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              icon={<Printer className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
            >
              چاپ برگه سفارش
            </Button>
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
              <div className="flex items-center gap-2 text-[#52565e]">
                <span>وضعیت پرداخت:</span>
                <OrderPaymentBadge order={order} />
              </div>
              {order.userId && (
                <p className="text-[#52565e]">
                  شناسه کاربر:{' '}
                  <span className="font-mono text-[#111315]" dir="ltr">
                    {order.userId}
                  </span>
                </p>
              )}
              <p className="text-[#52565e] tabular-nums-fa">
                کد رهگیری شاپرک:{' '}
                <span className="font-mono font-medium text-[#111315]" dir="ltr">
                  {order.shaparakRef || '—'}
                </span>
              </p>
              {order.trackingCode && (
                <p className="text-[#52565e] tabular-nums-fa">
                  کد رهگیری مرسوله پستی:{' '}
                  <span className="font-mono font-medium text-[#0f49bd]" dir="ltr">
                    {order.trackingCode}
                  </span>
                </p>
              )}
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
              <div className="pt-2 border-t border-black/[0.06] space-y-1 tabular-nums-fa">
                {order.subtotal > 0 && (
                  <p className="text-[#52565e]">
                    جمع کالاها:{' '}
                    <span className="font-medium text-[#111315]">{formatToman(order.subtotal)}</span>
                  </p>
                )}
                {order.productDiscount > 0 && (
                  <p className="text-[#52565e]">
                    تخفیف محصولات:{' '}
                    <span className="font-medium text-[#166534]">
                      -{formatToman(order.productDiscount)}
                    </span>
                  </p>
                )}
                {order.couponDiscount > 0 && (
                  <p className="text-[#52565e]">
                    تخفیف کد کوپن:{' '}
                    <span className="font-medium text-[#166534]">
                      -{formatToman(order.couponDiscount)}
                    </span>
                  </p>
                )}
                <p className="text-[#52565e]">
                  هزینه ارسال:{' '}
                  <span className="font-medium text-[#111315]">
                    {order.shippingCost > 0 ? formatToman(order.shippingCost) : 'رایگان'}
                  </span>
                </p>
              </div>
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
                          {item.warranty ? ` · ${item.warranty}` : ''}
                        </p>
                        {(item.sku ||
                          item.partNumber ||
                          item.simType ||
                          item.variantId ||
                          item.assignedImei ||
                          item.costPriceToman) && (
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
                            {item.assignedImei && (
                              <span>
                                · IMEI:{' '}
                                <span className="font-mono font-medium text-[#0f49bd]" dir="ltr">
                                  {item.assignedImei}
                                </span>
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
                            {item.costPriceToman !== null && item.costPriceToman !== undefined && (
                              <span>
                                · قیمت تمام‌شده:{' '}
                                <span className="font-medium text-[#111315]">
                                  {formatToman(item.costPriceToman)}
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

          {/* Status History (when provided by Backend) */}
          {Array.isArray(order.statusHistory) && order.statusHistory.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold text-[#111315] flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-[#52565e]" strokeWidth={1.5} aria-hidden="true" />
                <span>تاریخچه تغییر وضعیت</span>
              </h3>
              <div className="divide-y divide-black/[0.06] rounded-xl border border-black/[0.08] text-xs">
                {order.statusHistory.map((item, idx) => (
                  <div key={`${item.status}-${idx}`} className="p-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <OrderStatusBadge status={item.status} />
                      {item.note && <p className="text-[11px] text-[#52565e] mt-1">{item.note}</p>}
                    </div>
                    <div className="text-left text-[11px] text-[#52565e] tabular-nums-fa">
                      {item.changedAt ? <p>{formatPersianDateTime(item.changedAt)}</p> : null}
                      {item.actor ? (
                        <p className="font-mono" dir="ltr">
                          {item.actor}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {order.adminNote && (
            <div className="hidden print:block p-3.5 rounded-xl border border-black/[0.12] text-xs">
              <p className="font-semibold text-[#111315]">یادداشت مدیر</p>
              <p className="mt-1 text-[#52565e] leading-5">{order.adminNote}</p>
            </div>
          )}

          {/* Status & Admin Note Form */}
          <form
            id="order-update-form"
            onSubmit={handleSubmit}
            className="ams-no-print p-4 rounded-xl bg-[#f6f6f7] border border-black/[0.08] space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-[#111315]">به‌روزرسانی وضعیت سفارش</h3>
              <Link
                to="/audit-logs"
                className="text-[11px] font-medium text-[#0f49bd] hover:underline"
              >
                سوابق تغییرات در گزارش رویدادها
              </Link>
            </div>

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
              <p className="mt-1.5 text-[11px] text-[#52565e]">
                لغو سفارش (cancelled) در صورت فعال‌سازی و پشتیبانی Backend در دسترس خواهد بود.
              </p>
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
