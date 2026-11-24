import { Edit3, Star, Zap } from 'lucide-react';
import type { Product } from '../../types/admin';
import {
  CATEGORY_LABELS,
  formatPersianDateTime,
  formatToman,
  toPersianDigits,
} from '../../utils/formatters';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { StatusTag, StockStatusTag } from '../ui/StatusBadge';
import { ProductThumb } from '../ui/ProductThumb';

interface ProductDetailDrawerProps {
  product: Product | null;
  lowStockThreshold: number;
  onClose: () => void;
  onQuickEdit?: (product: Product) => void;
  onEdit: (product: Product) => void;
}

export function ProductDetailDrawer({
  product,
  lowStockThreshold,
  onClose,
  onQuickEdit,
  onEdit,
}: ProductDetailDrawerProps) {
  const safeSpecs = product?.specs ?? {
    display: '',
    displayDetails: '',
    chipset: '',
    chipsetDetails: '',
    camera: '',
    cameraDetails: '',
    battery: '',
    batteryDetails: '',
    storageDefault: '',
    ram: '',
    os: '',
  };
  const safeStorageOptions = Array.isArray(product?.storageOptions)
    ? product.storageOptions
    : [];
  const safeColors = Array.isArray(product?.colors) ? product.colors : [];
  const safeCustomSpecs = Array.isArray(product?.customSpecs) ? product.customSpecs : [];
  const categoryLabel = product
    ? CATEGORY_LABELS[product.category] || product.category || '—'
    : '';

  return (
    <Drawer
      open={Boolean(product)}
      onClose={onClose}
      title={product?.nameFa || ''}
      subtitle={product ? `${product.brand || '—'} · ${categoryLabel}` : ''}
      footer={
        product && (
          <>
            <Button variant="outline" onClick={onClose}>
              بستن
            </Button>
            {onQuickEdit && (
              <Button
                variant="secondary"
                onClick={() => {
                  onClose();
                  onQuickEdit(product);
                }}
                icon={<Zap className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
              >
                ویرایش سریع
              </Button>
            )}
            <Button
              variant="primary"
              onClick={() => {
                onClose();
                onEdit(product);
              }}
              icon={<Edit3 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
            >
              ویرایش کامل
            </Button>
          </>
        )
      }
    >
      {product && (
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <ProductThumb src={product.image} alt={product.nameFa} sizeClass="h-20 w-20" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-xs font-mono text-[#52565e]" dir="ltr">
                {product.nameEn}
              </p>
              {product.modelName && (
                <p className="text-[11px] text-[#52565e]">
                  مدل: <span className="font-mono font-medium text-[#111315]" dir="ltr">{product.modelName}</span>
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <StockStatusTag
                  inStock={product.inStock}
                  stockCount={product.stockCount}
                  lowThreshold={lowStockThreshold}
                />
                <StatusTag tone={product.isPublished ? 'success' : 'neutral'}>
                  {product.isPublished ? 'منتشرشده' : 'پیش‌نویس'}
                </StatusTag>
                {product.isFeatured && <StatusTag tone="info">برگزیده</StatusTag>}
                <span className="text-xs text-[#52565e] tabular-nums-fa">
                  موجودی: {toPersianDigits(product.stockCount)} عدد
                </span>
              </div>
              <p className="text-[11px] font-mono text-[#7c818c]" dir="ltr">
                ID: {product.id} · Slug: {product.slug}
              </p>
            </div>
          </div>

          {Array.isArray(product.images) && product.images.length > 1 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-[#111315]">
                گالری تصاویر ({toPersianDigits(product.images.length)} تصویر)
              </h3>
              <div className="flex flex-wrap gap-2">
                {product.images.map((imgUrl, idx) => (
                  <ProductThumb
                    key={`${imgUrl}-${idx}`}
                    src={imgUrl}
                    alt={`${product.nameFa} - ${idx + 1}`}
                    sizeClass="h-14 w-14"
                  />
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-[#f6f6f7] border border-black/[0.08]">
            <div>
              <p className="text-xs text-[#52565e]">قیمت فروش فعلی</p>
              <p className="mt-1 text-base font-semibold text-[#0f49bd] tabular-nums-fa">
                {formatToman(product.price)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#52565e]">قیمت قبل از تخفیف</p>
              <p className="mt-1 text-sm font-medium text-[#111315] tabular-nums-fa">
                {product.originalPrice ? formatToman(product.originalPrice) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#52565e]">گارانتی</p>
              <p className="mt-1 text-xs font-medium text-[#111315]">{product.warranty || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-[#52565e]">ارسال اکسپرس</p>
              <p className="mt-1 text-xs font-medium text-[#111315]">
                {product.expressDelivery ? 'فعال' : 'غیرفعال'}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#52565e]">امتیاز و رضایت خریداران</p>
              <p className="mt-1 text-xs font-medium text-[#111315] inline-flex items-center gap-1.5 tabular-nums-fa">
                <Star className="h-3.5 w-3.5 text-[#9a4a06]" strokeWidth={1.5} aria-hidden="true" />
                <span>
                  {toPersianDigits(product.rating)} از ۵ ({toPersianDigits(product.reviewCount)} دیدگاه ·{' '}
                  {toPersianDigits(product.recommendPercent)}٪ پیشنهاد)
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs text-[#52565e]">آخرین بروزرسانی قیمت</p>
              <p className="mt-1 text-xs font-medium text-[#111315] tabular-nums-fa">
                {product.priceUpdatedAt ? formatPersianDateTime(product.priceUpdatedAt) : '—'}
              </p>
            </div>
          </div>

          {product.descriptionFa && (
            <div className="space-y-1.5">
              <h3 className="text-xs font-semibold text-[#111315]">توضیحات معرفی محصول</h3>
              <p className="p-3.5 rounded-xl bg-[#f6f6f7] border border-black/[0.08] text-xs leading-6 text-[#111315] whitespace-pre-line">
                {product.descriptionFa}
              </p>
            </div>
          )}

          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-[#111315]">مشخصات فنی ثبت‌شده</h3>
            <dl className="divide-y divide-black/[0.06] rounded-xl border border-black/[0.08] text-xs">
              {[
                ['نمایشگر', safeSpecs.display],
                ['پردازنده', safeSpecs.chipset],
                ['دوربین', safeSpecs.camera],
                ['باتری', safeSpecs.battery],
                ['حافظه پیش‌فرض', safeSpecs.storageDefault],
                ['سیستم‌عامل', safeSpecs.os],
              ].map(([label, val]) => (
                <div key={label} className="flex items-center justify-between gap-4 px-4 py-2.5">
                  <dt className="text-[#52565e]">{label}</dt>
                  <dd className="font-medium text-[#111315] text-left">{val || '—'}</dd>
                </div>
              ))}
              {safeCustomSpecs.map((item, idx) => (
                <div
                  key={`${item.label}-${idx}`}
                  className="flex items-center justify-between gap-4 px-4 py-2.5 bg-[#f6f6f7]/50"
                >
                  <dt className="text-[#52565e]">{item.label}</dt>
                  <dd className="font-medium text-[#111315] text-left">{item.value || '—'}</dd>
                </div>
              ))}
            </dl>
          </div>

          {safeStorageOptions.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-[#111315]">ظرفیت‌ها و اختلاف قیمت</h3>
              <div className="divide-y divide-black/[0.06] rounded-xl border border-black/[0.08] text-xs">
                {safeStorageOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center justify-between px-4 py-2.5">
                    <span className="font-medium text-[#111315]">{opt.label}</span>
                    <span className="text-[#52565e] tabular-nums-fa">
                      {opt.priceDelta === 0
                        ? 'قیمت پایه'
                        : `${opt.priceDelta > 0 ? '+' : ''}${formatToman(opt.priceDelta)}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {safeColors.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-[#111315]">رنگ‌های فعال</h3>
              <div className="flex flex-wrap gap-2">
                {safeColors.map((c) => (
                  <div
                    key={c.id}
                    className="inline-flex items-center gap-2 text-xs text-[#111315] px-2.5 py-1.5 rounded-lg bg-[#f6f6f7] border border-black/[0.08]"
                  >
                    <span
                      className="h-3 w-3 rounded-full border border-black/20"
                      style={{ backgroundColor: c.hex }}
                      aria-hidden="true"
                    />
                    <span>{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
