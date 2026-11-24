import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Award, Edit3, ExternalLink, Plus, RefreshCw, Star, Trash2 } from 'lucide-react';
import type { BrandInput, BrandItem } from '../../types/admin';
import { adminApi } from '../../services/adminApi';
import { ApiError } from '../../services/apiClient';
import { useToast } from '../../context/ToastContext';
import { slugifyProductId, toEnglishDigits, toPersianDigits, validateBrandInput } from '../../utils/formatters';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { StatusTag } from '../ui/StatusBadge';
import { SwitchToggle } from '../ui/SwitchToggle';
import { EmptyState, ErrorState, LoadingSkeleton } from '../ui/StateViews';

const EMPTY_BRAND: BrandInput = {
  name: '',
  labelFa: '',
  slug: '',
  logoUrl: '',
  websiteUrl: '',
  sortOrder: 1,
  isFeatured: false,
  isActive: true,
};

function BrandLogoThumb({ src, name }: { src?: string | null; name: string }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src?.trim() || failed) {
    return (
      <div className="h-9 w-9 rounded-lg bg-[#f1f2f4] border border-black/[0.08] text-[#52565e] flex items-center justify-center shrink-0 font-mono font-medium text-xs">
        {name.slice(0, 2).toUpperCase() || <Award className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
      </div>
    );
  }

  return (
    <div className="h-9 w-9 rounded-lg bg-white border border-black/[0.08] flex items-center justify-center overflow-hidden p-1 shrink-0">
      <img
        src={src.trim()}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="max-h-full max-w-full object-contain"
      />
    </div>
  );
}

