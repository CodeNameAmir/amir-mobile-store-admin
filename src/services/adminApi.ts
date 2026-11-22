import type {
  AdminCustomerDetail,
  AdminCustomerSummary,
  AuditLogEntry,
  AuthUser,
  BrandId,
  BrandInput,
  BrandItem,
  CategoryInput,
  CategoryItem,
  DashboardData,
  DeliverySlot,
  OrderRecord,
  OrderStatus,
  PaginatedResponse,
  Product,
  ProductAttributeValue,
  ProductAttributeValueInput,
  ProductCategoryId,
  ProductInput,
  ProductVariant,
  ProductVariantInput,
  RbacRole,
  StockMovement,
  StockMovementInput,
  StockMovementType,
  TechnicalAttribute,
  TechnicalAttributeInput,
  UserRole,
  Warehouse,
  WarehouseInput,
  WarehouseStockItem,
  WarrantyInput,
  WarrantyItem,
} from '../types/admin';
import { ApiError, buildQueryString, requestJson } from './apiClient';
import { invalidateCachePrefix } from './adminCache';
import {
  normalizeAuditLogEntry,
  normalizeBrand,
  normalizeCategory,
  normalizeCustomerDetail,
  normalizeCustomerSummary,
  normalizeOrder,
  normalizeProduct,
  normalizeProductAttributeValue,
  normalizeProductVariant,
  normalizeRbacRole,
  normalizeStockMovement,
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
  action?: string;
  targetType?: string;
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
      const isRouteMissing =
        err instanceof ApiError && (err.status === 404 || err.status === 405);
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
  async getDashboard(lowStockThreshold = 5): Promise<DashboardData> {
    const qs = buildQueryString({ lowStockThreshold });
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
    payload: { status?: OrderStatus; adminNote?: string },
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

  // Audit Logs
  async listAuditLogs(params: AuditLogListParams = {}): Promise<PaginatedResponse<AuditLogEntry>> {
    const qs = buildQueryString({
      action: params.action === 'all' ? undefined : params.action,
      targetType: params.targetType === 'all' ? undefined : params.targetType,
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
};
