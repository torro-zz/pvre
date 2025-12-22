-- Migration 015: Fix function search path security warnings
-- Sets search_path = '' on all functions to prevent search path injection attacks
-- Safe to run multiple times (CREATE OR REPLACE)

-- ============================================================================
-- 1. deduct_credit
-- ============================================================================
CREATE OR REPLACE FUNCTION public.deduct_credit(p_user_id uuid, p_job_id uuid)
RETURNS boolean AS $$
DECLARE
  current_balance integer;
BEGIN
  -- Lock the row and get current balance
  SELECT credits_balance INTO current_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  -- Check if sufficient credits
  IF current_balance IS NULL OR current_balance < 1 THEN
    RETURN false;
  END IF;

  -- Deduct credit and update stats
  UPDATE public.profiles
  SET
    credits_balance = credits_balance - 1,
    total_research_runs = total_research_runs + 1,
    updated_at = now()
  WHERE id = p_user_id;

  -- Log the transaction
  INSERT INTO public.credit_transactions
    (user_id, amount, balance_after, transaction_type, reference_id, description)
  VALUES
    (p_user_id, -1, current_balance - 1, 'usage', p_job_id, 'Research run');

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================================================
-- 2. add_credits (3-parameter version for purchases)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.add_credits(p_user_id uuid, p_purchase_id uuid, p_credits integer)
RETURNS integer AS $$
DECLARE
  new_balance integer;
BEGIN
  -- Update balance
  UPDATE public.profiles
  SET
    credits_balance = credits_balance + p_credits,
    total_credits_purchased = total_credits_purchased + p_credits,
    updated_at = now()
  WHERE id = p_user_id
  RETURNING credits_balance INTO new_balance;

  -- Log the transaction
  INSERT INTO public.credit_transactions
    (user_id, amount, balance_after, transaction_type, reference_id, description)
  VALUES
    (p_user_id, p_credits, new_balance, 'purchase', p_purchase_id, 'Credit pack purchase');

  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================================================
-- 3. add_credits (2-parameter version)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.add_credits(p_user_id uuid, p_credits integer)
RETURNS void AS $$
BEGIN
  UPDATE public.user_credits
  SET credits_remaining = credits_remaining + p_credits,
      updated_at = now()
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================================================
-- 4. add_bonus_credits
-- ============================================================================
CREATE OR REPLACE FUNCTION public.add_bonus_credits(p_user_id uuid, p_credits integer, p_description text)
RETURNS integer AS $$
DECLARE
  new_balance integer;
BEGIN
  UPDATE public.profiles
  SET
    credits_balance = credits_balance + p_credits,
    updated_at = now()
  WHERE id = p_user_id
  RETURNING credits_balance INTO new_balance;

  INSERT INTO public.credit_transactions
    (user_id, amount, balance_after, transaction_type, description)
  VALUES
    (p_user_id, p_credits, new_balance, 'bonus', p_description);

  RETURN new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================================================
-- 5. refund_credit
-- ============================================================================
CREATE OR REPLACE FUNCTION public.refund_credit(
  p_user_id uuid,
  p_job_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_balance integer;
  new_balance integer;
BEGIN
  -- Get current balance
  SELECT credits_balance INTO current_balance
  FROM public.profiles
  WHERE id = p_user_id;

  IF current_balance IS NULL THEN
    RETURN false;
  END IF;

  new_balance := current_balance + 1;

  -- Update profile balance
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

-- ============================================================================
-- 6. handle_new_user
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, email, full_name, avatar_url, credits_balance)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    0 -- Start with 0 credits
  );

  -- Create default notification preferences
  INSERT INTO public.notification_preferences (user_id)
  VALUES (new.id);

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================================================
-- 7. update_updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- ============================================================================
-- 8. cleanup_expired_cache
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_cache()
RETURNS integer AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.reddit_cache WHERE expires_at < now() - interval '30 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================================================
-- 9. cleanup_expired_reddit_cache
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_reddit_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM public.reddit_cache
  WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ============================================================================
-- 10. update_app_discovery_updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_app_discovery_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- ============================================================================
-- Re-grant permissions (just in case)
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.refund_credit(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_credit(uuid, uuid) TO service_role;
