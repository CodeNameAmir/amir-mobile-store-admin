import { useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, ArrowLeftRight, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type {
  Product,
  ProductVariant,
  Warehouse,
  WarehouseTransferInput,
} from '../../types/admin';
import { adminApi } from '../../services/adminApi';
import { ApiError } from '../../services/apiClient';
import { useToast } from '../../context/ToastContext';
import {
  generateIdempotencyKey,
  toEnglishDigits,
  toPersianDigits,
  validateWarehouseTransferInput,
} from '../../utils/formatters';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface WarehouseTransferModalProps {
  open: boolean;
  onClose: () => void;
  warehouses: Warehouse[];
  onSuccess: () => void;
}

export function WarehouseTransferModal({
  open,
  onClose,
  warehouses,
  onSuccess,
}: WarehouseTransferModalProps) {
  const { pushToast } = useToast();

  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');

  const [productSearch, setProductSearch] = useState('');
  const [debouncedProductSearch, setDebouncedProductSearch] = useState('');
  const [productPage, setProductPage] = useState(1);
  const [productTotalPages, setProductTotalPages] = useState(1);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);

  const [variantId, setVariantId] = useState('');
  const [quantity, setQuantity] = useState('1');
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
    setFromWarehouseId(warehouses[0]?.id || '');
    setToWarehouseId(warehouses[1]?.id || '');
    setProductSearch('');
    setDebouncedProductSearch('');
    setProductPage(1);
    setSelectedProductId('');
    setVariantId('');
    setQuantity('1');
    setReferenceId('');
    setNoteFa('');
    setIdempotencyKey(generateIdempotencyKey());
    setFormErrors({});
    setServerError(null);
  }, [open, warehouses]);

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
        if (active) setProducts([]);
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
        if (list.length > 0) {
          setVariantId(list[0].id);
        }
      })
      .catch(() => setVariants([]))
      .finally(() => setLoadingVariants(false));
  }, [open, selectedProductId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsedQty = Math.trunc(Number(toEnglishDigits(quantity)) || 0);
    const payload: WarehouseTransferInput = {
      fromWarehouseId: fromWarehouseId.trim(),
      toWarehouseId: toWarehouseId.trim(),
      variantId: variantId.trim(),
      quantity: parsedQty,
      referenceId: referenceId.trim() ? referenceId.trim() : null,
      noteFa: noteFa.trim() ? noteFa.trim() : null,
      idempotencyKey,
    };

    const validation = validateWarehouseTransferInput(payload);
    if (Object.keys(validation).length > 0) {
      setFormErrors(validation);
      return;
    }

    setFormErrors({});
    setServerError(null);
    setSubmitting(true);
    try {
      await adminApi.transferWarehouseStock(payload);
      pushToast({
        tone: 'success',
        title: 'انتقال موجودی بین انبارها ثبت شد',
        description: `${toPersianDigits(parsedQty)} عدد با موفقیت منتقل و در دفترکل دوطرفه ثبت شد.`,
      });
      setIdempotencyKey(generateIdempotencyKey());
      onSuccess();
      onClose();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : 'خطا در انتقال موجودی بین انبارها. لطفاً موجودی مبدا یا اتصال سرور را بررسی کنید.';
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
      title="انتقال موجودی بین انبارها"
      subtitle="ثبت اتمیک خروج از انبار مبدا و ورود همزمان به انبار مقصد"
      maxWidthClass="max-w-2xl"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            انصراف
          </Button>
          <Button
            type="submit"
            form="warehouse-transfer-form"
            variant="primary"
            loading={submitting}
            icon={<ArrowLeftRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
          >
            ثبت انتقال اتمیک
          </Button>
        </>
      }
    >
      <form id="warehouse-transfer-form" onSubmit={handleSubmit} className="space-y-4">
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
            <label htmlFor="wt-from" className="block text-xs font-medium text-[#111315] mb-1.5">
              انبار مبدا *
            </label>
            <select
              id="wt-from"
              value={fromWarehouseId}
              onChange={(e) => setFromWarehouseId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
            >
              <option value="">انتخاب انبار مبدا</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.nameFa} ({wh.code})
                </option>
              ))}
            </select>
            {formErrors.fromWarehouseId && (
              <p className="mt-1 text-xs text-[#b42318]">{formErrors.fromWarehouseId}</p>
            )}
          </div>

          <div>
            <label htmlFor="wt-to" className="block text-xs font-medium text-[#111315] mb-1.5">
              انبار مقصد *
            </label>
            <select
              id="wt-to"
              value={toWarehouseId}
              onChange={(e) => setToWarehouseId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
            >
              <option value="">انتخاب انبار مقصد</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.nameFa} ({wh.code})
                </option>
              ))}
            </select>
            {formErrors.toWarehouseId && (
              <p className="mt-1 text-xs text-[#b42318]">{formErrors.toWarehouseId}</p>
            )}
          </div>

          <div className="sm:col-span-2 p-3 rounded-xl bg-[#f6f6f7] border border-black/[0.08] space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="wt-product-search" className="text-xs font-medium text-[#111315]">
                جستجوی محصول برای انتخاب تنوع
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
                  id="wt-product-search"
                  type="search"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="نام یا برند محصول"
                  className="w-full h-9 pr-8 pl-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
                />
              </div>

              <select
                aria-label="انتخاب محصول برای انتقال"
                value={selectedProductId}
                onChange={(e) => {
                  setSelectedProductId(e.target.value);
                  setVariantId('');
                }}
                disabled={loadingProducts}
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              >
                <option value="">
                  {loadingProducts ? 'در حال جستجو...' : 'انتخاب محصول'}
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
            <label htmlFor="wt-variant" className="block text-xs font-medium text-[#111315] mb-1.5">
              تنوع کالا (SKU) *
            </label>
            {variants.length > 0 ? (
              <select
                id="wt-variant"
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                disabled={loadingVariants}
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              >
                <option value="">انتخاب تنوع (SKU)</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.sku} — {v.colorNameFa || v.storage || ''}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="wt-variant"
                type="text"
                dir="ltr"
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                placeholder="شناسه یکتای تنوع (Variant ID)"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white font-mono text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
            )}
            {formErrors.variantId && (
              <p className="mt-1 text-xs text-[#b42318]">{formErrors.variantId}</p>
            )}
          </div>

          <div>
            <label htmlFor="wt-qty" className="block text-xs font-medium text-[#111315] mb-1.5">
              تعداد قابل انتقال *
            </label>
            <input
              id="wt-qty"
              type="number"
              min={1}
              dir="ltr"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs font-semibold text-[#111315] tabular-nums-fa focus:outline-none focus:border-[#0f49bd]"
            />
            {formErrors.quantity && (
              <p className="mt-1 text-xs text-[#b42318]">{formErrors.quantity}</p>
            )}
          </div>

          <div>
            <label htmlFor="wt-ref" className="block text-xs font-medium text-[#111315] mb-1.5">
              شماره حواله / مرجع
            </label>
            <input
              id="wt-ref"
              type="text"
              dir="ltr"
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
              placeholder="TR-1405-01"
              className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white font-mono text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="wt-note" className="block text-xs font-medium text-[#111315] mb-1.5">
              توضیحات انتقال
            </label>
            <textarea
              id="wt-note"
              rows={2}
              value={noteFa}
              onChange={(e) => setNoteFa(e.target.value)}
              placeholder="توضیحات ارسال بین شعب یا انبارها"
              className="w-full p-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
