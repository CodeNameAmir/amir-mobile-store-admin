import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Filter, Plus, RefreshCw, SlidersHorizontal, Trash2 } from 'lucide-react';
import type {
  AttributeDataType,
  CategoryItem,
  TechnicalAttribute,
  TechnicalAttributeInput,
} from '../../types/admin';
import { adminApi } from '../../services/adminApi';
import { ApiError } from '../../services/apiClient';
import { useToast } from '../../context/ToastContext';
import {
  ATTRIBUTE_DATATYPE_LABELS,
  toEnglishDigits,
  toPersianDigits,
  validateAttributeInput,
} from '../../utils/formatters';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { StatusTag } from '../ui/StatusBadge';
import { SwitchToggle } from '../ui/SwitchToggle';
import { EmptyState, ErrorState, LoadingSkeleton } from '../ui/StateViews';

const EMPTY_ATTR: TechnicalAttributeInput = {
  code: '',
  nameFa: '',
  nameEn: '',
  dataType: 'text',
  unit: '',
  options: [],
  isFilterable: false,
  sortOrder: 1,
  categoryIds: [],
};

export function AttributesTab() {
  const { pushToast } = useToast();

  const [attributes, setAttributes] = useState<TechnicalAttribute[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<TechnicalAttributeInput>(EMPTY_ATTR);
  const [optionsText, setOptionsText] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<TechnicalAttribute | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [attrRes, catRes] = await Promise.all([
        adminApi.listAttributes(categoryFilter),
        adminApi.listCategories().catch(() => ({ categories: [] as CategoryItem[] })),
      ]);
      setAttributes(Array.isArray(attrRes.attributes) ? attrRes.attributes : []);
      setCategories(Array.isArray(catRes.categories) ? catRes.categories : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'خطا در دریافت ویژگی‌های فنی استاندارد.');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, CategoryItem>();
    for (const c of categories) {
      map.set(c.id, c);
      map.set(c.slug, c);
    }
    return map;
  }, [categories]);

  const openCreateModal = () => {
    setForm({
      ...EMPTY_ATTR,
      sortOrder: attributes.length + 1,
    });
    setOptionsText('');
    setFormErrors({});
    setServerError(null);
    setModalOpen(true);
  };

  const toggleCategoryId = (catId: string) => {
    setForm((prev) => {
      const exists = prev.categoryIds.includes(catId);
      return {
        ...prev,
        categoryIds: exists
          ? prev.categoryIds.filter((id) => id !== catId)
          : [...prev.categoryIds, catId],
      };
    });
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const cleanedCode = toEnglishDigits(form.code)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_');

    const parsedOptions =
      form.dataType === 'select'
        ? optionsText
            .split(/[,،\n]/)
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    const cleaned: TechnicalAttributeInput = {
      code: cleanedCode,
      nameFa: form.nameFa.trim(),
      nameEn: (form.nameEn || '').trim(),
      dataType: form.dataType,
      unit: form.unit?.trim() ? form.unit.trim() : null,
      ...(parsedOptions && parsedOptions.length > 0 ? { options: parsedOptions } : {}),
      isFilterable: Boolean(form.isFilterable),
      sortOrder: Math.trunc(Number(form.sortOrder) || 0),
      categoryIds: form.categoryIds,
    };

    const validation = validateAttributeInput(cleaned);
    if (Object.keys(validation).length > 0) {
      setFormErrors(validation);
      return;
    }

    setFormErrors({});
    setServerError(null);
    setSaving(true);
    try {
      await adminApi.createAttribute(cleaned);
      pushToast({
        tone: 'success',
        title: 'ویژگی فنی استاندارد ایجاد شد',
        description: `${cleaned.nameFa} (${cleaned.code})`,
      });
      setModalOpen(false);
      await loadData();
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'خطا در ایجاد ویژگی فنی.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminApi.deleteAttribute(deleteTarget.id);
      pushToast({
        tone: 'success',
        title: 'ویژگی فنی حذف شد',
        description: deleteTarget.nameFa,
      });
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'خطا در حذف ویژگی فنی',
        description: err instanceof ApiError ? err.message : 'امکان حذف این ویژگی وجود ندارد.',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Filter className="h-4 w-4 text-[#7c818c]" strokeWidth={1.5} aria-hidden="true" />
          <select
            aria-label="فیلتر ویژگی‌ها بر اساس دسته‌بندی"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
          >
            <option value="all">همه دسته‌بندی‌ها</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.slug}>
                {cat.label} ({cat.slug})
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadData()}
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
            تعریف ویژگی فنی
          </Button>
        </div>
      </div>

      <Card padding="md">
        {loading ? (
          <LoadingSkeleton rows={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void loadData()} />
        ) : attributes.length === 0 ? (
          <EmptyState
            title="ویژگی فنی استاندارد یافت نشد"
            description="ویژگی‌هایی مانند اندازه نمایشگر، توان شارژ یا نرخ نوسازی را تعریف کنید."
            icon={<SlidersHorizontal className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />}
            action={
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={openCreateModal}
                icon={<Plus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
              >
                تعریف اولین ویژگی
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-black/[0.08] text-xs font-medium text-[#52565e]">
                  <th className="py-3 px-3">ترتیب</th>
                  <th className="py-3 px-3">کد یکتا</th>
                  <th className="py-3 px-3">عنوان فارسی / انگلیسی</th>
                  <th className="py-3 px-3">نوع داده و واحد</th>
                  <th className="py-3 px-3">دسته‌بندی‌های مرتبط</th>
                  <th className="py-3 px-3">فیلتر فروشگاه</th>
                  <th className="py-3 px-3 text-left">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06] text-xs">
                {attributes.map((attr) => (
                  <tr key={attr.id} className="hover:bg-[#f7f8fa] transition-colors duration-150">
                    <td className="py-3 px-3 font-mono font-medium text-[#52565e] tabular-nums-fa">
                      {toPersianDigits(attr.sortOrder)}
                    </td>
                    <td className="py-3 px-3 font-mono text-[#0f49bd]" dir="ltr">
                      {attr.code}
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-semibold text-[#111315]">{attr.nameFa}</p>
                      <p className="text-[11px] font-mono text-[#52565e]" dir="ltr">
                        {attr.nameEn || '—'}
                      </p>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-[#52565e]">
                      <p className="font-medium text-[#111315]">
                        {ATTRIBUTE_DATATYPE_LABELS[attr.dataType]}
                      </p>
                      <p className="text-[11px] text-[#7c818c]">
                        واحد: {attr.unit || '—'}
                      </p>
                    </td>
                    <td className="py-3 px-3 text-[#52565e] max-w-xs">
                      {attr.categoryIds.length > 0
                        ? attr.categoryIds
                            .map((cid) => categoryMap.get(cid)?.label || cid)
                            .join(' · ')
                        : 'همه دسته‌ها'}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {attr.isFilterable ? (
                        <StatusTag tone="info">قابل فیلتر</StatusTag>
                      ) : (
                        <StatusTag tone="neutral">نمایشی</StatusTag>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-left">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(attr)}
                        aria-label={`حذف ویژگی ${attr.nameFa}`}
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
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="تعریف ویژگی فنی استاندارد"
        subtitle="تعریف فیلدهای ساختاریافته برای مقایسه و فیلتر تخصصی محصولات در فروشگاه"
        maxWidthClass="max-w-xl"
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
            <Button type="submit" form="attribute-form" variant="primary" loading={saving}>
              ایجاد ویژگی فنی
            </Button>
          </>
        }
      >
        <form id="attribute-form" onSubmit={handleSave} className="space-y-4">
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
              <label htmlFor="attr-code" className="block text-xs font-medium text-[#111315] mb-1.5">
                کد انگلیسی ویژگی *
              </label>
              <input
                id="attr-code"
                type="text"
                dir="ltr"
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                placeholder="screen_size"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] font-mono text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
              {formErrors.code && <p className="mt-1 text-xs text-[#b42318]">{formErrors.code}</p>}
            </div>

            <div>
              <label htmlFor="attr-name-fa" className="block text-xs font-medium text-[#111315] mb-1.5">
                نام فارسی ویژگی *
              </label>
              <input
                id="attr-name-fa"
                type="text"
                value={form.nameFa}
                onChange={(e) => setForm((p) => ({ ...p, nameFa: e.target.value }))}
                placeholder="اندازه نمایشگر"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
              {formErrors.nameFa && (
                <p className="mt-1 text-xs text-[#b42318]">{formErrors.nameFa}</p>
              )}
            </div>

            <div>
              <label htmlFor="attr-name-en" className="block text-xs font-medium text-[#111315] mb-1.5">
                نام انگلیسی
              </label>
              <input
                id="attr-name-en"
                type="text"
                dir="ltr"
                value={form.nameEn || ''}
                onChange={(e) => setForm((p) => ({ ...p, nameEn: e.target.value }))}
                placeholder="Screen Size"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <div>
              <label htmlFor="attr-datatype" className="block text-xs font-medium text-[#111315] mb-1.5">
                نوع داده *
              </label>
              <select
                id="attr-datatype"
                value={form.dataType}
                onChange={(e) =>
                  setForm((p) => ({ ...p, dataType: e.target.value as AttributeDataType }))
                }
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              >
                <option value="text">متن</option>
                <option value="number">عددی</option>
                <option value="boolean">بله / خیر</option>
                <option value="select">انتخابی</option>
              </select>
            </div>

            <div>
              <label htmlFor="attr-unit" className="block text-xs font-medium text-[#111315] mb-1.5">
                واحد اندازه‌گیری (اختیاری)
              </label>
              <input
                id="attr-unit"
                type="text"
                value={form.unit || ''}
                onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                placeholder="اینچ، Hz، وات، میلی‌آمپرساعت"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <div>
              <label htmlFor="attr-sort" className="block text-xs font-medium text-[#111315] mb-1.5">
                ترتیب نمایش
              </label>
              <input
                id="attr-sort"
                type="number"
                dir="ltr"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    sortOrder: Math.trunc(Number(toEnglishDigits(e.target.value)) || 0),
                  }))
                }
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] tabular-nums-fa focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            {form.dataType === 'select' && (
              <div className="sm:col-span-2">
                <label htmlFor="attr-options" className="block text-xs font-medium text-[#111315] mb-1.5">
                  گزینه‌های مجاز (با کاما یا خط جدید جدا کنید)
                </label>
                <textarea
                  id="attr-options"
                  rows={2}
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  placeholder="AMOLED, OLED, IPS LCD"
                  className="w-full p-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
                />
              </div>
            )}

            <div className="sm:col-span-2">
              <span className="block text-xs font-medium text-[#111315] mb-2">
                دسته‌بندی‌های مرتبط
              </span>
              {categories.length === 0 ? (
                <p className="text-[11px] text-[#7c818c]">
                  هیچ دسته‌بندی ثبت‌شده‌ای یافت نشد. می‌توانید پس از ثبت دسته‌ها این بخش را تکمیل کنید.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-3 rounded-lg bg-[#f6f6f7] border border-black/[0.08]">
                  {categories.map((cat) => (
                    <label
                      key={cat.id}
                      className="inline-flex items-center gap-2 text-xs text-[#111315] cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={form.categoryIds.includes(cat.id)}
                        onChange={() => toggleCategoryId(cat.id)}
                        className="h-4 w-4 rounded border-black/[0.2] accent-[#0f49bd]"
                      />
                      <span className="truncate">{cat.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="sm:col-span-2 pt-2 border-t border-black/[0.06]">
              <SwitchToggle
                id="attr-filterable"
                checked={form.isFilterable}
                onChange={(val) => setForm((p) => ({ ...p, isFilterable: val }))}
                label="قابل فیلتر در سایدبار فروشگاه"
                description="در صورت فعال بودن، خریداران می‌توانند در صفحه کاتالوگ بر اساس این ویژگی فیلتر کنند."
              />
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
        loading={deleting}
        title="حذف ویژگی فنی"
        description={`آیا از حذف ویژگی «${deleteTarget?.nameFa || ''}» اطمینان دارید؟ مقادیر ثبت‌شده این ویژگی روی محصولات نیز پاک خواهد شد.`}
        confirmLabel="حذف ویژگی"
      />
    </div>
  );
}
