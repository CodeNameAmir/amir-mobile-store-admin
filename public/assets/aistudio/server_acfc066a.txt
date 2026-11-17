import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import {
  AuthService,
  createDefaultAuthStorage,
  hashPassword,
  toPublicUser,
  verifyPassword,
  type AuthStorageAdapter,
  type OtpPurpose,
  type StoredAddress,
  type StoredOrderRecord,
  type StoredUserRecord,
} from './server/authStore.ts';
import {
  getSessionCookieOptions,
  isOriginAllowed,
  resolveCorsConfig,
  resolveSessionSecret,
} from './server/config.ts';
import {
  buildOrderReceiptEmailContent,
  buildOtpEmailContent,
  buildSecurityAlertEmailContent,
  buildWelcomeEmailContent,
} from './server/emailTemplates.ts';
import { getResendProviderStatus, sendEmailWithResend } from './server/resendService.ts';

const SESSION_COOKIE_NAME = 'amir_session';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function toEnglishDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (ch) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(ch)))
    .replace(/[٠-٩]/g, (ch) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(ch)));
}

function normalizeEmail(raw: unknown): string {
  return toEnglishDigits(String(raw ?? '')).trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return Boolean(email && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email));
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    out[key] = decodeURIComponent(val);
  }
  return out;
}

function isHttpsRequest(req: Request): boolean {
  if (req.secure) return true;
  const proto = req.headers['x-forwarded-proto'];
  if (typeof proto === 'string') {
    return proto.split(',')[0].trim().toLowerCase() === 'https';
  }
  return false;
}

interface AuthenticatedRequest extends Request {
  authUser?: StoredUserRecord;
  authSessionId?: string;
}

export interface CreateServerAppOptions {
  env?: NodeJS.ProcessEnv;
  storage?: AuthStorageAdapter;
  disableVite?: boolean;
  sendEmail?: typeof sendEmailWithResend;
  onOtpIssued?: (info: { email: string; purpose: OtpPurpose; code: string }) => void;
}

