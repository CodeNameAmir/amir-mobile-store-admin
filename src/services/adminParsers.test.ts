import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from './apiClient';
import { adminApi } from './adminApi';
import {
  normalizeAuditLogEntry,
  normalizeBrand,
  normalizeCategory,
  normalizeCmsPost,
  normalizeCoupon,
  normalizeCouponRedemption,
  normalizeCustomerDetail,
  normalizeNewsletterSubscriber,
  normalizeOrder,
  normalizeOrderReturn,
  normalizePaymentTransaction,
  normalizeProduct,
  normalizeProductReview,
  normalizeProductVariant,
  normalizePurchaseOrder,
  normalizeRbacRole,
  normalizeShippingMethod,
  normalizeStockMovement,
  normalizeStoreSettings,
  normalizeSupplier,
  normalizeSupportTicket,
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
      username: 'CodeNameAmir',
      username_changed_at: null,
      fullName: 'مدیر سیستم',
      role: 'admin',
    },
  });
  assert.equal(res.user.role, 'admin');
  assert.equal(res.user.username, 'CodeNameAmir');
  assert.equal(res.user.usernameChangedAt, undefined);
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

  const customer = normalizeCustomerDetail({
    id: 'c-1',
    email: 'c@example.com',
    username: 'CodeNameAmir',
    username_changed_at: '2026-11-20T10:00:00Z',
  });
  assert.equal(customer.username, 'CodeNameAmir');
  assert.equal(customer.usernameChangedAt, '2026-11-20T10:00:00Z');
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
    custom_specs: [
      { label: 'کد مرجع دیجیکالا', value: 'DKP-21462684' },
      { label: 'کشور مونتاژ', value: 'ویتنام (Vietnam)' },
      { label: 'قابلیتهای ویژه', value: 'قلم S-Pen · Privacy Display · Samsung DeX' },
    ],
  });
  assert.equal(product.attributeValues?.length, 1);
  assert.equal(product.attributeValues?.[0].valueNumber, 6.1);
  assert.equal(product.variants?.length, 1);
  assert.deepEqual(product.customSpecs, [
    { label: 'کد مرجع دیجیکالا', value: 'DKP-21462684' },
    { label: 'کشور مونتاژ', value: 'ویتنام (Vietnam)' },
    { label: 'قابلیتهای ویژه', value: 'قلم S-Pen · Privacy Display · Samsung DeX' },
  ]);

  const stringifiedCustomSpecsProduct = normalizeProduct({
    id: 's26-ultra',
    name_fa: 'گلکسی S26 اولترا',
    custom_specs: JSON.stringify([{ label: 'پشتیبانی قلم', value: 'دارد (S-Pen)' }]),
  });
  assert.deepEqual(stringifiedCustomSpecsProduct.customSpecs, [
    { label: 'پشتیبانی قلم', value: 'دارد (S-Pen)' },
  ]);

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

