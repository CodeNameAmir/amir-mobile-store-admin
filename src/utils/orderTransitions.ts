import type { OrderStatus } from '../types/admin';

export const ORDER_ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending_payment: ['pending_payment', 'paid', 'cancelled', 'expired'],
  paid: ['paid', 'preparing', 'shipped', 'cancelled'],
  preparing: ['preparing', 'shipped', 'delivered', 'cancelled'],
  shipped: ['shipped', 'delivered', 'returned'],
  delivered: ['delivered', 'returned'],
  cancelled: ['cancelled'],
  expired: ['expired'],
  returned: ['returned'],
};

export const ORDER_FULFILLMENT_EDITABLE_STATUSES: readonly OrderStatus[] = [
  'pending_payment',
  'paid',
  'preparing',
  'shipped',
  'delivered',
  'returned',
];

export const CANCELLABLE_ORDER_STATUSES: readonly OrderStatus[] = [
  'pending_payment',
  'paid',
  'preparing',
];

export function canTransitionOrderStatus(
  fromStatus: OrderStatus | string | undefined,
  toStatus: OrderStatus | string
): boolean {
  if (!fromStatus) return true;
  const allowed = ORDER_ALLOWED_TRANSITIONS[fromStatus as OrderStatus];
  if (!allowed) return true;
  return allowed.includes(toStatus as OrderStatus);
}

export function getAllowedNextStatuses(currentStatus: OrderStatus | string | undefined): OrderStatus[] {
  if (!currentStatus) return ['paid', 'preparing', 'shipped', 'delivered'];
  if (currentStatus === 'cancelled') return ['cancelled'];
  const allowed = ORDER_ALLOWED_TRANSITIONS[currentStatus as OrderStatus];
  if (!allowed) return [...ORDER_FULFILLMENT_EDITABLE_STATUSES];
  return allowed.filter((st) => st !== 'cancelled');
}

export function canCancelOrder(status: OrderStatus | string | undefined): boolean {
  if (!status) return false;
  return CANCELLABLE_ORDER_STATUSES.includes(status as OrderStatus);
}

export function validateOrderCancellation(
  status: OrderStatus | string | undefined,
  reason: string
): string | null {
  if (!canCancelOrder(status)) {
    return 'فقط سفارش‌های در انتظار پرداخت، ثبت‌شده یا در حال آماده‌سازی قابل لغو هستند.';
  }
  const clean = reason.trim();
  if (clean.length < 4) {
    return 'وارد کردن دلیل لغو سفارش (حداقل ۴ کاراکتر) الزامی است.';
  }
  return null;
}
