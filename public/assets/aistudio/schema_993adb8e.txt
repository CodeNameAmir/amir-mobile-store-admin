-- ============================================================================
-- Amir Mobile Store (فروشگاه موبایل امیر) — Complete Storefront + Admin Schema
-- Safe to run multiple times (idempotent) in Supabase Dashboard -> SQL Editor.
-- Designed for two separate GitHub repositories sharing one Supabase project:
--   1) Storefront Repo (GitHub Pages + ArvanCloud CDN)
--   2) Future Admin Panel Repo (Supabase Auth + Full CRUD)
-- ============================================================================

create extension if not exists "pgcrypto";

-- 1. Products Catalog Table
create table if not exists public.products (
  id text primary key,
  slug text unique not null,
  name_fa text not null,
  name_en text not null,
  brand text not null,
  category text not null,
  price bigint not null,
  original_price bigint,
  discount_percent integer default 0,
  in_stock boolean default true,
  stock_count integer default 10,
  express_delivery boolean default true,
  warranty text not null default '۱۸ ماهه امیر سرویس + کد رجیستری همتا',
  rating numeric(2,1) default 4.8,
  review_count integer default 0,
  specs jsonb default '{}'::jsonb,
  storage_options jsonb default '[]'::jsonb,
  colors jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

alter table public.products add column if not exists image_url text;
alter table public.products add column if not exists color_label text default 'مشکی';
alter table public.products add column if not exists badge_text text;
alter table public.products add column if not exists recommend_percent integer default 95;
alter table public.products add column if not exists is_featured_deal boolean default false;
alter table public.products add column if not exists is_popular boolean default false;
alter table public.products add column if not exists sales_rank integer default 100;
alter table public.products add column if not exists release_order integer default 100;
alter table public.products add column if not exists updated_at timestamptz default now();

-- 2. Orders Table (Shared by Storefront Checkout/Tracking & Future Admin Panel)
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text unique not null,
  customer_name text not null,
  customer_phone text not null,
  shipping_address text not null,
  postal_code text not null,
  coupon_code text,
  subtotal bigint not null,
  discount_total bigint default 0,
  shipping_cost bigint default 0,
  total_amount bigint not null,
  status text not null default 'preparing',
  delivery_pin text not null,
  imei_sample text not null,
  items jsonb not null,
  created_at timestamptz default now()
);

alter table public.orders add column if not exists city text default 'تهران';
alter table public.orders add column if not exists delivery_slot text default 'express';
alter table public.orders add column if not exists shaparak_ref text;
alter table public.orders add column if not exists admin_note text;
alter table public.orders add column if not exists updated_at timestamptz default now();

-- 3. Support Tickets Table
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_code text unique not null,
  full_name text not null,
  phone text not null,
  department text not null,
  order_code text,
  message text not null,
  created_at timestamptz default now()
);

alter table public.support_tickets add column if not exists status text default 'open';
alter table public.support_tickets add column if not exists admin_reply text;
alter table public.support_tickets add column if not exists updated_at timestamptz default now();

-- 4. Newsletter Subscribers Table
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  contact text unique not null,
  created_at timestamptz default now()
);

-- 5. Dynamic Coupons Table (Manageable from Future Admin Panel)
create table if not exists public.coupons (
  code text primary key,
  discount_type text not null check (discount_type in ('fixed', 'percent')),
  discount_value bigint not null,
  max_discount bigint,
  min_order_amount bigint default 0,
  is_active boolean default true,
  description_fa text,
  created_at timestamptz default now()
);

insert into public.coupons (code, discount_type, discount_value, max_discount, min_order_amount, is_active, description_fa)
values
  ('AMIR-OFF', 'fixed', 500000, 500000, 0, true, 'کد تخفیف خوش‌آمدگویی ۵۰۰ هزار تومانی'),
  ('VIP-10', 'percent', 10, 2000000, 1000000, true, 'تخفیف ۱۰ درصدی ویژه تا سقف ۲ میلیون تومان')
on conflict (code) do nothing;

-- 6. Product Reviews Table (Submitted on PDP, Moderated in Future Admin Panel)
create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  author text not null,
  rating integer not null check (rating between 1 and 5),
  comment text not null,
  verified boolean default true,
  is_approved boolean default true,
  created_at timestamptz default now()
);

-- 7. Storefront Global Settings (Configurable from Future Admin Panel)
create table if not exists public.store_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

insert into public.store_settings (key, value)
values
  ('announcement_text', '"ارسال رایگان برای خریدهای بالای ۱ میلیون تومان به سراسر ایران"'::jsonb),
  ('free_shipping_threshold', '1000000'::jsonb),
  ('support_phone', '"۰۲۱-۸۸۸۸۹۹۹۹"'::jsonb)
