export interface CookieOptionsShape {
  httpOnly: boolean;
  sameSite: 'none' | 'lax' | 'strict';
  secure: boolean;
  path: string;
  maxAge?: number;
  domain?: string;
}

const DEV_FALLBACK_SESSION_SECRET = 'amir-mobile-dev-session-secret-not-for-prod-0000';

export function parseCorsOrigins(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins: string[],
  isProd: boolean,
  selfOrigin?: string
): boolean {
  if (!origin) return true;
  const normalized = origin.trim().replace(/\/+$/, '');
  if (selfOrigin && normalized === selfOrigin.trim().replace(/\/+$/, '')) {
    return true;
  }
  if (allowedOrigins.length > 0) {
    return allowedOrigins.includes(normalized);
  }
  if (isProd) {
    return false;
  }
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized);
}

export function resolveSessionSecret(env: NodeJS.ProcessEnv = process.env): string {
  const isProd = env.NODE_ENV === 'production';
  const raw = (env.AUTH_SESSION_SECRET || '').trim();

  if (isProd) {
    if (raw.length < 32) {
      throw new Error(
        'FATAL: AUTH_SESSION_SECRET must be set to a strong secret (at least 32 characters) in production.'
      );
    }
    return raw;
  }

  return raw.length >= 16 ? raw : DEV_FALLBACK_SESSION_SECRET;
}

export function resolveSupabaseAdminConfig(env: NodeJS.ProcessEnv = process.env): {
  url: string | null;
  serviceRoleKey: string | null;
  configured: boolean;
} {
  const isProd = env.NODE_ENV === 'production';
  const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim() || null;
  const serviceRoleKey = (env.SUPABASE_SERVICE_ROLE_KEY || '').trim() || null;
  const configured = Boolean(url && serviceRoleKey);

  if (isProd && !configured) {
    throw new Error(
      'FATAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production for persistent auth & OTP storage.'
    );
  }

  return { url, serviceRoleKey, configured };
}

export function resolveCorsConfig(env: NodeJS.ProcessEnv = process.env): {
  allowedOrigins: string[];
  configured: boolean;
} {
  const isProd = env.NODE_ENV === 'production';
  const allowedOrigins = parseCorsOrigins(env.CORS_ORIGIN);

  if (isProd && allowedOrigins.length === 0) {
    throw new Error(
      'FATAL: CORS_ORIGIN must be configured in production (e.g. https://amir-mobile-store.codenameamir.ir).'
    );
  }

  return {
    allowedOrigins,
    configured: allowedOrigins.length > 0,
  };
}

export function getSessionCookieOptions(params: {
  isProd: boolean;
  isHttpsRequest: boolean;
  maxAgeMs?: number;
  cookieDomain?: string;
}): CookieOptionsShape {
  const useCrossSiteHttps =
    (params.isProd || params.isHttpsRequest) && process.env.ALLOW_INSECURE_COOKIE !== 'true';

  const base: CookieOptionsShape = {
    httpOnly: true,
    sameSite: useCrossSiteHttps ? 'none' : 'lax',
    secure: useCrossSiteHttps,
    path: '/',
  };

  if (typeof params.maxAgeMs === 'number') {
    base.maxAge = params.maxAgeMs;
  }
  if (params.cookieDomain && params.cookieDomain.trim()) {
    base.domain = params.cookieDomain.trim();
  }

  return base;
}
