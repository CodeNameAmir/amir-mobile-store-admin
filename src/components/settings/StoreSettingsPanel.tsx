import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Plus, RefreshCw, Save, Store, Trash2 } from 'lucide-react';
import { adminApi } from '../../services/adminApi';
import { ApiError, isEndpointUnsupportedError } from '../../services/apiClient';
import { useToast } from '../../context/ToastContext';
import { formatToman, toEnglishDigits } from '../../utils/formatters';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { EndpointUnsupportedState, ErrorState, LoadingSkeleton } from '../ui/StateViews';

const KNOWN_KEYS = new Set([
  'announcement_text',
  'free_shipping_threshold',
  'support_phone',
]);

interface ExtraSettingRow {
  key: string;
  rawValue: string;
}

function serializeSettingValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function parseSettingRawValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (
    trimmed === 'true' ||
    trimmed === 'false' ||
    trimmed === 'null' ||
    /^-?\d+(\.\d+)?$/.test(trimmed) ||
    trimmed.startsWith('{') ||
    trimmed.startsWith('[') ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

export function StoreSettingsPanel() {
  const { pushToast } = useToast();

  const [announcementText, setAnnouncementText] = useState('');
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(5_000_000);
  const [supportPhone, setSupportPhone] = useState('');
  const [extraRows, setExtraRows] = useState<ExtraSettingRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const [saving, setSaving] = useState(false);

  const applySettings = useCallback((entries: Array<{ key: string; value: unknown }>) => {
    const map = new Map(entries.map((e) => [e.key, e.value]));
    const ann = map.get('announcement_text');
    const ship = map.get('free_shipping_threshold');
    const phone = map.get('support_phone');

    setAnnouncementText(typeof ann === 'string' ? ann : ann ? String(ann) : '');
    const parsedShip = Number(ship);
    setFreeShippingThreshold(Number.isFinite(parsedShip) && parsedShip >= 0 ? parsedShip : 5_000_000);
    setSupportPhone(typeof phone === 'string' ? phone : phone ? String(phone) : '');

    const extras: ExtraSettingRow[] = entries
      .filter((entry) => !KNOWN_KEYS.has(entry.key))
      .map((entry) => ({
        key: entry.key,
        rawValue: serializeSettingValue(entry.value),
      }));
    setExtraRows(extras);
  }, []);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUnsupported(false);
    try {
      const res = await adminApi.listStoreSettings();
      applySettings(res.settings);
    } catch (err) {
      if (isEndpointUnsupportedError(err)) {
        setUnsupported(true);
      } else {
        setError(err instanceof ApiError ? err.message : 'خطا در دریافت تنظیمات عمومی فروشگاه.');
      }
    } finally {
      setLoading(false);
    }
  }, [applySettings]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const addExtraRow = () => {
    setExtraRows((prev) => [...prev, { key: '', rawValue: '' }]);
  };

  const updateExtraRow = (idx: number, patch: Partial<ExtraSettingRow>) => {
    setExtraRows((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const removeExtraRow = (idx: number) => {
    setExtraRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    const payload: Array<{ key: string; value: unknown }> = [
      { key: 'announcement_text', value: announcementText.trim() },
      { key: 'free_shipping_threshold', value: Math.max(0, Math.round(freeShippingThreshold)) },
      { key: 'support_phone', value: toEnglishDigits(supportPhone).trim() },
    ];

    for (const row of extraRows) {
      const cleanKey = row.key.trim();
      if (!cleanKey || KNOWN_KEYS.has(cleanKey)) continue;
      payload.push({
        key: cleanKey,
        value: parseSettingRawValue(row.rawValue),
      });
    }

    setSaving(true);
    try {
      const res = await adminApi.saveStoreSettings(payload);
      applySettings(res.settings);
      pushToast({
        tone: 'success',
        title: 'تنظیمات عمومی فروشگاه ذخیره شد',
      });
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'خطا در ذخیره تنظیمات فروشگاه',
        description: err instanceof ApiError ? err.message : 'لطفاً دوباره تلاش کنید.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card padding="lg">
        <LoadingSkeleton rows={5} />
      </Card>
    );
  }

  if (unsupported) {
    return (
      <Card padding="lg">
        <EndpointUnsupportedState
          title="تنظیمات عمومی فروشگاه در سرور API هنوز فعال نشده است"
          description="فرم تنظیمات سراسری ویترین (store_settings) آماده است، اما Endpoint متناظر آن هنوز در Backend فعال نشده است."
          endpointHint="GET /api/admin/store-settings"
          onRetry={() => void loadSettings()}
        />
      </Card>
    );
  }

  if (error) {
    return (
      <Card padding="lg">
        <ErrorState message={error} onRetry={() => void loadSettings()} />
      </Card>
    );
  }

  return (
    <Card padding="lg">
      <form onSubmit={handleSave} className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-black/[0.06]">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-[#52565e]" strokeWidth={1.5} aria-hidden="true" />
            <div>
              <h2 className="text-sm font-semibold text-[#111315]">
                پیکربندی عمومی ویترین فروشگاه (store_settings)
              </h2>
              <p className="mt-0.5 text-xs text-[#52565e]">
                اطلاعیه سراسری هدر، سقف ارسال رایگان و اطلاعات تماس نمایش‌داده‌شده در سایت
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadSettings()}
            icon={<RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
          >
            بارگذاری مجدد
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="ss-announcement" className="block text-xs font-medium text-[#111315] mb-1.5">
              متن نوار اطلاع‌رسانی بالای سایت (announcement_text)
            </label>
            <input
              id="ss-announcement"
              type="text"
              value={announcementText}
              onChange={(e) => setAnnouncementText(e.target.value)}
              placeholder="مثال: ارسال رایگان برای سفارش‌های بالای ۵ میلیون تومان · گارانتی اصالت کالا"
              className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
            />
          </div>

          <div>
            <label htmlFor="ss-shipping-threshold" className="block text-xs font-medium text-[#111315] mb-1.5">
              آستانه ارسال رایگان به تومان (free_shipping_threshold)
            </label>
            <input
              id="ss-shipping-threshold"
              type="number"
              min={0}
              dir="ltr"
              value={freeShippingThreshold}
              onChange={(e) =>
                setFreeShippingThreshold(Math.max(0, Number(toEnglishDigits(e.target.value)) || 0))
              }
              className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-xs font-semibold text-[#111315] tabular-nums-fa focus:outline-none focus:border-[#0f49bd]"
            />
            <p className="mt-1 text-[11px] text-[#0f49bd] tabular-nums-fa">
              {freeShippingThreshold > 0 ? formatToman(freeShippingThreshold) : 'ارسال رایگان برای همه سفارش‌ها'}
            </p>
          </div>

          <div>
            <label htmlFor="ss-support-phone" className="block text-xs font-medium text-[#111315] mb-1.5">
              شماره تماس پشتیبانی فروشگاه (support_phone)
            </label>
            <input
              id="ss-support-phone"
              type="text"
              dir="ltr"
              value={supportPhone}
              onChange={(e) => setSupportPhone(e.target.value)}
              placeholder="021-88990011"
              className="w-full h-9 px-3 rounded-lg border border-black/[0.14] font-mono text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-black/[0.06] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-xs font-semibold text-[#111315]">کلیدهای سفارشی دیگر</h3>
              <p className="text-[11px] text-[#52565e]">
                سایر تنظیمات JSONB ذخیره‌شده در جدول store_settings
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addExtraRow}
              icon={<Plus className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
            >
              افزودن کلید جدید
            </Button>
          </div>

          {extraRows.length > 0 && (
            <div className="space-y-2">
              {extraRows.map((row, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 items-center gap-2.5 p-2.5 rounded-xl bg-[#f6f6f7] border border-black/[0.06]"
                >
                  <div className="col-span-12 sm:col-span-4">
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="key_name"
                      value={row.key}
                      onChange={(e) => updateExtraRow(idx, { key: e.target.value })}
                      className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white font-mono text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
                    />
                  </div>
                  <div className="col-span-10 sm:col-span-7">
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="مقدار متنی یا JSON"
                      value={row.rawValue}
                      onChange={(e) => updateExtraRow(idx, { rawValue: e.target.value })}
                      className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white font-mono text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeExtraRow(idx)}
                      aria-label="حذف کلید تنظیم"
                      className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-[#b42318] hover:bg-[#fef3f2] transition-colors duration-150"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-2 flex justify-end">
          <Button
            type="submit"
            variant="primary"
            loading={saving}
            icon={<Save className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
          >
            ذخیره تنظیمات فروشگاه
          </Button>
        </div>
      </form>
    </Card>
  );
}
