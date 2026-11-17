import type {
  DemoUser,
  OrderRecord,
  OtpPurpose,
  ResendServiceStatus,
  UserAddress,
} from '../types/store';

export interface SendOtpPayload {
  email: string;
  purpose: OtpPurpose;
  fullName?: string;
  phone?: string;
  password?: string;
}

export interface SendOtpResponse {
  sent: boolean;
  provider: 'resend' | 'sandbox-preview';
  emailId?: string;
  previewCode?: string;
  cooldownSeconds: number;
  warning?: string;
}

export interface AuthResponse {
  authenticated: boolean;
  user: DemoUser | null;
}

export interface PasswordLoginResponse extends AuthResponse {
  requires2FA?: boolean;
  twoFactorToken?: string;
  email?: string;
  provider?: 'resend' | 'sandbox-preview';
  emailId?: string;
  previewCode?: string;
  cooldownSeconds?: number;
  warning?: string;
}

export interface AuthStatusResponse extends ResendServiceStatus {
  authenticated: boolean;
  user: DemoUser | null;
}

export function resolveApiBaseUrl(envApiUrl?: string, runtimeHostname?: string): string {
  const configured = (envApiUrl || '').trim().replace(/\/+$/, '');
  if (configured) return configured;

  if (runtimeHostname === 'amir-mobile-store.codenameamir.ir') {
    return 'https://api.codenameamir.ir';
  }
  return '';
}

const viteEnv =
  typeof import.meta !== 'undefined' &&
  (import.meta as { env?: Record<string, string | undefined> }).env
    ? (import.meta as { env?: Record<string, string | undefined> }).env
    : undefined;
const runtimeHostname = typeof window !== 'undefined' ? window.location.hostname : undefined;

export const API_BASE_URL = resolveApiBaseUrl(viteEnv?.VITE_API_URL, runtimeHostname);

export function buildApiUrl(path: string, baseUrl = API_BASE_URL): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(buildApiUrl(path), {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `خطای سرور (${res.status})`);
  }
  return data;
}

export const authApi = {
  async getStatus(): Promise<AuthStatusResponse> {
    return requestJson<AuthStatusResponse>('/api/auth/status');
  },

  async getMe(): Promise<AuthResponse> {
    return requestJson<AuthResponse>('/api/auth/me');
  },

  async sendOtp(payload: SendOtpPayload): Promise<SendOtpResponse> {
    return requestJson<SendOtpResponse>('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async verifyOtp(payload: {
    email: string;
    purpose: OtpPurpose;
    code: string;
    newPassword?: string;
  }): Promise<AuthResponse> {
    return requestJson<AuthResponse>('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async loginWithPassword(payload: {
    email: string;
    password: string;
  }): Promise<PasswordLoginResponse> {
    return requestJson<PasswordLoginResponse>('/api/auth/login-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async verifyTwoFactor(payload: { twoFactorToken: string; code: string }): Promise<AuthResponse> {
    return requestJson<AuthResponse>('/api/auth/verify-2fa', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async resendTwoFactor(payload: { twoFactorToken: string }): Promise<SendOtpResponse> {
    return requestJson<SendOtpResponse>('/api/auth/resend-2fa', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async toggleTwoFactor(payload: {
    enabled: boolean;
    currentPassword?: string;
  }): Promise<{ user: DemoUser }> {
    return requestJson<{ user: DemoUser }>('/api/auth/two-factor', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async logout(allDevices = false): Promise<void> {
    await requestJson<{ ok: boolean }>('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ allDevices }),
    });
  },

  async updateProfile(payload: {
    fullName: string;
    phone: string;
    nationalId?: string;
    birthDate?: string;
    newsletterOptIn?: boolean;
  }): Promise<{ user: DemoUser }> {
    return requestJson<{ user: DemoUser }>('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async changePassword(payload: {
    currentPassword?: string;
    newPassword: string;
  }): Promise<{ user: DemoUser }> {
    return requestJson<{ user: DemoUser }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async addAddress(payload: Omit<UserAddress, 'id'>): Promise<{ user: DemoUser }> {
    return requestJson<{ user: DemoUser }>('/api/auth/addresses', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateAddress(id: string, payload: Omit<UserAddress, 'id'>): Promise<{ user: DemoUser }> {
    return requestJson<{ user: DemoUser }>(`/api/auth/addresses/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async setDefaultAddress(id: string): Promise<{ user: DemoUser }> {
    return requestJson<{ user: DemoUser }>(`/api/auth/addresses/${encodeURIComponent(id)}/default`, {
      method: 'POST',
    });
  },

  async deleteAddress(id: string): Promise<{ user: DemoUser }> {
    return requestJson<{ user: DemoUser }>(`/api/auth/addresses/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async saveWishlist(wishlist: string[]): Promise<{ user: DemoUser; wishlist: string[] }> {
    return requestJson<{ user: DemoUser; wishlist: string[] }>('/api/auth/wishlist', {
      method: 'PUT',
      body: JSON.stringify({ wishlist }),
    });
  },

  async toggleWishlist(
    productId: string
  ): Promise<{ user: DemoUser; wishlist: string[]; added: boolean }> {
    return requestJson<{ user: DemoUser; wishlist: string[]; added: boolean }>(
      '/api/auth/wishlist/toggle',
      {
        method: 'POST',
        body: JSON.stringify({ productId }),
      }
    );
  },

  async getMyOrders(): Promise<{ orders: OrderRecord[] }> {
    return requestJson<{ orders: OrderRecord[] }>('/api/orders/mine');
  },

  async createOrder(
    order: OrderRecord
  ): Promise<{ order: OrderRecord; syncedToDatabase: boolean }> {
    return requestJson<{ order: OrderRecord; syncedToDatabase: boolean }>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  },

  async findOrderByCode(orderCode: string): Promise<OrderRecord | null> {
    try {
      const data = await requestJson<{ order: OrderRecord }>(
        `/api/orders/${encodeURIComponent(orderCode.trim().toUpperCase())}`
      );
      return data.order || null;
    } catch {
      return null;
    }
  },

  async notifyOrderPlaced(payload: {
    orderCode: string;
    totalFormatted: string;
    itemsCount: number;
  }): Promise<void> {
    await fetch(buildApiUrl('/api/orders/notify'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => undefined);
  },
};
