import { useState, type FormEvent } from 'react';
import { KeyRound, LogOut, ShieldCheck, Sliders } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
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

export function SettingsPage() {
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
    });
    pushToast({
      tone: 'success',
      title: 'تنظیمات نمایش پنل ذخیره شد',
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#0b1c30]">تنظیمات حساب و امنیت</h1>
        <p className="mt-1 text-xs text-[#434655]">
          مدیریت رمز عبور، تایید دومرحله‌ای (2FA)، نشست‌های فعال و ترجیحات نمایشی پنل
        </p>
      </div>

      {/* Admin Profile Summary */}
      <Card padding="lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-[#0b1c30]">{user?.fullName}</h2>
              {user && <RoleTag role={user.role} />}
            </div>
            <p className="text-xs text-[#434655]" dir="ltr">
              {user?.email}
            </p>
            <p className="text-xs text-[#434655]">
              آخرین ورود: {formatPersianDateTime(user?.lastLoginAt)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void logout(false)}
              icon={<LogOut className="h-3.5 w-3.5" aria-hidden="true" />}
            >
              خروج از این دستگاه
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => void logout(true)}
              icon={<LogOut className="h-3.5 w-3.5" aria-hidden="true" />}
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
              <KeyRound className="h-4 w-4 text-[#004ac6]" aria-hidden="true" />
              <h2 className="text-sm font-bold text-[#0b1c30]">
                {user?.hasPassword ? 'تغییر رمز عبور حساب' : 'تنظیم رمز عبور جدید'}
              </h2>
            </div>

            {pwError && (
              <p className="p-3 rounded-xl bg-[#ffdad6] text-xs text-[#ba1a1a]">{pwError}</p>
            )}

            {user?.hasPassword && (
              <div>
                <label htmlFor="set-cur-pw" className="block text-xs font-medium text-[#0b1c30] mb-1">
                  رمز عبور فعلی
                </label>
                <input
                  id="set-cur-pw"
                  type="password"
                  dir="ltr"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-sm focus:outline-none focus:border-[#2563eb]"
                />
              </div>
            )}

            <div>
              <label htmlFor="set-new-pw" className="block text-xs font-medium text-[#0b1c30] mb-1">
                رمز عبور جدید (حداقل ۸ کاراکتر و شامل عدد)
              </label>
              <input
                id="set-new-pw"
                type="password"
                dir="ltr"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-sm focus:outline-none focus:border-[#2563eb]"
              />
            </div>

            <div>
              <label htmlFor="set-confirm-pw" className="block text-xs font-medium text-[#0b1c30] mb-1">
                تکرار رمز عبور جدید
              </label>
              <input
                id="set-confirm-pw"
                type="password"
                dir="ltr"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-sm focus:outline-none focus:border-[#2563eb]"
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
                  <ShieldCheck className="h-4 w-4 text-[#004ac6]" aria-hidden="true" />
                  <h2 className="text-sm font-bold text-[#0b1c30]">
                    تایید دومرحله‌ای ایمیلی (2FA)
                  </h2>
                </div>
                <span className="text-xs font-semibold text-[#004ac6]">
                  {user?.twoFactorEnabled ? 'فعال' : 'غیرفعال'}
                </span>
              </div>

              <p className="text-xs leading-5 text-[#434655]">
                با فعال‌سازی 2FA، هنگام ورود با رمز عبور یک کد ۶ رقمی به ایمیل شما ارسال می‌شود.
              </p>

              {twoFaError && (
                <p className="p-3 rounded-xl bg-[#ffdad6] text-xs text-[#ba1a1a]">{twoFaError}</p>
              )}

              <div>
                <label htmlFor="set-2fa-pw" className="block text-xs font-medium text-[#0b1c30] mb-1">
                  تایید با رمز عبور فعلی
                </label>
                <input
                  id="set-2fa-pw"
                  type="password"
                  dir="ltr"
                  value={twoFaPassword}
                  onChange={(e) => setTwoFaPassword(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-sm focus:outline-none focus:border-[#2563eb]"
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
                <Sliders className="h-4 w-4 text-[#004ac6]" aria-hidden="true" />
                <h2 className="text-sm font-bold text-[#0b1c30]">ترجیحات نمایش پنل</h2>
              </div>

              <div>
                <label htmlFor="pref-threshold" className="block text-xs font-medium text-[#0b1c30] mb-1">
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
                  className="w-full h-10 px-3 rounded-xl border border-[#c3c6d7] text-sm tabular-nums-fa focus:outline-none focus:border-[#2563eb]"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-[#0b1c30] cursor-pointer">
                <input
                  type="checkbox"
                  checked={compactInput}
                  onChange={(e) => setCompactInput(e.target.checked)}
                  className="h-4 w-4 rounded border-[#c3c6d7]"
                />
                <span>نمایش فشرده ردیف‌های جداول</span>
              </label>

              <div>
                <Button type="submit" variant="primary" size="sm">
                  ذخیره ترجیحات
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
