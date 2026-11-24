import { useCallback, useEffect, useState } from 'react';
import { Lock, RefreshCw, ShieldCheck } from 'lucide-react';
import type { RbacRole } from '../../types/admin';
import { adminApi } from '../../services/adminApi';
import { ApiError, isEndpointUnsupportedError } from '../../services/apiClient';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { StatusTag } from '../ui/StatusBadge';
import { EmptyState, EndpointUnsupportedState, ErrorState, LoadingSkeleton } from '../ui/StateViews';

export function RbacRolesPanel() {
  const [roles, setRoles] = useState<RbacRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);

  const loadRoles = useCallback(async () => {
    setLoading(true);
    setError(null);
    setUnsupported(false);
    try {
      const res = await adminApi.listRoles();
      setRoles(Array.isArray(res.roles) ? res.roles : []);
    } catch (err) {
      if (isEndpointUnsupportedError(err)) {
        setUnsupported(true);
      } else {
        setError(err instanceof ApiError ? err.message : 'خطا در دریافت نقش‌های سیستمی.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  return (
    <Card padding="lg">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-black/[0.06]">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-4 w-4 text-[#52565e]" strokeWidth={1.5} aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-[#111315]">نقش‌های سیستمی و دسترسی</h2>
            <p className="text-[11px] text-[#52565e] mt-0.5">
              فهرست خواندنی سطوح دسترسی تعریف‌شده در سامانه احراز هویت و مجوزها
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void loadRoles()}
          icon={<RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
        >
          به‌روزرسانی
        </Button>
      </div>

      <div className="mb-4 p-3 rounded-lg bg-[#f6f6f7] border border-black/[0.08] text-[11px] leading-5 text-[#52565e]">
        کنترل دسترسی فعال Backend در نسخه فعلی بر پایه نقش‌های <span className="font-mono text-[#111315]" dir="ltr">admin</span> و{' '}
        <span className="font-mono text-[#111315]" dir="ltr">customer</span> اعمال می‌شود؛ نقش‌های تفکیک‌شده تا زمان تأیید و فعال‌سازی در سرور صرفاً نمایشی/فهرست خواندنی هستند.
      </div>

      {loading ? (
        <LoadingSkeleton rows={3} />
      ) : unsupported ? (
        <EndpointUnsupportedState
          title="فهرست نقش‌های تفکیک‌شده در Backend فعال نشده است"
          description="در حال حاضر دسترسی مدیریت صرفاً بر اساس نقش admin در سرور کنترل می‌شود و Endpoint خواندن نقش‌های تفکیک‌شده هنوز پاسخ ۴۰۴/۵۰۱ می‌دهد."
          endpointHint="GET /api/admin/roles"
          onRetry={() => void loadRoles()}
        />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadRoles()} />
      ) : roles.length === 0 ? (
        <EmptyState
          title="نقش سیستمی یافت نشد"
          description="هیچ نقش دسترسی از سرور دریافت نشد."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="border-b border-black/[0.08] text-xs font-medium text-[#52565e]">
                <th className="py-2.5 px-3">شناسه سیستمی</th>
                <th className="py-2.5 px-3">عنوان فارسی</th>
                <th className="py-2.5 px-3">توضیحات دسترسی</th>
                <th className="py-2.5 px-3">نوع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06] text-xs">
              {roles.map((role) => (
                <tr key={role.id} className="hover:bg-[#f7f8fa] transition-colors duration-150">
                  <td className="py-3 px-3 font-mono font-medium text-[#111315]" dir="ltr">
                    {role.name || role.id}
                  </td>
                  <td className="py-3 px-3 font-semibold text-[#111315] whitespace-nowrap">
                    {role.titleFa || role.name}
                  </td>
                  <td className="py-3 px-3 text-[#52565e] leading-5">
                    {role.description || '—'}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    {role.isSystem ? (
                      <StatusTag tone="info" icon={<Lock className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />}>
                        نقش سیستمی
                      </StatusTag>
                    ) : (
                      <StatusTag tone="neutral">سفارشی</StatusTag>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