test('Extended schema normalizers handle products, brands, warranties, warehouses, customers, coupons, tickets, reviews, newsletter, and store_settings', () => {
  const product = normalizeProduct({
    id: 'galaxy-s26-ultra',
    name_fa: 'گلکسی S26 اولترا',
    model_name: 'SM-S948B',
    description_fa: 'توضیحات کامل محصول',
    image_url: 'https://cdn.example.com/cover.jpg',
    images: ['https://cdn.example.com/2.jpg', 'https://cdn.example.com/cover.jpg'],
    is_published: false,
    is_featured: true,
    warranty_id: 'w-uuid',
    brand_id: 'samsung',
    category_id: 'phones',
    recommend_percent: 98,
    price_updated_at: '2026-11-21T10:00:00Z',
  });
  assert.equal(product.modelName, 'SM-S948B');
  assert.equal(product.descriptionFa, 'توضیحات کامل محصول');
  assert.deepEqual(product.images, ['https://cdn.example.com/2.jpg', 'https://cdn.example.com/cover.jpg']);
  assert.equal(product.isPublished, false);
  assert.equal(product.isFeatured, true);
  assert.equal(product.warrantyId, 'w-uuid');
  assert.equal(product.brandId, 'samsung');
  assert.equal(product.categoryId, 'phones');
  assert.equal(product.recommendPercent, 98);
  assert.equal(product.priceUpdatedAt, '2026-11-21T10:00:00Z');

  const brand = normalizeBrand({ id: 'samsung', name: 'Samsung', sort_order: 4 });
  assert.equal(brand.sortOrder, 4);

  const warranty = normalizeWarranty({ id: 'w-1', code: 'SAM-18M', provider_name: 'سام سرویس' });
  assert.equal(warranty.code, 'SAM-18M');

  const warehouse = normalizeWarehouse({
    id: 'wh-1',
    code: 'WH-THR',
    name_fa: 'انبار مرکزی',
    city: 'تهران',
    postal_code: '1484616553',
    phone: '02188889999',
    manager_name: 'رضا محمدی',
    is_central: true,
  });
  assert.equal(warehouse.postalCode, '1484616553');
  assert.equal(warehouse.managerName, 'رضا محمدی');
  assert.equal(warehouse.isCentral, true);

  const customer = normalizeCustomerDetail({
    id: 'u-1',
    email: 'user@example.com',
    wishlist: ['airpods-pro-2-usbc', 'iphone-16-pro'],
  });
  assert.deepEqual(customer.wishlist, ['airpods-pro-2-usbc', 'iphone-16-pro']);

  const coupon = normalizeCoupon({
    code: 'NOWRUZ1405',
    discount_type: 'fixed',
    discount_value: 250000,
    max_discount: null,
    min_order_amount: 1000000,
    is_active: true,
    description_fa: 'جشنواره نوروز',
  });
  assert.equal(coupon.code, 'NOWRUZ1405');
  assert.equal(coupon.discountType, 'fixed');
  assert.equal(coupon.minOrderAmount, 1000000);

  const ticket = normalizeSupportTicket({
    id: 't-1',
    ticket_code: 'TKT-901',
    full_name: 'سارا کریمی',
    phone: '09120001122',
    department: 'پیگیری سفارش',
    order_code: 'AMIR-1042',
    message: 'سفارش کی ارسال می‌شود؟',
    status: 'in_progress',
    admin_reply: 'امروز تحویل پست داده شد.',
  });
  assert.equal(ticket.ticketCode, 'TKT-901');
  assert.equal(ticket.status, 'in_progress');
  assert.equal(ticket.adminReply, 'امروز تحویل پست داده شد.');

  const review = normalizeProductReview({
    id: 'r-1',
    product_id: 'iphone-16',
    author: 'امیر',
    rating: 5,
    comment: 'بسیار عالی',
    verified: true,
    is_approved: false,
  });
  assert.equal(review.productId, 'iphone-16');
  assert.equal(review.verified, true);
  assert.equal(review.isApproved, false);

  const sub = normalizeNewsletterSubscriber({
    id: 'n-1',
    contact: 'news@example.com',
    created_at: '2026-11-20T08:00:00Z',
  });
  assert.equal(sub.contact, 'news@example.com');

  const settingsFromArray = normalizeStoreSettings({
    settings: [{ key: 'free_shipping_threshold', value: 5000000 }],
  });
  assert.deepEqual(settingsFromArray, [
    { key: 'free_shipping_threshold', value: 5000000, updatedAt: undefined },
  ]);

  const settingsFromMap = normalizeStoreSettings({
    settings: { announcement_text: 'ارسال رایگان امروز', support_phone: '02144556677' },
  });
  assert.equal(settingsFromMap.length, 2);
});

