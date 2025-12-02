-- Fix research_results module_name CHECK constraint
-- The constraint was missing 'pain_analysis' which caused saves to fail

-- Drop the old constraint
ALTER TABLE public.research_results
DROP CONSTRAINT IF EXISTS research_results_module_name_check;

-- Recreate with all valid module names (including legacy 'competitor_intel')
ALTER TABLE public.research_results
ADD CONSTRAINT research_results_module_name_check
CHECK (module_name IN ('community_voice', 'pain_analysis', 'market_sizing', 'timing_analysis', 'competitor_analysis', 'competitor_intel'));
