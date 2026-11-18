import type {
  AdminCustomerDetail,
  AdminCustomerSummary,
  AuditLogEntry,
  AuthUser,
  BrandId,
  DashboardData,
  DashboardMetrics,
  DeliverySlot,
  OrderItem,
  OrderRecord,
  OrderStatus,
  OrderStatusBreakdown,
  PaginatedResponse,
  Product,
  ProductCategoryId,
  ProductColor,
  ProductSpecs,
  RevenueSeriesPoint,
  StorageVariant,
  UserAddress,
  UserRole,
} from '../types/admin';
import { ApiError } from './apiClient';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toOptionalFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = toFiniteNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : null;
}

function toStringSafe(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function normalizeUserRole(value: unknown): UserRole {
  return value === 'admin' ? 'admin' : 'customer';
}

function normalizeAddress(raw: unknown, index: number): UserAddress {
  const row = isRecord(raw) ? raw : {};
  return {
    id: toStringSafe(row.id, `addr-${index + 1}`),
    label: toStringSafe(row.label, 'آدرس'),
    receiverName: toStringSafe(row.receiverName ?? row.receiver_name, ''),
    phone: toStringSafe(row.phone, ''),
    city: toStringSafe(row.city, ''),
    address: toStringSafe(row.address, ''),
    postalCode: toStringSafe(row.postalCode ?? row.postal_code, ''),
    isDefault: Boolean(row.isDefault ?? row.is_default),
  };
}

export function normalizeAuthUser(raw: unknown): AuthUser | null {
  if (!isRecord(raw)) return null;
  const email = toStringSafe(raw.email).trim();
  const id = toStringSafe(raw.id).trim();
  if (!email && !id) return null;

  const rawAddresses = Array.isArray(raw.addresses) ? raw.addresses : [];
  const rawWishlist = Array.isArray(raw.wishlist) ? raw.wishlist : [];

  return {
    id: id || email,
    email,
    fullName: toStringSafe(raw.fullName ?? raw.full_name, email || 'کاربر'),
    phone: toStringSafe(raw.phone, ''),
    role: normalizeUserRole(raw.role),
    nationalId: raw.nationalId
      ? toStringSafe(raw.nationalId)
      : raw.national_id
        ? toStringSafe(raw.national_id)
        : undefined,
    birthDate: raw.birthDate
      ? toStringSafe(raw.birthDate)
      : raw.birth_date
        ? toStringSafe(raw.birth_date)
        : undefined,
    newsletterOptIn:
      typeof raw.newsletterOptIn === 'boolean'
        ? raw.newsletterOptIn
        : raw.newsletter_opt_in !== false,
    emailVerified:
      typeof raw.emailVerified === 'boolean'
        ? raw.emailVerified
        : raw.email_verified !== false,
    twoFactorEnabled: Boolean(raw.twoFactorEnabled ?? raw.two_factor_enabled),
    hasPassword: Boolean(raw.hasPassword ?? raw.has_password ?? true),
    addresses: rawAddresses.map((addr, idx) => normalizeAddress(addr, idx)),
    wishlist: rawWishlist.map((item) => toStringSafe(item)).filter(Boolean),
    createdAt: toStringSafe(raw.createdAt ?? raw.created_at, ''),
    lastLoginAt: toStringSafe(raw.lastLoginAt ?? raw.last_login_at, ''),
  };
}

export function parseAuthMeResponse(raw: unknown): { authenticated: boolean; user: AuthUser | null } {
  if (!isRecord(raw)) {
    throw new ApiError('پاسخ دریافتی از سرور برای وضعیت نشست معتبر نیست.', 502, undefined, raw);
  }
  const authenticated = Boolean(raw.authenticated);
  const user = raw.user ? normalizeAuthUser(raw.user) : null;
  if (authenticated && !user) {
    throw new ApiError('اطلاعات حساب کاربری در پاسخ سرور معتبر نیست.', 502, undefined, raw);
  }
  return { authenticated, user };
}

export function parseAdminMeResponse(raw: unknown): { user: AuthUser } {
  if (!isRecord(raw)) {
    throw new ApiError('پاسخ دریافتی از سرور برای اطلاعات مدیر معتبر نیست.', 502, undefined, raw);
  }
  const candidate = isRecord(raw.user)
    ? raw.user
    : isRecord(raw.admin)
      ? raw.admin
      : raw.email || raw.id
        ? raw
        : null;

  const user = normalizeAuthUser(candidate);
  if (!user || !user.email) {
    throw new ApiError(
      'اطلاعات حساب مدیر در پاسخ سرور (/api/admin/me) یافت نشد یا نامعتبر است.',
      502,
      undefined,
      raw
    );
  }
  return { user };
}

function normalizeProductSpecs(raw: unknown): ProductSpecs {
  const s = isRecord(raw) ? raw : {};
  return {
    display: toStringSafe(s.display, ''),
    displayDetails: toStringSafe(s.displayDetails ?? s.display_details, ''),
    chipset: toStringSafe(s.chipset, ''),
    chipsetDetails: toStringSafe(s.chipsetDetails ?? s.chipset_details, ''),
    camera: toStringSafe(s.camera, ''),
    cameraDetails: toStringSafe(s.cameraDetails ?? s.camera_details, ''),
    battery: toStringSafe(s.battery, ''),
    batteryDetails: toStringSafe(s.batteryDetails ?? s.battery_details, ''),
    storageDefault: toStringSafe(s.storageDefault ?? s.storage_default, ''),
    ram: toStringSafe(s.ram, ''),
    os: toStringSafe(s.os, ''),
  };
}

function normalizeProductColors(raw: unknown): ProductColor[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c, idx) => {
      if (!isRecord(c)) return null;
      return {
        id: toStringSafe(c.id, `color-${idx + 1}`),
        name: toStringSafe(c.name, ''),
        hex: toStringSafe(c.hex, '#1e293b'),
      };
    })
    .filter((c): c is ProductColor => c !== null);
}

