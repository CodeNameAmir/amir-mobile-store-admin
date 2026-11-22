import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Edit3, FolderTree, Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { CategoryInput, CategoryItem } from '../../types/admin';
import { adminApi } from '../../services/adminApi';
import { ApiError } from '../../services/apiClient';
import { useToast } from '../../context/ToastContext';
import {
  buildCategoryTreeList,
  CATEGORY_ICON_OPTIONS,
  slugifyProductId,
  toEnglishDigits,
  toPersianDigits,
  validateCategoryInput,
} from '../../utils/formatters';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { StatusTag } from '../ui/StatusBadge';
import { LucideIconPreview } from '../ui/LucideIconPreview';
import { SwitchToggle } from '../ui/SwitchToggle';
import { EmptyState, ErrorState, LoadingSkeleton } from '../ui/StateViews';

const EMPTY_CATEGORY: CategoryInput = {
  label: '',
  titleEn: '',
  slug: '',
  subtitle: '',
  descriptionFa: '',
  iconName: 'Smartphone',
  parentId: null,
  image: '',
  seoTitle: '',
  seoDescription: '',
  sortOrder: 1,
  isActive: true,
};

export function CategoriesTab() {
  const { pushToast } = useToast();

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryInput>(EMPTY_CATEGORY);
  const [slugTouched, setSlugTouched] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<CategoryItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listCategories();
      setCategories(Array.isArray(res.categories) ? res.categories : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'خطا در دریافت لیست دسته‌بندی‌ها.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    setImgFailed(false);
  }, [form.image]);

  const treeNodes = useMemo(() => buildCategoryTreeList(categories), [categories]);

  const parentOptions = useMemo(
    () => buildCategoryTreeList(categories, editingId ?? undefined),
    [categories, editingId]
  );

  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      map.set(c.id, c.label);
    }
    return map;
  }, [categories]);

  const openCreateModal = () => {
    setEditingId(null);
    setForm({
      ...EMPTY_CATEGORY,
      sortOrder: categories.length + 1,
    });
    setSlugTouched(false);
    setFormErrors({});
    setServerError(null);
    setModalOpen(true);
  };

  const openEditModal = (cat: CategoryItem) => {
    setEditingId(cat.id);
    setForm({
      id: cat.id,
      label: cat.label,
      titleEn: cat.titleEn,
      slug: cat.slug,
      subtitle: cat.subtitle,
      descriptionFa: cat.descriptionFa,
      iconName: cat.iconName || 'Folder',
      parentId: cat.parentId || null,
      image: cat.image || '',
      seoTitle: cat.seoTitle || '',
      seoDescription: cat.seoDescription || '',
      sortOrder: cat.sortOrder,
      isActive: cat.isActive,
    });
    setSlugTouched(true);
    setFormErrors({});
    setServerError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const cleaned: CategoryInput = {
      ...form,
      label: form.label.trim(),
      titleEn: (form.titleEn || '').trim(),
      slug: slugifyProductId(form.slug),
      subtitle: (form.subtitle || '').trim(),
      descriptionFa: (form.descriptionFa || '').trim(),
      iconName: form.iconName || 'Folder',
      parentId: form.parentId ? form.parentId : null,
      image: (form.image || '').trim(),
      seoTitle: (form.seoTitle || '').trim(),
      seoDescription: (form.seoDescription || '').trim(),
      sortOrder: Math.trunc(Number(form.sortOrder) || 0),
      isActive: Boolean(form.isActive),
    };

    const validation = validateCategoryInput(cleaned);
    if (Object.keys(validation).length > 0) {
      setFormErrors(validation);
      return;
    }

    setFormErrors({});
    setServerError(null);
    setSaving(true);
    try {
      if (editingId) {
        await adminApi.updateCategory(editingId, cleaned);
        pushToast({
          tone: 'success',
          title: 'دسته‌بندی ویرایش شد',
          description: cleaned.label,
        });
      } else {
        await adminApi.createCategory(cleaned);
        pushToast({
          tone: 'success',
          title: 'دسته‌بندی جدید ایجاد شد',
          description: cleaned.label,
        });
      }
      setModalOpen(false);
      await loadCategories();
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'خطا در ذخیره دسته‌بندی.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminApi.deleteCategory(deleteTarget.id);
      pushToast({
        tone: 'success',
        title: 'دسته‌بندی حذف شد',
        description: deleteTarget.label,
      });
      setDeleteTarget(null);
      await loadCategories();
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'خطا در حذف دسته‌بندی',
        description: err instanceof ApiError ? err.message : 'امکان حذف این دسته‌بندی وجود ندارد.',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[#52565e]">
          ساختار درختی دسته‌بندی‌ها، آیکون‌های نمایشی، توضیحات فارسی و تنظیمات سئو
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadCategories()}
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
            افزودن دسته‌بندی
          </Button>
        </div>
      </div>

      <Card padding="md">
        {loading ? (
          <LoadingSkeleton rows={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void loadCategories()} />
        ) : treeNodes.length === 0 ? (
          <EmptyState
            title="هنوز دسته‌بندی ثبت نشده است"
            description="برای ساختاردهی محصولات فروشگاه، اولین دسته‌بندی را ایجاد کنید."
            icon={<FolderTree className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />}
            action={
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={openCreateModal}
                icon={<Plus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
              >
                ایجاد اولین دسته‌بندی
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-black/[0.08] text-xs font-medium text-[#52565e]">
                  <th className="py-3 px-3">ترتیب</th>
                  <th className="py-3 px-3">عنوان و سلسله‌مراتب</th>
                  <th className="py-3 px-3">نامک (Slug)</th>
                  <th className="py-3 px-3">زیرعنوان / والد</th>
                  <th className="py-3 px-3">وضعیت</th>
                  <th className="py-3 px-3 text-left">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06] text-xs">
                {treeNodes.map(({ category: cat, depth }) => (
                  <tr key={cat.id} className="hover:bg-[#f7f8fa] transition-colors duration-150">
                    <td className="py-3 px-3 font-mono font-medium text-[#52565e] tabular-nums-fa">
                      {toPersianDigits(cat.sortOrder)}
                    </td>
                    <td className="py-3 px-3">
                      <div
                        className="flex items-center gap-2.5"
                        style={{ paddingRight: `${depth * 20}px` }}
                      >
                        <div className="h-8 w-8 rounded-lg bg-[#f1f2f4] border border-black/[0.08] text-[#52565e] flex items-center justify-center shrink-0">
                          <LucideIconPreview name={cat.iconName} className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-[#111315] truncate">
                            {depth > 0 ? '↳ ' : ''}
                            {cat.label}
                          </p>
                          <p className="text-[11px] font-mono text-[#52565e] truncate" dir="ltr">
                            {cat.titleEn || cat.iconName}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-[#0f49bd]" dir="ltr">
                      {cat.slug}
                    </td>
                    <td className="py-3 px-3 text-[#52565e] max-w-xs">
                      <p className="truncate">{cat.subtitle || '—'}</p>
                      {cat.parentId && (
                        <p className="text-[11px] text-[#7c818c] mt-0.5">
                          والد: {categoryNameMap.get(cat.parentId) || cat.parentId}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {cat.isActive ? (
                        <StatusTag tone="success">فعال</StatusTag>
                      ) : (
                        <StatusTag tone="neutral">غیرفعال</StatusTag>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-left">
                      <div className="inline-flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => openEditModal(cat)}
                          aria-label={`ویرایش دسته‌بندی ${cat.label}`}
                          icon={<Edit3 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
                        >
                          ویرایش
                        </Button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(cat)}
                          aria-label={`حذف دسته‌بندی ${cat.label}`}
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
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'ویرایش دسته‌بندی' : 'ایجاد دسته‌بندی جدید'}
        subtitle="تکمیل مشخصات نمایشی، سلسله‌مراتب درختی و اطلاعات سئو"
        maxWidthClass="max-w-2xl"
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
            <Button type="submit" form="category-form" variant="primary" loading={saving}>
              {editingId ? 'ذخیره تغییرات' : 'ایجاد دسته‌بندی'}
            </Button>
          </>
        }
      >
        <form id="category-form" onSubmit={handleSave} className="space-y-4">
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
              <label htmlFor="cat-label" className="block text-xs font-medium text-[#111315] mb-1.5">
                عنوان فارسی *
              </label>
              <input
                id="cat-label"
                type="text"
                value={form.label}
                onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                placeholder="گوشی موبایل"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
              {formErrors.label && <p className="mt-1 text-xs text-[#b42318]">{formErrors.label}</p>}
            </div>

            <div>
              <label htmlFor="cat-title-en" className="block text-xs font-medium text-[#111315] mb-1.5">
                عنوان انگلیسی
              </label>
              <input
                id="cat-title-en"
                type="text"
                dir="ltr"
                value={form.titleEn || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm((p) => ({
                    ...p,
                    titleEn: val,
                    slug: !slugTouched ? slugifyProductId(val) : p.slug,
                  }));
                }}
                placeholder="Smartphones"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <div>
              <label htmlFor="cat-slug" className="block text-xs font-medium text-[#111315] mb-1.5">
                نامک یکتا (Slug) *
              </label>
              <input
                id="cat-slug"
                type="text"
                dir="ltr"
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setForm((p) => ({ ...p, slug: slugifyProductId(e.target.value) }));
                }}
                placeholder="smartphones"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] font-mono text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
              {formErrors.slug && <p className="mt-1 text-xs text-[#b42318]">{formErrors.slug}</p>}
            </div>

            <div>
              <label htmlFor="cat-subtitle" className="block text-xs font-medium text-[#111315] mb-1.5">
                زیرعنوان کوتاه
              </label>
              <input
                id="cat-subtitle"
                type="text"
                value={form.subtitle || ''}
                onChange={(e) => setForm((p) => ({ ...p, subtitle: e.target.value }))}
                placeholder="پرچمداران و میان‌رده‌های روز دنیا"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <div>
              <label htmlFor="cat-parent" className="block text-xs font-medium text-[#111315] mb-1.5">
                دسته‌بندی والد
              </label>
              <select
                id="cat-parent"
                value={form.parentId ?? ''}
                onChange={(e) => setForm((p) => ({ ...p, parentId: e.target.value || null }))}
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              >
                <option value="">بدون والد (دسته سطح اول)</option>
                {parentOptions.map(({ category: opt, depth }) => (
                  <option key={opt.id} value={opt.id}>
                    {'— '.repeat(depth)}
                    {opt.label} ({opt.slug})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="cat-sort" className="block text-xs font-medium text-[#111315] mb-1.5">
                ترتیب نمایش
              </label>
              <input
                id="cat-sort"
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
              {formErrors.sortOrder && (
                <p className="mt-1 text-xs text-[#b42318]">{formErrors.sortOrder}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <span className="block text-xs font-medium text-[#111315] mb-1.5">
                آیکون نمایشی ({form.iconName || 'Folder'})
              </span>
              <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
                {CATEGORY_ICON_OPTIONS.map((iconKey) => {
                  const selected = form.iconName === iconKey;
                  return (
                    <button
                      key={iconKey}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, iconName: iconKey }))}
                      title={iconKey}
                      aria-label={`انتخاب آیکون ${iconKey}`}
                      aria-pressed={selected}
                      className={`h-9 rounded-lg border flex items-center justify-center transition-colors duration-150 ${
                        selected
                          ? 'bg-[#eef3fc] border-[#0f49bd] text-[#0f49bd]'
                          : 'bg-white border-black/[0.1] text-[#52565e] hover:bg-[#f6f6f7]'
                      }`}
                    >
                      <LucideIconPreview name={iconKey} className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="cat-desc" className="block text-xs font-medium text-[#111315] mb-1.5">
                توضیحات فارسی
              </label>
              <textarea
                id="cat-desc"
                rows={2}
                value={form.descriptionFa || ''}
                onChange={(e) => setForm((p) => ({ ...p, descriptionFa: e.target.value }))}
                placeholder="توضیحات دسته‌بندی برای صفحه فروشگاه"
                className="w-full p-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="cat-image" className="block text-xs font-medium text-[#111315] mb-1.5">
                آدرس تصویر بنر یا آیکون
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="cat-image"
                  type="url"
                  dir="ltr"
                  value={form.image || ''}
                  onChange={(e) => setForm((p) => ({ ...p, image: e.target.value }))}
                  placeholder="https://example.com/banner.jpg"
                  className="flex-1 h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
                />
                <div className="h-9 w-9 rounded-lg border border-black/[0.1] bg-[#f6f6f7] flex items-center justify-center overflow-hidden shrink-0">
                  {form.image?.trim() && !imgFailed ? (
                    <img
                      src={form.image.trim()}
                      alt={form.label || 'پیش‌نمایش دسته'}
                      referrerPolicy="no-referrer"
                      onError={() => setImgFailed(true)}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <LucideIconPreview name={form.iconName} className="h-4 w-4 text-[#7c818c]" />
                  )}
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="cat-seo-title" className="block text-xs font-medium text-[#111315] mb-1.5">
                عنوان سئو
              </label>
              <input
                id="cat-seo-title"
                type="text"
                value={form.seoTitle || ''}
                onChange={(e) => setForm((p) => ({ ...p, seoTitle: e.target.value }))}
                placeholder="خرید گوشی موبایل با گارانتی معتبر"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <div>
              <label htmlFor="cat-seo-desc" className="block text-xs font-medium text-[#111315] mb-1.5">
                توضیحات سئو
              </label>
              <input
                id="cat-seo-desc"
                type="text"
                value={form.seoDescription || ''}
                onChange={(e) => setForm((p) => ({ ...p, seoDescription: e.target.value }))}
                placeholder="توضیحات متا برای موتورهای جستجو"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <div className="sm:col-span-2 pt-2 border-t border-black/[0.06]">
              <SwitchToggle
                id="cat-active"
                checked={form.isActive}
                onChange={(val) => setForm((p) => ({ ...p, isActive: val }))}
                label="وضعیت فعال در فروشگاه"
                description="دسته‌بندی‌های غیرفعال در منوهای عمومی فروشگاه نمایش داده نمی‌شوند."
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
        title="حذف دسته‌بندی"
        description={`آیا از حذف دسته‌بندی «${deleteTarget?.label || ''}» اطمینان دارید؟`}
        confirmLabel="حذف دسته‌بندی"
      />
    </div>
  );
}
