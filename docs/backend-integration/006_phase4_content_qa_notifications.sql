-- ============================================================================
-- AMIR MOBILE STORE — PHASE 4 MIGRATION (ADDITIVE & IDEMPOTENT)
-- Support SLA/Priority, Product Q&A, CMS (Posts, Banners, FAQs), Notifications
-- WARNING: Review before applying to Supabase PostgreSQL. Do NOT auto-execute.
-- ============================================================================

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS sla_due_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS assigned_to text,
  ADD COLUMN IF NOT EXISTS internal_note text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'support_tickets_priority_check'
      AND conrelid = 'public.support_tickets'::regclass
  ) THEN
    ALTER TABLE public.support_tickets
      ADD CONSTRAINT support_tickets_priority_check
      CHECK (priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text]));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.product_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  author_user_id uuid,
  question text NOT NULL,
  answer text,
  is_published boolean NOT NULL DEFAULT false,
  answered_by text,
  answered_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_questions_product_id ON public.product_questions(product_id);
CREATE INDEX IF NOT EXISTS idx_product_questions_published ON public.product_questions(is_published);

CREATE TABLE IF NOT EXISTS public.cms_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title_fa text NOT NULL,
  excerpt_fa text,
  content_fa text NOT NULL DEFAULT '',
  cover_image text,
  category_fa text NOT NULL DEFAULT 'اخبار و بررسی',
  status text NOT NULL DEFAULT 'draft' CHECK (status = ANY (ARRAY['draft'::text, 'published'::text])),
  seo_title text,
  seo_description text,
  published_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cms_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title_fa text NOT NULL,
  subtitle_fa text,
  image_url text NOT NULL,
  link_url text,
  placement text NOT NULL DEFAULT 'home_hero',
  sort_order integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cms_faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_fa text NOT NULL DEFAULT 'عمومی',
  question_fa text NOT NULL,
  answer_fa text NOT NULL,
  sort_order integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'system',
  title text NOT NULL,
  description text,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_is_read ON public.admin_notifications(is_read, created_at DESC);
