import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { RefreshCw, RotateCcw, Search } from 'lucide-react';
import type { OrderReturnRecord, OrderReturnStatus } from '../types/admin';
import { adminApi } from '../services/adminApi';
import { ApiError, isEndpointUnsupportedError } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  formatPersianDateTime,
  formatToman,
  RETURN_STATUS_LABELS,
  toEnglishDigits,
  toPersianDigits,
} from '../utils/formatters';
import { maskPhone } from '../utils/masking';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { StatusTag } from '../components/ui/StatusBadge';
import { SwitchToggle } from '../components/ui/SwitchToggle';
import { Pagination } from '../components/ui/Pagination';
import {
  EmptyState,
  EndpointUnsupportedState,
  ErrorState,
  LoadingSkeleton,
} from '../components/ui/StateViews';

const RETURN_TONE: Record<
  OrderReturnStatus,
  'warning' | 'info' | 'success' | 'danger' | 'neutral'
> = {
  requested: 'warning',
  approved: 'info',
  received: 'info',
  refunded: 'success',
  rejected: 'danger',
};

export function ReturnsPage() {
  const { can, canViewFullPii } = useAuth();
  const { pushToast } = useToast();

  const canHandleReturns = can('orders.update') || can('payments.refund');

  const [returns, setReturns] = useState<OrderReturnRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderReturnStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);

  const [activeReturn, setActiveReturn] = useState<OrderReturnRecord | null>(null);
  const [nextStatus, setNextStatus] = useState<OrderReturnStatus>('approved');
  const [refundAmount, setRefundAmount] = useState('');
  const [restoreStock, setRestoreStock] = useState(true);
  const [adminNote, setAdminNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadReturns = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUnsupported(false);
    try {
      const res = await adminApi.listReturns({
        search: debouncedSearch || undefined,
        status: statusFilter,
        page,
        pageSize: 15,
      });
      setReturns(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      if (isEndpointUnsupportedError(err)) {
        setUnsupported(true);
      } else {
        setError(
          err instanceof ApiError ? err.message : 'خطا در دریافت فهرست درخواست‌های مرجوعی.'
        );
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, page]);

  useEffect(() => {
    void loadReturns();
  }, [loadReturns]);

  const openManageModal = (item: OrderReturnRecord) => {
    setActiveReturn(item);
    setNextStatus(item.status === 'requested' ? 'approved' : item.status);
    setRefundAmount(String(item.refundAmount || 0));
    setRestoreStock(item.restoreStock);
    setAdminNote(item.adminNote || '');
    setModalError(null);
  };

  const handleSaveReturn = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeReturn) return;
    const numericRefund = Math.max(0, Number(toEnglishDigits(refundAmount)) || 0);
    if (nextStatus === 'refunded' && numericRefund <= 0) {
      setModalError('برای ثبت وضعیت تسویه و مستردشده، مبلغ استرداد باید بزرگ‌تر از صفر باشد.');
      return;
    }

    setModalError(null);
    setSaving(true);
    try {
      const res = await adminApi.updateReturnStatus(activeReturn.id, {
        status: nextStatus,
        refundAmount: numericRefund,
        restoreStock,
        adminNote: adminNote.trim() || null,
      });
      setReturns((prev) =>
        prev.map((row) => (row.id === activeReturn.id ? res.returnRecord : row))
      );
      pushToast({
        tone: 'success',
        title: 'وضعیت درخواست مرجوعی ثبت شد',
        description: `${activeReturn.returnCode} — ${RETURN_STATUS_LABELS[nextStatus]}`,
      });
      setActiveReturn(null);
    } catch (err) {
      setModalError(
        err instanceof ApiError ? err.message : 'خطا در ثبت تغییرات درخواست مرجوعی.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#111315]">مرجوعی و بازگشت کالا (RMA)</h1>
          <p className="mt-1 text-xs text-[#52565e]">
            بررسی درخواست‌های بازگشت کالا، تایید تحویل به انبار، بازگشت موجودی و استرداد وجه
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void loadReturns()}
          icon={<RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
        >
          به‌روزرسانی
        </Button>
      </div>

      <Card padding="sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative sm:col-span-2">
            <Search
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7c818c]"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجو با کد مرجوعی، کد سفارش یا نام مشتری..."
              aria-label="جستجوی درخواست مرجوعی"
              className="w-full h-9 pr-9 pl-3 rounded-lg border border-black/[0.14] bg-[#f6f6f7] text-xs text-[#111315] placeholder:text-[#7c818c] focus:bg-white focus:outline-none focus:border-[#0f49bd]"
            />
          </div>

          <select
            aria-label="فیلتر وضعیت مرجوعی"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as OrderReturnStatus | 'all');
              setPage(1);
            }}
            className="h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
          >
            <option value="all">همه وضعیت‌های مرجوعی</option>
            {(Object.keys(RETURN_STATUS_LABELS) as OrderReturnStatus[]).map((st) => (
              <option key={st} value={st}>
                {RETURN_STATUS_LABELS[st]}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card padding="md">
        {loading ? (
          <LoadingSkeleton rows={6} />
        ) : unsupported ? (
          <EndpointUnsupportedState
            title="ماژول مرجوعی کالا (RMA) در سرور API هنوز فعال نشده است"
            description="برای مدیریت درخواست‌های بازگشت کالا و بازگردانی خودکار موجودی، مسیرهای RMA را در سرور پیاده‌سازی کنید."
            endpointHint="GET /api/admin/returns | PATCH /api/admin/returns/:id"
            onRetry={() => void loadReturns()}
          />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void loadReturns()} />
        ) : returns.length === 0 ? (
          <EmptyState
            title="درخواست مرجوعی ثبت نشده است"
            description="درخواست‌های بازگشت کالا توسط مشتریان در این بخش نمایش داده می‌شوند."
            icon={<RotateCcw className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-black/[0.08] text-xs font-medium text-[#52565e]">
                    <th className="py-3 px-3">کد مرجوعی / سفارش</th>
                    <th className="py-3 px-3">مشتری</th>
                    <th className="py-3 px-3">اقلام و دلیل مرجوعی</th>
                    <th className="py-3 px-3">مبلغ استرداد</th>
                    <th className="py-3 px-3">بازگشت موجودی</th>
                    <th className="py-3 px-3">وضعیت</th>
                    <th className="py-3 px-3">تاریخ ثبت</th>
                    <th className="py-3 px-3 text-left">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.06] text-xs">
                  {returns.map((row) => (
                    <tr
                      key={row.id}
                      className="hover:bg-[#f7f8fa] transition-colors duration-150"
                    >
                      <td className="py-3 px-3 whitespace-nowrap">
                        <p className="font-mono font-semibold text-[#111315]" dir="ltr">
                          {row.returnCode}
                        </p>
                        <p className="text-[11px] font-mono text-[#0f49bd]" dir="ltr">
                          {row.orderCode}
                        </p>
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-medium text-[#111315]">{row.customerName || 'مشتری'}</p>
                        {row.customerPhone && (
                          <p className="text-[11px] font-mono text-[#52565e]" dir="ltr">
                            {canViewFullPii
                              ? toPersianDigits(row.customerPhone)
                              : toPersianDigits(maskPhone(row.customerPhone))}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-3 max-w-xs">
                        <p className="text-[#111315] truncate">{row.reason || '—'}</p>
                        <p className="text-[11px] text-[#52565e] mt-0.5 tabular-nums-fa">
                          {toPersianDigits(row.items.length)} ردیف کالا
                        </p>
                      </td>
                      <td className="py-3 px-3 font-medium text-[#111315] tabular-nums-fa whitespace-nowrap">
                        {row.refundAmount > 0 ? formatToman(row.refundAmount) : 'تعیین‌نشده'}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <StatusTag tone={row.restoreStock ? 'info' : 'neutral'}>
                          {row.restoreStock ? 'بله' : 'خیر'}
                        </StatusTag>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <StatusTag tone={RETURN_TONE[row.status]}>
                          {RETURN_STATUS_LABELS[row.status]}
                        </StatusTag>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-[#52565e] tabular-nums-fa">
                        {formatPersianDateTime(row.createdAt)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-left">
                        {canHandleReturns && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => openManageModal(row)}
                          >
                            بررسی و اقدام
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={15}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      <Modal
        open={Boolean(activeReturn)}
        onClose={() => setActiveReturn(null)}
        title={`بررسی مرجوعی ${activeReturn?.returnCode || ''}`}
        subtitle={
          activeReturn ? `سفارش ${activeReturn.orderCode} · ${activeReturn.reason}` : undefined
        }
        maxWidthClass="max-w-lg"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setActiveReturn(null)}
              disabled={saving}
            >
              بستن
            </Button>
            <Button type="submit" form="return-manage-form" variant="primary" loading={saving}>
              ثبت وضعیت مرجوعی
            </Button>
          </>
        }
      >
        <form id="return-manage-form" onSubmit={handleSaveReturn} className="space-y-4">
          {modalError && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-[#fef3f2] border border-[#fecaca] text-xs font-medium text-[#b42318]"
            >
              {modalError}
            </div>
          )}

          {activeReturn && activeReturn.items.length > 0 && (
            <div className="p-3 rounded-lg bg-[#f6f6f7] border border-black/[0.06] space-y-1.5">
              <p className="text-xs font-medium text-[#111315]">اقلام درخواست مرجوعی</p>
              {activeReturn.items.map((item, idx) => (
                <div
                  key={`${item.sku || item.nameFa}-${idx}`}
                  className="flex items-center justify-between text-xs text-[#52565e]"
                >
                  <span>{item.nameFa}</span>
                  <span className="font-mono tabular-nums-fa">
                    {toPersianDigits(item.qty)} عدد
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="ret-status" className="block text-xs font-medium text-[#111315] mb-1.5">
                وضعیت جدید *
              </label>
              <select
                id="ret-status"
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value as OrderReturnStatus)}
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              >
                {(Object.keys(RETURN_STATUS_LABELS) as OrderReturnStatus[]).map((st) => (
                  <option key={st} value={st}>
                    {RETURN_STATUS_LABELS[st]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ret-refund" className="block text-xs font-medium text-[#111315] mb-1.5">
                مبلغ قابل استرداد (تومان)
              </label>
              <input
                id="ret-refund"
                type="number"
                min={0}
                dir="ltr"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] tabular-nums-fa focus:outline-none focus:border-[#0f49bd]"
              />
            </div>
          </div>

          <SwitchToggle
            id="ret-restore"
            checked={restoreStock}
            onChange={setRestoreStock}
            label="بازگرداندن اقلام سالم به موجودی انبار پس از تحویل"
          />

          <div>
            <label htmlFor="ret-note" className="block text-xs font-medium text-[#111315] mb-1.5">
              یادداشت بررسی کارشناس
            </label>
            <textarea
              id="ret-note"
              rows={3}
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="شرح وضعیت فیزیکی کالا، وضعیت پلمب یا شماره فیش بازگشت..."
              className="w-full p-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
