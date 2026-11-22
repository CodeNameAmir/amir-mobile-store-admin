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

test('adminApi V3 catalog, attributes, variants, warehouse movements (including 409 Conflict), and roles send credentials: include', async () => {
  clearAllAdminCache();
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; method?: string; credentials?: RequestCredentials; body?: string }> = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const pathname = new URL(url, 'http://localhost').pathname;
    calls.push({
      url,
      method: init?.method || 'GET',
      credentials: init?.credentials,
      body: typeof init?.body === 'string' ? init.body : undefined,
    });

    if (pathname === '/api/admin/categories') {
      return new Response(
        JSON.stringify({ categories: [{ id: 'c1', label: 'موبایل', slug: 'phones', sortOrder: 1 }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (pathname === '/api/admin/brands' && init?.method === 'POST') {
      return new Response(
        JSON.stringify({ brand: { id: 'b1', name: 'Apple', labelFa: 'اپل', slug: 'apple' } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (pathname === '/api/admin/warranties' && init?.method === 'POST') {
      return new Response(
        JSON.stringify({ warranty: { id: 'w1', providerName: 'امیر سرویس', durationMonths: 18 } }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (pathname === '/api/admin/products/p1/attributes' && init?.method === 'PUT') {
      return new Response(
        JSON.stringify({ attributeValues: [{ attributeId: 'a1', valueText: 'AMOLED' }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (pathname === '/api/admin/products/p1/variants' && init?.method === 'POST') {
      return new Response(
        JSON.stringify({ variant: { id: 'v1', sku: 'APL-16-ZAA', priceToman: 90000000 } }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (pathname === '/api/admin/stock-movements' && init?.method === 'POST') {
      return new Response(
        JSON.stringify({ error: 'موجودی انبار پس از این خروج منفی می‌شود و امکان ثبت وجود ندارد.' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (pathname === '/api/admin/roles') {
      return new Response(
        JSON.stringify({ roles: [{ id: 'r1', name: 'admin', titleFa: 'مدیر کل', description: 'دسترسی کامل', isSystem: true }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response('{}', { status: 404 });
  }) as typeof fetch;

  try {
    const cats = await adminApi.listCategories();
    assert.equal(cats.categories.length, 1);

    const savedBrand = await adminApi.saveBrand({
      id: 'b1',
      name: 'Apple',
      labelFa: 'اپل',
      slug: 'apple',
      logoUrl: '',
      websiteUrl: '',
      isFeatured: true,
      isActive: true,
    });
    assert.equal(savedBrand.brand.id, 'b1');

    const war = await adminApi.createWarranty({
      providerName: 'امیر سرویس',
      durationMonths: 18,
      coverageFa: 'کامل',
      termsUrl: '',
      isActive: true,
    });
    assert.equal(war.warranty.durationMonths, 18);

    const attrs = await adminApi.updateProductAttributes('p1', [
      { attributeId: 'a1', valueText: 'AMOLED' },
    ]);
    assert.equal(attrs.attributeValues[0].valueText, 'AMOLED');

    const variant = await adminApi.createProductVariant('p1', {
      sku: 'APL-16-ZAA',
      barcode: '',
      partNumber: 'ZA/A',
      colorNameFa: 'مشکی',
      colorNameEn: 'Black',
      colorHex: '#000000',
      storage: '256GB',
      ram: '8GB',
      simType: 'دو سیم‌کارت',
      warrantyId: 'w1',
      priceToman: 90000000,
      originalPriceToman: null,
      costPriceToman: 80000000,
      isPublished: true,
    });
    assert.equal(variant.variant.sku, 'APL-16-ZAA');

    await assert.rejects(
      () =>
        adminApi.createStockMovement({
          warehouseId: 'wh1',
          variantId: 'v1',
          movementType: 'order_sale',
          quantityChange: -99,
          idempotencyKey: 'key-123',
        }),
      (err: unknown) =>
        err instanceof ApiError &&
        err.status === 409 &&
        err.message === 'موجودی انبار پس از این خروج منفی می‌شود و امکان ثبت وجود ندارد.'
    );

    const roles = await adminApi.listRoles();
    assert.equal(roles.roles[0].titleFa, 'مدیر کل');

    assert.ok(calls.every((c) => c.credentials === 'include'));
  } finally {
    globalThis.fetch = originalFetch;
    clearAllAdminCache();
  }
});

test('adminApi.loginWithPassword supports username login with credentials: include and 400 email-field fallback', async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ body: Record<string, unknown>; credentials?: RequestCredentials }> = [];

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
    requests.push({ body, credentials: init?.credentials });

    if (!body.email) {
      return new Response(JSON.stringify({ error: 'ایمیل الزامی است' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        authenticated: true,
        user: {
          id: 'u-1',
          email: 'amir.mohammad.salimi.helli@gmail.com',
          username: 'CodeNameAmir',
          fullName: 'امیر محمد سلیمی',
          role: 'admin',
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof fetch;

  try {
    const res = await adminApi.loginWithPassword({
      identifier: 'CodeNameAmir',
      username: 'CodeNameAmir',
      password: 'SecretPassword123',
    });
    assert.equal(res.authenticated, true);
    assert.equal(res.user?.username, 'CodeNameAmir');
    assert.equal(requests.length, 2);
    assert.equal(requests[0].body.username, 'CodeNameAmir');
    assert.equal(requests[1].body.email, 'CodeNameAmir');
    assert.ok(requests.every((r) => r.credentials === 'include'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
