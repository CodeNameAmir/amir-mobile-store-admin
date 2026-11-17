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
}

export async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { skipAuthRedirect, baseUrl, headers, ...init } = options;
  const url = baseUrl !== undefined ? buildApiUrl(path, baseUrl) : buildApiUrl(path);

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(headers || {}),
      },
    });
  } catch {
    throw new ApiError(
      'ارتباط با سرور API برقرار نشد. لطفاً اتصال اینترنت یا تنظیمات دامنه API را بررسی کنید.',
      0
    );
  }

  const rawText = await res.text().catch(() => '');
  let parsed: Record<string, unknown> = {};
  if (rawText) {
    try {
      parsed = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
  }

  if (!res.ok) {
    if (res.status === 401 && !skipAuthRedirect) {
      activeHooks.onUnauthorized?.();
    } else if (res.status === 403 && !skipAuthRedirect) {
      activeHooks.onForbidden?.();
    }

    const message =
      typeof parsed.error === 'string' && parsed.error.trim()
        ? parsed.error
        : `خطای سرور (کد ${res.status})`;
    const retryAfterSeconds =
      typeof parsed.retryAfterSeconds === 'number' ? parsed.retryAfterSeconds : undefined;

    throw new ApiError(message, res.status, retryAfterSeconds, parsed);
  }

  return parsed as T;
}
