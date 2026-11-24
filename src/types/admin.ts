export type UserRole = 'customer' | 'admin';

export type BrandId = string;

export type ProductCategoryId = string;

export type OrderStatus = 'paid' | 'preparing' | 'shipped' | 'delivered' | 'cancelled';

export type OrderPaymentStatus = 'paid' | 'pending' | 'failed' | 'refunded' | 'unknown';

export interface OrderStatusHistoryItem {
  status: string;
  note?: string | null;
  changedAt?: string | null;
  actor?: string | null;
}

export type DeliverySlot = 'express' | 'standard';

export interface ProductColor {
  id: string;
  name: string;
  hex: string;
}

export interface StorageVariant {
  label: string;
  subtitle: string;
  priceDelta: number;
}

export interface ProductSpecs {
  display: string;
  displayDetails: string;
  chipset: string;
  chipsetDetails: string;
  camera: string;
  cameraDetails: string;
  battery: string;
  batteryDetails: string;
  storageDefault: string;
  ram: string;
  os: string;
}

export interface CustomSpecItem {
  label: string;
  value: string;
}

export interface ProductAttributeValue {
  id?: string;
  attributeId: string;
  attributeCode?: string;
  nameFa?: string;
  nameEn?: string;
  dataType?: AttributeDataType;
  unit?: string | null;
  valueText?: string | null;
  valueNumber?: number | null;
  valueBoolean?: boolean | null;
}

