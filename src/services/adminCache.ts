interface CacheEntry<T> {
  data: T;
  updatedAt: number;
}

const DEFAULT_STALE_MS = 45_000;
const DEFAULT_MAX_AGE_MS = 5 * 60_000;

const cacheStore = new Map<string, CacheEntry<unknown>>();
const inflightStore = new Map<string, Promise<unknown>>();

export function getCachedValue<T>(
  key: string,
  maxAgeMs = DEFAULT_MAX_AGE_MS
): { data: T; isFresh: boolean } | null {
  const entry = cacheStore.get(key);
  if (!entry) return null;
  const age = Date.now() - entry.updatedAt;
  if (age > maxAgeMs) {
    cacheStore.delete(key);
    return null;
  }
  return {
    data: entry.data as T,
    isFresh: age <= DEFAULT_STALE_MS,
  };
}

export function setCachedValue<T>(key: string, data: T): void {
  cacheStore.set(key, {
    data,
    updatedAt: Date.now(),
  });
}

export function invalidateCachePrefix(prefix: string): void {
  for (const key of cacheStore.keys()) {
    if (key.startsWith(prefix)) {
      cacheStore.delete(key);
    }
  }
}

export function clearAllAdminCache(): void {
  cacheStore.clear();
  inflightStore.clear();
}

export async function fetchWithDedupe<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const existing = inflightStore.get(key) as Promise<T> | undefined;
  if (existing) {
    return existing;
  }

  const promise = fetcher()
    .then((result) => {
      setCachedValue(key, result);
      return result;
    })
    .finally(() => {
      inflightStore.delete(key);
    });

  inflightStore.set(key, promise);
  return promise;
}