export async function createServerApp(options: CreateServerAppOptions = {}) {
  const env = options.env || process.env;
  const isProd = env.NODE_ENV === 'production';

  const sessionSecret = resolveSessionSecret(env);
  const corsCfg = resolveCorsConfig(env);
  const storage = options.storage || createDefaultAuthStorage(env);
  const authService = new AuthService(storage, sessionSecret);
  const dispatchEmail = options.sendEmail || sendEmailWithResend;

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));

  // Strict CORS middleware for cross-origin credentials between GitHub Pages & Render API
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
    const host = req.get('host');
    const proto = isHttpsRequest(req) ? 'https' : req.protocol || 'http';
    const selfOrigin = host ? `${proto}://${host}` : undefined;

    if (origin) {
      if (!isOriginAllowed(origin, corsCfg.allowedOrigins, isProd, selfOrigin)) {
        res.status(403).json({ error: 'Origin not allowed by CORS' });
        return;
      }
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  });

  const setSessionCookie = (req: Request, res: Response, token: string) => {
    res.cookie(
      SESSION_COOKIE_NAME,
      token,
      getSessionCookieOptions({
        isProd,
        isHttpsRequest: isHttpsRequest(req),
        maxAgeMs: SESSION_MAX_AGE_MS,
        cookieDomain: env.COOKIE_DOMAIN,
      })
    );
  };

  const clearSessionCookie = (req: Request, res: Response) => {
    const opts = getSessionCookieOptions({
      isProd,
      isHttpsRequest: isHttpsRequest(req),
      cookieDomain: env.COOKIE_DOMAIN,
    });
    res.clearCookie(SESSION_COOKIE_NAME, opts);
  };

  const getAuthFromRequest = async (
    req: Request
  ): Promise<{ user: StoredUserRecord; sessionId: string } | null> => {
    const cookies = parseCookies(req.headers.cookie);
    return authService.verifySessionToken(cookies[SESSION_COOKIE_NAME]);
  };

  const requireAuth = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const auth = await getAuthFromRequest(req);
      if (!auth) {
        res.status(401).json({ error: 'لطفاً ابتدا وارد حساب کاربری خود شوید.' });
        return;
      }
      req.authUser = auth.user;
      req.authSessionId = auth.sessionId;
      next();
    } catch (err) {
      next(err);
    }
  };

  app.get('/api/health', async (_req, res) => {
    const storageHealth = await authService.checkHealth().catch((err) => ({
      ok: false,
      mode: authService.storageMode,
      detail: err instanceof Error ? err.message : 'Storage health check failed',
    }));

    const statusCode = storageHealth.ok ? 200 : 503;
    res.status(statusCode).json({
      ok: storageHealth.ok,
      service: 'amir-mobile-api',
      environment: isProd ? 'production' : 'development',
      storage: storageHealth,
      corsConfigured: corsCfg.configured,
      resend: getResendProviderStatus(),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/auth/status', async (req, res, next) => {
    try {
      const auth = await getAuthFromRequest(req);
      res.json({
        ...getResendProviderStatus(),
        storageMode: authService.storageMode,
        authenticated: Boolean(auth),
        user: auth ? toPublicUser(auth.user) : null,
      });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/auth/me', async (req, res, next) => {
    try {
      const auth = await getAuthFromRequest(req);
      if (!auth) {
        res.json({ authenticated: false, user: null });
        return;
      }
      res.json({ authenticated: true, user: toPublicUser(auth.user) });
    } catch (err) {
      next(err);
    }
  });

  const issueAndSendOtpChallenge = async (params: {
    email: string;
    purpose: OtpPurpose;
    recipientName?: string;
    pendingUserId?: string;
    pendingSignup?: { fullName: string; phone: string; passwordHash?: string };
  }): Promise<
    | {
        ok: true;
        provider: 'resend' | 'sandbox-preview';
        emailId?: string;
        previewCode?: string;
        cooldownSeconds: number;
        warning?: string;
      }
    | { ok: false; statusCode: number; error: string; retryAfterSeconds?: number }
  > => {
    const challengeResult = await authService.createOtpChallenge({
      email: params.email,
      purpose: params.purpose,
      pendingUserId: params.pendingUserId,
      pendingSignup: params.pendingSignup,
    });

    if (!challengeResult.ok) {
      return {
        ok: false,
        statusCode: 429,
        error: `لطفاً ${challengeResult.retryAfterSeconds} ثانیه دیگر برای ارسال مجدد کد صبر کنید.`,
        retryAfterSeconds: challengeResult.retryAfterSeconds,
      };
    }

    options.onOtpIssued?.({
      email: params.email,
      purpose: params.purpose,
      code: challengeResult.code,
    });

    const emailContent = buildOtpEmailContent({
      code: challengeResult.code,
      purpose: params.purpose,
      recipientName: params.recipientName,
    });

    const delivery = await dispatchEmail({
      to: params.email,
      subject: emailContent.subject,
      html: emailContent.html,
      idempotencyKey: `otp-${params.purpose}-${challengeResult.challengeId}`,
      tags: [{ name: 'category', value: `auth_${params.purpose.replace('-', '_')}` }],
    });

    if (delivery.sent) {
      return {
        ok: true,
        provider: 'resend',
        emailId: delivery.emailId,
        cooldownSeconds: challengeResult.cooldownSeconds,
      };
    }

    if (delivery.provider === 'sandbox-preview' && !isProd) {
      return {
        ok: true,
        provider: 'sandbox-preview',
        previewCode: challengeResult.code,
        cooldownSeconds: challengeResult.cooldownSeconds,
        warning:
          'کد تایید به‌صورت موقت برای تست در همین صفحه نمایش داده می‌شود.',
      };
    }

    await authService.clearOtpChallenge(params.email, params.purpose);
    return {
      ok: false,
      statusCode: delivery.statusCode && delivery.statusCode >= 400 ? delivery.statusCode : 502,
      error:
        delivery.provider === 'sandbox-preview'
          ? 'سرویس ارسال ایمیل (RESEND_API_KEY) در محیط Production پیکربندی نشده است.'
          : `خطا در ارسال ایمیل از طریق Resend: ${delivery.errorMessage || 'خطای نامشخص'}`,
    };
  };

  app.post('/api/auth/send-otp', async (req, res, next) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const purpose = String(req.body?.purpose || '') as OtpPurpose;

      if (!['signup', 'login', 'reset-password', 'change-email'].includes(purpose)) {
        res.status(400).json({ error: 'نوع درخواست کد تایید معتبر نیست.' });
        return;
      }

      if (!isValidEmail(email)) {
        res.status(400).json({ error: 'آدرس ایمیل واردشده معتبر نیست.' });
        return;
      }

      let recipientName: string | undefined;
      let pendingUserId: string | undefined;
      let pendingSignup: { fullName: string; phone: string; passwordHash?: string } | undefined;

      if (purpose === 'signup') {
        const existing = await authService.findUserByEmail(email);
        if (existing) {
          res.status(409).json({
            error: 'حساب کاربری با این ایمیل قبلاً ثبت شده است. لطفاً از بخش ورود اقدام کنید.',
          });
          return;
        }
        const fullName = String(req.body?.fullName || '').trim();
        const phone = toEnglishDigits(String(req.body?.phone || ''))
          .replace(/[\s-]/g, '')
          .trim();
        const password = String(req.body?.password || '');

        if (fullName.length < 3) {
          res.status(400).json({ error: 'نام و نام خانوادگی باید حداقل ۳ حرف باشد.' });
          return;
        }
        if (phone && !/^09\d{9}$/.test(phone)) {
          res.status(400).json({ error: 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.' });
          return;
        }
        if (password.length < 8 || !/\d/.test(toEnglishDigits(password))) {
          res.status(400).json({ error: 'رمز عبور باید حداقل ۸ کاراکتر و شامل عدد باشد.' });
          return;
        }

        recipientName = fullName;
        pendingSignup = {
          fullName,
          phone,
          passwordHash: hashPassword(password),
        };
      } else if (purpose === 'reset-password') {
        const existing = await authService.findUserByEmail(email);
        if (!existing) {
          res.status(404).json({ error: 'حساب کاربری با این ایمیل یافت نشد.' });
          return;
        }
        recipientName = existing.fullName;
        pendingUserId = existing.id;
      } else if (purpose === 'change-email') {
        const auth = await getAuthFromRequest(req);
        if (!auth) {
          res.status(401).json({ error: 'برای تغییر ایمیل ابتدا باید وارد حساب کاربری شوید.' });
          return;
        }
        if (auth.user.email === email) {
          res.status(400).json({ error: 'ایمیل جدید با ایمیل فعلی حساب شما یکسان است.' });
          return;
        }
        const conflict = await authService.findUserByEmail(email);
        if (conflict) {
          res.status(409).json({ error: 'این ایمیل قبلاً برای حساب دیگری ثبت شده است.' });
          return;
        }
        recipientName = auth.user.fullName;
        pendingUserId = auth.user.id;
      } else if (purpose === 'login') {
        const existing = await authService.findUserByEmail(email);
        if (!existing) {
          res.status(404).json({
            error:
              'حساب کاربری با این ایمیل ثبت نشده است. لطفاً ابتدا از بخش «ثبت‌نام جدید» حساب کاربری خود را ایجاد کنید.',
          });
          return;
        }
        if (existing.twoFactorEnabled) {
          res.status(403).json({
            error:
              'تایید دومرحله‌ای (2FA) برای این حساب فعال است. لطفاً از بخش «ورود با رمز عبور» وارد شوید.',
          });
          return;
        }
        recipientName = existing.fullName;
        pendingUserId = existing.id;
      }

      const otpResult = await issueAndSendOtpChallenge({
        email,
        purpose,
        recipientName,
        pendingUserId,
        pendingSignup,
      });

      if (!otpResult.ok) {
        res.status(otpResult.statusCode).json({
          error: otpResult.error,
          ...(otpResult.retryAfterSeconds ? { retryAfterSeconds: otpResult.retryAfterSeconds } : {}),
        });
        return;
      }

      res.json({
        sent: true,
        provider: otpResult.provider,
        ...(otpResult.emailId ? { emailId: otpResult.emailId } : {}),
        ...(otpResult.previewCode ? { previewCode: otpResult.previewCode } : {}),
        cooldownSeconds: otpResult.cooldownSeconds,
        ...(otpResult.warning ? { warning: otpResult.warning } : {}),
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/auth/verify-otp', async (req, res, next) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const purpose = String(req.body?.purpose || '') as OtpPurpose;
      const code = toEnglishDigits(String(req.body?.code || ''))
        .replace(/[\s\-_]/g, '')
        .trim();

      if (!['signup', 'login', 'reset-password', 'change-email'].includes(purpose)) {
        res.status(400).json({ error: 'نوع درخواست کد تایید معتبر نیست.' });
        return;
      }

      if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
        res.status(400).json({ error: 'ایمیل یا کد تایید ۶ رقمی معتبر نیست.' });
        return;
      }

      const verification = await authService.verifyOtpChallenge(email, purpose, code);
      if (!verification.ok) {
        res.status(400).json({ error: verification.messageFa });
        return;
      }

      const { challenge } = verification;
      let user: StoredUserRecord | null = null;

      if (purpose === 'signup') {
        if (!challenge.pendingSignup) {
          res.status(400).json({ error: 'اطلاعات ثبت‌نام یافت نشد. لطفاً دوباره ثبت‌نام کنید.' });
          return;
        }
        const existing = await authService.findUserByEmail(email);
        if (existing) {
          res.status(409).json({ error: 'این ایمیل قبلاً ثبت شده است.' });
          return;
        }
        user = await authService.createUserAccount({
          email,
          fullName: challenge.pendingSignup.fullName,
          phone: challenge.pendingSignup.phone,
          passwordHash: challenge.pendingSignup.passwordHash,
        });

        const welcome = buildWelcomeEmailContent({ fullName: user.fullName });
        void dispatchEmail({
          to: user.email,
          subject: welcome.subject,
          html: welcome.html,
          idempotencyKey: `welcome-${user.id}`,
          tags: [{ name: 'category', value: 'welcome' }],
        });
      } else if (purpose === 'login') {
        const existing = await authService.findUserByEmail(email);
        if (!existing) {
          res.status(404).json({
            error: 'حساب کاربری با این ایمیل یافت نشد. لطفاً ابتدا ثبت‌نام کنید.',
          });
          return;
        }
        if (existing.twoFactorEnabled) {
          res.status(403).json({
            error: 'تایید دومرحله‌ای (2FA) برای این حساب فعال است. لطفاً با رمز عبور وارد شوید.',
          });
          return;
        }
        user = await authService.updateUserRecord(existing.id, (prev) => ({
          ...prev,
          emailVerified: true,
        }));
      } else if (purpose === 'reset-password') {
        const newPassword = String(req.body?.newPassword || '');
        if (newPassword.length < 8 || !/\d/.test(toEnglishDigits(newPassword))) {
          res.status(400).json({ error: 'رمز عبور جدید باید حداقل ۸ کاراکتر و شامل عدد باشد.' });
          return;
        }
        const existing = await authService.findUserByEmail(email);
        if (!existing) {
          res.status(404).json({ error: 'کاربر یافت نشد.' });
          return;
        }
        user = await authService.updateUserRecord(existing.id, (prev) => ({
          ...prev,
          passwordHash: hashPassword(newPassword),
          emailVerified: true,
        }));
        if (user) {
          const alert = buildSecurityAlertEmailContent({
            fullName: user.fullName,
            actionLabel: 'بازیابی و تغییر رمز عبور',
          });
          void dispatchEmail({
            to: user.email,
            subject: alert.subject,
            html: alert.html,
            idempotencyKey: `reset-pw-${user.id}-${Date.now()}`,
            tags: [{ name: 'category', value: 'security_alert' }],
          });
        }
      } else if (purpose === 'change-email') {
        const auth = await getAuthFromRequest(req);
        if (!auth || auth.user.id !== challenge.pendingUserId) {
          res.status(401).json({ error: 'نشست کاربری نامعتبر است.' });
          return;
        }
        user = await authService.updateUserRecord(auth.user.id, (prev) => ({
          ...prev,
          email,
          emailVerified: true,
        }));
        if (user) {
          const alert = buildSecurityAlertEmailContent({
            fullName: user.fullName,
            actionLabel: `تغییر ایمیل حساب به ${email}`,
          });
          void dispatchEmail({
            to: user.email,
            subject: alert.subject,
            html: alert.html,
            idempotencyKey: `change-email-${user.id}-${Date.now()}`,
            tags: [{ name: 'category', value: 'security_alert' }],
          });
        }
      }

      if (!user) {
        res.status(500).json({ error: 'خطا در به‌روزرسانی اطلاعات حساب کاربری.' });
        return;
      }

      const session = await authService.issueSessionToken(user.id);
      if (!session) {
        res.status(500).json({ error: 'خطا در ایجاد نشست کاربری.' });
        return;
      }

      setSessionCookie(req, res, session.token);
      const freshUser = (await authService.findUserByEmail(user.email)) || user;
      res.json({
        authenticated: true,
        user: toPublicUser(freshUser),
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/auth/login-password', async (req, res, next) => {
    try {
      const email = normalizeEmail(req.body?.email);
      const password = String(req.body?.password || '');

      if (!isValidEmail(email) || !password) {
        res.status(400).json({ error: 'ایمیل و رمز عبور را به درستی وارد کنید.' });
        return;
      }

      const user = await authService.findUserByEmail(email);
      if (!user || !user.passwordHash) {
        res.status(401).json({
          error:
            'ایمیل یا رمز عبور اشتباه است. اگر با کد ایمیل ثبت‌نام کرده‌اید، از ورود با کد ایمیل استفاده کنید.',
        });
        return;
      }

      if (!verifyPassword(password, user.passwordHash)) {
        res.status(401).json({ error: 'ایمیل یا رمز عبور اشتباه است.' });
        return;
      }

      if (user.twoFactorEnabled) {
        const otpResult = await issueAndSendOtpChallenge({
          email: user.email,
          purpose: 'login-2fa',
          recipientName: user.fullName,
          pendingUserId: user.id,
        });

        if (!otpResult.ok) {
          res.status(otpResult.statusCode).json({
            error: otpResult.error,
            ...(otpResult.retryAfterSeconds
              ? { retryAfterSeconds: otpResult.retryAfterSeconds }
              : {}),
          });
          return;
        }

        const twoFactorToken = authService.issueTwoFactorToken(user.id, user.email);
        res.json({
          authenticated: false,
          requires2FA: true,
          twoFactorToken,
          email: user.email,
          provider: otpResult.provider,
          ...(otpResult.emailId ? { emailId: otpResult.emailId } : {}),
          ...(otpResult.previewCode ? { previewCode: otpResult.previewCode } : {}),
          cooldownSeconds: otpResult.cooldownSeconds,
          ...(otpResult.warning ? { warning: otpResult.warning } : {}),
          user: null,
        });
        return;
      }

      const session = await authService.issueSessionToken(user.id);
      if (!session) {
        res.status(500).json({ error: 'خطا در صدور نشست ورود.' });
        return;
      }

      setSessionCookie(req, res, session.token);
      const freshUser = (await authService.findUserByEmail(user.email)) || user;
      res.json({
        authenticated: true,
        requires2FA: false,
        user: toPublicUser(freshUser),
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/auth/verify-2fa', async (req, res, next) => {
    try {
      const twoFactorToken = String(req.body?.twoFactorToken || '');
      const code = toEnglishDigits(String(req.body?.code || ''))
        .replace(/[\s\-_]/g, '')
        .trim();

      const pending2fa = authService.verifyTwoFactorToken(twoFactorToken);
      if (!pending2fa) {
        res.status(401).json({
          error: 'زمان تایید دومرحله‌ای به پایان رسیده است. لطفاً دوباره با رمز عبور وارد شوید.',
        });
        return;
      }

      if (!/^\d{6}$/.test(code)) {
        res.status(400).json({ error: 'کد تایید باید دقیقاً ۶ رقم باشد.' });
        return;
      }

      const verification = await authService.verifyOtpChallenge(pending2fa.email, 'login-2fa', code);
      if (!verification.ok) {
        res.status(400).json({ error: verification.messageFa });
        return;
      }

      const user = await authService.findUserById(pending2fa.userId);
      if (!user) {
        res.status(404).json({ error: 'حساب کاربری یافت نشد.' });
        return;
      }

      const session = await authService.issueSessionToken(user.id);
      if (!session) {
        res.status(500).json({ error: 'خطا در ایجاد نشست کاربری.' });
        return;
      }

      setSessionCookie(req, res, session.token);
      const freshUser = (await authService.findUserById(user.id)) || user;
      res.json({
        authenticated: true,
        user: toPublicUser(freshUser),
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/auth/resend-2fa', async (req, res, next) => {
    try {
      const twoFactorToken = String(req.body?.twoFactorToken || '');
      const pending2fa = authService.verifyTwoFactorToken(twoFactorToken);
      if (!pending2fa) {
        res.status(401).json({
          error: 'زمان تایید دومرحله‌ای به پایان رسیده است. لطفاً دوباره با رمز عبور وارد شوید.',
        });
        return;
      }

      const user = await authService.findUserById(pending2fa.userId);
      if (!user || !user.twoFactorEnabled) {
        res.status(400).json({ error: 'تایید دومرحله‌ای برای این حساب فعال نیست.' });
        return;
      }

      const otpResult = await issueAndSendOtpChallenge({
        email: user.email,
        purpose: 'login-2fa',
        recipientName: user.fullName,
        pendingUserId: user.id,
      });

      if (!otpResult.ok) {
        res.status(otpResult.statusCode).json({
          error: otpResult.error,
          ...(otpResult.retryAfterSeconds
            ? { retryAfterSeconds: otpResult.retryAfterSeconds }
            : {}),
        });
        return;
      }

      res.json({
        sent: true,
        provider: otpResult.provider,
        ...(otpResult.emailId ? { emailId: otpResult.emailId } : {}),
        ...(otpResult.previewCode ? { previewCode: otpResult.previewCode } : {}),
        cooldownSeconds: otpResult.cooldownSeconds,
        ...(otpResult.warning ? { warning: otpResult.warning } : {}),
      });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/auth/logout', async (req, res, next) => {
    try {
      const auth = await getAuthFromRequest(req);
      const allDevices = Boolean(req.body?.allDevices);
      if (auth) {
        await authService.revokeSession(auth.user.id, auth.sessionId, allDevices);
      }
      clearSessionCookie(req, res);
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  app.patch('/api/auth/profile', requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const currentUser = req.authUser!;
      const fullName = String(req.body?.fullName ?? currentUser.fullName).trim();
      const phone = toEnglishDigits(String(req.body?.phone ?? currentUser.phone))
        .replace(/[\s-]/g, '')
        .trim();
      const nationalId = toEnglishDigits(
        String(req.body?.nationalId ?? currentUser.nationalId ?? '')
      )
        .replace(/[\s-]/g, '')
        .trim();
      const birthDate = String(req.body?.birthDate ?? currentUser.birthDate ?? '').trim();
      const newsletterOptIn =
        typeof req.body?.newsletterOptIn === 'boolean'
          ? req.body.newsletterOptIn
          : currentUser.newsletterOptIn;

      if (fullName.length < 3) {
        res.status(400).json({ error: 'نام و نام خانوادگی باید حداقل ۳ حرف باشد.' });
        return;
      }
      if (phone && !/^09\d{9}$/.test(phone)) {
        res.status(400).json({ error: 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.' });
        return;
      }

      const updated = await authService.updateUserRecord(currentUser.id, (prev) => ({
        ...prev,
        fullName,
        phone,
        nationalId: nationalId || undefined,
        birthDate: birthDate || undefined,
        newsletterOptIn,
      }));

      if (!updated) {
        res.status(404).json({ error: 'حساب کاربری یافت نشد.' });
        return;
      }

      res.json({ user: toPublicUser(updated) });
    } catch (err) {
      next(err);
    }
  });

  app.post(
    '/api/auth/change-password',
    requireAuth,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const currentUser = req.authUser!;
        const currentPassword = String(req.body?.currentPassword || '');
        const newPassword = String(req.body?.newPassword || '');

        if (currentUser.passwordHash && !verifyPassword(currentPassword, currentUser.passwordHash)) {
          res.status(400).json({ error: 'رمز عبور فعلی نادرست است.' });
          return;
        }
        if (newPassword.length < 8 || !/\d/.test(toEnglishDigits(newPassword))) {
          res.status(400).json({ error: 'رمز عبور جدید باید حداقل ۸ کاراکتر و شامل عدد باشد.' });
          return;
        }

        const updated = await authService.updateUserRecord(currentUser.id, (prev) => ({
          ...prev,
          passwordHash: hashPassword(newPassword),
        }));

        if (!updated) {
          res.status(404).json({ error: 'حساب کاربری یافت نشد.' });
          return;
        }

        const alert = buildSecurityAlertEmailContent({
          fullName: updated.fullName,
          actionLabel: currentUser.passwordHash ? 'تغییر رمز عبور' : 'تنظیم رمز عبور حساب',
        });
        void dispatchEmail({
          to: updated.email,
          subject: alert.subject,
          html: alert.html,
          idempotencyKey: `pw-change-${updated.id}-${Date.now()}`,
          tags: [{ name: 'category', value: 'security_alert' }],
        });

        res.json({ user: toPublicUser(updated) });
      } catch (err) {
        next(err);
      }
    }
  );

  app.post(
    '/api/auth/two-factor',
    requireAuth,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const currentUser = req.authUser!;
        const enabled = Boolean(req.body?.enabled);
        const currentPassword = String(req.body?.currentPassword || '');

        if (enabled && !currentUser.passwordHash) {
          res.status(400).json({
            error:
              'برای فعال‌سازی تایید دومرحله‌ای (2FA)، ابتدا باید از بخش بالا یک رمز عبور برای حساب خود تنظیم کنید.',
          });
          return;
        }

        if (currentUser.passwordHash && !verifyPassword(currentPassword, currentUser.passwordHash)) {
          res.status(400).json({ error: 'رمز عبور فعلی نادرست است.' });
          return;
        }

        const updated = await authService.updateUserRecord(currentUser.id, (prev) => ({
          ...prev,
          twoFactorEnabled: enabled,
        }));

        if (!updated) {
          res.status(404).json({ error: 'حساب کاربری یافت نشد.' });
          return;
        }

        const alert = buildSecurityAlertEmailContent({
          fullName: updated.fullName,
          actionLabel: enabled
            ? 'فعال‌سازی تایید دومرحله‌ای (2FA)'
            : 'غیرفعال‌سازی تایید دومرحله‌ای (2FA)',
        });
        void dispatchEmail({
          to: updated.email,
          subject: alert.subject,
          html: alert.html,
          idempotencyKey: `2fa-toggle-${updated.id}-${Date.now()}`,
          tags: [{ name: 'category', value: 'security_alert' }],
        });

        res.json({ user: toPublicUser(updated) });
      } catch (err) {
        next(err);
      }
    }
  );

  app.post('/api/auth/addresses', requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const currentUser = req.authUser!;
      const label = String(req.body?.label || '').trim();
      const receiverName = String(req.body?.receiverName || '').trim();
      const phone = toEnglishDigits(String(req.body?.phone || ''))
        .replace(/[\s-]/g, '')
        .trim();
      const city = String(req.body?.city || '').trim();
      const address = String(req.body?.address || '').trim();
      const postalCode = toEnglishDigits(String(req.body?.postalCode || ''))
        .replace(/[\s-]/g, '')
        .trim();
      const setAsDefault = Boolean(req.body?.isDefault);

      if (
        label.length < 2 ||
        receiverName.length < 3 ||
        !/^09\d{9}$/.test(phone) ||
        city.length < 2 ||
        address.length < 10 ||
        !/^\d{10}$/.test(postalCode)
      ) {
        res.status(400).json({ error: 'لطفاً تمام فیلدهای آدرس را به‌صورت صحیح تکمیل کنید.' });
        return;
      }

      const newAddr: StoredAddress = {
        id: crypto.randomUUID(),
        label,
        receiverName,
        phone,
        city,
        address,
        postalCode,
        isDefault: setAsDefault || currentUser.addresses.length === 0,
      };

      const updated = await authService.updateUserRecord(currentUser.id, (prev) => {
        const list = newAddr.isDefault
          ? prev.addresses.map((a) => ({ ...a, isDefault: false }))
          : prev.addresses;
        return {
          ...prev,
          addresses: [newAddr, ...list],
        };
      });

      res.json({ user: toPublicUser(updated!) });
    } catch (err) {
      next(err);
    }
  });

  app.put(
    '/api/auth/addresses/:id',
    requireAuth,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const currentUser = req.authUser!;
        const addrId = String(req.params.id);
        const label = String(req.body?.label || '').trim();
        const receiverName = String(req.body?.receiverName || '').trim();
        const phone = toEnglishDigits(String(req.body?.phone || ''))
          .replace(/[\s-]/g, '')
          .trim();
        const city = String(req.body?.city || '').trim();
        const address = String(req.body?.address || '').trim();
        const postalCode = toEnglishDigits(String(req.body?.postalCode || ''))
          .replace(/[\s-]/g, '')
          .trim();
        const setAsDefault = Boolean(req.body?.isDefault);

        if (
          label.length < 2 ||
          receiverName.length < 3 ||
          !/^09\d{9}$/.test(phone) ||
          city.length < 2 ||
          address.length < 10 ||
          !/^\d{10}$/.test(postalCode)
        ) {
          res.status(400).json({ error: 'اطلاعات ویرایش آدرس معتبر نیست.' });
          return;
        }

        const updated = await authService.updateUserRecord(currentUser.id, (prev) => ({
          ...prev,
          addresses: prev.addresses.map((item) => {
            if (item.id === addrId) {
              return {
                ...item,
                label,
                receiverName,
                phone,
                city,
                address,
                postalCode,
                isDefault: setAsDefault ? true : item.isDefault,
              };
            }
            return setAsDefault ? { ...item, isDefault: false } : item;
          }),
        }));

        res.json({ user: toPublicUser(updated!) });
      } catch (err) {
        next(err);
      }
    }
  );

  app.post(
    '/api/auth/addresses/:id/default',
    requireAuth,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const currentUser = req.authUser!;
        const addrId = String(req.params.id);
        const updated = await authService.updateUserRecord(currentUser.id, (prev) => ({
          ...prev,
          addresses: prev.addresses.map((a) => ({ ...a, isDefault: a.id === addrId })),
        }));
        res.json({ user: toPublicUser(updated!) });
      } catch (err) {
        next(err);
      }
    }
  );

  app.delete(
    '/api/auth/addresses/:id',
    requireAuth,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const currentUser = req.authUser!;
        const addrId = String(req.params.id);
        const updated = await authService.updateUserRecord(currentUser.id, (prev) => {
          const remaining = prev.addresses.filter((a) => a.id !== addrId);
          if (remaining.length > 0 && !remaining.some((a) => a.isDefault)) {
            remaining[0] = { ...remaining[0], isDefault: true };
          }
          return {
            ...prev,
            addresses: remaining,
          };
        });
        res.json({ user: toPublicUser(updated!) });
      } catch (err) {
        next(err);
      }
    }
  );

  app.put('/api/auth/wishlist', requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const currentUser = req.authUser!;
      const rawList = Array.isArray(req.body?.wishlist) ? (req.body.wishlist as unknown[]) : null;
      if (!rawList) {
        res.status(400).json({ error: 'لیست علاقه‌مندی‌ها باید به‌صورت آرایه ارسال شود.' });
        return;
      }

      const cleaned: string[] = Array.from(
        new Set<string>(rawList.map((item) => String(item ?? '').trim()).filter(Boolean))
      ).slice(0, 100);

      const updated = await authService.updateUserRecord(currentUser.id, (prev) => ({
        ...prev,
        wishlist: cleaned,
      }));

      if (!updated) {
        res.status(404).json({ error: 'حساب کاربری یافت نشد.' });
        return;
      }

      res.json({ user: toPublicUser(updated), wishlist: updated.wishlist });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/auth/wishlist/toggle', requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const currentUser = req.authUser!;
      const productId = String(req.body?.productId || '').trim();
      if (!productId || productId.length > 120) {
        res.status(400).json({ error: 'شناسه محصول معتبر نیست.' });
        return;
      }

      let added = false;
      const updated = await authService.updateUserRecord(currentUser.id, (prev) => {
        const exists = prev.wishlist.includes(productId);
        added = !exists;
        const nextWishlist = exists
          ? prev.wishlist.filter((id) => id !== productId)
          : [...prev.wishlist, productId].slice(0, 100);
        return {
          ...prev,
          wishlist: nextWishlist,
        };
      });

      if (!updated) {
        res.status(404).json({ error: 'حساب کاربری یافت نشد.' });
        return;
      }

      res.json({
        user: toPublicUser(updated),
        wishlist: updated.wishlist,
        added,
      });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/orders/mine', requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const orders = await authService.listUserOrders(req.authUser!.id);
      res.json({ orders });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/orders', async (req, res, next) => {
    try {
      const auth = await getAuthFromRequest(req);
      const body = req.body || {};
      const orderCode = String(body.orderCode || '')
        .trim()
        .toUpperCase();
      const customerName = String(body.customerName || '').trim();
      const customerPhone = toEnglishDigits(String(body.customerPhone || '')).trim();
      const city = String(body.city || '').trim();
      const shippingAddress = String(body.shippingAddress || '').trim();
      const postalCode = toEnglishDigits(String(body.postalCode || '')).trim();
      const items = Array.isArray(body.items) ? body.items : [];

      if (
        !orderCode ||
        customerName.length < 2 ||
        !customerPhone ||
        !shippingAddress ||
        items.length === 0
      ) {
        res.status(400).json({ error: 'اطلاعات سفارش ناقص یا نامعتبر است.' });
        return;
      }

      const orderPayload: StoredOrderRecord = {
        orderCode,
        shaparakRef: String(body.shaparakRef || '84729104'),
        customerName,
        customerPhone,
        city,
        shippingAddress,
        postalCode,
        deliverySlot: body.deliverySlot === 'standard' ? 'standard' : 'express',
        couponCode: body.couponCode ? String(body.couponCode) : null,
        subtotal: Number(body.subtotal || 0),
        productDiscount: Number(body.productDiscount || 0),
        couponDiscount: Number(body.couponDiscount || 0),
        shippingCost: Number(body.shippingCost || 0),
        totalAmount: Number(body.totalAmount || 0),
        status:
          body.status === 'paid' || body.status === 'shipped' || body.status === 'delivered'
            ? body.status
            : 'preparing',
        deliveryPin: String(body.deliveryPin || ''),
        imeiSample: String(body.imeiSample || ''),
        items,
        createdAt: String(body.createdAt || 'ثبت شده در حساب کاربری'),
      };

      const saved = await authService.createOrder(auth?.user.id ?? null, orderPayload);

      if (auth?.user) {
        const totalFormatted = new Intl.NumberFormat('fa-IR').format(saved.totalAmount);
        const emailContent = buildOrderReceiptEmailContent({
          fullName: auth.user.fullName,
          orderCode: saved.orderCode,
          totalFormatted,
          itemsCount: saved.items.length,
        });

        void dispatchEmail({
          to: auth.user.email,
          subject: emailContent.subject,
          html: emailContent.html,
          idempotencyKey: `order-receipt-${saved.orderCode}`,
          tags: [{ name: 'category', value: 'order_receipt' }],
        });
      }

      res.status(201).json({ order: saved, syncedToDatabase: true });
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/orders/:code', async (req, res, next) => {
    try {
      const code = String(req.params.code || '').trim();
      if (!code) {
        res.status(400).json({ error: 'کد سفارش الزامی است.' });
        return;
      }
      const order = await authService.findOrderByCode(code);
      if (!order) {
        res.status(404).json({ error: 'سفارش یافت نشد.' });
        return;
      }
      res.json({ order });
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/orders/notify', requireAuth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const currentUser = req.authUser!;
      const orderCode = String(req.body?.orderCode || '').trim();
      const totalFormatted = String(req.body?.totalFormatted || '').trim();
      const itemsCount = Number(req.body?.itemsCount || 1);

      if (!orderCode) {
        res.status(400).json({ error: 'orderCode is required' });
        return;
      }

      const emailContent = buildOrderReceiptEmailContent({
        fullName: currentUser.fullName,
        orderCode,
        totalFormatted,
        itemsCount,
      });

      const delivery = await dispatchEmail({
        to: currentUser.email,
        subject: emailContent.subject,
        html: emailContent.html,
        idempotencyKey: `order-receipt-${orderCode}`,
        tags: [{ name: 'category', value: 'order_receipt' }],
      });

      res.json(delivery);
    } catch (err) {
      next(err);
    }
  });

  if (!isProd && !options.disableVite) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    const indexPath = path.join(distDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(indexPath);
      });
    } else {
      app.get('/', (_req, res) => {
        res.json({
          service: 'amir-mobile-api',
          ok: true,
          health: '/api/health',
        });
      });
    }
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[Server Error]', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'خطای داخلی سرور رخ داد.',
    });
  });

  return app;
}

const isEntrypoint =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isEntrypoint) {
  const port = Number(process.env.PORT || 3000);
  createServerApp()
    .then((app) => {
      app.listen(port, '0.0.0.0', () => {
        console.log(`Amir Mobile Store server running on http://0.0.0.0:${port}`);
      });
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
