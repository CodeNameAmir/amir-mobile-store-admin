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
  getMe(): Promise<AuthMeResponse> {
    return requestJson<AuthMeResponse>('/api/auth/me', { skipAuthRedirect: true });
  },

  verifyAdminAccess(): Promise<{ user: AuthUser }> {
    return requestJson<{ user: AuthUser }>('/api/admin/me');
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

  // Dashboard
  getDashboard(lowStockThreshold = 5): Promise<DashboardData> {
    const qs = buildQueryString({ lowStockThreshold });
    return requestJson<DashboardData>(`/api/admin/dashboard${qs}`);
  },

  // Products & Inventory
  listProducts(params: ProductListParams = {}): Promise<PaginatedResponse<Product>> {
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
    return requestJson<PaginatedResponse<Product>>(`/api/admin/products${qs}`);
  },

  createProduct(input: ProductInput): Promise<{ product: Product }> {
    return requestJson<{ product: Product }>('/api/admin/products', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  updateProduct(id: string, input: Partial<ProductInput>): Promise<{ product: Product }> {
    return requestJson<{ product: Product }>(`/api/admin/products/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  updateProductStock(
    id: string,
    payload: { stockCount: number; inStock: boolean }
  ): Promise<{ product: Product }> {
    return requestJson<{ product: Product }>(
      `/api/admin/products/${encodeURIComponent(id)}/stock`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    );
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
  listOrders(params: OrderListParams = {}): Promise<PaginatedResponse<OrderRecord>> {
    const qs = buildQueryString({
      search: params.search,
      status: params.status === 'all' ? undefined : params.status,
      deliverySlot: params.deliverySlot === 'all' ? undefined : params.deliverySlot,
      page: params.page,
      pageSize: params.pageSize,
    });
    return requestJson<PaginatedResponse<OrderRecord>>(`/api/admin/orders${qs}`);
  },

  getOrder(orderCode: string): Promise<{ order: OrderRecord }> {
    return requestJson<{ order: OrderRecord }>(
      `/api/admin/orders/${encodeURIComponent(orderCode)}`
    );
  },

  updateOrder(
    orderCode: string,
    payload: { status?: OrderStatus; adminNote?: string }
  ): Promise<{ order: OrderRecord }> {
    return requestJson<{ order: OrderRecord }>(
      `/api/admin/orders/${encodeURIComponent(orderCode)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    );
  },

  // Customers & RBAC
  listCustomers(params: CustomerListParams = {}): Promise<PaginatedResponse<AdminCustomerSummary>> {
    const qs = buildQueryString({
      search: params.search,
      role: params.role === 'all' ? undefined : params.role,
      page: params.page,
      pageSize: params.pageSize,
    });
    return requestJson<PaginatedResponse<AdminCustomerSummary>>(`/api/admin/customers${qs}`);
  },

  getCustomer(id: string): Promise<{ customer: AdminCustomerDetail }> {
    return requestJson<{ customer: AdminCustomerDetail }>(
      `/api/admin/customers/${encodeURIComponent(id)}`
    );
  },

  updateCustomerRole(
    id: string,
    role: UserRole
  ): Promise<{ customer: AdminCustomerSummary }> {
    return requestJson<{ customer: AdminCustomerSummary }>(
      `/api/admin/customers/${encodeURIComponent(id)}/role`,
      {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      }
    );
  },

  // Audit Logs
  listAuditLogs(params: AuditLogListParams = {}): Promise<PaginatedResponse<AuditLogEntry>> {
    const qs = buildQueryString({
      action: params.action === 'all' ? undefined : params.action,
      targetType: params.targetType === 'all' ? undefined : params.targetType,
      page: params.page,
      pageSize: params.pageSize,
    });
    return requestJson<PaginatedResponse<AuditLogEntry>>(`/api/admin/audit-logs${qs}`);
  },
};