function normalizeStorageOptions(raw: unknown): StorageVariant[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((opt) => {
      if (!isRecord(opt)) return null;
      return {
        label: toStringSafe(opt.label, ''),
        subtitle: toStringSafe(opt.subtitle, ''),
        priceDelta: toFiniteNumber(opt.priceDelta ?? opt.price_delta, 0),
      };
    })
    .filter((opt): opt is StorageVariant => opt !== null);
}

export function normalizeProduct(raw: unknown): Product {
  const row = isRecord(raw) ? raw : {};
  const stockCount = Math.max(0, Math.floor(toFiniteNumber(row.stockCount ?? row.stock_count, 0)));
  return {
    id: toStringSafe(row.id, ''),
    slug: toStringSafe(row.slug ?? row.id, ''),
    nameFa: toStringSafe(row.nameFa ?? row.name_fa, 'محصول بدون نام'),
    nameEn: toStringSafe(row.nameEn ?? row.name_en, ''),
    brand: (toStringSafe(row.brand, 'Apple') as BrandId) || 'Apple',
    category: (toStringSafe(row.category, 'phones') as ProductCategoryId) || 'phones',
    price: toFiniteNumber(row.price, 0),
    originalPrice: toOptionalFiniteNumber(row.originalPrice ?? row.original_price),
    discountPercent: toFiniteNumber(row.discountPercent ?? row.discount_percent, 0),
    inStock:
      typeof row.inStock === 'boolean'
        ? row.inStock
        : typeof row.in_stock === 'boolean'
          ? row.in_stock
          : stockCount > 0,
    stockCount,
    expressDelivery: Boolean(row.expressDelivery ?? row.express_delivery),
    warranty: toStringSafe(row.warranty, ''),
    badgeText:
      row.badgeText !== undefined
        ? row.badgeText
          ? toStringSafe(row.badgeText)
          : null
        : row.badge_text
          ? toStringSafe(row.badge_text)
          : null,
    rating: toFiniteNumber(row.rating, 4.8),
    reviewCount: toFiniteNumber(row.reviewCount ?? row.review_count, 0),
    recommendPercent: toFiniteNumber(row.recommendPercent ?? row.recommend_percent, 95),
    image: toStringSafe(row.image ?? row.image_url, ''),
    colorLabel: toStringSafe(row.colorLabel ?? row.color_label, 'مشکی'),
    colors: normalizeProductColors(row.colors),
    storageOptions: normalizeStorageOptions(row.storageOptions ?? row.storage_options),
    specs: normalizeProductSpecs(row.specs),
    isFeaturedDeal: Boolean(row.isFeaturedDeal ?? row.is_featured_deal),
    isPopular: Boolean(row.isPopular ?? row.is_popular),
    salesRank: toFiniteNumber(row.salesRank ?? row.sales_rank, 100),
    releaseOrder: toFiniteNumber(row.releaseOrder ?? row.release_order, 100),
    createdAt: row.createdAt
      ? toStringSafe(row.createdAt)
      : row.created_at
        ? toStringSafe(row.created_at)
        : undefined,
    updatedAt: row.updatedAt
      ? toStringSafe(row.updatedAt)
      : row.updated_at
        ? toStringSafe(row.updated_at)
        : undefined,
  };
}