on conflict (key) do nothing;

-- ============================================================================
-- Row Level Security (RLS)
-- Storefront uses anon key; Future Admin Panel uses Supabase Auth (authenticated).
-- ============================================================================
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.support_tickets enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.coupons enable row level security;
alter table public.product_reviews enable row level security;
alter table public.store_settings enable row level security;

-- Public Storefront Policies
drop policy if exists "Public can view products" on public.products;
create policy "Public can view products"
  on public.products for select
  using (true);

drop policy if exists "Anyone can create demo orders" on public.orders;
create policy "Anyone can create demo orders"
  on public.orders for insert
  with check (true);

drop policy if exists "Anyone can view orders by code" on public.orders;
create policy "Anyone can view orders by code"
  on public.orders for select
  using (true);

drop policy if exists "Anyone can create support tickets" on public.support_tickets;
create policy "Anyone can create support tickets"
  on public.support_tickets for insert
  with check (true);

drop policy if exists "Anyone can subscribe to newsletter" on public.newsletter_subscribers;
create policy "Anyone can subscribe to newsletter"
  on public.newsletter_subscribers for insert
  with check (true);

drop policy if exists "Public can view active coupons" on public.coupons;
create policy "Public can view active coupons"
  on public.coupons for select
  using (is_active = true);

drop policy if exists "Public can view approved reviews" on public.product_reviews;
create policy "Public can view approved reviews"
  on public.product_reviews for select
  using (is_approved = true);

drop policy if exists "Anyone can submit product review" on public.product_reviews;
create policy "Anyone can submit product review"
  on public.product_reviews for insert
  with check (true);

drop policy if exists "Public can view store settings" on public.store_settings;
create policy "Public can view store settings"
  on public.store_settings for select
  using (true);

-- Authenticated Admin Panel Policies (for your future separate Admin Repo using Supabase Auth)
drop policy if exists "Authenticated admin full access products" on public.products;
create policy "Authenticated admin full access products"
  on public.products for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated admin update orders" on public.orders;
create policy "Authenticated admin update orders"
  on public.orders for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated admin full access tickets" on public.support_tickets;
create policy "Authenticated admin full access tickets"
  on public.support_tickets for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated admin full access coupons" on public.coupons;
create policy "Authenticated admin full access coupons"
  on public.coupons for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated admin full access reviews" on public.product_reviews;
create policy "Authenticated admin full access reviews"
  on public.product_reviews for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated admin full access settings" on public.store_settings;
create policy "Authenticated admin full access settings"
  on public.store_settings for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated admin view newsletter" on public.newsletter_subscribers;
create policy "Authenticated admin view newsletter"
  on public.newsletter_subscribers for select
  to authenticated
  using (true);

-- ============================================================================
-- 8. Storefront Customer Accounts & Auth OTP Challenges (Backend Service Role)
-- Accessed exclusively by the Express API server using SUPABASE_SERVICE_ROLE_KEY.
-- RLS is enabled with NO public anon policies so password hashes and OTPs
-- are never exposed to client-side anon queries.
-- ============================================================================
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text not null,
  phone text default '',
  national_id text,
  birth_date text,
  newsletter_opt_in boolean default true,
  email_verified boolean default true,
  two_factor_enabled boolean default false,
  password_hash text,
  addresses jsonb default '[]'::jsonb,
  wishlist jsonb default '[]'::jsonb,
  active_session_ids jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  last_login_at timestamptz default now()
);

alter table public.app_users
  add column if not exists two_factor_enabled boolean default false;
alter table public.app_users
  add column if not exists wishlist jsonb default '[]'::jsonb;

alter table public.orders
  add column if not exists user_id uuid references public.app_users(id) on delete set null;
create index if not exists idx_orders_user_id on public.orders (user_id);

create index if not exists idx_app_users_email on public.app_users (email);

create table if not exists public.auth_otp_challenges (
  challenge_key text primary key,
  id uuid not null,
  email text not null,
  purpose text not null check (purpose in ('signup', 'login', 'login-2fa', 'reset-password', 'change-email')),
  code_hash text not null,
  expires_at timestamptz not null,
  resend_available_at timestamptz not null,
  attempts integer default 0,
  pending_user_id uuid,
  pending_signup jsonb,
  created_at timestamptz default now()
);

alter table public.auth_otp_challenges
  drop constraint if exists auth_otp_challenges_purpose_check;
alter table public.auth_otp_challenges
  add constraint auth_otp_challenges_purpose_check
  check (purpose in ('signup', 'login', 'login-2fa', 'reset-password', 'change-email'));

create index if not exists idx_auth_otp_expires_at on public.auth_otp_challenges (expires_at);

alter table public.app_users enable row level security;
alter table public.auth_otp_challenges enable row level security;

