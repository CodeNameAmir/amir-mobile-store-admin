import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Image as ImageIcon,
  Plus,
  Save,
  Smartphone,
  Trash2,
} from 'lucide-react';
import type {
  BrandId,
  Product,
  ProductCategoryId,
  ProductColor,
  ProductInput,
  StorageVariant,
} from '../types/admin';
import { adminApi } from '../services/adminApi';
import { getCachedValue, setCachedValue } from '../services/adminCache';
import { ApiError } from '../services/apiClient';
import { useRouter } from '../router';
import { useToast } from '../context/ToastContext';
import {
  BRAND_OPTIONS,
  CATEGORY_LABELS,
  computeDiscountPercent,
  formatToman,
  slugifyProductId,
  toEnglishDigits,
  toPersianDigits,
  validateProductInput,
} from '../utils/formatters';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ErrorState, LoadingSkeleton } from '../components/ui/StateViews';

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
    discountPercent: product.discountPercent ?? computeDiscountPercent(product.price, product.originalPrice),
    inStock: product.inStock,
    stockCount: product.stockCount,
    expressDelivery: product.expressDelivery,
    warranty: product.warranty || '۱۸ ماهه امیر سرویس + کد رجیستری همتا',
    badgeText: product.badgeText ?? null,
    image: product.image || '',
    colorLabel: product.colorLabel || 'مشکی',
    colors:
      Array.isArray(product.colors) && product.colors.length
        ? product.colors.map((c) => ({ ...c }))
        : EMPTY_INPUT.colors.map((c) => ({ ...c })),
    storageOptions:
      Array.isArray(product.storageOptions) && product.storageOptions.length
        ? product.storageOptions.map((s) => ({ ...s }))
        : EMPTY_INPUT.storageOptions.map((s) => ({ ...s })),
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
    salesRank: product.salesRank ?? 100,
    releaseOrder: product.releaseOrder ?? 100,
  };
}

interface ProductEditorPageProps {
  mode: 'create' | 'edit';
  productId?: string;
}

