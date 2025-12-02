-- Migration 009: Add unique constraint to research_results
-- Fixes: Upsert fails with "no unique constraint" error
-- Error: "there is no unique or exclusion constraint matching the ON CONFLICT specification"
--
-- Root Cause:
-- - saveResearchResult() uses upsert({ onConflict: 'job_id,module_name' })
-- - The table only had a regular INDEX, not a UNIQUE constraint
-- - Supabase requires a UNIQUE constraint for ON CONFLICT to work

-- ============================================
-- Part 1: Remove any duplicate rows (keep the most recent)
-- ============================================
-- This ensures the UNIQUE constraint can be added without conflicts

DELETE FROM public.research_results a
USING public.research_results b
WHERE a.job_id = b.job_id
  AND a.module_name = b.module_name
  AND a.created_at < b.created_at;

-- ============================================
-- Part 2: Add unique constraint
-- ============================================
-- This enables upsert with onConflict: 'job_id,module_name'

ALTER TABLE public.research_results
ADD CONSTRAINT research_results_job_module_unique
UNIQUE (job_id, module_name);
