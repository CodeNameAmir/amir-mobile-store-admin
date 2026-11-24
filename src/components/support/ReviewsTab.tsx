import { useCallback, useEffect, useState } from 'react';
import { Check, MessageCircle, RefreshCw, Search, ShieldCheck, Star, Trash2, X } from 'lucide-react';
import type { ProductReview } from '../../types/admin';
import { adminApi } from '../../services/adminApi';
import { ApiError, isEndpointUnsupportedError } from '../../services/apiClient';
import { useToast } from '../../context/ToastContext';
import { formatPersianDateTime, toPersianDigits } from '../../utils/formatters';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Pagination } from '../ui/Pagination';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { StatusTag } from '../ui/StatusBadge';
import {
  EmptyState,
  EndpointUnsupportedState,
  ErrorState,
  LoadingSkeleton,
} from '../ui/StateViews';

export function ReviewsTab() {
  const { pushToast } = useToast();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [approvedFilter, setApprovedFilter] = useState<'all' | 'approved' | 'pending'>('all');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<ProductReview[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ProductReview | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUnsupported(false);
    try {
      const res = await adminApi.listReviews({
        search: debouncedSearch.trim() || undefined,
        approved: approvedFilter,
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
        setError(err instanceof ApiError ? err.message : 'خطا در دریافت دیدگاه‌های محصولات.');
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, approvedFilter, page]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const handleToggleApprove = async (review: ProductReview) => {
    setBusyId(review.id);
    try {
      const res = await adminApi.updateReview(review.id, {
        isApproved: !review.isApproved,
      });
      setItems((prev) => prev.map((r) => (r.id === review.id ? res.review : r)));
      pushToast({
        tone: 'success',
        title: res.review.isApproved ? 'دیدگاه تایید و منتشر شد' : 'انتشار دیدگاه لغو شد',
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'خطا در تغییر وضعیت تایید دیدگاه',
        description: err instanceof ApiError ? err.message : 'لطفاً دوباره تلاش کنید.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleVerified = async (review: ProductReview) => {
    setBusyId(review.id);
    try {
      const res = await adminApi.updateReview(review.id, {
        verified: !review.verified,
      });
      setItems((prev) => prev.map((r) => (r.id === review.id ? res.review : r)));
      pushToast({
        tone: 'success',
        title: res.review.verified ? 'نشان خریدار تاییدشده فعال شد' : 'نشان خریدار تاییدشده برداشته شد',
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'خطا در به‌روزرسانی دیدگاه',
        description: err instanceof ApiError ? err.message : 'لطفاً دوباره تلاش کنید.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminApi.deleteReview(deleteTarget.id);
      pushToast({
        tone: 'success',
        title: 'دیدگاه حذف شد',
      });
      setDeleteTarget(null);
      await loadReviews();
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'خطا در حذف دیدگاه',
        description: err instanceof ApiError ? err.message : 'امکان حذف دیدگاه وجود ندارد.',
      });
    } finally {
      setDeleting(false);
    }
  };

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
                placeholder="جستجو در نام نویسنده، متن دیدگاه یا شناسه محصول..."
                aria-label="جستجوی دیدگاه محصول"
                className="w-full h-9 pr-9 pl-3 rounded-lg border border-black/[0.14] bg-[#f6f6f7] text-xs text-[#111315] placeholder:text-[#7c818c] focus:bg-white focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <select
              aria-label="فیلتر وضعیت تایید دیدگاه"
              value={approvedFilter}
              onChange={(e) => {
                setApprovedFilter(e.target.value as 'all' | 'approved' | 'pending');
                setPage(1);
              }}
              className="h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
            >
              <option value="all">همه دیدگاه‌ها</option>
              <option value="pending">در انتظار تایید</option>
              <option value="approved">تاییدشده</option>
            </select>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadReviews()}
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
            title="بخش مدیریت دیدگاه‌ها در سرور API هنوز فعال نشده است"
            description="رابط تایید و بررسی دیدگاه‌های محصولات آماده است، اما Endpoint متناظر آن هنوز در Backend فعال نشده است."
            endpointHint="GET /api/admin/reviews"
            onRetry={() => void loadReviews()}
          />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void loadReviews()} />
        ) : items.length === 0 ? (
          <EmptyState
            title="دیدگاهی یافت نشد"
            description="هنوز دیدگاه کاربری با این فیلترها در سیستم ثبت نشده است."
            icon={<MessageCircle className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-black/[0.08] text-xs font-medium text-[#52565e]">
                    <th className="py-3 px-3">کاربر و امتیاز</th>
                    <th className="py-3 px-3">محصول</th>
                    <th className="py-3 px-3">متن دیدگاه</th>
                    <th className="py-3 px-3">تاریخ</th>
                    <th className="py-3 px-3">وضعیت</th>
                    <th className="py-3 px-3 text-left">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.06] text-xs">
                  {items.map((review) => (
                    <tr key={review.id} className="hover:bg-[#f7f8fa] transition-colors duration-150">
                      <td className="py-3 px-3 whitespace-nowrap">
                        <p className="font-semibold text-[#111315]">{review.author}</p>
                        <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[#9a4a06] tabular-nums-fa">
                          <Star className="h-3 w-3 fill-current" strokeWidth={1.5} aria-hidden="true" />
                          <span>{toPersianDigits(review.rating)} از ۵</span>
                        </p>
                      </td>
                      <td className="py-3 px-3">
                        <p className="font-medium text-[#111315] max-w-[180px] truncate">
                          {review.productNameFa || review.productId}
                        </p>
                        <p className="text-[11px] font-mono text-[#52565e]" dir="ltr">
                          {review.productId}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-[#111315] max-w-md leading-5">
                        {review.comment}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-[#52565e] tabular-nums-fa">
                        {formatPersianDateTime(review.createdAt)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusTag tone={review.isApproved ? 'success' : 'warning'}>
                            {review.isApproved ? 'تاییدشده' : 'در انتظار تایید'}
                          </StatusTag>
                          {review.verified && (
                            <StatusTag tone="info">خریدار</StatusTag>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-left">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            type="button"
                            variant={review.isApproved ? 'outline' : 'primary'}
                            size="sm"
                            disabled={busyId === review.id}
                            onClick={() => void handleToggleApprove(review)}
                            icon={
                              review.isApproved ? (
                                <X className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                              ) : (
                                <Check className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                              )
                            }
                          >
                            {review.isApproved ? 'عدم انتشار' : 'تایید انتشار'}
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={busyId === review.id}
                            onClick={() => void handleToggleVerified(review)}
                            icon={<ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
                          >
                            {review.verified ? 'لغو خریدار' : 'تایید خریدار'}
                          </Button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(review)}
                            aria-label="حذف دیدگاه"
                            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-[#52565e] hover:bg-[#fef3f2] hover:text-[#b42318] transition-colors duration-150"
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                          </button>
                        </div>
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
              pageSize={12}
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
        title="حذف دیدگاه محصول"
        description={`آیا از حذف دیدگاه «${deleteTarget?.author || ''}» اطمینان دارید؟`}
        confirmLabel="حذف دیدگاه"
      />
    </div>
  );
}
