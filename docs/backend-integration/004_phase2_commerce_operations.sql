-- =============================================================================
-- AMIR MOBILE STORE — PHASE 2 COMMERCE OPERATIONS MIGRATION (ADDITIVE)
-- Target: Supabase PostgreSQL (public.*)
-- Note: Review before applying in production. Statements are idempotent.
-- =============================================================================

-- 1. Payment Ledger & Refund Tracking
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  order_code text NOT NULL,
  gateway text NOT NULL DEFAULT 'shaparak',
  authority text,
  shaparak_ref text,
  amount_toman bigint NOT NULL CHECK (amount_toman >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')),
  reconciliation_status text NOT NULL DEFAULT 'unmatched' CHECK (reconciliation_status IN ('unmatched', 'matched', 'discrepancy')),
  gateway_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_transactions
  ADD COLUMN IF NOT EXISTS order_code text,
  ADD COLUMN IF NOT EXISTS gateway text NOT NULL DEFAULT 'shaparak',
  ADD COLUMN IF NOT EXISTS authority text,
  ADD COLUMN IF NOT EXISTS shaparak_ref text,
  ADD COLUMN IF NOT EXISTS amount_toman bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reconciliation_status text NOT NULL DEFAULT 'unmatched',
  ADD COLUMN IF NOT EXISTS gateway_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_code
  ON public.payment_transactions (order_code);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_at
  ON public.payment_transactions (created_at DESC);

CREATE TABLE IF NOT EXISTS public.payment_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  order_code text NOT NULL,
  amount_toman bigint NOT NULL CHECK (amount_toman > 0),
  reason text NOT NULL,
  refund_ref text,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Returns / RMA Workflow
CREATE TABLE IF NOT EXISTS public.order_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_code text NOT NULL UNIQUE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  order_code text NOT NULL,
  customer_id uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  customer_name text,
  customer_phone text,
  reason text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  refund_amount bigint NOT NULL DEFAULT 0,
  restore_stock boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'received', 'refunded', 'rejected')),
  admin_note text,
  handled_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.order_returns
  ADD COLUMN IF NOT EXISTS order_code text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'requested',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_order_returns_order_code
  ON public.order_returns (order_code);
CREATE INDEX IF NOT EXISTS idx_order_returns_status
  ON public.order_returns (status, created_at DESC);

-- 3. Shipping Methods & Zones
CREATE TABLE IF NOT EXISTS public.shipping_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_fa text NOT NULL,
  carrier text NOT NULL DEFAULT 'post',
  description_fa text DEFAULT '',
  base_cost_toman bigint NOT NULL DEFAULT 0,
  free_above_toman bigint,
  estimated_days text DEFAULT '۱ تا ۳ روز کاری',
  supported_cities jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_express boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shipping_methods
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS name_fa text,
  ADD COLUMN IF NOT EXISTS carrier text NOT NULL DEFAULT 'post',
  ADD COLUMN IF NOT EXISTS description_fa text DEFAULT '',
  ADD COLUMN IF NOT EXISTS base_cost_toman bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_above_toman bigint,
  ADD COLUMN IF NOT EXISTS estimated_days text DEFAULT '۱ تا ۳ روز کاری',
  ADD COLUMN IF NOT EXISTS supported_cities jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_express boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 10;

INSERT INTO public.shipping_methods (code, name_fa, carrier, base_cost_toman, free_above_toman, estimated_days, is_express, sort_order)
SELECT v.code, v.name_fa, v.carrier, v.base_cost_toman, v.free_above_toman, v.estimated_days, v.is_express, v.sort_order
FROM (
  VALUES
    ('express_tehran', 'ارسال اکسپرس همان‌روز (تهران)', 'amir_courier', 120000::bigint, 10000000::bigint, 'تحویل همان‌روز', true, 1),
    ('pishtaz_iran', 'پست پیشتاز سراسر کشور', 'post_pishtaz', 85000::bigint, 5000000::bigint, '۲ تا ۴ روز کاری', false, 2)
) AS v(code, name_fa, carrier, base_cost_toman, free_above_toman, estimated_days, is_express, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.shipping_methods sm WHERE sm.code = v.code
);

-- 4. Coupon Validity Windows, Usage Limits & Redemptions Ledger
ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS usage_limit integer,
  ADD COLUMN IF NOT EXISTS used_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS per_user_limit integer,
  ADD COLUMN IF NOT EXISTS applicable_category_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS applicable_brand_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_code text NOT NULL,
  order_code text NOT NULL,
  user_id uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  customer_name text,
  discount_amount bigint NOT NULL DEFAULT 0,
  redeemed_at timestamptz NOT NULL DEFAULT now()
);

-- Pre-existing coupon_redemptions tables may lack newer columns such as redeemed_at
ALTER TABLE public.coupon_redemptions
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS order_code text,
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS discount_amount bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS redeemed_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'coupon_redemptions'
      AND column_name = 'created_at'
  ) THEN
    EXECUTE 'UPDATE public.coupon_redemptions SET redeemed_at = COALESCE(created_at, redeemed_at) WHERE created_at IS NOT NULL';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_code
  ON public.coupon_redemptions (coupon_code, redeemed_at DESC);

-- 5. Suppliers, Purchase Orders & Cost History
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_fa text NOT NULL,
  contact_name text,
  phone text,
  city text,
  tax_id text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number text NOT NULL UNIQUE,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ordered', 'received', 'cancelled')),
  total_cost_toman bigint NOT NULL DEFAULT 0,
  note text,
  created_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  sku text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_cost_toman bigint NOT NULL CHECK (unit_cost_toman >= 0)
);

CREATE TABLE IF NOT EXISTS public.variant_cost_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  old_cost_toman bigint,
  new_cost_toman bigint NOT NULL,
  purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  changed_by uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
