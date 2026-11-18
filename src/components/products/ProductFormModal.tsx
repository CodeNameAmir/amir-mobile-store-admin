import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type {
  BrandId,
  Product,
  ProductCategoryId,
  ProductColor,
  ProductInput,
  StorageVariant,
} from '../../types/admin';
import {
  BRAND_OPTIONS,
  CATEGORY_LABELS,
  computeDiscountPercent,
  slugifyProductId,
  toEnglishDigits,
  validateProductInput,
} from '../../utils/formatters';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  initialProduct: Product | null;
  onSubmit: (input: ProductInput, isEdit: boolean) => Promise<void>;
}

const EMPTY_INPUT: ProductInput = {
  id: '',
  slug: '',
  nameFa: '',
  nameEn: '',
  brand: 'Apple',
  category: 'phones',
  price: 0,
  originalPrice: null,
  discountPercent: 0,
  inStock: true,
  stockCount: 10,
  expressDelivery: true,
  warranty: '۱۸ ماهه امیر سرویس + کد رجیستری همتا',
  badgeText: null,
  image: '',
  colorLabel: 'مشکی',
  colors: [{ id: 'midnight', name: 'مشکی', hex: '#1e293b' }],
  storageOptions: [{ label: '۲۵۶ گیگابایت', subtitle: 'نسخه استاندارد', priceDelta: 0 }],
  specs: {
    display: '',
    displayDetails: '',
    chipset: '',
    chipsetDetails: '',
    camera: '',
    cameraDetails: '',
    battery: '',
    batteryDetails: '',
    storageDefault: '۲۵۶ گیگابایت',
    ram: '۸ گیگ',
    os: '',
  },
  isFeaturedDeal: false,
  isPopular: false,
  salesRank: 100,
  releaseOrder: 100,
};

function toProductInput(product: Product): ProductInput {
  return {
    id: product.id,
    slug: product.slug,
    nameFa: product.nameFa,
    nameEn: product.nameEn,
    brand: product.brand,
    category: product.category,
    price: product.price,
    originalPrice: product.originalPrice ?? null,
    discountPercent: product.discountPercent ?? 0,
    inStock: product.inStock,
    stockCount: product.stockCount,
    expressDelivery: product.expressDelivery,
    warranty: product.warranty,
    badgeText: product.badgeText ?? null,
    image: product.image || '',
    colorLabel: product.colorLabel || 'مشکی',
    colors: Array.isArray(product.colors) && product.colors.length ? product.colors : EMPTY_INPUT.colors,
    storageOptions:
      Array.isArray(product.storageOptions) && product.storageOptions.length
        ? product.storageOptions
        : EMPTY_INPUT.storageOptions,
    specs: {
      display: product.specs?.display || '',
      displayDetails: product.specs?.displayDetails || '',
      chipset: product.specs?.chipset || '',
      chipsetDetails: product.specs?.chipsetDetails || '',
      camera: product.specs?.camera || '',
      cameraDetails: product.specs?.cameraDetails || '',
      battery: product.specs?.battery || '',
      batteryDetails: product.specs?.batteryDetails || '',
      storageDefault: product.specs?.storageDefault || '',
      ram: product.specs?.ram || '',
      os: product.specs?.os || '',
    },
    isFeaturedDeal: Boolean(product.isFeaturedDeal),
    isPopular: Boolean(product.isPopular),
    salesRank: product.salesRank,
    releaseOrder: product.releaseOrder,
  };
}

