import type { ReactNode } from 'react';
import {
  CheckCircle2,
  Clock,
  CreditCard,
  ShieldCheck,
  Truck,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import type { OrderStatus, UserRole } from '../../types/admin';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
  USER_ROLE_LABELS,
} from '../../utils/formatters';

interface SemanticStatusProps {
  tone: 'info' | 'warning' | 'success' | 'neutral' | 'danger';
  icon?: ReactNode;
  children: ReactNode;
}

const TONE_MAP: Record<SemanticStatusProps['tone'], string> = {
  info: 'bg-[#dbe1ff]/70 text-[#004ac6] border-[#b4c5ff]',
  warning: 'bg-[#ffdbca]/70 text-[#8e3c00] border-[#f4bfa4]',
  success: 'bg-[#dcfce7] text-[#166534] border-[#bbf7d0]',
  neutral: 'bg-[#eff4ff] text-[#434655] border-[#c3c6d7]',
  danger: 'bg-[#ffdad6] text-[#ba1a1a] border-[#f5b7b1]',
};

export function StatusTag({ tone, icon, children }: SemanticStatusProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 ${TONE_MAP[tone]}`}
    >
      {icon}
      <span>{children}</span>
    </span>
  );
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const tone = ORDER_STATUS_TONES[status];
  const icon =
    status === 'paid' ? (
      <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
    ) : status === 'preparing' ? (
      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
    ) : status === 'shipped' ? (
      <Truck className="h-3.5 w-3.5" aria-hidden="true" />
    ) : (
      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
    );

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 ${tone.bg} ${tone.text} ${tone.border}`}
    >
      {icon}
      <span>{ORDER_STATUS_LABELS[status]}</span>
    </span>
  );
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
    return (
      <StatusTag tone="danger" icon={<XCircle className="h-3.5 w-3.5" aria-hidden="true" />}>
        ناموجود
      </StatusTag>
    );
  }
  if (stockCount <= lowThreshold) {
    return (
      <StatusTag tone="warning" icon={<AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}>
        موجودی کم
      </StatusTag>
    );
  }
  return (
    <StatusTag tone="success" icon={<CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}>
      موجود در انبار
    </StatusTag>
  );
}

export function RoleTag({ role }: { role: UserRole }) {
  if (role === 'admin') {
    return (
      <StatusTag tone="info" icon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />}>
        {USER_ROLE_LABELS.admin}
      </StatusTag>
    );
  }
  return <StatusTag tone="neutral">{USER_ROLE_LABELS.customer}</StatusTag>;
}