test('normalizeOrder and parseDashboardResponse parse extended optional fields without fabricating defaults', () => {
  const extendedOrder = normalizeOrder({
    order_code: 'AMIR-8888',
    status: 'cancelled',
    payment_status: 'refunded',
    postal_tracking_code: 'POST-998877',
    status_history: [
      { status: 'paid', changed_at: '2026-11-20T09:00:00Z', admin_email: 'admin@codenameamir.ir' },
      { status: 'cancelled', note: 'درخواست مشتری', changed_at: '2026-11-21T11:00:00Z' },
    ],
  });
  assert.equal(extendedOrder.status, 'cancelled');
  assert.equal(extendedOrder.paymentStatus, 'refunded');
  assert.equal(extendedOrder.trackingCode, 'POST-998877');
  assert.equal(extendedOrder.statusHistory?.length, 2);
  assert.equal(extendedOrder.statusHistory?.[1].note, 'درخواست مشتری');

  const baseDashboard = parseDashboardResponse({
    metrics: { totalProducts: 4, totalOrders: 1, confirmedRevenue: 1000 },
  });
  assert.equal(baseDashboard.metrics.publishedProducts, undefined);
  assert.equal(baseDashboard.metrics.cancelledOrdersCount, undefined);
  assert.equal(baseDashboard.topSellingProducts, undefined);
  assert.equal(baseDashboard.recentActivities, undefined);

  const extendedDashboard = parseDashboardResponse({
    metrics: {
      total_products: 12,
      published_products: 10,
      unpublished_products: 2,
      cancelled_orders_count: 1,
      total_orders: 8,
      confirmed_revenue: 90_000_000,
    },
    top_selling_products: [
      { id: 'iphone-16', name_fa: 'آیفون ۱۶', brand: 'Apple', sold_count: 5, revenue: 450_000_000 },
    ],
    recent_activities: [
      { id: 'log-1', action: 'order.update', admin_email: 'admin@codenameamir.ir', created_at: '2026-11-22T12:00:00Z' },
    ],
  });
  assert.equal(extendedDashboard.metrics.publishedProducts, 10);
  assert.equal(extendedDashboard.metrics.unpublishedProducts, 2);
  assert.equal(extendedDashboard.metrics.cancelledOrdersCount, 1);
  assert.equal(extendedDashboard.topSellingProducts?.length, 1);
  assert.equal(extendedDashboard.topSellingProducts?.[0].soldCount, 5);
  assert.equal(extendedDashboard.recentActivities?.length, 1);
  assert.equal(extendedDashboard.recentActivities?.[0].action, 'order.update');
});

test('Phase 1 normalizers map RBAC permissions, audit diff metadata, and DB payment/order states', () => {
  const me = parseAdminMeResponse({
    user: {
      id: 'adm-rbac',
      email: 'ops@codenameamir.ir',
      full_name: 'مدیر عملیات',
      role: 'admin',
      roles: ['order_manager', 'warehouse_manager'],
      permissions: ['dashboard.read', 'orders.read', 'orders.update', 'inventory.transfer'],
      is_active: true,
      is_blocked: false,
      preferences: { theme: 'dark', compactRows: true },
    },
  });
  assert.deepEqual(me.user.roles, ['order_manager', 'warehouse_manager']);
  assert.deepEqual(me.user.permissions, [
    'dashboard.read',
    'orders.read',
    'orders.update',
    'inventory.transfer',
  ]);
  assert.equal(me.user.isBlocked, false);
  assert.deepEqual(me.user.preferences, { theme: 'dark', compactRows: true });

  const role = normalizeRbacRole({
    id: 'r-ops',
    name: 'order_manager',
    title_fa: 'مدیر پردازش سفارش‌ها',
    permissions: ['orders.read', 'orders.update'],
    users_count: 3,
  });
  assert.deepEqual(role.permissions, ['orders.read', 'orders.update']);
  assert.equal(role.usersCount, 3);

  const pendingOrder = normalizeOrder({
    order_code: 'AMIR-3001',
    status: 'pending_payment',
    payment_status: 'pending_gateway',
    expires_at: '2026-11-28T12:00:00Z',
    stock_restored: false,
  });
  assert.equal(pendingOrder.status, 'pending_payment');
  assert.equal(pendingOrder.paymentStatus, 'pending_gateway');
  assert.equal(pendingOrder.expiresAt, '2026-11-28T12:00:00Z');
  assert.equal(pendingOrder.stockRestored, false);

  const log = normalizeAuditLogEntry({
    id: 'log-9',
    action: 'order.cancel',
    target_type: 'order',
    target_id: 'AMIR-3001',
    ip_address: '185.120.44.10',
    user_agent: 'Mozilla/5.0',
    before_data: { status: 'paid' },
    after_data: { status: 'cancelled' },
  });
  assert.equal(log.ipAddress, '185.120.44.10');
  assert.deepEqual(log.beforeData, { status: 'paid' });
  assert.deepEqual(log.afterData, { status: 'cancelled' });
});

