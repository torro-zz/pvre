-- Migration 007: Fix credit_transactions + Add error tracking
-- Fixes: "column balance_after does not exist" error blocking research
-- Adds: error_source tracking for smart auto-refund

-- ============================================
-- Part 1: Fix credit_transactions table
-- ============================================

-- Add missing balance_after column (was in migration 003, removed in 004)
ALTER TABLE public.credit_transactions
ADD COLUMN IF NOT EXISTS balance_after integer;

-- Backfill balance_after for existing records using running sum
WITH running_balance AS (
  SELECT
    id,
    user_id,
    SUM(amount) OVER (PARTITION BY user_id ORDER BY created_at ROWS UNBOUNDED PRECEDING) as calculated_balance
  FROM public.credit_transactions
)
UPDATE public.credit_transactions ct
SET balance_after = rb.calculated_balance
FROM running_balance rb
WHERE ct.id = rb.id AND ct.balance_after IS NULL;

-- Add description column if missing (also from migration 003)
ALTER TABLE public.credit_transactions
ADD COLUMN IF NOT EXISTS description text;

-- Add reference_id column if missing (also from migration 003)
ALTER TABLE public.credit_transactions
ADD COLUMN IF NOT EXISTS reference_id uuid;

-- ============================================
-- Part 2: Add error tracking to research_jobs
-- ============================================

-- Add error_source column to track WHERE failures happen
ALTER TABLE public.research_jobs
ADD COLUMN IF NOT EXISTS error_source text;

-- Add refunded_at column to track if credit was refunded
ALTER TABLE public.research_jobs
ADD COLUMN IF NOT EXISTS refunded_at timestamptz;

-- Add index for finding failed jobs that need refund
CREATE INDEX IF NOT EXISTS idx_research_jobs_failed_unrefunded
ON public.research_jobs (status, error_source, refunded_at)
WHERE status = 'failed' AND refunded_at IS NULL;

-- Add index for finding stuck processing jobs
CREATE INDEX IF NOT EXISTS idx_research_jobs_processing_created
ON public.research_jobs (status, created_at)
WHERE status = 'processing';

-- ============================================
-- Part 3: Update RPC functions if needed
-- ============================================

-- The deduct_credit function from migration 003 should work now
-- since we added the balance_after column back

-- Add a refund_credit function for auto-refunds
CREATE OR REPLACE FUNCTION public.refund_credit(
  p_user_id uuid,
  p_job_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_balance integer;
  new_balance integer;
BEGIN
  -- Get current balance
  SELECT credits INTO current_balance
  FROM public.profiles
  WHERE id = p_user_id;

  IF current_balance IS NULL THEN
    RETURN false;
  END IF;

  new_balance := current_balance + 1;

  -- Update profile balance
  UPDATE public.profiles
  SET credits = new_balance, updated_at = now()
  WHERE id = p_user_id;

  -- Log the refund transaction
  INSERT INTO public.credit_transactions
    (user_id, amount, balance_after, transaction_type, reference_id, description)
  VALUES
    (p_user_id, 1, new_balance, 'refund', p_job_id, 'Auto-refund for failed research');

  -- Mark job as refunded
  UPDATE public.research_jobs
  SET refunded_at = now()
  WHERE id = p_job_id;

  RETURN true;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.refund_credit(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_credit(uuid, uuid) TO service_role;
