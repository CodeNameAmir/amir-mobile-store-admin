import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Edit3, History, Plus, RefreshCw, Search, TicketPercent, Trash2 } from 'lucide-react';
import type { CouponDiscountType, CouponInput, CouponItem, CouponRedemption } from '../types/admin';
import { adminApi } from '../services/adminApi';
import { ApiError, isEndpointUnsupportedError } from '../services/apiClient';
import { useToast } from '../context/ToastContext';
import {
  COUPON_TYPE_LABELS,
  formatPersianDateTime,
  formatToman,
  toEnglishDigits,
  toPersianDigits,
  validateCouponInput,
} from '../utils/formatters';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { StatusTag } from '../components/ui/StatusBadge';
import { SwitchToggle } from '../components/ui/SwitchToggle';
import {
  EmptyState,
  EndpointUnsupportedState,
  ErrorState,
  LoadingSkeleton,
} from '../components/ui/StateViews';

const EMPTY_COUPON: CouponInput = {
  code: '',
  discountType: 'percent',
  discountValue: 10,
  maxDiscount: null,
  minOrderAmount: 0,
  isActive: true,
  descriptionFa: '',
  startsAt: null,
  expiresAt: null,
  usageLimit: null,
  perUserLimit: null,
};

function toDateTimeLocalValue(iso?: string | null): string {
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 16);
}

