import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError, buildQueryString, registerApiHooks, requestJson } from './apiClient';

test('buildQueryString omits empty values and serializes active parameters', () => {
  const qs = buildQueryString({
    search: 'iPhone',
    page: 2,
    category: '',
    brand: undefined,
    inStockOnly: true,
  });
  assert.equal(qs, '?search=iPhone&page=2&inStockOnly=true');
  assert.equal(buildQueryString({ a: '', b: null }), '');
});

test('requestJson sends credentials: include and triggers 401 hook', async () => {
  let unauthorizedCalled = 0;
  registerApiHooks({
    onUnauthorized: () => {
      unauthorizedCalled += 1;
    },
  });

  const originalFetch = globalThis.fetch;
  let capturedInit: RequestInit | undefined;

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedInit = init;
    return new Response(JSON.stringify({ error: 'نشست منقضی شد' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    await assert.rejects(
      () => requestJson('/api/admin/stats', { baseUrl: 'https://api.example.com' }),
      (err: unknown) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 401);
        assert.equal(err.message, 'نشست منقضی شد');
        return true;
      }
    );
    assert.equal(capturedInit?.credentials, 'include');
    assert.equal(unauthorizedCalled, 1);
  } finally {
    globalThis.fetch = originalFetch;
    registerApiHooks({});
  }
});

test('requestJson skips auth redirect hooks when skipAuthRedirect is true', async () => {
  let unauthorizedCalled = 0;
  registerApiHooks({
    onUnauthorized: () => {
      unauthorizedCalled += 1;
    },
  });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: 'ایمیل یا رمز عبور اشتباه است' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })) as typeof fetch;

  try {
    await assert.rejects(
      () =>
        requestJson('/api/auth/login-password', {
          method: 'POST',
          skipAuthRedirect: true,
          baseUrl: 'https://api.example.com',
        }),
      (err: unknown) => err instanceof ApiError && err.status === 401
    );
    assert.equal(unauthorizedCalled, 0);
  } finally {
    globalThis.fetch = originalFetch;
    registerApiHooks({});
  }
});

test('requestJson rejects HTTP 200 non-JSON HTML responses with ApiError', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response('<!doctype html><html><body>SPA Fallback</body></html>', {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    })) as typeof fetch;

  try {
    await assert.rejects(
      () => requestJson('/api/admin/stats', { baseUrl: 'https://api.example.com' }),
      (err: unknown) => err instanceof ApiError && err.status === 200
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('requestJson maps network fetch failure to ApiError with status 0', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new TypeError('Failed to fetch');
  }) as typeof fetch;

  try {
    await assert.rejects(
      () => requestJson('/api/admin/stats', { baseUrl: 'https://api.example.com' }),
      (err: unknown) => err instanceof ApiError && err.status === 0
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('requestJson aborts stalled requests and throws ApiError with status 408', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      });
    })) as typeof fetch;

  try {
    await assert.rejects(
      () =>
        requestJson('/api/admin/stats', {
          baseUrl: 'https://api.example.com',
          timeoutMs: 25,
        }),
      (err: unknown) => err instanceof ApiError && err.status === 408
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
