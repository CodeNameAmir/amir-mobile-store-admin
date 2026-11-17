-- ============================================================================
-- Amir Mobile Store (AMS) — Migration 002: Admin RBAC, Audit Logs & RLS Hardening
-- Target: Existing Supabase PostgreSQL database shared by Storefront & Admin Panel.
-- Safe to run multiple times (idempotent) in Supabase Dashboard -> SQL Editor.
-- ============================================================================

-- 1. Add strict RBAC role column to public.app_users (never default to admin)
alter table public.app_users
  add column if not exists role text not null default 'customer';

alter table public.app_users
  drop constraint if exists app_users_role_check;

alter table public.app_users
  add constraint app_users_role_check
  check (role in ('customer', 'admin'));

create index if not exists idx_app_users_role on public.app_users (role);

-- 2. Create Admin Audit Logs table (service-role only)
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references public.app_users(id) on delete set null,
  admin_email text not null,
  action text not null,
  target_type text not null,
  target_id text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_logs_created_at
  on public.admin_audit_logs (created_at desc);

create index if not exists idx_admin_audit_logs_action
  on public.admin_audit_logs (action);

alter table public.admin_audit_logs enable row level security;

-- 3. Harden RLS: Drop blanket `TO authenticated` policies (Express API uses SUPABASE_SERVICE_ROLE_KEY)
drop policy if exists "Authenticated admin full access products" on public.products;
drop policy if exists "Authenticated admin update orders" on public.orders;
drop policy if exists "Authenticated admin full access tickets" on public.support_tickets;
drop policy if exists "Authenticated admin full access coupons" on public.coupons;
drop policy if exists "Authenticated admin full access reviews" on public.product_reviews;
drop policy if exists "Authenticated admin full access settings" on public.store_settings;
drop policy if exists "Authenticated admin view newsletter" on public.newsletter_subscribers;

-- 4. Harden Orders RLS: Remove unauthenticated anon SELECT on public.orders to protect customer PII.
-- Note: After applying this policy removal, ensure the storefront's order tracking uses the Express API
-- (`GET /api/orders/:code` and `GET /api/orders/mine`) rather than querying Supabase directly with the anon key.
drop policy if exists "Anyone can view orders by code" on public.orders;

-- ============================================================================
-- 5. MANUAL INITIAL ADMIN PROMOTION (Run manually after signing up your admin account)
-- Replace the email address below with your actual administrator account email:
-- ============================================================================
-- update public.app_users
-- set role = 'admin'
-- where lower(email) = lower('admin@codenameamir.ir');
--
-- Verify promotion:
-- select id, email, full_name, role from public.app_users where role = 'admin';
