import type {
  AdminCustomerDetail,
  AdminCustomerSummary,
  AttributeDataType,
  AuditLogEntry,
  AuthUser,
  BrandId,
  BrandItem,
  CategoryItem,
  CouponDiscountType,
  CouponItem,
  CustomSpecItem,
  DashboardData,
  DashboardMetrics,
  DeliverySlot,
  NewsletterSubscriber,
  OrderItem,
  OrderPaymentStatus,
  OrderRecord,
  OrderStatus,
  OrderStatusBreakdown,
  OrderStatusHistoryItem,
  PaginatedResponse,
  Product,
  ProductAttributeValue,
  ProductCategoryId,
  ProductColor,
  ProductReview,
  ProductSpecs,
  ProductVariant,
  RbacRole,
  RevenueSeriesPoint,
  StockMovement,
  StockMovementType,
  StorageVariant,
  StoreSettingEntry,
  SupportTicket,
  TechnicalAttribute,
  TicketStatus,
  TopSellingProductItem,
  UserAddress,
  UserRole,
  Warehouse,
  WarehouseStockItem,
  WarrantyItem,
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

function toOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = toStringSafe(value).trim();
  return str ? str : null;
}

function toBooleanSafe(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
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
    username: toOptionalString(raw.username) ?? undefined,
    usernameChangedAt:
      toOptionalString(raw.usernameChangedAt ?? raw.username_changed_at) ?? undefined,
    avatarUrl: toOptionalString(raw.avatarUrl ?? raw.avatar_url) ?? undefined,
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

function normalizeCustomSpecs(raw: unknown): CustomSpecItem[] {
  let list: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('[')) {
      try {
        list = JSON.parse(trimmed);
      } catch {
        return [];
      }
    }
  }
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      if (!isRecord(item)) return null;
      const label = toStringSafe(item.label ?? item.title ?? item.name ?? item.key, '').trim();
      const value = toStringSafe(item.value ?? item.val, '').trim();
      if (!label && !value) return null;
      return { label, value };
    })
    .filter((item): item is CustomSpecItem => item !== null);
}

export function normalizeProductAttributeValue(raw: unknown): ProductAttributeValue | null {
  if (!isRecord(raw)) return null;
  const attributeId = toStringSafe(raw.attributeId ?? raw.attribute_id, '').trim();
  if (!attributeId) return null;
  const dataTypeRaw = toStringSafe(raw.dataType ?? raw.data_type, '');
  const dataType: AttributeDataType | undefined =
    dataTypeRaw === 'number' || dataTypeRaw === 'boolean' || dataTypeRaw === 'select' || dataTypeRaw === 'text'
      ? dataTypeRaw
      : undefined;
  return {
    id: toOptionalString(raw.id) ?? undefined,
    attributeId,
    attributeCode: toOptionalString(raw.attributeCode ?? raw.attribute_code ?? raw.code) ?? undefined,
    nameFa: toOptionalString(raw.nameFa ?? raw.name_fa) ?? undefined,
    nameEn: toOptionalString(raw.nameEn ?? raw.name_en) ?? undefined,
    dataType,
    unit: toOptionalString(raw.unit),
    valueText: toOptionalString(raw.valueText ?? raw.value_text),
    valueNumber: toOptionalFiniteNumber(raw.valueNumber ?? raw.value_number),
    valueBoolean:
      raw.valueBoolean !== undefined && raw.valueBoolean !== null
        ? Boolean(raw.valueBoolean)
        : raw.value_boolean !== undefined && raw.value_boolean !== null
          ? Boolean(raw.value_boolean)
          : null,
  };
}

