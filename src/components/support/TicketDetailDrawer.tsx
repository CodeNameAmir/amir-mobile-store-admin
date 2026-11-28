import { useEffect, useState, type FormEvent } from 'react';
import { Clock } from 'lucide-react';
import type { SupportTicket, TicketPriority, TicketStatus } from '../../types/admin';
import {
  formatPersianDateTime,
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITY_TONES,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_TONES,
  toPersianDigits,
} from '../../utils/formatters';
import { isTicketSlaOverdue } from '../../utils/crmAndSla';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { StatusTag } from '../ui/StatusBadge';

export interface TicketUpdatePayload {
  status: TicketStatus;
  priority: TicketPriority;
  assignedTo: string;
  internalNote: string;
  adminReply: string;
}

interface TicketDetailDrawerProps {
  ticket: SupportTicket | null;
  onClose: () => void;
  onSave: (id: string, payload: TicketUpdatePayload) => Promise<void>;
}

const STATUS_OPTIONS: TicketStatus[] = ['open', 'in_progress', 'resolved'];
const PRIORITY_OPTIONS: TicketPriority[] = ['low', 'normal', 'high', 'urgent'];

const CANNED_REPLIES: Array<{ label: string; text: string }> = [
  {
    label: 'پیگیری ارسال مرسوله',
    text: 'سلام و وقت بخیر. مرسوله شما در صف ارسال قرار دارد و کد رهگیری پس از تحویل به شرکت پست/پیک از طریق پیامک برای شما ارسال خواهد شد.',
  },
  {
    label: 'راهنمای فعال‌سازی رجیستری',
    text: 'سلام و وقت بخیر. کد فعال‌سازی سامانه همتا روی کارت گارانتی داخل جعبه درج شده است. لطفاً مطابق راهنما از طریق کد دستوری #7777* انتقال مالکیت را به شماره سیم‌کارت خود انجام دهید.',
  },
  {
    label: 'تایید استرداد وجه',
    text: 'سلام و وقت بخیر. درخواست مرجوعی و استرداد وجه شما بررسی و تایید شد. مبلغ ظرف ۲۴ تا ۷۲ ساعت کاری به شماره شبا/کارت مبدأ عودت داده می‌شود.',
  },
];

export function TicketDetailDrawer({
  ticket,
  onClose,
  onSave,
}: TicketDetailDrawerProps) {
  const [status, setStatus] = useState<TicketStatus>('open');
  const [priority, setPriority] = useState<TicketPriority>('normal');
  const [assignedTo, setAssignedTo] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [adminReply, setAdminReply] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!ticket) return;
    setStatus(ticket.status);
    setPriority(ticket.priority || 'normal');
    setAssignedTo(ticket.assignedTo || '');
    setInternalNote(ticket.internalNote || '');
    setAdminReply(ticket.adminReply || '');
  }, [ticket]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ticket) return;
    setSaving(true);
    try {
      await onSave(ticket.id, {
        status,
        priority,
        assignedTo: assignedTo.trim(),
        internalNote: internalNote.trim(),
        adminReply: adminReply.trim(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const overdue = ticket ? isTicketSlaOverdue(ticket) : false;

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
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusTag tone={TICKET_PRIORITY_TONES[ticket.priority || 'normal']}>
                اولویت {TICKET_PRIORITY_LABELS[ticket.priority || 'normal']}
              </StatusTag>
              <StatusTag tone={TICKET_STATUS_TONES[ticket.status]}>
                {TICKET_STATUS_LABELS[ticket.status]}
              </StatusTag>
              {overdue && (
                <StatusTag
                  tone="danger"
                  icon={<Clock className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />}
                >
                  عبور از SLA
                </StatusTag>
              )}
            </div>
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
            {ticket.slaDueAt && (
              <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                <dt className="text-[#52565e]">مهلت پاسخگویی (SLA)</dt>
                <dd className={`font-medium tabular-nums-fa ${overdue ? 'text-[#b42318]' : 'text-[#111315]'}`}>
                  {formatPersianDateTime(ticket.slaDueAt)}
                </dd>
              </div>
            )}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <label htmlFor="ticket-priority" className="block font-medium text-[#111315] mb-1.5">
                  اولویت پیگیری
                </label>
                <select
                  id="ticket-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TicketPriority)}
                  className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {TICKET_PRIORITY_LABELS[p]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="ticket-assigned" className="block font-medium text-[#111315] mb-1.5">
                کارشناس مسئول پیگیری (اختیاری)
              </label>
              <input
                id="ticket-assigned"
                type="text"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                placeholder="مثلاً: کارشناس پشتیبانی یا ایمیل همکار"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                <label htmlFor="ticket-reply" className="font-medium text-[#111315]">
                  پاسخ قابل مشاهده برای مشتری
                </label>
                <div className="flex flex-wrap items-center gap-1">
                  {CANNED_REPLIES.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setAdminReply(preset.text)}
                      className="px-2 py-0.5 rounded border border-black/[0.1] bg-white text-[11px] text-[#0f49bd] hover:bg-[#eef3fc] transition-colors duration-150"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                id="ticket-reply"
                rows={4}
                value={adminReply}
                onChange={(e) => setAdminReply(e.target.value)}
                placeholder="پاسخ نهایی یا توضیحات پیگیری برای مشتری..."
                className="w-full p-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] leading-5 focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <div>
              <label htmlFor="ticket-internal-note" className="block font-medium text-[#111315] mb-1.5">
                یادداشت داخلی تیم پشتیبانی (مخفی از مشتری)
              </label>
              <textarea
                id="ticket-internal-note"
                rows={2}
                value={internalNote}
                onChange={(e) => setInternalNote(e.target.value)}
                placeholder="خلاصه تماس تلفنی، نتیجه استعلام انبار یا ارجاع داخلی..."
                className="w-full p-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] leading-5 focus:outline-none focus:border-[#0f49bd]"
              />
            </div>
          </form>
        </div>
      )}
    </Drawer>
  );
}
