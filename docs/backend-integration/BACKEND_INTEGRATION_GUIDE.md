# راهنمای یکپارچه‌سازی بک‌اند (Express API + Render + Supabase)

این پنل مدیریت به‌صورت **کاملاً مستقل** روی دامنه `https://admin-panel-ams.codenameamir.ir/` اجرا می‌شود و به API موجود فروشگاه روی `https://api.codenameamir.ir/` متصل است.

برای فعال‌سازی کامل RBAC و Endpointهای `/api/admin/*` در مخزن اصلی بک‌اند (`amir-mobile-store`)، مراحل زیر را انجام دهید.

---

## ۱. اجرای Migration پایگاه داده در Supabase

فایل `docs/backend-integration/002_admin_rbac_and_audit.sql` را در **Supabase Dashboard → SQL Editor** اجرا کنید و سپس حساب کاربری مدیر اول را به‌صورت دستی ارتقا دهید:

```sql
update public.app_users
set role = 'admin'
where lower(email) = lower('YOUR_ADMIN_EMAIL@codenameamir.ir');
```

> **نکته امنیتی:** هیچ API عمومی نباید امکان ارسال یا تغییر فیلد `role` را هنگام ثبت‌نام یا ویرایش پروفایل داشته باشد.

---

## ۲. به‌روزرسانی متغیرهای محیطی Render API

در سرویس `amir-mobile-api` (فایل `render.yaml` و تنظیمات Environment در Render):

- **`CORS_ORIGIN`**: هر دو دامنه storefront و admin panel را با کاما جدا کنید:
  ```text
  https://amir-mobile-store.codenameamir.ir,https://admin-panel-ams.codenameamir.ir
  ```
- **`COOKIE_DOMAIN`**: خالی بماند تا کوکی `amir_session` با `SameSite=None; Secure; HttpOnly` روی `api.codenameamir.ir` صادر شود و هر دو ساب‌دامنه با `credentials: 'include'` از آن استفاده کنند.

---

## ۳. تغییرات فایل `server/authStore.ts`

1. تعریف نوع نقش و افزودن `role` به `StoredUserRecord` و `PublicUserDTO`:
```ts
export type UserRole = 'customer' | 'admin';

// در StoredUserRecord و PublicUserDTO اضافه شود:
role: UserRole;
```

2. در `mapSupabaseUserRow(row)`:
```ts
role: row.role === 'admin' ? 'admin' : 'customer',
```

3. در `toPublicUser(user)`:
```ts
role: user.role,
```

4. در `createUser(...)` و `updateUser(...)`: همیشه `role` در هنگام ثبت‌نام روی `'customer'` تنظیم شود و متد `updateUser` در `/api/auth/profile` هرگز فیلد `role` را نپذیرد.

---

## ۴. ایجاد فایل `server/adminRoutes.ts`

فایل زیر را در مخزن بک‌اند ایجاد کرده و در `server.ts` پس از احراز هویت مونت کنید:

