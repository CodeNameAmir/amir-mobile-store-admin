import type {
  AdminCustomerDetail,
  AdminCustomerSummary,
  AuditLogEntry,
  AuthUser,
  BrandId,
  DashboardData,
  DeliverySlot,
  OrderRecord,
  OrderStatus,
  PaginatedResponse,
  Product,
  ProductCategoryId,
  ProductInput,
  UserRole,
} from '../types/admin';
import { buildQueryString, requestJson } from './apiClient';
import {
  normalizeAuditLogEntry,
  normalizeCustomerDetail,
  normalizeCustomerSummary,
  normalizeOrder,
  normalizeProduct,
  parseAdminMeResponse,
  parseAuthMeResponse,
  parseDashboardResponse,
  parseEntityWrapper,
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

  loginWithPassword(payload: {
    email: string;
    password: string;
  }): Promise<PasswordLoginResponse> {
    return requestJson<PasswordLoginResponse>('/api/auth/login-password', {
      method: 'POST',
      body: JSON.stringify(payload),
      skipAuthRedirect: true,
    });
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

  async createProduct(input: ProductInput): Promise<{ product: Product }> {
    const raw = await requestJson<unknown>('/api/admin/products', {
      method: 'POST',
      body: JSON.stringify(input),
    });
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
    const raw = await requestJson<unknown>(`/api/admin/products/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
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
  ): Promise<{ product: Product }> {
    const raw = await requestJson<unknown>(
      `/api/admin/products/${encodeURIComponent(id)}/stock`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    );
    return {
      product: parseEntityWrapper(
        raw,
        ['product', 'data'],
        normalizeProduct,
        'پاسخ سرور پس از به‌روزرسانی موجودی معتبر نیست.'
      ),
    };
  },

  deleteProduct(id: string): Promise<{ deleted: boolean; id: string }> {
    return requestJson<{ deleted: boolean; id: string }>(
      `/api/admin/products/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
      }
    );
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
    const raw = await requestJson<unknown>(
      `/api/admin/orders/${encodeURIComponent(orderCode)}`
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
    payload: { status?: OrderStatus; adminNote?: string }
  ): Promise<{ order: OrderRecord }> {
    const raw = await requestJson<unknown>(
      `/api/admin/orders/${encodeURIComponent(orderCode)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    );
    return {
      order: parseEntityWrapper(
        raw,
        ['order', 'data'],
        normalizeOrder,
        'پاسخ سرور پس از به‌روزرسانی سفارش معتبر نیست.'
      ),
    };
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
    return {
      customer: parseEntityWrapper(
        raw,
        ['customer', 'user', 'data'],
        normalizeCustomerSummary,
        'پاسخ سرور پس از تغییر نقش کاربر معتبر نیست.'
      ),
    };
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
