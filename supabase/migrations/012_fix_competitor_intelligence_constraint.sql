-- Fix research_results module_name CHECK constraint
-- The constraint was missing 'competitor_intelligence' (the actual module name used in code)
-- This caused competitor analysis results to fail to save

-- Drop the old constraint
ALTER TABLE public.research_results
DROP CONSTRAINT IF EXISTS research_results_module_name_check;

-- Recreate with all valid module names (both 'competitor_analysis' and 'competitor_intelligence')
-- competitor_analysis: used by step_status in research_jobs
-- competitor_intelligence: used by the actual API endpoint and save-result.ts ModuleName type
ALTER TABLE public.research_results
ADD CONSTRAINT research_results_module_name_check
CHECK (module_name IN ('community_voice', 'pain_analysis', 'market_sizing', 'timing_analysis', 'competitor_analysis', 'competitor_intelligence', 'competitor_intel'));