```ts
import type { NextFunction, Request, Response, Router } from 'express';
import express from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { StoredUserRecord } from './authStore.ts';

interface AuthenticatedRequest extends Request {
  authUser?: StoredUserRecord;
  authSessionId?: string;
}

export function createAdminRouter(deps: {
  supabase: SupabaseClient;
  requireAuth: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
  toPublicUser: (u: StoredUserRecord) => unknown;
}): Router {
  const router = express.Router();
  const { supabase, requireAuth, toPublicUser } = deps;

  const requireAdmin = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    if (!req.authUser) {
      res.status(401).json({ error: 'لطفاً ابتدا وارد حساب کاربری خود شوید.' });
      return;
    }
    if (req.authUser.role !== 'admin') {
      res.status(403).json({ error: 'شما مجوز دسترسی به پنل مدیریت را ندارید.' });
      return;
    }
    next();
  };

  router.use(requireAuth, requireAdmin);

  const writeAuditLog = async (params: {
    admin: StoredUserRecord;
    action: string;
    targetType: string;
    targetId: string;
    details?: Record<string, unknown>;
  }) => {
    await supabase.from('admin_audit_logs').insert({
      admin_user_id: params.admin.id,
      admin_email: params.admin.email,
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId,
      details: params.details ?? {},
    });
  };

  // 1. Verify Admin Session
  router.get('/me', (req: AuthenticatedRequest, res) => {
    res.json({ user: toPublicUser(req.authUser!) });
  });

  // 2. Dashboard Summary (Real DB queries)
  router.get('/dashboard', async (req, res, next) => {
    try {
      const lowStockThreshold = Math.max(1, Math.min(100, Number(req.query.lowStockThreshold) || 5));

      const [productsRes, ordersRes, usersRes] = await Promise.all([
        supabase.from('products').select('*').order('release_order', { ascending: true }),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('app_users').select('id', { count: 'exact', head: true }),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (ordersRes.error) throw ordersRes.error;
      if (usersRes.error) throw usersRes.error;

      const products = productsRes.data || [];
      const orders = ordersRes.data || [];

      const inStockProducts = products.filter((p) => p.in_stock && Number(p.stock_count) > 0).length;
      const outOfStockProducts = products.filter((p) => !p.in_stock || Number(p.stock_count) <= 0).length;
      const lowStockList = products
        .filter((p) => Number(p.stock_count) <= lowStockThreshold)
        .sort((a, b) => Number(a.stock_count) - Number(b.stock_count));

      const confirmedRevenue = orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
      const pendingOrdersCount = orders.filter(
        (o) => o.status === 'paid' || o.status === 'preparing'
      ).length;

      // Group last 7 order dates for chart
      const seriesMap = new Map<string, { revenue: number; ordersCount: number }>();
      for (const ord of [...orders].reverse()) {
        const dt = ord.created_at ? new Date(String(ord.created_at)) : new Date();
        const label = new Intl.DateTimeFormat('fa-IR', { month: 'short', day: 'numeric' }).format(dt);
        const cur = seriesMap.get(label) || { revenue: 0, ordersCount: 0 };
        cur.revenue += Number(ord.total_amount || 0);
        cur.ordersCount += 1;
        seriesMap.set(label, cur);
      }
      const revenueSeries = Array.from(seriesMap.entries())
        .slice(-10)
        .map(([label, v]) => ({ label, ...v }));

      const statuses = ['paid', 'preparing', 'shipped', 'delivered'] as const;
      const statusBreakdown = statuses.map((st) => ({
        status: st,
        count: orders.filter((o) => o.status === st).length,
      }));

      res.json({
        metrics: {
          totalProducts: products.length,
          inStockProducts,
          outOfStockProducts,
          lowStockCount: lowStockList.length,
          totalOrders: orders.length,
          pendingOrdersCount,
          totalCustomers: usersRes.count ?? 0,
          confirmedRevenue,
        },
        revenueSeries,
        statusBreakdown,
        lowStockProducts: lowStockList.slice(0, 6).map(mapProductRow),
        recentOrders: orders.slice(0, 8).map(mapOrderRow),
      });
    } catch (err) {
      next(err);
    }
  });

  // 3. Products CRUD + Stock
  router.get('/products', async (req, res, next) => {
    try {
      const search = String(req.query.search || '').trim().toLowerCase();
      const category = String(req.query.category || '');
      const brand = String(req.query.brand || '');
      const stock = String(req.query.stock || '');
      const lowThreshold = Math.max(1, Number(req.query.lowStockThreshold) || 5);
      const sort = String(req.query.sort || 'newest');
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 12));

      let query = supabase.from('products').select('*');
      if (category) query = query.eq('category', category);
      if (brand) query = query.eq('brand', brand);

      const { data, error } = await query;
      if (error) throw error;

      let list = (data || []).map(mapProductRow);

      if (search) {
        list = list.filter((p) =>
          `${p.id} ${p.slug} ${p.nameFa} ${p.nameEn} ${p.brand}`.toLowerCase().includes(search)
        );
      }

      if (stock === 'in_stock') {
        list = list.filter((p) => p.inStock && p.stockCount > 0);
      } else if (stock === 'low_stock') {
        list = list.filter((p) => p.stockCount <= lowThreshold);
      } else if (stock === 'out_of_stock') {
        list = list.filter((p) => !p.inStock || p.stockCount <= 0);
      }

      if (sort === 'price_asc') list.sort((a, b) => a.price - b.price);
      else if (sort === 'price_desc') list.sort((a, b) => b.price - a.price);
      else if (sort === 'stock_asc') list.sort((a, b) => a.stockCount - b.stockCount);
      else if (sort === 'bestselling') list.sort((a, b) => a.salesRank - b.salesRank);
      else list.sort((a, b) => a.releaseOrder - b.releaseOrder);

      const total = list.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const paged = list.slice((page - 1) * pageSize, page * pageSize);

      res.json({ items: paged, total, page, pageSize, totalPages });
    } catch (err) {
      next(err);
    }
  });

  router.post('/products', async (req: AuthenticatedRequest, res, next) => {
    try {
      const b = req.body || {};
      const payload = {
        id: String(b.id || '').trim().toLowerCase(),
        slug: String(b.slug || '').trim().toLowerCase(),
        name_fa: String(b.nameFa || '').trim(),
        name_en: String(b.nameEn || '').trim(),
        brand: String(b.brand || 'Apple'),
        category: String(b.category || 'phones'),
        price: Number(b.price || 0),
        original_price: b.originalPrice ? Number(b.originalPrice) : null,
        discount_percent: Number(b.discountPercent || 0),
        in_stock: Boolean(b.inStock),
        stock_count: Math.max(0, Math.floor(Number(b.stockCount || 0))),
        express_delivery: Boolean(b.expressDelivery),
        warranty: String(b.warranty || '۱۸ ماهه امیر سرویس'),
        badge_text: b.badgeText ? String(b.badgeText) : null,
        image_url: b.image ? String(b.image) : null,
        color_label: String(b.colorLabel || 'مشکی'),
        colors: Array.isArray(b.colors) ? b.colors : [],
        storage_options: Array.isArray(b.storageOptions) ? b.storageOptions : [],
        specs: b.specs && typeof b.specs === 'object' ? b.specs : {},
        is_featured_deal: Boolean(b.isFeaturedDeal),
        is_popular: Boolean(b.isPopular),
        sales_rank: Number(b.salesRank || 100),
        release_order: Number(b.releaseOrder || 100),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase.from('products').insert(payload).select('*').single();
      if (error || !data) {
        res.status(400).json({ error: error?.message || 'خطا در ایجاد محصول' });
        return;
      }

      await writeAuditLog({
        admin: req.authUser!,
        action: 'product.create',
        targetType: 'product',
        targetId: data.id,
        details: { nameFa: data.name_fa, price: data.price },
      });

      res.status(201).json({ product: mapProductRow(data) });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/products/:id', async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = String(req.params.id);
      const b = req.body || {};
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (b.slug !== undefined) patch.slug = String(b.slug).trim().toLowerCase();
      if (b.nameFa !== undefined) patch.name_fa = String(b.nameFa).trim();
      if (b.nameEn !== undefined) patch.name_en = String(b.nameEn).trim();
      if (b.brand !== undefined) patch.brand = String(b.brand);
      if (b.category !== undefined) patch.category = String(b.category);
      if (b.price !== undefined) patch.price = Number(b.price);
      if (b.originalPrice !== undefined) patch.original_price = b.originalPrice ? Number(b.originalPrice) : null;
      if (b.discountPercent !== undefined) patch.discount_percent = Number(b.discountPercent);
      if (b.inStock !== undefined) patch.in_stock = Boolean(b.inStock);
      if (b.stockCount !== undefined) patch.stock_count = Math.max(0, Math.floor(Number(b.stockCount)));
      if (b.expressDelivery !== undefined) patch.express_delivery = Boolean(b.expressDelivery);
      if (b.warranty !== undefined) patch.warranty = String(b.warranty).trim();
      if (b.badgeText !== undefined) patch.badge_text = b.badgeText ? String(b.badgeText) : null;
      if (b.image !== undefined) patch.image_url = b.image ? String(b.image) : null;
      if (b.colorLabel !== undefined) patch.color_label = String(b.colorLabel);
      if (b.colors !== undefined) patch.colors = b.colors;
      if (b.storageOptions !== undefined) patch.storage_options = b.storageOptions;
      if (b.specs !== undefined) patch.specs = b.specs;
      if (b.isFeaturedDeal !== undefined) patch.is_featured_deal = Boolean(b.isFeaturedDeal);
      if (b.isPopular !== undefined) patch.is_popular = Boolean(b.isPopular);

      const { data, error } = await supabase
        .from('products')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();

      if (error || !data) {
        res.status(404).json({ error: error?.message || 'محصول یافت نشد.' });
        return;
      }

      await writeAuditLog({
        admin: req.authUser!,
        action: 'product.update',
        targetType: 'product',
        targetId: id,
        details: { updatedFields: Object.keys(patch) },
      });

      res.json({ product: mapProductRow(data) });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/products/:id/stock', async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = String(req.params.id);
      const stockCount = Math.max(0, Math.floor(Number(req.body?.stockCount ?? 0)));
      const inStock = stockCount === 0 ? false : Boolean(req.body?.inStock ?? true);

      const { data, error } = await supabase
        .from('products')
        .update({ stock_count: stockCount, in_stock: inStock, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .single();

      if (error || !data) {
        res.status(404).json({ error: 'محصول یافت نشد.' });
        return;
      }

      await writeAuditLog({
        admin: req.authUser!,
        action: 'product.stock_update',
        targetType: 'product',
        targetId: id,
        details: { stockCount, inStock },
      });

      res.json({ product: mapProductRow(data) });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/products/:id', async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = String(req.params.id);
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) {
        res.status(400).json({ error: error.message });
        return;
      }

      await writeAuditLog({
        admin: req.authUser!,
        action: 'product.delete',
        targetType: 'product',
        targetId: id,
      });

      res.json({ deleted: true, id });
    } catch (err) {
      next(err);
    }
  });

  // 4. Orders Management
  router.get('/orders', async (req, res, next) => {
    try {
      const search = String(req.query.search || '').trim().toLowerCase();
      const status = String(req.query.status || '');
      const deliverySlot = String(req.query.deliverySlot || '');
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 12));

      let query = supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (status) query = query.eq('status', status);
      if (deliverySlot) query = query.eq('delivery_slot', deliverySlot);

      const { data, error } = await query;
      if (error) throw error;

      let list = (data || []).map(mapOrderRow);
      if (search) {
        list = list.filter((o) =>
          `${o.orderCode} ${o.customerName} ${o.customerPhone} ${o.city}`
            .toLowerCase()
            .includes(search)
        );
      }

      const total = list.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const paged = list.slice((page - 1) * pageSize, page * pageSize);

      res.json({ items: paged, total, page, pageSize, totalPages });
    } catch (err) {
      next(err);
    }
  });

  router.get('/orders/:code', async (req, res, next) => {
    try {
      const code = String(req.params.code || '').trim().toUpperCase().replace(/^#/, '');
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('order_code', code)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        res.status(404).json({ error: 'سفارش یافت نشد.' });
        return;
      }
      res.json({ order: mapOrderRow(data) });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/orders/:code', async (req: AuthenticatedRequest, res, next) => {
    try {
      const code = String(req.params.code || '').trim().toUpperCase().replace(/^#/, '');
      const status = req.body?.status;
      const adminNote = req.body?.adminNote;

      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (status !== undefined) {
        if (!['paid', 'preparing', 'shipped', 'delivered'].includes(String(status))) {
          res.status(400).json({ error: 'وضعیت سفارش معتبر نیست.' });
          return;
        }
        patch.status = status;
      }
      if (adminNote !== undefined) {
        patch.admin_note = String(adminNote).trim() || null;
      }

      const { data, error } = await supabase
        .from('orders')
        .update(patch)
        .eq('order_code', code)
        .select('*')
        .single();

      if (error || !data) {
        res.status(404).json({ error: 'سفارش یافت نشد.' });
        return;
      }

      await writeAuditLog({
        admin: req.authUser!,
        action: 'order.update',
        targetType: 'order',
        targetId: code,
        details: { status: patch.status, hasAdminNote: Boolean(patch.admin_note) },
      });

      res.json({ order: mapOrderRow(data) });
    } catch (err) {
      next(err);
    }
  });

  // 5. Customers & RBAC Management (Safe columns only — never return password_hash or active_session_ids)
  router.get('/customers', async (req, res, next) => {
    try {
      const search = String(req.query.search || '').trim().toLowerCase();
      const role = String(req.query.role || '');
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 12));

      let userQuery = supabase
        .from('app_users')
        .select(
          'id, email, full_name, phone, role, email_verified, two_factor_enabled, newsletter_opt_in, created_at, last_login_at'
        )
        .order('created_at', { ascending: false });

      if (role === 'admin' || role === 'customer') {
        userQuery = userQuery.eq('role', role);
      }

      const [usersRes, ordersRes] = await Promise.all([
        userQuery,
        supabase.from('orders').select('user_id, total_amount'),
      ]);

      if (usersRes.error) throw usersRes.error;
      if (ordersRes.error) throw ordersRes.error;

      const orderStats = new Map<string, { count: number; totalSpent: number }>();
      for (const ord of ordersRes.data || []) {
        if (!ord.user_id) continue;
        const uid = String(ord.user_id);
        const cur = orderStats.get(uid) || { count: 0, totalSpent: 0 };
        cur.count += 1;
        cur.totalSpent += Number(ord.total_amount || 0);
        orderStats.set(uid, cur);
      }

      let list = (usersRes.data || []).map((u) => {
        const stats = orderStats.get(String(u.id)) || { count: 0, totalSpent: 0 };
        return {
          id: String(u.id),
          email: String(u.email),
          fullName: String(u.full_name || ''),
          phone: String(u.phone || ''),
          role: u.role === 'admin' ? 'admin' : 'customer',
          emailVerified: u.email_verified !== false,
          twoFactorEnabled: u.two_factor_enabled === true,
          newsletterOptIn: u.newsletter_opt_in !== false,
          ordersCount: stats.count,
          totalSpent: stats.totalSpent,
          createdAt: String(u.created_at),
          lastLoginAt: String(u.last_login_at),
        };
      });

      if (search) {
        list = list.filter((u) =>
          `${u.fullName} ${u.email} ${u.phone}`.toLowerCase().includes(search)
        );
      }

      const total = list.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const paged = list.slice((page - 1) * pageSize, page * pageSize);

      res.json({ items: paged, total, page, pageSize, totalPages });
    } catch (err) {
      next(err);
    }
  });

  router.get('/customers/:id', async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const [userRes, ordersRes] = await Promise.all([
        supabase
          .from('app_users')
          .select(
            'id, email, full_name, phone, role, national_id, birth_date, addresses, email_verified, two_factor_enabled, newsletter_opt_in, created_at, last_login_at'
          )
          .eq('id', id)
          .maybeSingle(),
        supabase
          .from('orders')
          .select('*')
          .eq('user_id', id)
          .order('created_at', { ascending: false }),
      ]);

      if (userRes.error) throw userRes.error;
      if (!userRes.data) {
        res.status(404).json({ error: 'کاربر یافت نشد.' });
        return;
      }

      const orders = (ordersRes.data || []).map(mapOrderRow);
      const totalSpent = orders.reduce((s, o) => s + o.totalAmount, 0);
      const u = userRes.data;

      res.json({
        customer: {
          id: String(u.id),
          email: String(u.email),
          fullName: String(u.full_name || ''),
          phone: String(u.phone || ''),
          role: u.role === 'admin' ? 'admin' : 'customer',
          nationalId: u.national_id ? String(u.national_id) : undefined,
          birthDate: u.birth_date ? String(u.birth_date) : undefined,
          addresses: Array.isArray(u.addresses) ? u.addresses : [],
          emailVerified: u.email_verified !== false,
          twoFactorEnabled: u.two_factor_enabled === true,
          newsletterOptIn: u.newsletter_opt_in !== false,
          ordersCount: orders.length,
          totalSpent,
          orders,
          createdAt: String(u.created_at),
          lastLoginAt: String(u.last_login_at),
        },
      });
    } catch (err) {
      next(err);
    }
  });

  router.patch('/customers/:id/role', async (req: AuthenticatedRequest, res, next) => {
    try {
      const targetId = String(req.params.id);
      const nextRole = req.body?.role;
      if (nextRole !== 'admin' && nextRole !== 'customer') {
        res.status(400).json({ error: 'نقش انتخابی معتبر نیست.' });
        return;
      }
      if (targetId === req.authUser!.id && nextRole !== 'admin') {
        res.status(400).json({ error: 'مدیر نمی‌تواند دسترسی مدیریت حساب خودش را لغو کند.' });
        return;
      }

      if (nextRole === 'customer') {
        const { count } = await supabase
          .from('app_users')
          .select('id', { count: 'exact', head: true })
          .eq('role', 'admin');
        if ((count ?? 0) <= 1) {
          res.status(400).json({ error: 'حداقل یک مدیر فعال باید در سیستم باقی بماند.' });
          return;
        }
      }

      const { data, error } = await supabase
        .from('app_users')
        .update({ role: nextRole })
        .eq('id', targetId)
        .select(
          'id, email, full_name, phone, role, email_verified, two_factor_enabled, newsletter_opt_in, created_at, last_login_at'
        )
        .single();

      if (error || !data) {
        res.status(404).json({ error: 'کاربر یافت نشد.' });
        return;
      }

      await writeAuditLog({
        admin: req.authUser!,
        action: 'customer.role_update',
        targetType: 'user',
        targetId,
        details: { nextRole, targetEmail: data.email },
      });

      res.json({
        customer: {
          id: String(data.id),
          email: String(data.email),
          fullName: String(data.full_name || ''),
          phone: String(data.phone || ''),
          role: data.role === 'admin' ? 'admin' : 'customer',
          emailVerified: data.email_verified !== false,
          twoFactorEnabled: data.two_factor_enabled === true,
          newsletterOptIn: data.newsletter_opt_in !== false,
          ordersCount: 0,
          totalSpent: 0,
          createdAt: String(data.created_at),
          lastLoginAt: String(data.last_login_at),
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // 6. Audit Logs
  router.get('/audit-logs', async (req, res, next) => {
    try {
      const action = String(req.query.action || '');
      const targetType = String(req.query.targetType || '');
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 15));

      let query = supabase
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (action) query = query.eq('action', action);
      if (targetType) query = query.eq('target_type', targetType);

      const { data, error } = await query;
      if (error) throw error;

      const list = (data || []).map((row) => ({
        id: String(row.id),
        adminUserId: row.admin_user_id ? String(row.admin_user_id) : null,
        adminEmail: String(row.admin_email),
        action: String(row.action),
        targetType: String(row.target_type),
        targetId: String(row.target_id),
        details: (row.details as Record<string, unknown>) || {},
        createdAt: String(row.created_at),
      }));

      const total = list.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const paged = list.slice((page - 1) * pageSize, page * pageSize);

      res.json({ items: paged, total, page, pageSize, totalPages });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

function mapProductRow(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    slug: String(row.slug),
    nameFa: String(row.name_fa),
    nameEn: String(row.name_en),
    brand: String(row.brand),
    category: String(row.category),
    price: Number(row.price || 0),
    originalPrice: row.original_price ? Number(row.original_price) : null,
    discountPercent: Number(row.discount_percent || 0),
    inStock: Boolean(row.in_stock),
    stockCount: Number(row.stock_count || 0),
    expressDelivery: Boolean(row.express_delivery),
    warranty: String(row.warranty || ''),
    badgeText: row.badge_text ? String(row.badge_text) : null,
    rating: Number(row.rating || 4.8),
    reviewCount: Number(row.review_count || 0),
    recommendPercent: Number(row.recommend_percent || 95),
    image: row.image_url ? String(row.image_url) : '',
    colorLabel: String(row.color_label || 'مشکی'),
    colors: Array.isArray(row.colors) ? row.colors : [],
    storageOptions: Array.isArray(row.storage_options) ? row.storage_options : [],
    specs: row.specs && typeof row.specs === 'object' ? row.specs : {},
    isFeaturedDeal: Boolean(row.is_featured_deal),
    isPopular: Boolean(row.is_popular),
    salesRank: Number(row.sales_rank || 100),
    releaseOrder: Number(row.release_order || 100),
    createdAt: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

function mapOrderRow(row: Record<string, unknown>) {
  const dt = row.created_at ? new Date(String(row.created_at)) : null;
  const createdAt =
    dt && !Number.isNaN(dt.getTime())
      ? new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(dt)
      : String(row.created_at || '');
  return {
    id: row.id ? String(row.id) : undefined,
    orderCode: String(row.order_code || ''),
    userId: row.user_id ? String(row.user_id) : null,
    shaparakRef: String(row.shaparak_ref || ''),
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
    status: String(row.status || 'preparing'),
    deliveryPin: String(row.delivery_pin || ''),
    imeiSample: String(row.imei_sample || ''),
    adminNote: row.admin_note ? String(row.admin_note) : undefined,
    items: Array.isArray(row.items) ? row.items : [],
    createdAt,
    createdAtIso: row.created_at ? String(row.created_at) : undefined,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}
```

