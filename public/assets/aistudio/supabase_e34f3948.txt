import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  BrandId,
  CartItem,
  CategoryId,
  CouponRule,
  DemoUser,
  OrderRecord,
  Product,
  ProductColor,
  ProductReview,
  ProductSpecs,
  StorageVariant,
  StoreSettings,
  SupportTicket,
} from '../types/store';
import { STORE_ASSETS } from '../data/assets';
import { DEMO_SAMPLE_ORDER, INITIAL_REVIEWS, SEED_PRODUCTS } from '../data/catalog';
import { DEFAULT_COUPON_RULES, FREE_SHIPPING_THRESHOLD } from '../utils/storeLogic';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export interface SupabaseDiagnosticResult {
  configured: boolean;
  connected: boolean;
  host: string | null;
  latencyMs: number | null;
  productsCount: number | null;
  ordersCount: number | null;
  errorMessage: string | null;
  checkedAt: string;
}

const KEYS = {
  CART: 'amir_mobile_cart_v1',
  WISHLIST: 'amir_mobile_wishlist_v1',
  COMPARE: 'amir_mobile_compare_v1',
  RECENT: 'amir_mobile_recent_v1',
  ORDERS: 'amir_mobile_orders_v1',
  TICKETS: 'amir_mobile_tickets_v1',
  USER: 'amir_mobile_user_v1',
  REVIEWS: 'amir_mobile_reviews_v1',
  NEWSLETTER: 'amir_mobile_newsletter_v1',
  NOTIFY_ME: 'amir_mobile_notify_v1',
};

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors in private mode
  }
}

function resolveFallbackImage(brand: string, category: string): string {
  if (category === 'chargers' || brand === 'Anker') return STORE_ASSETS.ankerCharger;
  if (category === 'audio' || category === 'smartwatches') return STORE_ASSETS.audioWearables;
  if (brand === 'Samsung') return STORE_ASSETS.samsungUltra;
  if (brand === 'Xiaomi') return STORE_ASSETS.xiaomiLeica;
  return STORE_ASSETS.heroIphone;
}

function mapSupabaseProduct(row: Record<string, unknown>, seed?: Product): Product {
  const brand = (String(row.brand || seed?.brand || 'Apple') as BrandId);
  const category = (String(row.category || seed?.category || 'phones') as Exclude<
    CategoryId,
    'all' | 'offers'
  >);
  const price = Number(row.price) || seed?.price || 0;
  const originalPrice = row.original_price ? Number(row.original_price) : seed?.originalPrice;
  const rawSpecs = (row.specs && typeof row.specs === 'object' ? row.specs : {}) as Partial<ProductSpecs>;
  const rawColors = Array.isArray(row.colors) && row.colors.length > 0
    ? (row.colors as ProductColor[])
    : seed?.colors || [{ id: 'midnight', name: 'مشکی', hex: '#1e293b' }];
  const rawStorage = Array.isArray(row.storage_options) && row.storage_options.length > 0
    ? (row.storage_options as StorageVariant[])
    : seed?.storageOptions || [{ label: '۲۵۶ گیگابایت', subtitle: 'استاندارد', priceDelta: 0 }];

  return {
    id: String(row.id || seed?.id || row.slug),
    slug: String(row.slug || seed?.slug || row.id),
    nameFa: String(row.name_fa || seed?.nameFa || 'محصول فروشگاه امیر'),
    nameEn: String(row.name_en || seed?.nameEn || 'Amir Mobile Product'),
    brand,
    category,
    price,
    originalPrice,
    discountPercent:
      typeof row.discount_percent === 'number'
        ? row.discount_percent
        : seed?.discountPercent,
    inStock: typeof row.in_stock === 'boolean' ? row.in_stock : seed?.inStock ?? true,
    stockCount: typeof row.stock_count === 'number' ? row.stock_count : seed?.stockCount ?? 5,
    expressDelivery:
      typeof row.express_delivery === 'boolean'
        ? row.express_delivery
        : seed?.expressDelivery ?? true,
    warranty: String(row.warranty || seed?.warranty || '۱۸ ماهه امیر سرویس + کد همتا'),
    badgeText:
      typeof row.badge_text === 'string' && row.badge_text.trim()
        ? row.badge_text
        : seed?.badgeText,
    rating: Number(row.rating ?? seed?.rating ?? 4.8),
    reviewCount: Number(row.review_count ?? seed?.reviewCount ?? 0),
    recommendPercent: Number(row.recommend_percent ?? seed?.recommendPercent ?? 95),
    image:
      typeof row.image_url === 'string' && row.image_url.trim()
        ? row.image_url
        : seed?.image || resolveFallbackImage(brand, category),
    colorLabel: String(row.color_label || seed?.colorLabel || rawColors[0]?.name || 'مشکی'),
    colors: rawColors,
    storageOptions: rawStorage,
    specs: {
      display: rawSpecs.display || seed?.specs.display || 'OLED 120Hz',
      displayDetails: rawSpecs.displayDetails || seed?.specs.displayDetails || 'کیفیت پرچمدار',
      chipset: rawSpecs.chipset || seed?.specs.chipset || 'پردازنده پرچمدار',
      chipsetDetails: rawSpecs.chipsetDetails || seed?.specs.chipsetDetails || 'نسل جدید',
      camera: rawSpecs.camera || seed?.specs.camera || 'دوربین سه‌گانه حرفه‌ای',
      cameraDetails: rawSpecs.cameraDetails || seed?.specs.cameraDetails || 'لرزشگیر اپتیکال',
      battery: rawSpecs.battery || seed?.specs.battery || '۵۰۰۰ میلی‌آمپر',
      batteryDetails: rawSpecs.batteryDetails || seed?.specs.batteryDetails || 'شارژ سریع',
      storageDefault: rawSpecs.storageDefault || seed?.specs.storageDefault || '۲۵۶ گیگابایت',
      ram: rawSpecs.ram || seed?.specs.ram || '۸ گیگ',
      os: rawSpecs.os || seed?.specs.os || 'نسخه رسمی گلوبال',
    },
    isFeaturedDeal:
      typeof row.is_featured_deal === 'boolean'
        ? row.is_featured_deal
        : seed?.isFeaturedDeal,
    isPopular: typeof row.is_popular === 'boolean' ? row.is_popular : seed?.isPopular,
    salesRank: Number(row.sales_rank ?? seed?.salesRank ?? 50),
    releaseOrder: Number(row.release_order ?? seed?.releaseOrder ?? 50),
  };
}

