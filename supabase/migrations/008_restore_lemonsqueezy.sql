-- ============================================================================
-- Migration 008: Restore LemonSqueezy columns (remove Stripe columns)
-- ============================================================================
-- The billing routes were accidentally converted to Stripe, but this project
-- uses LemonSqueezy. This migration restores the original column names.
-- ============================================================================

-- ============================================================================
-- PART 1: Profiles table - rename stripe_customer_id to lemonsqueezy_customer_id
-- ============================================================================

-- Check if stripe_customer_id exists, rename it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE public.profiles RENAME COLUMN stripe_customer_id TO lemonsqueezy_customer_id;
  END IF;

  -- If neither exists, add lemonsqueezy_customer_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'lemonsqueezy_customer_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN lemonsqueezy_customer_id text UNIQUE;
  END IF;
END $$;

-- ============================================================================
-- PART 2: Credit Packs table - rename stripe_price_id to lemonsqueezy_variant_id
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'credit_packs'
    AND column_name = 'stripe_price_id'
  ) THEN
    ALTER TABLE public.credit_packs RENAME COLUMN stripe_price_id TO lemonsqueezy_variant_id;
  END IF;

  -- If neither exists, add lemonsqueezy_variant_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'credit_packs'
    AND column_name = 'lemonsqueezy_variant_id'
  ) THEN
    ALTER TABLE public.credit_packs ADD COLUMN lemonsqueezy_variant_id text NOT NULL DEFAULT '';
  END IF;
END $$;

-- ============================================================================
-- PART 3: Purchases table - rename Stripe columns to LemonSqueezy
-- ============================================================================

DO $$
BEGIN
  -- Rename stripe_checkout_session_id to lemonsqueezy_order_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'purchases'
    AND column_name = 'stripe_checkout_session_id'
  ) THEN
    ALTER TABLE public.purchases RENAME COLUMN stripe_checkout_session_id TO lemonsqueezy_order_id;
  END IF;

  -- Drop stripe_payment_intent_id (not needed for LemonSqueezy)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'purchases'
    AND column_name = 'stripe_payment_intent_id'
  ) THEN
    ALTER TABLE public.purchases DROP COLUMN stripe_payment_intent_id;
  END IF;

  -- Add lemonsqueezy_order_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'purchases'
    AND column_name = 'lemonsqueezy_order_id'
  ) THEN
    ALTER TABLE public.purchases ADD COLUMN lemonsqueezy_order_id text UNIQUE;
  END IF;

  -- Add lemonsqueezy_customer_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'purchases'
    AND column_name = 'lemonsqueezy_customer_id'
  ) THEN
    ALTER TABLE public.purchases ADD COLUMN lemonsqueezy_customer_id text;
  END IF;
END $$;

-- ============================================================================
-- Notes for running this migration:
-- 1. Run this SQL in the Supabase Dashboard SQL Editor
-- 2. After running, regenerate types:
--    npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/supabase.ts
-- ============================================================================
