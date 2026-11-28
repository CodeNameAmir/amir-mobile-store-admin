import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Boxes, Edit3, Grid3X3, Layers, Plus, RefreshCw, Trash2 } from 'lucide-react';
import type {
  ProductVariant,
  ProductVariantInput,
  WarrantyItem,
} from '../../types/admin';
import { adminApi } from '../../services/adminApi';
import { ApiError } from '../../services/apiClient';
import { useToast } from '../../context/ToastContext';
import {
  calculateProfitMargin,
  formatPersianNumber,
  formatToman,
  toEnglishDigits,
  toPersianDigits,
  validateVariantInput,
} from '../../utils/formatters';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { StatusTag } from '../ui/StatusBadge';
import { SwitchToggle } from '../ui/SwitchToggle';
import { EmptyState, ErrorState, LoadingSkeleton } from '../ui/StateViews';

const EMPTY_VARIANT: ProductVariantInput = {
  sku: '',
  barcode: '',
  partNumber: '',
  colorNameFa: '',
  colorNameEn: '',
  colorHex: '#1e293b',
  storage: '',
  ram: '',
  simType: '',
  warrantyId: '',
  priceToman: 0,
  originalPriceToman: null,
  costPriceToman: null,
  isPublished: true,
};

interface ProductVariantsSectionProps {
  productId: string;
  initialVariants?: ProductVariant[];
}