export function normalizeProductVariant(raw: unknown, idx = 0): ProductVariant {
  const row = isRecord(raw) ? raw : {};
  return {
    id: toStringSafe(row.id, `var-${idx + 1}`),
    productId: toStringSafe(row.productId ?? row.product_id, ''),
    sku: toStringSafe(row.sku, ''),
    barcode: toOptionalString(row.barcode),
    partNumber: toOptionalString(row.partNumber ?? row.part_number),
    colorNameFa: toOptionalString(row.colorNameFa ?? row.color_name_fa),
    colorNameEn: toOptionalString(row.colorNameEn ?? row.color_name_en),
    colorHex: toOptionalString(row.colorHex ?? row.color_hex),
    storage: toOptionalString(row.storage),
    ram: toOptionalString(row.ram),
    simType: toOptionalString(row.simType ?? row.sim_type),
    warrantyId: toOptionalString(row.warrantyId ?? row.warranty_id),
    warrantyName: toOptionalString(row.warrantyName ?? row.warranty_name ?? row.providerName ?? row.provider_name),
    priceToman: toFiniteNumber(row.priceToman ?? row.price_toman ?? row.price, 0),
    originalPriceToman: toOptionalFiniteNumber(row.originalPriceToman ?? row.original_price_toman),
    costPriceToman: toOptionalFiniteNumber(row.costPriceToman ?? row.cost_price_toman),
    isPublished: toBooleanSafe(row.isPublished ?? row.is_published, true),
    availableStock: Math.max(0, Math.floor(toFiniteNumber(row.availableStock ?? row.available_stock, 0))),
    createdAt: toOptionalString(row.createdAt ?? row.created_at) ?? undefined,
    updatedAt: toOptionalString(row.updatedAt ?? row.updated_at) ?? undefined,
  };
}

function normalizeImageGallery(raw: unknown, fallbackCover?: string): string[] {
  let list: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('[')) {
      try {
        list = JSON.parse(trimmed);
      } catch {
        list = [];
      }
    } else if (trimmed) {
      list = [trimmed];
    }
  }
  const urls: string[] = [];
  if (Array.isArray(list)) {
    for (const entry of list) {
      if (typeof entry === 'string') {
        const clean = entry.trim();
        if (clean && !urls.includes(clean)) urls.push(clean);
      } else if (isRecord(entry)) {
        const clean = toStringSafe(entry.url ?? entry.imageUrl ?? entry.image_url ?? entry.src, '').trim();
        if (clean && !urls.includes(clean)) urls.push(clean);
      }
    }
  }
  const cover = (fallbackCover || '').trim();
  if (cover && !urls.includes(cover)) {
    urls.unshift(cover);
  }
  return urls;
}

