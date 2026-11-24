import { useCallback, useEffect, useState } from 'react';
import { Download, Mail, RefreshCw, Search, Trash2 } from 'lucide-react';
import type { NewsletterSubscriber } from '../../types/admin';
import { adminApi } from '../../services/adminApi';
import { ApiError, isEndpointUnsupportedError } from '../../services/apiClient';
import { useToast } from '../../context/ToastContext';
import {
  buildCsv,
  downloadCsvFile,
  formatPersianDateTime,
  toPersianDigits,
} from '../../utils/formatters';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Pagination } from '../ui/Pagination';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import {
  EmptyState,
  EndpointUnsupportedState,
  ErrorState,
  LoadingSkeleton,
} from '../ui/StateViews';

export function NewsletterTab() {
  const { pushToast } = useToast();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<NewsletterSubscriber[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<NewsletterSubscriber | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadSubscribers = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUnsupported(false);
    try {
      const res = await adminApi.listNewsletterSubscribers({
        search: debouncedSearch.trim() || undefined,
        page,
        pageSize: 15,
      });
      setItems(Array.isArray(res.items) ? res.items : []);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      if (isEndpointUnsupportedError(err)) {
        setUnsupported(true);
      } else {
        setError(err instanceof ApiError ? err.message : 'خطا در دریافت فهرست مشترکین خبرنامه.');
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => {
    void loadSubscribers();
  }, [loadSubscribers]);

  const handleExportCsv = () => {
    if (items.length === 0) return;
    const csv = buildCsv(
      ['شناسه', 'ایمیل یا شماره تماس', 'تاریخ عضویت'],
      items.map((sub) => [sub.id, sub.contact, sub.createdAt])
    );
    downloadCsvFile('ams-newsletter-subscribers.csv', csv);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminApi.deleteNewsletterSubscriber(deleteTarget.id);
      pushToast({
        tone: 'success',
        title: 'مشترک از خبرنامه حذف شد',
        description: deleteTarget.contact,
      });
      setDeleteTarget(null);
      await loadSubscribers();
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'خطا در حذف مشترک خبرنامه',
        description: err instanceof ApiError ? err.message : 'امکان حذف این مشترک وجود ندارد.',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card padding="sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-sm">
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
              placeholder="جستجو با ایمیل یا شماره موبایل..."
              aria-label="جستجوی مشترک خبرنامه"
              className="w-full h-9 pr-9 pl-3 rounded-lg border border-black/[0.14] bg-[#f6f6f7] text-xs text-[#111315] placeholder:text-[#7c818c] focus:bg-white focus:outline-none focus:border-[#0f49bd]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadSubscribers()}
              icon={<RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
            >
              به‌روزرسانی
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={items.length === 0}
              onClick={handleExportCsv}
              icon={<Download className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
            >
              خروجی CSV
            </Button>
          </div>
        </div>
      </Card>

      <Card padding="md">
        {loading ? (
          <LoadingSkeleton rows={5} />
        ) : unsupported ? (
          <EndpointUnsupportedState
            title="فهرست خبرنامه در سرور API هنوز فعال نشده است"
            description="رابط مشاهده و خروجی CSV مشترکین خبرنامه آماده است، اما Endpoint متناظر آن هنوز در Backend فعال نشده است."
            endpointHint="GET /api/admin/newsletter"
            onRetry={() => void loadSubscribers()}
          />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void loadSubscribers()} />
        ) : items.length === 0 ? (
          <EmptyState
            title="مشترکی یافت نشد"
            description="هنوز کاربری در خبرنامه فروشگاه ثبت‌نام نکرده است."
            icon={<Mail className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-black/[0.08] text-xs font-medium text-[#52565e]">
                    <th className="py-3 px-3">ایمیل / شماره تماس</th>
                    <th className="py-3 px-3">شناسه رکورد</th>
                    <th className="py-3 px-3">تاریخ عضویت</th>
                    <th className="py-3 px-3 text-left">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.06] text-xs">
                  {items.map((sub) => (
                    <tr key={sub.id} className="hover:bg-[#f7f8fa] transition-colors duration-150">
                      <td className="py-3 px-3 font-mono font-medium text-[#111315]" dir="ltr">
                        {sub.contact.includes('@') ? sub.contact : toPersianDigits(sub.contact)}
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-[#52565e]" dir="ltr">
                        {sub.id}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-[#52565e] tabular-nums-fa">
                        {formatPersianDateTime(sub.createdAt)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-left">
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(sub)}
                          aria-label={`حذف ${sub.contact}`}
                          className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-[#52565e] hover:bg-[#fef3f2] hover:text-[#b42318] transition-colors duration-150"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                        </button>
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

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
        loading={deleting}
        title="حذف مشترک خبرنامه"
        description={`آیا از حذف «${deleteTarget?.contact || ''}» از لیست خبرنامه اطمینان دارید؟`}
        confirmLabel="حذف از خبرنامه"
      />
    </div>
  );
}
