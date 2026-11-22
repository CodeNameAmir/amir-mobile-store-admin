import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from './apiClient';
import { adminApi } from './adminApi';
import {
  normalizeAuditLogEntry,
  normalizeBrand,
  normalizeCategory,
  normalizeCustomerDetail,
  normalizeOrder,
  normalizeProduct,
  normalizeProductVariant,
  normalizeRbacRole,
  normalizeStockMovement,
  normalizeTechnicalAttribute,
  normalizeWarehouse,
  normalizeWarehouseStockItem,
  normalizeWarranty,
  parseAdminMeResponse,
  parseDashboardResponse,
  parseListWithTotal,
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

test('V3 entity normalizers map snake_case and camelCase fields accurately', () => {
  const cat = normalizeCategory({
    id: 'c-1',
    label: 'گوشی',
    title_en: 'Phones',
    slug: 'phones',
    icon_name: 'Smartphone',
    parent_id: null,
    sort_order: 2,
    is_active: true,
  });
  assert.equal(cat.titleEn, 'Phones');
  assert.equal(cat.iconName, 'Smartphone');
  assert.equal(cat.sortOrder, 2);

  const brand = normalizeBrand({
    id: 'apple',
    name: 'Apple',
    label_fa: 'اپل',
    slug: 'apple',
    logo_url: 'https://cdn.example.com/apple.png',
    website_url: 'https://apple.com',
    is_featured: true,
    is_active: true,
  });
  assert.equal(brand.labelFa, 'اپل');
  assert.equal(brand.isFeatured, true);

  const warranty = normalizeWarranty({
    id: 'w-1',
    provider_name: '۱۸ ماهه جامع امیر سرویس + کد همتا',
    duration_months: 18,
    coverage_fa: 'پوشش کامل',
    is_active: true,
  });
  assert.equal(warranty.durationMonths, 18);

  const attr = normalizeTechnicalAttribute({
    id: 'a-1',
    code: 'screen_size',
    name_fa: 'اندازه صفحه',
    name_en: 'Screen Size',
    data_type: 'number',
    unit: 'اینچ',
    is_filterable: true,
    category_ids: [{ id: 'c-1', slug: 'phones' }, 'c-2'],
  });
  assert.equal(attr.dataType, 'number');
  assert.deepEqual(attr.categoryIds, ['c-1', 'c-2']);

  const variant = normalizeProductVariant({
    id: 'v-1',
    product_id: 'iphone-16',
    sku: 'APL-16-256-ZAA',
    part_number: 'ZA/A',
    color_name_fa: 'مشکی',
    color_hex: '#111111',
    price_toman: 92000000,
    cost_price_toman: 85000000,
    available_stock: 4,
    is_published: true,
  });
  assert.equal(variant.partNumber, 'ZA/A');
  assert.equal(variant.costPriceToman, 85000000);
  assert.equal(variant.availableStock, 4);

  const product = normalizeProduct({
    id: 'iphone-16',
    name_fa: 'آیفون ۱۶',
    attribute_values: [{ attribute_id: 'a-1', value_number: 6.1 }],
    variants: [{ id: 'v-1', sku: 'APL-16-256-ZAA', price_toman: 92000000 }],
  });
  assert.equal(product.attributeValues?.length, 1);
  assert.equal(product.attributeValues?.[0].valueNumber, 6.1);
  assert.equal(product.variants?.length, 1);

  const order = normalizeOrder({
    order_code: 'AMIR-9999',
    items: [
      {
        product_id: 'iphone-16',
        variant_id: 'v-1',
        sku: 'APL-16-256-ZAA',
        part_number: 'ZA/A',
        sim_type: 'دو سیم‌کارت فیزیکی',
        name_fa: 'آیفون ۱۶',
        qty: 1,
        unit_price: 92000000,
      },
    ],
  });
  assert.equal(order.items[0].sku, 'APL-16-256-ZAA');
  assert.equal(order.items[0].partNumber, 'ZA/A');
  assert.equal(order.items[0].simType, 'دو سیم‌کارت فیزیکی');
  assert.equal(order.items[0].variantId, 'v-1');

  const wh = normalizeWarehouse({ id: 'wh-1', code: 'WH-THR', name_fa: 'انبار تهران', city: 'تهران' });
  assert.equal(wh.code, 'WH-THR');

  const stockItem = normalizeWarehouseStockItem({
    warehouse_id: 'wh-1',
    variant_id: 'v-1',
    sku: 'APL-16-256-ZAA',
    quantity_on_hand: 2,
    reserved_qty: 1,
    min_stock_alert: 3,
  });
  assert.equal(stockItem.availableQty, 1);
  assert.equal(stockItem.isLowStock, true);

  const mov = normalizeStockMovement({
    id: 'm-1',
    warehouse_id: 'wh-1',
    variant_id: 'v-1',
    movement_type: 'purchase_inflow',
    quantity_change: 5,
    balance_after: 7,
  });
  assert.equal(mov.movementType, 'purchase_inflow');
  assert.equal(mov.balanceAfter, 7);

  const role = normalizeRbacRole({
    id: 'r-1',
    name: 'warehouse_manager',
    title_fa: 'مدیر انبار',
    description: 'مدیریت موجودی و حواله',
    is_system: true,
  });
  assert.equal(role.titleFa, 'مدیر انبار');

  const parsedList = parseListWithTotal(
    { stock: [stockItem], total: 12 },
    ['stock'],
    normalizeWarehouseStockItem,
    'err'
  );
  assert.equal(parsedList.total, 12);
  assert.equal(parsedList.items.length, 1);
});
