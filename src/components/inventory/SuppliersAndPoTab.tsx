import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  Building2,
  CheckCircle2,
  Edit3,
  FileSpreadsheet,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type {
  Product,
  ProductVariant,
  PurchaseOrder,
  PurchaseOrderInput,
  PurchaseOrderStatus,
  SupplierInput,
  SupplierItem,
  Warehouse,
} from '../../types/admin';
import { adminApi } from '../../services/adminApi';
import { ApiError, isEndpointUnsupportedError } from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  formatPersianDateTime,
  formatToman,
  PO_STATUS_LABELS,
  toEnglishDigits,
  toPersianDigits,
  validatePurchaseOrderInput,
  validateSupplierInput,
} from '../../utils/formatters';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { StatusTag } from '../ui/StatusBadge';
import { SwitchToggle } from '../ui/SwitchToggle';
import {
  EmptyState,
  EndpointUnsupportedState,
  ErrorState,
  LoadingSkeleton,
} from '../ui/StateViews';

interface SuppliersAndPoTabProps {
  mode: 'suppliers' | 'purchase_orders';
  warehouses: Warehouse[];
  onPurchaseOrderReceived: () => void;
}

const EMPTY_SUPPLIER: SupplierInput = {
  nameFa: '',
  contactName: '',
  phone: '',
  city: '',
  taxId: '',
  notes: '',
  isActive: true,
};

const PO_TONE: Record<PurchaseOrderStatus, 'neutral' | 'info' | 'success' | 'danger'> = {
  draft: 'neutral',
  ordered: 'info',
  received: 'success',
  cancelled: 'danger',
};

