-- Migration 008: Add idempotency key + Fix refund_credit column name
-- Fixes: Duplicate job creation + broken refund_credit function

-- ============================================
-- Part 1: Add idempotency_key column
-- ============================================

-- Add idempotency_key column for deduplication
ALTER TABLE public.research_jobs
ADD COLUMN IF NOT EXISTS idempotency_key text;

-- Create index for fast idempotency key lookups
CREATE INDEX IF NOT EXISTS idx_research_jobs_idempotency_key
ON public.research_jobs (user_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- ============================================
-- Part 2: Fix refund_credit function
-- ============================================
-- The function in migration 007 uses wrong column name "credits"
-- instead of "credits_balance"

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
  -- Get current balance (FIXED: was "credits", now "credits_balance")
  SELECT credits_balance INTO current_balance
  FROM public.profiles
  WHERE id = p_user_id;

  IF current_balance IS NULL THEN
    RETURN false;
  END IF;

  new_balance := current_balance + 1;

  -- Update profile balance (FIXED: was "credits", now "credits_balance")
  UPDATE public.profiles
  SET credits_balance = new_balance, updated_at = now()
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
