import { buildApiUrl } from '../config/env';

export class ApiError extends Error {
  status: number;
  retryAfterSeconds?: number;
  payload?: unknown;

  constructor(message: string, status: number, retryAfterSeconds?: number, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
    this.payload = payload;
  }
}

export function isEndpointUnsupportedError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  if (err.status === 404 || err.status === 405 || err.status === 501) {
    return true;
  }
  return Boolean(
    err.payload &&
      typeof err.payload === 'object' &&
      !Array.isArray(err.payload) &&
      (err.payload as Record<string, unknown>).htmlFallback === true
  );
}

export interface ApiClientHooks {
  onUnauthorized?: () => void;
  onForbidden?: () => void;
}

let activeHooks: ApiClientHooks = {};

export function registerApiHooks(hooks: ApiClientHooks): void {
  activeHooks = hooks;
}

export function buildQueryString(
  params: Record<string, string | number | boolean | null | undefined>
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : '';
}

export interface RequestOptions extends RequestInit {
  skipAuthRedirect?: boolean;
  baseUrl?: string;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 25_000;

export function readCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const meta = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')?.trim();
    if (meta) return meta;
    const cookieMatch = document.cookie.match(/(?:^|;\s*)(?:XSRF-TOKEN|csrf_token)=([^;]+)/i);
    return cookieMatch ? decodeURIComponent(cookieMatch[1]) : null;
  } catch {
    return null;
  }
}

export async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuthRedirect, baseUrl, headers, timeoutMs = DEFAULT_TIMEOUT_MS, signal, ...init } = options;
  const url = baseUrl !== undefined ? buildApiUrl(path, baseUrl) : buildApiUrl(path);

  const controller = new AbortController();
  let timedOut = false;
  const timer =
    timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs)
      : null;

  const forwardAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', forwardAbort, { once: true });
  }

  const csrfToken = readCsrfToken();

  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      signal: controller.signal,
      credentials: 'include',
      headers: {
        ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
        'X-Requested-With': 'XMLHttpRequest',
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        ...(headers || {}),
      },
    });
  } catch {
    if (timedOut) {
      throw new ApiError(
        'پاسخ‌دهی سرور بیش از حد طول کشید (Timeout). در صورت خواب بودن سرور یا کندی پایگاه داده، لطفاً دوباره تلاش کنید.',
        408
      );
    }
    throw new ApiError(
      'ارتباط با سرور API برقرار نشد. لطفاً اتصال اینترنت یا تنظیمات دامنه API را بررسی کنید.',
      0
    );
  } finally {
    if (timer) clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', forwardAbort);
  }

  const rawText = await res.text().catch(() => '');
  let parsed: unknown = {};
  let jsonParseFailed = false;
  if (rawText.trim()) {
    try {
      parsed = JSON.parse(rawText) as unknown;
    } catch {
      jsonParseFailed = true;
      parsed = {};
    }
  }

  const parsedRecord =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};

  if (!res.ok) {
    if (res.status === 401 && !skipAuthRedirect) {
      activeHooks.onUnauthorized?.();
    } else if (res.status === 403 && !skipAuthRedirect) {
      activeHooks.onForbidden?.();
    }

    const message =
      typeof parsedRecord.error === 'string' && parsedRecord.error.trim()
        ? parsedRecord.error
        : `خطای سرور (کد ${res.status})`;
    const retryAfterSeconds =
      typeof parsedRecord.retryAfterSeconds === 'number'
        ? parsedRecord.retryAfterSeconds
        : undefined;

    throw new ApiError(message, res.status, retryAfterSeconds, parsed);
  }

  if (jsonParseFailed || parsed === null || typeof parsed !== 'object') {
    const contentType = res.headers?.get('content-type')?.toLowerCase() ?? '';
    const trimmedRaw = rawText.trimStart().toLowerCase();
    const isHtmlFallback =
      contentType.includes('text/html') ||
      trimmedRaw.startsWith('<!doctype') ||
      trimmedRaw.startsWith('<html');

    throw new ApiError(
      isHtmlFallback
        ? 'پاسخ HTML به‌جای JSON دریافت شد. احتمالاً این مسیر در سرور API پیاده‌سازی نشده یا آدرس API به‌درستی تنظیم نشده است.'
        : 'پاسخ دریافتی از سرور در قالب JSON معتبر نیست. لطفاً آدرس API یا وضعیت سرویس را بررسی کنید.',
      res.status || 502,
      undefined,
      isHtmlFallback ? { htmlFallback: true, contentType } : undefined
    );
  }

  return parsed as T;
}