function normalizeOrderItem(raw: unknown, idx: number): OrderItem {
  const row = isRecord(raw) ? raw : {};
  return {
    key: toStringSafe(row.key, `item-${idx + 1}`),
    productId: toStringSafe(row.productId ?? row.product_id, ''),
    slug: toStringSafe(row.slug, ''),
    nameFa: toStringSafe(row.nameFa ?? row.name_fa ?? row.name, 'کالا'),
    brand: toStringSafe(row.brand, ''),
    image: toStringSafe(row.image ?? row.image_url, ''),
    colorName: toStringSafe(row.colorName ?? row.color_name, ''),
    colorHex: toStringSafe(row.colorHex ?? row.color_hex, '#1e293b'),
    storageLabel: toStringSafe(row.storageLabel ?? row.storage_label, ''),
    warranty: toStringSafe(row.warranty, ''),
    unitPrice: toFiniteNumber(row.unitPrice ?? row.unit_price ?? row.price, 0),
    originalUnitPrice: toFiniteNumber(
      row.originalUnitPrice ?? row.original_unit_price ?? row.unitPrice ?? row.price,
      0
    ),
    qty: Math.max(1, Math.floor(toFiniteNumber(row.qty ?? row.quantity, 1))),
    stockCount: Math.max(0, Math.floor(toFiniteNumber(row.stockCount ?? row.stock_count, 0))),
  };
}

export function normalizeOrder(raw: unknown): OrderRecord {
  const row = isRecord(raw) ? raw : {};
  const rawItems = Array.isArray(row.items) ? row.items : [];
  const slotRaw = toStringSafe(row.deliverySlot ?? row.delivery_slot, 'express');
  const deliverySlot: DeliverySlot = slotRaw === 'standard' ? 'standard' : 'express';

  return {
    id: row.id ? toStringSafe(row.id) : undefined,
    orderCode: toStringSafe(row.orderCode ?? row.order_code, ''),
    userId: row.userId
      ? toStringSafe(row.userId)
      : row.user_id
        ? toStringSafe(row.user_id)
        : null,
    shaparakRef: toStringSafe(row.shaparakRef ?? row.shaparak_ref, ''),
    customerName: toStringSafe(row.customerName ?? row.customer_name, 'مشتری'),
    customerPhone: toStringSafe(row.customerPhone ?? row.customer_phone, ''),
    city: toStringSafe(row.city, ''),
    shippingAddress: toStringSafe(row.shippingAddress ?? row.shipping_address, ''),
    postalCode: toStringSafe(row.postalCode ?? row.postal_code, ''),
    deliverySlot,
    couponCode:
      row.couponCode !== undefined
        ? row.couponCode
          ? toStringSafe(row.couponCode)
          : null
        : row.coupon_code
          ? toStringSafe(row.coupon_code)
          : null,
    subtotal: toFiniteNumber(row.subtotal, 0),
    productDiscount: toFiniteNumber(row.productDiscount ?? row.discount_total, 0),
    couponDiscount: toFiniteNumber(row.couponDiscount ?? row.coupon_discount, 0),
    shippingCost: toFiniteNumber(row.shippingCost ?? row.shipping_cost, 0),
    totalAmount: toFiniteNumber(row.totalAmount ?? row.total_amount, 0),
    status: toStringSafe(row.status, 'preparing') as OrderStatus,
    deliveryPin: toStringSafe(row.deliveryPin ?? row.delivery_pin, ''),
    imeiSample: toStringSafe(row.imeiSample ?? row.imei_sample, ''),
    adminNote: row.adminNote
      ? toStringSafe(row.adminNote)
      : row.admin_note
        ? toStringSafe(row.admin_note)
        : undefined,
    items: rawItems.map((item, idx) => normalizeOrderItem(item, idx)),
    createdAt: toStringSafe(row.createdAt ?? row.created_at, '—'),
    createdAtIso: row.createdAtIso
      ? toStringSafe(row.createdAtIso)
      : row.created_at
        ? toStringSafe(row.created_at)
        : undefined,
    updatedAt: row.updatedAt
      ? toStringSafe(row.updatedAt)
      : row.updated_at
        ? toStringSafe(row.updated_at)
        : undefined,
  };
}

