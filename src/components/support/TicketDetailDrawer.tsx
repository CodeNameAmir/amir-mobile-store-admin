import { useEffect, useState, type FormEvent } from 'react';
import type { SupportTicket, TicketStatus } from '../../types/admin';
import {
  formatPersianDateTime,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_TONES,
  toPersianDigits,
} from '../../utils/formatters';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { StatusTag } from '../ui/StatusBadge';

interface TicketDetailDrawerProps {
  ticket: SupportTicket | null;
  onClose: () => void;
  onSave: (id: string, payload: { status: TicketStatus; adminReply: string }) => Promise<void>;
}

const STATUS_OPTIONS: TicketStatus[] = ['open', 'in_progress', 'resolved'];

export function TicketDetailDrawer({
  ticket,
  onClose,
  onSave,
}: TicketDetailDrawerProps) {
  const [status, setStatus] = useState<TicketStatus>('open');
  const [adminReply, setAdminReply] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!ticket) return;
    setStatus(ticket.status);
    setAdminReply(ticket.adminReply || '');
  }, [ticket]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ticket) return;
    setSaving(true);
    try {
      await onSave(ticket.id, {
        status,
        adminReply: adminReply.trim(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      open={Boolean(ticket)}
      onClose={onClose}
      title={ticket ? `تیکت پشتیبانی #${ticket.ticketCode}` : ''}
      subtitle={ticket ? formatPersianDateTime(ticket.createdAt) : ''}
      widthClass="max-w-xl"
      footer={
        ticket && (
          <>
            <Button variant="outline" onClick={onClose} disabled={saving}>
              بستن
            </Button>
            <Button type="submit" form="ticket-reply-form" variant="primary" loading={saving}>
              ثبت پاسخ و تغییر وضعیت
            </Button>
          </>
        )
      }
    >
      {ticket && (
        <div className="space-y-6 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[#f6f6f7] border border-black/[0.08]">
            <div>
              <p className="text-[#52565e]">دپارتمان مربوطه</p>
              <p className="mt-1 font-semibold text-[#111315]">{ticket.department}</p>
            </div>
            <StatusTag tone={TICKET_STATUS_TONES[ticket.status]}>
              {TICKET_STATUS_LABELS[ticket.status]}
            </StatusTag>
          </div>

          <dl className="divide-y divide-black/[0.06] rounded-xl border border-black/[0.08]">
            <div className="flex items-center justify-between gap-4 px-4 py-2.5">
              <dt className="text-[#52565e]">نام ارسال‌کننده</dt>
              <dd className="font-medium text-[#111315]">{ticket.fullName}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-2.5">
              <dt className="text-[#52565e]">شماره تماس</dt>
              <dd className="font-medium text-[#111315] tabular-nums-fa" dir="ltr">
                {ticket.phone ? toPersianDigits(ticket.phone) : '—'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 px-4 py-2.5">
              <dt className="text-[#52565e]">کد سفارش مرتبط</dt>
              <dd className="font-mono font-medium text-[#0f49bd]" dir="ltr">
                {ticket.orderCode ? `#${ticket.orderCode}` : '—'}
              </dd>
            </div>
          </dl>

          <div className="space-y-2">
            <h3 className="font-semibold text-[#111315]">متن پیام مشتری</h3>
            <p className="p-4 rounded-xl bg-[#f6f6f7] border border-black/[0.08] leading-6 text-[#111315] whitespace-pre-line">
              {ticket.message}
            </p>
          </div>

          <form
            id="ticket-reply-form"
            onSubmit={handleSubmit}
            className="p-4 rounded-xl bg-[#f6f6f7] border border-black/[0.08] space-y-4"
          >
            <div>
              <label htmlFor="ticket-status" className="block font-medium text-[#111315] mb-1.5">
                وضعیت تیکت
              </label>
              <select
                id="ticket-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TicketStatus)}
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              >
                {STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {TICKET_STATUS_LABELS[st]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ticket-reply" className="block font-medium text-[#111315] mb-1.5">
                پاسخ کارشناس / مدیر
              </label>
              <textarea
                id="ticket-reply"
                rows={4}
                value={adminReply}
                onChange={(e) => setAdminReply(e.target.value)}
                placeholder="پاسخ نهایی یا توضیحات پیگیری برای مشتری..."
                className="w-full p-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] leading-5 focus:outline-none focus:border-[#0f49bd]"
              />
            </div>
          </form>
        </div>
      )}
    </Drawer>
  );
}
