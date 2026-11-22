import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Edit3, Plus, RefreshCw, Warehouse as WarehouseIcon } from 'lucide-react';
import type { Warehouse, WarehouseInput } from '../../types/admin';
import { adminApi } from '../../services/adminApi';
import { ApiError } from '../../services/apiClient';
import { useToast } from '../../context/ToastContext';
import { validateWarehouseInput } from '../../utils/formatters';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { StatusTag } from '../ui/StatusBadge';
import { SwitchToggle } from '../ui/SwitchToggle';
import { EmptyState, ErrorState, LoadingSkeleton } from '../ui/StateViews';

const EMPTY_WAREHOUSE: WarehouseInput = {
  code: '',
  nameFa: '',
  city: '',
  addressFa: '',
  isActive: true,
};

interface WarehousesTabProps {
  onWarehousesChanged?: () => void;
}

export function WarehousesTab({ onWarehousesChanged }: WarehousesTabProps) {
  const { pushToast } = useToast();

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<WarehouseInput>(EMPTY_WAREHOUSE);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadWarehouses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listWarehouses();
      setWarehouses(Array.isArray(res.warehouses) ? res.warehouses : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'خطا در دریافت لیست انبارها.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWarehouses();
  }, [loadWarehouses]);

  const openCreateModal = () => {
    setEditingId(null);
    setForm(EMPTY_WAREHOUSE);
    setFormErrors({});
    setServerError(null);
    setModalOpen(true);
  };

  const openEditModal = (wh: Warehouse) => {
    setEditingId(wh.id);
    setForm({
      code: wh.code,
      nameFa: wh.nameFa,
      city: wh.city,
      addressFa: wh.addressFa,
      isActive: wh.isActive,
    });
    setFormErrors({});
    setServerError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const cleaned: WarehouseInput = {
      code: form.code.trim().toUpperCase(),
      nameFa: form.nameFa.trim(),
      city: form.city.trim(),
      addressFa: (form.addressFa || '').trim(),
      isActive: Boolean(form.isActive),
    };

    const validation = validateWarehouseInput(cleaned);
    if (Object.keys(validation).length > 0) {
      setFormErrors(validation);
      return;
    }

    setFormErrors({});
    setServerError(null);
    setSaving(true);
    try {
      if (editingId) {
        await adminApi.updateWarehouse(editingId, cleaned);
        pushToast({
          tone: 'success',
          title: 'اطلاعات انبار ویرایش شد',
          description: cleaned.nameFa,
        });
      } else {
        await adminApi.createWarehouse(cleaned);
        pushToast({
          tone: 'success',
          title: 'انبار جدید ایجاد شد',
          description: cleaned.nameFa,
        });
      }
      setModalOpen(false);
      await loadWarehouses();
      onWarehousesChanged?.();
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'خطا در ذخیره انبار.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[#52565e]">
          تعریف و مدیریت انبارهای فیزیکی و مراکز توزیع برای تفکیک موجودی و قفسه‌بندی کالاها
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadWarehouses()}
            icon={<RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
          >
            به‌روزرسانی
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={openCreateModal}
            icon={<Plus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
          >
            افزودن انبار جدید
          </Button>
        </div>
      </div>

      <Card padding="md">
        {loading ? (
          <LoadingSkeleton rows={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void loadWarehouses()} />
        ) : warehouses.length === 0 ? (
          <EmptyState
            title="هنوز انباری تعریف نشده است"
            description="اولین انبار مرکزی فروشگاه را برای ثبت موجودی قفسه‌ها و تراکنش‌ها ایجاد کنید."
            icon={<WarehouseIcon className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />}
            action={
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={openCreateModal}
                icon={<Plus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
              >
                ثبت اولین انبار
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-black/[0.08] text-xs font-medium text-[#52565e]">
                  <th className="py-3 px-3">کد انبار</th>
                  <th className="py-3 px-3">نام انبار</th>
                  <th className="py-3 px-3">شهر</th>
                  <th className="py-3 px-3">نشانی</th>
                  <th className="py-3 px-3">وضعیت</th>
                  <th className="py-3 px-3 text-left">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06] text-xs">
                {warehouses.map((wh) => (
                  <tr key={wh.id} className="hover:bg-[#f7f8fa] transition-colors duration-150">
                    <td className="py-3 px-3 font-mono font-medium text-[#0f49bd]" dir="ltr">
                      {wh.code}
                    </td>
                    <td className="py-3 px-3 font-semibold text-[#111315]">{wh.nameFa}</td>
                    <td className="py-3 px-3 text-[#111315] whitespace-nowrap">{wh.city}</td>
                    <td className="py-3 px-3 text-[#52565e] max-w-md leading-5">
                      {wh.addressFa || '—'}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {wh.isActive ? (
                        <StatusTag tone="success">فعال</StatusTag>
                      ) : (
                        <StatusTag tone="neutral">غیرفعال</StatusTag>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-left">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => openEditModal(wh)}
                        aria-label={`ویرایش انبار ${wh.nameFa}`}
                        icon={<Edit3 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
                      >
                        ویرایش
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'ویرایش مشخصات انبار' : 'ایجاد انبار جدید'}
        subtitle="ثبت کد یکتا، نام فارسی، شهر و نشانی دقیق انبار"
        maxWidthClass="max-w-lg"
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
            <Button type="submit" form="warehouse-form" variant="primary" loading={saving}>
              {editingId ? 'ذخیره تغییرات' : 'ایجاد انبار'}
            </Button>
          </>
        }
      >
        <form id="warehouse-form" onSubmit={handleSave} className="space-y-4">
          {serverError && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-[#fef3f2] border border-[#fecaca] text-xs font-medium text-[#b42318]"
            >
              {serverError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="wh-code" className="block text-xs font-medium text-[#111315] mb-1.5">
                کد انبار *
              </label>
              <input
                id="wh-code"
                type="text"
                dir="ltr"
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                placeholder="WH-THR-CENTRAL"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white font-mono text-xs text-[#111315] placeholder:text-[#7c818c] focus:outline-none focus:border-[#0f49bd]"
              />
              {formErrors.code && <p className="mt-1 text-xs text-[#b42318]">{formErrors.code}</p>}
            </div>

            <div>
              <label htmlFor="wh-city" className="block text-xs font-medium text-[#111315] mb-1.5">
                شهر *
              </label>
              <input
                id="wh-city"
                type="text"
                value={form.city}
                onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                placeholder="تهران"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] placeholder:text-[#7c818c] focus:outline-none focus:border-[#0f49bd]"
              />
              {formErrors.city && <p className="mt-1 text-xs text-[#b42318]">{formErrors.city}</p>}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="wh-name" className="block text-xs font-medium text-[#111315] mb-1.5">
                نام فارسی انبار *
              </label>
              <input
                id="wh-name"
                type="text"
                value={form.nameFa}
                onChange={(e) => setForm((p) => ({ ...p, nameFa: e.target.value }))}
                placeholder="انبار مرکزی تهران (چارسو)"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] placeholder:text-[#7c818c] focus:outline-none focus:border-[#0f49bd]"
              />
              {formErrors.nameFa && (
                <p className="mt-1 text-xs text-[#b42318]">{formErrors.nameFa}</p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="wh-address" className="block text-xs font-medium text-[#111315] mb-1.5">
                نشانی کامل فارسی
              </label>
              <textarea
                id="wh-address"
                rows={2}
                value={form.addressFa || ''}
                onChange={(e) => setForm((p) => ({ ...p, addressFa: e.target.value }))}
                placeholder="خیابان جمهوری، تقاطع حافظ، پلاک ۴۲"
                className="w-full p-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] placeholder:text-[#7c818c] focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <div className="sm:col-span-2 pt-3 border-t border-black/[0.06]">
              <SwitchToggle
                id="wh-active"
                checked={form.isActive}
                onChange={(val) => setForm((p) => ({ ...p, isActive: val }))}
                label="انبار فعال برای عملیات فروش و ورود/خروج"
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
