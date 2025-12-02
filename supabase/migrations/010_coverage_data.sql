-- Migration 010: Add coverage_data to research_jobs
-- This stores the coverage check results so they can be displayed on the steps page

ALTER TABLE public.research_jobs
ADD COLUMN IF NOT EXISTS coverage_data jsonb;

-- Comment for documentation
COMMENT ON COLUMN public.research_jobs.coverage_data IS 'Stores coverage check results: subreddits, post counts, keywords, confidence level';
