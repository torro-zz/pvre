-- Phase 2: Customer Satisfaction, Platform Resilience & Data Quality
-- Run this in Supabase SQL Editor
-- If you get errors, run each section separately (between the ===== lines)

-- =============================================================================
-- SECTION 1: Clean up and create feedback_reports
-- =============================================================================

DROP TABLE IF EXISTS public.feedback_reports CASCADE;

CREATE TABLE public.feedback_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.research_jobs(id) ON DELETE SET NULL,
  problem_type text NOT NULL,
  details text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_feedback_reports_status ON public.feedback_reports(status);
CREATE INDEX idx_feedback_reports_user ON public.feedback_reports(user_id);
CREATE INDEX idx_feedback_reports_job ON public.feedback_reports(job_id);

ALTER TABLE public.feedback_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own feedback"
  ON public.feedback_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own feedback"
  ON public.feedback_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all feedback"
  ON public.feedback_reports FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- SECTION 2: Clean up and create credit_transactions
-- =============================================================================

DROP TABLE IF EXISTS public.credit_transactions CASCADE;

CREATE TABLE public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('purchase', 'usage', 'refund', 'trial', 'bonus')),
  reason text,
  job_id uuid REFERENCES public.research_jobs(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_credit_transactions_user ON public.credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_type ON public.credit_transactions(transaction_type);
CREATE INDEX idx_credit_transactions_created ON public.credit_transactions(created_at DESC);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON public.credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage transactions"
  ON public.credit_transactions FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- SECTION 3: Add Credits Function
-- =============================================================================

CREATE OR REPLACE FUNCTION public.add_credits(p_user_id uuid, p_credits integer)
RETURNS void AS $$
BEGIN
  UPDATE public.user_credits
  SET credits_remaining = credits_remaining + p_credits,
      updated_at = now()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- SECTION 4: Cache Improvements (run only if reddit_cache exists)
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reddit_cache') THEN
    -- Add cache_key column if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'reddit_cache' AND column_name = 'cache_key'
    ) THEN
      ALTER TABLE public.reddit_cache ADD COLUMN cache_key text;
    END IF;

    -- Add comments column if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'reddit_cache' AND column_name = 'comments'
    ) THEN
      ALTER TABLE public.reddit_cache ADD COLUMN comments jsonb DEFAULT '[]'::jsonb;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reddit_cache_key ON public.reddit_cache(cache_key);

-- =============================================================================
-- SECTION 5: User Credits Table (ensure exists)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  credits_remaining integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_credits' AND policyname = 'Users can view own credits') THEN
    CREATE POLICY "Users can view own credits" ON public.user_credits FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_credits' AND policyname = 'Service role can manage credits') THEN
    CREATE POLICY "Service role can manage credits" ON public.user_credits FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- =============================================================================
-- SECTION 6: Cache Cleanup Function
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_cache()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.reddit_cache WHERE expires_at < now() - interval '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Done!
-- =============================================================================
