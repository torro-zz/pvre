-- Migration 008: API Cost Tracking
-- Run this in Supabase SQL Editor

-- 1. API Costs Table - tracks every Claude API call
CREATE TABLE IF NOT EXISTS api_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES research_jobs(id) ON DELETE SET NULL,

  -- Action classification
  action_type TEXT NOT NULL CHECK (action_type IN (
    'paid_search',      -- Main research (user pays credits)
    'free_presearch',   -- Hypothesis validation (free to user)
    'free_chat',        -- Chat within limit (free to user)
    'paid_chat'         -- Chat beyond limit (uses credits)
  )),

  -- API call details
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_usd NUMERIC(10, 6) NOT NULL,

  -- Context
  endpoint TEXT,        -- e.g., '/api/research/ask', '/api/research/community-voice'
  metadata JSONB        -- Additional context if needed
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_api_costs_user_id ON api_costs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_costs_job_id ON api_costs(job_id);
CREATE INDEX IF NOT EXISTS idx_api_costs_created_at ON api_costs(created_at);
CREATE INDEX IF NOT EXISTS idx_api_costs_action_type ON api_costs(action_type);

-- 2. Pre-search attempts tracking
CREATE TABLE IF NOT EXISTS presearch_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  hypothesis TEXT NOT NULL,
  session_id TEXT,  -- Groups attempts in same "session"

  -- Track if this led to a paid search
  converted_to_job_id UUID REFERENCES research_jobs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_presearch_attempts_user_id ON presearch_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_presearch_attempts_session_id ON presearch_attempts(session_id);

-- 3. Add chat_count to research_jobs
ALTER TABLE research_jobs ADD COLUMN IF NOT EXISTS chat_count INTEGER DEFAULT 0;

-- 4. RPC function to increment chat count atomically
CREATE OR REPLACE FUNCTION increment_chat_count(p_job_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE research_jobs
  SET chat_count = COALESCE(chat_count, 0) + 1
  WHERE id = p_job_id
  RETURNING chat_count INTO new_count;

  RETURN new_count;
END;
$$;

-- 5. RPC function to check pre-search limit
CREATE OR REPLACE FUNCTION check_presearch_limit(p_user_id UUID, p_session_id TEXT)
RETURNS TABLE(attempt_count INTEGER, can_continue BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  count_val INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO count_val
  FROM presearch_attempts
  WHERE user_id = p_user_id
    AND session_id = p_session_id;

  RETURN QUERY SELECT count_val, (count_val < 6);
END;
$$;

-- 6. RLS policies
ALTER TABLE api_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE presearch_attempts ENABLE ROW LEVEL SECURITY;

-- Users can read their own costs
DROP POLICY IF EXISTS "Users can read own api_costs" ON api_costs;
CREATE POLICY "Users can read own api_costs"
  ON api_costs FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert (API routes use service role)
DROP POLICY IF EXISTS "Service role can insert api_costs" ON api_costs;
CREATE POLICY "Service role can insert api_costs"
  ON api_costs FOR INSERT
  WITH CHECK (true);

-- Pre-search attempts policies
DROP POLICY IF EXISTS "Users can read own presearch_attempts" ON presearch_attempts;
CREATE POLICY "Users can read own presearch_attempts"
  ON presearch_attempts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert presearch_attempts" ON presearch_attempts;
CREATE POLICY "Service role can insert presearch_attempts"
  ON presearch_attempts FOR INSERT
  WITH CHECK (true);

-- Grant access to service role
GRANT ALL ON api_costs TO service_role;
GRANT ALL ON presearch_attempts TO service_role;
GRANT EXECUTE ON FUNCTION increment_chat_count TO service_role;
GRANT EXECUTE ON FUNCTION check_presearch_limit TO service_role;