---

## ۵. حفاظت از حریم خصوصی در Endpoint عمومی رهگیری سفارش (`GET /api/orders/:code`)

در `server.ts`، برای حفظ PII مشتریان در پیگیری سفارش عمومی، اگر کاربر احراز هویت شده مالک سفارش نباشد و نقش `admin` هم نداشته باشد، فیلدهای حساس را ماسک کنید:

```ts
app.get('/api/orders/:code', async (req, res, next) => {
  try {
    const code = String(req.params.code || '').trim();
    if (!code) {
      res.status(400).json({ error: 'کد سفارش الزامی است.' });
      return;
    }
    const auth = await getAuthFromRequest(req);
    const order = await authService.findOrderByCode(code);
    if (!order) {
      res.status(404).json({ error: 'سفارش یافت نشد.' });
      return;
    }
    const isAdmin = auth?.user.role === 'admin';
    if (isAdmin) {
      res.json({ order });
      return;
    }
    res.json({
      order: {
        ...order,
        customerPhone: '***',
        shippingAddress: order.city ? `${order.city} (آدرس محفوظ)` : 'آدرس محفوظ',
        postalCode: '***',
        deliveryPin: '***',
        adminNote: undefined,
      },
    });
  } catch (err) {
    next(err);
  }
});
```