export function BrandsTab() {
  const { pushToast } = useToast();

  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BrandInput>(EMPTY_BRAND);
  const [slugTouched, setSlugTouched] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<BrandItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadBrands = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listBrands();
      setBrands(Array.isArray(res.brands) ? res.brands : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'خطا در دریافت لیست برندها.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBrands();
  }, [loadBrands]);

  const openCreateModal = () => {
    setEditingId(null);
    setForm({ ...EMPTY_BRAND, sortOrder: brands.length + 1 });
    setSlugTouched(false);
    setFormErrors({});
    setServerError(null);
    setModalOpen(true);
  };

  const openEditModal = (brand: BrandItem) => {
    setEditingId(brand.id);
    setForm({
      id: brand.id,
      name: brand.name,
      labelFa: brand.labelFa,
      slug: brand.slug,
      logoUrl: brand.logoUrl,
      websiteUrl: brand.websiteUrl,
      sortOrder: brand.sortOrder ?? 1,
      isFeatured: brand.isFeatured,
      isActive: brand.isActive,
    });
    setSlugTouched(true);
    setFormErrors({});
    setServerError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const cleaned: BrandInput = {
      ...(editingId ? { id: editingId } : {}),
      name: form.name.trim(),
      labelFa: (form.labelFa || '').trim(),
      slug: slugifyProductId(form.slug),
      logoUrl: (form.logoUrl || '').trim(),
      websiteUrl: (form.websiteUrl || '').trim(),
      sortOrder: Number.isInteger(Number(form.sortOrder)) ? Number(form.sortOrder) : 1,
      isFeatured: Boolean(form.isFeatured),
      isActive: Boolean(form.isActive),
    };

    const validation = validateBrandInput(cleaned);
    if (Object.keys(validation).length > 0) {
      setFormErrors(validation);
      return;
    }

    setFormErrors({});
    setServerError(null);
    setSaving(true);
    try {
      await adminApi.saveBrand(cleaned);
      pushToast({
        tone: 'success',
        title: editingId ? 'برند ویرایش شد' : 'برند جدید ثبت شد',
        description: cleaned.labelFa || cleaned.name,
      });
      setModalOpen(false);
      await loadBrands();
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'خطا در ذخیره برند.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminApi.deleteBrand(deleteTarget.id);
      pushToast({
        tone: 'success',
        title: 'برند حذف شد',
        description: deleteTarget.labelFa || deleteTarget.name,
      });
      setDeleteTarget(null);
      await loadBrands();
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'خطا در حذف برند',
        description: err instanceof ApiError ? err.message : 'امکان حذف این برند وجود ندارد.',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[#52565e]">
          مدیریت برندهای معتبر فروشگاه، لوگو، وب‌سایت رسمی و انتخاب برندهای ویژه صفحه اصلی
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadBrands()}
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
            افزودن برند
          </Button>
        </div>
      </div>

      <Card padding="md">
        {loading ? (
          <LoadingSkeleton rows={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void loadBrands()} />
        ) : brands.length === 0 ? (
          <EmptyState
            title="هنوز برندی ثبت نشده است"
            description="اولین برند تولیدکننده را به کاتالوگ فروشگاه اضافه کنید."
            icon={<Award className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />}
            action={
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={openCreateModal}
                icon={<Plus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
              >
                افزودن اولین برند
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-black/[0.08] text-xs font-medium text-[#52565e]">
                  <th className="py-3 px-3">برند</th>
                  <th className="py-3 px-3">نامک (Slug)</th>
                  <th className="py-3 px-3">ترتیب</th>
                  <th className="py-3 px-3">وب‌سایت رسمی</th>
                  <th className="py-3 px-3">جایگاه نمایش</th>
                  <th className="py-3 px-3">وضعیت</th>
                  <th className="py-3 px-3 text-left">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06] text-xs">
                {[...brands]
                  .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                  .map((brand) => (
                  <tr key={brand.id} className="hover:bg-[#f7f8fa] transition-colors duration-150">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-3">
                        <BrandLogoThumb src={brand.logoUrl} name={brand.name} />
                        <div>
                          <p className="font-semibold text-[#111315]">{brand.name}</p>
                          <p className="text-[11px] text-[#52565e]">{brand.labelFa || '—'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-[#0f49bd]" dir="ltr">
                      {brand.slug}
                    </td>
                    <td className="py-3 px-3 text-[#52565e] tabular-nums-fa">
                      {toPersianDigits(brand.sortOrder ?? 1)}
                    </td>
                    <td className="py-3 px-3 text-[#52565e]" dir="ltr">
                      {brand.websiteUrl ? (
                        <a
                          href={brand.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-[#0f49bd] hover:underline"
                        >
                          <span className="truncate max-w-[180px]">{brand.websiteUrl}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {brand.isFeatured ? (
                        <StatusTag tone="warning" icon={<Star className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />}>
                          برند ویژه
                        </StatusTag>
                      ) : (
                        <span className="text-[#7c818c]">عادی</span>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {brand.isActive ? (
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
                          onClick={() => openEditModal(brand)}
                          aria-label={`ویرایش برند ${brand.name}`}
                          icon={<Edit3 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
                        >
                          ویرایش
                        </Button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(brand)}
                          aria-label={`حذف برند ${brand.name}`}
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
        title={editingId ? 'ویرایش اطلاعات برند' : 'افزودن برند جدید'}
        subtitle="ثبت نام، نامک یکتا، لوگو و تنظیم نمایش در ویترین برندهای ویژه"
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
            <Button type="submit" form="brand-form" variant="primary" loading={saving}>
              {editingId ? 'ذخیره برند' : 'ثبت برند'}
            </Button>
          </>
        }
      >
        <form id="brand-form" onSubmit={handleSave} className="space-y-4">
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
              <label htmlFor="brand-name" className="block text-xs font-medium text-[#111315] mb-1.5">
                نام انگلیسی برند *
              </label>
              <input
                id="brand-name"
                type="text"
                dir="ltr"
                value={form.name}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm((p) => ({
                    ...p,
                    name: val,
                    slug: !slugTouched ? slugifyProductId(val) : p.slug,
                  }));
                }}
                placeholder="Apple"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
              {formErrors.name && <p className="mt-1 text-xs text-[#b42318]">{formErrors.name}</p>}
            </div>

            <div>
              <label htmlFor="brand-label-fa" className="block text-xs font-medium text-[#111315] mb-1.5">
                نام فارسی برند
              </label>
              <input
                id="brand-label-fa"
                type="text"
                value={form.labelFa || ''}
                onChange={(e) => setForm((p) => ({ ...p, labelFa: e.target.value }))}
                placeholder="اپل"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <div>
              <label htmlFor="brand-slug" className="block text-xs font-medium text-[#111315] mb-1.5">
                نامک یکتا (Slug) *
              </label>
              <input
                id="brand-slug"
                type="text"
                dir="ltr"
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setForm((p) => ({ ...p, slug: slugifyProductId(e.target.value) }));
                }}
                placeholder="apple"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] font-mono text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
              {formErrors.slug && <p className="mt-1 text-xs text-[#b42318]">{formErrors.slug}</p>}
            </div>

            <div>
              <label htmlFor="brand-sort" className="block text-xs font-medium text-[#111315] mb-1.5">
                ترتیب نمایش
              </label>
              <input
                id="brand-sort"
                type="number"
                dir="ltr"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    sortOrder: Math.floor(Number(toEnglishDigits(e.target.value)) || 0),
                  }))
                }
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] tabular-nums-fa focus:outline-none focus:border-[#0f49bd]"
              />
              {formErrors.sortOrder && (
                <p className="mt-1 text-xs text-[#b42318]">{formErrors.sortOrder}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="brand-logo" className="block text-xs font-medium text-[#111315] mb-1.5">
                آدرس تصویر لوگو
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="brand-logo"
                  type="url"
                  dir="ltr"
                  value={form.logoUrl || ''}
                  onChange={(e) => setForm((p) => ({ ...p, logoUrl: e.target.value }))}
                  placeholder="https://example.com/logo.png"
                  className="flex-1 h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
                />
                <BrandLogoThumb src={form.logoUrl} name={form.name || 'BR'} />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="brand-web" className="block text-xs font-medium text-[#111315] mb-1.5">
                وب‌سایت رسمی
              </label>
              <input
                id="brand-web"
                type="url"
                dir="ltr"
                value={form.websiteUrl || ''}
                onChange={(e) => setForm((p) => ({ ...p, websiteUrl: e.target.value }))}
                placeholder="https://www.apple.com"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <div className="sm:col-span-2 pt-2 border-t border-black/[0.06] space-y-2">
              <SwitchToggle
                id="brand-featured"
                checked={form.isFeatured}
                onChange={(val) => setForm((p) => ({ ...p, isFeatured: val }))}
                label="برند ویژه"
                description="نمایش برجسته برند در ویترین صفحه اول فروشگاه"
              />
              <SwitchToggle
                id="brand-active"
                checked={form.isActive}
                onChange={(val) => setForm((p) => ({ ...p, isActive: val }))}
                label="وضعیت فعال"
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
        title="حذف برند"
        description={`آیا از حذف برند «${deleteTarget?.labelFa || deleteTarget?.name || ''}» اطمینان دارید؟`}
        confirmLabel="حذف برند"
      />
    </div>
  );
}
