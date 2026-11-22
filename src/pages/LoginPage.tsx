import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
  Smartphone,
  User,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../router';
import { useToast } from '../context/ToastContext';
import { adminApi } from '../services/adminApi';
import { ApiError } from '../services/apiClient';
import {
  isValidEmail,
  isValidLoginIdentifier,
  normalizeUsername,
  toEnglishDigits,
  toPersianDigits,
} from '../utils/formatters';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

type LoginMode = 'password' | 'otp';

export function LoginPage() {
  const {
    status,
    isAdmin,
    sessionExpiredNotice,
    clearSessionExpiredNotice,
    applyAuthenticatedUser,
  } = useAuth();
  const { navigate } = useRouter();
  const { pushToast } = useToast();

  const [mode, setMode] = useState<LoginMode>('password');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // 2FA challenge state
  const [twoFactorToken, setTwoFactorToken] = useState<string | null>(null);
  const [challengeEmail, setChallengeEmail] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [previewCodeHint, setPreviewCodeHint] = useState<string | null>(null);

  // Email OTP state
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated' && isAdmin) {
      navigate('/', { replace: true });
    } else if (status === 'forbidden') {
      navigate('/', { replace: true });
    }
  }, [status, isAdmin, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const finishLoginWithUser = async (user: NonNullable<Awaited<ReturnType<typeof adminApi.getMe>>['user']>) => {
    clearSessionExpiredNotice();
    if (user.role !== 'admin') {
      applyAuthenticatedUser(user);
      navigate('/', { replace: true });
      return;
    }
    const verified = await adminApi.verifyAdminAccess();
    if (!verified.user || !verified.user.email) {
      setErrorMessage('اطلاعات حساب مدیر از سرور دریافت نشد. لطفاً دوباره وارد شوید.');
      return;
    }
    applyAuthenticatedUser(verified.user);
    if (verified.user.role !== 'admin') {
      navigate('/', { replace: true });
      return;
    }
    pushToast({
      tone: 'success',
      title: 'نشست مدیریت فعال شد',
      description: verified.user.fullName || verified.user.email,
    });
    navigate('/', { replace: true });
  };

  const handlePasswordSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const rawIdentifier = toEnglishDigits(identifier).trim();
    if (!isValidLoginIdentifier(rawIdentifier)) {
      setErrorMessage('لطفاً ایمیل معتبر یا نام کاربری صحیح (حداقل ۳ کاراکتر) وارد کنید.');
      return;
    }
    if (!password) {
      setErrorMessage('وارد کردن رمز عبور الزامی است.');
      return;
    }

    const isEmailInput = rawIdentifier.includes('@') && !rawIdentifier.startsWith('@');
    const cleanedIdentifier = isEmailInput
      ? rawIdentifier.toLowerCase()
      : normalizeUsername(rawIdentifier);

    setSubmitting(true);
    try {
      const res = await adminApi.loginWithPassword({
        identifier: cleanedIdentifier,
        ...(isEmailInput ? { email: cleanedIdentifier } : { username: cleanedIdentifier }),
        password,
      });

      if (res.requires2FA && res.twoFactorToken) {
        const resolvedEmail = res.email || cleanedIdentifier;
        setTwoFactorToken(res.twoFactorToken);
        setChallengeEmail(resolvedEmail);
        setCooldown(res.cooldownSeconds ?? 60);
        setPreviewCodeHint(res.previewCode || null);
        setTwoFactorCode('');
        pushToast({
          tone: 'info',
          title: 'کد تایید دومرحله‌ای ارسال شد',
          description: `کد ۶ رقمی به ${resolvedEmail} ارسال گردید.`,
        });
        return;
      }

      if (res.authenticated && res.user) {
        await finishLoginWithUser(res.user);
      } else {
        setErrorMessage('پاسخ احراز هویت معتبر نبود.');
      }
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : 'خطا در ورود به سیستم.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyTwoFactor = async (e: FormEvent) => {
    e.preventDefault();
    if (!twoFactorToken) return;
    setErrorMessage(null);

    const cleanedCode = toEnglishDigits(twoFactorCode).replace(/[\s\-_]/g, '').trim();
    if (!/^\d{6}$/.test(cleanedCode)) {
      setErrorMessage('کد تایید باید دقیقاً ۶ رقم باشد.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await adminApi.verifyTwoFactor({
        twoFactorToken,
        code: cleanedCode,
      });
      if (res.authenticated && res.user) {
        await finishLoginWithUser(res.user);
      }
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : 'کد تایید نامعتبر است.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendTwoFactor = async () => {
    if (!twoFactorToken || cooldown > 0) return;
    setErrorMessage(null);
    setSubmitting(true);
    try {
      const res = await adminApi.resendTwoFactor({ twoFactorToken });
      setCooldown(res.cooldownSeconds ?? 60);
      setPreviewCodeHint(res.previewCode || null);
      pushToast({ tone: 'info', title: 'کد تایید مجدداً ارسال شد' });
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : 'خطا در ارسال مجدد کد.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendEmailOtp = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const normalizedEmail = toEnglishDigits(email).trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setErrorMessage('لطفاً یک آدرس ایمیل معتبر وارد کنید.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await adminApi.sendLoginOtp(normalizedEmail);
      setOtpSent(true);
      setCooldown(res.cooldownSeconds ?? 60);
      setPreviewCodeHint(res.previewCode || null);
      pushToast({
        tone: 'info',
        title: 'کد یک‌بارمصرف ارسال شد',
        description: `کد تایید به ${normalizedEmail} ارسال گردید.`,
      });
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : 'خطا در ارسال کد تایید.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyEmailOtp = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const normalizedEmail = toEnglishDigits(email).trim().toLowerCase();
    const cleanedCode = toEnglishDigits(otpCode).replace(/[\s\-_]/g, '').trim();
    if (!/^\d{6}$/.test(cleanedCode)) {
      setErrorMessage('کد تایید باید دقیقاً ۶ رقم باشد.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await adminApi.verifyLoginOtp({
        email: normalizedEmail,
        code: cleanedCode,
      });
      if (res.authenticated && res.user) {
        await finishLoginWithUser(res.user);
      }
    } catch (err) {
      setErrorMessage(err instanceof ApiError ? err.message : 'کد تایید نامعتبر است.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f6f7] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6 ams-enter">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 rounded-lg bg-[#111315] text-white flex items-center justify-center mb-3">
            <Smartphone className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
          </div>
          <h1 className="text-lg font-semibold text-[#111315]">
            پنل مدیریت فروشگاه موبایل امیر
          </h1>
          <p className="mt-1 text-xs text-[#52565e]">
            ورود مدیران به سامانه فروش و انبارداری AMS
          </p>
        </div>

        <Card padding="lg">
          {sessionExpiredNotice && (
            <div
              role="status"
              className="mb-4 p-3 rounded-lg bg-[#fffbeb] border border-[#fde68a] text-xs text-[#9a4a06]"
            >
              نشست قبلی شما منقضی شده است؛ لطفاً دوباره وارد شوید.
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="mb-4 p-3 rounded-lg bg-[#fef3f2] border border-[#fecaca] text-xs font-medium text-[#b42318]"
            >
              {errorMessage}
            </div>
          )}

          {previewCodeHint && (
            <div className="mb-4 p-3 rounded-lg bg-[#eef3fc] border border-[#c7d7f8] text-xs text-[#0f49bd]">
              کد پیش‌نمایش محیط توسعه:{' '}
              <span className="font-mono font-medium tabular-nums-fa" dir="ltr">
                {previewCodeHint}
              </span>
            </div>
          )}

          {twoFactorToken ? (
            <form onSubmit={handleVerifyTwoFactor} className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#111315]">
                <ShieldCheck className="h-4 w-4 text-[#0f49bd]" strokeWidth={1.5} aria-hidden="true" />
                <span>تایید دومرحله‌ای</span>
              </div>
              <p className="text-xs leading-5 text-[#52565e]">
                کد ۶ رقمی ارسال‌شده به{' '}
                <span className="font-mono font-medium text-[#111315]" dir="ltr">
                  {challengeEmail || identifier}
                </span>{' '}
                را وارد کنید
              </p>

              <div>
                <label
                  htmlFor="two-factor-code"
                  className="block text-xs font-medium text-[#111315] mb-1.5"
                >
                  کد تایید ۶ رقمی
                </label>
                <input
                  id="two-factor-code"
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  maxLength={6}
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  placeholder="123456"
                  className="w-full h-10 px-4 rounded-lg border border-black/[0.14] bg-white text-center font-mono text-base font-medium tracking-[0.25em] text-[#111315] focus:outline-none focus:border-[#0f49bd] tabular-nums-fa transition-colors duration-150"
                  autoFocus
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={submitting}
                className="w-full"
              >
                تایید و ورود
              </Button>

              <div className="flex items-center justify-between pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setTwoFactorToken(null);
                    setPreviewCodeHint(null);
                    setErrorMessage(null);
                  }}
                  className="inline-flex items-center gap-1 text-[#52565e] hover:text-[#111315] transition-colors duration-150"
                >
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                  <span>بازگشت</span>
                </button>

                <button
                  type="button"
                  disabled={cooldown > 0 || submitting}
                  onClick={() => void handleResendTwoFactor()}
                  className="text-[#0f49bd] font-medium disabled:text-[#7c818c] transition-colors duration-150"
                >
                  {cooldown > 0
                    ? `ارسال مجدد (${toPersianDigits(cooldown)} ثانیه)`
                    : 'ارسال مجدد کد'}
                </button>
              </div>
            </form>
          ) : (
            <>
              <div
                className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#f1f2f4] border border-black/[0.06] mb-5"
                role="tablist"
                aria-label="روش ورود"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'password'}
                  onClick={() => {
                    setMode('password');
                    setErrorMessage(null);
                    setOtpSent(false);
                    setPreviewCodeHint(null);
                  }}
                  className={`h-8 rounded-md text-xs font-medium transition-colors duration-150 ${
                    mode === 'password'
                      ? 'bg-white text-[#111315] shadow-[0_1px_2px_rgba(17,19,21,0.06)]'
                      : 'text-[#52565e] hover:text-[#111315]'
                  }`}
                >
                  ورود با رمز عبور
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'otp'}
                  onClick={() => {
                    setMode('otp');
                    setErrorMessage(null);
                    setPreviewCodeHint(null);
                  }}
                  className={`h-8 rounded-md text-xs font-medium transition-colors duration-150 ${
                    mode === 'otp'
                      ? 'bg-white text-[#111315] shadow-[0_1px_2px_rgba(17,19,21,0.06)]'
                      : 'text-[#52565e] hover:text-[#111315]'
                  }`}
                >
                  ورود با کد ایمیل
                </button>
              </div>

              {mode === 'password' ? (
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="login-identifier"
                      className="block text-xs font-medium text-[#111315] mb-1.5"
                    >
                      ایمیل یا نام کاربری
                    </label>
                    <div className="relative">
                      <User
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7c818c]"
                        strokeWidth={1.5}
                        aria-hidden="true"
                      />
                      <input
                        id="login-identifier"
                        type="text"
                        dir="ltr"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="admin@codenameamir.ir یا CodeNameAmir"
                        autoComplete="username"
                        className="w-full h-10 pr-9 pl-3 rounded-lg border border-black/[0.14] bg-white text-xs font-mono text-[#111315] focus:outline-none focus:border-[#0f49bd] transition-colors duration-150"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-medium text-[#111315] mb-1.5"
                    >
                      رمز عبور
                    </label>
                    <div className="relative">
                      <Lock
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7c818c]"
                        strokeWidth={1.5}
                        aria-hidden="true"
                      />
                      <input
                        id="login-password"
                        type="password"
                        dir="ltr"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className="w-full h-10 pr-9 pl-3 rounded-lg border border-black/[0.14] bg-white text-xs text-[#111315] focus:outline-none focus:border-[#0f49bd] transition-colors duration-150"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    loading={submitting}
                    className="w-full"
                  >
                    ورود به پنل مدیریت
                  </Button>
                </form>
              ) : !otpSent ? (
                <form onSubmit={handleSendEmailOtp} className="space-y-4">
                  <div>
                    <label
                      htmlFor="otp-email"
                      className="block text-xs font-medium text-[#111315] mb-1.5"
                    >
                      ایمیل حساب مدیریت
                    </label>
                    <div className="relative">
                      <Mail
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7c818c]"
                        strokeWidth={1.5}
                        aria-hidden="true"
                      />
                      <input
                        id="otp-email"
                        type="email"
                        dir="ltr"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@codenameamir.ir"
                        autoComplete="email"
                        className="w-full h-10 pr-9 pl-3 rounded-lg border border-black/[0.14] bg-white text-xs font-mono text-[#111315] focus:outline-none focus:border-[#0f49bd] transition-colors duration-150"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    loading={submitting}
                    icon={<KeyRound className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
                    className="w-full"
                  >
                    ارسال کد یک‌بارمصرف
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyEmailOtp} className="space-y-4">
                  <p className="text-xs text-[#52565e]">
                    کد ۶ رقمی ارسال‌شده به{' '}
                    <span className="font-mono font-medium text-[#111315]" dir="ltr">
                      {email}
                    </span>{' '}
                    را وارد کنید
                  </p>
                  <div>
                    <label
                      htmlFor="email-otp-code"
                      className="block text-xs font-medium text-[#111315] mb-1.5"
                    >
                      کد تایید ۶ رقمی
                    </label>
                    <input
                      id="email-otp-code"
                      type="text"
                      inputMode="numeric"
                      dir="ltr"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="123456"
                      className="w-full h-10 px-4 rounded-lg border border-black/[0.14] bg-white text-center font-mono text-base font-medium tracking-[0.25em] text-[#111315] focus:outline-none focus:border-[#0f49bd] tabular-nums-fa transition-colors duration-150"
                      autoFocus
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    loading={submitting}
                    className="w-full"
                  >
                    تایید کد و ورود
                  </Button>
                  <div className="flex items-center justify-between text-xs pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setOtpCode('');
                        setPreviewCodeHint(null);
                      }}
                      className="text-[#52565e] hover:text-[#111315] transition-colors duration-150"
                    >
                      تغییر ایمیل
                    </button>
                    <button
                      type="button"
                      disabled={cooldown > 0 || submitting}
                      onClick={() => void handleSendEmailOtp(new Event('submit') as unknown as FormEvent)}
                      className="text-[#0f49bd] font-medium disabled:text-[#7c818c] transition-colors duration-150"
                    >
                      {cooldown > 0
                        ? `ارسال مجدد (${toPersianDigits(cooldown)} ثانیه)`
                        : 'ارسال مجدد کد'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