test('Phase 2 normalizers handle payments, returns, shipping methods, coupon redemptions, suppliers, and POs', () => {
  const coupon = normalizeCoupon({
    code: 'VIP20',
    discount_type: 'percent',
    discount_value: 20,
    usage_limit: 50,
    used_count: 12,
    per_user_limit: 1,
    starts_at: '2026-11-01T00:00:00Z',
    expires_at: '2026-12-01T00:00:00Z',
  });
  assert.equal(coupon.usageLimit, 50);
  assert.equal(coupon.usedCount, 12);
  assert.equal(coupon.perUserLimit, 1);

  const redemption = normalizeCouponRedemption({
    id: 'red-1',
    coupon_code: 'VIP20',
    order_code: 'AMIR-4444',
    customer_name: 'حسین رضایی',
    discount_amount: 350000,
    redeemed_at: '2026-11-25T10:00:00Z',
  });
  assert.equal(redemption.orderCode, 'AMIR-4444');
  assert.equal(redemption.discountAmount, 350000);

  const tx = normalizePaymentTransaction({
    id: 'tx-1',
    order_code: 'AMIR-4444',
    shaparak_ref: '987654321',
    amount_toman: 55000000,
    status: 'paid',
    reconciliation_status: 'matched',
  });
  assert.equal(tx.shaparakRef, '987654321');
  assert.equal(tx.reconciliationStatus, 'matched');

  const ret = normalizeOrderReturn({
    id: 'ret-1',
    return_code: 'RMA-101',
    order_code: 'AMIR-4444',
    reason: 'ایراد باتری',
    items: [{ name_fa: 'آیفون ۱۶', qty: 1 }],
    refund_amount: 55000000,
    restore_stock: false,
    status: 'approved',
  });
  assert.equal(ret.returnCode, 'RMA-101');
  assert.equal(ret.restoreStock, false);
  assert.equal(ret.items[0].nameFa, 'آیفون ۱۶');

  const ship = normalizeShippingMethod({
    id: 'sh-1',
    code: 'express_tehran',
    name_fa: 'ارسال اکسپرس',
    base_cost_toman: 120000,
    free_above_toman: 10000000,
    supported_cities: ['تهران', 'کرج'],
    is_express: true,
  });
  assert.deepEqual(ship.supportedCities, ['تهران', 'کرج']);
  assert.equal(ship.freeAboveToman, 10000000);

  const sup = normalizeSupplier({
    id: 'sup-1',
    name_fa: 'پخش موبایل ایران',
    contact_name: 'آقای کریمی',
    is_active: true,
  });
  assert.equal(sup.nameFa, 'پخش موبایل ایران');

  const po = normalizePurchaseOrder({
    id: 'po-1',
    po_number: 'PO-1405-01',
    supplier_name_fa: 'پخش موبایل ایران',
    warehouse_name_fa: 'انبار تهران',
    status: 'received',
    total_cost_toman: 400000000,
    items: [{ variant_id: 'v-1', sku: 'APL-16', quantity: 5, unit_cost_toman: 80000000 }],
  });
  assert.equal(po.poNumber, 'PO-1405-01');
  assert.equal(po.items[0].unitCostToman, 80000000);
});

test('normalizeCmsPost supports both cms_posts and live blog_posts shapes', () => {
  const fromBlogApi = normalizeCmsPost({
    id: 'b-1',
    slug: 'iphone-16-camera',
    title: 'مقایسه دوربین آیفون ۱۶',
    excerpt: 'خلاصه مقایسه',
    content: 'متن کامل',
    coverImage: 'https://cdn.example.com/blog.jpg',
    category: 'مقایسه تخصصی',
    isPublished: true,
    publishedAt: '2026-11-22T15:59:04Z',
    createdAt: '2026-11-22T15:00:00Z',
  });
  assert.equal(fromBlogApi.titleFa, 'مقایسه دوربین آیفون ۱۶');
  assert.equal(fromBlogApi.excerptFa, 'خلاصه مقایسه');
  assert.equal(fromBlogApi.categoryFa, 'مقایسه تخصصی');
  assert.equal(fromBlogApi.status, 'published');
});

