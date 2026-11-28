-- ============================================================================
-- Amir Mobile Store (AMS) — Migration 003 (Phase 1):
-- Granular RBAC, Security Hardening, Audit Context, Order Integrity & Atomic Inventory
-- Target: Shared Supabase PostgreSQL database (Storefront + Admin Panel)
-- Additive & idempotent (safe to re-run in Supabase SQL Editor).
-- DO NOT auto-execute against production without backup & backend deployment coordination.
-- ============================================================================

-- 1. Account Security Hardening on public.app_users
alter table public.app_users
  add column if not exists is_active boolean not null default true,
  add column if not exists is_blocked boolean not null default false,
  add column if not exists locked_until timestamptz,
  add column if not exists failed_login_attempts integer not null default 0,
  add column if not exists preferences jsonb not null default '{}'::jsonb;

create index if not exists idx_app_users_active_blocked
  on public.app_users (is_active, is_blocked);

-- 2. Granular RBAC Tables (auth_roles, auth_permissions, auth_role_permissions, auth_user_roles)
create table if not exists public.auth_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  title_fa text not null,
  description text not null default '',
  is_system boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.auth_role_permissions (
  role_id uuid not null references public.auth_roles(id) on delete cascade,
  permission text not null,
  created_at timestamptz not null default now(),
  primary key (role_id, permission)
);

