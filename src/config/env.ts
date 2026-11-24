export const PRODUCTION_ADMIN_HOSTNAME = 'admin-panel-ams.codenameamir.ir';
export const DEFAULT_PRODUCTION_API_URL = 'https://api.codenameamir.ir';
export const DEFAULT_STOREFRONT_URL = 'https://amir-mobile-store.codenameamir.ir';

function isSafeHttpUrl(candidate: string): boolean {
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function isDirectSupabaseHost(candidate: string): boolean {
  try {
    const host = new URL(candidate).hostname.toLowerCase();
    return host.endsWith('.supabase.co') || host.endsWith('.supabase.in');
  } catch {
    return false;
  }
}

export function resolveApiBaseUrl(
  envApiBaseUrl?: string,
  envLegacyApiUrl?: string,
  runtimeHostname?: string
): string {
  const candidates = [envApiBaseUrl, envLegacyApiUrl];
  for (const raw of candidates) {
    const configured = (raw || '').trim().replace(/\/+$/, '');
    if (configured && isSafeHttpUrl(configured) && !isDirectSupabaseHost(configured)) {
      return configured;
    }
  }

  if (runtimeHostname === PRODUCTION_ADMIN_HOSTNAME) {
    return DEFAULT_PRODUCTION_API_URL;
  }

  return '';
}

export function resolveStorefrontUrl(envStorefrontUrl?: string): string {
  const configured = (envStorefrontUrl || '').trim().replace(/\/+$/, '');
  if (configured && isSafeHttpUrl(configured) && !isDirectSupabaseHost(configured)) {
    return configured;
  }
  return DEFAULT_STOREFRONT_URL;
}

const viteEnv =
  typeof import.meta !== 'undefined' &&
  (import.meta as { env?: Record<string, string | undefined> }).env
    ? (import.meta as { env?: Record<string, string | undefined> }).env
    : undefined;

const runtimeHostname =
  typeof window !== 'undefined' ? window.location.hostname : undefined;

export const API_BASE_URL = resolveApiBaseUrl(
  viteEnv?.VITE_API_BASE_URL,
  viteEnv?.VITE_API_URL,
  runtimeHostname
);

export const STOREFRONT_URL = resolveStorefrontUrl(viteEnv?.VITE_STOREFRONT_URL);

export function buildApiUrl(path: string, baseUrl = API_BASE_URL): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}
