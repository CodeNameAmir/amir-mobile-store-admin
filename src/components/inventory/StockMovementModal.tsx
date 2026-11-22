import { useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle } from 'lucide-react';
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
    if (!open) return;
    setWarehouseId(initialWarehouseId || warehouses[0]?.id || '');
    setVariantId(initialVariantId || '');
    setSelectedProductId(initialProductId || '');
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

    void adminApi
      .listProducts({ pageSize: 100 })
      .then((res) => setProducts(Array.isArray(res.items) ? res.items : []))
      .catch(() => undefined);
  }, [open, initialWarehouseId, initialVariantId, initialProductId, warehouses]);

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
      // Display exact Persian error from server (including 409 Conflict e.g. negative stock)
      const message =
        err instanceof ApiError
          ? err.message
          : 'خطا در ثبت تراکنش انبار. لطفاً دوباره تلاش کنید.';
      setServerError(message);
      // If conflict or validation failed, rotate idempotency key for the next adjusted attempt
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

          {/* Product -> Variant Helper Picker */}
          <div>
            <label htmlFor="sm-product" className="block text-xs font-medium text-[#111315] mb-1.5">
              انتخاب محصول (یافتن تنوع کالا)
            </label>
            <select
              id="sm-product"
              value={selectedProductId}
              onChange={(e) => {
                setSelectedProductId(e.target.value);
                setVariantId('');
              }}
              className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
            >
              <option value="">انتخاب محصول یا ورود مستقیم شناسه</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameFa}
                </option>
              ))}
            </select>
          </div>

          <div>
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
