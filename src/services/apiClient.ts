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
  return (
    err instanceof ApiError &&
    (err.status === 404 || err.status === 405 || err.status === 501)
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

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      signal: controller.signal,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
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
    throw new ApiError(
      'پاسخ دریافتی از سرور در قالب JSON معتبر نیست. لطفاً آدرس API یا وضعیت سرویس را بررسی کنید.',
      res.status || 502
    );
  }

  return parsed as T;
}