---

## ۶. تست‌های پیشنهادی RBAC در `server/authFlow.test.ts`

1. کاربر لاگین‌نشده به `/api/admin/dashboard` -> پاسخ `401`.
2. کاربر عادی با `role: 'customer'` به `/api/admin/products` یا `/api/admin/orders` -> پاسخ `403`.
3. ثبت‌نام کاربر جدید با ارسال `{ role: 'admin' }` در بدنه درخواست -> نادیده گرفته شود و کاربر با `role: 'customer'` ساخته شود.
4. مدیر با `role: 'admin'` -> دسترسی کامل به `/api/admin/*` و ثبت رکورد در `admin_audit_logs`.

---

## ۷. طرح توسعه بک‌اند برای فازهای ۱ تا ۵ (Migrations 003–006)

اسکریپت‌های SQL زیر به‌صورت **Idempotent و Additive** در مسیر `docs/backend-integration/` آماده شده‌اند تا روی Supabase PostgreSQL اجرا شوند:

1. **`003_phase1_security_rbac_orders_inventory.sql`**:
   - ماتریس RBAC (`admin_roles`, `admin_role_permissions`, `admin_user_roles`) و بذر نقش‌های استاندارد (`super_admin`, `store_owner`, `product_manager`, `sales_manager`, `order_manager`, `warehouse_manager`, `accountant`, `support_agent`, `content_manager`, `seo_manager`)
   - ستون‌های وضعیت و مسدودیت کاربر (`app_users.is_active`, `app_users.is_blocked`, `app_users.internal_note`)
   - تاریخچه و کد رهگیری مرسوله روی سفارش‌ها (`orders.tracking_code`, `orders.status_history`, `orders.cancellation_reason`, `orders.cancelled_at`)
   - ستون‌های ممیزی کامل (`admin_audit_logs.ip_address`, `user_agent`, `before_data`, `after_data`)
   - دفترکل تراکنش‌های انبار (`stock_movements` با کلید یکتای `idempotency_key`)
