import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Edit3, ExternalLink, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import type { WarrantyInput, WarrantyItem } from '../../types/admin';
import { adminApi } from '../../services/adminApi';
import { ApiError } from '../../services/apiClient';
import { useToast } from '../../context/ToastContext';
import {
  toEnglishDigits,
  toPersianDigits,
  validateWarrantyInput,
} from '../../utils/formatters';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { StatusTag } from '../ui/StatusBadge';
import { SwitchToggle } from '../ui/SwitchToggle';
import { EmptyState, ErrorState, LoadingSkeleton } from '../ui/StateViews';

const EMPTY_WARRANTY: WarrantyInput = {
  code: '',
  providerName: '',
  durationMonths: 18,
  coverageFa: '',
  termsUrl: '',
  isActive: true,
};

export function WarrantiesTab() {
  const { pushToast } = useToast();

  const [warranties, setWarranties] = useState<WarrantyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<WarrantyInput>(EMPTY_WARRANTY);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<WarrantyItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadWarranties = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listWarranties();
      setWarranties(Array.isArray(res.warranties) ? res.warranties : []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'خطا در دریافت لیست شرکت‌های گارانتی.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWarranties();
  }, [loadWarranties]);

  const openCreateModal = () => {
    setEditingId(null);
    setForm(EMPTY_WARRANTY);
    setFormErrors({});
    setServerError(null);
    setModalOpen(true);
  };

  const openEditModal = (warranty: WarrantyItem) => {
    setEditingId(warranty.id);
    setForm({
      code: warranty.code || '',
      providerName: warranty.providerName,
      durationMonths: warranty.durationMonths,
      coverageFa: warranty.coverageFa,
      termsUrl: warranty.termsUrl || '',
      isActive: warranty.isActive,
    });
    setFormErrors({});
    setServerError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const cleaned: WarrantyInput = {
      code: form.code?.trim() ? form.code.trim().toUpperCase() : null,
      providerName: form.providerName.trim(),
      durationMonths: Math.max(0, Math.floor(Number(form.durationMonths) || 0)),
      coverageFa: form.coverageFa.trim(),
      termsUrl: form.termsUrl?.trim() ? form.termsUrl.trim() : null,
      isActive: Boolean(form.isActive),
    };

    const validation = validateWarrantyInput(cleaned);
    if (Object.keys(validation).length > 0) {
      setFormErrors(validation);
      return;
    }

    setFormErrors({});
    setServerError(null);
    setSaving(true);
    try {
      if (editingId) {
        await adminApi.updateWarranty(editingId, cleaned);
        pushToast({
          tone: 'success',
          title: 'گارانتی ویرایش شد',
          description: cleaned.providerName,
        });
      } else {
        await adminApi.createWarranty(cleaned);
        pushToast({
          tone: 'success',
          title: 'شرکت گارانتی جدید ثبت شد',
          description: cleaned.providerName,
        });
      }
      setModalOpen(false);
      await loadWarranties();
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'خطا در ذخیره گارانتی.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await adminApi.deleteWarranty(deleteTarget.id);
      pushToast({
        tone: 'success',
        title: 'گارانتی حذف شد',
        description: deleteTarget.providerName,
      });
      setDeleteTarget(null);
      await loadWarranties();
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'خطا در حذف گارانتی',
        description: err instanceof ApiError ? err.message : 'امکان حذف این گارانتی وجود ندارد.',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[#52565e]">
          تعریف شرکت‌های گارانتی رسمی، مدت اعتبار و شرح پوشش جهت اتصال به تنوع‌های کالا
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadWarranties()}
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
            افزودن گارانتی
          </Button>
        </div>
      </div>

      <Card padding="md">
        {loading ? (
          <LoadingSkeleton rows={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void loadWarranties()} />
        ) : warranties.length === 0 ? (
          <EmptyState
            title="هنوز گارانتی ثبت نشده است"
            description="برای انتخاب در تنوع‌های محصولات، شرکت‌های گارانتی را اضافه کنید."
            icon={<ShieldCheck className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />}
            action={
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={openCreateModal}
                icon={<Plus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
              >
                ثبت اولین گارانتی
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="border-b border-black/[0.08] text-xs font-medium text-[#52565e]">
                  <th className="py-3 px-3">کد سیستمی</th>
                  <th className="py-3 px-3">نام ارائه‌دهنده گارانتی</th>
                  <th className="py-3 px-3">مدت اعتبار</th>
                  <th className="py-3 px-3">شرح پوشش گارانتی</th>
                  <th className="py-3 px-3">شرایط</th>
                  <th className="py-3 px-3">وضعیت</th>
                  <th className="py-3 px-3 text-left">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.06] text-xs">
                {warranties.map((w) => (
                  <tr key={w.id} className="hover:bg-[#f7f8fa] transition-colors duration-150">
                    <td className="py-3 px-3 font-mono text-[#0f49bd]" dir="ltr">
                      {w.code || '—'}
                    </td>
                    <td className="py-3 px-3 font-semibold text-[#111315]">{w.providerName}</td>
                    <td className="py-3 px-3 whitespace-nowrap font-medium text-[#0f49bd] tabular-nums-fa">
                      {toPersianDigits(w.durationMonths)} ماه
                    </td>
                    <td className="py-3 px-3 text-[#52565e] max-w-md leading-5">
                      {w.coverageFa || '—'}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {w.termsUrl ? (
                        <a
                          href={w.termsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#0f49bd] hover:underline"
                        >
                          <span>مشاهده قوانین</span>
                          <ExternalLink className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />
                        </a>
                      ) : (
                        <span className="text-[#7c818c]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {w.isActive ? (
                        <StatusTag tone="success">فعال</StatusTag>
                      ) : (
                        <StatusTag tone="neutral">غیرفعال</StatusTag>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-left">
                      <div className="inline-flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => openEditModal(w)}
                          aria-label={`ویرایش گارانتی ${w.providerName}`}
                          icon={<Edit3 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
                        >
                          ویرایش
                        </Button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(w)}
                          aria-label={`حذف گارانتی ${w.providerName}`}
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
        title={editingId ? 'ویرایش شرکت گارانتی' : 'افزودن گارانتی جدید'}
        subtitle="مشخصات ارائه‌دهنده، مدت پوشش و لینک شرایط گارانتی"
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
            <Button type="submit" form="warranty-form" variant="primary" loading={saving}>
              {editingId ? 'ذخیره تغییرات' : 'ثبت گارانتی'}
            </Button>
          </>
        }
      >
        <form id="warranty-form" onSubmit={handleSave} className="space-y-4">
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
              <label htmlFor="war-code" className="block text-xs font-medium text-[#111315] mb-1.5">
                کد سیستمی گارانتی (اختیاری)
              </label>
              <input
                id="war-code"
                type="text"
                dir="ltr"
                value={form.code || ''}
                onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                placeholder="WAR-AMIR-18M"
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] font-mono text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
              {formErrors.code && (
                <p className="mt-1 text-xs text-[#b42318]">{formErrors.code}</p>
              )}
            </div>

            <div>
              <label htmlFor="war-duration" className="block text-xs font-medium text-[#111315] mb-1.5">
                مدت گارانتی (ماه) *
              </label>
              <input
                id="war-duration"
                type="number"
                min={0}
                max={120}
                dir="ltr"
                value={form.durationMonths}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    durationMonths: Math.max(0, Math.floor(Number(toEnglishDigits(e.target.value)) || 0)),
                  }))
                }
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] tabular-nums-fa focus:outline-none focus:border-[#0f49bd]"
              />
              {formErrors.durationMonths && (
                <p className="mt-1 text-xs text-[#b42318]">{formErrors.durationMonths}</p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="war-provider" className="block text-xs font-medium text-[#111315] mb-1.5">
              نام ارائه‌دهنده گارانتی *
            </label>
            <input
              id="war-provider"
              type="text"
              value={form.providerName}
              onChange={(e) => setForm((p) => ({ ...p, providerName: e.target.value }))}
              placeholder="۱۸ ماهه جامع امیر سرویس + کد همتا"
              className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
            />
            {formErrors.providerName && (
              <p className="mt-1 text-xs text-[#b42318]">{formErrors.providerName}</p>
            )}
          </div>

          <div>
            <label htmlFor="war-coverage" className="block text-xs font-medium text-[#111315] mb-1.5">
              شرح پوشش گارانتی به فارسی
            </label>
            <textarea
              id="war-coverage"
              rows={3}
              value={form.coverageFa}
              onChange={(e) => setForm((p) => ({ ...p, coverageFa: e.target.value }))}
              placeholder="شامل پوشش سخت‌افزار، تعویض قطعات اصلی، رجیستری همتا و پشتیبانی فنی"
              className="w-full p-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
            />
          </div>

          <div>
            <label htmlFor="war-terms" className="block text-xs font-medium text-[#111315] mb-1.5">
              لینک شرایط و قوانین (اختیاری)
            </label>
            <input
              id="war-terms"
              type="url"
              dir="ltr"
              value={form.termsUrl || ''}
              onChange={(e) => setForm((p) => ({ ...p, termsUrl: e.target.value }))}
              placeholder="https://example.com/warranty-terms"
              className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
            />
          </div>

          <div className="pt-2 border-t border-black/[0.06]">
            <SwitchToggle
              id="war-active"
              checked={form.isActive}
              onChange={(val) => setForm((p) => ({ ...p, isActive: val }))}
              label="گارانتی فعال"
            />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleConfirmDelete()}
        loading={deleting}
        title="حذف شرکت گارانتی"
        description={`آیا از حذف «${deleteTarget?.providerName || ''}» اطمینان دارید؟`}
        confirmLabel="حذف گارانتی"
      />
    </div>
  );
}
