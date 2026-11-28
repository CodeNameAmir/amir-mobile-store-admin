import { useCallback, useEffect, useState } from 'react';
import { Download, Eye, History, RefreshCw, Search } from 'lucide-react';
import type { AuditLogEntry } from '../types/admin';
import { adminApi } from '../services/adminApi';
import { fetchWithDedupe, getCachedValue } from '../services/adminCache';
import { ApiError } from '../services/apiClient';
import {
  AUDIT_ACTION_LABELS,
  buildCsv,
  downloadCsvFile,
  formatPersianDateTime,
} from '../utils/formatters';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/ui/StateViews';

const TARGET_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'همه بخش‌ها' },
  { value: 'product', label: 'محصولات' },
  { value: 'variant', label: 'تنوع‌ها (SKU)' },
  { value: 'category', label: 'دسته‌بندی‌ها' },
  { value: 'brand', label: 'برندها' },
  { value: 'warranty', label: 'گارانتی‌ها' },
  { value: 'attribute', label: 'ویژگی‌های فنی' },
  { value: 'warehouse', label: 'انبارها' },
  { value: 'stock_movement', label: 'تراکنش‌های انبار' },
  { value: 'warehouse_transfer', label: 'انتقال بین انبارها' },
  { value: 'imei', label: 'رجیستری IMEI' },
  { value: 'order', label: 'سفارش‌ها' },
  { value: 'payment', label: 'پرداخت‌ها و استرداد' },
  { value: 'return', label: 'مرجوعی سفارش' },
  { value: 'user', label: 'کاربران و مشتریان' },
  { value: 'role', label: 'نقش‌ها و مجوزها' },
  { value: 'coupon', label: 'کدهای تخفیف' },
  { value: 'ticket', label: 'تیکت‌های پشتیبانی' },
  { value: 'review', label: 'نظرات محصولات' },
  { value: 'newsletter', label: 'خبرنامه' },
  { value: 'content', label: 'محتوا و وبلاگ' },
  { value: 'store_settings', label: 'تنظیمات فروشگاه' },
  { value: 'auth', label: 'احراز هویت و امنیت' },
];

