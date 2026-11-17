import crypto from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { resolveSessionSecret, resolveSupabaseAdminConfig } from './config.ts';

export type OtpPurpose = 'signup' | 'login' | 'login-2fa' | 'reset-password' | 'change-email';

export interface StoredAddress {
  id: string;
  label: string;
  receiverName: string;
  phone: string;
  city: string;
  address: string;
  postalCode: string;
  isDefault: boolean;
}

export interface StoredOrderItem {
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

export interface StoredOrderRecord {
  orderCode: string;
  shaparakRef: string;
  customerName: string;
  customerPhone: string;
  city: string;
  shippingAddress: string;
  postalCode: string;
  deliverySlot: 'express' | 'standard';
  couponCode: string | null;
  subtotal: number;
  productDiscount: number;
  couponDiscount: number;
  shippingCost: number;
  totalAmount: number;
  status: 'paid' | 'preparing' | 'shipped' | 'delivered';
  deliveryPin: string;
  imeiSample: string;
  adminNote?: string;
  items: StoredOrderItem[];
  createdAt: string;
}

export interface StoredUserRecord {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  nationalId?: string;
  birthDate?: string;
  newsletterOptIn: boolean;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  passwordHash?: string;
  addresses: StoredAddress[];
  wishlist: string[];
  activeSessionIds: string[];
  createdAt: string;
  lastLoginAt: string;
}

export interface PublicUserDTO {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  nationalId?: string;
  birthDate?: string;
  newsletterOptIn: boolean;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  hasPassword: boolean;
  addresses: StoredAddress[];
  wishlist: string[];
  createdAt: string;
  lastLoginAt: string;
}

export interface OtpChallengeRecord {
  challengeKey: string;
  id: string;
  email: string;
  purpose: OtpPurpose;
  codeHash: string;
  expiresAt: number;
  resendAvailableAt: number;
  attempts: number;
  pendingUserId?: string;
  pendingSignup?: {
    fullName: string;
    phone: string;
    passwordHash?: string;
  };
}

export interface AuthStorageAdapter {
  mode: 'supabase' | 'dev-memory';
  checkHealth(): Promise<{ ok: boolean; mode: 'supabase' | 'dev-memory'; detail?: string }>;
  findUserByEmail(email: string): Promise<StoredUserRecord | null>;
  findUserById(userId: string): Promise<StoredUserRecord | null>;
  createUser(params: {
    email: string;
    fullName: string;
    phone: string;
    passwordHash?: string;
  }): Promise<StoredUserRecord>;
  updateUser(
    userId: string,
    updater: (user: StoredUserRecord) => StoredUserRecord
  ): Promise<StoredUserRecord | null>;
  getOtpChallenge(challengeKey: string): Promise<OtpChallengeRecord | null>;
  upsertOtpChallenge(challenge: OtpChallengeRecord): Promise<void>;
  deleteOtpChallenge(challengeKey: string): Promise<void>;
  listUserOrders(userId: string): Promise<StoredOrderRecord[]>;
  createOrder(userId: string | null, order: StoredOrderRecord): Promise<StoredOrderRecord>;
  findOrderByCode(orderCode: string): Promise<StoredOrderRecord | null>;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash?: string): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, hexKey] = storedHash.split(':');
  if (!salt || !hexKey) return false;
  const expectedBuf = Buffer.from(hexKey, 'hex');
  const actualBuf = crypto.scryptSync(password, salt, 64);
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

function hashOtpCode(code: string, email: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`${email}:${code}`).digest('hex');
}

export function toPublicUser(user: StoredUserRecord): PublicUserDTO {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone,
    nationalId: user.nationalId,
    birthDate: user.birthDate,
    newsletterOptIn: user.newsletterOptIn,
    emailVerified: user.emailVerified,
    twoFactorEnabled: user.twoFactorEnabled,
    hasPassword: Boolean(user.passwordHash),
    addresses: user.addresses,
    wishlist: user.wishlist,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

function otpKey(email: string, purpose: OtpPurpose): string {
  return `${purpose}::${email}`;
}

function formatPersianTimestamp(raw: unknown): string {
  if (!raw) return 'ثبت‌شده در حساب کاربری';
  const dt = new Date(String(raw));
  if (Number.isNaN(dt.getTime())) return String(raw);
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(dt);
  } catch {
    return dt.toISOString();
  }
}

