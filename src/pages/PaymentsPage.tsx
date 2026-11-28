import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  CreditCard,
  Download,
  RefreshCw,
  RotateCcw,
  Search,
} from 'lucide-react';
import type {
  PaymentReconciliationStatus,
  PaymentTransaction,
  PaymentTransactionStatus,
} from '../types/admin';
import { adminApi } from '../services/adminApi';
import { ApiError, isEndpointUnsupportedError } from '../services/apiClient';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  buildCsv,
  downloadCsvFile,
  formatPersianDateTime,
  formatToman,
  PAYMENT_TX_STATUS_LABELS,
  RECONCILIATION_LABELS,
  toEnglishDigits,
  toPersianDigits,
} from '../utils/formatters';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { StatusTag } from '../components/ui/StatusBadge';
import { Pagination } from '../components/ui/Pagination';
import {
  EmptyState,
  EndpointUnsupportedState,
  ErrorState,
  LoadingSkeleton,
} from '../components/ui/StateViews';

const STATUS_TONE: Record<
  PaymentTransactionStatus,
  'warning' | 'success' | 'danger' | 'neutral' | 'info'
> = {
  pending: 'warning',
  paid: 'success',
  failed: 'danger',
  refunded: 'neutral',
  partially_refunded: 'info',
};

const RECON_TONE: Record<PaymentReconciliationStatus, 'neutral' | 'success' | 'danger'> = {
  unmatched: 'neutral',
  matched: 'success',
  discrepancy: 'danger',
};

