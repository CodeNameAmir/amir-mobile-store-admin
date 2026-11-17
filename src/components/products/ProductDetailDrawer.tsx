import { Edit3 } from 'lucide-react';
import type { Product } from '../../types/admin';
import {
  CATEGORY_LABELS,
  formatToman,
  toPersianDigits,
} from '../../utils/formatters';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { StockStatusTag } from '../ui/StatusBadge';
import { ProductThumb } from '../ui/ProductThumb';

interface ProductDetailDrawerProps {
  product: Product | null;
  lowStockThreshold: number;
  onClose: () => void;
  onEdit: (product: Product) => void;
}

export function ProductDetailDrawer({
  product,
  lowStockThreshold,
  onClose,
  onEdit,
}: ProductDetailDrawerProps) {
  return (
    <Drawer
      open={Boolean(product)}
      onClose={onClose}
      title={product?.nameFa || ''}
      subtitle={product ? `${product.brand} · ${CATEGORY_LABELS[product.category]}` : ''}
      footer={
        product && (
          <>
            <Button variant="outline" onClick={onClose}>
              بستن
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                onClose();
                onEdit(product);
              }}
              icon={<Edit3 className="h-4 w-4" aria-hidden="true" />}
            >
              ویرایش محصول
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
              <p className="text-xs text-[#434655]" dir="ltr">
                {product.nameEn}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <StockStatusTag
                  inStock={product.inStock}
                  stockCount={product.stockCount}
                  lowThreshold={lowStockThreshold}
                />
                <span className="text-xs text-[#434655] tabular-nums-fa">
                  موجودی: {toPersianDigits(product.stockCount)} عدد
                </span>
              </div>
              <p className="text-[11px] text-[#737686]" dir="ltr">
                ID: {product.id} · Slug: {product.slug}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-[#f8f9ff] border border-[#c3c6d7]/50">
            <div>
              <p className="text-xs text-[#434655]">قیمت فروش فعلی</p>
              <p className="mt-1 text-base font-bold text-[#004ac6] tabular-nums-fa">
                {formatToman(product.price)}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#434655]">قیمت قبل از تخفیف</p>
              <p className="mt-1 text-sm font-semibold text-[#0b1c30] tabular-nums-fa">
                {product.originalPrice ? formatToman(product.originalPrice) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#434655]">گارانتی</p>
              <p className="mt-1 text-xs font-medium text-[#0b1c30]">{product.warranty}</p>
            </div>
            <div>
              <p className="text-xs text-[#434655]">ارسال اکسپرس</p>
              <p className="mt-1 text-xs font-medium text-[#0b1c30]">
                {product.expressDelivery ? 'فعال' : 'غیرفعال'}
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-[#0b1c30]">مشخصات فنی ثبت‌شده</h3>
            <dl className="divide-y divide-[#c3c6d7]/40 rounded-2xl border border-[#c3c6d7]/60 text-xs">
              {[
                ['نمایشگر', product.specs.display],
                ['پردازنده', product.specs.chipset],
                ['دوربین', product.specs.camera],
                ['باتری', product.specs.battery],
                ['حافظه پیش‌فرض', product.specs.storageDefault],
                ['سیستم‌عامل', product.specs.os],
              ].map(([label, val]) => (
                <div key={label} className="flex items-center justify-between gap-4 px-4 py-2.5">
                  <dt className="text-[#434655]">{label}</dt>
                  <dd className="font-medium text-[#0b1c30] text-left">{val || '—'}</dd>
                </div>
              ))}
            </dl>
          </div>

          {product.storageOptions.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-[#0b1c30]">ظرفیت‌ها و اختلاف قیمت</h3>
              <div className="divide-y divide-[#c3c6d7]/40 rounded-2xl border border-[#c3c6d7]/60 text-xs">
                {product.storageOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center justify-between px-4 py-2.5">
                    <span className="font-medium text-[#0b1c30]">{opt.label}</span>
                    <span className="text-[#434655] tabular-nums-fa">
                      {opt.priceDelta === 0
                        ? 'قیمت پایه'
                        : `${opt.priceDelta > 0 ? '+' : ''}${formatToman(opt.priceDelta)}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {product.colors.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-[#0b1c30]">رنگ‌های فعال</h3>
              <div className="flex flex-wrap gap-3">
                {product.colors.map((c) => (
                  <div
                    key={c.id}
                    className="inline-flex items-center gap-2 text-xs text-[#0b1c30] px-3 py-1.5 rounded-xl bg-[#f8f9ff] border border-[#c3c6d7]/60"
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-[#0b1c30]/20"
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
