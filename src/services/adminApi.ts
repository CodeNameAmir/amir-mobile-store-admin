import type {
  AdminCustomerDetail,
  AdminCustomerSummary,
  AdminNotification,
  AuditLogEntry,
  AuthUser,
  BrandId,
  BrandInput,
  BrandItem,
  BulkProductActionInput,
  BulkProductActionResult,
  CategoryInput,
  CategoryItem,
  CmsBanner,
  CmsBannerInput,
  CmsFaq,
  CmsFaqInput,
  CmsPost,
  CmsPostInput,
  CouponInput,
  CouponItem,
  CouponRedemption,
  DashboardData,
  DashboardQueryParams,
  DeliverySlot,
  ImeiBatchInput,
  ImeiDeviceRecord,
  ImeiDeviceStatus,
  NewsletterSubscriber,
  OrderRecord,
  OrderReturnRecord,
  OrderReturnStatus,
  OrderReturnUpdateInput,
  OrderStatus,
  PaginatedResponse,
  PaymentReconciliationStatus,
  PaymentRefundInput,
  PaymentTransaction,
  PaymentTransactionStatus,
  Product,
  ProductAttributeValue,
  ProductAttributeValueInput,
  ProductCategoryId,
  ProductInput,
  ProductQuestion,
  ProductReview,
  ProductVariant,
  ProductVariantInput,
  PurchaseOrder,
  PurchaseOrderInput,
  PurchaseOrderStatus,
  RbacRole,
  ShippingMethod,
  ShippingMethodInput,
  StockMovement,
  StockMovementInput,
  StockMovementType,
  StoreSettingEntry,
  SupplierInput,
  SupplierItem,
  SupportTicket,
  TechnicalAttribute,
  TechnicalAttributeInput,
  TicketPriority,
  TicketStatus,
  UserRole,
  Warehouse,
  WarehouseInput,
  WarehouseStockItem,
  WarehouseTransferInput,
  WarehouseTransferResult,
  WarrantyInput,
  WarrantyItem,
} from '../types/admin';
import {
  ApiError,
  buildQueryString,
  isEndpointUnsupportedError,
  requestJson,
} from './apiClient';
import { invalidateCachePrefix } from './adminCache';
import {
  normalizeAdminNotification,
  normalizeAuditLogEntry,
  normalizeBrand,
  normalizeCategory,
  normalizeCmsBanner,
  normalizeCmsFaq,
  normalizeCmsPost,
  normalizeCoupon,
  normalizeCouponRedemption,
  normalizeCustomerDetail,
  normalizeCustomerSummary,
  normalizeImeiDevice,
  normalizeNewsletterSubscriber,
  normalizeOrder,
  normalizeOrderReturn,
  normalizePaymentTransaction,
  normalizeProduct,
  normalizeProductAttributeValue,
  normalizeProductQuestion,
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
  parseAuthMeResponse,
  parseDashboardResponse,
  parseEntityWrapper,
  parseListWithTotal,
  parsePaginatedResponse,
} from './adminParsers';

export interface AuthMeResponse {
  authenticated: boolean;
  user: AuthUser | null;
}

export interface PasswordLoginResponse {
  authenticated: boolean;
  requires2FA?: boolean;
  twoFactorToken?: string;
  email?: string;
  provider?: 'resend' | 'sandbox-preview';
  previewCode?: string;
  cooldownSeconds?: number;
  warning?: string;
  user: AuthUser | null;
}

export interface SendOtpResponse {
  sent: boolean;
  provider: 'resend' | 'sandbox-preview';
  previewCode?: string;
  cooldownSeconds: number;
  warning?: string;
}

export interface ProductListParams {
  search?: string;
  category?: ProductCategoryId | 'all';
  brand?: BrandId | 'all';
  stock?: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
  lowStockThreshold?: number;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'stock_asc' | 'bestselling';
  page?: number;
  pageSize?: number;
}

export interface OrderListParams {
  search?: string;
  status?: OrderStatus | 'all';
  deliverySlot?: DeliverySlot | 'all';
  page?: number;
  pageSize?: number;
}

export interface CustomerListParams {
  search?: string;
  role?: UserRole | 'all';
  page?: number;
  pageSize?: number;
}

export interface AuditLogListParams {
  search?: string;
  action?: string;
  targetType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface WarehouseStockListParams {
  warehouseId?: string;
  variantId?: string;
  productId?: string;
  lowStockOnly?: boolean;
}

export interface StockMovementListParams {
  warehouseId?: string;
  variantId?: string;
  movementType?: StockMovementType | 'all';
  limit?: number;
}

export interface TicketListParams {
  search?: string;
  status?: TicketStatus | 'all';
  page?: number;
  pageSize?: number;
}

export interface ReviewListParams {
  search?: string;
  approved?: 'all' | 'approved' | 'pending';
  productId?: string;
  page?: number;
  pageSize?: number;
}

export interface NewsletterListParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface PaymentListParams {
  search?: string;
  status?: PaymentTransactionStatus | 'all';
  reconciliationStatus?: PaymentReconciliationStatus | 'all';
  page?: number;
  pageSize?: number;
}

export interface ReturnListParams {
  search?: string;
  status?: OrderReturnStatus | 'all';
  page?: number;
  pageSize?: number;
}

export interface PurchaseOrderListParams {
  status?: PurchaseOrderStatus | 'all';
  supplierId?: string;
}

export interface ImeiListParams {
  search?: string;
  status?: ImeiDeviceStatus | 'all';
  productId?: string;
  page?: number;
  pageSize?: number;
}

async function requestWithRouteFallbacks<T>(
  attempts: Array<{ path: string; method: string; body?: string }>
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts.length; i += 1) {
    const attempt = attempts[i];
    try {
      return await requestJson<T>(attempt.path, {
        method: attempt.method,
        ...(attempt.body !== undefined ? { body: attempt.body } : {}),
      });
    } catch (err) {
      lastErr = err;
      const isRouteMissing = isEndpointUnsupportedError(err);
      if (!isRouteMissing || i === attempts.length - 1) {
        throw err;
      }
    }
  }
  throw lastErr;
}

function isMinimalAck(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const obj = raw as Record<string, unknown>;
  return Boolean(obj.ok === true || obj.updated === true || obj.success === true);
}

