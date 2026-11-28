import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Edit3, Plus, RefreshCw, Trash2, Truck } from 'lucide-react';
import type { ShippingMethod, ShippingMethodInput } from '../../types/admin';
import { adminApi } from '../../services/adminApi';
import { ApiError, isEndpointUnsupportedError } from '../../services/apiClient';
import { useToast } from '../../context/ToastContext';
import {
  formatToman,
  toEnglishDigits,
  toPersianDigits,
  validateShippingMethodInput,
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

const EMPTY_SHIPPING: ShippingMethodInput = {
  code: '',
  nameFa: '',
  carrier: 'post_pishtaz',
  descriptionFa: '',
  baseCostToman: 0,
  freeAboveToman: null,
  estimatedDays: '۲ تا ۴ روز کاری',
  supportedCities: [],
  isExpress: false,
  isActive: true,
  sortOrder: 10,
};

export function ShippingSettingsTab() {
  const { pushToast } = useToast();

  const [methods, setMethods] = useState<ShippingMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ShippingMethodInput>(EMPTY_SHIPPING);
  const [citiesInput, setCitiesInput] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ShippingMethod | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadMethods = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUnsupported(false);
    try {
      const res = await adminApi.listShippingMethods();
      setMethods(res.shippingMethods);
    } catch (err) {
      if (isEndpointUnsupportedError(err)) {
        setUnsupported(true);
      } else {
        setError(
          err instanceof ApiError ? err.message : 'خطا در دریافت روش‌های ارسال فروشگاه.'
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMethods();
  }, [loadMethods]);

  const openCreateModal = () => {
    setEditingId(null);
    setForm(EMPTY_SHIPPING);
    setCitiesInput('');
    setFormErrors({});
    setServerError(null);
    setModalOpen(true);
  };

  const openEditModal = (method: ShippingMethod) => {
    setEditingId(method.id);
    setForm({
      code: method.code,
      nameFa: method.nameFa,
      carrier: method.carrier,
      descriptionFa: method.descriptionFa,
      baseCostToman: method.baseCostToman,
      freeAboveToman: method.freeAboveToman ?? null,
      estimatedDays: method.estimatedDays,
      supportedCities: method.supportedCities,
      isExpress: method.isExpress,
      isActive: method.isActive,
      sortOrder: method.sortOrder,
    });
    setCitiesInput(method.supportedCities.join('، '));
    setFormErrors({});
    setServerError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const parsedCities = citiesInput
      .split(/[،,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    const cleaned: ShippingMethodInput = {
      code: toEnglishDigits(form.code).trim(),
      nameFa: form.nameFa.trim(),
      carrier: form.carrier.trim() || 'post_pishtaz',
      descriptionFa: (form.descriptionFa || '').trim(),
      baseCostToman: Math.max(0, Number(form.baseCostToman) || 0),
      freeAboveToman:
        form.freeAboveToman !== null && form.freeAboveToman !== undefined
          ? Math.max(0, Number(form.freeAboveToman) || 0)
          : null,
      estimatedDays: (form.estimatedDays || '').trim() || '۲ تا ۴ روز کاری',
      supportedCities: parsedCities,
      isExpress: Boolean(form.isExpress),
      isActive: Boolean(form.isActive),
      sortOrder: Math.trunc(Number(form.sortOrder) || 10),
    };

    const validation = validateShippingMethodInput(cleaned);
    if (Object.keys(validation).length > 0) {
      setFormErrors(validation);
      return;
    }

    setFormErrors({});
    setServerError(null);
    setSaving(true);
    try {
      await adminApi.saveShippingMethod(cleaned, editingId ?? undefined);
      pushToast({
        tone: 'success',
        title: editingId ? 'روش ارسال ویرایش شد' : 'روش ارسال جدید ثبت شد',
        description: cleaned.nameFa,
      });
      setModalOpen(false);
      await loadMethods();
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'خطا در ذخیره روش ارسال.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminApi.deleteShippingMethod(deleteTarget.id);
      pushToast({
        tone: 'success',
        title: 'روش ارسال حذف شد',
        description: deleteTarget.nameFa,
      });
      setDeleteTarget(null);
      await loadMethods();
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'خطا در حذف روش ارسال',
        description: err instanceof ApiError ? err.message : 'امکان حذف روش ارسال وجود ندارد.',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#111315]">روش‌های ارسال و تعرفه حمل‌ونقل</h2>
          <p className="mt-0.5 text-xs text-[#52565e]">
            تعریف پیک اکسپرس، پست پیشتاز، سقف ارسال رایگان و شهرهای تحت پوشش
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadMethods()}
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
            افزودن روش ارسال
          </Button>
        </div>
      </div>

      <Card padding="md">
        {loading ? (
          <LoadingSkeleton rows={4} />
        ) : unsupported ? (
          <EndpointUnsupportedState
            title="مدیریت روش‌های ارسال در سرور API هنوز فعال نشده است"
            description="برای پیکربندی پویا و شهرمحور روش‌های ارسال و ارسال رایگان، مسیرهای Shipping Methods را در سرور بک‌اند پیاده‌سازی کنید."
            endpointHint="GET /api/admin/shipping-methods | POST /api/admin/shipping-methods"
            onRetry={() => void loadMethods()}
          />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void loadMethods()} />
        ) : methods.length === 0 ? (
          <EmptyState
            title="روش ارسالی ثبت نشده است"
            description="اولین روش ارسال فروشگاه را تعریف کنید."
            icon={<Truck className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-black/[0.08] text-xs font-medium text-[#52565e]">
                  <th className="py-3 px-3">عنوان و کد</th>
                  <th className="py-3 px-3">تعرفه پایه</th>
                  <th className="py-3 px-3">ارسال رایگان بالای</th>
                  <th className="py-3 px-3">زمان تحویل</th>
                  <th className="py-3 px-3">شهرهای پوشش</th>
                  <th className="py-3 px-3">وضعیت</th>
                  <th className="py-3 px-3 text-left">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06] text-xs">
                {methods.map((method) => (
                  <tr key={method.id} className="hover:bg-[#f7f8fa] transition-colors duration-150">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#111315]">{method.nameFa}</span>
                        {method.isExpress && <StatusTag tone="info">اکسپرس</StatusTag>}
                      </div>
                      <p className="text-[11px] font-mono text-[#52565e] mt-0.5" dir="ltr">
                        {method.code} · {method.carrier}
                      </p>
                    </td>
                    <td className="py-3 px-3 font-medium text-[#111315] tabular-nums-fa whitespace-nowrap">
                      {method.baseCostToman > 0 ? formatToman(method.baseCostToman) : 'رایگان'}
                    </td>
                    <td className="py-3 px-3 text-[#52565e] tabular-nums-fa whitespace-nowrap">
                      {method.freeAboveToman && method.freeAboveToman > 0
                        ? formatToman(method.freeAboveToman)
                        : '—'}
                    </td>
                    <td className="py-3 px-3 text-[#111315] whitespace-nowrap">
                      {toPersianDigits(method.estimatedDays)}
                    </td>
                    <td className="py-3 px-3 text-[#52565e] max-w-xs truncate">
                      {method.supportedCities.length > 0
                        ? method.supportedCities.join('، ')
                        : 'سراسر کشور'}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <StatusTag tone={method.isActive ? 'success' : 'neutral'}>
                        {method.isActive ? 'فعال' : 'غیرفعال'}
                      </StatusTag>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-left">
                      <div className="inline-flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => openEditModal(method)}
                          icon={<Edit3 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
                        >
                          ویرایش
                        </Button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(method)}
                          aria-label={`حذف روش ارسال ${method.nameFa}`}
                          className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-[#52565e] hover:bg-[#fef3f2] hover:text-[#b42318] transition-colors duration-150"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                        </button>
                      </div>
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
        title={editingId ? 'ویرایش روش ارسال' : 'افزودن روش ارسال جدید'}
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
            <Button type="submit" form="shipping-form" variant="primary" loading={saving}>
              ذخیره روش ارسال
            </Button>
          </>
        }
      >
        <form id="shipping-form" onSubmit={handleSave} className="space-y-4">
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
              <label htmlFor="ship-code" className="block text-xs font-medium text-[#111315] mb-1.5">
                کد سیستمی *
              </label>
              <input
                id="ship-code"
                type="text"
                dir="ltr"
                disabled={Boolean(editingId)}
                value={form.code}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                placeholder="express_tehran"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] font-mono text-xs text-[#111315] disabled:bg-[#f6f6f7] focus:outline-none focus:border-[#0f49bd]"
              />
              {formErrors.code && (
                <p className="mt-1 text-xs text-[#b42318]">{formErrors.code}</p>
              )}
            </div>

            <div>
              <label htmlFor="ship-name" className="block text-xs font-medium text-[#111315] mb-1.5">
                عنوان فارسی *
              </label>
              <input
                id="ship-name"
                type="text"
                value={form.nameFa}
                onChange={(e) => setForm((p) => ({ ...p, nameFa: e.target.value }))}
                placeholder="ارسال اکسپرس تهران"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
              {formErrors.nameFa && (
                <p className="mt-1 text-xs text-[#b42318]">{formErrors.nameFa}</p>
              )}
            </div>

            <div>
              <label htmlFor="ship-carrier" className="block text-xs font-medium text-[#111315] mb-1.5">
                ناوگان / حامل
              </label>
              <input
                id="ship-carrier"
                type="text"
                dir="ltr"
                value={form.carrier}
                onChange={(e) => setForm((p) => ({ ...p, carrier: e.target.value }))}
                placeholder="amir_courier / post_pishtaz"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] font-mono text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <div>
              <label htmlFor="ship-days" className="block text-xs font-medium text-[#111315] mb-1.5">
                زمان تخمینی تحویل
              </label>
              <input
                id="ship-days"
                type="text"
                value={form.estimatedDays || ''}
                onChange={(e) => setForm((p) => ({ ...p, estimatedDays: e.target.value }))}
                placeholder="تحویل همان‌روز"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <div>
              <label htmlFor="ship-cost" className="block text-xs font-medium text-[#111315] mb-1.5">
                هزینه پایه (تومان)
              </label>
              <input
                id="ship-cost"
                type="number"
                min={0}
                dir="ltr"
                value={form.baseCostToman}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    baseCostToman: Math.max(0, Number(toEnglishDigits(e.target.value)) || 0),
                  }))
                }
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] tabular-nums-fa focus:outline-none focus:border-[#0f49bd]"
              />
              {formErrors.baseCostToman && (
                <p className="mt-1 text-xs text-[#b42318]">{formErrors.baseCostToman}</p>
              )}
            </div>

            <div>
              <label htmlFor="ship-free" className="block text-xs font-medium text-[#111315] mb-1.5">
                ارسال رایگان برای خرید بالای (تومان)
              </label>
              <input
                id="ship-free"
                type="number"
                min={0}
                dir="ltr"
                value={form.freeAboveToman ?? ''}
                onChange={(e) => {
                  const raw = toEnglishDigits(e.target.value).trim();
                  setForm((p) => ({ ...p, freeAboveToman: raw ? Number(raw) : null }));
                }}
                placeholder="اختیاری"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] tabular-nums-fa focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="ship-cities" className="block text-xs font-medium text-[#111315] mb-1.5">
                شهرهای تحت پوشش (با کاما یا ویرگول جدا کنید — خالی = سراسر کشور)
              </label>
              <input
                id="ship-cities"
                type="text"
                value={citiesInput}
                onChange={(e) => setCitiesInput(e.target.value)}
                placeholder="تهران، کرج"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <div>
              <label htmlFor="ship-order" className="block text-xs font-medium text-[#111315] mb-1.5">
                ترتیب نمایش
              </label>
              <input
                id="ship-order"
                type="number"
                dir="ltr"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm((p) => ({ ...p, sortOrder: Number(e.target.value) || 0 }))
                }
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] tabular-nums-fa focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <div className="flex flex-col justify-end gap-2">
              <SwitchToggle
                id="ship-express"
                checked={form.isExpress}
                onChange={(val) => setForm((p) => ({ ...p, isExpress: val }))}
                label="ارسال فوری (اکسپرس)"
              />
              <SwitchToggle
                id="ship-active"
                checked={form.isActive}
                onChange={(val) => setForm((p) => ({ ...p, isActive: val }))}
                label="روش ارسال فعال باشد"
              />
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
        loading={deleting}
        title="حذف روش ارسال"
        description={`آیا از حذف روش ارسال «${deleteTarget?.nameFa || ''}» اطمینان دارید؟`}
        confirmLabel="حذف روش ارسال"
      />
    </div>
  );
}