2. **`004_phase2_commerce_operations.sql`**:
   - جدول تراکنش‌های پرداخت و مغایرت‌گیری شاپرک (`payment_transactions`)
   - جدول مدیریت مرجوعی و RMA (`order_returns`)
   - روش‌های ارسال و نواحی (`shipping_methods`)
   - تامین‌کنندگان و سفارش‌های خرید (`suppliers`, `purchase_orders`, `purchase_order_items`)
   - سابقه استفاده از کدهای تخفیف (`coupon_redemptions` و `coupons.starts_at`, `usage_limit`, `used_count`, `per_user_limit`)
3. **`005_phase3_imei_and_catalog.sql`**:
   - فیلدهای سئو و وضعیت سلامت دستگاه (`products.seo_title`, `seo_description`, `canonical_url`, `device_condition`)
   - رجیستری سریال IMEI دستگاه‌ها (`product_devices` با ایندکس یکتای `imei` و `order_code`)
4. **`006_phase4_content_qa_notifications.sql`**:
   - ارتقای تیکت‌های پشتیبانی (`support_tickets.priority`, `sla_due_at`, `assigned_to`, `internal_note`)
   - پرسش و پاسخ محصولات (`product_questions`)
   - سیستم مدیریت محتوا (`cms_posts`, `cms_banners`, `cms_faqs`)
   - اعلانات داخلی مدیران (`admin_notifications`)