export function normalizeProduct(raw: unknown): Product {
  const row = isRecord(raw) ? raw : {};
  const stockCount = Math.max(0, Math.floor(toFiniteNumber(row.stockCount ?? row.stock_count, 0)));
  const rawAttributeValues = row.attributeValues ?? row.attribute_values;
  const rawVariants = row.variants;
  const coverImage = toStringSafe(row.image ?? row.image_url, '');

  return {
    id: toStringSafe(row.id, ''),
    slug: toStringSafe(row.slug ?? row.id, ''),
    nameFa: toStringSafe(row.nameFa ?? row.name_fa, 'محصول بدون نام'),
    nameEn: toStringSafe(row.nameEn ?? row.name_en, ''),
    modelName: toOptionalString(row.modelName ?? row.model_name),
    descriptionFa: toOptionalString(row.descriptionFa ?? row.description_fa),
    brand: (toStringSafe(row.brand, 'Apple') as BrandId) || 'Apple',
    brandId: toOptionalString(row.brandId ?? row.brand_id),
    category: (toStringSafe(row.category, 'phones') as ProductCategoryId) || 'phones',
    categoryId: toOptionalString(row.categoryId ?? row.category_id),
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
    warrantyId: toOptionalString(row.warrantyId ?? row.warranty_id),
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
    image: coverImage,
    images: normalizeImageGallery(row.images, coverImage),
    colorLabel: toStringSafe(row.colorLabel ?? row.color_label, 'مشکی'),
    colors: normalizeProductColors(row.colors),
    storageOptions: normalizeStorageOptions(row.storageOptions ?? row.storage_options),
    specs: normalizeProductSpecs(row.specs),
    customSpecs: normalizeCustomSpecs(row.customSpecs ?? row.custom_specs),
    isPublished: toBooleanSafe(row.isPublished ?? row.is_published, true),
    isFeatured: toBooleanSafe(row.isFeatured ?? row.is_featured, false),
    isFeaturedDeal: Boolean(row.isFeaturedDeal ?? row.is_featured_deal),
    isPopular: Boolean(row.isPopular ?? row.is_popular),
    salesRank: toFiniteNumber(row.salesRank ?? row.sales_rank, 100),
    releaseOrder: toFiniteNumber(row.releaseOrder ?? row.release_order, 100),
    attributeValues: Array.isArray(rawAttributeValues)
      ? rawAttributeValues
          .map(normalizeProductAttributeValue)
          .filter((item): item is ProductAttributeValue => item !== null)
      : undefined,
    variants: Array.isArray(rawVariants)
      ? rawVariants.map((v, idx) => normalizeProductVariant(v, idx))
      : undefined,
    priceUpdatedAt:
      toOptionalString(row.priceUpdatedAt ?? row.price_updated_at) ?? undefined,
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

// V3 Catalog Normalizers
export function normalizeCategory(raw: unknown, idx = 0): CategoryItem {
  const row = isRecord(raw) ? raw : {};
  const id = toStringSafe(row.id ?? row.slug, `cat-${idx + 1}`);
  return {
    id,
    label: toStringSafe(row.label ?? row.nameFa ?? row.name_fa, 'دسته‌بندی'),
    titleEn: toStringSafe(row.titleEn ?? row.title_en ?? row.nameEn ?? row.name_en, ''),
    slug: toStringSafe(row.slug ?? id, ''),
    subtitle: toStringSafe(row.subtitle, ''),
    descriptionFa: toStringSafe(row.descriptionFa ?? row.description_fa, ''),
    iconName: toStringSafe(row.iconName ?? row.icon_name, 'Folder'),
    parentId: toOptionalString(row.parentId ?? row.parent_id),
    image: toStringSafe(row.image ?? row.imageUrl ?? row.image_url, ''),
    seoTitle: toStringSafe(row.seoTitle ?? row.seo_title, ''),
    seoDescription: toStringSafe(row.seoDescription ?? row.seo_description, ''),
    sortOrder: Math.floor(toFiniteNumber(row.sortOrder ?? row.sort_order, idx + 1)),
    isActive: toBooleanSafe(row.isActive ?? row.is_active, true),
    createdAt: toOptionalString(row.createdAt ?? row.created_at) ?? undefined,
    updatedAt: toOptionalString(row.updatedAt ?? row.updated_at) ?? undefined,
  };
}

export function normalizeBrand(raw: unknown, idx = 0): BrandItem {
  const row = isRecord(raw) ? raw : {};
  const id = toStringSafe(row.id ?? row.slug ?? row.name, `brand-${idx + 1}`);
  return {
    id,
    name: toStringSafe(row.name ?? row.nameEn ?? row.name_en, ''),
    labelFa: toStringSafe(row.labelFa ?? row.label_fa ?? row.nameFa ?? row.name_fa, ''),
    slug: toStringSafe(row.slug ?? id, ''),
    logoUrl: toStringSafe(row.logoUrl ?? row.logo_url ?? row.image, ''),
    websiteUrl: toStringSafe(row.websiteUrl ?? row.website_url, ''),
    sortOrder: Math.floor(toFiniteNumber(row.sortOrder ?? row.sort_order, idx + 1)),
    isFeatured: toBooleanSafe(row.isFeatured ?? row.is_featured, false),
    isActive: toBooleanSafe(row.isActive ?? row.is_active, true),
    createdAt: toOptionalString(row.createdAt ?? row.created_at) ?? undefined,
    updatedAt: toOptionalString(row.updatedAt ?? row.updated_at) ?? undefined,
  };
}

export function normalizeWarranty(raw: unknown, idx = 0): WarrantyItem {
  const row = isRecord(raw) ? raw : {};
  return {
    id: toStringSafe(row.id, `war-${idx + 1}`),
    code: toOptionalString(row.code),
    providerName: toStringSafe(row.providerName ?? row.provider_name ?? row.name, ''),
    durationMonths: Math.max(0, Math.floor(toFiniteNumber(row.durationMonths ?? row.duration_months, 18))),
    coverageFa: toStringSafe(row.coverageFa ?? row.coverage_fa ?? row.description, ''),
    termsUrl: toOptionalString(row.termsUrl ?? row.terms_url),
    isActive: toBooleanSafe(row.isActive ?? row.is_active, true),
    createdAt: toOptionalString(row.createdAt ?? row.created_at) ?? undefined,
    updatedAt: toOptionalString(row.updatedAt ?? row.updated_at) ?? undefined,
  };
}

export function normalizeTechnicalAttribute(raw: unknown, idx = 0): TechnicalAttribute {
  const row = isRecord(raw) ? raw : {};
  const dt = toStringSafe(row.dataType ?? row.data_type, 'text');
  const dataType: AttributeDataType =
    dt === 'number' || dt === 'boolean' || dt === 'select' ? dt : 'text';

  const rawCategoryIds = row.categoryIds ?? row.category_ids ?? row.categories;
  const categoryIds = Array.isArray(rawCategoryIds)
    ? rawCategoryIds
        .map((item) => {
          if (typeof item === 'string') return item;
          if (isRecord(item)) return toStringSafe(item.id ?? item.slug, '');
          return '';
        })
        .filter(Boolean)
    : [];

  const rawOptions = row.options;
  const options = Array.isArray(rawOptions)
    ? rawOptions.map((o) => toStringSafe(o).trim()).filter(Boolean)
    : undefined;

  return {
    id: toStringSafe(row.id, `attr-${idx + 1}`),
    code: toStringSafe(row.code, ''),
    nameFa: toStringSafe(row.nameFa ?? row.name_fa, ''),
    nameEn: toStringSafe(row.nameEn ?? row.name_en, ''),
    dataType,
    unit: toOptionalString(row.unit),
    options,
    isFilterable: toBooleanSafe(row.isFilterable ?? row.is_filterable, false),
    sortOrder: Math.floor(toFiniteNumber(row.sortOrder ?? row.sort_order, idx + 1)),
    categoryIds,
    createdAt: toOptionalString(row.createdAt ?? row.created_at) ?? undefined,
  };
}

export function normalizeWarehouse(raw: unknown, idx = 0): Warehouse {
  const row = isRecord(raw) ? raw : {};
  return {
    id: toStringSafe(row.id, `wh-${idx + 1}`),
    code: toStringSafe(row.code, ''),
    nameFa: toStringSafe(row.nameFa ?? row.name_fa, ''),
    city: toStringSafe(row.city, ''),
    addressFa: toStringSafe(row.addressFa ?? row.address_fa ?? row.address, ''),
    postalCode: toOptionalString(row.postalCode ?? row.postal_code),
    phone: toOptionalString(row.phone),
    managerName: toOptionalString(row.managerName ?? row.manager_name),
    isCentral: toBooleanSafe(row.isCentral ?? row.is_central, false),
    isActive: toBooleanSafe(row.isActive ?? row.is_active, true),
    createdAt: toOptionalString(row.createdAt ?? row.created_at) ?? undefined,
    updatedAt: toOptionalString(row.updatedAt ?? row.updated_at) ?? undefined,
  };
}

export function normalizeWarehouseStockItem(raw: unknown, idx = 0): WarehouseStockItem {
  const row = isRecord(raw) ? raw : {};
  const quantityOnHand = Math.floor(toFiniteNumber(row.quantityOnHand ?? row.quantity_on_hand, 0));
  const reservedQty = Math.floor(toFiniteNumber(row.reservedQty ?? row.reserved_qty, 0));
  const availableQty = Math.floor(
    toFiniteNumber(row.availableQty ?? row.available_qty, Math.max(0, quantityOnHand - reservedQty))
  );
  const minStockAlert = Math.max(0, Math.floor(toFiniteNumber(row.minStockAlert ?? row.min_stock_alert, 0)));

  return {
    id: toOptionalString(row.id) ?? `ws-${idx + 1}`,
    warehouseId: toStringSafe(row.warehouseId ?? row.warehouse_id, ''),
    warehouseCode: toStringSafe(row.warehouseCode ?? row.warehouse_code, ''),
    warehouseNameFa: toStringSafe(row.warehouseNameFa ?? row.warehouse_name_fa, ''),
    variantId: toStringSafe(row.variantId ?? row.variant_id, ''),
    sku: toStringSafe(row.sku, ''),
    productId: toStringSafe(row.productId ?? row.product_id, ''),
    productNameFa: toOptionalString(row.productNameFa ?? row.product_name_fa) ?? undefined,
    partNumber: toOptionalString(row.partNumber ?? row.part_number),
    shelfLocation: toOptionalString(row.shelfLocation ?? row.shelf_location),
    quantityOnHand,
    reservedQty,
    availableQty,
    minStockAlert,
    isLowStock: toBooleanSafe(row.isLowStock ?? row.is_low_stock, availableQty <= minStockAlert),
    updatedAt: toOptionalString(row.updatedAt ?? row.updated_at) ?? undefined,
  };
}

export function normalizeStockMovement(raw: unknown, idx = 0): StockMovement {
  const row = isRecord(raw) ? raw : {};
  const mt = toStringSafe(row.movementType ?? row.movement_type, 'inventory_adjustment') as StockMovementType;

  return {
    id: toStringSafe(row.id, `mov-${idx + 1}`),
    warehouseId: toStringSafe(row.warehouseId ?? row.warehouse_id, ''),
    warehouseCode: toOptionalString(row.warehouseCode ?? row.warehouse_code) ?? undefined,
    warehouseNameFa: toOptionalString(row.warehouseNameFa ?? row.warehouse_name_fa) ?? undefined,
    variantId: toStringSafe(row.variantId ?? row.variant_id, ''),
    sku: toOptionalString(row.sku) ?? undefined,
    productId: toOptionalString(row.productId ?? row.product_id) ?? undefined,
    productNameFa: toOptionalString(row.productNameFa ?? row.product_name_fa) ?? undefined,
    movementType: mt,
    quantityChange: Math.trunc(toFiniteNumber(row.quantityChange ?? row.quantity_change, 0)),
    balanceAfter: toOptionalFiniteNumber(row.balanceAfter ?? row.balance_after),
    shelfLocation: toOptionalString(row.shelfLocation ?? row.shelf_location),
    minStockAlert: toOptionalFiniteNumber(row.minStockAlert ?? row.min_stock_alert),
    referenceType: toOptionalString(row.referenceType ?? row.reference_type),
    referenceId: toOptionalString(row.referenceId ?? row.reference_id),
    noteFa: toOptionalString(row.noteFa ?? row.note_fa),
    idempotencyKey: toOptionalString(row.idempotencyKey ?? row.idempotency_key),
    adminEmail: toOptionalString(row.adminEmail ?? row.admin_email),
    createdAt: toStringSafe(row.createdAt ?? row.created_at, ''),
  };
}

export function normalizeRbacRole(raw: unknown, idx = 0): RbacRole {
  const row = isRecord(raw) ? raw : {};
  return {
    id: toStringSafe(row.id, `role-${idx + 1}`),
    name: toStringSafe(row.name, ''),
    titleFa: toStringSafe(row.titleFa ?? row.title_fa, ''),
    description: toStringSafe(row.description, ''),
    isSystem: toBooleanSafe(row.isSystem ?? row.is_system, true),
  };
}

function normalizeOrderItem(raw: unknown, idx: number): OrderItem {
  const row = isRecord(raw) ? raw : {};
  return {
    key: toStringSafe(row.key, `item-${idx + 1}`),
    productId: toStringSafe(row.productId ?? row.product_id, ''),
    variantId: toOptionalString(row.variantId ?? row.variant_id) ?? undefined,
    sku: toOptionalString(row.sku) ?? undefined,
    partNumber: toOptionalString(row.partNumber ?? row.part_number) ?? undefined,
    simType: toOptionalString(row.simType ?? row.sim_type) ?? undefined,
    slug: toStringSafe(row.slug, ''),
    nameFa: toStringSafe(row.nameFa ?? row.name_fa ?? row.name, 'کالا'),
    brand: toStringSafe(row.brand, ''),
    image: toStringSafe(row.image ?? row.image_url, ''),
    colorName: toStringSafe(row.colorName ?? row.color_name, ''),
    colorHex: toStringSafe(row.colorHex ?? row.color_hex, '#1e293b'),
    storageLabel: toStringSafe(row.storageLabel ?? row.storage_label, ''),
    warranty: toStringSafe(
      row.warranty ?? row.warrantyTitle ?? row.warranty_title ?? row.warrantyName ?? row.warranty_name,
      ''
    ),
    unitPrice: toFiniteNumber(row.unitPrice ?? row.unit_price ?? row.price, 0),
    originalUnitPrice: toFiniteNumber(
      row.originalUnitPrice ?? row.original_unit_price ?? row.unitPrice ?? row.price,
      0
    ),
    costPriceToman: toOptionalFiniteNumber(row.costPriceToman ?? row.cost_price_toman),
    assignedImei: toOptionalString(row.assignedImei ?? row.assigned_imei),
    qty: Math.max(1, Math.floor(toFiniteNumber(row.qty ?? row.quantity, 1))),
    stockCount: Math.max(0, Math.floor(toFiniteNumber(row.stockCount ?? row.stock_count, 0))),
  };
}

function normalizeOrderPaymentStatus(value: unknown): OrderPaymentStatus | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.trim().toLowerCase();
  if (v === 'paid' || v === 'confirmed' || v === 'success') return 'paid';
  if (v === 'pending' || v === 'unpaid' || v === 'awaiting_payment') return 'pending';
  if (v === 'failed' || v === 'error') return 'failed';
  if (v === 'refunded') return 'refunded';
  return undefined;
}

function normalizeOrderStatusHistory(raw: unknown): OrderStatusHistoryItem[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const items = raw
    .map((entry): OrderStatusHistoryItem | null => {
      if (!isRecord(entry)) return null;
      const status = toStringSafe(entry.status, '').trim();
      if (!status) return null;
      return {
        status,
        note: toOptionalString(entry.note ?? entry.adminNote ?? entry.admin_note),
        changedAt: toOptionalString(entry.changedAt ?? entry.changed_at ?? entry.createdAt ?? entry.created_at),
        actor: toOptionalString(entry.actor ?? entry.adminEmail ?? entry.admin_email),
      };
    })
    .filter((entry): entry is OrderStatusHistoryItem => entry !== null);
  return items.length > 0 ? items : undefined;
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
    paymentStatus: normalizeOrderPaymentStatus(row.paymentStatus ?? row.payment_status),
    trackingCode: toOptionalString(row.trackingCode ?? row.tracking_code ?? row.postalTrackingCode ?? row.postal_tracking_code),
    statusHistory: normalizeOrderStatusHistory(row.statusHistory ?? row.status_history),
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
    username: toOptionalString(row.username) ?? undefined,
    avatarUrl: toOptionalString(row.avatarUrl ?? row.avatar_url) ?? undefined,
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
  const rawWishlist = Array.isArray(row.wishlist) ? row.wishlist : [];
  return {
    ...summary,
    usernameChangedAt:
      toOptionalString(row.usernameChangedAt ?? row.username_changed_at) ?? undefined,
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
    wishlist: rawWishlist.map((item) => toStringSafe(item)).filter(Boolean),
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
    targetType: toStringSafe(
      row.targetType ?? row.target_type ?? row.entityType ?? row.entity_type,
      ''
    ),
    targetId: toStringSafe(
      row.targetId ?? row.target_id ?? row.entityId ?? row.entity_id,
      ''
    ),
    details: isRecord(row.details) ? row.details : {},
    createdAt: toStringSafe(row.createdAt ?? row.created_at, ''),
  };
}

export function normalizeCoupon(raw: unknown, idx = 0): CouponItem {
  const row = isRecord(raw) ? raw : {};
  const dtRaw = toStringSafe(row.discountType ?? row.discount_type, 'percent');
  const discountType: CouponDiscountType = dtRaw === 'fixed' ? 'fixed' : 'percent';
  return {
    code: toStringSafe(row.code ?? row.id, `COUPON-${idx + 1}`),
    discountType,
    discountValue: toFiniteNumber(row.discountValue ?? row.discount_value, 0),
    maxDiscount: toOptionalFiniteNumber(row.maxDiscount ?? row.max_discount),
    minOrderAmount: Math.max(0, toFiniteNumber(row.minOrderAmount ?? row.min_order_amount, 0)),
    isActive: toBooleanSafe(row.isActive ?? row.is_active, true),
    descriptionFa: toStringSafe(row.descriptionFa ?? row.description_fa, ''),
    createdAt: toOptionalString(row.createdAt ?? row.created_at) ?? undefined,
  };
}

export function normalizeSupportTicket(raw: unknown, idx = 0): SupportTicket {
  const row = isRecord(raw) ? raw : {};
  const statusRaw = toStringSafe(row.status, 'open');
  const status: TicketStatus =
    statusRaw === 'in_progress' || statusRaw === 'resolved' ? statusRaw : 'open';
  return {
    id: toStringSafe(row.id, `ticket-${idx + 1}`),
    ticketCode: toStringSafe(row.ticketCode ?? row.ticket_code, ''),
    fullName: toStringSafe(row.fullName ?? row.full_name, 'کاربر'),
    phone: toStringSafe(row.phone, ''),
    department: toStringSafe(row.department, 'پشتیبانی عمومی'),
    orderCode: toOptionalString(row.orderCode ?? row.order_code),
    message: toStringSafe(row.message, ''),
    status,
    adminReply: toOptionalString(row.adminReply ?? row.admin_reply),
    createdAt: toStringSafe(row.createdAt ?? row.created_at, ''),
    updatedAt: toOptionalString(row.updatedAt ?? row.updated_at) ?? undefined,
  };
}

export function normalizeProductReview(raw: unknown, idx = 0): ProductReview {
  const row = isRecord(raw) ? raw : {};
  return {
    id: toStringSafe(row.id, `rev-${idx + 1}`),
    productId: toStringSafe(row.productId ?? row.product_id, ''),
    productNameFa: toOptionalString(row.productNameFa ?? row.product_name_fa) ?? undefined,
    author: toStringSafe(row.author, 'کاربر'),
    authorUserId: toOptionalString(row.authorUserId ?? row.author_user_id),
    rating: Math.min(5, Math.max(1, Math.round(toFiniteNumber(row.rating, 5)))),
    comment: toStringSafe(row.comment, ''),
    verified: toBooleanSafe(row.verified, false),
    isApproved: toBooleanSafe(row.isApproved ?? row.is_approved, false),
    createdAt: toStringSafe(row.createdAt ?? row.created_at, ''),
  };
}

export function normalizeNewsletterSubscriber(raw: unknown, idx = 0): NewsletterSubscriber {
  const row = isRecord(raw) ? raw : {};
  return {
    id: toStringSafe(row.id, `sub-${idx + 1}`),
    contact: toStringSafe(row.contact ?? row.email ?? row.phone, ''),
    createdAt: toStringSafe(row.createdAt ?? row.created_at, ''),
  };
}

export function normalizeStoreSettings(raw: unknown): StoreSettingEntry[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item): StoreSettingEntry | null => {
        if (!isRecord(item)) return null;
        const key = toStringSafe(item.key, '').trim();
        if (!key) return null;
        return {
          key,
          value: item.value,
          updatedAt: toOptionalString(item.updatedAt ?? item.updated_at) ?? undefined,
        };
      })
      .filter((item): item is StoreSettingEntry => item !== null);
  }
  if (!isRecord(raw)) {
    throw new ApiError('ساختار پاسخ تنظیمات فروشگاه نامعتبر است.', 502, undefined, raw);
  }
  const nested = raw.settings ?? raw.items ?? raw.data;
  if (Array.isArray(nested)) {
    return normalizeStoreSettings(nested);
  }
  const mapSource = isRecord(nested) ? nested : raw;
  return Object.entries(mapSource)
    .filter(([k]) => !['ok', 'success', 'updated', 'total'].includes(k))
    .map(([key, value]) => ({ key, value }));
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

