export type UserRole = 'customer' | 'admin';

export type BrandId = 'Apple' | 'Samsung' | 'Xiaomi' | 'Honor' | 'Anker' | 'Motorola';

export type ProductCategoryId =
  | 'phones'
  | 'tablets'
  | 'smartwatches'
  | 'audio'
  | 'chargers'
  | 'cases'
  | 'gaming';

export type OrderStatus = 'paid' | 'preparing' | 'shipped' | 'delivered';

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

export interface Product {
  id: string;
  slug: string;
  nameFa: string;
  nameEn: string;
  brand: BrandId;
  category: ProductCategoryId;
  price: number;
  originalPrice?: number | null;
  discountPercent?: number;
  inStock: boolean;
  stockCount: number;
  expressDelivery: boolean;
  warranty: string;
  badgeText?: string | null;
  rating: number;
  reviewCount: number;
  recommendPercent: number;
  image: string;
  colorLabel: string;
  colors: ProductColor[];
  storageOptions: StorageVariant[];
  specs: ProductSpecs;
  isFeaturedDeal?: boolean;
  isPopular?: boolean;
  salesRank: number;
  releaseOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductInput {
  id: string;
  slug: string;
  nameFa: string;
  nameEn: string;
  brand: BrandId;
  category: ProductCategoryId;
  price: number;
  originalPrice: number | null;
  discountPercent: number;
  inStock: boolean;
  stockCount: number;
  expressDelivery: boolean;
  warranty: string;
  badgeText: string | null;
  image: string;
  colorLabel: string;
  colors: ProductColor[];
  storageOptions: StorageVariant[];
  specs: ProductSpecs;
  isFeaturedDeal: boolean;
  isPopular: boolean;
  salesRank?: number;
  releaseOrder?: number;
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
  nationalId?: string;
  birthDate?: string;
  addresses: UserAddress[];
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
  inStockProducts: number;
  outOfStockProducts: number;
  lowStockCount: number;
  totalOrders: number;
  pendingOrdersCount: number;
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

export interface DashboardData {
  metrics: DashboardMetrics;
  revenueSeries: RevenueSeriesPoint[];
  statusBreakdown: OrderStatusBreakdown[];
  lowStockProducts: Product[];
  recentOrders: OrderRecord[];
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
