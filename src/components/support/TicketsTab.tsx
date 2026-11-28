import { useCallback, useEffect, useState } from 'react';
import { Clock, MessageSquare, RefreshCw, Search } from 'lucide-react';
import type { SupportTicket, TicketPriority, TicketStatus } from '../../types/admin';
import { adminApi } from '../../services/adminApi';
import { ApiError, isEndpointUnsupportedError } from '../../services/apiClient';
import { useToast } from '../../context/ToastContext';
import {
  formatPersianDateTime,
  TICKET_PRIORITY_LABELS,
  TICKET_PRIORITY_TONES,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_TONES,
  toPersianDigits,
} from '../../utils/formatters';
import { isTicketSlaOverdue } from '../../utils/crmAndSla';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Pagination } from '../ui/Pagination';
import { StatusTag } from '../ui/StatusBadge';
import {
  EmptyState,
  EndpointUnsupportedState,
  ErrorState,
  LoadingSkeleton,
} from '../ui/StateViews';
import { TicketDetailDrawer, type TicketUpdatePayload } from './TicketDetailDrawer';

export function TicketsTab() {
  const { pushToast } = useToast();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | 'all'>('all');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<SupportTicket[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUnsupported(false);
    try {
      const res = await adminApi.listTickets({
        search: debouncedSearch.trim() || undefined,
        status: statusFilter,
        page,
        pageSize: 12,
      });
      setItems(Array.isArray(res.items) ? res.items : []);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      if (isEndpointUnsupportedError(err)) {
        setUnsupported(true);
      } else {
        setError(err instanceof ApiError ? err.message : 'خطا در دریافت تیکت‌های پشتیبانی.');
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, page]);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const handleSaveTicket = async (id: string, payload: TicketUpdatePayload) => {
    try {
      const res = await adminApi.updateTicket(id, {
        status: payload.status,
        priority: payload.priority,
        assignedTo: payload.assignedTo || null,
        internalNote: payload.internalNote || null,
        adminReply: payload.adminReply || null,
      });
      setItems((prev) => prev.map((t) => (t.id === id ? res.ticket : t)));
      pushToast({
        tone: 'success',
        title: 'تیکت به‌روزرسانی شد',
        description: `#${res.ticket.ticketCode}`,
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'خطا در ثبت پاسخ تیکت',
        description: err instanceof ApiError ? err.message : 'لطفاً دوباره تلاش کنید.',
      });
      throw err;
    }
  };

  const visibleItems =
    priorityFilter === 'all'
      ? items
      : items.filter((t) => (t.priority || 'normal') === priorityFilter);

  return (
    <div className="space-y-4">
      <Card padding="sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[240px]">
            <div className="relative flex-1 max-w-sm">
              <Search
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7c818c]"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="جستجو با کد تیکت، نام مشتری یا تلفن..."
                aria-label="جستجوی تیکت پشتیبانی"
                className="w-full h-9 pr-9 pl-3 rounded-lg border border-black/[0.14] bg-[#f6f6f7] text-xs text-[#111315] placeholder:text-[#7c818c] focus:bg-white focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <select
              aria-label="فیلتر وضعیت تیکت"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as TicketStatus | 'all');
                setPage(1);
              }}
              className="h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
            >
              <option value="all">همه وضعیت‌ها</option>
              <option value="open">باز / در انتظار پاسخ</option>
              <option value="in_progress">در حال بررسی</option>
              <option value="resolved">بسته و حل‌شده</option>
            </select>

            <select
              aria-label="فیلتر اولویت تیکت"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as TicketPriority | 'all')}
              className="h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
            >
              <option value="all">همه اولویت‌ها</option>
              <option value="urgent">فوری</option>
              <option value="high">بالا</option>
              <option value="normal">عادی</option>
              <option value="low">کم</option>
            </select>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadTickets()}
            icon={<RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
          >
            به‌روزرسانی
          </Button>
        </div>
      </Card>

      <Card padding="md">
        {loading ? (
          <LoadingSkeleton rows={5} />
        ) : unsupported ? (
          <EndpointUnsupportedState
            title="بخش تیکت‌های پشتیبانی در سرور API هنوز فعال نشده است"
            description="فرم مشاهده و پاسخ به تیکت‌ها آماده است، اما Endpoint تیکت‌های مدیریت هنوز در Backend فعال نشده است."
            endpointHint="GET /api/admin/tickets"
            onRetry={() => void loadTickets()}
          />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void loadTickets()} />
        ) : visibleItems.length === 0 ? (
          <EmptyState
            title="تیکتی یافت نشد"
            description="هنوز درخواست پشتیبانی با این فیلترها ثبت نشده است."
            icon={<MessageSquare className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-black/[0.08] text-xs font-medium text-[#52565e]">
                    <th className="py-3 px-3">کد تیکت</th>
                    <th className="py-3 px-3">ارسال‌کننده</th>
                    <th className="py-3 px-3">دپارتمان / کارشناس</th>
                    <th className="py-3 px-3">خلاصه پیام</th>
                    <th className="py-3 px-3">اولویت و SLA</th>
                    <th className="py-3 px-3">وضعیت</th>
                    <th className="py-3 px-3 text-left">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.06] text-xs">
                  {visibleItems.map((ticket) => {
                    const priority = ticket.priority || 'normal';
                    const overdue = isTicketSlaOverdue(ticket);
                    return (
                      <tr key={ticket.id} className="hover:bg-[#f7f8fa] transition-colors duration-150">
                        <td className="py-3 px-3 font-mono font-semibold text-[#0f49bd]" dir="ltr">
                          #{ticket.ticketCode}
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-semibold text-[#111315]">{ticket.fullName}</p>
                          <p className="text-[11px] text-[#52565e] tabular-nums-fa" dir="ltr">
                            {ticket.phone ? toPersianDigits(ticket.phone) : '—'}
                          </p>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <p className="text-[#111315]">{ticket.department}</p>
                          {ticket.orderCode && (
                            <p className="text-[11px] font-mono text-[#0f49bd]" dir="ltr">
                              #{ticket.orderCode}
                            </p>
                          )}
                          {ticket.assignedTo && (
                            <p className="text-[11px] text-[#52565e]">مسئول: {ticket.assignedTo}</p>
                          )}
                        </td>
                        <td className="py-3 px-3 text-[#52565e] max-w-xs truncate">
                          <p className="truncate">{ticket.message}</p>
                          <p className="mt-0.5 text-[11px] text-[#7c818c] tabular-nums-fa">
                            {formatPersianDateTime(ticket.createdAt)}
                          </p>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex flex-col items-start gap-1">
                            <StatusTag tone={TICKET_PRIORITY_TONES[priority]}>
                              اولویت {TICKET_PRIORITY_LABELS[priority]}
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
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <StatusTag tone={TICKET_STATUS_TONES[ticket.status]}>
                            {TICKET_STATUS_LABELS[ticket.status]}
                          </StatusTag>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-left">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setActiveTicket(ticket)}
                          >
                            پاسخ و پیگیری
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={12}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      <TicketDetailDrawer
        ticket={activeTicket}
        onClose={() => setActiveTicket(null)}
        onSave={handleSaveTicket}
      />
    </div>
  );
}