### فهرست کامل Endpointهای مورد انتظار در Render Express API

- **امنیت، RBAC و CRM مشتریان**:
  - `GET /api/admin/roles` · `PUT /api/admin/roles/:id/permissions`
  - `PUT /api/admin/customers/:id/roles` · `PATCH /api/admin/customers/:id/status` · `PATCH /api/admin/customers/:id/notes`
  - `POST /api/admin/audit-logs/sensitive-access`
- **سفارش‌ها، پرداخت و مرجوعی**:
  - `POST /api/admin/orders/:code/cancel`
  - `GET /api/admin/payments` · `POST /api/admin/payments/:id/refund` · `PATCH /api/admin/payments/:id/reconcile`
  - `GET /api/admin/returns` · `PATCH /api/admin/returns/:id`
- **انبار، تامین‌کنندگان و IMEI**:
  - `GET /api/admin/warehouse-stock` · `GET /api/admin/stock-movements` · `POST /api/admin/stock-movements` · `POST /api/admin/warehouse-transfers`
  - `GET|POST|PATCH|DELETE /api/admin/suppliers` · `GET|POST /api/admin/purchase-orders` · `POST /api/admin/purchase-orders/:id/receive`
  - `GET /api/admin/imei` · `POST /api/admin/imei/batch` · `PATCH /api/admin/imei/:id`