export function AuditLogsPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [targetTypeFilter, setTargetTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadLogs = useCallback(
    async (forceRefresh = false) => {
      const cacheKey = `audit-logs:${debouncedSearch.trim()}:${actionFilter}:${targetTypeFilter}:${dateFrom}:${dateTo}:${page}`;
      const cached = !forceRefresh
        ? getCachedValue<{
            items: AuditLogEntry[];
            total: number;
            totalPages: number;
          }>(cacheKey)
        : null;

      if (cached) {
        setItems(Array.isArray(cached.data.items) ? cached.data.items : []);
        setTotal(cached.data.total);
        setTotalPages(cached.data.totalPages);
        setLoading(false);
        setError(null);
        if (cached.isFresh) return;
      } else {
        setLoading(true);
        setError(null);
      }

      try {
        const res = await fetchWithDedupe(cacheKey, () =>
          adminApi.listAuditLogs({
            search: debouncedSearch.trim() || undefined,
            action: actionFilter,
            targetType: targetTypeFilter,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            page,
            pageSize: 15,
          })
        );
        setItems(Array.isArray(res.items) ? res.items : []);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      } catch (err) {
        if (!cached) {
          setError(err instanceof ApiError ? err.message : 'خطا در دریافت گزارش رویدادها.');
        }
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, actionFilter, targetTypeFilter, dateFrom, dateTo, page]
  );

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const safeItems = Array.isArray(items) ? items : [];

  const handleExportCsv = () => {
    if (safeItems.length === 0) return;
    const csv = buildCsv(
      ['شناسه', 'زمان ثبت', 'ایمیل مدیر', 'عملیات', 'بخش هدف', 'شناسه هدف', 'IP', 'جزئیات'],
      safeItems.map((log) => [
        log.id,
        log.createdAt,
        log.adminEmail,
        AUDIT_ACTION_LABELS[log.action] || log.action,
        log.targetType,
        log.targetId,
        log.ipAddress || '—',
        log.details && Object.keys(log.details).length > 0 ? JSON.stringify(log.details) : '—',
      ])
    );
    downloadCsvFile('ams-audit-logs.csv', csv);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#111315]">گزارش رویدادها و عملیات مدیریت</h1>
          <p className="mt-1 text-xs text-[#52565e]">
            تاریخچه تغییرات ثبت‌شده در سامانه به همراه نشانی IP و مقایسه مقادیر قبل و بعد برای ممیزی امنیتی
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={safeItems.length === 0}
            onClick={handleExportCsv}
            icon={<Download className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
          >
            خروجی CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadLogs(true)}
            icon={<RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
          >
            به‌روزرسانی
          </Button>
        </div>
      </div>

      <Card padding="sm">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <div className="relative xl:col-span-2">
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
              placeholder="جستجو با ایمیل مدیر، شناسه هدف یا جزئیات"
              aria-label="جستجوی رویدادها"
              className="w-full h-9 pr-9 pl-3 rounded-lg border border-black/[0.14] bg-[#f6f6f7] text-xs text-[#111315] placeholder:text-[#7c818c] focus:bg-white focus:outline-none focus:border-[#0f49bd]"
            />
          </div>

          <select
            aria-label="فیلتر نوع عملیات"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
          >
            <option value="all">همه عملیات‌ها</option>
            {Object.entries(AUDIT_ACTION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <select
            aria-label="فیلتر نوع موجودیت"
            value={targetTypeFilter}
            onChange={(e) => {
              setTargetTypeFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
          >
            {TARGET_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <input
              type="date"
              aria-label="از تاریخ"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 px-2 rounded-lg border border-black/[0.14] bg-white text-[11px] text-[#111315] focus:outline-none focus:border-[#0f49bd]"
            />
            <input
              type="date"
              aria-label="تا تاریخ"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="w-full h-9 px-2 rounded-lg border border-black/[0.14] bg-white text-[11px] text-[#111315] focus:outline-none focus:border-[#0f49bd]"
            />
          </div>
        </div>
      </Card>

      <Card padding="md">
        {loading ? (
          <LoadingSkeleton rows={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void loadLogs(true)} />
        ) : safeItems.length === 0 ? (
          <EmptyState
            title="رویداد مدیریتی یافت نشد"
            description="فیلترها را تغییر دهید یا منتظر ثبت عملیات جدید در سامانه بمانید."
            icon={<History className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-black/[0.08] text-xs font-medium text-[#52565e]">
                    <th className="py-3 px-3">زمان ثبت</th>
                    <th className="py-3 px-3">مدیر انجام‌دهنده</th>
                    <th className="py-3 px-3">عملیات</th>
                    <th className="py-3 px-3">شناسه هدف</th>
                    <th className="py-3 px-3">IP</th>
                    <th className="py-3 px-3">جزئیات</th>
                    <th className="py-3 px-3 text-left">بررسی</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.06] text-xs">
                  {safeItems.map((log) => {
                    const safeDetails =
                      log.details && typeof log.details === 'object' ? log.details : {};
                    const hasDiff = Boolean(log.beforeData || log.afterData);
                    return (
                      <tr key={log.id} className="hover:bg-[#f7f8fa] transition-colors duration-150">
                        <td className="py-3 px-3 whitespace-nowrap text-[#52565e] tabular-nums-fa">
                          {formatPersianDateTime(log.createdAt)}
                        </td>
                        <td className="py-3 px-3 font-mono text-[#111315]" dir="ltr">
                          {log.adminEmail}
                        </td>
                        <td className="py-3 px-3 font-semibold text-[#0f49bd]">
                          {AUDIT_ACTION_LABELS[log.action] || log.action}
                        </td>
                        <td className="py-3 px-3 font-mono text-[#111315] tabular-nums-fa" dir="ltr">
                          {log.targetType}: {log.targetId}
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-[#52565e]" dir="ltr">
                          {log.ipAddress || '—'}
                        </td>
                        <td
                          className="py-3 px-3 font-mono text-[11px] text-[#52565e] max-w-xs truncate"
                          dir="ltr"
                        >
                          {Object.keys(safeDetails).length > 0
                            ? JSON.stringify(safeDetails)
                            : hasDiff
                              ? 'شامل مقایسه قبل/بعد'
                              : '—'}
                        </td>
                        <td className="py-3 px-3 text-left whitespace-nowrap">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                            icon={<Eye className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
                          >
                            جزئیات
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
              pageSize={15}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      <Modal
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title={selectedLog ? AUDIT_ACTION_LABELS[selectedLog.action] || selectedLog.action : 'جزئیات رویداد'}
        subtitle={
          selectedLog
            ? `${selectedLog.adminEmail} · ${formatPersianDateTime(selectedLog.createdAt)}`
            : undefined
        }
        maxWidthClass="max-w-3xl"
        footer={
          <Button variant="outline" onClick={() => setSelectedLog(null)}>
            بستن
          </Button>
        }
      >
        {selectedLog && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#f6f6f7] border border-black/[0.08]">
              <div>
                <span className="text-[#52565e]">هدف عملیات: </span>
                <span className="font-mono font-medium text-[#111315]" dir="ltr">
                  {selectedLog.targetType}:{selectedLog.targetId}
                </span>
              </div>
              <div>
                <span className="text-[#52565e]">نشانی IP: </span>
                <span className="font-mono font-medium text-[#111315]" dir="ltr">
                  {selectedLog.ipAddress || 'ثبت نشده'}
                </span>
              </div>
              {selectedLog.userAgent && (
                <div className="sm:col-span-2">
                  <span className="text-[#52565e]">مرورگر / کلاینت: </span>
                  <span className="font-mono text-[11px] text-[#111315] break-all" dir="ltr">
                    {selectedLog.userAgent}
                  </span>
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold text-[#111315] mb-1.5">متادیتای رویداد</h3>
              <pre
                dir="ltr"
                className="p-3 rounded-lg bg-[#f6f6f7] border border-black/[0.08] font-mono text-[11px] text-[#111315] overflow-x-auto max-h-48"
              >
                {JSON.stringify(selectedLog.details || {}, null, 2)}
              </pre>
            </div>

            {(selectedLog.beforeData || selectedLog.afterData) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <h3 className="font-semibold text-[#b42318] mb-1.5">مقدار قبلی (Before)</h3>
                  <pre
                    dir="ltr"
                    className="p-3 rounded-lg bg-[#fef3f2] border border-[#fecaca] font-mono text-[11px] text-[#111315] overflow-x-auto max-h-60"
                  >
                    {JSON.stringify(selectedLog.beforeData || {}, null, 2)}
                  </pre>
                </div>
                <div>
                  <h3 className="font-semibold text-[#166534] mb-1.5">مقدار جدید (After)</h3>
                  <pre
                    dir="ltr"
                    className="p-3 rounded-lg bg-[#f0fdf4] border border-[#bbf7d0] font-mono text-[11px] text-[#111315] overflow-x-auto max-h-60"
                  >
                    {JSON.stringify(selectedLog.afterData || {}, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
