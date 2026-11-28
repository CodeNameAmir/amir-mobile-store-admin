import { useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type {
  Product,
  ProductVariant,
  StockMovementInput,
  StockMovementType,
  Warehouse,
} from '../../types/admin';
import { adminApi } from '../../services/adminApi';
import { ApiError } from '../../services/apiClient';
import { useToast } from '../../context/ToastContext';
import {
  generateIdempotencyKey,
  MOVEMENT_TYPE_LABELS,
  toEnglishDigits,
  toPersianDigits,
  validateStockMovementInput,
} from '../../utils/formatters';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface StockMovementModalProps {
  open: boolean;
  onClose: () => void;
  warehouses: Warehouse[];
  initialWarehouseId?: string;
  initialVariantId?: string;
  initialProductId?: string;
  initialSku?: string;
  onSuccess: () => void;
}

const MOVEMENT_TYPES: StockMovementType[] = [
  'opening_balance',
  'purchase_inflow',
  'order_sale',
  'customer_return',
  'transfer_out',
  'transfer_in',
  'inventory_adjustment',
];

export function StockMovementModal({
  open,
  onClose,
  warehouses,
  initialWarehouseId,
  initialVariantId,
  initialProductId,
  initialSku,
  onSuccess,
}: StockMovementModalProps) {
  const { pushToast } = useToast();

  const [productSearch, setProductSearch] = useState('');
  const [debouncedProductSearch, setDebouncedProductSearch] = useState('');
  const [productPage, setProductPage] = useState(1);
  const [productTotalPages, setProductTotalPages] = useState(1);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);

  const [warehouseId, setWarehouseId] = useState('');
  const [variantId, setVariantId] = useState('');
  const [movementType, setMovementType] = useState<StockMovementType>('purchase_inflow');
  const [quantityChange, setQuantityChange] = useState<string>('1');
  const [shelfLocation, setShelfLocation] = useState('');
  const [minStockAlert, setMinStockAlert] = useState('');
  const [referenceType, setReferenceType] = useState('purchase_order');
  const [referenceId, setReferenceId] = useState('');
  const [noteFa, setNoteFa] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(() => generateIdempotencyKey());

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedProductSearch(productSearch);
      setProductPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [productSearch]);

  useEffect(() => {
    if (!open) return;
    setWarehouseId(initialWarehouseId || warehouses[0]?.id || '');
    setVariantId(initialVariantId || '');
    setSelectedProductId(initialProductId || '');
    setProductSearch('');
    setDebouncedProductSearch('');
    setProductPage(1);
    setMovementType('purchase_inflow');
    setQuantityChange('1');
    setShelfLocation('');
    setMinStockAlert('');
    setReferenceType('purchase_order');
    setReferenceId('');
    setNoteFa('');
    setIdempotencyKey(generateIdempotencyKey());
    setFormErrors({});
    setServerError(null);
  }, [open, initialWarehouseId, initialVariantId, initialProductId, warehouses]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoadingProducts(true);
    void adminApi
      .listProducts({
        search: debouncedProductSearch.trim() || undefined,
        page: productPage,
        pageSize: 20,
      })
      .then((res) => {
        if (!active) return;
        setProducts(Array.isArray(res.items) ? res.items : []);
        setProductTotalPages(Math.max(1, res.totalPages || 1));
      })
      .catch(() => {
        if (!active) return;
        setProducts([]);
      })
      .finally(() => {
        if (active) setLoadingProducts(false);
      });
    return () => {
      active = false;
    };
  }, [open, debouncedProductSearch, productPage]);

  useEffect(() => {
    if (!open || !selectedProductId) {
      setVariants([]);
      return;
    }
    setLoadingVariants(true);
    void adminApi
      .listProductVariants(selectedProductId)
      .then((res) => {
        const list = Array.isArray(res.variants) ? res.variants : [];
        setVariants(list);
        if (!initialVariantId && list.length > 0) {
          setVariantId((prev) => prev || list[0].id);
        }
      })
      .catch(() => setVariants([]))
      .finally(() => setLoadingVariants(false));
  }, [open, selectedProductId, initialVariantId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsedQty = Math.trunc(Number(toEnglishDigits(quantityChange)) || 0);
    const parsedMinAlert = toEnglishDigits(minStockAlert).trim();

    const payload: StockMovementInput = {
      warehouseId: warehouseId.trim(),
      variantId: variantId.trim(),
      movementType,
      quantityChange: parsedQty,
      shelfLocation: shelfLocation.trim() ? shelfLocation.trim() : null,
      minStockAlert: parsedMinAlert !== '' ? Math.max(0, Math.floor(Number(parsedMinAlert) || 0)) : null,
      referenceType: referenceType.trim() ? referenceType.trim() : null,
      referenceId: referenceId.trim() ? referenceId.trim() : null,
      noteFa: noteFa.trim() ? noteFa.trim() : null,
      idempotencyKey,
    };

    const validation = validateStockMovementInput(payload);
    if (Object.keys(validation).length > 0) {
      setFormErrors(validation);
      return;
    }

    setFormErrors({});
    setServerError(null);
    setSubmitting(true);
    try {
      await adminApi.createStockMovement(payload);
      pushToast({
        tone: 'success',
        title: 'تراکنش انبار با موفقیت ثبت شد',
        description: `${MOVEMENT_TYPE_LABELS[movementType]} (${parsedQty > 0 ? `+${parsedQty}` : parsedQty})`,
      });
      setIdempotencyKey(generateIdempotencyKey());
      onSuccess();
      onClose();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'خطا در ثبت تراکنش انبار. لطفاً دوباره تلاش کنید.';
      setServerError(message);
      if (err instanceof ApiError && (err.status === 409 || err.status === 400 || err.status === 422)) {
        setIdempotencyKey(generateIdempotencyKey());
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="ثبت تراکنش جدید انبار (ورود / خروج کالا)"
      subtitle={initialSku ? `تنوع انتخاب‌شده: ${initialSku}` : 'ثبت گردش موجودی در دفترکل انبارداری'}
      maxWidthClass="max-w-2xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            انصراف
          </Button>
          <Button type="submit" form="stock-movement-form" variant="primary" loading={submitting}>
            ثبت قطعی تراکنش
          </Button>
        </>
      }
    >
      <form id="stock-movement-form" onSubmit={handleSubmit} className="space-y-4">
        {serverError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3.5 rounded-lg bg-[#fef3f2] border border-[#fecaca] text-xs font-medium text-[#b42318]"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={1.5} aria-hidden="true" />
            <span>{serverError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="sm-warehouse" className="block text-xs font-medium text-[#111315] mb-1.5">
              انبار مقصد / مبدا *
            </label>
            <select
              id="sm-warehouse"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
            >
              <option value="">انتخاب انبار</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.nameFa} ({wh.code})
                </option>
              ))}
            </select>
            {formErrors.warehouseId && (
              <p className="mt-1 text-xs text-[#b42318]">{formErrors.warehouseId}</p>
            )}
          </div>

          <div>
            <label htmlFor="sm-type" className="block text-xs font-medium text-[#111315] mb-1.5">
              نوع تراکنش *
            </label>
            <select
              id="sm-type"
              value={movementType}
              onChange={(e) => setMovementType(e.target.value as StockMovementType)}
              className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
            >
              {MOVEMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {MOVEMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          {/* Searchable Paginated Product -> Variant Picker */}
          <div className="sm:col-span-2 p-3 rounded-xl bg-[#f6f6f7] border border-black/[0.08] space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="sm-product-search" className="text-xs font-medium text-[#111315]">
                جستجو و انتخاب محصول (برای یافتن تنوع کالا)
              </label>
              <div className="flex items-center gap-1.5 text-[11px] text-[#52565e] tabular-nums-fa">
                <button
                  type="button"
                  disabled={productPage <= 1 || loadingProducts}
                  onClick={() => setProductPage((p) => Math.max(1, p - 1))}
                  className="p-1 rounded border border-black/[0.12] bg-white disabled:opacity-40"
                  aria-label="صفحه قبل محصولات"
                >
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
                <span>
                  صفحه {toPersianDigits(productPage)} از {toPersianDigits(productTotalPages)}
                </span>
                <button
                  type="button"
                  disabled={productPage >= productTotalPages || loadingProducts}
                  onClick={() => setProductPage((p) => Math.min(productTotalPages, p + 1))}
                  className="p-1 rounded border border-black/[0.12] bg-white disabled:opacity-40"
                  aria-label="صفحه بعد محصولات"
                >
                  <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#7c818c]"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
                <input
                  id="sm-product-search"
                  type="search"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="نام، برند یا نامک محصول"
                  className="w-full h-9 pr-8 pl-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] placeholder:text-[#7c818c] focus:outline-none focus:border-[#0f49bd]"
                />
              </div>

              <select
                id="sm-product"
                aria-label="انتخاب محصول"
                value={selectedProductId}
                onChange={(e) => {
                  setSelectedProductId(e.target.value);
                  setVariantId('');
                }}
                disabled={loadingProducts}
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              >
                <option value="">
                  {loadingProducts ? 'در حال جستجو...' : 'انتخاب محصول یا ورود مستقیم شناسه'}
                </option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nameFa} ({p.brand})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="sm-variant" className="block text-xs font-medium text-[#111315] mb-1.5">
              تنوع کالا (SKU) *
            </label>
            {variants.length > 0 ? (
              <select
                id="sm-variant"
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                disabled={loadingVariants}
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              >
                <option value="">انتخاب تنوع (SKU)</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.sku} — {v.colorNameFa || v.storage || ''} {v.partNumber ? `(${v.partNumber})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="sm-variant"
                type="text"
                dir="ltr"
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                placeholder={loadingVariants ? 'در حال دریافت تنوع‌ها' : 'شناسه یکتای تنوع کالا'}
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white font-mono text-xs text-[#111315] placeholder:text-[#7c818c] focus:outline-none focus:border-[#0f49bd]"
              />
            )}
            {formErrors.variantId && (
              <p className="mt-1 text-xs text-[#b42318]">{formErrors.variantId}</p>
            )}
          </div>

          <div>
            <label htmlFor="sm-qty" className="block text-xs font-medium text-[#111315] mb-1.5">
              تغییر تعداد (مثبت ورود / منفی خروج) *
            </label>
            <input
              id="sm-qty"
              type="number"
              dir="ltr"
              value={quantityChange}
              onChange={(e) => setQuantityChange(e.target.value)}
              placeholder="مثال: 10 یا -2"
              className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs font-semibold text-[#111315] tabular-nums-fa placeholder:text-[#7c818c] focus:outline-none focus:border-[#0f49bd]"
            />
            {formErrors.quantityChange && (
              <p className="mt-1 text-xs text-[#b42318]">{formErrors.quantityChange}</p>
            )}
          </div>

          <div>
            <label htmlFor="sm-shelf" className="block text-xs font-medium text-[#111315] mb-1.5">
              کد قفسه (اختیاری)
            </label>
            <input
              id="sm-shelf"
              type="text"
              dir="ltr"
              value={shelfLocation}
              onChange={(e) => setShelfLocation(e.target.value)}
              placeholder="A-04-R2"
              className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white font-mono text-xs text-[#111315] placeholder:text-[#7c818c] focus:outline-none focus:border-[#0f49bd]"
            />
          </div>

          <div>
            <label htmlFor="sm-min-alert" className="block text-xs font-medium text-[#111315] mb-1.5">
              حد آستانه هشدار (اختیاری)
            </label>
            <input
              id="sm-min-alert"
              type="number"
              min={0}
              dir="ltr"
              value={minStockAlert}
              onChange={(e) => setMinStockAlert(e.target.value)}
              placeholder="مثال: 5"
              className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] tabular-nums-fa placeholder:text-[#7c818c] focus:outline-none focus:border-[#0f49bd]"
            />
          </div>

          <div>
            <label htmlFor="sm-ref-type" className="block text-xs font-medium text-[#111315] mb-1.5">
              نوع مرجع
            </label>
            <input
              id="sm-ref-type"
              type="text"
              dir="ltr"
              value={referenceType}
              onChange={(e) => setReferenceType(e.target.value)}
              placeholder="purchase_order"
              className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white font-mono text-xs text-[#111315] placeholder:text-[#7c818c] focus:outline-none focus:border-[#0f49bd]"
            />
          </div>

          <div>
            <label htmlFor="sm-ref-id" className="block text-xs font-medium text-[#111315] mb-1.5">
              شماره فاکتور/سفارش
            </label>
            <input
              id="sm-ref-id"
              type="text"
              dir="ltr"
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
              placeholder="PO-1404-88"
              className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white font-mono text-xs text-[#111315] placeholder:text-[#7c818c] focus:outline-none focus:border-[#0f49bd]"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="sm-note" className="block text-xs font-medium text-[#111315] mb-1.5">
              توضیحات فارسی
            </label>
            <textarea
              id="sm-note"
              rows={2}
              value={noteFa}
              onChange={(e) => setNoteFa(e.target.value)}
              placeholder="ورود محموله خرید از تامین‌کننده رسمی"
              className="w-full p-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] placeholder:text-[#7c818c] focus:outline-none focus:border-[#0f49bd]"
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