create table if not exists public.auth_user_roles (
  user_id uuid not null references public.app_users(id) on delete cascade,
  role_id uuid not null references public.auth_roles(id) on delete cascade,
  assigned_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

alter table public.auth_roles enable row level security;
alter table public.auth_role_permissions enable row level security;
alter table public.auth_user_roles enable row level security;

-- Seed default operational roles (idempotent)
insert into public.auth_roles (name, title_fa, description, is_system)
values
  ('super_admin', 'مدیر ارشد سامانه', 'دسترسی کامل به تمام بخش‌ها، تنظیمات امنیتی و مدیریت مدیران', true),
  ('store_owner', 'مالک فروشگاه', 'دسترسی کامل به گزارش‌های مالی، سفارش‌ها، تنظیمات و کاتالوگ', true),
  ('product_manager', 'مدیر محصول و کاتالوگ', 'مدیریت محصولات، دسته‌بندی‌ها، برندها، گارانتی و ویژگی‌های فنی', true),
  ('sales_manager', 'مدیر فروش و تخفیف‌ها', 'مدیریت سفارش‌ها، کدهای تخفیف و گزارش‌های فروش', true),
  ('order_manager', 'مدیر پردازش سفارش‌ها', 'بررسی، پردازش، ارسال و لغو سفارش‌های مشتریان', true),
  ('warehouse_manager', 'مدیر انبار و موجودی', 'مدیریت انبارها، موجودی قفسه‌ها، انتقال و دفترکل انبار', true),
  ('accountant', 'حسابدار و مالی', 'بررسی پرداخت‌ها، استردادها، گزارش‌های مالی و مرجوعی‌ها', true),
  ('support_agent', 'کارشناس پشتیبانی', 'پاسخگویی به تیکت‌ها، پرسش‌های محصول و تایید دیدگاه‌ها', true),
  ('content_manager', 'مدیر محتوا', 'مدیریت مقالات وبلاگ، صفحات CMS و بنرهای اطلاع‌رسانی', true),
  ('seo_manager', 'متخصص سئو', 'ویرایش متادیتای سئو محصولات، دسته‌بندی‌ها و مقالات', true)
on conflict (name) do update
  set title_fa = excluded.title_fa,
      description = excluded.description;

-- Seed baseline permissions per role (idempotent)
with role_perms(role_name, perm) as (
  values
    ('super_admin', '*'),
    ('store_owner', '*'),
    ('product_manager', 'dashboard.read'),
    ('product_manager', 'products.read'),
    ('product_manager', 'products.create'),
    ('product_manager', 'products.update'),
    ('product_manager', 'products.delete'),
    ('product_manager', 'catalog.manage'),
    ('sales_manager', 'dashboard.read'),
    ('sales_manager', 'orders.read'),
    ('sales_manager', 'orders.update'),
    ('sales_manager', 'coupons.manage'),
    ('sales_manager', 'reports.read'),
    ('order_manager', 'dashboard.read'),
    ('order_manager', 'orders.read'),
    ('order_manager', 'orders.update'),
    ('order_manager', 'orders.cancel'),
    ('order_manager', 'imei.manage'),
    ('warehouse_manager', 'dashboard.read'),
    ('warehouse_manager', 'inventory.read'),
    ('warehouse_manager', 'inventory.adjust'),
    ('warehouse_manager', 'inventory.transfer'),
    ('warehouse_manager', 'imei.manage'),
    ('accountant', 'dashboard.read'),
    ('accountant', 'orders.read'),
    ('accountant', 'payments.read'),
    ('accountant', 'payments.refund'),
    ('accountant', 'reports.read'),
    ('support_agent', 'dashboard.read'),
    ('support_agent', 'orders.read'),
    ('support_agent', 'customers.read'),
    ('support_agent', 'support.manage'),
    ('content_manager', 'dashboard.read'),
    ('content_manager', 'content.manage'),
    ('seo_manager', 'dashboard.read'),
    ('seo_manager', 'products.read'),
    ('seo_manager', 'products.update'),
    ('seo_manager', 'content.manage')
)
insert into public.auth_role_permissions (role_id, permission)
select r.id, rp.perm
from role_perms rp
join public.auth_roles r on r.name = rp.role_name
on conflict (role_id, permission) do nothing;

-- 3. Audit Log Security Context & Before/After Diff Columns
alter table public.admin_audit_logs
  add column if not exists ip_address text,
  add column if not exists user_agent text,
  add column if not exists before_data jsonb,
  add column if not exists after_data jsonb;

create index if not exists idx_admin_audit_logs_target
  on public.admin_audit_logs (target_type, created_at desc);

create index if not exists idx_admin_audit_logs_admin_user
  on public.admin_audit_logs (admin_user_id, created_at desc);

-- 4. Orders Integrity, Cancellation & Idempotency Constraints
alter table public.orders
  add column if not exists tracking_code text,
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.app_users(id) on delete set null,
  add column if not exists order_status_history jsonb not null default '[]'::jsonb;

alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (status in ('pending_payment', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled', 'expired', 'returned'));

-- Prevent duplicate gateway transaction refs and duplicate idempotent checkouts
create unique index if not exists idx_orders_shaparak_ref_unique
  on public.orders (shaparak_ref)
  where shaparak_ref is not null and btrim(shaparak_ref) <> '';

create unique index if not exists idx_orders_idempotency_key_unique
  on public.orders (idempotency_key)
  where idempotency_key is not null and btrim(idempotency_key) <> '';

-- Prevent duplicate stock movements for identical idempotency keys
create unique index if not exists idx_stock_movements_idempotency_unique
  on public.stock_movements (idempotency_key)
  where idempotency_key is not null and btrim(idempotency_key) <> '';

-- 5. Atomic Inventory Movement & Warehouse Transfer RPCs
create or replace function public.ams_apply_stock_movement(
  p_warehouse_id uuid,
  p_variant_id uuid,
  p_movement_type text,
  p_quantity_change integer,
  p_shelf_location text default null,
  p_min_stock_alert integer default null,
  p_reference_type text default null,
  p_reference_id text default null,
  p_note_fa text default null,
  p_idempotency_key text default null,
  p_admin_email text default null
) returns public.stock_movements
language plpgsql
security definer
as $$
declare
  v_existing public.stock_movements;
  v_stock public.warehouse_stock;
  v_new_qty integer;
  v_movement public.stock_movements;
begin
  if p_quantity_change = 0 then
    raise exception 'تغییر تعداد تراکنش نمی‌تواند صفر باشد.';
  end if;

  if p_idempotency_key is not null and btrim(p_idempotency_key) <> '' then
    select * into v_existing
    from public.stock_movements
    where idempotency_key = p_idempotency_key
    limit 1;
    if found then
      return v_existing;
    end if;
  end if;

  insert into public.warehouse_stock (
    warehouse_id, variant_id, quantity_on_hand, reserved_qty, shelf_location, min_stock_alert
  ) values (
    p_warehouse_id,
    p_variant_id,
    0,
    0,
    p_shelf_location,
    coalesce(p_min_stock_alert, 3)
  )
  on conflict (warehouse_id, variant_id) do nothing;

  select * into v_stock
  from public.warehouse_stock
  where warehouse_id = p_warehouse_id and variant_id = p_variant_id
  for update;

  v_new_qty := v_stock.quantity_on_hand + p_quantity_change;
  if v_new_qty < v_stock.reserved_qty or v_new_qty < 0 then
    raise exception 'موجودی قابل فروش انبار کافی نیست (موجودی فعلی: %، رزروشده: %).', v_stock.quantity_on_hand, v_stock.reserved_qty
      using errcode = 'P0001';
  end if;

  update public.warehouse_stock
  set quantity_on_hand = v_new_qty,
      shelf_location = coalesce(p_shelf_location, shelf_location),
      min_stock_alert = coalesce(p_min_stock_alert, min_stock_alert),
      updated_at = now()
  where id = v_stock.id;

  insert into public.stock_movements (
    warehouse_id, variant_id, movement_type, quantity_change, balance_after,
    reference_type, reference_id, note_fa, idempotency_key, admin_email
  ) values (
    p_warehouse_id, p_variant_id, p_movement_type, p_quantity_change, v_new_qty,
    p_reference_type, p_reference_id, p_note_fa, p_idempotency_key, p_admin_email
  )
  returning * into v_movement;

  return v_movement;
end;
$$;

create or replace function public.ams_transfer_warehouse_stock(
  p_from_warehouse_id uuid,
  p_to_warehouse_id uuid,
  p_variant_id uuid,
  p_quantity integer,
  p_reference_id text default null,
  p_note_fa text default null,
  p_idempotency_key text default null,
  p_admin_email text default null
) returns jsonb
language plpgsql
security definer
as $$
declare
  v_out public.stock_movements;
  v_in public.stock_movements;
  v_out_key text;
  v_in_key text;
begin
  if p_from_warehouse_id = p_to_warehouse_id then
    raise exception 'انبار مبدا و مقصد نمی‌توانند یکسان باشند.';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'تعداد انتقال باید بزرگ‌تر از صفر باشد.';
  end if;

  v_out_key := case when p_idempotency_key is not null then p_idempotency_key || ':out' else null end;
  v_in_key := case when p_idempotency_key is not null then p_idempotency_key || ':in' else null end;

  v_out := public.ams_apply_stock_movement(
    p_from_warehouse_id,
    p_variant_id,
    'transfer_out',
    -p_quantity,
    null,
    null,
    'warehouse_transfer',
    p_reference_id,
    coalesce(p_note_fa, 'انتقال بین انبارها (خروج از مبدا)'),
    v_out_key,
    p_admin_email
  );

  v_in := public.ams_apply_stock_movement(
    p_to_warehouse_id,
    p_variant_id,
    'transfer_in',
    p_quantity,
    null,
    null,
    'warehouse_transfer',
    p_reference_id,
    coalesce(p_note_fa, 'انتقال بین انبارها (ورود به مقصد)'),
    v_in_key,
    p_admin_email
  );

  return jsonb_build_object(
    'outboundMovementId', v_out.id,
    'inboundMovementId', v_in.id,
    'fromBalanceAfter', v_out.balance_after,
    'toBalanceAfter', v_in.balance_after
  );
end;
$$;