export function SuppliersAndPoTab({
  mode,
  warehouses,
  onPurchaseOrderReceived,
}: SuppliersAndPoTabProps) {
  const { can } = useAuth();
  const { pushToast } = useToast();

  const canManageInventory = can('inventory.adjust');

  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);

  // Supplier modal
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [supplierForm, setSupplierForm] = useState<SupplierInput>(EMPTY_SUPPLIER);
  const [supplierErrors, setSupplierErrors] = useState<Record<string, string>>({});
  const [supplierServerError, setSupplierServerError] = useState<string | null>(null);
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [deleteSupplierTarget, setDeleteSupplierTarget] = useState<SupplierItem | null>(null);
  const [deletingSupplier, setDeletingSupplier] = useState(false);

  // Purchase order modal
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [poNumber, setPoNumber] = useState('');
  const [poSupplierId, setPoSupplierId] = useState('');
  const [poWarehouseId, setPoWarehouseId] = useState('');
  const [poNote, setPoNote] = useState('');
  const [poItems, setPoItems] = useState<PurchaseOrderInput['items']>([]);
  const [poErrors, setPoErrors] = useState<Record<string, string>>({});
  const [poServerError, setPoServerError] = useState<string | null>(null);
  const [savingPo, setSavingPo] = useState(false);

  // Debounced product/variant selector inside PO modal
  const [productQuery, setProductQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [lineQty, setLineQty] = useState(1);
  const [lineCost, setLineCost] = useState(0);

  const [receiveTarget, setReceiveTarget] = useState<PurchaseOrder | null>(null);
  const [receivingPo, setReceivingPo] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUnsupported(false);
    try {
      const supRes = await adminApi.listSuppliers();
      setSuppliers(supRes.suppliers);
      if (mode === 'purchase_orders') {
        const poRes = await adminApi.listPurchaseOrders();
        setPurchaseOrders(poRes.purchaseOrders);
      }
    } catch (err) {
      if (isEndpointUnsupportedError(err)) {
        setUnsupported(true);
      } else {
        setError(
          err instanceof ApiError
            ? err.message
            : 'خطا در دریافت اطلاعات تامین‌کنندگان و سفارش‌های خرید.'
        );
      }
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!poModalOpen) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await adminApi.listProducts({
            search: productQuery.trim() || undefined,
            pageSize: 20,
          });
          setProducts(res.items);
        } catch {
          // Ignore transient search error inside picker
        }
      })();
    }, 280);
    return () => window.clearTimeout(timer);
  }, [poModalOpen, productQuery]);

  useEffect(() => {
    if (!selectedProductId) {
      setVariants([]);
      setSelectedVariantId('');
      return;
    }
    let active = true;
    void (async () => {
      try {
        const res = await adminApi.listProductVariants(selectedProductId);
        if (!active) return;
        setVariants(res.variants);
        if (res.variants[0]) {
          setSelectedVariantId(res.variants[0].id);
          setLineCost(res.variants[0].costPriceToman || res.variants[0].priceToman || 0);
        }
      } catch {
        if (active) setVariants([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedProductId]);

  const openCreateSupplier = () => {
    setEditingSupplierId(null);
    setSupplierForm(EMPTY_SUPPLIER);
    setSupplierErrors({});
    setSupplierServerError(null);
    setSupplierModalOpen(true);
  };

  const openEditSupplier = (sup: SupplierItem) => {
    setEditingSupplierId(sup.id);
    setSupplierForm({
      nameFa: sup.nameFa,
      contactName: sup.contactName || '',
      phone: sup.phone || '',
      city: sup.city || '',
      taxId: sup.taxId || '',
      notes: sup.notes || '',
      isActive: sup.isActive,
    });
    setSupplierErrors({});
    setSupplierServerError(null);
    setSupplierModalOpen(true);
  };

  const handleSaveSupplier = async (e: FormEvent) => {
    e.preventDefault();
    const cleaned: SupplierInput = {
      nameFa: supplierForm.nameFa.trim(),
      contactName: supplierForm.contactName?.trim() || null,
      phone: supplierForm.phone ? toEnglishDigits(supplierForm.phone).trim() : null,
      city: supplierForm.city?.trim() || null,
      taxId: supplierForm.taxId?.trim() || null,
      notes: supplierForm.notes?.trim() || null,
      isActive: Boolean(supplierForm.isActive),
    };
    const validation = validateSupplierInput(cleaned);
    if (Object.keys(validation).length > 0) {
      setSupplierErrors(validation);
      return;
    }
    setSupplierErrors({});
    setSupplierServerError(null);
    setSavingSupplier(true);
    try {
      await adminApi.saveSupplier(cleaned, editingSupplierId ?? undefined);
      pushToast({
        tone: 'success',
        title: editingSupplierId ? 'اطلاعات تامین‌کننده ویرایش شد' : 'تامین‌کننده جدید ثبت شد',
        description: cleaned.nameFa,
      });
      setSupplierModalOpen(false);
      await loadData();
    } catch (err) {
      setSupplierServerError(
        err instanceof ApiError ? err.message : 'خطا در ذخیره تامین‌کننده.'
      );
    } finally {
      setSavingSupplier(false);
    }
  };

  const handleDeleteSupplier = async () => {
    if (!deleteSupplierTarget) return;
    setDeletingSupplier(true);
    try {
      await adminApi.deleteSupplier(deleteSupplierTarget.id);
      pushToast({
        tone: 'success',
        title: 'تامین‌کننده حذف شد',
        description: deleteSupplierTarget.nameFa,
      });
      setDeleteSupplierTarget(null);
      await loadData();
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'خطا در حذف تامین‌کننده',
        description: err instanceof ApiError ? err.message : 'امکان حذف تامین‌کننده وجود ندارد.',
      });
    } finally {
      setDeletingSupplier(false);
    }
  };

  const openCreatePoModal = () => {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    setPoNumber(`PO-${stamp}-${Math.floor(100 + Math.random() * 900)}`);
    setPoSupplierId(suppliers[0]?.id || '');
    setPoWarehouseId(warehouses[0]?.id || '');
    setPoNote('');
    setPoItems([]);
    setPoErrors({});
    setPoServerError(null);
    setPoModalOpen(true);
  };

  const handleAddPoLine = () => {
    const variant = variants.find((v) => v.id === selectedVariantId);
    if (!variant) return;
    if (lineQty <= 0) return;
    setPoItems((prev) => {
      const existing = prev.find((item) => item.variantId === variant.id);
      if (existing) {
        return prev.map((item) =>
          item.variantId === variant.id
            ? { ...item, quantity: item.quantity + lineQty, unitCostToman: lineCost }
            : item
        );
      }
      return [
        ...prev,
        {
          variantId: variant.id,
          sku: variant.sku,
          quantity: lineQty,
          unitCostToman: Math.max(0, Math.round(lineCost)),
        },
      ];
    });
  };

  const handleSavePo = async (e: FormEvent) => {
    e.preventDefault();
    const payload: PurchaseOrderInput = {
      poNumber: toEnglishDigits(poNumber).trim().toUpperCase(),
      supplierId: poSupplierId,
      warehouseId: poWarehouseId,
      status: 'ordered',
      note: poNote.trim() || null,
      items: poItems,
    };
    const validation = validatePurchaseOrderInput(payload);
    if (Object.keys(validation).length > 0) {
      setPoErrors(validation);
      return;
    }

    setPoErrors({});
    setPoServerError(null);
    setSavingPo(true);
    try {
      await adminApi.createPurchaseOrder(payload);
      pushToast({
        tone: 'success',
        title: 'سفارش خرید ثبت شد',
        description: payload.poNumber,
      });
      setPoModalOpen(false);
      await loadData();
    } catch (err) {
      setPoServerError(
        err instanceof ApiError ? err.message : 'خطا در ثبت سفارش خرید تامین‌کننده.'
      );
    } finally {
      setSavingPo(false);
    }
  };

  const handleConfirmReceivePo = async () => {
    if (!receiveTarget) return;
    setReceivingPo(true);
    try {
      await adminApi.receivePurchaseOrder(receiveTarget.id);
      pushToast({
        tone: 'success',
        title: 'اقلام سفارش خرید وارد انبار شد',
        description: `${receiveTarget.poNumber} — موجودی قفسه و بهای تمام‌شده به‌روزرسانی گردید.`,
      });
      setReceiveTarget(null);
      await loadData();
      onPurchaseOrderReceived();
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'خطا در ثبت دریافت سفارش خرید',
        description: err instanceof ApiError ? err.message : 'امکان ثبت ورود کالا وجود ندارد.',
      });
    } finally {
      setReceivingPo(false);
    }
  };

  if (loading) {
    return (
      <Card padding="md">
        <LoadingSkeleton rows={5} />
      </Card>
    );
  }

  if (unsupported) {
    return (
      <Card padding="md">
        <EndpointUnsupportedState
          title={
            mode === 'suppliers'
              ? 'ماژول تامین‌کنندگان در سرور API هنوز فعال نشده است'
              : 'ماژول سفارش‌های خرید (PO) در سرور API هنوز فعال نشده است'
          }
          description="برای ثبت فاکتورهای خرید عمده و به‌روزرسانی خودکار بهای تمام‌شده، مسیرهای Suppliers و Purchase Orders باید در بک‌اند فعال شوند."
          endpointHint="GET /api/admin/suppliers | GET /api/admin/purchase-orders"
          onRetry={() => void loadData()}
        />
      </Card>
    );
  }

  if (error) {
    return (
      <Card padding="md">
        <ErrorState message={error} onRetry={() => void loadData()} />
      </Card>
    );
  }

  if (mode === 'suppliers') {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[#52565e]">
            مدیریت شرکت‌ها و تامین‌کنندگان عمده گوشی و لوازم جانبی
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadData()}
              icon={<RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
            >
              به‌روزرسانی
            </Button>
            {canManageInventory && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={openCreateSupplier}
                icon={<Plus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
              >
                افزودن تامین‌کننده
              </Button>
            )}
          </div>
        </div>

        <Card padding="md">
          {suppliers.length === 0 ? (
            <EmptyState
              title="تامین‌کننده‌ای ثبت نشده است"
              description="اطلاعات تامین‌کنندگان فروشگاه را اضافه کنید."
              icon={<Building2 className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="border-b border-black/[0.08] text-xs font-medium text-[#52565e]">
                    <th className="py-3 px-3">نام تامین‌کننده</th>
                    <th className="py-3 px-3">نام رابط</th>
                    <th className="py-3 px-3">شماره تماس</th>
                    <th className="py-3 px-3">شهر</th>
                    <th className="py-3 px-3">شناسه اقتصادی</th>
                    <th className="py-3 px-3">وضعیت</th>
                    <th className="py-3 px-3 text-left">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.06] text-xs">
                  {suppliers.map((sup) => (
                    <tr key={sup.id} className="hover:bg-[#f7f8fa] transition-colors duration-150">
                      <td className="py-3 px-3 font-semibold text-[#111315]">{sup.nameFa}</td>
                      <td className="py-3 px-3 text-[#52565e]">{sup.contactName || '—'}</td>
                      <td className="py-3 px-3 font-mono text-[#111315]" dir="ltr">
                        {sup.phone ? toPersianDigits(sup.phone) : '—'}
                      </td>
                      <td className="py-3 px-3 text-[#52565e]">{sup.city || '—'}</td>
                      <td className="py-3 px-3 font-mono text-[#52565e]" dir="ltr">
                        {sup.taxId || '—'}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <StatusTag tone={sup.isActive ? 'success' : 'neutral'}>
                          {sup.isActive ? 'فعال' : 'غیرفعال'}
                        </StatusTag>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap text-left">
                        {canManageInventory && (
                          <div className="inline-flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => openEditSupplier(sup)}
                              icon={<Edit3 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
                            >
                              ویرایش
                            </Button>
                            <button
                              type="button"
                              onClick={() => setDeleteSupplierTarget(sup)}
                              aria-label={`حذف ${sup.nameFa}`}
                              className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-[#52565e] hover:bg-[#fef3f2] hover:text-[#b42318]"
                            >
                              <Trash2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Modal
          open={supplierModalOpen}
          onClose={() => setSupplierModalOpen(false)}
          title={editingSupplierId ? 'ویرایش تامین‌کننده' : 'ثبت تامین‌کننده جدید'}
          maxWidthClass="max-w-lg"
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSupplierModalOpen(false)}
                disabled={savingSupplier}
              >
                انصراف
              </Button>
              <Button type="submit" form="supplier-form" variant="primary" loading={savingSupplier}>
                ذخیره تامین‌کننده
              </Button>
            </>
          }
        >
          <form id="supplier-form" onSubmit={handleSaveSupplier} className="space-y-4">
            {supplierServerError && (
              <div
                role="alert"
                className="p-3 rounded-lg bg-[#fef3f2] border border-[#fecaca] text-xs font-medium text-[#b42318]"
              >
                {supplierServerError}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="sup-name" className="block text-xs font-medium text-[#111315] mb-1.5">
                  نام تامین‌کننده / شرکت *
                </label>
                <input
                  id="sup-name"
                  type="text"
                  value={supplierForm.nameFa}
                  onChange={(e) => setSupplierForm((p) => ({ ...p, nameFa: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
                />
                {supplierErrors.nameFa && (
                  <p className="mt-1 text-xs text-[#b42318]">{supplierErrors.nameFa}</p>
                )}
              </div>
              <div>
                <label htmlFor="sup-contact" className="block text-xs font-medium text-[#111315] mb-1.5">
                  نام فرد رابط
                </label>
                <input
                  id="sup-contact"
                  type="text"
                  value={supplierForm.contactName || ''}
                  onChange={(e) => setSupplierForm((p) => ({ ...p, contactName: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
                />
              </div>
              <div>
                <label htmlFor="sup-phone" className="block text-xs font-medium text-[#111315] mb-1.5">
                  تلفن تماس
                </label>
                <input
                  id="sup-phone"
                  type="text"
                  dir="ltr"
                  value={supplierForm.phone || ''}
                  onChange={(e) => setSupplierForm((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg border border-black/[0.14] font-mono text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
                />
                {supplierErrors.phone && (
                  <p className="mt-1 text-xs text-[#b42318]">{supplierErrors.phone}</p>
                )}
              </div>
              <div>
                <label htmlFor="sup-city" className="block text-xs font-medium text-[#111315] mb-1.5">
                  شهر
                </label>
                <input
                  id="sup-city"
                  type="text"
                  value={supplierForm.city || ''}
                  onChange={(e) => setSupplierForm((p) => ({ ...p, city: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
                />
              </div>
              <div>
                <label htmlFor="sup-tax" className="block text-xs font-medium text-[#111315] mb-1.5">
                  شناسه ملی / اقتصادی
                </label>
                <input
                  id="sup-tax"
                  type="text"
                  dir="ltr"
                  value={supplierForm.taxId || ''}
                  onChange={(e) => setSupplierForm((p) => ({ ...p, taxId: e.target.value }))}
                  className="w-full h-9 px-3 rounded-lg border border-black/[0.14] font-mono text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
                />
              </div>
              <div className="sm:col-span-2">
                <SwitchToggle
                  id="sup-active"
                  checked={supplierForm.isActive}
                  onChange={(val) => setSupplierForm((p) => ({ ...p, isActive: val }))}
                  label="تامین‌کننده فعال است"
                />
              </div>
            </div>
          </form>
        </Modal>

        <ConfirmDialog
          open={Boolean(deleteSupplierTarget)}
          onClose={() => setDeleteSupplierTarget(null)}
          onConfirm={() => void handleDeleteSupplier()}
          loading={deletingSupplier}
          title="حذف تامین‌کننده"
          description={`آیا از حذف «${deleteSupplierTarget?.nameFa || ''}» اطمینان دارید؟`}
          confirmLabel="حذف تامین‌کننده"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[#52565e]">
          ثبت سفارش خرید از تامین‌کنندگان و ورود اتمیک اقلام به انبار مقصد
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadData()}
            icon={<RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
          >
            به‌روزرسانی
          </Button>
          {canManageInventory && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={openCreatePoModal}
              icon={<Plus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
            >
              ثبت سفارش خرید (PO)
            </Button>
          )}
        </div>
      </div>

      <Card padding="md">
        {purchaseOrders.length === 0 ? (
          <EmptyState
            title="سفارش خریدی ثبت نشده است"
            description="برای تامین موجودی انبار و ثبت خودکار بهای تمام‌شده، یک سفارش خرید ایجاد کنید."
            icon={<FileSpreadsheet className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-black/[0.08] text-xs font-medium text-[#52565e]">
                  <th className="py-3 px-3">شماره PO</th>
                  <th className="py-3 px-3">تامین‌کننده</th>
                  <th className="py-3 px-3">انبار مقصد</th>
                  <th className="py-3 px-3">اقلام</th>
                  <th className="py-3 px-3">جمع فاکتور</th>
                  <th className="py-3 px-3">وضعیت</th>
                  <th className="py-3 px-3">تاریخ ثبت</th>
                  <th className="py-3 px-3 text-left">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06] text-xs">
                {purchaseOrders.map((po) => (
                  <tr key={po.id} className="hover:bg-[#f7f8fa] transition-colors duration-150">
                    <td className="py-3 px-3 font-mono font-semibold text-[#0f49bd]" dir="ltr">
                      {po.poNumber}
                    </td>
                    <td className="py-3 px-3 font-medium text-[#111315]">
                      {po.supplierNameFa || '—'}
                    </td>
                    <td className="py-3 px-3 text-[#52565e]">{po.warehouseNameFa || '—'}</td>
                    <td className="py-3 px-3 text-[#111315] tabular-nums-fa">
                      {toPersianDigits(po.items.length)} ردیف
                    </td>
                    <td className="py-3 px-3 font-semibold text-[#111315] tabular-nums-fa whitespace-nowrap">
                      {formatToman(po.totalCostToman)}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <StatusTag tone={PO_TONE[po.status]}>{PO_STATUS_LABELS[po.status]}</StatusTag>
                    </td>
                    <td className="py-3 px-3 text-[#52565e] whitespace-nowrap tabular-nums-fa">
                      {formatPersianDateTime(po.receivedAt || po.createdAt)}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-left">
                      {canManageInventory &&
                        (po.status === 'draft' || po.status === 'ordered') && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setReceiveTarget(po)}
                            icon={
                              <CheckCircle2
                                className="h-3.5 w-3.5"
                                strokeWidth={1.5}
                                aria-hidden="true"
                              />
                            }
                          >
                            تحویل به انبار
                          </Button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={poModalOpen}
        onClose={() => setPoModalOpen(false)}
        title="ثبت سفارش خرید جدید (Purchase Order)"
        maxWidthClass="max-w-2xl"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPoModalOpen(false)}
              disabled={savingPo}
            >
              انصراف
            </Button>
            <Button type="submit" form="po-form" variant="primary" loading={savingPo}>
              ثبت سفارش خرید
            </Button>
          </>
        }
      >
        <form id="po-form" onSubmit={handleSavePo} className="space-y-4">
          {poServerError && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-[#fef3f2] border border-[#fecaca] text-xs font-medium text-[#b42318]"
            >
              {poServerError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="po-num" className="block text-xs font-medium text-[#111315] mb-1.5">
                شماره PO *
              </label>
              <input
                id="po-num"
                type="text"
                dir="ltr"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] font-mono text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
              {poErrors.poNumber && (
                <p className="mt-1 text-xs text-[#b42318]">{poErrors.poNumber}</p>
              )}
            </div>

            <div>
              <label htmlFor="po-sup" className="block text-xs font-medium text-[#111315] mb-1.5">
                تامین‌کننده *
              </label>
              <select
                id="po-sup"
                value={poSupplierId}
                onChange={(e) => setPoSupplierId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              >
                <option value="">انتخاب تامین‌کننده...</option>
                {suppliers.map((sup) => (
                  <option key={sup.id} value={sup.id}>
                    {sup.nameFa}
                  </option>
                ))}
              </select>
              {poErrors.supplierId && (
                <p className="mt-1 text-xs text-[#b42318]">{poErrors.supplierId}</p>
              )}
            </div>

            <div>
              <label htmlFor="po-wh" className="block text-xs font-medium text-[#111315] mb-1.5">
                انبار مقصد *
              </label>
              <select
                id="po-wh"
                value={poWarehouseId}
                onChange={(e) => setPoWarehouseId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              >
                <option value="">انتخاب انبار...</option>
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.nameFa}
                  </option>
                ))}
              </select>
              {poErrors.warehouseId && (
                <p className="mt-1 text-xs text-[#b42318]">{poErrors.warehouseId}</p>
              )}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#f6f6f7] border border-black/[0.08] space-y-3">
            <p className="text-xs font-semibold text-[#111315]">افزودن قلم کالا به سفارش خرید</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="search"
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                placeholder="جستجوی محصول (نام یا برند)..."
                aria-label="جستجوی محصول"
                className="h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315]"
              />
              <select
                aria-label="انتخاب محصول"
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315]"
              >
                <option value="">انتخاب محصول...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nameFa}
                  </option>
                ))}
              </select>

              <select
                aria-label="انتخاب تنوع SKU"
                value={selectedVariantId}
                onChange={(e) => {
                  const vid = e.target.value;
                  setSelectedVariantId(vid);
                  const found = variants.find((v) => v.id === vid);
                  if (found) setLineCost(found.costPriceToman || found.priceToman || 0);
                }}
                className="h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315]"
              >
                <option value="">انتخاب SKU...</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.sku} ({v.colorNameFa || v.storage || 'تنوع'})
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  dir="ltr"
                  aria-label="تعداد"
                  value={lineQty}
                  onChange={(e) => setLineQty(Math.max(1, Number(e.target.value) || 1))}
                  className="w-20 h-9 px-2 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] tabular-nums-fa"
                />
                <input
                  type="number"
                  min={0}
                  dir="ltr"
                  aria-label="بهای خرید واحد"
                  value={lineCost}
                  onChange={(e) => setLineCost(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="فی خرید"
                  className="flex-1 h-9 px-2 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] tabular-nums-fa"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleAddPoLine}
                  disabled={!selectedVariantId}
                >
                  افزودن
                </Button>
              </div>
            </div>

            {poErrors.items && <p className="text-xs text-[#b42318]">{poErrors.items}</p>}

            {poItems.length > 0 && (
              <div className="divide-y divide-black/[0.06] bg-white rounded-lg border border-black/[0.08]">
                {poItems.map((line) => (
                  <div
                    key={line.variantId}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                  >
                    <span className="font-mono text-[#0f49bd]" dir="ltr">
                      {line.sku}
                    </span>
                    <span className="tabular-nums-fa text-[#111315]">
                      {toPersianDigits(line.quantity)} عدد × {formatToman(line.unitCostToman)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setPoItems((prev) =>
                          prev.filter((item) => item.variantId !== line.variantId)
                        )
                      }
                      className="text-[#b42318] hover:underline text-[11px]"
                    >
                      حذف
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="po-note" className="block text-xs font-medium text-[#111315] mb-1.5">
              یادداشت سفارش خرید
            </label>
            <input
              id="po-note"
              type="text"
              value={poNote}
              onChange={(e) => setPoNote(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
            />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(receiveTarget)}
        onClose={() => setReceiveTarget(null)}
        onConfirm={() => void handleConfirmReceivePo()}
        loading={receivingPo}
        tone="primary"
        title="ثبت تحویل سفارش خرید در انبار"
        description={`با تایید دریافت «${receiveTarget?.poNumber || ''}»، موجودی انبار مقصد افزایش یافته و بهای تمام‌شده تنوع‌ها به‌روزرسانی می‌شود.`}
        confirmLabel="تایید ورود به انبار"
      />
    </div>
  );
}