export function ProductEditorPage({ mode, productId }: ProductEditorPageProps) {
  const isEdit = mode === 'edit';
  const { navigate } = useRouter();
  const { pushToast } = useToast();

  const [form, setForm] = useState<ProductInput>(EMPTY_INPUT);
  const [idTouched, setIdTouched] = useState(isEdit);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadingProduct, setLoadingProduct] = useState(isEdit);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const loadExistingProduct = useCallback(async () => {
    if (!isEdit) return;
    const cleanId = (productId || '').trim();
    if (!cleanId) {
      setLoadError('شناسه محصول برای ویرایش مشخص نشده است.');
      setLoadingProduct(false);
      return;
    }

    const cached = getCachedValue<Product>(`product:${cleanId}`);
    if (cached) {
      setForm(toProductInput(cached.data));
      setIdTouched(true);
      setLoadingProduct(false);
      setLoadError(null);
      if (cached.isFresh) return;
    } else {
      setLoadingProduct(true);
      setLoadError(null);
    }

    try {
      const res = await adminApi.getProduct(cleanId);
      setCachedValue(`product:${cleanId}`, res.product);
      setForm(toProductInput(res.product));
      setIdTouched(true);
      setLoadError(null);
    } catch (err) {
      if (!cached) {
        setLoadError(err instanceof ApiError ? err.message : 'خطا در بارگذاری اطلاعات محصول.');
      }
    } finally {
      setLoadingProduct(false);
    }
  }, [isEdit, productId]);

  useEffect(() => {
    if (isEdit) {
      void loadExistingProduct();
    } else {
      setForm(EMPTY_INPUT);
      setIdTouched(false);
      setErrors({});
      setLoadingProduct(false);
      setLoadError(null);
    }
  }, [isEdit, loadExistingProduct]);

  useEffect(() => {
    setImageFailed(false);
  }, [form.image]);

  const safeColors = Array.isArray(form.colors) ? form.colors : [];
  const safeStorageOptions = Array.isArray(form.storageOptions) ? form.storageOptions : [];

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
      colors: currentColors
        .filter((c) => c?.name?.trim())
        .map((c, idx) => ({
          id: (c.id || '').trim() || `color-${idx + 1}`,
          name: c.name.trim(),
          hex: c.hex || '#1e293b',
        })),
      storageOptions: currentStorage
        .filter((s) => s?.label?.trim())
        .map((s) => ({
          label: s.label.trim(),
          subtitle: (s.subtitle || '').trim(),
          priceDelta: Number(s.priceDelta) || 0,
        })),
      inStock: form.stockCount === 0 ? false : Boolean(form.inStock),
    };

    const validation = validateProductInput(cleaned);
    if (Object.keys(validation).length > 0) {
      setErrors(validation);
      pushToast({
        tone: 'error',
        title: 'لطفاً خطاهای فرم را بررسی کنید',
        description: Object.values(validation)[0],
      });
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      if (isEdit) {
        const res = await adminApi.updateProduct(cleaned.id, cleaned);
        setCachedValue(`product:${res.product.id}`, res.product);
        pushToast({
          tone: 'success',
          title: 'تغییرات کامل محصول ذخیره شد',
          description: res.product.nameFa,
        });
      } else {
        const res = await adminApi.createProduct(cleaned);
        setCachedValue(`product:${res.product.id}`, res.product);
        pushToast({
          tone: 'success',
          title: 'محصول جدید با موفقیت ثبت شد',
          description: res.product.nameFa,
        });
      }
      navigate('/products');
    } catch (err) {
      pushToast({
        tone: 'error',
        title: isEdit ? 'خطا در ذخیره ویرایش محصول' : 'خطا در ایجاد محصول جدید',
        description: err instanceof ApiError ? err.message : 'لطفاً دوباره تلاش کنید.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingProduct) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-[#0b1c30]">در حال بارگذاری اطلاعات محصول...</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/products')}
            icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
          >
            بازگشت به محصولات
          </Button>
        </div>
        <Card padding="lg">
          <LoadingSkeleton rows={6} />
        </Card>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-[#0b1c30]">ویرایش کامل محصول</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/products')}
            icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
          >
            بازگشت به محصولات
          </Button>
        </div>
        <ErrorState message={loadError} onRetry={() => void loadExistingProduct()} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Page Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#c3c6d7]/60">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-[#434655]">
            <button
              type="button"
              onClick={() => navigate('/products')}
              className="hover:text-[#004ac6] transition-colors"
            >
              مدیریت محصولات
            </button>
            <span aria-hidden="true">/</span>
            <span className="text-[#0b1c30] font-medium">
              {isEdit ? 'ویرایش کامل محصول' : 'افزودن محصول جدید'}
            </span>
          </div>
          <h1 className="mt-1.5 text-xl font-bold text-[#0b1c30] truncate">
            {isEdit ? form.nameFa || `ویرایش ${productId}` : 'ثبت محصول جدید در کاتالوگ'}
          </h1>
          <p className="mt-0.5 text-xs text-[#434655]">
            {isEdit
              ? 'ویرایش جامع مشخصات فنی، تنوع رنگ، ظرفیت‌ها، قیمت‌گذاری و تنظیمات نمایش در فروشگاه'
              : 'تکمیل تمام جزئیات محصول برای انتشار دقیق در فروشگاه آنلاین'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/products')}
            disabled={submitting}
            icon={<ArrowRight className="h-4 w-4" aria-hidden="true" />}
          >
            انصراف و بازگشت
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={submitting}
            icon={<Save className="h-4 w-4" aria-hidden="true" />}
          >
            {isEdit ? 'ذخیره تغییرات کامل' : 'ثبت و انتشار محصول'}
          </Button>
        </div>
      </div>

      {/* Main 2-column Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Primary Editor Column */}
        <div className="xl:col-span-8 space-y-6">
          {/* Section 1: Core Identity */}
          <Card padding="lg">
            <div className="mb-4 pb-3 border-b border-[#c3c6d7]/40">
              <h2 className="text-sm font-bold text-[#0b1c30]">۱. هویت کالا و دسته‌بندی</h2>
              <p className="mt-0.5 text-xs text-[#434655]">
                نام‌های نمایشی، شناسه یکتا، برند و دسته‌بندی محصول در جدول کاتالوگ
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="pe-name-fa" className="block text-xs font-medium text-[#0b1c30] mb-1">
                  نام فارسی محصول *
                </label>
                <input
                  id="pe-name-fa"
                  type="text"
                  value={form.nameFa}
                  onChange={(e) => setForm((p) => ({ ...p, nameFa: e.target.value }))}
                  placeholder="گوشی موبایل اپل مدل iPhone 16 Pro Max ظرفیت ۲۵۶ گیگابایت"
                  className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-sm focus:outline-none focus:border-[#2563eb]"
                />
                {errors.nameFa && <p className="mt-1 text-xs text-[#ba1a1a]">{errors.nameFa}</p>}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="pe-name-en" className="block text-xs font-medium text-[#0b1c30] mb-1">
                  نام انگلیسی محصول *
                </label>
                <input
                  id="pe-name-en"
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
                <label htmlFor="pe-id" className="block text-xs font-medium text-[#0b1c30] mb-1">
                  شناسه یکتا (ID) *
                </label>
                <input
                  id="pe-id"
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
                  className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-sm disabled:bg-[#f8f9ff] disabled:text-[#434655] focus:outline-none focus:border-[#2563eb]"
                />
                {errors.id && <p className="mt-1 text-xs text-[#ba1a1a]">{errors.id}</p>}
              </div>

              <div>
                <label htmlFor="pe-slug" className="block text-xs font-medium text-[#0b1c30] mb-1">
                  نامک آدرس (Slug) *
                </label>
                <input
                  id="pe-slug"
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
                <label htmlFor="pe-brand" className="block text-xs font-medium text-[#0b1c30] mb-1">
                  برند *
                </label>
                <select
                  id="pe-brand"
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
                <label htmlFor="pe-category" className="block text-xs font-medium text-[#0b1c30] mb-1">
                  دسته‌بندی *
                </label>
                <select
                  id="pe-category"
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

              <div className="sm:col-span-2">
                <label htmlFor="pe-warranty" className="block text-xs font-medium text-[#0b1c30] mb-1">
                  عنوان گارانتی *
                </label>
                <input
                  id="pe-warranty"
                  type="text"
                  value={form.warranty}
                  onChange={(e) => setForm((p) => ({ ...p, warranty: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-sm focus:outline-none focus:border-[#2563eb]"
                />
                {errors.warranty && <p className="mt-1 text-xs text-[#ba1a1a]">{errors.warranty}</p>}
              </div>
            </div>
          </Card>

          {/* Section 2: Pricing & Inventory */}
          <Card padding="lg">
            <div className="mb-4 pb-3 border-b border-[#c3c6d7]/40">
              <h2 className="text-sm font-bold text-[#0b1c30]">۲. قیمت‌گذاری، تخفیف و موجودی انبار</h2>
              <p className="mt-0.5 text-xs text-[#434655]">
                محاسبه خودکار درصد تخفیف و کنترل وضعیت موجودی و ارسال فوری
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="pe-price" className="block text-xs font-medium text-[#0b1c30] mb-1">
                  قیمت فروش فعلی (تومان) *
                </label>
                <input
                  id="pe-price"
                  type="number"
                  min={0}
                  dir="ltr"
                  value={form.price || ''}
                  onChange={(e) => {
                    const nextPrice = Number(toEnglishDigits(e.target.value)) || 0;
                    handlePriceChange(nextPrice, form.originalPrice);
                  }}
                  className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-sm font-semibold tabular-nums-fa focus:outline-none focus:border-[#2563eb]"
                />
                <p className="mt-1 text-[11px] text-[#004ac6] tabular-nums-fa">
                  {form.price > 0 ? formatToman(form.price) : 'وارد نشده'}
                </p>
                {errors.price && <p className="mt-1 text-xs text-[#ba1a1a]">{errors.price}</p>}
              </div>

              <div>
                <label htmlFor="pe-orig-price" className="block text-xs font-medium text-[#0b1c30] mb-1">
                  قیمت قبل از تخفیف (تومان)
                </label>
                <input
                  id="pe-orig-price"
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
                <p className="mt-1 text-[11px] text-[#434655] tabular-nums-fa">
                  {form.discountPercent > 0
                    ? `تخفیف خودکار: ${toPersianDigits(form.discountPercent)}٪`
                    : 'بدون خط‌خوردگی قیمت'}
                </p>
                {errors.originalPrice && (
                  <p className="mt-1 text-xs text-[#ba1a1a]">{errors.originalPrice}</p>
                )}
              </div>

              <div>
                <label htmlFor="pe-stock" className="block text-xs font-medium text-[#0b1c30] mb-1">
                  تعداد موجودی انبار *
                </label>
                <input
                  id="pe-stock"
                  type="number"
                  min={0}
                  dir="ltr"
                  value={form.stockCount}
                  onChange={(e) => {
                    const count = Math.max(0, Math.floor(Number(toEnglishDigits(e.target.value)) || 0));
                    setForm((p) => ({
                      ...p,
                      stockCount: count,
                      inStock: count > 0 ? p.inStock : false,
                    }));
                  }}
                  className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-sm font-bold tabular-nums-fa focus:outline-none focus:border-[#2563eb]"
                />
                {errors.stockCount && (
                  <p className="mt-1 text-xs text-[#ba1a1a]">{errors.stockCount}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="pe-badge" className="block text-xs font-medium text-[#0b1c30] mb-1">
                  برچسب تبلیغاتی روی کارت (Badge)
                </label>
                <input
                  id="pe-badge"
                  type="text"
                  value={form.badgeText ?? ''}
                  onChange={(e) => setForm((p) => ({ ...p, badgeText: e.target.value || null }))}
                  placeholder="مثال: ۴٪ تخفیف · پرفروش · رجیسترشده"
                  className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-sm focus:outline-none focus:border-[#2563eb]"
                />
              </div>

              <div>
                <label htmlFor="pe-color-label" className="block text-xs font-medium text-[#0b1c30] mb-1">
                  عنوان رنگ پیش‌فرض
                </label>
                <input
                  id="pe-color-label"
                  type="text"
                  value={form.colorLabel}
                  onChange={(e) => setForm((p) => ({ ...p, colorLabel: e.target.value }))}
                  placeholder="مشکی تیتانیوم"
                  className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-sm focus:outline-none focus:border-[#2563eb]"
                />
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-[#c3c6d7]/40 flex flex-wrap gap-6">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-[#0b1c30] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.stockCount > 0 ? form.inStock : false}
                  disabled={form.stockCount === 0}
                  onChange={(e) => setForm((p) => ({ ...p, inStock: e.target.checked }))}
                  className="h-4 w-4 rounded border-[#c3c6d7]"
                />
                <span>موجود برای فروش در فروشگاه</span>
              </label>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-[#0b1c30] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.expressDelivery}
                  onChange={(e) => setForm((p) => ({ ...p, expressDelivery: e.target.checked }))}
                  className="h-4 w-4 rounded border-[#c3c6d7]"
                />
                <span>امکان ارسال اکسپرس (پیک سریع)</span>
              </label>
            </div>
          </Card>

          {/* Section 3: Variants (Colors & Storage Options) */}
          <Card padding="lg">
            <div className="mb-4 pb-3 border-b border-[#c3c6d7]/40">
              <h2 className="text-sm font-bold text-[#0b1c30]">۳. تنوع رنگ‌بندی و ظرفیت‌ها</h2>
              <p className="mt-0.5 text-xs text-[#434655]">
                گزینه‌های انتخابی خریدار در صفحه محصول (رنگ، کد رنگ، ظرفیت و اختلاف قیمت)
              </p>
            </div>

            <div className="space-y-6">
              {/* Colors */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-[#0b1c30]">
                    رنگ‌های قابل سفارش ({toPersianDigits(safeColors.length)})
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addColor}
                    icon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
                  >
                    افزودن رنگ
                  </Button>
                </div>

                <div className="space-y-2.5">
                  {safeColors.map((c, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 items-center gap-2.5 p-2.5 rounded-xl bg-[#f8f9ff] border border-[#c3c6d7]/50"
                    >
                      <div className="col-span-2 sm:col-span-1 flex items-center justify-center">
                        <input
                          type="color"
                          aria-label={`انتخابگر رنگ ${idx + 1}`}
                          value={c.hex || '#1e293b'}
                          onChange={(e) => updateColor(idx, { hex: e.target.value })}
                          className="h-9 w-9 rounded-lg border border-[#c3c6d7] p-0.5 cursor-pointer bg-white"
                        />
                      </div>
                      <div className="col-span-10 sm:col-span-4">
                        <input
                          type="text"
                          placeholder="نام فارسی رنگ (مثال: تیتانیوم صحرایی)"
                          value={c.name}
                          onChange={(e) => updateColor(idx, { name: e.target.value })}
                          className="w-full h-9 px-3 rounded-lg border border-[#c3c6d7] bg-white text-xs"
                        />
                      </div>
                      <div className="col-span-6 sm:col-span-3">
                        <input
                          type="text"
                          dir="ltr"
                          placeholder="شناسه رنگ (desert)"
                          value={c.id}
                          onChange={(e) => updateColor(idx, { id: slugifyProductId(e.target.value) })}
                          className="w-full h-9 px-3 rounded-lg border border-[#c3c6d7] bg-white text-xs"
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-3">
                        <input
                          type="text"
                          dir="ltr"
                          placeholder="#1e293b"
                          value={c.hex}
                          onChange={(e) => updateColor(idx, { hex: e.target.value })}
                          className="w-full h-9 px-3 rounded-lg border border-[#c3c6d7] bg-white text-xs tabular-nums-fa"
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-1 flex justify-end">
                        {safeColors.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeColor(idx)}
                            aria-label="حذف رنگ"
                            className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-[#ba1a1a] hover:bg-[#ffdad6]/70"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Storage Options */}
              <div className="pt-4 border-t border-[#c3c6d7]/40 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold text-[#0b1c30]">
                    نسخه‌ها و ظرفیت‌های حافظه ({toPersianDigits(safeStorageOptions.length)})
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addStorageOption}
                    icon={<Plus className="h-3.5 w-3.5" aria-hidden="true" />}
                  >
                    افزودن نسخه
                  </Button>
                </div>

                <div className="space-y-2.5">
                  {safeStorageOptions.map((opt, idx) => {
                    const variantFinalPrice = Math.max(0, (form.price || 0) + (Number(opt.priceDelta) || 0));
                    return (
                      <div
                        key={idx}
                        className="grid grid-cols-12 items-center gap-2.5 p-2.5 rounded-xl bg-[#f8f9ff] border border-[#c3c6d7]/50"
                      >
                        <div className="col-span-12 sm:col-span-3">
                          <input
                            type="text"
                            placeholder="برچسب (۲۵۶ گیگابایت)"
                            value={opt.label}
                            onChange={(e) => updateStorageOption(idx, { label: e.target.value })}
                            className="w-full h-9 px-3 rounded-lg border border-[#c3c6d7] bg-white text-xs"
                          />
                        </div>
                        <div className="col-span-12 sm:col-span-3">
                          <input
                            type="text"
                            placeholder="توضیح نسخه (پک ZAA)"
                            value={opt.subtitle}
                            onChange={(e) => updateStorageOption(idx, { subtitle: e.target.value })}
                            className="w-full h-9 px-3 rounded-lg border border-[#c3c6d7] bg-white text-xs"
                          />
                        </div>
                        <div className="col-span-12 sm:col-span-3">
                          <input
                            type="number"
                            dir="ltr"
                            placeholder="اختلاف قیمت (تومان)"
                            value={opt.priceDelta}
                            onChange={(e) =>
                              updateStorageOption(idx, { priceDelta: Number(e.target.value) || 0 })
                            }
                            className="w-full h-9 px-3 rounded-lg border border-[#c3c6d7] bg-white text-xs tabular-nums-fa"
                          />
                        </div>
                        <div className="col-span-10 sm:col-span-2 text-left text-[11px] font-medium text-[#004ac6] tabular-nums-fa whitespace-nowrap">
                          {form.price > 0 ? formatToman(variantFinalPrice, false) : '—'}
                        </div>
                        <div className="col-span-2 sm:col-span-1 flex justify-end">
                          {safeStorageOptions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeStorageOption(idx)}
                              aria-label="حذف نسخه"
                              className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-[#ba1a1a] hover:bg-[#ffdad6]/70"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>

          {/* Section 4: Complete Technical Specifications */}
          <Card padding="lg">
            <div className="mb-4 pb-3 border-b border-[#c3c6d7]/40">
              <h2 className="text-sm font-bold text-[#0b1c30]">۴. مشخصات فنی کامل (specs JSONB)</h2>
              <p className="mt-0.5 text-xs text-[#434655]">
                تمامی ۱۱ فیلد مشخصات فنی جهت نمایش در جدول مقایسه و صفحه جزئیات محصول
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="sp-display" className="block text-xs font-medium text-[#0b1c30] mb-1">
                  نمایشگر (خلاصه)
                </label>
                <input
                  id="sp-display"
                  type="text"
                  value={form.specs.display}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, specs: { ...p.specs, display: e.target.value } }))
                  }
                  placeholder="۶.۹ اینچ LTPO Super Retina XDR"
                  className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-xs"
                />
              </div>
              <div>
                <label htmlFor="sp-display-det" className="block text-xs font-medium text-[#0b1c30] mb-1">
                  جزئیات نمایشگر
                </label>
                <input
                  id="sp-display-det"
                  type="text"
                  value={form.specs.displayDetails}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, specs: { ...p.specs, displayDetails: e.target.value } }))
                  }
                  placeholder="نرخ نوسازی ۱۲۰ هرتز · روشنایی ۲۰۰۰ نیت"
                  className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-xs"
                />
              </div>

              <div>
                <label htmlFor="sp-chipset" className="block text-xs font-medium text-[#0b1c30] mb-1">
                  تراشه / پردازنده
                </label>
                <input
                  id="sp-chipset"
                  type="text"
                  value={form.specs.chipset}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, specs: { ...p.specs, chipset: e.target.value } }))
                  }
                  placeholder="Apple A18 Pro (۳ نانومتری)"
                  className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-xs"
                />
              </div>
              <div>
                <label htmlFor="sp-chipset-det" className="block text-xs font-medium text-[#0b1c30] mb-1">
                  جزئیات پردازنده
                </label>
                <input
                  id="sp-chipset-det"
                  type="text"
                  value={form.specs.chipsetDetails}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, specs: { ...p.specs, chipsetDetails: e.target.value } }))
                  }
                  placeholder="۶ هسته CPU + ۶ هسته GPU + موتور عصبی ۱۶ هسته‌ای"
                  className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-xs"
                />
              </div>

              <div>
                <label htmlFor="sp-camera" className="block text-xs font-medium text-[#0b1c30] mb-1">
                  دوربین اصلی
                </label>
                <input
                  id="sp-camera"
                  type="text"
                  value={form.specs.camera}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, specs: { ...p.specs, camera: e.target.value } }))
                  }
                  placeholder="۴۸ + ۴۸ + ۱۲ مگاپیکسل"
                  className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-xs"
                />
              </div>
              <div>
                <label htmlFor="sp-camera-det" className="block text-xs font-medium text-[#0b1c30] mb-1">
                  جزئیات دوربین
                </label>
                <input
                  id="sp-camera-det"
                  type="text"
                  value={form.specs.cameraDetails}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, specs: { ...p.specs, cameraDetails: e.target.value } }))
                  }
                  placeholder="زوم اپتیکال ۵x · فیلم‌برداری 4K Dolby Vision 120fps"
                  className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-xs"
                />
              </div>

              <div>
                <label htmlFor="sp-battery" className="block text-xs font-medium text-[#0b1c30] mb-1">
                  ظرفیت باتری
                </label>
                <input
                  id="sp-battery"
                  type="text"
                  value={form.specs.battery}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, specs: { ...p.specs, battery: e.target.value } }))
                  }
                  placeholder="۴۶۸۵ میلی‌آمپرساعت"
                  className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-xs"
                />
              </div>
              <div>
                <label htmlFor="sp-battery-det" className="block text-xs font-medium text-[#0b1c30] mb-1">
                  جزئیات باتری و شارژ
                </label>
                <input
                  id="sp-battery-det"
                  type="text"
                  value={form.specs.batteryDetails}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, specs: { ...p.specs, batteryDetails: e.target.value } }))
                  }
                  placeholder="شارژ سریع ۴۵ وات · شارژ بی‌سیم MagSafe 25W"
                  className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-xs"
                />
              </div>

              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label htmlFor="sp-storage" className="block text-xs font-medium text-[#0b1c30] mb-1">
                    حافظه پیش‌فرض
                  </label>
                  <input
                    id="sp-storage"
                    type="text"
                    value={form.specs.storageDefault}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, specs: { ...p.specs, storageDefault: e.target.value } }))
                    }
                    placeholder="۲۵۶ گیگابایت"
                    className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="sp-ram" className="block text-xs font-medium text-[#0b1c30] mb-1">
                    حافظه رم (RAM)
                  </label>
                  <input
                    id="sp-ram"
                    type="text"
                    value={form.specs.ram}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, specs: { ...p.specs, ram: e.target.value } }))
                    }
                    placeholder="۸ گیگابایت"
                    className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="sp-os" className="block text-xs font-medium text-[#0b1c30] mb-1">
                    سیستم‌عامل
                  </label>
                  <input
                    id="sp-os"
                    type="text"
                    value={form.specs.os}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, specs: { ...p.specs, os: e.target.value } }))
                    }
                    placeholder="iOS 18"
                    className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-xs"
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar Column: Image Preview & Merchandising */}
        <div className="xl:col-span-4 space-y-6 xl:sticky xl:top-24">
          <Card padding="lg">
            <div className="mb-4 pb-3 border-b border-[#c3c6d7]/40 flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-[#004ac6]" aria-hidden="true" />
              <h2 className="text-sm font-bold text-[#0b1c30]">تصویر و پیش‌نمایش کارت</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="pe-image" className="block text-xs font-medium text-[#0b1c30] mb-1">
                  نشانی تصویر محصول (URL)
                </label>
                <input
                  id="pe-image"
                  type="url"
                  dir="ltr"
                  value={form.image}
                  onChange={(e) => setForm((p) => ({ ...p, image: e.target.value }))}
                  placeholder="https://..."
                  className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-xs focus:outline-none focus:border-[#2563eb]"
                />
              </div>

              {/* Clean Live Product Card Preview */}
              <div className="p-4 rounded-xl bg-[#f8f9ff] border border-[#c3c6d7]/60 space-y-3">
                <div className="aspect-[4/3] w-full rounded-xl bg-white border border-[#c3c6d7]/40 flex items-center justify-center overflow-hidden p-3">
                  {form.image.trim() && !imageFailed ? (
                    <img
                      src={form.image.trim()}
                      alt={form.nameFa || 'پیش‌نمایش تصویر محصول'}
                      referrerPolicy="no-referrer"
                      onError={() => setImageFailed(true)}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-[#737686] text-center">
                      <Smartphone className="h-8 w-8" aria-hidden="true" />
                      <span className="text-[11px]">
                        {form.image.trim() ? 'تصویر قابل بارگذاری نیست' : 'پیش‌نمایش تصویر کالا'}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] text-[#434655]">
                    <span>{form.brand}</span>
                    <span aria-hidden="true">·</span>
                    <span>{CATEGORY_LABELS[form.category] || form.category}</span>
                    {form.badgeText && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#004ac6] font-medium">{form.badgeText}</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs font-bold text-[#0b1c30] line-clamp-2">
                    {form.nameFa || 'عنوان فارسی محصول'}
                  </p>
                  <div className="flex items-baseline justify-between gap-2 pt-1 tabular-nums-fa">
                    <span className="text-sm font-bold text-[#004ac6]">
                      {form.price > 0 ? formatToman(form.price) : '۰ تومان'}
                    </span>
                    {form.originalPrice && form.originalPrice > form.price && (
                      <span className="text-[11px] text-[#737686] line-through">
                        {formatToman(form.originalPrice, false)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card padding="lg">
            <div className="mb-4 pb-3 border-b border-[#c3c6d7]/40">
              <h2 className="text-sm font-bold text-[#0b1c30]">نمایش در فروشگاه و رتبه‌بندی</h2>
            </div>

            <div className="space-y-4">
              <div className="space-y-2.5">
                <label className="flex items-center gap-2.5 text-xs font-medium text-[#0b1c30] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isFeaturedDeal}
                    onChange={(e) => setForm((p) => ({ ...p, isFeaturedDeal: e.target.checked }))}
                    className="h-4 w-4 rounded border-[#c3c6d7]"
                  />
                  <span>نمایش در پیشنهادهای ویژه صفحه اصلی</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs font-medium text-[#0b1c30] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isPopular}
                    onChange={(e) => setForm((p) => ({ ...p, isPopular: e.target.checked }))}
                    className="h-4 w-4 rounded border-[#c3c6d7]"
                  />
                  <span>نمایش در بخش محبوب‌ترین محصولات</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#c3c6d7]/40">
                <div>
                  <label htmlFor="pe-sales-rank" className="block text-xs font-medium text-[#0b1c30] mb-1">
                    رتبه پرفروش (salesRank)
                  </label>
                  <input
                    id="pe-sales-rank"
                    type="number"
                    min={1}
                    dir="ltr"
                    value={form.salesRank ?? 100}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        salesRank: Math.max(1, Number(toEnglishDigits(e.target.value)) || 100),
                      }))
                    }
                    className="w-full h-9 px-3 rounded-xl border border-[#c3c6d7] text-xs tabular-nums-fa"
                  />
                </div>
                <div>
                  <label htmlFor="pe-release-order" className="block text-xs font-medium text-[#0b1c30] mb-1">
                    ترتیب انتشار (releaseOrder)
                  </label>
                  <input
                    id="pe-release-order"
                    type="number"
                    min={1}
                    dir="ltr"
                    value={form.releaseOrder ?? 100}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        releaseOrder: Math.max(1, Number(toEnglishDigits(e.target.value)) || 100),
                      }))
                    }
                    className="w-full h-9 px-3 rounded-xl border border-[#c3c6d7] text-xs tabular-nums-fa"
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </form>
  );
}