function mapSupabaseOrderRow(row: Record<string, unknown>): StoredOrderRecord {
  const statusRaw = String(row.status || 'preparing');
  const status: StoredOrderRecord['status'] =
    statusRaw === 'paid' || statusRaw === 'shipped' || statusRaw === 'delivered'
      ? statusRaw
      : 'preparing';

  return {
    orderCode: String(row.order_code || ''),
    shaparakRef: String(row.shaparak_ref || '84729104'),
    customerName: String(row.customer_name || ''),
    customerPhone: String(row.customer_phone || ''),
    city: String(row.city || ''),
    shippingAddress: String(row.shipping_address || ''),
    postalCode: String(row.postal_code || ''),
    deliverySlot: row.delivery_slot === 'standard' ? 'standard' : 'express',
    couponCode: row.coupon_code ? String(row.coupon_code) : null,
    subtotal: Number(row.subtotal || 0),
    productDiscount: Number(row.discount_total || 0),
    couponDiscount: 0,
    shippingCost: Number(row.shipping_cost || 0),
    totalAmount: Number(row.total_amount || 0),
    status,
    deliveryPin: String(row.delivery_pin || ''),
    imeiSample: String(row.imei_sample || ''),
    adminNote: row.admin_note ? String(row.admin_note) : undefined,
    items: Array.isArray(row.items) ? (row.items as StoredOrderItem[]) : [],
    createdAt: formatPersianTimestamp(row.created_at),
  };
}

function mapSupabaseUserRow(row: Record<string, unknown>): StoredUserRecord {
  return {
    id: String(row.id),
    email: String(row.email),
    fullName: String(row.full_name || ''),
    phone: String(row.phone || ''),
    nationalId: row.national_id ? String(row.national_id) : undefined,
    birthDate: row.birth_date ? String(row.birth_date) : undefined,
    newsletterOptIn: row.newsletter_opt_in !== false,
    emailVerified: row.email_verified !== false,
    twoFactorEnabled: row.two_factor_enabled === true,
    passwordHash: row.password_hash ? String(row.password_hash) : undefined,
    addresses: Array.isArray(row.addresses) ? (row.addresses as StoredAddress[]) : [],
    wishlist: Array.isArray(row.wishlist)
      ? Array.from(new Set(row.wishlist.map((item) => String(item).trim()).filter(Boolean)))
      : [],
    activeSessionIds: Array.isArray(row.active_session_ids)
      ? (row.active_session_ids as string[])
      : [],
    createdAt: String(row.created_at || new Date().toISOString()),
    lastLoginAt: String(row.last_login_at || new Date().toISOString()),
  };
}

function mapSupabaseOtpRow(row: Record<string, unknown>): OtpChallengeRecord {
  return {
    challengeKey: String(row.challenge_key),
    id: String(row.id),
    email: String(row.email),
    purpose: String(row.purpose) as OtpPurpose,
    codeHash: String(row.code_hash),
    expiresAt: new Date(String(row.expires_at)).getTime(),
    resendAvailableAt: new Date(String(row.resend_available_at)).getTime(),
    attempts: Number(row.attempts || 0),
    pendingUserId: row.pending_user_id ? String(row.pending_user_id) : undefined,
    pendingSignup:
      row.pending_signup && typeof row.pending_signup === 'object'
        ? (row.pending_signup as OtpChallengeRecord['pendingSignup'])
        : undefined,
  };
}

