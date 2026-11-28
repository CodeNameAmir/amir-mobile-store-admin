import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Download,
  Eye,
  EyeOff,
  History,
  Lock,
  PackageCheck,
  Printer,
  XCircle,
} from 'lucide-react';
import type { OrderRecord, OrderStatus } from '../../types/admin';
import { adminApi } from '../../services/adminApi';
import {
  buildSingleOrderCsv,
  DELIVERY_SLOT_LABELS,
  downloadCsvFile,
  formatPersianDateTime,
  formatToman,
  ORDER_STATUS_LABELS,
  toPersianDigits,
} from '../../utils/formatters';
import {
  canCancelOrder,
  getAllowedNextStatuses,
  validateOrderCancellation,
} from '../../utils/orderTransitions';
import {
  maskAddress,
  maskDeliveryPin,
  maskImei,
  maskPhone,
  maskPostalCode,
} from '../../utils/masking';
import { Link } from '../../router';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { OrderPaymentBadge, OrderStatusBadge } from '../ui/StatusBadge';
import { ProductThumb } from '../ui/ProductThumb';

interface OrderDetailDrawerProps {
  order: OrderRecord | null;
  canUpdate?: boolean;
  canCancel?: boolean;
  canViewFullPii?: boolean;
  onClose: () => void;
  onUpdateOrder: (
    orderCode: string,
    payload: { status: OrderStatus; adminNote: string; trackingCode?: string | null },
    orderId?: string
  ) => Promise<void>;
  onCancelOrder?: (
    orderCode: string,
    payload: { reason: string; restoreStock: boolean },
    orderId?: string
  ) => Promise<void>;
}

type PrintMode = 'invoice' | 'packing_slip';