export function PaymentsPage() {
  const { can } = useAuth();
  const { pushToast } = useToast();

  const canRefundOrReconcile = can('payments.refund');

  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<PaymentTransactionStatus | 'all'>('all');
  const [reconFilter, setReconFilter] = useState<PaymentReconciliationStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);

  const [reconcilingId, setReconcilingId] = useState<string | null>(null);

  const [refundTarget, setRefundTarget] = useState<PaymentTransaction | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundRef, setRefundRef] = useState('');
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refunding, setRefunding] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUnsupported(false);
    try {
      const res = await adminApi.listPayments({
        search: debouncedSearch || undefined,
        status: statusFilter,
        reconciliationStatus: reconFilter,
        page,
        pageSize: 15,
      });
      setPayments(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      if (isEndpointUnsupportedError(err)) {
        setUnsupported(true);
      } else {
        setError(
          err instanceof ApiError ? err.message : 'خطا در دریافت فهرست تراکنش‌های پرداخت.'
        );
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, reconFilter, page]);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  const handleReconcile = async (
    tx: PaymentTransaction,
    nextStatus: PaymentReconciliationStatus
  ) => {
    setReconcilingId(tx.id);
    try {
      const res = await adminApi.reconcilePayment(tx.id, nextStatus);
      setPayments((prev) => prev.map((item) => (item.id === tx.id ? res.payment : item)));
      pushToast({
        tone: 'success',
        title: 'وضعیت مغایرت‌گیری به‌روزرسانی شد',
        description: `سفارش ${tx.orderCode} — ${RECONCILIATION_LABELS[nextStatus]}`,
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'خطا در مغایرت‌گیری تراکنش',
        description: err instanceof ApiError ? err.message : 'امکان ثبت مغایرت‌گیری وجود ندارد.',
      });
    } finally {
      setReconcilingId(null);
    }
  };

  const openRefundModal = (tx: PaymentTransaction) => {
    setRefundTarget(tx);
    setRefundAmount(String(tx.amountToman));
    setRefundReason('');
    setRefundRef('');
    setRefundError(null);
  };

  const handleSubmitRefund = async (e: FormEvent) => {
    e.preventDefault();
    if (!refundTarget) return;
    const numericAmount = Number(toEnglishDigits(refundAmount).trim());
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setRefundError('مبلغ استرداد باید بزرگ‌تر از صفر باشد.');
      return;
    }
    if (numericAmount > refundTarget.amountToman) {
      setRefundError('مبلغ استرداد نمی‌تواند از مبلغ کل تراکنش بیشتر باشد.');
      return;
    }
    const cleanReason = refundReason.trim();
    if (cleanReason.length < 3) {
      setRefundError('ذکر دلیل استرداد (حداقل ۳ کاراکتر) الزامی است.');
      return;
    }

    setRefundError(null);
    setRefunding(true);
    try {
      await adminApi.refundPayment(refundTarget.id, {
        amountToman: Math.round(numericAmount),
        reason: cleanReason,
        refundRef: refundRef.trim() || null,
      });
      pushToast({
        tone: 'success',
        title: 'استرداد وجه ثبت شد',
        description: `سفارش ${refundTarget.orderCode} — ${formatToman(numericAmount)}`,
      });
      setRefundTarget(null);
      await loadPayments();
    } catch (err) {
      setRefundError(
        err instanceof ApiError ? err.message : 'خطا در ثبت استرداد وجه تراکنش.'
      );
    } finally {
      setRefunding(false);
    }
  };

  const handleExportCsv = () => {
    const csv = buildCsv(
      [
        'کد سفارش',
        'درگاه',
        'شناسه Authority',
        'کد پیگیری شاپرک',
        'مبلغ (تومان)',
        'وضعیت تراکنش',
        'وضعیت مغایرت‌گیری',
        'زمان تایید',
        'تاریخ ایجاد',
      ],
      payments.map((tx) => [
        tx.orderCode,
        tx.gateway,
        tx.authority || '—',
        tx.shaparakRef || '—',
        tx.amountToman,
        PAYMENT_TX_STATUS_LABELS[tx.status],
        RECONCILIATION_LABELS[tx.reconciliationStatus],
        tx.verifiedAt || '—',
        tx.createdAt,
      ])
    );
    downloadCsvFile(`payments-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#111315]">تراکنش‌های پرداخت و استرداد وجه</h1>
          <p className="mt-1 text-xs text-[#52565e]">
            پایش وضعیت درگاه شاپرک، تطبیق مالی (مغایرت‌گیری) و ثبت استرداد وجه سفارش‌ها
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={payments.length === 0}
            icon={<Download className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
          >
            خروجی CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadPayments()}
            icon={<RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
          >
            به‌روزرسانی
          </Button>
        </div>
      </div>

      <Card padding="sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative lg:col-span-2">
            <Search
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7c818c]"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجو با کد سفارش، کد شاپرک یا Authority..."
              aria-label="جستجوی تراکنش پرداخت"
              className="w-full h-9 pr-9 pl-3 rounded-lg border border-black/[0.14] bg-[#f6f6f7] text-xs text-[#111315] placeholder:text-[#7c818c] focus:bg-white focus:outline-none focus:border-[#0f49bd]"
            />
          </div>

          <select
            aria-label="فیلتر وضعیت تراکنش"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as PaymentTransactionStatus | 'all');
              setPage(1);
            }}
            className="h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
          >
            <option value="all">همه وضعیت‌های پرداخت</option>
            {(Object.keys(PAYMENT_TX_STATUS_LABELS) as PaymentTransactionStatus[]).map((st) => (
              <option key={st} value={st}>
                {PAYMENT_TX_STATUS_LABELS[st]}
              </option>
            ))}
          </select>

          <select
            aria-label="فیلتر وضعیت مغایرت‌گیری"
            value={reconFilter}
            onChange={(e) => {
              setReconFilter(e.target.value as PaymentReconciliationStatus | 'all');
              setPage(1);
            }}
            className="h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
          >
            <option value="all">همه وضعیت‌های مغایرت</option>
            {(Object.keys(RECONCILIATION_LABELS) as PaymentReconciliationStatus[]).map((rc) => (
              <option key={rc} value={rc}>
                {RECONCILIATION_LABELS[rc]}
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
            title="ماژول تراکنش‌های پرداخت در سرور API هنوز فعال نشده است"
            description="برای مشاهده دفترکل پرداخت‌های شاپرک، تطبیق بانکی و ثبت استرداد وجه، باید مسیرهای پرداخت روی سرور بک‌اند پیاده‌سازی شوند."
            endpointHint="GET /api/admin/payments | POST /api/admin/payments/:id/refund"
            onRetry={() => void loadPayments()}
          />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void loadPayments()} />
        ) : payments.length === 0 ? (
          <EmptyState
            title="تراکنش پرداختی یافت نشد"
            description="با تغییر فیلترها یا ثبت سفارش‌های جدید در فروشگاه، تراکنش‌ها در اینجا ثبت می‌شوند."
            icon={<CreditCard className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-black/[0.08] text-xs font-medium text-[#52565e]">
                    <th className="py-3 px-3">کد سفارش</th>
                    <th className="py-3 px-3">درگاه و رهگیری شاپرک</th>
                    <th className="py-3 px-3">مبلغ</th>
                    <th className="py-3 px-3">وضعیت پرداخت</th>
                    <th className="py-3 px-3">مغایرت‌گیری</th>
                    <th className="py-3 px-3">زمان ثبت</th>
                    <th className="py-3 px-3 text-left">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.06] text-xs">
                  {payments.map((tx) => {
                    const refundable = tx.status === 'paid' || tx.status === 'partially_refunded';
                    return (
                      <tr
                        key={tx.id}
                        className="hover:bg-[#f7f8fa] transition-colors duration-150"
                      >
                        <td className="py-3 px-3 font-mono font-semibold text-[#0f49bd]" dir="ltr">
                          {tx.orderCode}
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-medium text-[#111315]">{tx.gateway}</p>
                          <p className="text-[11px] font-mono text-[#52565e] mt-0.5" dir="ltr">
                            {tx.shaparakRef || tx.authority || '—'}
                          </p>
                        </td>
                        <td className="py-3 px-3 font-semibold text-[#111315] tabular-nums-fa whitespace-nowrap">
                          {formatToman(tx.amountToman)}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <StatusTag tone={STATUS_TONE[tx.status]}>
                            {PAYMENT_TX_STATUS_LABELS[tx.status]}
                          </StatusTag>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <StatusTag tone={RECON_TONE[tx.reconciliationStatus]}>
                            {RECONCILIATION_LABELS[tx.reconciliationStatus]}
                          </StatusTag>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-[#52565e] tabular-nums-fa">
                          {formatPersianDateTime(tx.verifiedAt || tx.createdAt)}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-left">
                          <div className="inline-flex items-center gap-1.5">
                            {canRefundOrReconcile && tx.reconciliationStatus !== 'matched' && (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                loading={reconcilingId === tx.id}
                                onClick={() => void handleReconcile(tx, 'matched')}
                                icon={
                                  <CheckCircle2
                                    className="h-3.5 w-3.5"
                                    strokeWidth={1.5}
                                    aria-hidden="true"
                                  />
                                }
                              >
                                تایید تطبیق
                              </Button>
                            )}
                            {canRefundOrReconcile && refundable && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openRefundModal(tx)}
                                icon={
                                  <RotateCcw
                                    className="h-3.5 w-3.5"
                                    strokeWidth={1.5}
                                    aria-hidden="true"
                                  />
                                }
                              >
                                استرداد وجه
                              </Button>
                            )}
                          </div>
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
              pageSize={15}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      <Modal
        open={Boolean(refundTarget)}
        onClose={() => setRefundTarget(null)}
        title={`ثبت استرداد وجه سفارش ${refundTarget?.orderCode || ''}`}
        subtitle={
          refundTarget
            ? `مبلغ تراکنش اصلی: ${formatToman(refundTarget.amountToman)}`
            : undefined
        }
        maxWidthClass="max-w-md"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRefundTarget(null)}
              disabled={refunding}
            >
              انصراف
            </Button>
            <Button type="submit" form="refund-form" variant="danger" loading={refunding}>
              ثبت نهایی استرداد
            </Button>
          </>
        }
      >
        <form id="refund-form" onSubmit={handleSubmitRefund} className="space-y-4">
          {refundError && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-[#fef3f2] border border-[#fecaca] text-xs font-medium text-[#b42318]"
            >
              {refundError}
            </div>
          )}

          <div>
            <label htmlFor="ref-amount" className="block text-xs font-medium text-[#111315] mb-1.5">
              مبلغ استرداد (تومان) *
            </label>
            <input
              id="ref-amount"
              type="number"
              min={1}
              max={refundTarget?.amountToman}
              dir="ltr"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] tabular-nums-fa focus:outline-none focus:border-[#0f49bd]"
            />
            {Number(toEnglishDigits(refundAmount)) > 0 && (
              <p className="mt-1 text-[11px] text-[#52565e] tabular-nums-fa">
                {formatToman(Number(toEnglishDigits(refundAmount)))}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="ref-code" className="block text-xs font-medium text-[#111315] mb-1.5">
              شماره پیگیری بانکی / شبا (اختیاری)
            </label>
            <input
              id="ref-code"
              type="text"
              dir="ltr"
              value={refundRef}
              onChange={(e) => setRefundRef(e.target.value)}
              placeholder="SHAPARAK-REF-..."
              className="w-full h-9 px-3 rounded-lg border border-black/[0.14] font-mono text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
            />
          </div>

          <div>
            <label htmlFor="ref-reason" className="block text-xs font-medium text-[#111315] mb-1.5">
              دلیل استرداد وجه *
            </label>
            <textarea
              id="ref-reason"
              rows={3}
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="مثال: لغو سفارش پیش از ارسال به درخواست مشتری"
              className="w-full p-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
