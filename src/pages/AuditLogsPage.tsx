import { useCallback, useEffect, useState } from 'react';
import { History, RefreshCw } from 'lucide-react';
import type { AuditLogEntry } from '../types/admin';
import { adminApi } from '../services/adminApi';
import { fetchWithDedupe, getCachedValue } from '../services/adminCache';
import { ApiError } from '../services/apiClient';
import { AUDIT_ACTION_LABELS, formatPersianDateTime } from '../utils/formatters';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/ui/StateViews';

export function AuditLogsPage() {
  const [actionFilter, setActionFilter] = useState('all');
  const [targetTypeFilter, setTargetTypeFilter] = useState('all');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(
    async (forceRefresh = false) => {
      const cacheKey = `audit-logs:${actionFilter}:${targetTypeFilter}:${page}`;
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
            action: actionFilter,
            targetType: targetTypeFilter,
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
    [actionFilter, targetTypeFilter, page]
  );

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const safeItems = Array.isArray(items) ? items : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#111315]">گزارش رویدادها و عملیات مدیریت</h1>
          <p className="mt-1 text-xs text-[#52565e]">
            تاریخچه تغییرات ثبت‌شده در سامانه برای شفافیت و ممیزی امنیتی
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadLogs(true)}
          icon={<RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
        >
          به‌روزرسانی
        </Button>
      </div>

      <Card padding="sm">
        <div className="flex flex-wrap items-center gap-3">
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
            <option value="all">همه بخش‌ها</option>
            <option value="product">محصولات</option>
            <option value="order">سفارش‌ها</option>
            <option value="user">کاربران</option>
          </select>
        </div>
      </Card>

      <Card padding="md">
        {loading ? (
          <LoadingSkeleton rows={6} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void loadLogs(true)} />
        ) : safeItems.length === 0 ? (
          <EmptyState
            title="هنوز رویداد مدیریتی ثبت نشده است"
            description="تمام تغییرات محصولات، موجودی انبار، سفارش‌ها و نقش‌های کاربری در اینجا ثبت می‌شوند."
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
                    <th className="py-3 px-3">جزئیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.06] text-xs">
                  {safeItems.map((log) => {
                    const safeDetails =
                      log.details && typeof log.details === 'object' ? log.details : {};
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
                      <td className="py-3 px-3 font-mono text-[11px] text-[#52565e] max-w-xs truncate" dir="ltr">
                        {Object.keys(safeDetails).length > 0
                          ? JSON.stringify(safeDetails)
                          : '—'}
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
    </div>
  );
}
