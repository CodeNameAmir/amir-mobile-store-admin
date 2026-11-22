import { useCallback, useEffect, useState } from 'react';
import { Save, SlidersHorizontal } from 'lucide-react';
import type {
  ProductAttributeValue,
  ProductAttributeValueInput,
  TechnicalAttribute,
} from '../../types/admin';
import { adminApi } from '../../services/adminApi';
import { ApiError } from '../../services/apiClient';
import { useToast } from '../../context/ToastContext';
import { toEnglishDigits } from '../../utils/formatters';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { EmptyState, ErrorState, LoadingSkeleton } from '../ui/StateViews';

interface DraftAttributeState {
  valueText: string;
  valueNumber: string;
  valueBoolean: 'unset' | 'true' | 'false';
}

interface ProductAttributesSectionProps {
  productId: string;
  categorySlug: string;
  initialValues?: ProductAttributeValue[];
}

export function ProductAttributesSection({
  productId,
  categorySlug,
  initialValues,
}: ProductAttributesSectionProps) {
  const { pushToast } = useToast();

  const [attributes, setAttributes] = useState<TechnicalAttribute[]>([]);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, DraftAttributeState>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const hydrateDrafts = useCallback(
    (attrs: TechnicalAttribute[], values?: ProductAttributeValue[]) => {
      const valueByAttrId = new Map<string, ProductAttributeValue>();
      for (const v of values ?? []) {
        valueByAttrId.set(v.attributeId, v);
      }

      const next: Record<string, DraftAttributeState> = {};
      for (const attr of attrs) {
        const existing = valueByAttrId.get(attr.id);
        next[attr.id] = {
          valueText: existing?.valueText ?? '',
          valueNumber:
            existing?.valueNumber !== null && existing?.valueNumber !== undefined
              ? String(existing.valueNumber)
              : '',
          valueBoolean:
            existing?.valueBoolean === true
              ? 'true'
              : existing?.valueBoolean === false
                ? 'false'
                : 'unset',
        };
      }
      setDrafts(next);
    },
    []
  );

  const loadAttributes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listAttributes(showAllCategories ? undefined : categorySlug);
      const list = Array.isArray(res.attributes) ? res.attributes : [];
      setAttributes(list);
      hydrateDrafts(list, initialValues);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'خطا در بارگذاری ویژگی‌های فنی استاندارد.');
    } finally {
      setLoading(false);
    }
  }, [categorySlug, showAllCategories, hydrateDrafts, initialValues]);

  useEffect(() => {
    void loadAttributes();
  }, [loadAttributes]);

  const updateDraft = (attrId: string, patch: Partial<DraftAttributeState>) => {
    setDrafts((prev) => ({
      ...prev,
      [attrId]: {
        valueText: prev[attrId]?.valueText ?? '',
        valueNumber: prev[attrId]?.valueNumber ?? '',
        valueBoolean: prev[attrId]?.valueBoolean ?? 'unset',
        ...patch,
      },
    }));
  };

  const handleSaveAttributes = async () => {
    const values: ProductAttributeValueInput[] = attributes.map((attr) => {
      const d = drafts[attr.id] || {
        valueText: '',
        valueNumber: '',
        valueBoolean: 'unset',
      };
      if (attr.dataType === 'number') {
        const cleaned = toEnglishDigits(d.valueNumber).trim();
        const parsed = cleaned !== '' ? Number(cleaned) : null;
        return {
          attributeId: attr.id,
          valueNumber: parsed !== null && Number.isFinite(parsed) ? parsed : null,
        };
      }
      if (attr.dataType === 'boolean') {
        return {
          attributeId: attr.id,
          valueBoolean:
            d.valueBoolean === 'true' ? true : d.valueBoolean === 'false' ? false : null,
        };
      }
      const textVal = d.valueText.trim();
      return {
        attributeId: attr.id,
        valueText: textVal ? textVal : null,
      };
    });

    setSaving(true);
    try {
      const res = await adminApi.updateProductAttributes(productId, values);
      hydrateDrafts(attributes, res.attributeValues.length > 0 ? res.attributeValues : initialValues);
      pushToast({
        tone: 'success',
        title: 'ویژگی‌های فنی استاندارد ذخیره شد',
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'خطا در ذخیره ویژگی‌های فنی',
        description: err instanceof ApiError ? err.message : 'لطفاً دوباره تلاش کنید.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card padding="lg">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-black/[0.06]">
        <div>
          <h2 className="text-sm font-semibold text-[#111315]">
            ویژگی‌های فنی استاندارد
          </h2>
          <p className="mt-0.5 text-xs text-[#52565e]">
            مقداردهی فیلدهای استاندارد جهت فیلتر و مقایسه دقیق در فروشگاه
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-1.5 text-xs text-[#52565e] cursor-pointer">
            <input
              type="checkbox"
              checked={showAllCategories}
              onChange={(e) => setShowAllCategories(e.target.checked)}
              className="h-4 w-4 rounded border-black/[0.2] accent-[#0f49bd]"
            />
            <span>نمایش ویژگی‌های همه دسته‌ها</span>
          </label>
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={saving}
            disabled={loading || attributes.length === 0}
            onClick={() => void handleSaveAttributes()}
            icon={<Save className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
          >
            ذخیره ویژگی‌های فنی
          </Button>
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadAttributes()} />
      ) : attributes.length === 0 ? (
        <EmptyState
          title="ویژگی استاندارد فعالی برای این دسته‌بندی یافت نشد"
          description="می‌توانید از بخش «کاتالوگ و مشخصات پایه ← ویژگی‌های فنی استاندارد» ویژگی‌های جدید تعریف کنید."
          icon={<SlidersHorizontal className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {attributes.map((attr) => {
            const draft = drafts[attr.id] || {
              valueText: '',
              valueNumber: '',
              valueBoolean: 'unset',
            };
            const inputId = `eav-attr-${attr.id}`;

            return (
              <div
                key={attr.id}
                className="p-3.5 rounded-xl bg-[#f6f6f7] border border-black/[0.08] space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor={inputId} className="text-xs font-medium text-[#111315]">
                    {attr.nameFa}
                    {attr.unit ? ` (${attr.unit})` : ''}
                  </label>
                  <span className="text-[11px] font-mono text-[#7c818c]" dir="ltr">
                    {attr.code}
                  </span>
                </div>

                {attr.dataType === 'number' ? (
                  <div className="flex items-center gap-2">
                    <input
                      id={inputId}
                      type="number"
                      step="any"
                      dir="ltr"
                      value={draft.valueNumber}
                      onChange={(e) => updateDraft(attr.id, { valueNumber: e.target.value })}
                      placeholder="مقدار عددی"
                      className="flex-1 h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] tabular-nums-fa focus:outline-none focus:border-[#0f49bd]"
                    />
                    {attr.unit && (
                      <span className="text-[11px] text-[#52565e] shrink-0">{attr.unit}</span>
                    )}
                  </div>
                ) : attr.dataType === 'boolean' ? (
                  <select
                    id={inputId}
                    value={draft.valueBoolean}
                    onChange={(e) =>
                      updateDraft(attr.id, {
                        valueBoolean: e.target.value as 'unset' | 'true' | 'false',
                      })
                    }
                    className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
                  >
                    <option value="unset">تعیین‌نشده</option>
                    <option value="true">بله / دارد</option>
                    <option value="false">خیر / ندارد</option>
                  </select>
                ) : attr.dataType === 'select' && attr.options && attr.options.length > 0 ? (
                  <select
                    id={inputId}
                    value={draft.valueText}
                    onChange={(e) => updateDraft(attr.id, { valueText: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
                  >
                    <option value="">انتخاب کنید</option>
                    {attr.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={inputId}
                    type="text"
                    value={draft.valueText}
                    onChange={(e) => updateDraft(attr.id, { valueText: e.target.value })}
                    placeholder={attr.nameEn || 'مقدار متنی'}
                    className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
