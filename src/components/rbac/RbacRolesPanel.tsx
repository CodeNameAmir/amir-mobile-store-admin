import { useCallback, useEffect, useState } from 'react';
import { Edit3, Lock, RefreshCw, ShieldCheck } from 'lucide-react';
import type { RbacRole } from '../../types/admin';
import { adminApi } from '../../services/adminApi';
import { ApiError, isEndpointUnsupportedError } from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  PERMISSION_CATALOG,
  PERMISSION_LABEL_MAP,
  STANDARD_ROLE_TEMPLATES,
} from '../../utils/permissions';
import { toPersianDigits } from '../../utils/formatters';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { StatusTag } from '../ui/StatusBadge';
import { EmptyState, EndpointUnsupportedState, ErrorState, LoadingSkeleton } from '../ui/StateViews';

export function RbacRolesPanel() {
  const { hasGranularRbac, can } = useAuth();
  const { pushToast } = useToast();

  const [roles, setRoles] = useState<RbacRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);

  const [editingRole, setEditingRole] = useState<RbacRole | null>(null);
  const [draftPermissions, setDraftPermissions] = useState<string[]>([]);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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

  const canManageRoles = can('roles.manage');

  const openPermissionEditor = (role: RbacRole) => {
    const fallbackTemplate = STANDARD_ROLE_TEMPLATES[role.name]?.permissions ?? [];
    const current =
      Array.isArray(role.permissions) && role.permissions.length > 0
        ? role.permissions
        : fallbackTemplate;
    setEditingRole(role);
    setDraftPermissions([...current]);
    setEditError(null);
  };

  const togglePermission = (permCode: string) => {
    setDraftPermissions((prev) => {
      if (prev.includes('*')) {
        return prev.filter((p) => p !== '*' && p !== permCode);
      }
      return prev.includes(permCode)
        ? prev.filter((p) => p !== permCode)
        : [...prev, permCode];
    });
  };

  const handleSavePermissions = async () => {
    if (!editingRole) return;
    setSavingPermissions(true);
    setEditError(null);
    try {
      const res = await adminApi.updateRolePermissions(editingRole.id, draftPermissions);
      setRoles((prev) => prev.map((r) => (r.id === res.role.id ? res.role : r)));
      pushToast({
        tone: 'success',
        title: 'مجوزهای نقش به‌روزرسانی شد',
        description: editingRole.titleFa || editingRole.name,
      });
      setEditingRole(null);
    } catch (err) {
      if (isEndpointUnsupportedError(err)) {
        setEditError(
          'ذخیره پویای ماتریس مجوزها نیازمند پیاده‌سازی Endpoint PUT /api/admin/roles/:id/permissions در سرور API است.'
        );
      } else {
        setEditError(err instanceof ApiError ? err.message : 'خطا در ذخیره مجوزهای نقش.');
      }
    } finally {
      setSavingPermissions(false);
    }
  };

  const groupedCatalog = PERMISSION_CATALOG.reduce<Record<string, typeof PERMISSION_CATALOG>>(
    (acc, item) => {
      const group = acc[item.groupFa] ?? [];
      group.push(item);
      acc[item.groupFa] = group;
      return acc;
    },
    {}
  );

  return (
    <Card padding="lg">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-black/[0.06]">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-4 w-4 text-[#52565e]" strokeWidth={1.5} aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-[#111315]">نقش‌های سیستمی و ماتریس دسترسی (RBAC)</h2>
            <p className="text-[11px] text-[#52565e] mt-0.5">
              مدیریت سطوح دسترسی تفکیک‌شده (مدیر محصول، فروش، انبار، حسابدار، پشتیبانی و محتوا)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusTag tone={hasGranularRbac ? 'success' : 'warning'}>
            {hasGranularRbac ? 'RBAC تفکیک‌شده فعال در نشست' : 'حالت سازگار تک‌نقشی (Legacy Admin)'}
          </StatusTag>
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
      </div>

      {!hasGranularRbac && (
        <div className="mb-4 p-3 rounded-lg bg-[#fffbeb] border border-[#fde68a] text-[11px] leading-5 text-[#9a4a06]">
          در پاسخ فعلی <span className="font-mono" dir="ltr">/api/admin/me</span> آرایه مجوزهای تفکیک‌شده (<span className="font-mono" dir="ltr">permissions[]</span>) از سمت سرور ارسال نشده است. پس از اجرای Migration <span className="font-mono" dir="ltr">003_phase1_security_rbac_orders_inventory.sql</span> و بازگشت مجوزها از سرور، محدودیت دقیق هر نقش به‌صورت خودکار در رابط کاربری نیز اعمال می‌شود.
        </div>
      )}

      {loading ? (
        <LoadingSkeleton rows={3} />
      ) : unsupported ? (
        <EndpointUnsupportedState
          title="فهرست نقش‌های تفکیک‌شده در Backend فعال نشده است"
          description="برای فعال‌سازی کامل نقش‌های تفکیک‌شده، Migration شماره 003 را اجرا کرده و Endpointهای RBAC را در سرور API فعال کنید."
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
                <th className="py-2.5 px-3">توضیحات و مجوزها</th>
                <th className="py-2.5 px-3">نوع</th>
                {canManageRoles && <th className="py-2.5 px-3 text-left">عملیات</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06] text-xs">
              {roles.map((role) => {
                const effectivePerms =
                  role.permissions && role.permissions.length > 0
                    ? role.permissions
                    : STANDARD_ROLE_TEMPLATES[role.name]?.permissions ?? [];
                return (
                  <tr key={role.id} className="hover:bg-[#f7f8fa] transition-colors duration-150">
                    <td className="py-3 px-3 font-mono font-medium text-[#111315]" dir="ltr">
                      {role.name || role.id}
                    </td>
                    <td className="py-3 px-3 font-semibold text-[#111315] whitespace-nowrap">
                      {role.titleFa || role.name}
                      {role.usersCount !== undefined && (
                        <span className="block text-[11px] font-normal text-[#52565e] tabular-nums-fa">
                          {toPersianDigits(role.usersCount)} کاربر
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-[#52565e] leading-5 space-y-1.5">
                      <p>{role.description || '—'}</p>
                      {effectivePerms.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {effectivePerms.slice(0, 5).map((perm) => (
                            <span
                              key={perm}
                              className="px-1.5 py-0.5 rounded bg-[#f6f6f7] border border-black/[0.07] text-[10px] text-[#52565e]"
                            >
                              {perm === '*' ? 'دسترسی کامل (*)' : PERMISSION_LABEL_MAP[perm] || perm}
                            </span>
                          ))}
                          {effectivePerms.length > 5 && (
                            <span className="px-1.5 py-0.5 text-[10px] text-[#7c818c] tabular-nums-fa">
                              +{toPersianDigits(effectivePerms.length - 5)} مورد دیگر
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {role.isSystem ? (
                        <StatusTag
                          tone="info"
                          icon={<Lock className="h-3 w-3" strokeWidth={1.5} aria-hidden="true" />}
                        >
                          نقش سیستمی
                        </StatusTag>
                      ) : (
                        <StatusTag tone="neutral">سفارشی</StatusTag>
                      )}
                    </td>
                    {canManageRoles && (
                      <td className="py-3 px-3 whitespace-nowrap text-left">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => openPermissionEditor(role)}
                          icon={<Edit3 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
                        >
                          ماتریس مجوزها
                        </Button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={Boolean(editingRole)}
        onClose={() => setEditingRole(null)}
        title={editingRole ? `ماتریس مجوزهای نقش: ${editingRole.titleFa || editingRole.name}` : ''}
        subtitle={editingRole?.name}
        maxWidthClass="max-w-2xl"
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setEditingRole(null)} disabled={savingPermissions}>
              انصراف
            </Button>
            <Button
              type="button"
              variant="primary"
              loading={savingPermissions}
              onClick={() => void handleSavePermissions()}
            >
              ذخیره مجوزهای نقش
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {editError && (
            <div className="p-3 rounded-lg bg-[#fef3f2] border border-[#fecaca] text-xs text-[#b42318]">
              {editError}
            </div>
          )}

          <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#111315] cursor-pointer p-2.5 rounded-lg bg-[#f6f6f7] border border-black/[0.08] w-full">
            <input
              type="checkbox"
              checked={draftPermissions.includes('*')}
              onChange={(e) =>
                setDraftPermissions(e.target.checked ? ['*'] : [])
              }
              className="h-4 w-4 rounded border-black/[0.2] accent-[#0f49bd]"
            />
            <span>دسترسی کامل به تمام عملیات سامانه (Super Admin Wildcard)</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[55vh] overflow-y-auto pl-1">
            {Object.entries(groupedCatalog).map(([groupTitle, perms]) => (
              <div key={groupTitle} className="p-3 rounded-xl border border-black/[0.08] space-y-2">
                <p className="text-xs font-semibold text-[#111315] border-b border-black/[0.06] pb-1.5">
                  {groupTitle}
                </p>
                <div className="space-y-1.5">
                  {perms.map((perm) => {
                    const checked =
                      draftPermissions.includes('*') || draftPermissions.includes(perm.code);
                    return (
                      <label
                        key={perm.code}
                        className="flex items-start gap-2 text-[11px] text-[#111315] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePermission(perm.code)}
                          className="mt-0.5 h-3.5 w-3.5 rounded border-black/[0.2] accent-[#0f49bd]"
                        />
                        <span>
                          <span className="block font-medium">{perm.labelFa}</span>
                          <span className="block font-mono text-[10px] text-[#7c818c]" dir="ltr">
                            {perm.code}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </Card>
  );
}