export interface ProductAttributeValueInput {
  attributeId: string;
  valueText?: string | null;
  valueNumber?: number | null;
  valueBoolean?: boolean | null;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  barcode?: string | null;
  partNumber?: string | null;
  colorNameFa?: string | null;
  colorNameEn?: string | null;
  colorHex?: string | null;
  storage?: string | null;
  ram?: string | null;
  simType?: string | null;
  warrantyId?: string | null;
  warrantyName?: string | null;
  priceToman: number;
  originalPriceToman?: number | null;
  costPriceToman?: number | null;
  isPublished: boolean;
  availableStock: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductVariantInput {
  sku: string;
  barcode?: string | null;
  partNumber?: string | null;
  colorNameFa?: string | null;
  colorNameEn?: string | null;
  colorHex?: string | null;
  storage?: string | null;
  ram?: string | null;
  simType?: string | null;
  warrantyId?: string | null;
  priceToman: number;
  originalPriceToman?: number | null;
  costPriceToman?: number | null;
  isPublished: boolean;
}

export interface Product {
  id: string;
  slug: string;
  nameFa: string;
  nameEn: string;
  modelName?: string | null;
  descriptionFa?: string | null;
  brand: BrandId;
  brandId?: string | null;
  category: ProductCategoryId;
  categoryId?: string | null;
  price: number;
  originalPrice?: number | null;
  discountPercent?: number;
  inStock: boolean;
  stockCount: number;
  expressDelivery: boolean;
  warranty: string;
  warrantyId?: string | null;
  badgeText?: string | null;
  rating: number;
  reviewCount: number;
  recommendPercent: number;
  image: string;
  images: string[];
  colorLabel: string;
  colors: ProductColor[];
  storageOptions: StorageVariant[];
  specs: ProductSpecs;
  customSpecs: CustomSpecItem[];
  isPublished: boolean;
  isFeatured: boolean;
  isFeaturedDeal?: boolean;
  isPopular?: boolean;
  salesRank: number;
  releaseOrder: number;
  attributeValues?: ProductAttributeValue[];
  variants?: ProductVariant[];
  priceUpdatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductInput {
  id: string;
  slug: string;
  nameFa: string;
  nameEn: string;
  modelName?: string | null;
  descriptionFa?: string | null;
  brand: BrandId;
  brandId?: string | null;
  category: ProductCategoryId;
  categoryId?: string | null;
  price: number;
  originalPrice: number | null;
  discountPercent: number;
  inStock: boolean;
  stockCount: number;
  expressDelivery: boolean;
  warranty: string;
  warrantyId?: string | null;
  badgeText: string | null;
  recommendPercent?: number;
  image: string;
  images?: string[];
  colorLabel: string;
  colors: ProductColor[];
  storageOptions: StorageVariant[];
  specs: ProductSpecs;
  customSpecs?: CustomSpecItem[];
  isPublished: boolean;
  isFeatured: boolean;
  isFeaturedDeal: boolean;
  isPopular: boolean;
  salesRank?: number;
  releaseOrder?: number;
}

// V3 Catalog Entities
export interface CategoryItem {
  id: string;
  label: string;
  titleEn: string;
  slug: string;
  subtitle: string;
  descriptionFa: string;
  iconName: string;
  parentId: string | null;
  image: string;
  seoTitle: string;
  seoDescription: string;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryInput {
  id?: string;
  label: string;
  titleEn?: string;
  slug: string;
  subtitle?: string;
  descriptionFa?: string;
  iconName?: string;
  parentId?: string | null;
  image?: string;
  seoTitle?: string;
  seoDescription?: string;
  sortOrder: number;
  isActive: boolean;
}

export interface BrandItem {
  id: string;
  name: string;
  labelFa: string;
  slug: string;
  logoUrl: string;
  websiteUrl: string;
  sortOrder: number;
  isFeatured: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BrandInput {
  id?: string;
  name: string;
  labelFa?: string;
  slug: string;
  logoUrl?: string;
  websiteUrl?: string;
  sortOrder: number;
  isFeatured: boolean;
  isActive: boolean;
}

export interface WarrantyItem {
  id: string;
  code?: string | null;
  providerName: string;
  durationMonths: number;
  coverageFa: string;
  termsUrl?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface WarrantyInput {
  code?: string | null;
  providerName: string;
  durationMonths: number;
  coverageFa: string;
  termsUrl?: string | null;
  isActive: boolean;
}

export type AttributeDataType = 'text' | 'number' | 'boolean' | 'select';

export interface TechnicalAttribute {
  id: string;
  code: string;
  nameFa: string;
  nameEn: string;
  dataType: AttributeDataType;
  unit?: string | null;
  options?: string[];
  isFilterable: boolean;
  sortOrder: number;
  categoryIds: string[];
  createdAt?: string;
}

export interface TechnicalAttributeInput {
  code: string;
  nameFa: string;
  nameEn?: string;
  dataType: AttributeDataType;
  unit?: string | null;
  options?: string[];
  isFilterable: boolean;
  sortOrder: number;
  categoryIds: string[];
}

// V3 Multi-Warehouse & Stock Ledger
export interface Warehouse {
  id: string;
  code: string;
  nameFa: string;
  city: string;
  addressFa: string;
  postalCode?: string | null;
  phone?: string | null;
  managerName?: string | null;
  isCentral: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface WarehouseInput {
  code: string;
  nameFa: string;
  city: string;
  addressFa?: string;
  postalCode?: string | null;
  phone?: string | null;
  managerName?: string | null;
  isCentral: boolean;
  isActive: boolean;
}

export interface WarehouseStockItem {
  id?: string;
  warehouseId: string;
  warehouseCode: string;
  warehouseNameFa: string;
  variantId: string;
  sku: string;
  productId: string;
  productNameFa?: string;
  partNumber?: string | null;
  shelfLocation?: string | null;
  quantityOnHand: number;
  reservedQty: number;
  availableQty: number;
  minStockAlert: number;
  isLowStock: boolean;
  updatedAt?: string;
}

export type StockMovementType =
  | 'opening_balance'
  | 'purchase_inflow'
  | 'order_sale'
  | 'customer_return'
  | 'transfer_out'
  | 'transfer_in'
  | 'inventory_adjustment';

export interface StockMovement {
  id: string;
  warehouseId: string;
  warehouseCode?: string;
  warehouseNameFa?: string;
  variantId: string;
  sku?: string;
  productId?: string;
  productNameFa?: string;
  movementType: StockMovementType;
  quantityChange: number;
  balanceAfter?: number | null;
  shelfLocation?: string | null;
  minStockAlert?: number | null;
  referenceType?: string | null;
  referenceId?: string | null;
  noteFa?: string | null;
  idempotencyKey?: string | null;
  adminEmail?: string | null;
  createdAt: string;
}

export interface StockMovementInput {
  warehouseId: string;
  variantId: string;
  movementType: StockMovementType;
  quantityChange: number;
  shelfLocation?: string | null;
  minStockAlert?: number | null;
  referenceType?: string | null;
  referenceId?: string | null;
  noteFa?: string | null;
  idempotencyKey: string;
}

// RBAC Roles
export interface RbacRole {
  id: string;
  name: string;
  titleFa: string;
  description: string;
  isSystem: boolean;
}

export interface UserAddress {
  id: string;
  label: string;
  receiverName: string;
  phone: string;
  city: string;
  address: string;
  postalCode: string;
  isDefault: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  username?: string;
  usernameChangedAt?: string;
  avatarUrl?: string;
  fullName: string;
  phone: string;
  role: UserRole;
  nationalId?: string;
  birthDate?: string;
  newsletterOptIn: boolean;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  hasPassword: boolean;
  addresses: UserAddress[];
  wishlist: string[];
  createdAt: string;
  lastLoginAt: string;
}

export interface OrderItem {
  key: string;
  productId: string;
  variantId?: string;
  sku?: string;
  partNumber?: string;
  simType?: string;
  slug: string;
  nameFa: string;
  brand: string;
  image: string;
  colorName: string;
  colorHex: string;
  storageLabel: string;
  warranty: string;
  unitPrice: number;
  originalUnitPrice: number;
  costPriceToman?: number | null;
  assignedImei?: string | null;
  qty: number;
  stockCount: number;
}

export interface OrderRecord {
  id?: string;
  orderCode: string;
  userId?: string | null;
  shaparakRef: string;
  customerName: string;
  customerPhone: string;
  city: string;
  shippingAddress: string;
  postalCode: string;
  deliverySlot: DeliverySlot;
  couponCode: string | null;
  subtotal: number;
  productDiscount: number;
  couponDiscount: number;
  shippingCost: number;
  totalAmount: number;
  status: OrderStatus;
  paymentStatus?: OrderPaymentStatus;
  trackingCode?: string | null;
  statusHistory?: OrderStatusHistoryItem[];
  deliveryPin: string;
  imeiSample: string;
  adminNote?: string;
  items: OrderItem[];
  createdAt: string;
  createdAtIso?: string;
  updatedAt?: string;
}

export interface AdminCustomerSummary {
  id: string;
  email: string;
  username?: string;
  avatarUrl?: string;
  fullName: string;
  phone: string;
  role: UserRole;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  newsletterOptIn: boolean;
  ordersCount: number;
  totalSpent: number;
  createdAt: string;
  lastLoginAt: string;
}

export interface AdminCustomerDetail extends AdminCustomerSummary {
  usernameChangedAt?: string;
  nationalId?: string;
  birthDate?: string;
  addresses: UserAddress[];
  wishlist?: string[];
  orders: OrderRecord[];
}

export interface AuditLogEntry {
  id: string;
  adminUserId: string | null;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface DashboardMetrics {
  totalProducts: number;
  publishedProducts?: number;
  unpublishedProducts?: number;
  inStockProducts: number;
  outOfStockProducts: number;
  lowStockCount: number;
  totalOrders: number;
  pendingOrdersCount: number;
  cancelledOrdersCount?: number;
  totalCustomers: number;
  confirmedRevenue: number;
}

export interface RevenueSeriesPoint {
  label: string;
  revenue: number;
  ordersCount: number;
}

export interface OrderStatusBreakdown {
  status: OrderStatus;
  count: number;
}

export interface TopSellingProductItem {
  id: string;
  nameFa: string;
  brand: string;
  image: string;
  soldCount: number;
  revenue: number;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  revenueSeries: RevenueSeriesPoint[];
  statusBreakdown: OrderStatusBreakdown[];
  lowStockProducts: Product[];
  recentOrders: OrderRecord[];
  topSellingProducts?: TopSellingProductItem[];
  recentActivities?: AuditLogEntry[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AdminUiPreferences {
  lowStockThreshold: number;
  compactRows: boolean;
}

// Coupons (public.coupons)
export type CouponDiscountType = 'fixed' | 'percent';

export interface CouponItem {
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscount?: number | null;
  minOrderAmount: number;
  isActive: boolean;
  descriptionFa: string;
  createdAt?: string;
}

export interface CouponInput {
  code: string;
  discountType: CouponDiscountType;
  discountValue: number;
  maxDiscount?: number | null;
  minOrderAmount: number;
  isActive: boolean;
  descriptionFa?: string;
}

// Support Tickets (public.support_tickets)
export type TicketStatus = 'open' | 'in_progress' | 'resolved';

export interface SupportTicket {
  id: string;
  ticketCode: string;
  fullName: string;
  phone: string;
  department: string;
  orderCode?: string | null;
  message: string;
  status: TicketStatus;
  adminReply?: string | null;
  createdAt: string;
  updatedAt?: string;
}

// Product Reviews (public.product_reviews)
export interface ProductReview {
  id: string;
  productId: string;
  productNameFa?: string;
  author: string;
  authorUserId?: string | null;
  rating: number;
  comment: string;
  verified: boolean;
  isApproved: boolean;
  createdAt: string;
}

// Newsletter Subscribers (public.newsletter_subscribers)
export interface NewsletterSubscriber {
  id: string;
  contact: string;
  createdAt: string;
}

// Storefront Global Settings (public.store_settings)
export interface StoreSettingEntry {
  key: string;
  value: unknown;
  updatedAt?: string;
}