- **محصولات، آپلود و سئو**:
  - `POST /api/admin/products/bulk` (انتشار/عدم‌انتشار، تعدیل قیمت درصدی/ثابت، تغییر دسته‌بندی)
  - `POST /api/admin/uploads` (`multipart/form-data` روی Supabase Storage با اعتبارسنجی MIME و حجم)
- **روش‌های ارسال، کوپن‌ها، محتوا، Q&A و اعلانات**:
  - `GET|POST|PATCH|DELETE /api/admin/shipping-methods`
  - `GET /api/admin/coupons/:code/redemptions`
  - `GET|PATCH|DELETE /api/admin/questions`
  - `GET|POST|PATCH|DELETE /api/admin/content/posts` · `/banners` · `/faqs`
  - `GET /api/admin/notifications` · `PATCH /api/admin/notifications/:id/read`

> **نکته:** در تمام مسیرهای فوق باید بررسی `requireAuth`، بررسی مجوز RBAC متناسب با هر عملیات و ثبت رویداد در `admin_audit_logs` انجام شود.

---

## ۸. روتر آماده Express برای مسیرهای جدید (حل خطای فعال‌نبودن ماژول‌ها)

اگر هر یک از بخش‌های **کوپن‌ها (`/coupons`)**، **IMEI (`/imei`)**، **پرداخت‌ها (`/payments`)**، **مرجوعی (`/returns`)**، **تیکت‌ها (`/tickets`)** یا **محتوا (`/content`)** در پنل پیام `در سرور API هنوز فعال نشده است` نمایش می‌دهد، به این دلیل است که فایل‌های SQL روی Supabase اجرا شده‌اند اما Endpointهای متناظر هنوز در سرور Express (`api.codenameamir.ir`) مونت نشده‌اند و Express به جای JSON، فایل HTML صفحه اصلی را برمی‌گرداند.

فایل آماده **`docs/backend-integration/express-admin-phase-routes.ts`** را در مخزن بک‌اند کپی کنید و به شکل زیر در `server.ts` متصل کنید:

```ts
import {
  createAdminPhaseRouter,
  apiNotFoundJsonHandler,
} from './express-admin-phase-routes.ts';

// ۱. مونت کردن مسیرهای جدید زیر روتر احراز هویت‌شده ادمین:
adminRouter.use(createAdminPhaseRouter({ supabase }));
app.use('/api/admin', adminRouter);

// ۲. الزامی: پیش از app.get('*', ...) (مسیر SPA)، خطای ۴۰۴ JSON برای مسیرهای ناشناخته API برگردانید:
app.use('/api', apiNotFoundJsonHandler);
```

