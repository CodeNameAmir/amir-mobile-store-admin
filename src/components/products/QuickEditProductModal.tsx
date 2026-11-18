import { useEffect, useState, type FormEvent } from 'react';
import { ExternalLink, Zap } from 'lucide-react';
import type { Product, ProductInput } from '../../types/admin';
import {
  computeDiscountPercent,
  formatToman,
  toEnglishDigits,
  toPersianDigits,
} from '../../utils/formatters';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface QuickEditProductModalProps {
  product: Product | null;
  onClose: () => void;
  onSave: (id: string, patch: Partial<ProductInput>) => Promise<void>;
  onOpenFullEdit: (product: Product) => void;
}

export function QuickEditProductModal({
  product,
  onClose,
  onSave,
  onOpenFullEdit,
}: QuickEditProductModalProps) {
  const [nameFa, setNameFa] = useState('');
  const [price, setPrice] = useState(0);
  const [originalPrice, setOriginalPrice] = useState<number | null>(null);
  const [stockCount, setStockCount] = useState(0);
  const [inStock, setInStock] = useState(true);
  const [expressDelivery, setExpressDelivery] = useState(true);
  const [badgeText, setBadgeText] = useState('');
  const [isFeaturedDeal, setIsFeaturedDeal] = useState(false);
  const [isPopular, setIsPopular] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!product) return;
    setNameFa(product.nameFa || '');
    setPrice(product.price || 0);
    setOriginalPrice(product.originalPrice ?? null);
    setStockCount(product.stockCount ?? 0);
    setInStock(Boolean(product.inStock));
    setExpressDelivery(Boolean(product.expressDelivery));
    setBadgeText(product.badgeText || '');
    setIsFeaturedDeal(Boolean(product.isFeaturedDeal));
    setIsPopular(Boolean(product.isPopular));
    setError(null);
  }, [product]);

  const discountPercent = computeDiscountPercent(price, originalPrice);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!product) return;

    const cleanName = nameFa.trim();
    if (cleanName.length < 3) {
      setError('نام فارسی محصول باید حداقل ۳ کاراکتر باشد.');
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setError('قیمت فروش باید بزرگ‌تر از صفر باشد.');
      return;
    }
    if (originalPrice !== null && originalPrice > 0 && originalPrice < price) {
      setError('قیمت قبل از تخفیف نمی‌تواند کمتر از قیمت فروش باشد.');
      return;
    }
    if (!Number.isInteger(stockCount) || stockCount < 0) {
      setError('تعداد موجودی انبار باید عدد صحیح غیرمنفی باشد.');
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const effectiveInStock = stockCount === 0 ? false : inStock;
      await onSave(product.id, {
        nameFa: cleanName,
        price,
        originalPrice,
        discountPercent,
        stockCount,
        inStock: effectiveInStock,
        expressDelivery,
        badgeText: badgeText.trim() || null,
        isFeaturedDeal,
        isPopular,
      });
      onClose();
    } catch {
      // Toast already handles API error message; keep modal open for correction
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={Boolean(product)}
      onClose={onClose}
      title="ویرایش سریع محصول"
      subtitle={product ? `${product.brand} · ${product.nameEn}` : ''}
      maxWidthClass="max-w-lg"
      footer={
        product && (
          <div className="w-full flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={submitting}
              onClick={() => {
                onClose();
                onOpenFullEdit(product);
              }}
              icon={<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              صفحه ویرایش کامل
            </Button>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onClose} disabled={submitting}>
                انصراف
              </Button>
              <Button
                type="submit"
                form="quick-edit-product-form"
                variant="primary"
                loading={submitting}
                icon={<Zap className="h-3.5 w-3.5" aria-hidden="true" />}
              >
                ذخیره سریع
              </Button>
            </div>
          </div>
        )
      }
    >
      <form id="quick-edit-product-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p role="alert" className="p-3 rounded-xl bg-[#ffdad6] text-xs font-medium text-[#ba1a1a]">
            {error}
          </p>
        )}

        <div>
          <label htmlFor="qe-name-fa" className="block text-xs font-medium text-[#0b1c30] mb-1">
            نام فارسی محصول *
          </label>
          <input
            id="qe-name-fa"
            type="text"
            value={nameFa}
            onChange={(e) => setNameFa(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-sm focus:outline-none focus:border-[#2563eb]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label htmlFor="qe-price" className="block text-xs font-medium text-[#0b1c30] mb-1">
              قیمت فروش (تومان) *
            </label>
            <input
              id="qe-price"
              type="number"
              min={0}
              dir="ltr"
              value={price || ''}
              onChange={(e) => setPrice(Number(toEnglishDigits(e.target.value)) || 0)}
              className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-sm font-semibold tabular-nums-fa focus:outline-none focus:border-[#2563eb]"
            />
            <p className="mt-1 text-[11px] text-[#434655] tabular-nums-fa">
              {price > 0 ? formatToman(price) : '—'}
            </p>
          </div>

          <div>
            <label htmlFor="qe-orig-price" className="block text-xs font-medium text-[#0b1c30] mb-1">
              قیمت قبل از تخفیف (تومان)
            </label>
            <input
              id="qe-orig-price"
              type="number"
              min={0}
              dir="ltr"
              value={originalPrice ?? ''}
              onChange={(e) => {
                const raw = toEnglishDigits(e.target.value).trim();
                setOriginalPrice(raw ? Number(raw) : null);
              }}
              placeholder="اختیاری"
              className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-sm tabular-nums-fa focus:outline-none focus:border-[#2563eb]"
            />
            <p className="mt-1 text-[11px] text-[#004ac6] tabular-nums-fa">
              {discountPercent > 0 ? `${toPersianDigits(discountPercent)}٪ تخفیف محاسبه‌شده` : 'بدون تخفیف'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label htmlFor="qe-stock" className="block text-xs font-medium text-[#0b1c30] mb-1">
              تعداد موجودی انبار *
            </label>
            <input
              id="qe-stock"
              type="number"
              min={0}
              dir="ltr"
              value={stockCount}
              onChange={(e) => {
                const next = Math.max(0, Math.floor(Number(toEnglishDigits(e.target.value)) || 0));
                setStockCount(next);
                setInStock(next > 0);
              }}
              className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-sm font-bold tabular-nums-fa focus:outline-none focus:border-[#2563eb]"
            />
          </div>

          <div>
            <label htmlFor="qe-badge" className="block text-xs font-medium text-[#0b1c30] mb-1">
              برچسب نمایشی
            </label>
            <input
              id="qe-badge"
              type="text"
              value={badgeText}
              onChange={(e) => setBadgeText(e.target.value)}
              placeholder="مثال: ۴٪ تخفیف یا پرفروش"
              className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-sm focus:outline-none focus:border-[#2563eb]"
            />
          </div>
        </div>

        <div className="pt-2 border-t border-[#c3c6d7]/50 grid grid-cols-2 gap-3">
          <label className="inline-flex items-center gap-2 text-xs font-medium text-[#0b1c30] cursor-pointer">
            <input
              type="checkbox"
              checked={stockCount > 0 ? inStock : false}
              disabled={stockCount === 0}
              onChange={(e) => setInStock(e.target.checked)}
              className="h-4 w-4 rounded border-[#c3c6d7]"
            />
            <span>موجود برای فروش</span>
          </label>

          <label className="inline-flex items-center gap-2 text-xs font-medium text-[#0b1c30] cursor-pointer">
            <input
              type="checkbox"
              checked={expressDelivery}
              onChange={(e) => setExpressDelivery(e.target.checked)}
              className="h-4 w-4 rounded border-[#c3c6d7]"
            />
            <span>ارسال اکسپرس</span>
          </label>

          <label className="inline-flex items-center gap-2 text-xs font-medium text-[#0b1c30] cursor-pointer">
            <input
              type="checkbox"
              checked={isFeaturedDeal}
              onChange={(e) => setIsFeaturedDeal(e.target.checked)}
              className="h-4 w-4 rounded border-[#c3c6d7]"
            />
            <span>پیشنهاد ویژه</span>
          </label>

          <label className="inline-flex items-center gap-2 text-xs font-medium text-[#0b1c30] cursor-pointer">
            <input
              type="checkbox"
              checked={isPopular}
              onChange={(e) => setIsPopular(e.target.checked)}
              className="h-4 w-4 rounded border-[#c3c6d7]"
            />
            <span>محبوب‌ترین‌ها</span>
          </label>
        </div>
      </form>
    </Modal>
  );
}
