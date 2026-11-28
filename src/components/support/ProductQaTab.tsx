import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { HelpCircle, MessageSquarePlus, RefreshCw, Search, Trash2 } from 'lucide-react';
import type { ProductQuestion } from '../../types/admin';
import { adminApi } from '../../services/adminApi';
import { ApiError, isEndpointUnsupportedError } from '../../services/apiClient';
import { useToast } from '../../context/ToastContext';
import { formatPersianDateTime } from '../../utils/formatters';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Pagination } from '../ui/Pagination';
import { StatusTag } from '../ui/StatusBadge';
import {
  EmptyState,
  EndpointUnsupportedState,
  ErrorState,
  LoadingSkeleton,
} from '../ui/StateViews';

export function ProductQaTab() {
  const { pushToast } = useToast();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unanswered' | 'published'>('all');
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<ProductQuestion[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);

  const [answerTarget, setAnswerTarget] = useState<ProductQuestion | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [publishOnSave, setPublishOnSave] = useState(true);
  const [savingAnswer, setSavingAnswer] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ProductQuestion | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUnsupported(false);
    try {
      const res = await adminApi.listQuestions({
        search: debouncedSearch.trim() || undefined,
        published: filter,
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
        setError(err instanceof ApiError ? err.message : 'خطا در دریافت پرسش و پاسخ محصولات.');
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filter, page]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  const openAnswerModal = (q: ProductQuestion) => {
    setAnswerTarget(q);
    setAnswerText(q.answer || '');
    setPublishOnSave(Boolean(q.isPublished || !q.answer));
  };

  const handleSaveAnswer = async (e: FormEvent) => {
    e.preventDefault();
    if (!answerTarget) return;
    if (!answerText.trim()) {
      pushToast({
        tone: 'error',
        title: 'متن پاسخ الزامی است',
      });
      return;
    }
    setSavingAnswer(true);
    try {
      const res = await adminApi.answerQuestion(answerTarget.id, {
        answer: answerText.trim(),
        isPublished: publishOnSave,
      });
      setItems((prev) => prev.map((q) => (q.id === answerTarget.id ? res.question : q)));
      pushToast({
        tone: 'success',
        title: 'پاسخ پرسش ثبت شد',
      });
      setAnswerTarget(null);
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'خطا در ثبت پاسخ',
        description: err instanceof ApiError ? err.message : 'لطفاً دوباره تلاش کنید.',
      });
    } finally {
      setSavingAnswer(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminApi.deleteQuestion(deleteTarget.id);
      setItems((prev) => prev.filter((q) => q.id !== deleteTarget.id));
      pushToast({ tone: 'info', title: 'پرسش حذف شد' });
      setDeleteTarget(null);
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'خطا در حذف پرسش',
        description: err instanceof ApiError ? err.message : 'لطفاً دوباره تلاش کنید.',
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
                placeholder="جستجو در پرسش‌ها، نام کاربر یا محصول..."
                aria-label="جستجوی پرسش محصولات"
                className="w-full h-9 pr-9 pl-3 rounded-lg border border-black/[0.14] bg-[#f6f6f7] text-xs text-[#111315] placeholder:text-[#7c818c] focus:bg-white focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <select
              aria-label="فیلتر وضعیت پرسش"
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value as 'all' | 'unanswered' | 'published');
                setPage(1);
              }}
              className="h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
            >
              <option value="all">همه پرسش‌ها</option>
              <option value="unanswered">در انتظار پاسخ</option>
              <option value="published">منتشرشده در سایت</option>
            </select>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadQuestions()}
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
            title="بخش پرسش و پاسخ محصولات در سرور API هنوز فعال نشده است"
            description="رابط پاسخ‌گویی و انتشار پرسش‌های کاربران آماده است، اما مسیر پرسش و پاسخ در Backend پیاده‌سازی نشده است."
            endpointHint="GET /api/admin/questions"
            onRetry={() => void loadQuestions()}
          />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void loadQuestions()} />
        ) : items.length === 0 ? (
          <EmptyState
            title="پرسشی یافت نشد"
            description="هنوز پرسشی از سوی خریداران برای محصولات ثبت نشده است."
            icon={<HelpCircle className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />}
          />
        ) : (
          <>
            <div className="divide-y divide-black/[0.06]">
              {items.map((q) => (
                <div
                  key={q.id}
                  className="py-4 flex flex-col lg:flex-row lg:items-start justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-[#111315]">{q.authorName}</span>
                      <span className="text-[#7c818c]">·</span>
                      <span className="text-[#0f49bd] font-medium">
                        {q.productNameFa || q.productId}
                      </span>
                      <StatusTag tone={q.isPublished ? 'success' : 'warning'}>
                        {q.isPublished ? 'منتشرشده' : 'پیش‌نویس / در انتظار'}
                      </StatusTag>
                      <span className="text-[11px] text-[#7c818c] tabular-nums-fa">
                        {formatPersianDateTime(q.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs leading-6 text-[#111315] font-medium">{q.question}</p>
                    {q.answer ? (
                      <div className="p-3 rounded-lg bg-[#f6f6f7] border border-black/[0.08] text-xs text-[#52565e] leading-5">
                        <span className="font-semibold text-[#111315]">پاسخ فروشگاه: </span>
                        {q.answer}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[#9a4a06]">هنوز پاسخی برای این پرسش ثبت نشده است.</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => openAnswerModal(q)}
                      icon={<MessageSquarePlus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
                    >
                      {q.answer ? 'ویرایش پاسخ' : 'پاسخ دادن'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`حذف پرسش ${q.authorName}`}
                      onClick={() => setDeleteTarget(q)}
                      icon={<Trash2 className="h-3.5 w-3.5 text-[#b42318]" strokeWidth={1.5} aria-hidden="true" />}
                    >
                      حذف
                    </Button>
                  </div>
                </div>
              ))}
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
        open={Boolean(answerTarget)}
        onClose={() => setAnswerTarget(null)}
        title="پاسخ به پرسش خریدار"
        subtitle={answerTarget ? answerTarget.productNameFa || answerTarget.productId : ''}
        maxWidthClass="max-w-lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setAnswerTarget(null)} disabled={savingAnswer}>
              انصراف
            </Button>
            <Button type="submit" form="qa-answer-form" variant="primary" loading={savingAnswer}>
              ذخیره پاسخ
            </Button>
          </>
        }
      >
        {answerTarget && (
          <form id="qa-answer-form" onSubmit={handleSaveAnswer} className="space-y-4 text-xs">
            <div className="p-3 rounded-lg bg-[#f6f6f7] border border-black/[0.08]">
              <p className="text-[11px] text-[#52565e] mb-1">پرسش {answerTarget.authorName}:</p>
              <p className="text-[#111315] leading-5 font-medium">{answerTarget.question}</p>
            </div>

            <div>
              <label htmlFor="qa-answer-text" className="block font-medium text-[#111315] mb-1.5">
                متن پاسخ رسمی فروشگاه
              </label>
              <textarea
                id="qa-answer-text"
                rows={4}
                required
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder="پاسخ دقیق فنی یا اطلاعات گارانتی و ارسال را بنویسید..."
                className="w-full p-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] leading-5 focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <label className="inline-flex items-center gap-2 cursor-pointer text-[#111315] font-medium">
              <input
                type="checkbox"
                checked={publishOnSave}
                onChange={(e) => setPublishOnSave(e.target.checked)}
                className="h-4 w-4 accent-[#0f49bd]"
              />
              <span>انتشار عمومی در صفحه محصول فروشگاه</span>
            </label>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
        loading={deleting}
        tone="danger"
        title="حذف پرسش محصول"
        description="آیا از حذف این پرسش اطمینان دارید؟"
        confirmLabel="حذف پرسش"
      />
    </div>
  );
}
