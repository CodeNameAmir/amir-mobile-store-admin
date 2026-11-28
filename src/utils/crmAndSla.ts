import type { AdminCustomerSummary, TicketStatus } from '../types/admin';
import { buildCsv, ORDER_STATUS_LABELS, USER_ROLE_LABELS } from './formatters';
import { maskEmail, maskPhone } from './masking';

export interface CustomerSegmentInfo {
  key: 'blocked' | 'vip' | 'returning' | 'new';
  label: string;
  tone: 'danger' | 'info' | 'success' | 'neutral';
}

export function classifyCustomerSegment(
  customer: Pick<AdminCustomerSummary, 'ordersCount' | 'totalSpent' | 'isBlocked'>
): CustomerSegmentInfo {
  if (customer.isBlocked) {
    return { key: 'blocked', label: 'مسدود', tone: 'danger' };
  }
  if (customer.totalSpent >= 100_000_000 || customer.ordersCount >= 5) {
    return { key: 'vip', label: 'مشتری VIP', tone: 'info' };
  }
  if (customer.ordersCount >= 2) {
    return { key: 'returning', label: 'خریدار تکراری', tone: 'success' };
  }
  return { key: 'new', label: 'مشتری جدید', tone: 'neutral' };
}

export function isTicketSlaOverdue(
  ticket: { status: TicketStatus; slaDueAt?: string | null },
  nowMs = Date.now()
): boolean {
  if (ticket.status === 'resolved' || !ticket.slaDueAt) {
    return false;
  }
  const dueMs = new Date(ticket.slaDueAt).getTime();
  if (!Number.isFinite(dueMs)) {
    return false;
  }
  return dueMs < nowMs;
}

export function buildCustomersCsv(
  customers: AdminCustomerSummary[],
  includeFullPii: boolean
): string {
  return buildCsv(
    [
      'نام کامل',
      'نام کاربری',
      'ایمیل',
      'موبایل',
      'نقش',
      'سگمنت',
      'تعداد سفارش',
      'مجموع خرید (تومان)',
      'وضعیت',
      'آخرین ورود',
    ],
    customers.map((c) => {
      const seg = classifyCustomerSegment(c);
      const email = includeFullPii ? c.email : maskEmail(c.email);
      const phone = c.phone ? (includeFullPii ? c.phone : maskPhone(c.phone)) : '—';
      const statusLabel = c.isBlocked
        ? 'مسدود'
        : c.isActive === false
          ? 'غیرفعال'
          : 'فعال';
      return [
        c.fullName,
        c.username ? `@${c.username}` : '—',
        email,
        phone,
        USER_ROLE_LABELS[c.role] || c.role,
        seg.label,
        c.ordersCount,
        c.totalSpent,
        statusLabel,
        c.lastLoginAt || '—',
      ];
    })
  );
}

export function summarizeOrderStatuses(
  orders: Array<{ status: string; totalAmount: number }>
): Array<{ status: string; label: string; count: number; revenue: number }> {
  const map = new Map<string, { count: number; revenue: number }>();
  for (const order of orders) {
    const cur = map.get(order.status) ?? { count: 0, revenue: 0 };
    cur.count += 1;
    cur.revenue += Number.isFinite(order.totalAmount) ? order.totalAmount : 0;
    map.set(order.status, cur);
  }
  return Array.from(map.entries())
    .map(([status, stats]) => ({
      status,
      label: ORDER_STATUS_LABELS[status as keyof typeof ORDER_STATUS_LABELS] || status,
      count: stats.count,
      revenue: stats.revenue,
    }))
    .sort((a, b) => b.count - a.count);
}
