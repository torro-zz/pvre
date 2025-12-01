-- ============================================================================
-- PVRE Account System Migration
-- Adds: Credit packs, purchases, transactions, API keys, notifications, GDPR
-- ============================================================================

-- ============================================================================
-- PART 1: Extend profiles table
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS lemonsqueezy_customer_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS credits_balance integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_credits_purchased integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_research_runs integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cookie_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_policy_accepted_at timestamptz;

-- ============================================================================
-- PART 2: Credit Packs (Product Catalog)
-- ============================================================================

CREATE TABLE public.credit_packs (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  description text,
  lemonsqueezy_variant_id text NOT NULL UNIQUE,
  credits integer NOT NULL,
  price_cents integer NOT NULL,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  badge_text text, -- e.g., "Most Popular", "Best Value"
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Seed the credit packs (replace VARIANT_ID_* with actual Lemon Squeezy variant IDs)
-- Prices in pence (GBP): £14, £39, £79
INSERT INTO public.credit_packs (name, description, lemonsqueezy_variant_id, credits, price_cents, display_order, badge_text) VALUES
  ('Starter Pack', 'Perfect for testing your first hypothesis', 'VARIANT_ID_STARTER', 3, 1400, 1, NULL),
  ('Builder Pack', 'For serious founders validating multiple ideas', 'VARIANT_ID_BUILDER', 10, 3900, 2, 'Most Popular'),
  ('Founder Pack', 'Best value for committed entrepreneurs', 'VARIANT_ID_FOUNDER', 30, 7900, 3, 'Best Value');

-- ============================================================================
-- PART 3: Purchases (Transaction History)
-- ============================================================================

CREATE TABLE public.purchases (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  credit_pack_id uuid REFERENCES public.credit_packs(id),
  lemonsqueezy_order_id text UNIQUE,
  lemonsqueezy_customer_id text,
  credits_purchased integer NOT NULL,
  amount_cents integer NOT NULL,
  status text CHECK (status IN ('pending', 'completed', 'failed', 'refunded')) DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_purchases_user_id ON public.purchases(user_id);
CREATE INDEX idx_purchases_status ON public.purchases(status);

-- ============================================================================
-- PART 4: Credit Transactions (Audit Ledger)
-- ============================================================================

CREATE TABLE public.credit_transactions (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  amount integer NOT NULL, -- Positive = credit, Negative = debit
  balance_after integer NOT NULL,
  transaction_type text CHECK (transaction_type IN ('purchase', 'usage', 'refund', 'adjustment', 'bonus')) NOT NULL,
  reference_id uuid, -- purchase_id or research_job_id
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_type ON public.credit_transactions(transaction_type);

-- ============================================================================
-- PART 5: API Keys
-- ============================================================================

CREATE TABLE public.api_keys (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE, -- SHA-256 hash (never store plain key)
  key_prefix text NOT NULL, -- First 8 chars for identification (e.g., "pvre_sk_")
  last_used_at timestamptz,
  expires_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON public.api_keys(key_hash);

-- ============================================================================
-- PART 6: Notification Preferences
-- ============================================================================

CREATE TABLE public.notification_preferences (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  email_research_complete boolean DEFAULT true,
  email_low_credits boolean DEFAULT true,
  email_product_updates boolean DEFAULT false,
  email_tips_and_tutorials boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- PART 7: GDPR - Data Export Requests
-- ============================================================================

CREATE TABLE public.data_export_requests (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status text CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  download_url text,
  file_size_bytes bigint,
  expires_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX idx_data_export_requests_user_id ON public.data_export_requests(user_id);

-- ============================================================================
-- PART 8: GDPR - Account Deletion Requests
-- ============================================================================

CREATE TABLE public.account_deletion_requests (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  reason text,
  status text CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')) DEFAULT 'pending',
  confirmation_token text,
  confirmed_at timestamptz,
  scheduled_deletion_at timestamptz, -- 7-day grace period
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_account_deletion_requests_user_id ON public.account_deletion_requests(user_id);

-- ============================================================================
-- PART 8b: Waitlist (for pre-launch email capture)
-- ============================================================================

CREATE TABLE public.waitlist (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Waitlist is public insert (anyone can join), no read access
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can join waitlist"
  ON public.waitlist FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- PART 9: Database Functions
-- ============================================================================

-- Function to deduct credits atomically (prevents race conditions)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add credits after purchase
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add bonus credits (admin)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 10: Row Level Security Policies
-- ============================================================================

-- Credit Packs (public read, admin write)
ALTER TABLE public.credit_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active credit packs"
  ON public.credit_packs FOR SELECT
  USING (is_active = true);

-- Purchases (users can only view their own)
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own purchases"
  ON public.purchases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert purchases"
  ON public.purchases FOR INSERT
  WITH CHECK (true); -- Webhook uses service role

-- Credit Transactions (users can only view their own)
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit transactions"
  ON public.credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- API Keys (users can manage their own)
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own API keys"
  ON public.api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own API keys"
  ON public.api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own API keys"
  ON public.api_keys FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own API keys"
  ON public.api_keys FOR DELETE
  USING (auth.uid() = user_id);

-- Notification Preferences (users can manage their own)
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification preferences"
  ON public.notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification preferences"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification preferences"
  ON public.notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- Data Export Requests (users can view their own)
ALTER TABLE public.data_export_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data export requests"
  ON public.data_export_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own data export requests"
  ON public.data_export_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Account Deletion Requests (users can manage their own)
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own deletion requests"
  ON public.account_deletion_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own deletion requests"
  ON public.account_deletion_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own deletion requests"
  ON public.account_deletion_requests FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- PART 11: Updated_at Triggers
-- ============================================================================

CREATE TRIGGER update_credit_packs_updated_at
  BEFORE UPDATE ON public.credit_packs
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at();

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at();

-- ============================================================================
-- PART 12: Update handle_new_user to create notification preferences
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