export function CouponsPage() {
  const { pushToast } = useToast();

  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [form, setForm] = useState<CouponInput>(EMPTY_COUPON);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<CouponItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [historyCode, setHistoryCode] = useState<string | null>(null);
  const [redemptions, setRedemptions] = useState<CouponRedemption[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyUnsupported, setHistoryUnsupported] = useState(false);

  const loadCoupons = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUnsupported(false);
    try {
      const res = await adminApi.listCoupons();
      setCoupons(Array.isArray(res.coupons) ? res.coupons : []);
    } catch (err) {
      if (isEndpointUnsupportedError(err)) {
        setUnsupported(true);
      } else {
        setError(
          err instanceof ApiError
            ? err.message
            : 'خطا در دریافت فهرست کدهای تخفیف.'
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCoupons();
  }, [loadCoupons]);

  const openCreateModal = () => {
    setEditingCode(null);
    setForm(EMPTY_COUPON);
    setFormErrors({});
    setServerError(null);
    setModalOpen(true);
  };

  const openEditModal = (coupon: CouponItem) => {
    setEditingCode(coupon.code);
    setForm({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxDiscount: coupon.maxDiscount ?? null,
      minOrderAmount: coupon.minOrderAmount,
      isActive: coupon.isActive,
      descriptionFa: coupon.descriptionFa,
      startsAt: toDateTimeLocalValue(coupon.startsAt) || null,
      expiresAt: toDateTimeLocalValue(coupon.expiresAt) || null,
      usageLimit: coupon.usageLimit ?? null,
      perUserLimit: coupon.perUserLimit ?? null,
    });
    setFormErrors({});
    setServerError(null);
    setModalOpen(true);
  };

  const openHistoryModal = async (code: string) => {
    setHistoryCode(code);
    setRedemptions([]);
    setHistoryError(null);
    setHistoryUnsupported(false);
    setHistoryLoading(true);
    try {
      const res = await adminApi.listCouponRedemptions(code);
      setRedemptions(res.redemptions);
    } catch (err) {
      if (isEndpointUnsupportedError(err)) {
        setHistoryUnsupported(true);
      } else {
        setHistoryError(
          err instanceof ApiError ? err.message : 'خطا در دریافت تاریخچه مصرف کد تخفیف.'
        );
      }
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const cleaned: CouponInput = {
      code: toEnglishDigits(form.code).trim().toUpperCase(),
      discountType: form.discountType,
      discountValue: Number(form.discountValue) || 0,
      maxDiscount:
        form.discountType === 'percent' && form.maxDiscount !== null && form.maxDiscount !== undefined
          ? Math.max(0, Number(form.maxDiscount) || 0)
          : null,
      minOrderAmount: Math.max(0, Number(form.minOrderAmount) || 0),
      isActive: Boolean(form.isActive),
      descriptionFa: (form.descriptionFa || '').trim(),
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      usageLimit:
        form.usageLimit !== null && form.usageLimit !== undefined
          ? Math.trunc(Number(form.usageLimit))
          : null,
      perUserLimit:
        form.perUserLimit !== null && form.perUserLimit !== undefined
          ? Math.trunc(Number(form.perUserLimit))
          : null,
    };

    const validation = validateCouponInput(cleaned);
    if (Object.keys(validation).length > 0) {
      setFormErrors(validation);
      return;
    }

    setFormErrors({});
    setServerError(null);
    setSaving(true);
    try {
      if (editingCode) {
        await adminApi.updateCoupon(editingCode, cleaned);
        pushToast({
          tone: 'success',
          title: 'کد تخفیف ویرایش شد',
          description: cleaned.code,
        });
      } else {
        await adminApi.createCoupon(cleaned);
        pushToast({
          tone: 'success',
          title: 'کد تخفیف جدید ثبت شد',
          description: cleaned.code,
        });
      }
      setModalOpen(false);
      await loadCoupons();
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'خطا در ذخیره کد تخفیف.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminApi.deleteCoupon(deleteTarget.code);
      pushToast({
        tone: 'success',
        title: 'کد تخفیف حذف شد',
        description: deleteTarget.code,
      });
      setDeleteTarget(null);
      await loadCoupons();
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'خطا در حذف کد تخفیف',
        description: err instanceof ApiError ? err.message : 'امکان حذف کد تخفیف وجود ندارد.',
      });
    } finally {
      setDeleting(false);
    }
  };

  const filteredCoupons = coupons.filter((c) => {
    if (statusFilter === 'active' && !c.isActive) return false;
    if (statusFilter === 'inactive' && c.isActive) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.code.toLowerCase().includes(q) ||
      (c.descriptionFa || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#111315]">مدیریت کدهای تخفیف و کوپن‌ها</h1>
          <p className="mt-1 text-xs text-[#52565e]">
            تعریف تخفیف‌های درصدی و مبلغ ثابت، سقف تخفیف، حداقل سبد خرید و وضعیت فعال‌سازی
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadCoupons()}
            icon={<RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
          >
            به‌روزرسانی
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={openCreateModal}
            icon={<Plus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
          >
            ایجاد کد تخفیف
          </Button>
        </div>
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
              placeholder="جستجو با کد تخفیف یا شرح کمپین..."
              aria-label="جستجوی کد تخفیف"
              className="w-full h-9 pr-9 pl-3 rounded-lg border border-black/[0.14] bg-[#f6f6f7] text-xs text-[#111315] placeholder:text-[#7c818c] focus:bg-white focus:outline-none focus:border-[#0f49bd]"
            />
          </div>

          <select
            aria-label="فیلتر وضعیت کد تخفیف"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            className="h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
          >
            <option value="all">همه وضعیت‌ها</option>
            <option value="active">فقط کدهای فعال</option>
            <option value="inactive">فقط کدهای غیرفعال</option>
          </select>
        </div>
      </Card>

      <Card padding="md">
        {loading ? (
          <LoadingSkeleton rows={5} />
        ) : unsupported ? (
          <EndpointUnsupportedState
            title="مدیریت کدهای تخفیف در سرور API هنوز فعال نشده است"
            description="رابط مدیریت کوپن‌ها آماده است، اما سرور هنوز Endpoint مدیریت کدهای تخفیف را ارائه نکرده است."
            endpointHint="GET /api/admin/coupons"
            onRetry={() => void loadCoupons()}
          />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void loadCoupons()} />
        ) : filteredCoupons.length === 0 ? (
          <EmptyState
            title="کد تخفیفی یافت نشد"
            description="اولین کد تخفیف فروشگاه را بسازید یا فیلترهای جستجو را تغییر دهید."
            icon={<TicketPercent className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />}
            action={
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={openCreateModal}
                icon={<Plus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
              >
                ثبت کد تخفیف
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-black/[0.08] text-xs font-medium text-[#52565e]">
                  <th className="py-3 px-3">کد تخفیف</th>
                  <th className="py-3 px-3">نوع و مقدار</th>
                  <th className="py-3 px-3">سقف و حداقل</th>
                  <th className="py-3 px-3">میزان مصرف</th>
                  <th className="py-3 px-3">بازه اعتبار</th>
                  <th className="py-3 px-3">وضعیت</th>
                  <th className="py-3 px-3 text-left">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06] text-xs">
                {filteredCoupons.map((coupon) => {
                  const isExpired =
                    Boolean(coupon.expiresAt) &&
                    new Date(coupon.expiresAt as string).getTime() < Date.now();
                  return (
                  <tr
                    key={coupon.code}
                    className="hover:bg-[#f7f8fa] transition-colors duration-150"
                  >
                    <td className="py-3 px-3">
                      <span className="font-mono font-semibold text-[#0f49bd]" dir="ltr">
                        {coupon.code}
                      </span>
                      {coupon.descriptionFa && (
                        <p className="text-[11px] text-[#52565e] mt-0.5 max-w-[200px] truncate">
                          {coupon.descriptionFa}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap tabular-nums-fa">
                      <span className="font-semibold text-[#111315]">
                        {coupon.discountType === 'percent'
                          ? `${toPersianDigits(coupon.discountValue)}٪`
                          : formatToman(coupon.discountValue)}
                      </span>
                      <span className="mr-1.5 text-[11px] text-[#52565e]">
                        ({COUPON_TYPE_LABELS[coupon.discountType]})
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-[#52565e] tabular-nums-fa">
                      <div>
                        سقف:{' '}
                        {coupon.maxDiscount && coupon.maxDiscount > 0
                          ? formatToman(coupon.maxDiscount)
                          : 'بدون سقف'}
                      </div>
                      <div className="text-[11px]">
                        حداقل:{' '}
                        {coupon.minOrderAmount > 0
                          ? formatToman(coupon.minOrderAmount)
                          : 'آزاد'}
                      </div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap tabular-nums-fa text-[#111315]">
                      <span>{toPersianDigits(coupon.usedCount ?? 0)}</span>
                      {coupon.usageLimit ? (
                        <span className="text-[#52565e]"> / {toPersianDigits(coupon.usageLimit)}</span>
                      ) : (
                        <span className="text-[#52565e]"> / نامحدود</span>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-[#52565e] tabular-nums-fa text-[11px]">
                      {coupon.expiresAt ? (
                        <span>تا {formatPersianDateTime(coupon.expiresAt)}</span>
                      ) : (
                        <span>بدون انقضا</span>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {isExpired ? (
                        <StatusTag tone="warning">منقضی‌شده</StatusTag>
                      ) : coupon.isActive ? (
                        <StatusTag tone="success">فعال</StatusTag>
                      ) : (
                        <StatusTag tone="neutral">غیرفعال</StatusTag>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-left">
                      <div className="inline-flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void openHistoryModal(coupon.code)}
                          icon={<History className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
                        >
                          سابقه
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => openEditModal(coupon)}
                          aria-label={`ویرایش کد تخفیف ${coupon.code}`}
                          icon={<Edit3 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
                        >
                          ویرایش
                        </Button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(coupon)}
                          aria-label={`حذف کد تخفیف ${coupon.code}`}
                          className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-[#52565e] hover:bg-[#fef3f2] hover:text-[#b42318] transition-colors duration-150"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCode ? `ویرایش کد تخفیف ${editingCode}` : 'ایجاد کد تخفیف جدید'}
        subtitle="پیکربندی قوانین محاسبه تخفیف در سبد خرید مشتریان"
        maxWidthClass="max-w-lg"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              انصراف
            </Button>
            <Button type="submit" form="coupon-form" variant="primary" loading={saving}>
              {editingCode ? 'ذخیره تغییرات' : 'ثبت کد تخفیف'}
            </Button>
          </>
        }
      >
        <form id="coupon-form" onSubmit={handleSave} className="space-y-4">
          {serverError && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-[#fef3f2] border border-[#fecaca] text-xs font-medium text-[#b42318]"
            >
              {serverError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="cp-code" className="block text-xs font-medium text-[#111315] mb-1.5">
                کد تخفیف *
              </label>
              <input
                id="cp-code"
                type="text"
                dir="ltr"
                disabled={Boolean(editingCode)}
                value={form.code}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    code: toEnglishDigits(e.target.value).toUpperCase(),
                  }))
                }
                placeholder="AMIR10"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] font-mono text-xs text-[#111315] disabled:bg-[#f6f6f7] focus:outline-none focus:border-[#0f49bd]"
              />
              {formErrors.code && (
                <p className="mt-1 text-xs text-[#b42318]">{formErrors.code}</p>
              )}
            </div>

            <div>
              <label htmlFor="cp-type" className="block text-xs font-medium text-[#111315] mb-1.5">
                نوع تخفیف *
              </label>
              <select
                id="cp-type"
                value={form.discountType}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    discountType: e.target.value as CouponDiscountType,
                  }))
                }
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              >
                <option value="percent">درصدی (%)</option>
                <option value="fixed">مبلغ ثابت (تومان)</option>
              </select>
            </div>

            <div>
              <label htmlFor="cp-value" className="block text-xs font-medium text-[#111315] mb-1.5">
                {form.discountType === 'percent' ? 'درصد تخفیف (۱ تا ۱۰۰) *' : 'مبلغ تخفیف (تومان) *'}
              </label>
              <input
                id="cp-value"
                type="number"
                min={1}
                max={form.discountType === 'percent' ? 100 : undefined}
                dir="ltr"
                value={form.discountValue || ''}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    discountValue: Number(toEnglishDigits(e.target.value)) || 0,
                  }))
                }
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] tabular-nums-fa focus:outline-none focus:border-[#0f49bd]"
              />
              {formErrors.discountValue && (
                <p className="mt-1 text-xs text-[#b42318]">{formErrors.discountValue}</p>
              )}
            </div>

            <div>
              <label htmlFor="cp-max" className="block text-xs font-medium text-[#111315] mb-1.5">
                سقف مبلغ تخفیف (تومان)
              </label>
              <input
                id="cp-max"
                type="number"
                min={0}
                dir="ltr"
                disabled={form.discountType === 'fixed'}
                value={form.maxDiscount ?? ''}
                onChange={(e) => {
                  const raw = toEnglishDigits(e.target.value).trim();
                  setForm((p) => ({ ...p, maxDiscount: raw ? Number(raw) : null }));
                }}
                placeholder="اختیاری"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] tabular-nums-fa disabled:bg-[#f6f6f7] focus:outline-none focus:border-[#0f49bd]"
              />
              {formErrors.maxDiscount && (
                <p className="mt-1 text-xs text-[#b42318]">{formErrors.maxDiscount}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="cp-min-order" className="block text-xs font-medium text-[#111315] mb-1.5">
                حداقل مبلغ سبد خرید برای اعمال (تومان)
              </label>
              <input
                id="cp-min-order"
                type="number"
                min={0}
                dir="ltr"
                value={form.minOrderAmount}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    minOrderAmount: Math.max(0, Number(toEnglishDigits(e.target.value)) || 0),
                  }))
                }
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] tabular-nums-fa focus:outline-none focus:border-[#0f49bd]"
              />
              <p className="mt-1 text-[11px] text-[#52565e] tabular-nums-fa">
                {form.minOrderAmount > 0 ? formatToman(form.minOrderAmount) : 'بدون حداقل سفارش'}
              </p>
              {formErrors.minOrderAmount && (
                <p className="mt-1 text-xs text-[#b42318]">{formErrors.minOrderAmount}</p>
              )}
            </div>

            <div>
              <label htmlFor="cp-usage-limit" className="block text-xs font-medium text-[#111315] mb-1.5">
                سقف کل استفاده (اختیاری)
              </label>
              <input
                id="cp-usage-limit"
                type="number"
                min={1}
                dir="ltr"
                value={form.usageLimit ?? ''}
                onChange={(e) => {
                  const raw = toEnglishDigits(e.target.value).trim();
                  setForm((p) => ({ ...p, usageLimit: raw ? Number(raw) : null }));
                }}
                placeholder="نامحدود"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] tabular-nums-fa focus:outline-none focus:border-[#0f49bd]"
              />
              {formErrors.usageLimit && (
                <p className="mt-1 text-xs text-[#b42318]">{formErrors.usageLimit}</p>
              )}
            </div>

            <div>
              <label htmlFor="cp-user-limit" className="block text-xs font-medium text-[#111315] mb-1.5">
                محدودیت هر کاربر (اختیاری)
              </label>
              <input
                id="cp-user-limit"
                type="number"
                min={1}
                dir="ltr"
                value={form.perUserLimit ?? ''}
                onChange={(e) => {
                  const raw = toEnglishDigits(e.target.value).trim();
                  setForm((p) => ({ ...p, perUserLimit: raw ? Number(raw) : null }));
                }}
                placeholder="نامحدود"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] tabular-nums-fa focus:outline-none focus:border-[#0f49bd]"
              />
              {formErrors.perUserLimit && (
                <p className="mt-1 text-xs text-[#b42318]">{formErrors.perUserLimit}</p>
              )}
            </div>

            <div>
              <label htmlFor="cp-starts" className="block text-xs font-medium text-[#111315] mb-1.5">
                شروع اعتبار (اختیاری)
              </label>
              <input
                id="cp-starts"
                type="datetime-local"
                dir="ltr"
                value={form.startsAt || ''}
                onChange={(e) => setForm((p) => ({ ...p, startsAt: e.target.value || null }))}
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <div>
              <label htmlFor="cp-expires" className="block text-xs font-medium text-[#111315] mb-1.5">
                پایان اعتبار / انقضا (اختیاری)
              </label>
              <input
                id="cp-expires"
                type="datetime-local"
                dir="ltr"
                value={form.expiresAt || ''}
                onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value || null }))}
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
              {formErrors.expiresAt && (
                <p className="mt-1 text-xs text-[#b42318]">{formErrors.expiresAt}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="cp-desc" className="block text-xs font-medium text-[#111315] mb-1.5">
                توضیحات کمپین (فارسی)
              </label>
              <input
                id="cp-desc"
                type="text"
                value={form.descriptionFa || ''}
                onChange={(e) => setForm((p) => ({ ...p, descriptionFa: e.target.value }))}
                placeholder="مثال: تخفیف ویژه جشنواره پاییزه برای خرید گوشی"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <div className="sm:col-span-2 pt-2 border-t border-black/[0.06]">
              <SwitchToggle
                id="cp-active"
                checked={form.isActive}
                onChange={(val) => setForm((p) => ({ ...p, isActive: val }))}
                label="کد تخفیف فعال و قابل استفاده در تسویه حساب"
              />
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(historyCode)}
        onClose={() => setHistoryCode(null)}
        title={`سابقه مصرف کد تخفیف ${historyCode || ''}`}
        maxWidthClass="max-w-lg"
      >
        {historyLoading ? (
          <LoadingSkeleton rows={4} />
        ) : historyUnsupported ? (
          <EndpointUnsupportedState
            title="تاریخچه مصرف کوپن در سرور فعال نشده است"
            description="مسیر گزارش مصرف کوپن هنوز توسط بک‌اند ارائه نشده است."
            endpointHint={`GET /api/admin/coupons/${historyCode || ':code'}/redemptions`}
          />
        ) : historyError ? (
          <ErrorState message={historyError} />
        ) : redemptions.length === 0 ? (
          <EmptyState
            title="هنوز از این کد تخفیف استفاده نشده است"
            description="پس از ثبت سفارش با این کد، گزارش مصرف در اینجا نمایش داده می‌شود."
            icon={<History className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />}
          />
        ) : (
          <div className="divide-y divide-black/[0.06]">
            {redemptions.map((item) => (
              <div key={item.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-mono font-semibold text-[#0f49bd]" dir="ltr">
                    {item.orderCode}
                  </p>
                  <p className="text-[11px] text-[#52565e]">
                    {item.customerName || 'مشتری'} · {formatPersianDateTime(item.redeemedAt)}
                  </p>
                </div>
                <span className="font-semibold text-[#111315] tabular-nums-fa">
                  {formatToman(item.discountAmount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
        loading={deleting}
        title="حذف کد تخفیف"
        description={`آیا از حذف کد تخفیف «${deleteTarget?.code || ''}» اطمینان دارید؟`}
        confirmLabel="حذف کد تخفیف"
      />
    </div>
  );
}
