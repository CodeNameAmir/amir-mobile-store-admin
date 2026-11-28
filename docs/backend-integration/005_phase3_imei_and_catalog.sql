-- ============================================================================
-- AMIR MOBILE STORE — PHASE 3 MIGRATION (ADDITIVE & IDEMPOTENT)
-- Product SEO, Device Condition, and IMEI / Serial Number Registry
-- WARNING: Review before applying to Supabase PostgreSQL. Do NOT auto-execute.
-- ============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS canonical_url text,
  ADD COLUMN IF NOT EXISTS device_condition text NOT NULL DEFAULT 'new';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_device_condition_check'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_device_condition_check
      CHECK (device_condition = ANY (ARRAY['new'::text, 'open_box'::text, 'used_like_new'::text, 'refurbished'::text]));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.product_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  sku text,
  imei1 text NOT NULL UNIQUE,
  imei2 text,
  serial_number text,
  status text NOT NULL DEFAULT 'in_stock'
    CHECK (status = ANY (ARRAY['in_stock'::text, 'reserved'::text, 'sold'::text, 'returned'::text, 'defective'::text])),
  order_code text,
  warranty_expires_at timestamp with time zone,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_devices_product_id ON public.product_devices(product_id);
CREATE INDEX IF NOT EXISTS idx_product_devices_variant_id ON public.product_devices(variant_id);
CREATE INDEX IF NOT EXISTS idx_product_devices_status ON public.product_devices(status);
CREATE INDEX IF NOT EXISTS idx_product_devices_order_code ON public.product_devices(order_code);
CREATE INDEX IF NOT EXISTS idx_product_devices_serial ON public.product_devices(serial_number);