export function OrderDetailDrawer({
  order,
  canUpdate = true,
  canCancel = true,
  canViewFullPii = false,
  onClose,
  onUpdateOrder,
  onCancelOrder,
}: OrderDetailDrawerProps) {
  const [status, setStatus] = useState<string>('preparing');
  const [trackingCode, setTrackingCode] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);

  const [revealPii, setRevealPii] = useState(false);
  const [printMode, setPrintMode] = useState<PrintMode>('invoice');

  const [cancelReason, setCancelReason] = useState('');
  const [restoreStock, setRestoreStock] = useState(true);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const safeItems = Array.isArray(order?.items) ? order.items : [];
  const allowedNextStatuses = getAllowedNextStatuses(order?.status);
  const hasKnownStatus = allowedNextStatuses.includes(status as OrderStatus);
  const isTerminalReadonly =
    order?.status === 'cancelled' || order?.status === 'expired';
  const showFull = canViewFullPii && revealPii;

  useEffect(() => {
    if (!order) return;
    setStatus(order.status || 'preparing');
    setTrackingCode(order.trackingCode || '');
    setAdminNote(order.adminNote || '');
    setRevealPii(false);
    setCancelReason('');
    setRestoreStock(true);
    setCancelError(null);
    setCancelConfirmOpen(false);
  }, [order]);

  const handleToggleRevealPii = () => {
    if (!canViewFullPii || !order) return;
    const next = !revealPii;
    setRevealPii(next);
    if (next) {
      void adminApi.recordSensitiveAccess({
        targetType: 'order',
        targetId: order.orderCode,
        field: 'customer_contact_and_imei',
      });
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!order || !canUpdate || isTerminalReadonly) return;
    setSaving(true);
    try {
      const targetStatus = allowedNextStatuses.includes(status as OrderStatus)
        ? (status as OrderStatus)
        : order.status;
      await onUpdateOrder(
        order.orderCode,
        {
          status: targetStatus,
          adminNote: adminNote.trim(),
          trackingCode: trackingCode.trim() ? trackingCode.trim() : null,
        },
        order.id
      );
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerPrint = (mode: PrintMode) => {
    setPrintMode(mode);
    window.setTimeout(() => {
      window.print();
    }, 60);
  };

  const handleRequestCancel = () => {
    if (!order) return;
    const err = validateOrderCancellation(order.status, cancelReason);
    if (err) {
      setCancelError(err);
      return;
    }
    setCancelError(null);
    setCancelConfirmOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!order || !onCancelOrder) return;
    setCancelling(true);
    try {
      await onCancelOrder(
        order.orderCode,
        { reason: cancelReason.trim(), restoreStock },
        order.id
      );
      setCancelConfirmOpen(false);
    } finally {
      setCancelling(false);
    }
  };

  const handleExportSingleCsv = () => {
    if (!order) return;
    const csv = buildSingleOrderCsv(order);
    downloadCsvFile(`ams-order-${order.orderCode}.csv`, csv);
  };

  return (
    <>
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
              <Button variant="outline" onClick={onClose} disabled={saving || cancelling}>
                بستن
              </Button>
              {canUpdate && !isTerminalReadonly && (
                <Button type="submit" form="order-update-form" variant="primary" loading={saving}>
                  ذخیره وضعیت و رهگیری
                </Button>
              )}
            </>
          )
        }
      >
        {order && (
          <div className="space-y-6">
            {/* Printable Header Badge */}
            <div className="hidden print:flex items-center justify-between border-b border-black/15 pb-3 mb-2">
              <div>
                <p className="text-sm font-semibold text-[#111315]">فروشگاه موبایل امیر</p>
                <p className="text-xs text-[#52565e]">
                  {printMode === 'packing_slip'
                    ? 'برگه ارسال و بسته‌بندی مرسوله'
                    : 'فاکتور فروش رسمی سفارش'}
                </p>
              </div>
              <p className="font-mono text-xs font-semibold text-[#111315]" dir="ltr">
                #{order.orderCode}
              </p>
            </div>

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
              {printMode !== 'packing_slip' && (
                <div className="text-left">
                  <p className="text-[11px] text-[#52565e]">مبلغ قابل پرداخت</p>
                  <p className="mt-0.5 text-base font-semibold text-[#0f49bd] tabular-nums-fa">
                    {formatToman(order.totalAmount)}
                  </p>
                </div>
              )}
            </div>

            {order.status === 'pending_payment' && order.expiresAt && (
              <div className="ams-no-print flex items-start gap-2.5 p-3.5 rounded-xl bg-[#fffbeb] border border-[#fde68a] text-xs text-[#9a4a06]">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" />
                <span>
                  این سفارش در انتظار پرداخت درگاه است و در صورت عدم پرداخت تا{' '}
                  <strong className="font-semibold tabular-nums-fa">
                    {formatPersianDateTime(order.expiresAt)}
                  </strong>{' '}
                  منقضی می‌شود.
                </span>
              </div>
            )}

            {order.status === 'cancelled' && (
              <div className="ams-no-print p-3.5 rounded-xl bg-[#fef3f2] border border-[#fecaca] text-xs text-[#b42318] space-y-1">
                <p className="font-semibold">این سفارش لغو شده است</p>
                {order.cancellationReason && <p>دلیل لغو: {order.cancellationReason}</p>}
                {order.cancelledAt && (
                  <p className="tabular-nums-fa">
                    زمان لغو: {formatPersianDateTime(order.cancelledAt)}
                  </p>
                )}
                {order.stockRestored !== undefined && (
                  <p>
                    وضعیت موجودی: {order.stockRestored ? 'موجودی کالاها به انبار بازگردانده شد' : 'بدون بازگشت خودکار موجودی'}
                  </p>
                )}
              </div>
            )}

            {/* Action toolbar */}
            <div className="ams-no-print flex flex-wrap items-center justify-between gap-2">
              <div>
                {canViewFullPii ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleToggleRevealPii}
                    icon={
                      showFull ? (
                        <EyeOff className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                      )
                    }
                  >
                    {showFull ? 'پوشاندن اطلاعات حساس' : 'نمایش کامل موبایل، نشانی و IMEI'}
                  </Button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-[#52565e]">
                    <Lock className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                    <span>اطلاعات تماس و پین تحویل پوشیده است</span>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleExportSingleCsv}
                  icon={<Download className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
                >
                  خروجی CSV
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleTriggerPrint('packing_slip')}
                  icon={<PackageCheck className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
                >
                  چاپ برگه ارسال
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleTriggerPrint('invoice')}
                  icon={<Printer className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
                >
                  چاپ فاکتور رسمی
                </Button>
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
                    {showFull ? toPersianDigits(order.customerPhone) : maskPhone(order.customerPhone)}
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
                    {showFull ? toPersianDigits(order.postalCode) : maskPostalCode(order.postalCode)}
                  </span>
                </p>
                <p className="text-[#52565e] leading-5">
                  نشانی:{' '}
                  <span className="text-[#111315]">
                    {showFull
                      ? `${order.city ? `${order.city}، ` : ''}${order.shippingAddress}`
                      : maskAddress(order.shippingAddress, order.city)}
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
                    {order.deliveryPin
                      ? showFull
                        ? toPersianDigits(order.deliveryPin)
                        : maskDeliveryPin(order.deliveryPin)
                      : '—'}
                  </span>
                </p>
                <p className="text-[#52565e] tabular-nums-fa">
                  شناسه IMEI / سریال:{' '}
                  <span className="font-mono font-medium text-[#111315]" dir="ltr">
                    {order.imeiSample
                      ? showFull
                        ? order.imeiSample
                        : maskImei(order.imeiSample)
                      : '—'}
                  </span>
                </p>
                <p className="text-[#52565e]">
                  کد تخفیف:{' '}
                  <span className="font-mono font-medium text-[#111315]" dir="ltr">
                    {order.couponCode || 'بدون کد تخفیف'}
                  </span>
                </p>

                {printMode !== 'packing_slip' && (
                  <div className="pt-2 border-t border-black/[0.06] space-y-1 tabular-nums-fa">
                    {order.subtotal > 0 && (
                      <p className="text-[#52565e]">
                        جمع کالاها:{' '}
                        <span className="font-medium text-[#111315]">
                          {formatToman(order.subtotal)}
                        </span>
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
                )}
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
                    <div
                      key={item.key || `${item.productId}-${idx}`}
                      className="p-3.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <ProductThumb src={item.image} alt={item.nameFa} sizeClass="h-11 w-11" />
                        <div className="min-w-0">
                          <p className="font-semibold text-[#111315] truncate">{item.nameFa}</p>
                          <p className="mt-0.5 text-[11px] text-[#52565e]">
                            {item.colorName || '—'} · {item.storageLabel || '—'} · تعداد:{' '}
                            {toPersianDigits(item.qty)}
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
                                  <span className="font-mono font-medium text-[#111315]">
                                    {item.sku}
                                  </span>
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
                                  · سیم‌کارت:{' '}
                                  <span className="font-medium text-[#111315]">{item.simType}</span>
                                </span>
                              )}
                              {item.assignedImei && (
                                <span>
                                  · IMEI:{' '}
                                  <span className="font-mono font-medium text-[#0f49bd]" dir="ltr">
                                    {showFull ? item.assignedImei : maskImei(item.assignedImei)}
                                  </span>
                                </span>
                              )}
                              {item.variantId && (
                                <span className="ams-no-print">
                                  · شناسه تنوع:{' '}
                                  <span className="font-mono text-[#52565e]" dir="ltr">
                                    {item.variantId}
                                  </span>
                                </span>
                              )}
                              {/* Hide cost price in printed invoice/packing slip */}
                              {item.costPriceToman !== null && item.costPriceToman !== undefined && (
                                <span className="ams-no-print">
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
                      {printMode !== 'packing_slip' && (
                        <div className="text-left shrink-0 tabular-nums-fa">
                          <p className="font-semibold text-[#111315]">
                            {formatToman(item.unitPrice * item.qty)}
                          </p>
                          <p className="text-[11px] text-[#52565e]">
                            واحد: {formatToman(item.unitPrice)}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Status History */}
            {Array.isArray(order.statusHistory) && order.statusHistory.length > 0 && (
              <div className="ams-no-print space-y-2.5">
                <h3 className="text-xs font-semibold text-[#111315] flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-[#52565e]" strokeWidth={1.5} aria-hidden="true" />
                  <span>تاریخچه تغییر وضعیت</span>
                </h3>
                <div className="divide-y divide-black/[0.06] rounded-xl border border-black/[0.08] text-xs">
                  {order.statusHistory.map((item, idx) => (
                    <div
                      key={`${item.status}-${idx}`}
                      className="p-3 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="space-y-0.5">
                        <OrderStatusBadge status={item.status} />
                        {item.note && (
                          <p className="text-[11px] text-[#52565e] mt-1">{item.note}</p>
                        )}
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

            {/* Status, Tracking & Admin Note Form */}
            <form
              id="order-update-form"
              onSubmit={handleSubmit}
              className="ams-no-print p-4 rounded-xl bg-[#f6f6f7] border border-black/[0.08] space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-[#111315]">
                  به‌روزرسانی وضعیت و اطلاعات ارسال
                </h3>
                <Link
                  to="/audit-logs"
                  className="text-[11px] font-medium text-[#0f49bd] hover:underline"
                >
                  سوابق تغییرات در گزارش رویدادها
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="order-status-select"
                    className="block text-xs font-medium text-[#111315] mb-1.5"
                  >
                    وضعیت پردازش مجاز
                  </label>
                  <select
                    id="order-status-select"
                    value={status}
                    disabled={!canUpdate || isTerminalReadonly}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-sm text-[#111315] focus:outline-none focus:border-[#0f49bd] disabled:bg-[#f1f2f4] disabled:text-[#7c818c]"
                  >
                    {!hasKnownStatus && status && (
                      <option value={status}>
                        {ORDER_STATUS_LABELS[status as OrderStatus] || status}
                      </option>
                    )}
                    {allowedNextStatuses.map((st) => (
                      <option key={st} value={st}>
                        {ORDER_STATUS_LABELS[st]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="order-tracking-code"
                    className="block text-xs font-medium text-[#111315] mb-1.5"
                  >
                    کد رهگیری مرسوله پستی / پیک
                  </label>
                  <input
                    id="order-tracking-code"
                    type="text"
                    dir="ltr"
                    value={trackingCode}
                    disabled={!canUpdate || isTerminalReadonly}
                    onChange={(e) => setTrackingCode(e.target.value)}
                    placeholder="POST-1405-982341"
                    className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white font-mono text-xs text-[#111315] placeholder:text-[#7c818c] focus:outline-none focus:border-[#0f49bd] disabled:bg-[#f1f2f4]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="order-admin-note"
                  className="block text-xs font-medium text-[#111315] mb-1.5"
                >
                  یادداشت داخلی مدیر (در فاکتور چاپ نمی‌شود)
                </label>
                <textarea
                  id="order-admin-note"
                  rows={3}
                  value={adminNote}
                  disabled={!canUpdate}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="توضیحات هماهنگی پیک، تحویل‌گیرنده یا پیگیری داخلی"
                  className="w-full p-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] leading-5 focus:outline-none focus:border-[#0f49bd] disabled:bg-[#f1f2f4]"
                />
              </div>
            </form>

            {/* Order Cancellation & Stock Restore */}
            {canCancel && onCancelOrder && canCancelOrder(order.status) && (
              <div className="ams-no-print p-4 rounded-xl border border-[#fecaca] bg-[#fef3f2]/50 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#b42318]">
                  <XCircle className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                  <span>لغو سفارش و بازگرداندن موجودی</span>
                </div>
                <p className="text-[11px] text-[#52565e] leading-5">
                  لغو سفارش در سرور ثبت شده و در گزارش رویدادها ممیزی می‌شود. با فعال ماندن گزینه بازگشت موجودی، تعداد کالاها به انبار برمی‌گردد.
                </p>
                <div>
                  <label
                    htmlFor="order-cancel-reason"
                    className="block text-xs font-medium text-[#111315] mb-1"
                  >
                    دلیل لغو سفارش *
                  </label>
                  <textarea
                    id="order-cancel-reason"
                    rows={2}
                    value={cancelReason}
                    onChange={(e) => {
                      setCancelReason(e.target.value);
                      setCancelError(null);
                    }}
                    placeholder="مثال: درخواست مشتری قبل از ارسال یا اتمام موجودی انبار"
                    className="w-full p-2.5 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#b42318]"
                  />
                  {cancelError && <p className="mt-1 text-xs text-[#b42318]">{cancelError}</p>}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-2 text-xs text-[#111315] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={restoreStock}
                      onChange={(e) => setRestoreStock(e.target.checked)}
                      className="h-4 w-4 accent-[#b42318]"
                    />
                    <span>بازگرداندن خودکار موجودی اقلام سفارش در سرور</span>
                  </label>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={handleRequestCancel}
                  >
                    لغو قطعی سفارش
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        onConfirm={() => void handleConfirmCancel()}
        loading={cancelling}
        tone="danger"
        title={`لغو سفارش #${order?.orderCode || ''}`}
        description={`آیا از لغو سفارش #${order?.orderCode || ''} به دلیل «${cancelReason.trim()}» اطمینان دارید؟`}
        confirmLabel="تایید لغو سفارش"
      />
    </>
  );
}
