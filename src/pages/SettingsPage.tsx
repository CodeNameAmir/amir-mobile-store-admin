import { useEffect, useState, type FormEvent } from 'react';
import { KeyRound, LogOut, ShieldCheck, Sliders, Store, Truck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useRouter } from '../router';
import { adminApi } from '../services/adminApi';
import { ApiError } from '../services/apiClient';
import {
  formatPersianDateTime,
  toPersianDigits,
  validatePasswordStrength,
} from '../utils/formatters';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { RoleTag } from '../components/ui/StatusBadge';
import { RbacRolesPanel } from '../components/rbac/RbacRolesPanel';
import { StoreSettingsPanel } from '../components/settings/StoreSettingsPanel';
import { ShippingSettingsTab } from '../components/settings/ShippingSettingsTab';

type SettingsTab = 'account' | 'store' | 'shipping';

function resolveSettingsTab(tabParam: string | null): SettingsTab {
  if (tabParam === 'store' || tabParam === 'shipping') return tabParam;
  return 'account';
}

export function SettingsPage() {
  const { searchParams, navigate } = useRouter();
  const [activeTab, setActiveTab] = useState<SettingsTab>(() =>
    resolveSettingsTab(searchParams.get('tab'))
  );

  useEffect(() => {
    setActiveTab(resolveSettingsTab(searchParams.get('tab')));
  }, [searchParams]);

  const {
    user,
    applyAuthenticatedUser,
    preferences,
    updatePreferences,
    logout,
  } = useAuth();
  const { pushToast } = useToast();

  // Change password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [savingPw, setSavingPw] = useState(false);

  // 2FA toggle state
  const [twoFaPassword, setTwoFaPassword] = useState('');
  const [twoFaError, setTwoFaError] = useState<string | null>(null);
  const [savingTwoFa, setSavingTwoFa] = useState(false);

  // Local UI preferences
  const [thresholdInput, setThresholdInput] = useState(preferences.lowStockThreshold);
  const [compactInput, setCompactInput] = useState(preferences.compactRows);
  const [themeInput, setThemeInput] = useState<'light' | 'dark'>(preferences.theme ?? 'light');

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPwError(null);

    const strengthErr = validatePasswordStrength(newPassword);
    if (strengthErr) {
      setPwError(strengthErr);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('تکرار رمز عبور جدید با آن مطابقت ندارد.');
      return;
    }

    setSavingPw(true);
    try {
      const res = await adminApi.changePassword({
        currentPassword: user?.hasPassword ? currentPassword : '',
        newPassword,
      });
      applyAuthenticatedUser(res.user);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      pushToast({
        tone: 'success',
        title: 'رمز عبور به‌روزرسانی شد',
      });
    } catch (err) {
      setPwError(err instanceof ApiError ? err.message : 'خطا در تغییر رمز عبور.');
    } finally {
      setSavingPw(false);
    }
  };

  const handleToggleTwoFactor = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setTwoFaError(null);
    const nextEnabled = !user.twoFactorEnabled;

    if (user.hasPassword && !twoFaPassword) {
      setTwoFaError('برای تایید تغییر وضعیت 2FA، رمز عبور فعلی را وارد کنید.');
      return;
    }

    setSavingTwoFa(true);
    try {
      const res = await adminApi.toggleTwoFactor({
        enabled: nextEnabled,
        currentPassword: twoFaPassword,
      });
      applyAuthenticatedUser(res.user);
      setTwoFaPassword('');
      pushToast({
        tone: 'success',
        title: nextEnabled ? 'تایید دومرحله‌ای فعال شد' : 'تایید دومرحله‌ای غیرفعال شد',
      });
    } catch (err) {
      setTwoFaError(err instanceof ApiError ? err.message : 'خطا در تغییر وضعیت 2FA.');
    } finally {
      setSavingTwoFa(false);
    }
  };

  const handleSavePrefs = (e: FormEvent) => {
    e.preventDefault();
    updatePreferences({
      lowStockThreshold: thresholdInput,
      compactRows: compactInput,
      theme: themeInput,
    });
    pushToast({
      tone: 'success',
      title: 'تنظیمات نمایش پنل ذخیره شد',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#111315]">تنظیمات فروشگاه و امنیت</h1>
          <p className="mt-1 text-xs text-[#52565e]">
            پیکربندی عمومی فروشگاه، مدیریت رمز عبور، تایید دومرحله‌ای و ترجیحات پنل
          </p>
        </div>

        <div
          className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#f1f2f4] border border-black/[0.06]"
          role="tablist"
          aria-label="بخش‌های تنظیمات"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'account'}
            onClick={() => {
              setActiveTab('account');
              navigate('/settings', { replace: true });
            }}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 ${
              activeTab === 'account'
                ? 'bg-white text-[#111315] shadow-[0_1px_2px_rgba(17,19,21,0.06)] font-semibold'
                : 'text-[#52565e] hover:text-[#111315]'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            <span>حساب مدیر و امنیت</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'store'}
            onClick={() => {
              setActiveTab('store');
              navigate('/settings?tab=store', { replace: true });
            }}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 ${
              activeTab === 'store'
                ? 'bg-white text-[#111315] shadow-[0_1px_2px_rgba(17,19,21,0.06)] font-semibold'
                : 'text-[#52565e] hover:text-[#111315]'
            }`}
          >
            <Store className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            <span>تنظیمات عمومی فروشگاه</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'shipping'}
            onClick={() => {
              setActiveTab('shipping');
              navigate('/settings?tab=shipping', { replace: true });
            }}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 ${
              activeTab === 'shipping'
                ? 'bg-white text-[#111315] shadow-[0_1px_2px_rgba(17,19,21,0.06)] font-semibold'
                : 'text-[#52565e] hover:text-[#111315]'
            }`}
          >
            <Truck className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
            <span>روش‌های ارسال</span>
          </button>
        </div>
      </div>

      {activeTab === 'store' ? (
        <StoreSettingsPanel />
      ) : activeTab === 'shipping' ? (
        <ShippingSettingsTab />
      ) : (
        <>
      {/* Admin Profile Summary */}
      <Card padding="lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-base font-semibold text-[#111315]">{user?.fullName}</h2>
              {user?.username && (
                <span
                  className="text-xs font-mono font-medium text-[#0f49bd] bg-[#eef3fc] border border-[#c7d7f8] px-2 py-0.5 rounded-md"
                  dir="ltr"
                >
                  @{user.username}
                </span>
              )}
              {user && <RoleTag role={user.role} />}
            </div>
            <p className="text-xs font-mono text-[#52565e]" dir="ltr">
              {user?.email}
            </p>
            <p className="text-xs text-[#52565e]">
              آخرین ورود: {formatPersianDateTime(user?.lastLoginAt)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void logout(false)}
              icon={<LogOut className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
            >
              خروج از این دستگاه
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => void logout(true)}
              icon={<LogOut className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />}
            >
              لغو نشست تمام دستگاه‌ها
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Change Password */}
        <Card padding="lg">
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-[#52565e]" strokeWidth={1.5} aria-hidden="true" />
              <h2 className="text-sm font-semibold text-[#111315]">
                {user?.hasPassword ? 'تغییر رمز عبور حساب' : 'تنظیم رمز عبور جدید'}
              </h2>
            </div>

            {pwError && (
              <p className="p-3 rounded-lg bg-[#fef3f2] border border-[#fecaca] text-xs text-[#b42318]">
                {pwError}
              </p>
            )}

            {user?.hasPassword && (
              <div>
                <label htmlFor="set-cur-pw" className="block text-xs font-medium text-[#111315] mb-1.5">
                  رمز عبور فعلی
                </label>
                <input
                  id="set-cur-pw"
                  type="password"
                  dir="ltr"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-sm text-[#111315] focus:outline-none focus:border-[#0f49bd]"
                />
              </div>
            )}

            <div>
              <label htmlFor="set-new-pw" className="block text-xs font-medium text-[#111315] mb-1.5">
                رمز عبور جدید (حداقل ۸ کاراکتر و شامل عدد)
              </label>
              <input
                id="set-new-pw"
                type="password"
                dir="ltr"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-sm text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <div>
              <label htmlFor="set-confirm-pw" className="block text-xs font-medium text-[#111315] mb-1.5">
                تکرار رمز عبور جدید
              </label>
              <input
                id="set-confirm-pw"
                type="password"
                dir="ltr"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-sm text-[#111315] focus:outline-none focus:border-[#0f49bd]"
              />
            </div>

            <Button type="submit" variant="primary" loading={savingPw}>
              ذخیره رمز عبور
            </Button>
          </form>
        </Card>

        {/* Two Factor & Local Preferences */}
        <div className="space-y-6">
          <Card padding="lg">
            <form onSubmit={handleToggleTwoFactor} className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#52565e]" strokeWidth={1.5} aria-hidden="true" />
                  <h2 className="text-sm font-semibold text-[#111315]">
                    تایید دومرحله‌ای ایمیلی (2FA)
                  </h2>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#111315]">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      user?.twoFactorEnabled ? 'bg-[#166534]' : 'bg-[#7c818c]'
                    }`}
                    aria-hidden="true"
                  />
                  {user?.twoFactorEnabled ? 'فعال' : 'غیرفعال'}
                </span>
              </div>

              <p className="text-xs leading-5 text-[#52565e]">
                با فعال‌سازی 2FA، هنگام ورود با رمز عبور یک کد ۶ رقمی به ایمیل شما ارسال می‌شود.
              </p>

              {twoFaError && (
                <p className="p-3 rounded-lg bg-[#fef3f2] border border-[#fecaca] text-xs text-[#b42318]">
                  {twoFaError}
                </p>
              )}

              <div>
                <label htmlFor="set-2fa-pw" className="block text-xs font-medium text-[#111315] mb-1.5">
                  تایید با رمز عبور فعلی
                </label>
                <input
                  id="set-2fa-pw"
                  type="password"
                  dir="ltr"
                  value={twoFaPassword}
                  onChange={(e) => setTwoFaPassword(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-sm text-[#111315] focus:outline-none focus:border-[#0f49bd]"
                />
              </div>

              <Button
                type="submit"
                variant={user?.twoFactorEnabled ? 'outline' : 'secondary'}
                loading={savingTwoFa}
              >
                {user?.twoFactorEnabled ? 'غیرفعال‌سازی 2FA' : 'فعال‌سازی تایید دومرحله‌ای'}
              </Button>
            </form>
          </Card>

          <Card padding="lg">
            <form onSubmit={handleSavePrefs} className="space-y-4">
              <div className="flex items-center gap-2">
                <Sliders className="h-4 w-4 text-[#52565e]" strokeWidth={1.5} aria-hidden="true" />
                <h2 className="text-sm font-semibold text-[#111315]">ترجیحات نمایش پنل</h2>
              </div>

              <div>
                <label htmlFor="pref-threshold" className="block text-xs font-medium text-[#111315] mb-1.5">
                  آستانه هشدار کمبود موجودی (فعلی: {toPersianDigits(preferences.lowStockThreshold)} عدد)
                </label>
                <input
                  id="pref-threshold"
                  type="number"
                  min={1}
                  max={100}
                  dir="ltr"
                  value={thresholdInput}
                  onChange={(e) => setThresholdInput(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full h-9 px-3 rounded-lg border border-black/[0.14] text-sm text-[#111315] tabular-nums-fa focus:outline-none focus:border-[#0f49bd]"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-[#111315] cursor-pointer">
                <input
                  type="checkbox"
                  checked={compactInput}
                  onChange={(e) => setCompactInput(e.target.checked)}
                  className="h-4 w-4 rounded border-black/[0.2] accent-[#0f49bd]"
                />
                <span>نمایش فشرده ردیف‌های جداول</span>
              </label>

              <div>
                <label htmlFor="pref-theme" className="block text-xs font-medium text-[#111315] mb-1.5">
                  حالت نمایش (تم ظاهری پنل)
                </label>
                <select
                  id="pref-theme"
                  value={themeInput}
                  onChange={(e) => setThemeInput(e.target.value === 'dark' ? 'dark' : 'light')}
                  className="w-full h-9 px-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd]"
                >
                  <option value="light">تم روشن (پیش‌فرض)</option>
                  <option value="dark">تم تاریک (شبانه)</option>
                </select>
              </div>

              <div>
                <Button type="submit" variant="primary" size="sm">
                  ذخیره ترجیحات
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>

      <RbacRolesPanel />
        </>
      )}
    </div>
  );
}
