import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from './apiClient';
import { adminApi } from './adminApi';
import {
  normalizeAuditLogEntry,
  normalizeCustomerDetail,
  normalizeOrder,
  normalizeProduct,
  parseAdminMeResponse,
  parseDashboardResponse,
  parsePaginatedResponse,
} from './adminParsers';

test('parseAdminMeResponse extracts user and enforces strict admin role mapping', () => {
  const res = parseAdminMeResponse({
    user: {
      id: 'u-1',
      email: 'admin@codenameamir.ir',
      fullName: 'مدیر سیستم',
      role: 'admin',
    },
  });
  assert.equal(res.user.role, 'admin');
  assert.equal(res.user.fullName, 'مدیر سیستم');
  assert.deepEqual(res.user.addresses, []);

  const nonAdmin = parseAdminMeResponse({
    id: 'u-2',
    email: 'customer@example.com',
    full_name: 'مشتری',
    role: 'superadmin',
  });
  assert.equal(nonAdmin.user.role, 'customer');

  assert.throws(() => parseAdminMeResponse({}), (err: unknown) => err instanceof ApiError && err.status === 502);
});

test('parseDashboardResponse validates metrics and provides safe arrays for missing optional arrays', () => {
  const partialStats = parseDashboardResponse({
    metrics: {
      totalProducts: 14,
      totalOrders: 6,
      confirmedRevenue: 120000000,
    },
  });
  assert.equal(partialStats.metrics.totalProducts, 14);
  assert.deepEqual(partialStats.statusBreakdown, []);
  assert.deepEqual(partialStats.revenueSeries, []);
  assert.deepEqual(partialStats.lowStockProducts, []);
  assert.deepEqual(partialStats.recentOrders, []);

  const flatStats = parseDashboardResponse({
    total_products: 10,
    total_orders: 3,
    total_customers: 20,
    confirmed_revenue: 50000000,
    status_breakdown: { paid: 2, delivered: 1 },
  });
  assert.equal(flatStats.metrics.totalProducts, 10);
  assert.equal(flatStats.statusBreakdown.length, 2);

  assert.throws(
    () => parseDashboardResponse({}),
    (err: unknown) => err instanceof ApiError && err.status === 502
  );
  assert.throws(
    () => parseDashboardResponse({ ok: true }),
    (err: unknown) => err instanceof ApiError && err.status === 502
  );
});

test('parsePaginatedResponse normalizes items and rejects malformed objects without arrays', () => {
  const paged = parsePaginatedResponse(
    {
      products: [{ id: 'p-1', name_fa: 'آیفون', stock_count: 3, in_stock: true }],
      total: 1,
      page: 1,
      pageSize: 12,
      totalPages: 1,
    },
    normalizeProduct,
    ['products']
  );
  assert.equal(paged.items.length, 1);
  assert.equal(paged.items[0].nameFa, 'آیفون');
  assert.deepEqual(paged.items[0].colors, []);
  assert.deepEqual(paged.items[0].storageOptions, []);

  assert.throws(
    () => parsePaginatedResponse({}, normalizeProduct, ['products']),
    (err: unknown) => err instanceof ApiError && err.status === 502
  );
});

test('entity normalizers guarantee safe nested arrays and objects', () => {
  const order = normalizeOrder({ order_code: 'AMIR-1001', status: 'unknown_status' });
  assert.deepEqual(order.items, []);
  assert.equal(order.orderCode, 'AMIR-1001');

  const customer = normalizeCustomerDetail({ id: 'c-1', email: 'c@example.com' });
  assert.deepEqual(customer.addresses, []);
  assert.deepEqual(customer.orders, []);

  const log = normalizeAuditLogEntry({ action: 'product.create' });
  assert.deepEqual(log.details, {});
});

test('adminApi.getDashboard requests /api/admin/stats and adminApi.verifyAdminAccess requests /api/admin/me with credentials: include', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; credentials?: RequestCredentials }> = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    calls.push({ url, credentials: init?.credentials });

    if (url.includes('/api/admin/me')) {
      return new Response(
        JSON.stringify({
          user: { id: 'adm-1', email: 'admin@codenameamir.ir', fullName: 'مدیر', role: 'admin' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (url.includes('/api/admin/stats')) {
      return new Response(
        JSON.stringify({
          metrics: { totalProducts: 5, totalOrders: 2, confirmedRevenue: 1000000 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response('{}', { status: 404 });
  }) as typeof fetch;

  try {
    const me = await adminApi.verifyAdminAccess();
    assert.equal(me.user.role, 'admin');

    const stats = await adminApi.getDashboard(5);
    assert.equal(stats.metrics.totalProducts, 5);
    assert.deepEqual(stats.statusBreakdown, []);

    assert.equal(calls.length, 2);
    assert.match(calls[0].url, /\/api\/admin\/me$/);
    assert.equal(calls[0].credentials, 'include');
    assert.match(calls[1].url, /\/api\/admin\/stats\?lowStockThreshold=5$/);
    assert.equal(calls[1].credentials, 'include');
    assert.ok(!calls.some((c) => c.url.includes('/api/admin/dashboard')));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