export function ProductVariantsSection({
  productId,
  initialVariants,
}: ProductVariantsSectionProps) {
  const { pushToast } = useToast();

  const [variants, setVariants] = useState<ProductVariant[]>(initialVariants ?? []);
  const [warranties, setWarranties] = useState<WarrantyItem[]>([]);
  const [loading, setLoading] = useState(!initialVariants);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [form, setForm] = useState<ProductVariantInput>(EMPTY_VARIANT);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ProductVariant | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Matrix Generator state
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [matrixSkuPrefix, setMatrixSkuPrefix] = useState(() =>
    productId.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12) || 'ITEM'
  );
  const [matrixColors, setMatrixColors] = useState('مشکی:#1e293b, سفید:#f8fafc');
  const [matrixStorages, setMatrixStorages] = useState('256GB, 512GB');
  const [matrixSimTypes, setMatrixSimTypes] = useState('دو سیم‌کارت ZAA');
  const [matrixPrice, setMatrixPrice] = useState(0);
  const [matrixWarrantyId, setMatrixWarrantyId] = useState('');
  const [matrixCreating, setMatrixCreating] = useState(false);
  const [matrixResultMsg, setMatrixResultMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    setError(null);
    try {
      const [varRes, warRes] = await Promise.all([
        adminApi.listProductVariants(productId),
        adminApi.listWarranties().catch(() => ({ warranties: [] as WarrantyItem[] })),
      ]);
      setVariants(Array.isArray(varRes.variants) ? varRes.variants : []);
      setWarranties(Array.isArray(warRes.warranties) ? warRes.warranties : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'خطا در دریافت تنوع‌های کالا.');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (initialVariants) {
      setVariants(initialVariants);
      // Still fetch warranties for dropdown labels
      void adminApi
        .listWarranties()
        .then((res) => setWarranties(Array.isArray(res.warranties) ? res.warranties : []))
        .catch(() => undefined);
    } else {
      void loadData();
    }
  }, [initialVariants, loadData]);

  const warrantyMap = new Map(warranties.map((w) => [w.id, w.providerName]));

  const openCreateModal = () => {
    setEditingVariant(null);
    setForm({
      ...EMPTY_VARIANT,
      warrantyId: warranties.find((w) => w.isActive)?.id || '',
    });
    setFormErrors({});
    setServerError(null);
    setModalOpen(true);
  };

  const openEditModal = (v: ProductVariant) => {
    setEditingVariant(v);
    setForm({
      sku: v.sku,
      barcode: v.barcode || '',
      partNumber: v.partNumber || '',
      colorNameFa: v.colorNameFa || '',
      colorNameEn: v.colorNameEn || '',
      colorHex: v.colorHex || '#1e293b',
      storage: v.storage || '',
      ram: v.ram || '',
      simType: v.simType || '',
      warrantyId: v.warrantyId || '',
      priceToman: v.priceToman,
      originalPriceToman: v.originalPriceToman ?? null,
      costPriceToman: v.costPriceToman ?? null,
      isPublished: v.isPublished,
    });
    setFormErrors({});
    setServerError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const cleaned: ProductVariantInput = {
      sku: form.sku.trim().toUpperCase(),
      barcode: form.barcode?.trim() ? form.barcode.trim() : null,
      partNumber: form.partNumber?.trim() ? form.partNumber.trim() : null,
      colorNameFa: form.colorNameFa?.trim() ? form.colorNameFa.trim() : null,
      colorNameEn: form.colorNameEn?.trim() ? form.colorNameEn.trim() : null,
      colorHex: form.colorHex?.trim() ? form.colorHex.trim() : null,
      storage: form.storage?.trim() ? form.storage.trim() : null,
      ram: form.ram?.trim() ? form.ram.trim() : null,
      simType: form.simType?.trim() ? form.simType.trim() : null,
      warrantyId: form.warrantyId?.trim() ? form.warrantyId.trim() : null,
      priceToman: Math.max(0, Math.round(Number(form.priceToman) || 0)),
      originalPriceToman:
        form.originalPriceToman && form.originalPriceToman > 0
          ? Math.round(form.originalPriceToman)
          : null,
      costPriceToman:
        form.costPriceToman !== null && form.costPriceToman !== undefined && form.costPriceToman >= 0
          ? Math.round(form.costPriceToman)
          : null,
      isPublished: Boolean(form.isPublished),
    };

    const validation = validateVariantInput(cleaned);
    if (Object.keys(validation).length > 0) {
      setFormErrors(validation);
      return;
    }

    setFormErrors({});
    setServerError(null);
    setSaving(true);
    try {
      if (editingVariant) {
        await adminApi.updateVariant(editingVariant.id, cleaned);
        pushToast({
          tone: 'success',
          title: 'تنوع کالا ویرایش شد',
          description: cleaned.sku,
        });
      } else {
        await adminApi.createProductVariant(productId, cleaned);
        pushToast({
          tone: 'success',
          title: 'تنوع جدید ایجاد شد',
          description: cleaned.sku,
        });
      }
      setModalOpen(false);
      await loadData();
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'خطا در ذخیره تنوع کالا.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminApi.deleteVariant(deleteTarget.id);
      pushToast({
        tone: 'success',
        title: 'تنوع کالا حذف شد',
        description: deleteTarget.sku,
      });
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'خطا در حذف تنوع کالا',
        description: err instanceof ApiError ? err.message : 'امکان حذف این تنوع وجود ندارد.',
      });
    } finally {
      setDeleting(false);
    }
  };

  const matrixPreviewRows = useMemo<ProductVariantInput[]>(() => {
    const colorEntries = matrixColors
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const [name, hex] = item.split(':').map((p) => p.trim());
        return { name: name || 'استاندارد', hex: hex || '#1e293b' };
      });
    const storages = matrixStorages
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const simTypes = matrixSimTypes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const colorsList = colorEntries.length > 0 ? colorEntries : [{ name: '', hex: '#1e293b' }];
    const storagesList = storages.length > 0 ? storages : [''];
    const simsList = simTypes.length > 0 ? simTypes : [''];
    const existingSkus = new Set(variants.map((v) => v.sku.toUpperCase()));
    const prefix = (matrixSkuPrefix.trim() || 'SKU').toUpperCase().replace(/[^A-Z0-9-]/g, '');

    const rows: ProductVariantInput[] = [];
    let seq = 1;
    for (const c of colorsList) {
      for (const st of storagesList) {
        for (const sim of simsList) {
          const storageCode = st.replace(/[^A-Za-z0-9]/g, '').toUpperCase() || 'STD';
          const candidateSku = `${prefix}-${storageCode}-${String(seq).padStart(2, '0')}`;
          seq += 1;
          if (existingSkus.has(candidateSku)) continue;
          rows.push({
            sku: candidateSku,
            colorNameFa: c.name || null,
            colorHex: c.hex || null,
            storage: st || null,
            simType: sim || null,
            warrantyId: matrixWarrantyId || null,
            priceToman: Math.max(0, Math.round(matrixPrice)),
            isPublished: true,
          });
        }
      }
    }
    return rows;
  }, [
    matrixColors,
    matrixStorages,
    matrixSimTypes,
    matrixSkuPrefix,
    matrixPrice,
    matrixWarrantyId,
    variants,
  ]);

  const handleGenerateMatrix = async () => {
    if (matrixPreviewRows.length === 0 || matrixPrice <= 0) {
      setMatrixResultMsg('لطفاً قیمت فروش معتبر و حداقل یک ترکیب غیرتکراری وارد کنید.');
      return;
    }
    setMatrixCreating(true);
    setMatrixResultMsg(null);
    let created = 0;
    const errors: string[] = [];
    for (const row of matrixPreviewRows) {
      try {
        await adminApi.createProductVariant(productId, row);
        created += 1;
      } catch (err) {
        errors.push(`${row.sku}: ${err instanceof ApiError ? err.message : 'خطا'}`);
      }
    }
    setMatrixCreating(false);
    if (created > 0) {
      pushToast({
        tone: 'success',
        title: `${toPersianDigits(created)} تنوع با موفقیت ایجاد شد`,
      });
      await loadData();
    }
    if (errors.length > 0) {
      setMatrixResultMsg(`موارد ناموفق (${toPersianDigits(errors.length)}): ${errors.slice(0, 3).join(' | ')}`);
    } else {
      setMatrixOpen(false);
    }
  };

  const liveMargin = calculateProfitMargin(form.priceToman, form.costPriceToman);

  return (
    <Card padding="lg">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-black/[0.06]">
        <div>
          <h2 className="text-sm font-semibold text-[#111315]">
            تنوع‌ها، پارت‌نامبر و قیمت‌گذاری
          </h2>
          <p className="mt-0.5 text-xs text-[#52565e]">
            مدیریت کد SKU، پارت‌نامبر، نوع سیم‌کارت، گارانتی، قیمت فروش، قیمت تمام‌شده و حاشیه سود
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
            variant="secondary"
            size="sm"
            onClick={() => {
              setMatrixResultMsg(null);
              setMatrixWarrantyId(warranties.find((w) => w.isActive)?.id || '');
              setMatrixOpen(true);
            }}
            icon={<Grid3X3 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
          >
            تولید ماتریس تنوع
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={openCreateModal}
            icon={<Plus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
          >
            افزودن تنوع
          </Button>
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadData()} />
      ) : variants.length === 0 ? (
        <EmptyState
          title="هنوز تنوع کالایی ثبت نشده است"
          description="برای فروش دقیق بر اساس رنگ، ظرفیت، پارت‌نامبر و انبار، اولین تنوع محصول را اضافه کنید."
          icon={<Layers className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />}
          action={
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={openCreateModal}
              icon={<Plus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
            >
              ثبت اولین تنوع
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-black/[0.08] text-xs font-medium text-[#52565e]">
                <th className="py-3 px-3">SKU و پارت‌نامبر</th>
                <th className="py-3 px-3">رنگ و مشخصات</th>
                <th className="py-3 px-3">گارانتی</th>
                <th className="py-3 px-3">قیمت فروش / تمام‌شده</th>
                <th className="py-3 px-3">حاشیه سود</th>
                <th className="py-3 px-3">موجودی انبارها</th>
                <th className="py-3 px-3">وضعیت</th>
                <th className="py-3 px-3 text-left">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06] text-xs">
              {variants.map((v) => {
                const margin = calculateProfitMargin(v.priceToman, v.costPriceToman);
                const wName = v.warrantyName || (v.warrantyId ? warrantyMap.get(v.warrantyId) : null);
                return (
                  <tr key={v.id} className="hover:bg-[#f7f8fa] transition-colors duration-150">
                    <td className="py-3 px-3">
                      <p className="font-mono font-medium text-[#0f49bd] whitespace-nowrap" dir="ltr">
                        {v.sku}
                      </p>
                      <p className="text-[11px] font-mono text-[#52565e] mt-0.5" dir="ltr">
                        {v.partNumber ? `P/N: ${v.partNumber}` : ''}
                        {v.partNumber && v.barcode ? ' · ' : ''}
                        {v.barcode ? `BC: ${v.barcode}` : ''}
                        {!v.partNumber && !v.barcode ? '—' : ''}
                      </p>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        {v.colorHex && (
                          <span
                            className="h-3 w-3 rounded-full border border-black/15 shrink-0"
                            style={{ backgroundColor: v.colorHex }}
                            aria-hidden="true"
                          />
                        )}
                        <span className="font-medium text-[#111315]">
                          {v.colorNameFa || v.colorNameEn || '—'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#52565e] mt-0.5">
                        {[v.storage, v.ram, v.simType].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </td>
                    <td className="py-3 px-3 text-[#52565e] max-w-[180px]">
                      <span className="line-clamp-2">{wName || '—'}</span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap tabular-nums-fa">
                      <p className="font-semibold text-[#111315]">{formatToman(v.priceToman)}</p>
                      {v.costPriceToman ? (
                        <p className="text-[11px] text-[#7c818c]">
                          تمام‌شده: {formatToman(v.costPriceToman, false)}
                        </p>
                      ) : (
                        <p className="text-[11px] text-[#7c818c]">تمام‌شده ثبت نشده</p>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap tabular-nums-fa">
                      {margin ? (
                        <div>
                          <p
                            className={`font-semibold ${
                              margin.profitToman >= 0 ? 'text-[#166534]' : 'text-[#b42318]'
                            }`}
                          >
                            {formatPersianNumber(margin.profitToman)} ت
                          </p>
                          <p className="text-[11px] text-[#52565e]">
                            ({toPersianDigits(margin.marginPercent)}٪)
                          </p>
                        </div>
                      ) : (
                        <span className="text-[#7c818c]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap tabular-nums-fa">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-[#111315]">
                        <Boxes className="h-3.5 w-3.5 text-[#52565e]" strokeWidth={1.5} aria-hidden="true" />
                        {toPersianDigits(v.availableStock)} عدد
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {v.isPublished ? (
                        <StatusTag tone="success">منتشرشده</StatusTag>
                      ) : (
                        <StatusTag tone="neutral">پیش‌نویس</StatusTag>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-left">
                      <div className="inline-flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => openEditModal(v)}
                          aria-label={`ویرایش تنوع ${v.sku}`}
                          icon={<Edit3 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
                        >
                          ویرایش
                        </Button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(v)}
                          aria-label={`حذف تنوع ${v.sku}`}
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingVariant ? `ویرایش تنوع ${editingVariant.sku}` : 'افزودن تنوع جدید کالا'}
        subtitle="ثبت مشخصات انبارداری، پارت‌نامبر، رنگ، گارانتی و قیمت خرید و فروش"
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
            <Button type="submit" form="variant-form" variant="primary" loading={saving}>
              {editingVariant ? 'ذخیره تغییرات تنوع' : 'ثبت تنوع جدید'}
            </Button>
          </>
        }
      >
        <form id="variant-form" onSubmit={handleSave} className="space-y-4">
          {serverError && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-[#fef3f2] border border-[#fecaca] text-xs font-medium text-[#b42318]"
            >
              {serverError}
            </div>
          )}

          {editingVariant && (
            <div className="p-3 rounded-lg bg-[#f6f6f7] border border-black/[0.08] flex items-center justify-between text-xs">
              <span className="text-[#52565e]">موجودی قابل فروش در انبارها (خواندنی):</span>
              <span className="font-semibold text-[#0f49bd] tabular-nums-fa">
                {toPersianDigits(editingVariant.availableStock)} عدد
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="var-sku" className="block text-xs font-medium text-[#111315] mb-1.5">
                کد تنوع یکتا (SKU) *
              </label>
              <input
                id="var-sku"
                type="text"
                dir="ltr"
                value={form.sku}
                onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))}
                placeholder="APL-16PM-256-DSRT-ZAA"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] font-mono text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
              {formErrors.sku && <p className="mt-1 text-xs text-[#b42318]">{formErrors.sku}</p>}
            </div>

            <div>
              <label htmlFor="var-part" className="block text-xs font-medium text-[#111315] mb-1.5">
                پارت‌نامبر / ریجن
              </label>
              <input
                id="var-part"
                type="text"
                dir="ltr"
                value={form.partNumber || ''}
                onChange={(e) => setForm((p) => ({ ...p, partNumber: e.target.value }))}
                placeholder="ZA/A, CH/A, LL/A"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] font-mono text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <div>
              <label htmlFor="var-barcode" className="block text-xs font-medium text-[#111315] mb-1.5">
                بارکد
              </label>
              <input
                id="var-barcode"
                type="text"
                dir="ltr"
                value={form.barcode || ''}
                onChange={(e) => setForm((p) => ({ ...p, barcode: e.target.value }))}
                placeholder="195949821234"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] font-mono text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <div>
              <label htmlFor="var-color-fa" className="block text-xs font-medium text-[#111315] mb-1.5">
                نام فارسی رنگ
              </label>
              <input
                id="var-color-fa"
                type="text"
                value={form.colorNameFa || ''}
                onChange={(e) => setForm((p) => ({ ...p, colorNameFa: e.target.value }))}
                placeholder="تیتانیوم صحرایی"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <div>
              <label htmlFor="var-color-en" className="block text-xs font-medium text-[#111315] mb-1.5">
                نام انگلیسی رنگ
              </label>
              <input
                id="var-color-en"
                type="text"
                dir="ltr"
                value={form.colorNameEn || ''}
                onChange={(e) => setForm((p) => ({ ...p, colorNameEn: e.target.value }))}
                placeholder="Desert Titanium"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <div>
              <label htmlFor="var-color-hex" className="block text-xs font-medium text-[#111315] mb-1.5">
                کد رنگ
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="انتخابگر رنگ تنوع"
                  value={form.colorHex || '#1e293b'}
                  onChange={(e) => setForm((p) => ({ ...p, colorHex: e.target.value }))}
                  className="h-9 w-9 rounded-lg border border-black/[0.14] p-0.5 cursor-pointer bg-white shrink-0"
                />
                <input
                  id="var-color-hex"
                  type="text"
                  dir="ltr"
                  value={form.colorHex || ''}
                  onChange={(e) => setForm((p) => ({ ...p, colorHex: e.target.value }))}
                  placeholder="#c2a98b"
                  className="flex-1 h-9 px-3 rounded-lg border border-black/[0.14] font-mono text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="var-storage" className="block text-xs font-medium text-[#111315] mb-1.5">
                حافظه داخلی
              </label>
              <input
                id="var-storage"
                type="text"
                value={form.storage || ''}
                onChange={(e) => setForm((p) => ({ ...p, storage: e.target.value }))}
                placeholder="۲۵۶ گیگابایت"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <div>
              <label htmlFor="var-ram" className="block text-xs font-medium text-[#111315] mb-1.5">
                حافظه رم
              </label>
              <input
                id="var-ram"
                type="text"
                value={form.ram || ''}
                onChange={(e) => setForm((p) => ({ ...p, ram: e.target.value }))}
                placeholder="۸ گیگابایت"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <div>
              <label htmlFor="var-sim" className="block text-xs font-medium text-[#111315] mb-1.5">
                نوع سیم‌کارت
              </label>
              <input
                id="var-sim"
                type="text"
                value={form.simType || ''}
                onChange={(e) => setForm((p) => ({ ...p, simType: e.target.value }))}
                placeholder="دو سیم‌کارت فیزیکی (ZA/A)"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <div className="sm:col-span-3">
              <label htmlFor="var-warranty" className="block text-xs font-medium text-[#111315] mb-1.5">
                شرکت گارانتی
              </label>
              <select
                id="var-warranty"
                value={form.warrantyId || ''}
                onChange={(e) => setForm((p) => ({ ...p, warrantyId: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              >
                <option value="">انتخاب گارانتی</option>
                {warranties.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.providerName} ({toPersianDigits(w.durationMonths)} ماه)
                    {!w.isActive ? ' [غیرفعال]' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="var-price" className="block text-xs font-medium text-[#111315] mb-1.5">
                قیمت فروش (تومان) *
              </label>
              <input
                id="var-price"
                type="number"
                min={0}
                dir="ltr"
                value={form.priceToman || ''}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    priceToman: Math.max(0, Number(toEnglishDigits(e.target.value)) || 0),
                  }))
                }
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs font-semibold text-[#111315] tabular-nums-fa focus:outline-none focus:border-[#0f49bd]"
              />
              <p className="mt-1 text-[11px] text-[#0f49bd] tabular-nums-fa">
                {form.priceToman > 0 ? formatToman(form.priceToman) : 'وارد نشده'}
              </p>
              {formErrors.priceToman && (
                <p className="mt-1 text-xs text-[#b42318]">{formErrors.priceToman}</p>
              )}
            </div>

            <div>
              <label htmlFor="var-orig-price" className="block text-xs font-medium text-[#111315] mb-1.5">
                قیمت قبل از تخفیف (تومان)
              </label>
              <input
                id="var-orig-price"
                type="number"
                min={0}
                dir="ltr"
                value={form.originalPriceToman ?? ''}
                onChange={(e) => {
                  const raw = toEnglishDigits(e.target.value).trim();
                  setForm((p) => ({
                    ...p,
                    originalPriceToman: raw ? Number(raw) : null,
                  }));
                }}
                placeholder="اختیاری"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] tabular-nums-fa focus:outline-none focus:border-[#0f49bd]"
              />
              {formErrors.originalPriceToman && (
                <p className="mt-1 text-xs text-[#b42318]">{formErrors.originalPriceToman}</p>
              )}
            </div>

            <div>
              <label htmlFor="var-cost-price" className="block text-xs font-medium text-[#111315] mb-1.5">
                قیمت خرید / تمام‌شده
              </label>
              <input
                id="var-cost-price"
                type="number"
                min={0}
                dir="ltr"
                value={form.costPriceToman ?? ''}
                onChange={(e) => {
                  const raw = toEnglishDigits(e.target.value).trim();
                  setForm((p) => ({
                    ...p,
                    costPriceToman: raw ? Number(raw) : null,
                  }));
                }}
                placeholder="اختیاری"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] tabular-nums-fa focus:outline-none focus:border-[#0f49bd]"
              />
              <p className="mt-1 text-[11px] text-[#52565e] tabular-nums-fa">
                {liveMargin
                  ? `سود تقریبی: ${formatPersianNumber(liveMargin.profitToman)} ت (${toPersianDigits(liveMargin.marginPercent)}٪)`
                  : 'فقط در پنل ادمین نمایش داده می‌شود'}
              </p>
              {formErrors.costPriceToman && (
                <p className="mt-1 text-xs text-[#b42318]">{formErrors.costPriceToman}</p>
              )}
            </div>

            <div className="sm:col-span-3 pt-2 border-t border-black/[0.06]">
              <SwitchToggle
                id="var-published"
                checked={form.isPublished}
                onChange={(val) => setForm((p) => ({ ...p, isPublished: val }))}
                label="انتشار تنوع در فروشگاه"
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
        title="حذف تنوع کالا"
        description={`آیا از حذف تنوع «${deleteTarget?.sku || ''}» اطمینان دارید؟`}
        confirmLabel="حذف تنوع"
      />

      <Modal
        open={matrixOpen}
        onClose={() => setMatrixOpen(false)}
        title="تولید ماتریس تنوع کالا"
        subtitle="ایجاد خودکار تنوع‌های رنگ × حافظه × سیم‌کارت با پیش‌نمایش SKU"
        maxWidthClass="max-w-2xl"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setMatrixOpen(false)}
              disabled={matrixCreating}
            >
              بستن
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={matrixCreating}
              disabled={matrixPreviewRows.length === 0 || matrixPrice <= 0}
              onClick={() => void handleGenerateMatrix()}
            >
              ایجاد {toPersianDigits(matrixPreviewRows.length)} تنوع
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {matrixResultMsg && (
            <div className="p-3 rounded-lg bg-[#fef3f2] border border-[#fecaca] text-xs font-medium text-[#b42318]">
              {matrixResultMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="mx-prefix" className="block text-xs font-medium text-[#111315] mb-1.5">
                پیشوند SKU *
              </label>
              <input
                id="mx-prefix"
                type="text"
                dir="ltr"
                value={matrixSkuPrefix}
                onChange={(e) => setMatrixSkuPrefix(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] font-mono text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <div>
              <label htmlFor="mx-price" className="block text-xs font-medium text-[#111315] mb-1.5">
                قیمت پایه فروش (تومان) *
              </label>
              <input
                id="mx-price"
                type="number"
                min={0}
                dir="ltr"
                value={matrixPrice || ''}
                onChange={(e) => setMatrixPrice(Math.max(0, Number(toEnglishDigits(e.target.value)) || 0))}
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs font-semibold text-[#111315] tabular-nums-fa focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="mx-colors" className="block text-xs font-medium text-[#111315] mb-1.5">
                رنگ‌ها (با کاما جدا کنید — فرمت اختیاری نام:کد رنگ)
              </label>
              <input
                id="mx-colors"
                type="text"
                value={matrixColors}
                onChange={(e) => setMatrixColors(e.target.value)}
                placeholder="مشکی:#1e293b, تیتانیوم صحرایی:#c2a98b"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <div>
              <label htmlFor="mx-storages" className="block text-xs font-medium text-[#111315] mb-1.5">
                حافظه‌ها (با کاما جدا کنید)
              </label>
              <input
                id="mx-storages"
                type="text"
                dir="ltr"
                value={matrixStorages}
                onChange={(e) => setMatrixStorages(e.target.value)}
                placeholder="256GB, 512GB, 1TB"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] font-mono text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <div>
              <label htmlFor="mx-sims" className="block text-xs font-medium text-[#111315] mb-1.5">
                انواع سیم‌کارت / ریجن (با کاما)
              </label>
              <input
                id="mx-sims"
                type="text"
                value={matrixSimTypes}
                onChange={(e) => setMatrixSimTypes(e.target.value)}
                placeholder="دو سیم‌کارت ZAA, تک سیم‌کارت LLA"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="mx-warranty" className="block text-xs font-medium text-[#111315] mb-1.5">
                شرکت گارانتی پیش‌فرض
              </label>
              <select
                id="mx-warranty"
                value={matrixWarrantyId}
                onChange={(e) => setMatrixWarrantyId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              >
                <option value="">بدون انتخاب گارانتی</option>
                {warranties.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.providerName} ({toPersianDigits(w.durationMonths)} ماه)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-black/[0.08] bg-[#f6f6f7] p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#111315]">
                پیش‌نمایش ترکیب‌های جدید ({toPersianDigits(matrixPreviewRows.length)} مورد)
              </span>
              {matrixPrice > 0 && (
                <span className="text-[#0f49bd] font-medium tabular-nums-fa">
                  قیمت هر تنوع: {formatToman(matrixPrice)}
                </span>
              )}
            </div>
            {matrixPreviewRows.length === 0 ? (
              <p className="text-[11px] text-[#7c818c]">
                ترکیب جدیدی برای ساخت وجود ندارد (ممکن است همه SKUها از قبل ثبت شده باشند).
              </p>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-1 text-[11px]">
                {matrixPreviewRows.map((row) => (
                  <div
                    key={row.sku}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-white border border-black/[0.06]"
                  >
                    <span className="font-mono font-medium text-[#0f49bd]" dir="ltr">
                      {row.sku}
                    </span>
                    <span className="text-[#52565e]">
                      {[row.colorNameFa, row.storage, row.simType].filter(Boolean).join(' · ') || 'استاندارد'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </Card>
  );
}