export function normalizeCustomerSummary(raw: unknown): AdminCustomerSummary {
  const row = isRecord(raw) ? raw : {};
  const email = toStringSafe(row.email, '');
  return {
    id: toStringSafe(row.id, email),
    email,
    fullName: toStringSafe(row.fullName ?? row.full_name, email || 'کاربر'),
    phone: toStringSafe(row.phone, ''),
    role: normalizeUserRole(row.role),
    emailVerified:
      typeof row.emailVerified === 'boolean'
        ? row.emailVerified
        : row.email_verified !== false,
    twoFactorEnabled: Boolean(row.twoFactorEnabled ?? row.two_factor_enabled),
    newsletterOptIn:
      typeof row.newsletterOptIn === 'boolean'
        ? row.newsletterOptIn
        : row.newsletter_opt_in !== false,
    ordersCount: Math.max(0, Math.floor(toFiniteNumber(row.ordersCount ?? row.orders_count, 0))),
    totalSpent: toFiniteNumber(row.totalSpent ?? row.total_spent, 0),
    createdAt: toStringSafe(row.createdAt ?? row.created_at, ''),
    lastLoginAt: toStringSafe(row.lastLoginAt ?? row.last_login_at, ''),
  };
}

export function normalizeCustomerDetail(raw: unknown): AdminCustomerDetail {
  const row = isRecord(raw) ? raw : {};
  const summary = normalizeCustomerSummary(row);
  const rawAddresses = Array.isArray(row.addresses) ? row.addresses : [];
  const rawOrders = Array.isArray(row.orders) ? row.orders : [];
  return {
    ...summary,
    nationalId: row.nationalId
      ? toStringSafe(row.nationalId)
      : row.national_id
        ? toStringSafe(row.national_id)
        : undefined,
    birthDate: row.birthDate
      ? toStringSafe(row.birthDate)
      : row.birth_date
        ? toStringSafe(row.birth_date)
        : undefined,
    addresses: rawAddresses.map((addr, idx) => normalizeAddress(addr, idx)),
    orders: rawOrders.map((ord) => normalizeOrder(ord)),
  };
}

export function normalizeAuditLogEntry(raw: unknown, idx = 0): AuditLogEntry {
  const row = isRecord(raw) ? raw : {};
  return {
    id: toStringSafe(row.id, `log-${idx + 1}`),
    adminUserId: row.adminUserId
      ? toStringSafe(row.adminUserId)
      : row.admin_user_id
        ? toStringSafe(row.admin_user_id)
        : null,
    adminEmail: toStringSafe(row.adminEmail ?? row.admin_email, '—'),
    action: toStringSafe(row.action, 'unknown'),
    targetType: toStringSafe(row.targetType ?? row.target_type, ''),
    targetId: toStringSafe(row.targetId ?? row.target_id, ''),
    details: isRecord(row.details) ? row.details : {},
    createdAt: toStringSafe(row.createdAt ?? row.created_at, ''),
  };
}