export const storeRepository = {
  async checkSupabaseConnection(): Promise<SupabaseDiagnosticResult> {
    const checkedAt = new Date().toLocaleTimeString('fa-IR');
    if (!supabase || !supabaseUrl) {
      return {
        configured: false,
        connected: false,
        host: null,
        latencyMs: null,
        productsCount: null,
        ordersCount: null,
        errorMessage: 'متغیرهای VITE_SUPABASE_URL یا VITE_SUPABASE_ANON_KEY در این بیلد تنظیم نشده‌اند.',
        checkedAt,
      };
    }

    let host: string | null = null;
    try {
      host = new URL(supabaseUrl).hostname;
    } catch {
      host = supabaseUrl;
    }

    const start = performance.now();
    try {
      const [productsRes, ordersRes] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('orders').select('id', { count: 'exact', head: true }),
      ]);
      const latencyMs = Math.round(performance.now() - start);

      const firstError = productsRes.error || ordersRes.error;
      if (firstError) {
        return {
          configured: true,
          connected: false,
          host,
          latencyMs,
          productsCount: productsRes.count ?? null,
          ordersCount: ordersRes.count ?? null,
          errorMessage: `${firstError.message}${firstError.code ? ` (کد: ${firstError.code})` : ''}`,
          checkedAt,
        };
      }

      return {
        configured: true,
        connected: true,
        host,
        latencyMs,
        productsCount: productsRes.count ?? 0,
        ordersCount: ordersRes.count ?? 0,
        errorMessage: null,
        checkedAt,
      };
    } catch (err) {
      const latencyMs = Math.round(performance.now() - start);
      return {
        configured: true,
        connected: false,
        host,
        latencyMs,
        productsCount: null,
        ordersCount: null,
        errorMessage: err instanceof Error ? err.message : 'خطا در برقراری ارتباط شبکه‌ای با Supabase',
        checkedAt,
      };
    }
  },

  async fetchProducts(): Promise<Product[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase.from('products').select('*');
        if (!error && data && data.length > 0) {
          const seedMap = new Map(SEED_PRODUCTS.map((p) => [p.id, p]));
          const mergedFromDb = data.map((row) =>
            mapSupabaseProduct(row as Record<string, unknown>, seedMap.get(String(row.id)))
          );
          const dbIds = new Set(mergedFromDb.map((p) => p.id));
          const remainingSeeds = SEED_PRODUCTS.filter((s) => !dbIds.has(s.id));
          return [...mergedFromDb, ...remainingSeeds].sort(
            (a, b) => a.releaseOrder - b.releaseOrder
          );
        }
      } catch {
        // Fallback seamlessly to local catalog
      }
    }
    return SEED_PRODUCTS;
  },

  async fetchActiveCoupons(): Promise<CouponRule[]> {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('coupons')
          .select('*')
          .eq('is_active', true);
        if (!error && data && data.length > 0) {
          return data.map((row) => ({
            code: String(row.code),
            discountType: row.discount_type === 'percent' ? 'percent' : 'fixed',
            discountValue: Number(row.discount_value),
            maxDiscount: row.max_discount ? Number(row.max_discount) : undefined,
            minOrderAmount: row.min_order_amount ? Number(row.min_order_amount) : 0,
            descriptionFa: row.description_fa ? String(row.description_fa) : undefined,
          }));
        }
      } catch {
        // Fallback to built-in coupons
      }
    }
    return DEFAULT_COUPON_RULES;
  },

  async fetchStoreSettings(): Promise<StoreSettings> {
    const defaults: StoreSettings = {
      announcementText: 'ارسال رایگان برای خریدهای بالای ۱ میلیون تومان به سراسر ایران',
      freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
      supportPhone: '۰۲۱-۸۸۸۸۹۹۹۹',
    };
    if (supabase) {
      try {
        const { data, error } = await supabase.from('store_settings').select('key, value');
        if (!error && data && data.length > 0) {
          const map = new Map(data.map((r) => [String(r.key), r.value]));
          const ann = map.get('announcement_text');
          const threshold = map.get('free_shipping_threshold');
          const phone = map.get('support_phone');
          return {
            announcementText: typeof ann === 'string' ? ann : defaults.announcementText,
            freeShippingThreshold:
              typeof threshold === 'number' && threshold > 0
                ? threshold
                : defaults.freeShippingThreshold,
            supportPhone: typeof phone === 'string' ? phone : defaults.supportPhone,
          };
        }
      } catch {
        // Use defaults
      }
    }
    return defaults;
  },

  loadCart(): CartItem[] {
    return readStorage<CartItem[]>(KEYS.CART, []);
  },

  saveCart(items: CartItem[]): void {
    writeStorage(KEYS.CART, items);
  },

  loadWishlist(): string[] {
    return readStorage<string[]>(KEYS.WISHLIST, []);
  },

  saveWishlist(ids: string[]): void {
    writeStorage(KEYS.WISHLIST, ids);
  },

  loadCompare(): string[] {
    return readStorage<string[]>(KEYS.COMPARE, []);
  },

  saveCompare(ids: string[]): void {
    writeStorage(KEYS.COMPARE, ids);
  },

  loadRecent(): string[] {
    return readStorage<string[]>(KEYS.RECENT, []);
  },

  saveRecent(ids: string[]): void {
    writeStorage(KEYS.RECENT, ids);
  },

  loadUser(): DemoUser | null {
    return readStorage<DemoUser | null>(KEYS.USER, null);
  },

  saveUser(user: DemoUser | null): void {
    writeStorage(KEYS.USER, user);
  },

  loadOrders(): OrderRecord[] {
    const stored = readStorage<OrderRecord[]>(KEYS.ORDERS, []);
    return stored.filter((o) => o.orderCode !== DEMO_SAMPLE_ORDER.orderCode);
  },

  async createOrder(
    order: OrderRecord,
    opts?: { skipLocalCache?: boolean }
  ): Promise<OrderRecord & { syncedToSupabase: boolean; syncError?: string }> {
    if (!opts?.skipLocalCache) {
      const existing = this.loadOrders().filter((o) => o.orderCode !== order.orderCode);
      writeStorage(KEYS.ORDERS, [order, ...existing]);
    }

    if (supabase) {
      const corePayload = {
        order_code: order.orderCode,
        customer_name: order.customerName,
        customer_phone: order.customerPhone,
        shipping_address: `${order.city}، ${order.shippingAddress}`,
        postal_code: order.postalCode,
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
      const extendedPayload = {
        ...corePayload,
        city: order.city,
        delivery_slot: order.deliverySlot,
        shaparak_ref: order.shaparakRef,
      };

      try {
        const { error } = await supabase.from('orders').insert(extendedPayload);
        if (!error) {
          return { ...order, syncedToSupabase: true };
        }
        // Fallback cleanly if Supabase project still uses v1 orders table before schema migration
        const isSchemaMismatch =
          error.code === 'PGRST204' ||
          error.code === '42703' ||
          /column/i.test(error.message);
        if (isSchemaMismatch) {
          const retry = await supabase.from('orders').insert(corePayload);
          if (!retry.error) {
            return { ...order, syncedToSupabase: true };
          }
          return { ...order, syncedToSupabase: false, syncError: retry.error.message };
        }
        return { ...order, syncedToSupabase: false, syncError: error.message };
      } catch (err) {
        return {
          ...order,
          syncedToSupabase: false,
          syncError: err instanceof Error ? err.message : 'Network error',
        };
      }
    }
    return { ...order, syncedToSupabase: false };
  },

  async findOrderByCode(orderCode: string): Promise<OrderRecord | null> {
    const normalized = orderCode.trim().toUpperCase().replace(/^#/, '');

    // Check Supabase first so status updates made by the Admin Panel reflect live!
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('order_code', normalized)
          .maybeSingle();
        if (!error && data) {
          return {
            orderCode: data.order_code,
            shaparakRef: data.shaparak_ref || '84729104',
            customerName: data.customer_name,
            customerPhone: data.customer_phone,
            city: data.city || '',
            shippingAddress: data.shipping_address,
            postalCode: data.postal_code,
            deliverySlot: data.delivery_slot === 'standard' ? 'standard' : 'express',
            couponCode: data.coupon_code,
            subtotal: Number(data.subtotal),
            productDiscount: Number(data.discount_total || 0),
            couponDiscount: 0,
            shippingCost: Number(data.shipping_cost || 0),
            totalAmount: Number(data.total_amount),
            status: (data.status as OrderRecord['status']) || 'preparing',
            deliveryPin: data.delivery_pin,
            imeiSample: data.imei_sample,
            adminNote: data.admin_note || undefined,
            items: (data.items as CartItem[]) || [],
            createdAt: 'ثبت شده در پایگاه داده Supabase',
          };
        }
      } catch {
        // Fall through to local cache
      }
    }

    const localMatch = this.loadOrders().find(
      (o) => o.orderCode.toUpperCase() === normalized
    );
    if (localMatch) return localMatch;
    if (normalized === DEMO_SAMPLE_ORDER.orderCode) {
      return DEMO_SAMPLE_ORDER;
    }
    return null;
  },

  async submitSupportTicket(ticket: SupportTicket): Promise<SupportTicket & { syncedToSupabase: boolean }> {
    const existing = readStorage<SupportTicket[]>(KEYS.TICKETS, []);
    writeStorage(KEYS.TICKETS, [ticket, ...existing]);

    if (supabase) {
      try {
        const { error } = await supabase.from('support_tickets').insert({
          ticket_code: ticket.ticketCode,
          full_name: ticket.fullName,
          phone: ticket.phone,
          department: ticket.department,
          order_code: ticket.orderCode || null,
          message: ticket.message,
        });
        if (!error) {
          return { ...ticket, syncedToSupabase: true };
        }
      } catch {
        // Saved locally
      }
    }
    return { ...ticket, syncedToSupabase: false };
  },

  async subscribeNewsletter(contact: string): Promise<{ syncedToSupabase: boolean }> {
    const existing = readStorage<string[]>(KEYS.NEWSLETTER, []);
    if (!existing.includes(contact)) {
      writeStorage(KEYS.NEWSLETTER, [contact, ...existing]);
    }
    if (supabase) {
      try {
        const { error } = await supabase.from('newsletter_subscribers').insert({ contact });
        if (!error || error.code === '23505') {
          return { syncedToSupabase: true };
        }
      } catch {
        // Saved locally
      }
    }
    return { syncedToSupabase: false };
  },

  loadReviews(productId: string): ProductReview[] {
    const map = readStorage<Record<string, ProductReview[]>>(KEYS.REVIEWS, {});
    return map[productId] ?? INITIAL_REVIEWS;
  },

  async fetchReviews(productId: string): Promise<ProductReview[]> {
    const local = this.loadReviews(productId);
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('product_reviews')
          .select('*')
          .eq('product_id', productId)
          .eq('is_approved', true)
          .order('created_at', { ascending: false });
        if (!error && data && data.length > 0) {
          const remote: ProductReview[] = data.map((row) => ({
            id: String(row.id),
            author: String(row.author),
            dateLabel: 'ثبت شده',
            rating: Number(row.rating),
            comment: String(row.comment),
            verified: Boolean(row.verified),
          }));
          return [...remote, ...INITIAL_REVIEWS];
        }
      } catch {
        // Fallback to local
      }
    }
    return local;
  },

  async addReview(productId: string, review: ProductReview): Promise<ProductReview[]> {
    const map = readStorage<Record<string, ProductReview[]>>(KEYS.REVIEWS, {});
    const current = map[productId] ?? INITIAL_REVIEWS;
    const updated = [review, ...current];
    map[productId] = updated;
    writeStorage(KEYS.REVIEWS, map);

    if (supabase) {
      try {
        await supabase.from('product_reviews').insert({
          product_id: productId,
          author: review.author,
          rating: review.rating,
          comment: review.comment,
          verified: review.verified,
        });
      } catch {
        // Already saved locally
      }
    }
    return updated;
  },

  loadStockAlerts(): string[] {
    return readStorage<string[]>(KEYS.NOTIFY_ME, []);
  },

  toggleStockAlert(productId: string): string[] {
    const current = this.loadStockAlerts();
    const updated = current.includes(productId)
      ? current.filter((id) => id !== productId)
      : [...current, productId];
    writeStorage(KEYS.NOTIFY_ME, updated);
    return updated;
  },
};
