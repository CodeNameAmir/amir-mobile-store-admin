import type { ReactNode } from 'react';
import type { OrderRecord, OrderStatus, UserRole } from '../../types/admin';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
  resolveOrderPaymentSummary,
  USER_ROLE_LABELS,
} from '../../utils/formatters';

interface SemanticStatusProps {
  tone: 'info' | 'warning' | 'success' | 'neutral' | 'danger';
  icon?: ReactNode;
  children: ReactNode;
}

const TONE_MAP: Record<
  SemanticStatusProps['tone'],
  { surface: string; dot: string }
> = {
  info: {
    surface: 'bg-[#eef3fc] text-[#0f49bd] border-[#c7d7f8]',
    dot: 'bg-[#0f49bd]',
  },
  warning: {
    surface: 'bg-[#fffbeb] text-[#9a4a06] border-[#fde68a]',
    dot: 'bg-[#d97706]',
  },
  success: {
    surface: 'bg-[#f0fdf4] text-[#166534] border-[#bbf7d0]',
    dot: 'bg-[#16a34a]',
  },
  neutral: {
    surface: 'bg-[#f4f5f7] text-[#52565e] border-black/[0.08]',
    dot: 'bg-[#9aa0ab]',
  },
  danger: {
    surface: 'bg-[#fef3f2] text-[#b42318] border-[#fecaca]',
    dot: 'bg-[#dc2626]',
  },
};

const ORDER_DOT_MAP: Record<OrderStatus, string> = {
  pending_payment: 'bg-[#d97706]',
  paid: 'bg-[#0f49bd]',
  preparing: 'bg-[#d97706]',
  shipped: 'bg-[#111315]',
  delivered: 'bg-[#16a34a]',
  cancelled: 'bg-[#dc2626]',
  expired: 'bg-[#9aa0ab]',
  returned: 'bg-[#d97706]',
};

export function StatusTag({ tone, icon, children }: SemanticStatusProps) {
  const styles = TONE_MAP[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap shrink-0 ${styles.surface}`}
    >
      {icon ? (
        <span className="inline-flex items-center shrink-0">{icon}</span>
      ) : (
        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${styles.dot}`} aria-hidden="true" />
      )}
      <span>{children}</span>
    </span>
  );
}

export function OrderStatusBadge({ status }: { status?: OrderStatus | string | null }) {
  const isKnownStatus = Boolean(status && status in ORDER_STATUS_TONES);
  if (!isKnownStatus) {
    const rawLabel = typeof status === 'string' && status.trim() ? status.trim() : '';
    return (
      <StatusTag tone="neutral">
        {rawLabel ? `وضعیت نامشخص (${rawLabel})` : 'وضعیت نامشخص'}
      </StatusTag>
    );
  }

  const knownStatus = status as OrderStatus;
  const tone = ORDER_STATUS_TONES[knownStatus];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap shrink-0 ${tone.bg} ${tone.text} ${tone.border}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full shrink-0 ${ORDER_DOT_MAP[knownStatus]}`}
        aria-hidden="true"
      />
      <span>{ORDER_STATUS_LABELS[knownStatus]}</span>
    </span>
  );
}

export function OrderPaymentBadge({
  order,
}: {
  order: Pick<OrderRecord, 'paymentStatus' | 'shaparakRef' | 'status'>;
}) {
  const summary = resolveOrderPaymentSummary(order);
  return <StatusTag tone={summary.tone}>{summary.label}</StatusTag>;
}

export function StockStatusTag({
  inStock,
  stockCount,
  lowThreshold = 5,
}: {
  inStock: boolean;
  stockCount: number;
  lowThreshold?: number;
}) {
  if (!inStock || stockCount <= 0) {
    return <StatusTag tone="danger">ناموجود</StatusTag>;
  }
  if (stockCount <= lowThreshold) {
    return <StatusTag tone="warning">موجودی کم</StatusTag>;
  }
  return <StatusTag tone="success">موجود در انبار</StatusTag>;
}

export function RoleTag({ role }: { role: UserRole }) {
  if (role === 'admin') {
    return <StatusTag tone="info">{USER_ROLE_LABELS.admin}</StatusTag>;
  }
  return <StatusTag tone="neutral">{USER_ROLE_LABELS.customer}</StatusTag>;
}