const METRIC_KEYS = [
  'totalProducts',
  'total_products',
  'inStockProducts',
  'in_stock_products',
  'outOfStockProducts',
  'out_of_stock_products',
  'lowStockCount',
  'low_stock_count',
  'totalOrders',
  'total_orders',
  'pendingOrdersCount',
  'pending_orders_count',
  'totalCustomers',
  'total_customers',
  'confirmedRevenue',
  'confirmed_revenue',
  'totalRevenue',
  'total_revenue',
];

function hasMetricKeys(obj: Record<string, unknown>): boolean {
  let count = 0;
  for (const key of METRIC_KEYS) {
    if (key in obj) count += 1;
  }
  return count >= 1;
}

function normalizeRevenueSeries(raw: unknown): RevenueSeriesPoint[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((point) => {
      if (!isRecord(point)) return null;
      return {
        label: toStringSafe(point.label ?? point.date ?? point.day, '—'),
        revenue: toFiniteNumber(point.revenue ?? point.total ?? point.amount, 0),
        ordersCount: Math.max(
          0,
          Math.floor(toFiniteNumber(point.ordersCount ?? point.orders_count ?? point.count, 0))
        ),
      };
    })
    .filter((pt): pt is RevenueSeriesPoint => pt !== null);
}

function normalizeStatusBreakdown(raw: unknown): OrderStatusBreakdown[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (!isRecord(item)) return null;
        return {
          status: toStringSafe(item.status, 'preparing') as OrderStatus,
          count: Math.max(0, Math.floor(toFiniteNumber(item.count, 0))),
        };
      })
      .filter((item): item is OrderStatusBreakdown => item !== null);
  }
  if (isRecord(raw)) {
    return Object.entries(raw).map(([status, count]) => ({
      status: status as OrderStatus,
      count: Math.max(0, Math.floor(toFiniteNumber(count, 0))),
    }));
  }
  return [];
}

export function parseDashboardResponse(raw: unknown): DashboardData {
  if (!isRecord(raw)) {
    throw new ApiError('پاسخ دریافتی از سرور برای آمار داشبورد معتبر نیست.', 502, undefined, raw);
  }

  let source: Record<string, unknown> = raw;
  if (!isRecord(source.metrics) && !hasMetricKeys(source)) {
    if (isRecord(raw.stats)) {
      source = raw.stats;
    } else if (isRecord(raw.data)) {
      source = raw.data;
    }
  }

  const metricsSource = isRecord(source.metrics)
    ? source.metrics
    : isRecord(source.summary)
      ? source.summary
      : isRecord(source.totals)
        ? source.totals
        : hasMetricKeys(source)
          ? source
          : null;

  if (!metricsSource) {
    throw new ApiError(
      'ساختار آمار داشبورد دریافتی از سرور (/api/admin/stats) معتبر نیست.',
      502,
      undefined,
      raw
    );
  }

  const metrics: DashboardMetrics = {
    totalProducts: Math.max(
      0,
      Math.floor(toFiniteNumber(metricsSource.totalProducts ?? metricsSource.total_products, 0))
    ),
    inStockProducts: Math.max(
      0,
      Math.floor(toFiniteNumber(metricsSource.inStockProducts ?? metricsSource.in_stock_products, 0))
    ),
    outOfStockProducts: Math.max(
      0,
      Math.floor(
        toFiniteNumber(metricsSource.outOfStockProducts ?? metricsSource.out_of_stock_products, 0)
      )
    ),
    lowStockCount: Math.max(
      0,
      Math.floor(toFiniteNumber(metricsSource.lowStockCount ?? metricsSource.low_stock_count, 0))
    ),
    totalOrders: Math.max(
      0,
      Math.floor(toFiniteNumber(metricsSource.totalOrders ?? metricsSource.total_orders, 0))
    ),
    pendingOrdersCount: Math.max(
      0,
      Math.floor(
        toFiniteNumber(metricsSource.pendingOrdersCount ?? metricsSource.pending_orders_count, 0)
      )
    ),
    totalCustomers: Math.max(
      0,
      Math.floor(toFiniteNumber(metricsSource.totalCustomers ?? metricsSource.total_customers, 0))
    ),
    confirmedRevenue: toFiniteNumber(
      metricsSource.confirmedRevenue ??
        metricsSource.confirmed_revenue ??
        metricsSource.totalRevenue ??
        metricsSource.total_revenue,
      0
    ),
  };

  const rawSeries = source.revenueSeries ?? source.revenue_series;
  const rawBreakdown =
    source.statusBreakdown ?? source.status_breakdown ?? source.ordersByStatus ?? source.orders_by_status;
  const rawLowStock = source.lowStockProducts ?? source.low_stock_products;
  const rawRecentOrders = source.recentOrders ?? source.recent_orders;

  return {
    metrics,
    revenueSeries: normalizeRevenueSeries(rawSeries),
    statusBreakdown: normalizeStatusBreakdown(rawBreakdown),
    lowStockProducts: Array.isArray(rawLowStock) ? rawLowStock.map(normalizeProduct) : [],
    recentOrders: Array.isArray(rawRecentOrders) ? rawRecentOrders.map(normalizeOrder) : [],
  };
}