export const adminApi = {
  // Authentication (reuses existing Express auth endpoints)
  async getMe(): Promise<AuthMeResponse> {
    const raw = await requestJson<unknown>('/api/auth/me', { skipAuthRedirect: true });
    return parseAuthMeResponse(raw);
  },

  async verifyAdminAccess(): Promise<{ user: AuthUser }> {
    const raw = await requestJson<unknown>('/api/admin/me', { skipAuthRedirect: true });
    return parseAdminMeResponse(raw);
  },

  async loginWithPassword(payload: {
    identifier?: string;
    email?: string;
    username?: string;
    password: string;
  }): Promise<PasswordLoginResponse> {
    const rawIdentifier = (payload.identifier ?? payload.email ?? payload.username ?? '').trim();
    const isEmailInput = rawIdentifier.includes('@') && !rawIdentifier.startsWith('@');
    const primaryBody = isEmailInput
      ? {
          identifier: rawIdentifier.toLowerCase(),
          email: payload.email ?? rawIdentifier.toLowerCase(),
          password: payload.password,
        }
      : {
          identifier: rawIdentifier,
          username: payload.username ?? rawIdentifier,
          password: payload.password,
        };

    try {
      return await requestJson<PasswordLoginResponse>('/api/auth/login-password', {
        method: 'POST',
        body: JSON.stringify(primaryBody),
        skipAuthRedirect: true,
      });
    } catch (err) {
      // Fallback for Express backends that read username from req.body.email
      if (!isEmailInput && err instanceof ApiError && err.status === 400) {
        return requestJson<PasswordLoginResponse>('/api/auth/login-password', {
          method: 'POST',
          body: JSON.stringify({
            identifier: rawIdentifier,
            email: rawIdentifier,
            username: rawIdentifier,
            password: payload.password,
          }),
          skipAuthRedirect: true,
        });
      }
      throw err;
    }
  },

  verifyTwoFactor(payload: { twoFactorToken: string; code: string }): Promise<AuthMeResponse> {
    return requestJson<AuthMeResponse>('/api/auth/verify-2fa', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuthRedirect: true,
    });
  },

  resendTwoFactor(payload: { twoFactorToken: string }): Promise<SendOtpResponse> {
    return requestJson<SendOtpResponse>('/api/auth/resend-2fa', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuthRedirect: true,
    });
  },

  sendLoginOtp(email: string): Promise<SendOtpResponse> {
    return requestJson<SendOtpResponse>('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email, purpose: 'login' }),
      skipAuthRedirect: true,
    });
  },

  verifyLoginOtp(payload: { email: string; code: string }): Promise<AuthMeResponse> {
    return requestJson<AuthMeResponse>('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ ...payload, purpose: 'login' }),
      skipAuthRedirect: true,
    });
  },

  logout(allDevices = false): Promise<{ ok: boolean }> {
    return requestJson<{ ok: boolean }>('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ allDevices }),
      skipAuthRedirect: true,
    });
  },

  changePassword(payload: {
    currentPassword?: string;
    newPassword: string;
  }): Promise<{ user: AuthUser }> {
    return requestJson<{ user: AuthUser }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  toggleTwoFactor(payload: {
    enabled: boolean;
    currentPassword?: string;
  }): Promise<{ user: AuthUser }> {
    return requestJson<{ user: AuthUser }>('/api/auth/two-factor', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Dashboard stats
  async getDashboard(params: number | DashboardQueryParams = 5): Promise<DashboardData> {
    const queryObj: DashboardQueryParams =
      typeof params === 'number' ? { lowStockThreshold: params } : params;
    const qs = buildQueryString({
      lowStockThreshold: queryObj.lowStockThreshold ?? 5,
      dateFrom: queryObj.dateFrom || undefined,
      dateTo: queryObj.dateTo || undefined,
      granularity: queryObj.granularity || undefined,
    });
    const raw = await requestJson<unknown>(`/api/admin/stats${qs}`);
    return parseDashboardResponse(raw);
  },

  // Products & Inventory
  async listProducts(params: ProductListParams = {}): Promise<PaginatedResponse<Product>> {
    const qs = buildQueryString({
      search: params.search,
      category: params.category === 'all' ? undefined : params.category,
      brand: params.brand === 'all' ? undefined : params.brand,
      stock: params.stock === 'all' ? undefined : params.stock,
      lowStockThreshold: params.lowStockThreshold,
      sort: params.sort,
      page: params.page,
      pageSize: params.pageSize,
    });
    const raw = await requestJson<unknown>(`/api/admin/products${qs}`);
    return parsePaginatedResponse(raw, normalizeProduct, ['products'], params.pageSize ?? 12);
  },

  async getProduct(id: string): Promise<{ product: Product }> {
    const encoded = encodeURIComponent(id.trim());
    try {
      const raw = await requestJson<unknown>(`/api/admin/products/${encoded}`);
      return {
        product: parseEntityWrapper(
          raw,
          ['product', 'data'],
          normalizeProduct,
          'پاسخ سرور برای اطلاعات محصول معتبر نیست.'
        ),
      };
    } catch (err) {
      if (!(err instanceof ApiError) || (err.status !== 404 && err.status !== 405)) {
        throw err;
      }
      // Fallback if backend only exposes list endpoint GET /api/admin/products
      const searched = await this.listProducts({ search: id.trim(), pageSize: 50 });
      const found =
        searched.items.find((p) => p.id === id.trim() || p.slug === id.trim()) ||
        (await this.listProducts({ pageSize: 100 })).items.find(
          (p) => p.id === id.trim() || p.slug === id.trim()
        );
      if (!found) {
        throw new ApiError('محصول مورد نظر در سرور یافت نشد.', 404);
      }
      return { product: found };
    }
  },

  async createProduct(input: ProductInput): Promise<{ product: Product }> {
    const raw = await requestJson<unknown>('/api/admin/products', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    invalidateCachePrefix('products:');
    invalidateCachePrefix('dashboard:');
    invalidateCachePrefix('audit-logs:');
    return {
      product: parseEntityWrapper(
        raw,
        ['product', 'data'],
        normalizeProduct,
        'پاسخ سرور پس از ایجاد محصول معتبر نیست.'
      ),
    };
  },

  async updateProduct(id: string, input: Partial<ProductInput>): Promise<{ product: Product }> {
    const encoded = encodeURIComponent(id);
    const body = JSON.stringify(input);
    const raw = await requestWithRouteFallbacks<unknown>([
      { path: `/api/admin/products/${encoded}`, method: 'PATCH', body },
      { path: `/api/admin/products/${encoded}`, method: 'PUT', body },
    ]);
    invalidateCachePrefix('products:');
    invalidateCachePrefix(`product:${id}`);
    invalidateCachePrefix('dashboard:');
    invalidateCachePrefix('audit-logs:');
    return {
      product: parseEntityWrapper(
        raw,
        ['product', 'data'],
        normalizeProduct,
        'پاسخ سرور پس از ویرایش محصول معتبر نیست.'
      ),
    };
  },

  async updateProductStock(
    id: string,
    payload: { stockCount: number; inStock: boolean }
  ): Promise<{ product: Product | null }> {
    const encoded = encodeURIComponent(id);
    const body = JSON.stringify({
      stockCount: payload.stockCount,
      inStock: payload.inStock,
    });
    const raw = await requestWithRouteFallbacks<unknown>([
      { path: `/api/admin/products/${encoded}/stock`, method: 'PATCH', body },
      { path: `/api/admin/products/${encoded}`, method: 'PATCH', body },
      { path: `/api/admin/products/${encoded}`, method: 'PUT', body },
    ]);
    invalidateCachePrefix('products:');
    invalidateCachePrefix(`product:${id}`);
    invalidateCachePrefix('dashboard:');
    invalidateCachePrefix('audit-logs:');
    try {
      return {
        product: parseEntityWrapper(
          raw,
          ['product', 'data'],
          normalizeProduct,
          'پاسخ سرور پس از به‌روزرسانی موجودی معتبر نیست.'
        ),
      };
    } catch (err) {
      if (isMinimalAck(raw)) {
        return { product: null };
      }
      throw err;
    }
  },

  async deleteProduct(id: string): Promise<{ deleted: boolean; id: string }> {
    const res = await requestJson<{ deleted: boolean; id: string }>(
      `/api/admin/products/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      }
    );
    invalidateCachePrefix('products:');
    invalidateCachePrefix(`product:${id}`);
    invalidateCachePrefix('dashboard:');
    invalidateCachePrefix('audit-logs:');
    return res;
  },

  // V3 Product Attributes (EAV)
  async updateProductAttributes(
    productId: string,
    values: ProductAttributeValueInput[]
  ): Promise<{ attributeValues: ProductAttributeValue[] }> {
    const raw = await requestJson<unknown>(
      `/api/admin/products/${encodeURIComponent(productId)}/attributes`,
      {
        method: 'PUT',
        body: JSON.stringify({ values }),
      }
    );
    invalidateCachePrefix(`product:${productId}`);
    invalidateCachePrefix('audit-logs:');
    const list =
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? ((raw as Record<string, unknown>).attributeValues ??
          (raw as Record<string, unknown>).values ??
          (raw as Record<string, unknown>).attributes ??
          [])
        : Array.isArray(raw)
          ? raw
          : [];
    return {
      attributeValues: Array.isArray(list)
        ? list
            .map(normalizeProductAttributeValue)
            .filter((item): item is ProductAttributeValue => item !== null)
        : [],
    };
  },

  // V3 Product Variants (SKU / Part Number / Cost Price)
  async listProductVariants(productId: string): Promise<{ productId: string; variants: ProductVariant[] }> {
    const raw = await requestJson<unknown>(
      `/api/admin/products/${encodeURIComponent(productId)}/variants`
    );
    const { items } = parseListWithTotal(
      raw,
      ['variants'],
      normalizeProductVariant,
      'پاسخ سرور برای تنوع‌های کالا معتبر نیست.'
    );
    return { productId, variants: items };
  },

  async createProductVariant(
    productId: string,
    input: ProductVariantInput
  ): Promise<{ variant: ProductVariant }> {
    const raw = await requestJson<unknown>(
      `/api/admin/products/${encodeURIComponent(productId)}/variants`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    );
    invalidateCachePrefix(`product:${productId}`);
    invalidateCachePrefix('products:');
    invalidateCachePrefix('warehouse-stock:');
    invalidateCachePrefix('audit-logs:');
    return {
      variant: parseEntityWrapper(
        raw,
        ['variant', 'data'],
        normalizeProductVariant,
        'پاسخ سرور پس از ایجاد تنوع کالا معتبر نیست.'
      ),
    };
  },

  async updateVariant(
    variantId: string,
    input: Partial<ProductVariantInput>
  ): Promise<{ variant: ProductVariant }> {
    const raw = await requestJson<unknown>(
      `/api/admin/variants/${encodeURIComponent(variantId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      }
    );
    invalidateCachePrefix('product:');
    invalidateCachePrefix('products:');
    invalidateCachePrefix('warehouse-stock:');
    invalidateCachePrefix('audit-logs:');
    return {
      variant: parseEntityWrapper(
        raw,
        ['variant', 'data'],
        normalizeProductVariant,
        'پاسخ سرور پس از ویرایش تنوع کالا معتبر نیست.'
      ),
    };
  },

  async deleteVariant(variantId: string): Promise<{ deleted?: boolean; ok?: boolean }> {
    const res = await requestJson<{ deleted?: boolean; ok?: boolean }>(
      `/api/admin/variants/${encodeURIComponent(variantId)}`,
      { method: 'DELETE' }
    );
    invalidateCachePrefix('product:');
    invalidateCachePrefix('products:');
    invalidateCachePrefix('warehouse-stock:');
    invalidateCachePrefix('audit-logs:');
    return res;
  },

  // V3 Categories
  async listCategories(): Promise<{ categories: CategoryItem[] }> {
    const raw = await requestJson<unknown>('/api/admin/categories');
    const { items } = parseListWithTotal(
      raw,
      ['categories'],
      normalizeCategory,
      'پاسخ سرور برای فهرست دسته‌بندی‌ها معتبر نیست.'
    );
    return {
      categories: [...items].sort((a, b) => a.sortOrder - b.sortOrder),
    };
  },

  async createCategory(input: CategoryInput): Promise<{ category: CategoryItem }> {
    const raw = await requestJson<unknown>('/api/admin/categories', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    invalidateCachePrefix('categories:');
    invalidateCachePrefix('audit-logs:');
    return {
      category: parseEntityWrapper(
        raw,
        ['category', 'data'],
        normalizeCategory,
        'پاسخ سرور پس از ایجاد دسته‌بندی معتبر نیست.'
      ),
    };
  },

  async updateCategory(id: string, input: Partial<CategoryInput>): Promise<{ category: CategoryItem }> {
    const encoded = encodeURIComponent(id);
    const body = JSON.stringify(input);
    const raw = await requestWithRouteFallbacks<unknown>([
      { path: `/api/admin/categories/${encoded}`, method: 'PATCH', body },
      { path: `/api/admin/categories/${encoded}`, method: 'PUT', body },
    ]);
    invalidateCachePrefix('categories:');
    invalidateCachePrefix('audit-logs:');
    return {
      category: parseEntityWrapper(
        raw,
        ['category', 'data'],
        normalizeCategory,
        'پاسخ سرور پس از ویرایش دسته‌بندی معتبر نیست.'
      ),
    };
  },

  async deleteCategory(id: string): Promise<{ deleted?: boolean; ok?: boolean }> {
    const res = await requestJson<{ deleted?: boolean; ok?: boolean }>(
      `/api/admin/categories/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );
    invalidateCachePrefix('categories:');
    invalidateCachePrefix('audit-logs:');
    return res;
  },

  // V3 Brands
  async listBrands(): Promise<{ brands: BrandItem[] }> {
    const raw = await requestJson<unknown>('/api/admin/brands');
    const { items } = parseListWithTotal(
      raw,
      ['brands'],
      normalizeBrand,
      'پاسخ سرور برای فهرست برندها معتبر نیست.'
    );
    return { brands: items };
  },

  async saveBrand(input: BrandInput): Promise<{ brand: BrandItem }> {
    const raw = await requestJson<unknown>('/api/admin/brands', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    invalidateCachePrefix('brands:');
    invalidateCachePrefix('audit-logs:');
    return {
      brand: parseEntityWrapper(
        raw,
        ['brand', 'data'],
        normalizeBrand,
        'پاسخ سرور پس از ثبت برند معتبر نیست.'
      ),
    };
  },

  async deleteBrand(id: string): Promise<{ deleted?: boolean; ok?: boolean }> {
    const res = await requestJson<{ deleted?: boolean; ok?: boolean }>(
      `/api/admin/brands/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );
    invalidateCachePrefix('brands:');
    invalidateCachePrefix('audit-logs:');
    return res;
  },

  // V3 Warranties
  async listWarranties(): Promise<{ warranties: WarrantyItem[] }> {
    const raw = await requestJson<unknown>('/api/admin/warranties');
    const { items } = parseListWithTotal(
      raw,
      ['warranties'],
      normalizeWarranty,
      'پاسخ سرور برای فهرست گارانتی‌ها معتبر نیست.'
    );
    return { warranties: items };
  },

  async createWarranty(input: WarrantyInput): Promise<{ warranty: WarrantyItem }> {
    const raw = await requestJson<unknown>('/api/admin/warranties', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    invalidateCachePrefix('warranties:');
    invalidateCachePrefix('audit-logs:');
    return {
      warranty: parseEntityWrapper(
        raw,
        ['warranty', 'data'],
        normalizeWarranty,
        'پاسخ سرور پس از ایجاد گارانتی معتبر نیست.'
      ),
    };
  },

  async updateWarranty(id: string, input: Partial<WarrantyInput>): Promise<{ warranty: WarrantyItem }> {
    const raw = await requestJson<unknown>(
      `/api/admin/warranties/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      }
    );
    invalidateCachePrefix('warranties:');
    invalidateCachePrefix('audit-logs:');
    return {
      warranty: parseEntityWrapper(
        raw,
        ['warranty', 'data'],
        normalizeWarranty,
        'پاسخ سرور پس از ویرایش گارانتی معتبر نیست.'
      ),
    };
  },

  async deleteWarranty(id: string): Promise<{ deleted?: boolean; ok?: boolean }> {
    const res = await requestJson<{ deleted?: boolean; ok?: boolean }>(
      `/api/admin/warranties/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );
    invalidateCachePrefix('warranties:');
    invalidateCachePrefix('audit-logs:');
    return res;
  },

  // V3 Technical Attributes (EAV)
  async listAttributes(categorySlug?: string): Promise<{ attributes: TechnicalAttribute[] }> {
    const qs = buildQueryString({
      category: categorySlug && categorySlug !== 'all' ? categorySlug : undefined,
    });
    const raw = await requestJson<unknown>(`/api/admin/attributes${qs}`);
    const { items } = parseListWithTotal(
      raw,
      ['attributes'],
      normalizeTechnicalAttribute,
      'پاسخ سرور برای فهرست ویژگی‌های فنی معتبر نیست.'
    );
    return {
      attributes: [...items].sort((a, b) => a.sortOrder - b.sortOrder),
    };
  },

  async createAttribute(input: TechnicalAttributeInput): Promise<{ attribute: TechnicalAttribute }> {
    const raw = await requestJson<unknown>('/api/admin/attributes', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    invalidateCachePrefix('attributes:');
    invalidateCachePrefix('audit-logs:');
    return {
      attribute: parseEntityWrapper(
        raw,
        ['attribute', 'data'],
        normalizeTechnicalAttribute,
        'پاسخ سرور پس از ایجاد ویژگی فنی معتبر نیست.'
      ),
    };
  },

  async deleteAttribute(id: string): Promise<{ deleted?: boolean; ok?: boolean }> {
    const res = await requestJson<{ deleted?: boolean; ok?: boolean }>(
      `/api/admin/attributes/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );
    invalidateCachePrefix('attributes:');
    invalidateCachePrefix('audit-logs:');
    return res;
  },

  // V3 Multi-Warehouse & Stock Ledger
  async listWarehouses(): Promise<{ warehouses: Warehouse[] }> {
    const raw = await requestJson<unknown>('/api/admin/warehouses');
    const { items } = parseListWithTotal(
      raw,
      ['warehouses'],
      normalizeWarehouse,
      'پاسخ سرور برای فهرست انبارها معتبر نیست.'
    );
    return { warehouses: items };
  },

  async createWarehouse(input: WarehouseInput): Promise<{ warehouse: Warehouse }> {
    const raw = await requestJson<unknown>('/api/admin/warehouses', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    invalidateCachePrefix('warehouses:');
    invalidateCachePrefix('audit-logs:');
    return {
      warehouse: parseEntityWrapper(
        raw,
        ['warehouse', 'data'],
        normalizeWarehouse,
        'پاسخ سرور پس از ایجاد انبار معتبر نیست.'
      ),
    };
  },

  async updateWarehouse(id: string, input: Partial<WarehouseInput>): Promise<{ warehouse: Warehouse }> {
    const raw = await requestJson<unknown>(
      `/api/admin/warehouses/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      }
    );
    invalidateCachePrefix('warehouses:');
    invalidateCachePrefix('warehouse-stock:');
    invalidateCachePrefix('audit-logs:');
    return {
      warehouse: parseEntityWrapper(
        raw,
        ['warehouse', 'data'],
        normalizeWarehouse,
        'پاسخ سرور پس از ویرایش انبار معتبر نیست.'
      ),
    };
  },

  async listWarehouseStock(
    params: WarehouseStockListParams = {}
  ): Promise<{ stock: WarehouseStockItem[]; total: number }> {
    const qs = buildQueryString({
      warehouseId: params.warehouseId || undefined,
      variantId: params.variantId || undefined,
      productId: params.productId || undefined,
      lowStockOnly: params.lowStockOnly ? 'true' : undefined,
    });
    const raw = await requestJson<unknown>(`/api/admin/warehouse-stock${qs}`);
    const { items, total } = parseListWithTotal(
      raw,
      ['stock', 'warehouseStock'],
      normalizeWarehouseStockItem,
      'پاسخ سرور برای موجودی انبارها معتبر نیست.'
    );
    return { stock: items, total };
  },

  async listStockMovements(
    params: StockMovementListParams = {}
  ): Promise<{ movements: StockMovement[]; total: number }> {
    const qs = buildQueryString({
      warehouseId: params.warehouseId || undefined,
      variantId: params.variantId || undefined,
      movementType:
        params.movementType && params.movementType !== 'all' ? params.movementType : undefined,
      limit: params.limit ?? 50,
    });
    const raw = await requestJson<unknown>(`/api/admin/stock-movements${qs}`);
    const { items, total } = parseListWithTotal(
      raw,
      ['movements', 'stockMovements'],
      normalizeStockMovement,
      'پاسخ سرور برای دفترکل تراکنش‌های انبار معتبر نیست.'
    );
    return { movements: items, total };
  },

  async createStockMovement(
    input: StockMovementInput
  ): Promise<{ movement: StockMovement | null }> {
    const raw = await requestJson<unknown>('/api/admin/stock-movements', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    invalidateCachePrefix('warehouse-stock:');
    invalidateCachePrefix('stock-movements:');
    invalidateCachePrefix('products:');
    invalidateCachePrefix('dashboard:');
    invalidateCachePrefix('audit-logs:');
    try {
      return {
        movement: parseEntityWrapper(
          raw,
          ['movement', 'data'],
          normalizeStockMovement,
          'پاسخ سرور پس از ثبت تراکنش انبار معتبر نیست.'
        ),
      };
    } catch (err) {
      if (isMinimalAck(raw)) {
        return { movement: null };
      }
      throw err;
    }
  },

  async transferWarehouseStock(
    input: WarehouseTransferInput
  ): Promise<WarehouseTransferResult> {
    const raw = await requestJson<Record<string, unknown>>('/api/admin/warehouse-transfers', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    invalidateCachePrefix('warehouse-stock:');
    invalidateCachePrefix('stock-movements:');
    invalidateCachePrefix('products:');
    invalidateCachePrefix('dashboard:');
    invalidateCachePrefix('audit-logs:');
    return {
      outboundMovementId:
        typeof raw.outboundMovementId === 'string' ? raw.outboundMovementId : undefined,
      inboundMovementId:
        typeof raw.inboundMovementId === 'string' ? raw.inboundMovementId : undefined,
      fromBalanceAfter:
        typeof raw.fromBalanceAfter === 'number' ? raw.fromBalanceAfter : undefined,
      toBalanceAfter: typeof raw.toBalanceAfter === 'number' ? raw.toBalanceAfter : undefined,
    };
  },

  // Orders
  async listOrders(params: OrderListParams = {}): Promise<PaginatedResponse<OrderRecord>> {
    const qs = buildQueryString({
      search: params.search,
      status: params.status === 'all' ? undefined : params.status,
      deliverySlot: params.deliverySlot === 'all' ? undefined : params.deliverySlot,
      page: params.page,
      pageSize: params.pageSize,
    });
    const raw = await requestJson<unknown>(`/api/admin/orders${qs}`);
    return parsePaginatedResponse(raw, normalizeOrder, ['orders'], params.pageSize ?? 12);
  },

  async getOrder(orderCode: string): Promise<{ order: OrderRecord }> {
    const cleanCode = orderCode.trim().replace(/^#/, '');
    const raw = await requestJson<unknown>(
      `/api/admin/orders/${encodeURIComponent(cleanCode)}`
    );
    return {
      order: parseEntityWrapper(
        raw,
        ['order', 'data'],
        normalizeOrder,
        'پاسخ سرور برای جزئیات سفارش معتبر نیست.'
      ),
    };
  },

  async updateOrder(
    orderCode: string,
    payload: {
      status?: OrderStatus;
      adminNote?: string;
      trackingCode?: string | null;
      cancellationReason?: string | null;
    },
    orderId?: string
  ): Promise<{ order: OrderRecord | null }> {
    const cleanCode = orderCode.trim().replace(/^#/, '');
    const cleanId = orderId?.trim();
    const body = JSON.stringify(payload);

    const attempts: Array<{ path: string; method: string; body: string }> = [
      { path: `/api/admin/orders/${encodeURIComponent(cleanCode)}`, method: 'PATCH', body },
      { path: `/api/admin/orders/${encodeURIComponent(cleanCode)}/status`, method: 'PATCH', body },
    ];

    if (cleanId && cleanId !== cleanCode) {
      attempts.push(
        { path: `/api/admin/orders/${encodeURIComponent(cleanId)}`, method: 'PATCH', body },
        { path: `/api/admin/orders/${encodeURIComponent(cleanId)}/status`, method: 'PATCH', body }
      );
    }

    attempts.push(
      { path: `/api/admin/orders/${encodeURIComponent(cleanCode)}`, method: 'PUT', body },
      { path: `/api/admin/orders/${encodeURIComponent(cleanCode)}/status`, method: 'PUT', body }
    );

    if (cleanId && cleanId !== cleanCode) {
      attempts.push(
        { path: `/api/admin/orders/${encodeURIComponent(cleanId)}`, method: 'PUT', body },
        { path: `/api/admin/orders/${encodeURIComponent(cleanId)}/status`, method: 'PUT', body }
      );
    }

    const raw = await requestWithRouteFallbacks<unknown>(attempts);
    invalidateCachePrefix('orders:');
    invalidateCachePrefix('dashboard:');
    invalidateCachePrefix('audit-logs:');

    try {
      return {
        order: parseEntityWrapper(
          raw,
          ['order', 'data'],
          normalizeOrder,
          'پاسخ سرور پس از به‌روزرسانی سفارش معتبر نیست.'
        ),
      };
    } catch (err) {
      if (isMinimalAck(raw)) {
        return { order: null };
      }
      throw err;
    }
  },

  async cancelOrder(
    orderCode: string,
    payload: { reason: string; restoreStock?: boolean },
    orderId?: string
  ): Promise<{ order: OrderRecord | null }> {
    const cleanCode = orderCode.trim().replace(/^#/, '');
    const cleanId = orderId?.trim();
    const cancelBody = JSON.stringify({
      reason: payload.reason,
      cancellationReason: payload.reason,
      restoreStock: payload.restoreStock !== false,
    });
    const fallbackPatchBody = JSON.stringify({
      status: 'cancelled',
      cancellationReason: payload.reason,
      adminNote: `لغو سفارش: ${payload.reason}`,
    });

    const attempts: Array<{ path: string; method: string; body: string }> = [
      { path: `/api/admin/orders/${encodeURIComponent(cleanCode)}/cancel`, method: 'POST', body: cancelBody },
    ];
    if (cleanId && cleanId !== cleanCode) {
      attempts.push({
        path: `/api/admin/orders/${encodeURIComponent(cleanId)}/cancel`,
        method: 'POST',
        body: cancelBody,
      });
    }
    attempts.push({
      path: `/api/admin/orders/${encodeURIComponent(cleanCode)}`,
      method: 'PATCH',
      body: fallbackPatchBody,
    });

    const raw = await requestWithRouteFallbacks<unknown>(attempts);
    invalidateCachePrefix('orders:');
    invalidateCachePrefix('dashboard:');
    invalidateCachePrefix('products:');
    invalidateCachePrefix('warehouse-stock:');
    invalidateCachePrefix('audit-logs:');

    try {
      return {
        order: parseEntityWrapper(
          raw,
          ['order', 'data'],
          normalizeOrder,
          'پاسخ سرور پس از لغو سفارش معتبر نیست.'
        ),
      };
    } catch (err) {
      if (isMinimalAck(raw)) {
        return { order: null };
      }
      throw err;
    }
  },

  // Customers & RBAC
  async listCustomers(params: CustomerListParams = {}): Promise<PaginatedResponse<AdminCustomerSummary>> {
    const qs = buildQueryString({
      search: params.search,
      role: params.role === 'all' ? undefined : params.role,
      page: params.page,
      pageSize: params.pageSize,
    });
    const raw = await requestJson<unknown>(`/api/admin/customers${qs}`);
    return parsePaginatedResponse(
      raw,
      normalizeCustomerSummary,
      ['customers', 'users'],
      params.pageSize ?? 12
    );
  },

  async getCustomer(id: string): Promise<{ customer: AdminCustomerDetail }> {
    const raw = await requestJson<unknown>(
      `/api/admin/customers/${encodeURIComponent(id)}`
    );
    return {
      customer: parseEntityWrapper(
        raw,
        ['customer', 'user', 'data'],
        normalizeCustomerDetail,
        'پاسخ سرور برای پرونده کاربر معتبر نیست.'
      ),
    };
  },

  async updateCustomerRole(
    id: string,
    role: UserRole
  ): Promise<{ customer: AdminCustomerSummary }> {
    const raw = await requestJson<unknown>(
      `/api/admin/customers/${encodeURIComponent(id)}/role`,
      {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }
    );
    invalidateCachePrefix('customers:');
    invalidateCachePrefix('audit-logs:');
    return {
      customer: parseEntityWrapper(
        raw,
        ['customer', 'user', 'data'],
        normalizeCustomerSummary,
        'پاسخ سرور پس از تغییر نقش کاربر معتبر نیست.'
      ),
    };
  },

  async listRoles(): Promise<{ roles: RbacRole[] }> {
    const raw = await requestJson<unknown>('/api/admin/roles');
    const { items } = parseListWithTotal(
      raw,
      ['roles'],
      normalizeRbacRole,
      'پاسخ سرور برای نقش‌های سیستمی معتبر نیست.'
    );
    return { roles: items };
  },

  async updateRolePermissions(roleId: string, permissions: string[]): Promise<{ role: RbacRole }> {
    const encoded = encodeURIComponent(roleId);
    const body = JSON.stringify({ permissions });
    const raw = await requestWithRouteFallbacks<unknown>([
      { path: `/api/admin/roles/${encoded}/permissions`, method: 'PUT', body },
      { path: `/api/admin/roles/${encoded}`, method: 'PATCH', body },
    ]);
    invalidateCachePrefix('roles:');
    invalidateCachePrefix('audit-logs:');
    return {
      role: parseEntityWrapper(
        raw,
        ['role', 'data'],
        normalizeRbacRole,
        'پاسخ سرور پس از به‌روزرسانی مجوزهای نقش معتبر نیست.'
      ),
    };
  },

  async assignCustomerRoles(
    customerId: string,
    roleIds: string[]
  ): Promise<{ customer?: AdminCustomerSummary; roles?: RbacRole[] }> {
    const encoded = encodeURIComponent(customerId);
    const raw = await requestJson<Record<string, unknown>>(
      `/api/admin/customers/${encoded}/roles`,
      {
        method: 'PUT',
        body: JSON.stringify({ roleIds }),
      }
    );
    invalidateCachePrefix('customers:');
    invalidateCachePrefix('audit-logs:');
    const rolesRaw = Array.isArray(raw.roles) ? raw.roles.map((r, i) => normalizeRbacRole(r, i)) : undefined;
    const customerRaw = raw.customer || raw.user ? normalizeCustomerSummary(raw.customer ?? raw.user) : undefined;
    return { customer: customerRaw, roles: rolesRaw };
  },

  async updateCustomerStatus(
    customerId: string,
    payload: { isBlocked?: boolean; isActive?: boolean; reason?: string }
  ): Promise<{ customer: AdminCustomerSummary }> {
    const encoded = encodeURIComponent(customerId);
    const raw = await requestJson<unknown>(`/api/admin/customers/${encoded}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    invalidateCachePrefix('customers:');
    invalidateCachePrefix('audit-logs:');
    return {
      customer: parseEntityWrapper(
        raw,
        ['customer', 'user', 'data'],
        normalizeCustomerSummary,
        'پاسخ سرور پس از تغییر وضعیت حساب کاربر معتبر نیست.'
      ),
    };
  },

  async updateCustomerNote(
    customerId: string,
    internalNote: string
  ): Promise<{ internalNote: string; customer?: AdminCustomerDetail }> {
    const encoded = encodeURIComponent(customerId);
    const body = JSON.stringify({ internalNote: internalNote.trim() || null });
    const raw = await requestWithRouteFallbacks<Record<string, unknown>>([
      { path: `/api/admin/customers/${encoded}/notes`, method: 'PATCH', body },
      { path: `/api/admin/customers/${encoded}`, method: 'PATCH', body },
    ]);
    invalidateCachePrefix('customers:');
    invalidateCachePrefix('audit-logs:');
    const customerCandidate = raw.customer ?? raw.user;
    return {
      internalNote:
        typeof raw.internalNote === 'string'
          ? raw.internalNote
          : typeof raw.internal_note === 'string'
            ? raw.internal_note
            : internalNote.trim(),
      ...(customerCandidate ? { customer: normalizeCustomerDetail(customerCandidate) } : {}),
    };
  },

  // Audit Logs
  async listAuditLogs(params: AuditLogListParams = {}): Promise<PaginatedResponse<AuditLogEntry>> {
    const qs = buildQueryString({
      search: params.search || undefined,
      action: params.action === 'all' ? undefined : params.action,
      targetType: params.targetType === 'all' ? undefined : params.targetType,
      dateFrom: params.dateFrom || undefined,
      dateTo: params.dateTo || undefined,
      page: params.page,
      pageSize: params.pageSize,
    });
    const raw = await requestJson<unknown>(`/api/admin/audit-logs${qs}`);
    return parsePaginatedResponse(
      raw,
      normalizeAuditLogEntry,
      ['auditLogs', 'logs'],
      params.pageSize ?? 15
    );
  },

  async recordSensitiveAccess(payload: {
    targetType: string;
    targetId: string;
    field: string;
  }): Promise<void> {
    try {
      await requestJson<unknown>('/api/admin/audit-logs/sensitive-access', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch {
      // Best-effort audit telemetry when endpoint is optional
    }
  },

  // Coupons (public.coupons)
  async listCoupons(): Promise<{ coupons: CouponItem[] }> {
    const raw = await requestJson<unknown>('/api/admin/coupons');
    const { items } = parseListWithTotal(
      raw,
      ['coupons'],
      normalizeCoupon,
      'پاسخ سرور برای فهرست کدهای تخفیف معتبر نیست.'
    );
    return { coupons: items };
  },

  async createCoupon(input: CouponInput): Promise<{ coupon: CouponItem }> {
    const raw = await requestJson<unknown>('/api/admin/coupons', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    invalidateCachePrefix('coupons:');
    invalidateCachePrefix('audit-logs:');
    return {
      coupon: parseEntityWrapper(
        raw,
        ['coupon', 'data'],
        normalizeCoupon,
        'پاسخ سرور پس از ثبت کد تخفیف معتبر نیست.'
      ),
    };
  },

  async updateCoupon(code: string, input: Partial<CouponInput>): Promise<{ coupon: CouponItem }> {
    const encoded = encodeURIComponent(code.trim());
    const body = JSON.stringify(input);
    const raw = await requestWithRouteFallbacks<unknown>([
      { path: `/api/admin/coupons/${encoded}`, method: 'PATCH', body },
      { path: `/api/admin/coupons/${encoded}`, method: 'PUT', body },
    ]);
    invalidateCachePrefix('coupons:');
    invalidateCachePrefix('audit-logs:');
    return {
      coupon: parseEntityWrapper(
        raw,
        ['coupon', 'data'],
        normalizeCoupon,
        'پاسخ سرور پس از ویرایش کد تخفیف معتبر نیست.'
      ),
    };
  },

  async deleteCoupon(code: string): Promise<{ deleted?: boolean; ok?: boolean }> {
    const res = await requestJson<{ deleted?: boolean; ok?: boolean }>(
      `/api/admin/coupons/${encodeURIComponent(code.trim())}`,
      { method: 'DELETE' }
    );
    invalidateCachePrefix('coupons:');
    invalidateCachePrefix('audit-logs:');
    return res;
  },

  // Support Tickets (public.support_tickets)
  async listTickets(params: TicketListParams = {}): Promise<PaginatedResponse<SupportTicket>> {
    const qs = buildQueryString({
      search: params.search,
      status: params.status === 'all' ? undefined : params.status,
      page: params.page,
      pageSize: params.pageSize,
    });
    const raw = await requestWithRouteFallbacks<unknown>([
      { path: `/api/admin/tickets${qs}`, method: 'GET' },
      { path: `/api/admin/support-tickets${qs}`, method: 'GET' },
    ]);
    return parsePaginatedResponse(
      raw,
      normalizeSupportTicket,
      ['tickets', 'supportTickets'],
      params.pageSize ?? 12
    );
  },

  async updateTicket(
    id: string,
    payload: {
      status?: TicketStatus;
      priority?: TicketPriority;
      assignedTo?: string | null;
      internalNote?: string | null;
      slaDueAt?: string | null;
      adminReply?: string | null;
    }
  ): Promise<{ ticket: SupportTicket }> {
    const encoded = encodeURIComponent(id);
    const body = JSON.stringify(payload);
    const raw = await requestWithRouteFallbacks<unknown>([
      { path: `/api/admin/tickets/${encoded}`, method: 'PATCH', body },
      { path: `/api/admin/support-tickets/${encoded}`, method: 'PATCH', body },
      { path: `/api/admin/tickets/${encoded}`, method: 'PUT', body },
    ]);
    invalidateCachePrefix('tickets:');
    invalidateCachePrefix('audit-logs:');
    return {
      ticket: parseEntityWrapper(
        raw,
        ['ticket', 'data'],
        normalizeSupportTicket,
        'پاسخ سرور پس از به‌روزرسانی تیکت معتبر نیست.'
      ),
    };
  },

  // Product Reviews (public.product_reviews)
  async listReviews(params: ReviewListParams = {}): Promise<PaginatedResponse<ProductReview>> {
    const qs = buildQueryString({
      search: params.search,
      approved: params.approved === 'all' ? undefined : params.approved,
      productId: params.productId || undefined,
      page: params.page,
      pageSize: params.pageSize,
    });
    const raw = await requestWithRouteFallbacks<unknown>([
      { path: `/api/admin/reviews${qs}`, method: 'GET' },
      { path: `/api/admin/product-reviews${qs}`, method: 'GET' },
    ]);
    return parsePaginatedResponse(
      raw,
      normalizeProductReview,
      ['reviews', 'productReviews'],
      params.pageSize ?? 12
    );
  },

  async updateReview(
    id: string,
    payload: { isApproved?: boolean; verified?: boolean }
  ): Promise<{ review: ProductReview }> {
    const encoded = encodeURIComponent(id);
    const body = JSON.stringify(payload);
    const raw = await requestWithRouteFallbacks<unknown>([
      { path: `/api/admin/reviews/${encoded}`, method: 'PATCH', body },
      { path: `/api/admin/product-reviews/${encoded}`, method: 'PATCH', body },
    ]);
    invalidateCachePrefix('reviews:');
    invalidateCachePrefix('audit-logs:');
    return {
      review: parseEntityWrapper(
        raw,
        ['review', 'data'],
        normalizeProductReview,
        'پاسخ سرور پس از ویرایش دیدگاه معتبر نیست.'
      ),
    };
  },

  async deleteReview(id: string): Promise<{ deleted?: boolean; ok?: boolean }> {
    const encoded = encodeURIComponent(id);
    const res = await requestWithRouteFallbacks<{ deleted?: boolean; ok?: boolean }>([
      { path: `/api/admin/reviews/${encoded}`, method: 'DELETE' },
      { path: `/api/admin/product-reviews/${encoded}`, method: 'DELETE' },
    ]);
    invalidateCachePrefix('reviews:');
    invalidateCachePrefix('audit-logs:');
    return res;
  },

  // Newsletter Subscribers (public.newsletter_subscribers)
  async listNewsletterSubscribers(
    params: NewsletterListParams = {}
  ): Promise<PaginatedResponse<NewsletterSubscriber>> {
    const qs = buildQueryString({
      search: params.search,
      page: params.page,
      pageSize: params.pageSize,
    });
    const raw = await requestWithRouteFallbacks<unknown>([
      { path: `/api/admin/newsletter${qs}`, method: 'GET' },
      { path: `/api/admin/newsletter-subscribers${qs}`, method: 'GET' },
    ]);
    return parsePaginatedResponse(
      raw,
      normalizeNewsletterSubscriber,
      ['subscribers', 'newsletterSubscribers'],
      params.pageSize ?? 15
    );
  },

  async deleteNewsletterSubscriber(id: string): Promise<{ deleted?: boolean; ok?: boolean }> {
    const encoded = encodeURIComponent(id);
    const res = await requestWithRouteFallbacks<{ deleted?: boolean; ok?: boolean }>([
      { path: `/api/admin/newsletter/${encoded}`, method: 'DELETE' },
      { path: `/api/admin/newsletter-subscribers/${encoded}`, method: 'DELETE' },
    ]);
    invalidateCachePrefix('newsletter:');
    invalidateCachePrefix('audit-logs:');
    return res;
  },

  // Storefront Global Settings (public.store_settings)
  async listStoreSettings(): Promise<{ settings: StoreSettingEntry[] }> {
    const raw = await requestWithRouteFallbacks<unknown>([
      { path: '/api/admin/store-settings', method: 'GET' },
      { path: '/api/admin/settings', method: 'GET' },
    ]);
    return { settings: normalizeStoreSettings(raw) };
  },

  async saveStoreSettings(
    settings: Array<{ key: string; value: unknown }>
  ): Promise<{ settings: StoreSettingEntry[] }> {
    const body = JSON.stringify({ settings });
    const raw = await requestWithRouteFallbacks<unknown>([
      { path: '/api/admin/store-settings', method: 'PUT', body },
      { path: '/api/admin/store-settings', method: 'PATCH', body },
      { path: '/api/admin/settings', method: 'PUT', body },
    ]);
    invalidateCachePrefix('store-settings:');
    invalidateCachePrefix('audit-logs:');
    return { settings: normalizeStoreSettings(raw) };
  },

  // Phase 2: Coupon Redemptions History
  async listCouponRedemptions(code: string): Promise<{ redemptions: CouponRedemption[] }> {
    const raw = await requestJson<unknown>(
      `/api/admin/coupons/${encodeURIComponent(code.trim())}/redemptions`
    );
    const { items } = parseListWithTotal(
      raw,
      ['redemptions'],
      normalizeCouponRedemption,
      'پاسخ سرور برای سابقه مصرف کد تخفیف معتبر نیست.'
    );
    return { redemptions: items };
  },

  // Phase 2: Payments & Refunds Ledger
  async listPayments(params: PaymentListParams = {}): Promise<PaginatedResponse<PaymentTransaction>> {
    const qs = buildQueryString({
      search: params.search || undefined,
      status: params.status && params.status !== 'all' ? params.status : undefined,
      reconciliationStatus:
        params.reconciliationStatus && params.reconciliationStatus !== 'all'
          ? params.reconciliationStatus
          : undefined,
      page: params.page,
      pageSize: params.pageSize,
    });
    const raw = await requestJson<unknown>(`/api/admin/payments${qs}`);
    return parsePaginatedResponse(
      raw,
      normalizePaymentTransaction,
      ['payments', 'transactions'],
      params.pageSize ?? 15
    );
  },

  async refundPayment(
    paymentId: string,
    payload: PaymentRefundInput
  ): Promise<{ payment: PaymentTransaction | null }> {
    const raw = await requestJson<unknown>(
      `/api/admin/payments/${encodeURIComponent(paymentId)}/refund`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    invalidateCachePrefix('payments:');
    invalidateCachePrefix('orders:');
    invalidateCachePrefix('dashboard:');
    invalidateCachePrefix('audit-logs:');
    try {
      return {
        payment: parseEntityWrapper(
          raw,
          ['payment', 'transaction', 'data'],
          normalizePaymentTransaction,
          'پاسخ سرور پس از ثبت استرداد وجه معتبر نیست.'
        ),
      };
    } catch (err) {
      if (isMinimalAck(raw)) return { payment: null };
      throw err;
    }
  },

  async reconcilePayment(
    paymentId: string,
    reconciliationStatus: PaymentReconciliationStatus
  ): Promise<{ payment: PaymentTransaction }> {
    const raw = await requestJson<unknown>(
      `/api/admin/payments/${encodeURIComponent(paymentId)}/reconcile`,
      {
        method: 'PATCH',
        body: JSON.stringify({ reconciliationStatus }),
      }
    );
    invalidateCachePrefix('payments:');
    invalidateCachePrefix('audit-logs:');
    return {
      payment: parseEntityWrapper(
        raw,
        ['payment', 'transaction', 'data'],
        normalizePaymentTransaction,
        'پاسخ سرور پس از مغایرت‌گیری پرداخت معتبر نیست.'
      ),
    };
  },

  // Phase 2: Returns / RMA Workflow
  async listReturns(params: ReturnListParams = {}): Promise<PaginatedResponse<OrderReturnRecord>> {
    const qs = buildQueryString({
      search: params.search || undefined,
      status: params.status && params.status !== 'all' ? params.status : undefined,
      page: params.page,
      pageSize: params.pageSize,
    });
    const raw = await requestJson<unknown>(`/api/admin/returns${qs}`);
    return parsePaginatedResponse(raw, normalizeOrderReturn, ['returns'], params.pageSize ?? 15);
  },

  async updateReturnStatus(
    returnId: string,
    payload: OrderReturnUpdateInput
  ): Promise<{ returnRecord: OrderReturnRecord }> {
    const raw = await requestJson<unknown>(
      `/api/admin/returns/${encodeURIComponent(returnId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    );
    invalidateCachePrefix('returns:');
    invalidateCachePrefix('orders:');
    invalidateCachePrefix('warehouse-stock:');
    invalidateCachePrefix('audit-logs:');
    return {
      returnRecord: parseEntityWrapper(
        raw,
        ['returnRecord', 'return', 'data'],
        normalizeOrderReturn,
        'پاسخ سرور پس از به‌روزرسانی وضعیت مرجوعی معتبر نیست.'
      ),
    };
  },

  // Phase 2: Shipping Methods & Zones
  async listShippingMethods(): Promise<{ shippingMethods: ShippingMethod[] }> {
    const raw = await requestJson<unknown>('/api/admin/shipping-methods');
    const { items } = parseListWithTotal(
      raw,
      ['shippingMethods', 'methods'],
      normalizeShippingMethod,
      'پاسخ سرور برای فهرست روش‌های ارسال معتبر نیست.'
    );
    return { shippingMethods: [...items].sort((a, b) => a.sortOrder - b.sortOrder) };
  },

  async saveShippingMethod(
    input: ShippingMethodInput,
    existingId?: string
  ): Promise<{ shippingMethod: ShippingMethod }> {
    const body = JSON.stringify(input);
    const raw = existingId
      ? await requestWithRouteFallbacks<unknown>([
          { path: `/api/admin/shipping-methods/${encodeURIComponent(existingId)}`, method: 'PATCH', body },
          { path: `/api/admin/shipping-methods/${encodeURIComponent(existingId)}`, method: 'PUT', body },
        ])
      : await requestJson<unknown>('/api/admin/shipping-methods', { method: 'POST', body });
    invalidateCachePrefix('shipping-methods:');
    invalidateCachePrefix('audit-logs:');
    return {
      shippingMethod: parseEntityWrapper(
        raw,
        ['shippingMethod', 'method', 'data'],
        normalizeShippingMethod,
        'پاسخ سرور پس از ذخیره روش ارسال معتبر نیست.'
      ),
    };
  },

  async deleteShippingMethod(id: string): Promise<{ deleted?: boolean; ok?: boolean }> {
    const res = await requestJson<{ deleted?: boolean; ok?: boolean }>(
      `/api/admin/shipping-methods/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );
    invalidateCachePrefix('shipping-methods:');
    invalidateCachePrefix('audit-logs:');
    return res;
  },

  // Phase 2: Suppliers & Purchase Orders
  async listSuppliers(): Promise<{ suppliers: SupplierItem[] }> {
    const raw = await requestJson<unknown>('/api/admin/suppliers');
    const { items } = parseListWithTotal(
      raw,
      ['suppliers'],
      normalizeSupplier,
      'پاسخ سرور برای فهرست تامین‌کنندگان معتبر نیست.'
    );
    return { suppliers: items };
  },

  async saveSupplier(input: SupplierInput, existingId?: string): Promise<{ supplier: SupplierItem }> {
    const body = JSON.stringify(input);
    const raw = existingId
      ? await requestWithRouteFallbacks<unknown>([
          { path: `/api/admin/suppliers/${encodeURIComponent(existingId)}`, method: 'PATCH', body },
          { path: `/api/admin/suppliers/${encodeURIComponent(existingId)}`, method: 'PUT', body },
        ])
      : await requestJson<unknown>('/api/admin/suppliers', { method: 'POST', body });
    invalidateCachePrefix('suppliers:');
    invalidateCachePrefix('audit-logs:');
    return {
      supplier: parseEntityWrapper(
        raw,
        ['supplier', 'data'],
        normalizeSupplier,
        'پاسخ سرور پس از ذخیره تامین‌کننده معتبر نیست.'
      ),
    };
  },

  async deleteSupplier(id: string): Promise<{ deleted?: boolean; ok?: boolean }> {
    const res = await requestJson<{ deleted?: boolean; ok?: boolean }>(
      `/api/admin/suppliers/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );
    invalidateCachePrefix('suppliers:');
    invalidateCachePrefix('audit-logs:');
    return res;
  },

  async listPurchaseOrders(
    params: PurchaseOrderListParams = {}
  ): Promise<{ purchaseOrders: PurchaseOrder[] }> {
    const qs = buildQueryString({
      status: params.status && params.status !== 'all' ? params.status : undefined,
      supplierId: params.supplierId || undefined,
    });
    const raw = await requestJson<unknown>(`/api/admin/purchase-orders${qs}`);
    const { items } = parseListWithTotal(
      raw,
      ['purchaseOrders', 'orders'],
      normalizePurchaseOrder,
      'پاسخ سرور برای فهرست سفارش‌های خرید معتبر نیست.'
    );
    return { purchaseOrders: items };
  },

  async createPurchaseOrder(input: PurchaseOrderInput): Promise<{ purchaseOrder: PurchaseOrder }> {
    const raw = await requestJson<unknown>('/api/admin/purchase-orders', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    invalidateCachePrefix('purchase-orders:');
    invalidateCachePrefix('audit-logs:');
    return {
      purchaseOrder: parseEntityWrapper(
        raw,
        ['purchaseOrder', 'data'],
        normalizePurchaseOrder,
        'پاسخ سرور پس از ثبت سفارش خرید معتبر نیست.'
      ),
    };
  },

  async receivePurchaseOrder(poId: string): Promise<{ purchaseOrder: PurchaseOrder }> {
    const raw = await requestJson<unknown>(
      `/api/admin/purchase-orders/${encodeURIComponent(poId)}/receive`,
      {
        method: 'POST',
      }
    );
    invalidateCachePrefix('purchase-orders:');
    invalidateCachePrefix('warehouse-stock:');
    invalidateCachePrefix('stock-movements:');
    invalidateCachePrefix('products:');
    invalidateCachePrefix('audit-logs:');
    return {
      purchaseOrder: parseEntityWrapper(
        raw,
        ['purchaseOrder', 'data'],
        normalizePurchaseOrder,
        'پاسخ سرور پس از ثبت ورود خرید به انبار معتبر نیست.'
      ),
    };
  },

  // Phase 3: Bulk Product Operations, Image Upload & IMEI Device Registry
  async bulkUpdateProducts(payload: BulkProductActionInput): Promise<BulkProductActionResult> {
    const raw = await requestJson<Record<string, unknown>>('/api/admin/products/bulk', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    invalidateCachePrefix('products:');
    invalidateCachePrefix('dashboard:');
    invalidateCachePrefix('audit-logs:');
    return {
      updatedCount:
        typeof raw.updatedCount === 'number'
          ? raw.updatedCount
          : typeof raw.updated === 'number'
            ? raw.updated
            : payload.productIds.length,
      failedIds: Array.isArray(raw.failedIds)
        ? raw.failedIds.filter((x): x is string => typeof x === 'string')
        : undefined,
    };
  },

  async uploadAdminImage(file: File): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const raw = await requestJson<Record<string, unknown>>('/api/admin/uploads', {
      method: 'POST',
      body: formData,
    });
    const url =
      (typeof raw.url === 'string' && raw.url.trim()) ||
      (typeof raw.publicUrl === 'string' && raw.publicUrl.trim()) ||
      (raw.data &&
      typeof raw.data === 'object' &&
      !Array.isArray(raw.data) &&
      typeof (raw.data as Record<string, unknown>).url === 'string'
        ? String((raw.data as Record<string, unknown>).url).trim()
        : '');
    if (!url) {
      throw new ApiError('نشانی تصویر آپلودشده در پاسخ سرور یافت نشد.', 502, undefined, raw);
    }
    return { url };
  },

  async listImeiDevices(
    params: ImeiListParams = {}
  ): Promise<PaginatedResponse<ImeiDeviceRecord>> {
    const qs = buildQueryString({
      search: params.search || undefined,
      status: params.status && params.status !== 'all' ? params.status : undefined,
      productId: params.productId || undefined,
      page: params.page,
      pageSize: params.pageSize,
    });
    const raw = await requestJson<unknown>(`/api/admin/imei${qs}`);
    return parsePaginatedResponse(
      raw,
      normalizeImeiDevice,
      ['devices', 'imeis', 'productDevices'],
      params.pageSize ?? 20
    );
  },

  async registerImeiBatch(
    payload: ImeiBatchInput
  ): Promise<{ createdCount: number; devices: ImeiDeviceRecord[] }> {
    const raw = await requestJson<Record<string, unknown>>('/api/admin/imei/batch', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    invalidateCachePrefix('imei:');
    invalidateCachePrefix('audit-logs:');
    const rawDevices = Array.isArray(raw.devices)
      ? raw.devices
      : Array.isArray(raw.items)
        ? raw.items
        : [];
    const devices = rawDevices.map((d, idx) => normalizeImeiDevice(d, idx));
    return {
      createdCount:
        typeof raw.createdCount === 'number'
          ? raw.createdCount
          : devices.length || payload.imeis.length,
      devices,
    };
  },

  async updateImeiDevice(
    id: string,
    patch: { status?: ImeiDeviceStatus; orderCode?: string | null; note?: string | null }
  ): Promise<{ device: ImeiDeviceRecord }> {
    const raw = await requestJson<unknown>(`/api/admin/imei/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    invalidateCachePrefix('imei:');
    invalidateCachePrefix('audit-logs:');
    return {
      device: parseEntityWrapper(
        raw,
        ['device', 'imei', 'data'],
        normalizeImeiDevice,
        'پاسخ سرور پس از به‌روزرسانی وضعیت سریال IMEI معتبر نیست.'
      ),
    };
  },

  // Phase 4: Product Q&A, Content CMS & Notifications
  async listQuestions(params: {
    search?: string;
    published?: 'all' | 'published' | 'unanswered';
    page?: number;
    pageSize?: number;
  } = {}): Promise<PaginatedResponse<ProductQuestion>> {
    const qs = buildQueryString({
      search: params.search || undefined,
      published: params.published && params.published !== 'all' ? params.published : undefined,
      page: params.page,
      pageSize: params.pageSize,
    });
    const raw = await requestJson<unknown>(`/api/admin/questions${qs}`);
    return parsePaginatedResponse(
      raw,
      normalizeProductQuestion,
      ['questions', 'productQuestions'],
      params.pageSize ?? 15
    );
  },

  async answerQuestion(
    id: string,
    payload: { answer: string; isPublished: boolean }
  ): Promise<{ question: ProductQuestion }> {
    const raw = await requestJson<unknown>(`/api/admin/questions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    invalidateCachePrefix('questions:');
    invalidateCachePrefix('audit-logs:');
    return {
      question: parseEntityWrapper(
        raw,
        ['question', 'data'],
        normalizeProductQuestion,
        'پاسخ سرور پس از ثبت پاسخ پرسش معتبر نیست.'
      ),
    };
  },

  async deleteQuestion(id: string): Promise<{ deleted?: boolean; ok?: boolean }> {
    const res = await requestJson<{ deleted?: boolean; ok?: boolean }>(
      `/api/admin/questions/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );
    invalidateCachePrefix('questions:');
    invalidateCachePrefix('audit-logs:');
    return res;
  },

  async listCmsPosts(): Promise<{ posts: CmsPost[] }> {
    const raw = await requestWithRouteFallbacks<unknown>([
      { path: '/api/admin/content/posts', method: 'GET' },
      { path: '/api/admin/blog', method: 'GET' },
      { path: '/api/admin/blog-posts', method: 'GET' },
    ]);
    const { items } = parseListWithTotal(
      raw,
      ['posts', 'blogPosts'],
      normalizeCmsPost,
      'پاسخ سرور برای فهرست مقالات وبلاگ معتبر نیست.'
    );
    return { posts: items };
  },

  async saveCmsPost(input: CmsPostInput, existingId?: string): Promise<{ post: CmsPost }> {
    const body = JSON.stringify(input);
    const encoded = existingId ? encodeURIComponent(existingId) : '';
    const raw = existingId
      ? await requestWithRouteFallbacks<unknown>([
          { path: `/api/admin/content/posts/${encoded}`, method: 'PATCH', body },
          { path: `/api/admin/content/posts/${encoded}`, method: 'PUT', body },
          { path: `/api/admin/blog/${encoded}`, method: 'PATCH', body },
          { path: `/api/admin/blog/${encoded}`, method: 'PUT', body },
          { path: `/api/admin/blog-posts/${encoded}`, method: 'PATCH', body },
        ])
      : await requestWithRouteFallbacks<unknown>([
          { path: '/api/admin/content/posts', method: 'POST', body },
          { path: '/api/admin/blog', method: 'POST', body },
          { path: '/api/admin/blog-posts', method: 'POST', body },
        ]);
    invalidateCachePrefix('cms-posts:');
    invalidateCachePrefix('audit-logs:');
    return {
      post: parseEntityWrapper(raw, ['post', 'data'], normalizeCmsPost, 'پاسخ سرور برای مقاله معتبر نیست.'),
    };
  },

  async deleteCmsPost(id: string): Promise<{ deleted?: boolean; ok?: boolean }> {
    const encoded = encodeURIComponent(id);
    const res = await requestWithRouteFallbacks<{ deleted?: boolean; ok?: boolean }>([
      { path: `/api/admin/content/posts/${encoded}`, method: 'DELETE' },
      { path: `/api/admin/blog/${encoded}`, method: 'DELETE' },
      { path: `/api/admin/blog-posts/${encoded}`, method: 'DELETE' },
    ]);
    invalidateCachePrefix('cms-posts:');
    return res;
  },

  async listCmsBanners(): Promise<{ banners: CmsBanner[] }> {
    const raw = await requestJson<unknown>('/api/admin/content/banners');
    const { items } = parseListWithTotal(
      raw,
      ['banners'],
      normalizeCmsBanner,
      'پاسخ سرور برای فهرست بنرها معتبر نیست.'
    );
    return { banners: [...items].sort((a, b) => a.sortOrder - b.sortOrder) };
  },

  async saveCmsBanner(input: CmsBannerInput, existingId?: string): Promise<{ banner: CmsBanner }> {
    const body = JSON.stringify(input);
    const raw = existingId
      ? await requestWithRouteFallbacks<unknown>([
          { path: `/api/admin/content/banners/${encodeURIComponent(existingId)}`, method: 'PATCH', body },
          { path: `/api/admin/content/banners/${encodeURIComponent(existingId)}`, method: 'PUT', body },
        ])
      : await requestJson<unknown>('/api/admin/content/banners', { method: 'POST', body });
    invalidateCachePrefix('cms-banners:');
    return {
      banner: parseEntityWrapper(raw, ['banner', 'data'], normalizeCmsBanner, 'پاسخ سرور برای بنر معتبر نیست.'),
    };
  },

  async deleteCmsBanner(id: string): Promise<{ deleted?: boolean; ok?: boolean }> {
    const res = await requestJson<{ deleted?: boolean; ok?: boolean }>(
      `/api/admin/content/banners/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );
    invalidateCachePrefix('cms-banners:');
    return res;
  },

  async listCmsFaqs(): Promise<{ faqs: CmsFaq[] }> {
    const raw = await requestJson<unknown>('/api/admin/content/faqs');
    const { items } = parseListWithTotal(
      raw,
      ['faqs'],
      normalizeCmsFaq,
      'پاسخ سرور برای فهرست سوالات متداول معتبر نیست.'
    );
    return { faqs: [...items].sort((a, b) => a.sortOrder - b.sortOrder) };
  },

  async saveCmsFaq(input: CmsFaqInput, existingId?: string): Promise<{ faq: CmsFaq }> {
    const body = JSON.stringify(input);
    const raw = existingId
      ? await requestWithRouteFallbacks<unknown>([
          { path: `/api/admin/content/faqs/${encodeURIComponent(existingId)}`, method: 'PATCH', body },
          { path: `/api/admin/content/faqs/${encodeURIComponent(existingId)}`, method: 'PUT', body },
        ])
      : await requestJson<unknown>('/api/admin/content/faqs', { method: 'POST', body });
    invalidateCachePrefix('cms-faqs:');
    return {
      faq: parseEntityWrapper(raw, ['faq', 'data'], normalizeCmsFaq, 'پاسخ سرور برای سوال متداول معتبر نیست.'),
    };
  },

  async deleteCmsFaq(id: string): Promise<{ deleted?: boolean; ok?: boolean }> {
    const res = await requestJson<{ deleted?: boolean; ok?: boolean }>(
      `/api/admin/content/faqs/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );
    invalidateCachePrefix('cms-faqs:');
    return res;
  },

  async listAdminNotifications(): Promise<{ notifications: AdminNotification[] }> {
    const raw = await requestJson<unknown>('/api/admin/notifications');
    const { items } = parseListWithTotal(
      raw,
      ['notifications'],
      normalizeAdminNotification,
      'پاسخ سرور برای اعلانات معتبر نیست.'
    );
    return { notifications: items };
  },

  async markNotificationRead(id: string): Promise<{ ok: boolean }> {
    return requestJson<{ ok: boolean }>(
      `/api/admin/notifications/${encodeURIComponent(id)}/read`,
      { method: 'PATCH' }
    );
  },
};