function normalizeTopSellingProducts(raw: unknown): TopSellingProductItem[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const list = raw
    .map((item, idx): TopSellingProductItem | null => {
      if (!isRecord(item)) return null;
      const id = toStringSafe(item.id ?? item.productId ?? item.product_id, `top-${idx + 1}`);
      const nameFa = toStringSafe(item.nameFa ?? item.name_fa ?? item.name, '').trim();
      if (!nameFa) return null;
      return {
        id,
        nameFa,
        brand: toStringSafe(item.brand, ''),
        image: toStringSafe(item.image ?? item.image_url, ''),
        soldCount: Math.max(0, Math.floor(toFiniteNumber(item.soldCount ?? item.sold_count ?? item.qty, 0))),
        revenue: Math.max(0, toFiniteNumber(item.revenue ?? item.totalRevenue ?? item.total_revenue, 0)),
      };
    })
    .filter((item): item is TopSellingProductItem => item !== null);
  return list.length > 0 ? list : undefined;
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

  const publishedRaw = toOptionalFiniteNumber(
    metricsSource.publishedProducts ?? metricsSource.published_products ?? metricsSource.activeProducts ?? metricsSource.active_products
  );
  const unpublishedRaw = toOptionalFiniteNumber(
    metricsSource.unpublishedProducts ?? metricsSource.unpublished_products ?? metricsSource.inactiveProducts ?? metricsSource.inactive_products
  );
  const cancelledRaw = toOptionalFiniteNumber(
    metricsSource.cancelledOrdersCount ?? metricsSource.cancelled_orders_count ?? metricsSource.cancelledOrders
  );

  const metrics: DashboardMetrics = {
    totalProducts: Math.max(
      0,
      Math.floor(toFiniteNumber(metricsSource.totalProducts ?? metricsSource.total_products, 0))
    ),
    ...(publishedRaw !== null ? { publishedProducts: Math.max(0, Math.floor(publishedRaw)) } : {}),
    ...(unpublishedRaw !== null ? { unpublishedProducts: Math.max(0, Math.floor(unpublishedRaw)) } : {}),
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
    ...(cancelledRaw !== null ? { cancelledOrdersCount: Math.max(0, Math.floor(cancelledRaw)) } : {}),
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
  const rawTopSelling = source.topSellingProducts ?? source.top_selling_products;
  const rawRecentActivities = source.recentActivities ?? source.recent_activities ?? source.auditLogs ?? source.audit_logs;

  return {
    metrics,
    revenueSeries: normalizeRevenueSeries(rawSeries),
    statusBreakdown: normalizeStatusBreakdown(rawBreakdown),
    lowStockProducts: Array.isArray(rawLowStock) ? rawLowStock.map(normalizeProduct) : [],
    recentOrders: Array.isArray(rawRecentOrders) ? rawRecentOrders.map(normalizeOrder) : [],
    topSellingProducts: normalizeTopSellingProducts(rawTopSelling),
    recentActivities: Array.isArray(rawRecentActivities)
      ? rawRecentActivities.map((entry, idx) => normalizeAuditLogEntry(entry, idx))
      : undefined,
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

export function parseListWithTotal<T>(
  raw: unknown,
  keys: string[],
  mapper: (item: unknown, index: number) => T,
  errorMessage: string
): { items: T[]; total: number } {
  if (Array.isArray(raw)) {
    const items = raw.map((item, idx) => mapper(item, idx));
    return { items, total: items.length };
  }
  if (!isRecord(raw)) {
    throw new ApiError(errorMessage, 502, undefined, raw);
  }
  for (const key of [...keys, 'items', 'data', 'rows']) {
    if (Array.isArray(raw[key])) {
      const items = (raw[key] as unknown[]).map((item, idx) => mapper(item, idx));
      const total = Math.max(items.length, Math.floor(toFiniteNumber(raw.total, items.length)));
      return { items, total };
    }
  }
  throw new ApiError(errorMessage, 502, undefined, raw);
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
  if (
    'id' in raw ||
    'orderCode' in raw ||
    'order_code' in raw ||
    'email' in raw ||
    'sku' in raw ||
    'slug' in raw ||
    'code' in raw
  ) {
    return mapper(raw);
  }
  throw new ApiError(errorMessage, 502, undefined, raw);
}
