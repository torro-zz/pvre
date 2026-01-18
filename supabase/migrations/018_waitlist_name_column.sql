-- ============================================================================
-- Migration: Create/update waitlist table for email capture
-- Purpose: Support email capture with name for MailerLite integration
-- ============================================================================

-- Create waitlist table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.waitlist (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text,
  created_at timestamptz DEFAULT now()
);

-- Add name column if table exists but column doesn't
ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS name text;

-- Enable RLS
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (public signup) - use IF NOT EXISTS pattern
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'waitlist' AND policyname = 'Anyone can join waitlist'
  ) THEN
    CREATE POLICY "Anyone can join waitlist" ON public.waitlist FOR INSERT WITH CHECK (true);
  END IF;
END
$$;

-- Add index for efficient counting
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON public.waitlist(created_at DESC);