export function parsePaginatedResponse<T>(
  raw: unknown,
  mapper: (item: unknown, index: number) => T,
  alternativeKeys: string[] = [],
  defaultPageSize = 12
): PaginatedResponse<T> {
  if (Array.isArray(raw)) {
    const items = raw.map((item, idx) => mapper(item, idx));
    return {
      items,
      total: items.length,
      page: 1,
      pageSize: Math.max(1, items.length || defaultPageSize),
      totalPages: 1,
    };
  }

  if (!isRecord(raw)) {
    throw new ApiError('ساختار داده‌های فهرست دریافتی از سرور معتبر نیست.', 502, undefined, raw);
  }

  let listCandidate: unknown[] | null = null;
  if (Array.isArray(raw.items)) {
    listCandidate = raw.items;
  } else {
    for (const key of [...alternativeKeys, 'data', 'rows', 'results']) {
      if (Array.isArray(raw[key])) {
        listCandidate = raw[key] as unknown[];
        break;
      }
    }
  }

  if (!listCandidate) {
    throw new ApiError('فهرست داده‌ها در پاسخ سرور یافت نشد یا ساختار آن نامعتبر است.', 502, undefined, raw);
  }

  const items = listCandidate.map((item, idx) => mapper(item, idx));
  const paginationObj = isRecord(raw.pagination) ? raw.pagination : raw;

  const total = Math.max(items.length, Math.floor(toFiniteNumber(paginationObj.total, items.length)));
  const page = Math.max(1, Math.floor(toFiniteNumber(paginationObj.page, 1)));
  const pageSize = Math.max(
    1,
    Math.floor(toFiniteNumber(paginationObj.pageSize ?? paginationObj.page_size, defaultPageSize))
  );
  const computedTotalPages = Math.max(1, Math.ceil(total / pageSize));
  const totalPages = Math.max(
    1,
    Math.floor(toFiniteNumber(paginationObj.totalPages ?? paginationObj.total_pages, computedTotalPages))
  );

  return {
    items,
    total,
    page,
    pageSize,
    totalPages,
  };
}

export function parseEntityWrapper<T>(
  raw: unknown,
  keys: string[],
  mapper: (item: unknown) => T,
  errorMessage: string
): T {
  if (!isRecord(raw)) {
    throw new ApiError(errorMessage, 502, undefined, raw);
  }
  for (const key of keys) {
    if (isRecord(raw[key])) {
      return mapper(raw[key]);
    }
  }
  if ('id' in raw || 'orderCode' in raw || 'order_code' in raw || 'email' in raw) {
    return mapper(raw);
  }
  throw new ApiError(errorMessage, 502, undefined, raw);
}