export function createSupabaseAuthStorage(supabase: SupabaseClient): AuthStorageAdapter {
  return {
    mode: 'supabase',

    async checkHealth() {
      const { error } = await supabase
        .from('app_users')
        .select('id', { count: 'exact', head: true });
      if (error) {
        return { ok: false, mode: 'supabase', detail: error.message };
      }
      return { ok: true, mode: 'supabase' };
    },

    async findUserByEmail(email: string) {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('email', email)
        .maybeSingle();
      if (error) throw new Error(`Supabase user lookup failed: ${error.message}`);
      return data ? mapSupabaseUserRow(data as Record<string, unknown>) : null;
    },

    async findUserById(userId: string) {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw new Error(`Supabase user lookup failed: ${error.message}`);
      return data ? mapSupabaseUserRow(data as Record<string, unknown>) : null;
    },

    async createUser(params) {
      const nowIso = new Date().toISOString();
      const row = {
        id: crypto.randomUUID(),
        email: params.email,
        full_name: params.fullName.trim(),
        phone: params.phone.trim(),
        newsletter_opt_in: true,
        email_verified: true,
        two_factor_enabled: false,
        password_hash: params.passwordHash ?? null,
        addresses: [],
        wishlist: [],
        active_session_ids: [],
        created_at: nowIso,
        last_login_at: nowIso,
      };
      const { data, error } = await supabase.from('app_users').insert(row).select('*').single();
      if (error || !data) {
        throw new Error(`Supabase create user failed: ${error?.message || 'no row returned'}`);
      }
      return mapSupabaseUserRow(data as Record<string, unknown>);
    },

    async updateUser(userId, updater) {
      const current = await this.findUserById(userId);
      if (!current) return null;
      const next = updater(current);

      const { data, error } = await supabase
        .from('app_users')
        .update({
          email: next.email,
          full_name: next.fullName,
          phone: next.phone,
          national_id: next.nationalId ?? null,
          birth_date: next.birthDate ?? null,
          newsletter_opt_in: next.newsletterOptIn,
          email_verified: next.emailVerified,
          two_factor_enabled: next.twoFactorEnabled,
          password_hash: next.passwordHash ?? null,
          addresses: next.addresses,
          wishlist: next.wishlist,
          active_session_ids: next.activeSessionIds,
          last_login_at: next.lastLoginAt,
        })
        .eq('id', userId)
        .select('*')
        .single();

      if (error || !data) {
        throw new Error(`Supabase update user failed: ${error?.message || 'no row returned'}`);
      }
      return mapSupabaseUserRow(data as Record<string, unknown>);
    },

    async getOtpChallenge(challengeKey: string) {
      const { data, error } = await supabase
        .from('auth_otp_challenges')
        .select('*')
        .eq('challenge_key', challengeKey)
        .maybeSingle();
      if (error) throw new Error(`Supabase OTP lookup failed: ${error.message}`);
      return data ? mapSupabaseOtpRow(data as Record<string, unknown>) : null;
    },

    async upsertOtpChallenge(challenge: OtpChallengeRecord) {
      const { error } = await supabase.from('auth_otp_challenges').upsert({
        challenge_key: challenge.challengeKey,
        id: challenge.id,
        email: challenge.email,
        purpose: challenge.purpose,
        code_hash: challenge.codeHash,
        expires_at: new Date(challenge.expiresAt).toISOString(),
        resend_available_at: new Date(challenge.resendAvailableAt).toISOString(),
        attempts: challenge.attempts,
        pending_user_id: challenge.pendingUserId ?? null,
        pending_signup: challenge.pendingSignup ?? null,
      });
      if (error) throw new Error(`Supabase OTP upsert failed: ${error.message}`);
    },

    async deleteOtpChallenge(challengeKey: string) {
      const { error } = await supabase
        .from('auth_otp_challenges')
        .delete()
        .eq('challenge_key', challengeKey);
      if (error) throw new Error(`Supabase OTP delete failed: ${error.message}`);
    },

    async listUserOrders(userId: string) {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw new Error(`Supabase list user orders failed: ${error.message}`);
      return (data || []).map((row) => mapSupabaseOrderRow(row as Record<string, unknown>));
    },

    async createOrder(userId: string | null, order: StoredOrderRecord) {
      const normalizedAddress =
        order.city && !order.shippingAddress.startsWith(order.city)
          ? `${order.city}، ${order.shippingAddress}`
          : order.shippingAddress;
      const payload = {
        order_code: order.orderCode,
        user_id: userId,
        customer_name: order.customerName,
        customer_phone: order.customerPhone,
        city: order.city,
        shipping_address: normalizedAddress,
        postal_code: order.postalCode,
        delivery_slot: order.deliverySlot,
        shaparak_ref: order.shaparakRef,
        coupon_code: order.couponCode,
        subtotal: order.subtotal,
        discount_total: order.productDiscount + order.couponDiscount,
        shipping_cost: order.shippingCost,
        total_amount: order.totalAmount,
        status: order.status,
        delivery_pin: order.deliveryPin,
        imei_sample: order.imeiSample,
        items: order.items,
      };
      const { data, error } = await supabase.from('orders').insert(payload).select('*').single();
      if (error || !data) {
        throw new Error(`Supabase create order failed: ${error?.message || 'no row returned'}`);
      }
      return mapSupabaseOrderRow(data as Record<string, unknown>);
    },

    async findOrderByCode(orderCode: string) {
      const normalized = orderCode.trim().toUpperCase().replace(/^#/, '');
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('order_code', normalized)
        .maybeSingle();
      if (error) throw new Error(`Supabase order lookup failed: ${error.message}`);
      return data ? mapSupabaseOrderRow(data as Record<string, unknown>) : null;
    },
  };
}

export function createMemoryAuthStorage(): AuthStorageAdapter {
  const users = new Map<string, StoredUserRecord>();
  const otps = new Map<string, OtpChallengeRecord>();
  const orders: Array<{ userId: string | null; order: StoredOrderRecord }> = [];

  return {
    mode: 'dev-memory',

    async checkHealth() {
      return {
        ok: true,
        mode: 'dev-memory',
        detail: 'In-memory dev/test adapter (non-production only)',
      };
    },

    async findUserByEmail(email: string) {
      for (const user of users.values()) {
        if (user.email === email) {
          return {
            ...user,
            addresses: [...user.addresses],
            wishlist: [...user.wishlist],
            activeSessionIds: [...user.activeSessionIds],
          };
        }
      }
      return null;
    },

    async findUserById(userId: string) {
      const user = users.get(userId);
      return user
        ? {
            ...user,
            addresses: [...user.addresses],
            wishlist: [...user.wishlist],
            activeSessionIds: [...user.activeSessionIds],
          }
        : null;
    },

    async createUser(params) {
      const nowIso = new Date().toISOString();
      const record: StoredUserRecord = {
        id: crypto.randomUUID(),
        email: params.email,
        fullName: params.fullName.trim(),
        phone: params.phone.trim(),
        newsletterOptIn: true,
        emailVerified: true,
        twoFactorEnabled: false,
        passwordHash: params.passwordHash,
        addresses: [],
        wishlist: [],
        activeSessionIds: [],
        createdAt: nowIso,
        lastLoginAt: nowIso,
      };
      users.set(record.id, record);
      return { ...record, addresses: [], wishlist: [], activeSessionIds: [] };
    },

    async updateUser(userId, updater) {
      const existing = users.get(userId);
      if (!existing) return null;
      const updated = updater({
        ...existing,
        addresses: [...existing.addresses],
        wishlist: [...existing.wishlist],
        activeSessionIds: [...existing.activeSessionIds],
      });
      users.set(userId, updated);
      return {
        ...updated,
        addresses: [...updated.addresses],
        wishlist: [...updated.wishlist],
        activeSessionIds: [...updated.activeSessionIds],
      };
    },

    async getOtpChallenge(challengeKey: string) {
      const item = otps.get(challengeKey);
      return item ? { ...item } : null;
    },

    async upsertOtpChallenge(challenge: OtpChallengeRecord) {
      otps.set(challenge.challengeKey, { ...challenge });
    },

    async deleteOtpChallenge(challengeKey: string) {
      otps.delete(challengeKey);
    },

    async listUserOrders(userId: string) {
      return orders.filter((entry) => entry.userId === userId).map((entry) => ({ ...entry.order }));
    },

    async createOrder(userId: string | null, order: StoredOrderRecord) {
      const copy: StoredOrderRecord = {
        ...order,
        items: order.items.map((item) => ({ ...item })),
      };
      orders.unshift({ userId, order: copy });
      return copy;
    },

    async findOrderByCode(orderCode: string) {
      const normalized = orderCode.trim().toUpperCase().replace(/^#/, '');
      const match = orders.find((entry) => entry.order.orderCode.toUpperCase() === normalized);
      return match ? { ...match.order } : null;
    },
  };
}

export function createDefaultAuthStorage(env: NodeJS.ProcessEnv = process.env): AuthStorageAdapter {
  const supaCfg = resolveSupabaseAdminConfig(env);
  if (supaCfg.configured && supaCfg.url && supaCfg.serviceRoleKey) {
    const client = createClient(supaCfg.url, supaCfg.serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return createSupabaseAuthStorage(client);
  }
  return createMemoryAuthStorage();
}

export class AuthService {
  private readonly storage: AuthStorageAdapter;
  private readonly sessionSecret: string;

  constructor(storage: AuthStorageAdapter, sessionSecret?: string) {
    this.storage = storage;
    this.sessionSecret = sessionSecret || resolveSessionSecret();
  }

  get storageMode() {
    return this.storage.mode;
  }

  checkHealth() {
    return this.storage.checkHealth();
  }

  findUserByEmail(email: string) {
    return this.storage.findUserByEmail(email);
  }

  findUserById(userId: string) {
    return this.storage.findUserById(userId);
  }

  createUserAccount(params: {
    email: string;
    fullName: string;
    phone: string;
    passwordHash?: string;
  }) {
    return this.storage.createUser(params);
  }

  updateUserRecord(userId: string, updater: (user: StoredUserRecord) => StoredUserRecord) {
    return this.storage.updateUser(userId, updater);
  }

  listUserOrders(userId: string) {
    return this.storage.listUserOrders(userId);
  }

  createOrder(userId: string | null, order: StoredOrderRecord) {
    return this.storage.createOrder(userId, order);
  }

  findOrderByCode(orderCode: string) {
    return this.storage.findOrderByCode(orderCode);
  }

  async createOtpChallenge(params: {
    email: string;
    purpose: OtpPurpose;
    pendingUserId?: string;
    pendingSignup?: {
      fullName: string;
      phone: string;
      passwordHash?: string;
    };
  }): Promise<
    | { ok: true; code: string; challengeId: string; cooldownSeconds: number }
    | { ok: false; retryAfterSeconds: number }
  > {
    const key = otpKey(params.email, params.purpose);
    const existing = await this.storage.getOtpChallenge(key);
    const now = Date.now();

    if (existing && existing.resendAvailableAt > now) {
      return {
        ok: false,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.resendAvailableAt - now) / 1000)),
      };
    }

    const code = String(crypto.randomInt(100000, 1000000));
    const challengeId = crypto.randomUUID();

    await this.storage.upsertOtpChallenge({
      challengeKey: key,
      id: challengeId,
      email: params.email,
      purpose: params.purpose,
      codeHash: hashOtpCode(code, params.email, this.sessionSecret),
      expiresAt: now + 10 * 60 * 1000,
      resendAvailableAt: now + 60 * 1000,
      attempts: 0,
      pendingUserId: params.pendingUserId,
      pendingSignup: params.pendingSignup,
    });

    return { ok: true, code, challengeId, cooldownSeconds: 60 };
  }

  async clearOtpChallenge(email: string, purpose: OtpPurpose): Promise<void> {
    await this.storage.deleteOtpChallenge(otpKey(email, purpose));
  }

  async verifyOtpChallenge(
    email: string,
    purpose: OtpPurpose,
    code: string
  ): Promise<
    | { ok: true; challenge: OtpChallengeRecord }
    | { ok: false; messageFa: string }
  > {
    const key = otpKey(email, purpose);
    const challenge = await this.storage.getOtpChallenge(key);

    if (!challenge) {
      return {
        ok: false,
        messageFa: 'کد تاییدی برای این ایمیل صادر نشده یا منقضی شده است. لطفاً دوباره درخواست کد دهید.',
      };
    }

    if (Date.now() > challenge.expiresAt) {
      await this.storage.deleteOtpChallenge(key);
      return {
        ok: false,
        messageFa: 'مدت اعتبار کد تایید (۱۰ دقیقه) به پایان رسیده است. لطفاً کد جدید دریافت کنید.',
      };
    }

    if (challenge.attempts >= 5) {
      await this.storage.deleteOtpChallenge(key);
      return {
        ok: false,
        messageFa: 'تعداد تلاش‌های ناموفق بیش از حد مجاز بود. لطفاً کد جدید دریافت کنید.',
      };
    }

    const candidateHash = hashOtpCode(code, email, this.sessionSecret);
    const a = Buffer.from(candidateHash, 'hex');
    const b = Buffer.from(challenge.codeHash, 'hex');

    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      const nextAttempts = challenge.attempts + 1;
      await this.storage.upsertOtpChallenge({
        ...challenge,
        attempts: nextAttempts,
      });
      return {
        ok: false,
        messageFa: `کد تایید نادرست است (${5 - nextAttempts} تلاش باقی‌مانده).`,
      };
    }

    await this.storage.deleteOtpChallenge(key);
    return { ok: true, challenge };
  }

  async issueSessionToken(userId: string): Promise<{ token: string; sessionId: string } | null> {
    const sessionId = crypto.randomUUID();
    const issuedAt = Date.now();
    const updated = await this.storage.updateUser(userId, (user) => ({
      ...user,
      lastLoginAt: new Date().toISOString(),
      activeSessionIds: [...user.activeSessionIds.slice(-9), sessionId],
    }));
    if (!updated) return null;

    const payload = `${sessionId}.${userId}.${issuedAt}`;
    const signature = crypto
      .createHmac('sha256', this.sessionSecret)
      .update(payload)
      .digest('hex');

    return {
      token: `${payload}.${signature}`,
      sessionId,
    };
  }

  async verifySessionToken(
    token: string | undefined
  ): Promise<{ user: StoredUserRecord; sessionId: string } | null> {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 4) return null;

    const [sessionId, userId, issuedAtStr, signature] = parts;
    if (!sessionId || !userId || !issuedAtStr || !signature) return null;

    const issuedAt = Number(issuedAtStr);
    if (!Number.isFinite(issuedAt)) return null;

    const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - issuedAt > maxAgeMs) return null;

    const payload = `${sessionId}.${userId}.${issuedAtStr}`;
    const expectedSig = crypto
      .createHmac('sha256', this.sessionSecret)
      .update(payload)
      .digest('hex');

    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expectedSig, 'hex');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const user = await this.storage.findUserById(userId);
    if (!user || !user.activeSessionIds.includes(sessionId)) {
      return null;
    }
    return { user, sessionId };
  }

  async revokeSession(userId: string, sessionId: string, allDevices = false): Promise<void> {
    await this.storage.updateUser(userId, (user) => ({
      ...user,
      activeSessionIds: allDevices
        ? []
        : user.activeSessionIds.filter((id) => id !== sessionId),
    }));
  }

  issueTwoFactorToken(userId: string, email: string): string {
    const payloadObj = {
      nonce: crypto.randomUUID(),
      userId,
      email,
      issuedAt: Date.now(),
    };
    const encoded = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.sessionSecret)
      .update(`2fa.${encoded}`)
      .digest('hex');
    return `${encoded}.${signature}`;
  }

  verifyTwoFactorToken(
    token: string | undefined
  ): { userId: string; email: string } | null {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, signature] = parts;
    if (!encoded || !signature) return null;

    const expectedSig = crypto
      .createHmac('sha256', this.sessionSecret)
      .update(`2fa.${encoded}`)
      .digest('hex');

    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expectedSig, 'hex');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    try {
      const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as {
        userId?: string;
        email?: string;
        issuedAt?: number;
      };
      if (!parsed.userId || !parsed.email || typeof parsed.issuedAt !== 'number') {
        return null;
      }
      const maxAgeMs = 10 * 60 * 1000;
      if (Date.now() - parsed.issuedAt > maxAgeMs) {
        return null;
      }
      return { userId: parsed.userId, email: parsed.email };
    } catch {
      return null;
    }
  }
}
