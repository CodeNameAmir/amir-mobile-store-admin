import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from './apiClient';
import { adminApi } from './adminApi';
import { clearAllAdminCache, getCachedValue, setCachedValue } from './adminCache';

test('adminApi.updateProductStock falls back from /stock 404 to PATCH /products/:id and invalidates caches', async () => {
  clearAllAdminCache();
  setCachedValue('products:list::all:all:all:newest:1:5', { items: [], total: 0, totalPages: 1 });

  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; method?: string; body?: BodyInit | null }> = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, method: init?.method, body: init?.body });

    if (url.endsWith('/api/admin/products/iphone-16/stock') && init?.method === 'PATCH') {
      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.endsWith('/api/admin/products/iphone-16') && init?.method === 'PATCH') {
      return new Response(
        JSON.stringify({
          product: { id: 'iphone-16', nameFa: 'آیفون ۱۶', stockCount: 14, inStock: true },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response('{}', { status: 500 });
  }) as typeof fetch;

  try {
    const res = await adminApi.updateProductStock('iphone-16', {
      stockCount: 14,
      inStock: true,
    });
    assert.equal(calls.length, 2);
    assert.match(calls[0].url, /\/api\/admin\/products\/iphone-16\/stock$/);
    assert.match(calls[1].url, /\/api\/admin\/products\/iphone-16$/);
    assert.equal(res.product?.stockCount, 14);
    assert.equal(getCachedValue('products:list::all:all:all:newest:1:5'), null);
  } finally {
    globalThis.fetch = originalFetch;
    clearAllAdminCache();
  }
});

test('adminApi.updateOrder strips # and falls back across 404 routes to orderId or /status and supports minimal ack', async () => {
  clearAllAdminCache();
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; method?: string }> = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, method: init?.method });

    // Simulate backend only implementing PATCH /api/admin/orders/:id/status returning { ok: true }
    if (url.endsWith('/api/admin/orders/ord-uuid-99/status') && init?.method === 'PATCH') {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Route not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const res = await adminApi.updateOrder(
      '#AMIR-1042',
      { status: 'shipped', adminNote: 'ارسال شد' },
      'ord-uuid-99'
    );
    assert.equal(res.order, null);
    assert.deepEqual(
      calls.map((c) => `${c.method} ${new URL(c.url, 'http://localhost').pathname}`),
      [
        'PATCH /api/admin/orders/AMIR-1042',
        'PATCH /api/admin/orders/AMIR-1042/status',
        'PATCH /api/admin/orders/ord-uuid-99',
        'PATCH /api/admin/orders/ord-uuid-99/status',
      ]
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('adminApi.updateOrder stops immediately on non-404 errors (e.g., 400 validation error)', async () => {
  const originalFetch = globalThis.fetch;
  let count = 0;

  globalThis.fetch = (async () => {
    count += 1;
    return new Response(JSON.stringify({ error: 'وضعیت سفارش نامعتبر است' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    await assert.rejects(
      () => adminApi.updateOrder('AMIR-1042', { status: 'delivered' }, 'ord-uuid-99'),
      (err: unknown) => err instanceof ApiError && err.status === 400
    );
    assert.equal(count, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('adminApi.getProduct falls back to listProducts when GET /products/:id returns 404', async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push(url);
    const pathname = new URL(url, 'http://localhost').pathname;

    if (pathname === '/api/admin/products/galaxy-s25') {
      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (pathname === '/api/admin/products') {
      return new Response(
        JSON.stringify({
          products: [
            {
              id: 'galaxy-s25',
              slug: 'galaxy-s25',
              nameFa: 'گلکسی S25',
              nameEn: 'Samsung Galaxy S25',
              brand: 'Samsung',
              category: 'phones',
              price: 55000000,
              stockCount: 8,
              inStock: true,
            },
          ],
          total: 1,
          page: 1,
          pageSize: 50,
          totalPages: 1,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response('{}', { status: 500 });
  }) as typeof fetch;

  try {
    const res = await adminApi.getProduct('galaxy-s25');
    assert.equal(res.product.id, 'galaxy-s25');
    assert.equal(res.product.nameFa, 'گلکسی S25');
    assert.equal(calls.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
