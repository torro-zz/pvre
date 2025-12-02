-- Migration: Add step-based research tracking
-- This adds granular step status tracking to research_jobs

-- Add step_status JSONB column to research_jobs
ALTER TABLE research_jobs
ADD COLUMN IF NOT EXISTS step_status JSONB DEFAULT '{
  "pain_analysis": "pending",
  "market_sizing": "locked",
  "timing_analysis": "locked",
  "competitor_analysis": "locked"
}'::jsonb;

-- Add index for querying by step status
CREATE INDEX IF NOT EXISTS idx_research_jobs_step_status
ON research_jobs USING GIN (step_status);

-- Update existing completed jobs to have all steps completed
UPDATE research_jobs
SET step_status = '{
  "pain_analysis": "completed",
  "market_sizing": "completed",
  "timing_analysis": "completed",
  "competitor_analysis": "completed"
}'::jsonb
WHERE status = 'completed' AND step_status IS NULL;

-- Update existing failed jobs to have first step failed
UPDATE research_jobs
SET step_status = '{
  "pain_analysis": "failed",
  "market_sizing": "locked",
  "timing_analysis": "locked",
  "competitor_analysis": "locked"
}'::jsonb
WHERE status = 'failed' AND step_status IS NULL;

-- Update existing pending/processing jobs to have first step in appropriate state
UPDATE research_jobs
SET step_status = '{
  "pain_analysis": "pending",
  "market_sizing": "locked",
  "timing_analysis": "locked",
  "competitor_analysis": "locked"
}'::jsonb
WHERE status IN ('pending', 'processing') AND step_status IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN research_jobs.step_status IS 'JSONB tracking status of each research step: pain_analysis, market_sizing, timing_analysis, competitor_analysis. Values: locked, pending, in_progress, completed, failed';