export function ProductFormModal({
  open,
  onClose,
  initialProduct,
  onSubmit,
}: ProductFormModalProps) {
  const isEdit = Boolean(initialProduct);
  const [form, setForm] = useState<ProductInput>(EMPTY_INPUT);
  const [idTouched, setIdTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initialProduct) {
      setForm(toProductInput(initialProduct));
      setIdTouched(true);
    } else {
      setForm(EMPTY_INPUT);
      setIdTouched(false);
    }
    setErrors({});
  }, [open, initialProduct]);

  const handleNameEnChange = (value: string) => {
    setForm((prev) => {
      const next = { ...prev, nameEn: value };
      if (!isEdit && !idTouched) {
        const autoSlug = slugifyProductId(value);
        next.id = autoSlug;
        next.slug = autoSlug;
      }
      return next;
    });
  };

  const handlePriceChange = (priceVal: number, originalVal: number | null) => {
    const discountPercent = computeDiscountPercent(priceVal, originalVal);
    setForm((prev) => ({
      ...prev,
      price: priceVal,
      originalPrice: originalVal,
      discountPercent,
    }));
  };

  const safeColors = Array.isArray(form.colors) ? form.colors : [];
  const safeStorageOptions = Array.isArray(form.storageOptions) ? form.storageOptions : [];

  const addColor = () => {
    setForm((prev) => {
      const current = Array.isArray(prev.colors) ? prev.colors : [];
      return {
        ...prev,
        colors: [...current, { id: `color-${current.length + 1}`, name: '', hex: '#1e293b' }],
      };
    });
  };

  const updateColor = (idx: number, patch: Partial<ProductColor>) => {
    setForm((prev) => ({
      ...prev,
      colors: (Array.isArray(prev.colors) ? prev.colors : []).map((c, i) =>
        i === idx ? { ...c, ...patch } : c
      ),
    }));
  };

  const removeColor = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      colors: (Array.isArray(prev.colors) ? prev.colors : []).filter((_, i) => i !== idx),
    }));
  };

  const addStorageOption = () => {
    setForm((prev) => ({
      ...prev,
      storageOptions: [
        ...(Array.isArray(prev.storageOptions) ? prev.storageOptions : []),
        { label: '', subtitle: '', priceDelta: 0 },
      ],
    }));
  };

  const updateStorageOption = (idx: number, patch: Partial<StorageVariant>) => {
    setForm((prev) => ({
      ...prev,
      storageOptions: (Array.isArray(prev.storageOptions) ? prev.storageOptions : []).map((s, i) =>
        i === idx ? { ...s, ...patch } : s
      ),
    }));
  };

  const removeStorageOption = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      storageOptions: (Array.isArray(prev.storageOptions) ? prev.storageOptions : []).filter(
        (_, i) => i !== idx
      ),
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const currentColors = Array.isArray(form.colors) ? form.colors : [];
    const currentStorage = Array.isArray(form.storageOptions) ? form.storageOptions : [];
    const cleaned: ProductInput = {
      ...form,
      id: (form.id || '').trim().toLowerCase(),
      slug: (form.slug || '').trim().toLowerCase(),
      nameFa: (form.nameFa || '').trim(),
      nameEn: (form.nameEn || '').trim(),
      warranty: (form.warranty || '').trim(),
      badgeText: form.badgeText?.trim() || null,
      image: (form.image || '').trim(),
      colorLabel: (form.colorLabel || '').trim() || currentColors[0]?.name || 'مشکی',
      colors: currentColors.filter((c) => c?.name?.trim()),
      storageOptions: currentStorage.filter((s) => s?.label?.trim()),
    };

    const validation = validateProductInput(cleaned);
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(cleaned, isEdit);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `ویرایش محصول: ${initialProduct?.nameFa}` : 'افزودن محصول جدید'}
      subtitle="فیلدهای مطابق ساختار جدول products در پایگاه داده Supabase"
      maxWidthClass="max-w-3xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            انصراف
          </Button>
          <Button
            type="submit"
            form="product-form"
            variant="primary"
            loading={submitting}
          >
            {isEdit ? 'ذخیره تغییرات' : 'ایجاد محصول'}
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Core identity */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="pf-name-fa" className="block text-xs font-medium text-[#0b1c30] mb-1">
              نام فارسی محصول *
            </label>
            <input
              id="pf-name-fa"
              type="text"
              value={form.nameFa}
              onChange={(e) => setForm((p) => ({ ...p, nameFa: e.target.value }))}
              placeholder="گوشی موبایل اپل مدل iPhone 16 Pro Max"
              className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-sm focus:outline-none focus:border-[#2563eb]"
            />
            {errors.nameFa && <p className="mt-1 text-xs text-[#ba1a1a]">{errors.nameFa}</p>}
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="pf-name-en" className="block text-xs font-medium text-[#0b1c30] mb-1">
              نام انگلیسی محصول *
            </label>
            <input
              id="pf-name-en"
              type="text"
              dir="ltr"
              value={form.nameEn}
              onChange={(e) => handleNameEnChange(e.target.value)}
              placeholder="Apple iPhone 16 Pro Max 256GB"
              className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-sm focus:outline-none focus:border-[#2563eb]"
            />
            {errors.nameEn && <p className="mt-1 text-xs text-[#ba1a1a]">{errors.nameEn}</p>}
          </div>

          <div>
            <label htmlFor="pf-id" className="block text-xs font-medium text-[#0b1c30] mb-1">
              شناسه یکتا (ID) *
            </label>
            <input
              id="pf-id"
              type="text"
              dir="ltr"
              disabled={isEdit}
              value={form.id}
              onChange={(e) => {
                setIdTouched(true);
                const val = slugifyProductId(e.target.value);
                setForm((p) => ({ ...p, id: val, slug: p.slug || val }));
              }}
              placeholder="iphone-16-pro-max"
              className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-sm disabled:bg-[#f8f9ff] focus:outline-none focus:border-[#2563eb]"
            />
            {errors.id && <p className="mt-1 text-xs text-[#ba1a1a]">{errors.id}</p>}
          </div>

          <div>
            <label htmlFor="pf-slug" className="block text-xs font-medium text-[#0b1c30] mb-1">
              نامک آدرس (Slug) *
            </label>
            <input
              id="pf-slug"
              type="text"
              dir="ltr"
              value={form.slug}
              onChange={(e) => {
                setIdTouched(true);
                setForm((p) => ({ ...p, slug: slugifyProductId(e.target.value) }));
              }}
              placeholder="iphone-16-pro-max"
              className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-sm focus:outline-none focus:border-[#2563eb]"
            />
            {errors.slug && <p className="mt-1 text-xs text-[#ba1a1a]">{errors.slug}</p>}
          </div>

          <div>
            <label htmlFor="pf-brand" className="block text-xs font-medium text-[#0b1c30] mb-1">
              برند *
            </label>
            <select
              id="pf-brand"
              value={form.brand}
              onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value as BrandId }))}
              className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] bg-white text-sm focus:outline-none focus:border-[#2563eb]"
            >
              {BRAND_OPTIONS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="pf-category" className="block text-xs font-medium text-[#0b1c30] mb-1">
              دسته‌بندی *
            </label>
            <select
              id="pf-category"
              value={form.category}
              onChange={(e) =>
                setForm((p) => ({ ...p, category: e.target.value as ProductCategoryId }))
              }
              className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] bg-white text-sm focus:outline-none focus:border-[#2563eb]"
            >
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Pricing & Stock */}
        <div className="pt-4 border-t border-[#c3c6d7]/50 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="pf-price" className="block text-xs font-medium text-[#0b1c30] mb-1">
              قیمت فروش (تومان) *
            </label>
            <input
              id="pf-price"
              type="number"
              min={0}
              dir="ltr"
              value={form.price || ''}
              onChange={(e) => {
                const nextPrice = Number(toEnglishDigits(e.target.value)) || 0;
                handlePriceChange(nextPrice, form.originalPrice);
              }}
              className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-sm tabular-nums-fa focus:outline-none focus:border-[#2563eb]"
            />
            {errors.price && <p className="mt-1 text-xs text-[#ba1a1a]">{errors.price}</p>}
          </div>

          <div>
            <label htmlFor="pf-orig-price" className="block text-xs font-medium text-[#0b1c30] mb-1">
              قیمت قبل از تخفیف (تومان)
            </label>
            <input
              id="pf-orig-price"
              type="number"
              min={0}
              dir="ltr"
              value={form.originalPrice ?? ''}
              onChange={(e) => {
                const raw = toEnglishDigits(e.target.value).trim();
                const nextOrig = raw ? Number(raw) : null;
                handlePriceChange(form.price, nextOrig);
              }}
              placeholder="اختیاری"
              className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-sm tabular-nums-fa focus:outline-none focus:border-[#2563eb]"
            />
            {errors.originalPrice && (
              <p className="mt-1 text-xs text-[#ba1a1a]">{errors.originalPrice}</p>
            )}
          </div>

          <div>
            <label htmlFor="pf-stock" className="block text-xs font-medium text-[#0b1c30] mb-1">
              تعداد موجودی انبار *
            </label>
            <input
              id="pf-stock"
              type="number"
              min={0}
              dir="ltr"
              value={form.stockCount}
              onChange={(e) => {
                const count = Math.max(0, Math.floor(Number(e.target.value) || 0));
                setForm((p) => ({
                  ...p,
                  stockCount: count,
                  inStock: count > 0 ? p.inStock : false,
                }));
              }}
              className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-sm tabular-nums-fa focus:outline-none focus:border-[#2563eb]"
            />
            {errors.stockCount && (
              <p className="mt-1 text-xs text-[#ba1a1a]">{errors.stockCount}</p>
            )}
          </div>

          <div>
            <label htmlFor="pf-warranty" className="block text-xs font-medium text-[#0b1c30] mb-1">
              گارانتی *
            </label>
            <input
              id="pf-warranty"
              type="text"
              value={form.warranty}
              onChange={(e) => setForm((p) => ({ ...p, warranty: e.target.value }))}
              className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-sm focus:outline-none focus:border-[#2563eb]"
            />
            {errors.warranty && <p className="mt-1 text-xs text-[#ba1a1a]">{errors.warranty}</p>}
          </div>

          <div>
            <label htmlFor="pf-badge" className="block text-xs font-medium text-[#0b1c30] mb-1">
              برچسب نمایشی (Badge)
            </label>
            <input
              id="pf-badge"
              type="text"
              value={form.badgeText ?? ''}
              onChange={(e) => setForm((p) => ({ ...p, badgeText: e.target.value || null }))}
              placeholder="مثال: ۴٪ تخفیف یا پرفروش"
              className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-sm focus:outline-none focus:border-[#2563eb]"
            />
          </div>

          <div>
            <label htmlFor="pf-image" className="block text-xs font-medium text-[#0b1c30] mb-1">
              نشانی تصویر محصول (URL)
            </label>
            <input
              id="pf-image"
              type="url"
              dir="ltr"
              value={form.image}
              onChange={(e) => setForm((p) => ({ ...p, image: e.target.value }))}
              placeholder="https://..."
              className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-sm focus:outline-none focus:border-[#2563eb]"
            />
          </div>
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap gap-5 pt-2">
          <label className="inline-flex items-center gap-2 text-xs font-medium text-[#0b1c30] cursor-pointer">
            <input
              type="checkbox"
              checked={form.inStock}
              onChange={(e) => setForm((p) => ({ ...p, inStock: e.target.checked }))}
              className="h-4 w-4 rounded border-[#c3c6d7] text-[#004ac6]"
            />
            <span>موجود برای فروش در سایت</span>
          </label>

          <label className="inline-flex items-center gap-2 text-xs font-medium text-[#0b1c30] cursor-pointer">
            <input
              type="checkbox"
              checked={form.expressDelivery}
              onChange={(e) => setForm((p) => ({ ...p, expressDelivery: e.target.checked }))}
              className="h-4 w-4 rounded border-[#c3c6d7] text-[#004ac6]"
            />
            <span>امکان ارسال اکسپرس</span>
          </label>

          <label className="inline-flex items-center gap-2 text-xs font-medium text-[#0b1c30] cursor-pointer">
            <input
              type="checkbox"
              checked={form.isFeaturedDeal}
              onChange={(e) => setForm((p) => ({ ...p, isFeaturedDeal: e.target.checked }))}
              className="h-4 w-4 rounded border-[#c3c6d7] text-[#004ac6]"
            />
            <span>پیشنهاد ویژه</span>
          </label>

          <label className="inline-flex items-center gap-2 text-xs font-medium text-[#0b1c30] cursor-pointer">
            <input
              type="checkbox"
              checked={form.isPopular}
              onChange={(e) => setForm((p) => ({ ...p, isPopular: e.target.checked }))}
              className="h-4 w-4 rounded border-[#c3c6d7] text-[#004ac6]"
            />
            <span>نمایش در محبوب‌ترین‌ها</span>
          </label>
        </div>

        {/* Technical Specs */}
        <div className="pt-4 border-t border-[#c3c6d7]/50 space-y-3">
          <h3 className="text-xs font-bold text-[#0b1c30]">مشخصات فنی (specs JSONB)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="text"
              aria-label="صفحه نمایش"
              placeholder="صفحه نمایش (مثال: ۶.۹ اینچ OLED)"
              value={form.specs.display}
              onChange={(e) =>
                setForm((p) => ({ ...p, specs: { ...p.specs, display: e.target.value } }))
              }
              className="h-9 px-3 rounded-xl border border-[#c3c6d7] text-xs"
            />
            <input
              type="text"
              aria-label="تراشه"
              placeholder="تراشه (مثال: Apple A18 Pro)"
              value={form.specs.chipset}
              onChange={(e) =>
                setForm((p) => ({ ...p, specs: { ...p.specs, chipset: e.target.value } }))
              }
              className="h-9 px-3 rounded-xl border border-[#c3c6d7] text-xs"
            />
            <input
              type="text"
              aria-label="دوربین"
              placeholder="دوربین (مثال: ۴۸ + ۴۸ + ۱۲ MP)"
              value={form.specs.camera}
              onChange={(e) =>
                setForm((p) => ({ ...p, specs: { ...p.specs, camera: e.target.value } }))
              }
              className="h-9 px-3 rounded-xl border border-[#c3c6d7] text-xs"
            />
            <input
              type="text"
              aria-label="باتری"
              placeholder="باتری (مثال: ۴۶۸۵ میلی‌آمپر)"
              value={form.specs.battery}
              onChange={(e) =>
                setForm((p) => ({ ...p, specs: { ...p.specs, battery: e.target.value } }))
              }
              className="h-9 px-3 rounded-xl border border-[#c3c6d7] text-xs"
            />
            <input
              type="text"
              aria-label="حافظه پیش‌فرض"
              placeholder="حافظه (مثال: ۲۵۶ گیگابایت)"
              value={form.specs.storageDefault}
              onChange={(e) =>
                setForm((p) => ({ ...p, specs: { ...p.specs, storageDefault: e.target.value } }))
              }
              className="h-9 px-3 rounded-xl border border-[#c3c6d7] text-xs"
            />
            <input
              type="text"
              aria-label="رم و سیستم عامل"
              placeholder="سیستم‌عامل (مثال: iOS 18)"
              value={form.specs.os}
              onChange={(e) =>
                setForm((p) => ({ ...p, specs: { ...p.specs, os: e.target.value } }))
              }
              className="h-9 px-3 rounded-xl border border-[#c3c6d7] text-xs"
            />
          </div>
        </div>

        {/* Colors & Storage Options */}
        <div className="pt-4 border-t border-[#c3c6d7]/50 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#0b1c30]">رنگ‌بندی‌ها</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={addColor}
                icon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                افزودن رنگ
              </Button>
            </div>
            {safeColors.map((c, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label={`رنگ ${idx + 1}`}
                  value={c.hex}
                  onChange={(e) => updateColor(idx, { hex: e.target.value })}
                  className="h-9 w-9 rounded-lg border border-[#c3c6d7] p-0.5 shrink-0"
                />
                <input
                  type="text"
                  placeholder="نام رنگ"
                  value={c.name}
                  onChange={(e) => updateColor(idx, { name: e.target.value })}
                  className="flex-1 h-9 px-2.5 rounded-lg border border-[#c3c6d7] text-xs"
                />
                {safeColors.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeColor(idx)}
                    aria-label="حذف رنگ"
                    className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-[#ba1a1a] hover:bg-[#ffdad6]/60"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-[#0b1c30]">ظرفیت‌ها / نسخه‌ها</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={addStorageOption}
                icon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                افزودن نسخه
              </Button>
            </div>
            {safeStorageOptions.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="برچسب (۲۵۶ گیگ)"
                  value={opt.label}
                  onChange={(e) => updateStorageOption(idx, { label: e.target.value })}
                  className="flex-1 h-9 px-2.5 rounded-lg border border-[#c3c6d7] text-xs"
                />
                <input
                  type="number"
                  dir="ltr"
                  placeholder="اختلاف قیمت"
                  value={opt.priceDelta}
                  onChange={(e) =>
                    updateStorageOption(idx, { priceDelta: Number(e.target.value) || 0 })
                  }
                  className="w-28 h-9 px-2.5 rounded-lg border border-[#c3c6d7] text-xs tabular-nums-fa"
                />
                {safeStorageOptions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeStorageOption(idx)}
                    aria-label="حذف نسخه"
                    className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-[#ba1a1a] hover:bg-[#ffdad6]/60"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}
