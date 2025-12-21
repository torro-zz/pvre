-- Migration: Add app_discovery_events table for learning system
-- This tracks app discovery, scoring, and user selection for continuous improvement
-- Idempotent: safe to run multiple times

CREATE TABLE IF NOT EXISTS app_discovery_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES research_jobs(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Hypothesis context (anonymized for privacy)
  hypothesis_domain TEXT,           -- Extracted domain like "expat health insurance"
  hypothesis_audience TEXT,         -- Target audience description

  -- App details
  app_id TEXT NOT NULL,             -- App store ID
  app_store TEXT NOT NULL CHECK (app_store IN ('google_play', 'app_store')),
  app_name TEXT NOT NULL,
  app_category TEXT,
  app_rating NUMERIC(2,1),          -- 0.0 to 5.0
  app_review_count INTEGER,

  -- Discovery metadata
  discovery_method TEXT,            -- 'keyword_search', 'competitor_search', 'category_search'
  search_query TEXT,                -- The actual query used to find this app

  -- LLM scoring results
  llm_relevance_score NUMERIC(3,1), -- 0.0 to 10.0
  llm_relevance_reason TEXT,        -- Brief explanation from Claude

  -- User interaction signals
  was_auto_selected BOOLEAN DEFAULT true,   -- Did we auto-select this app?
  user_kept_selected BOOLEAN,               -- Did user keep it selected? (null = unknown)
  user_manually_added BOOLEAN DEFAULT false, -- Did user add this manually?

  -- Research outcome (filled after research completes)
  research_completed BOOLEAN DEFAULT false,
  signals_from_app INTEGER,                 -- Number of pain signals found
  core_signal_count INTEGER,                -- Number of CORE tier signals
  related_signal_count INTEGER,             -- Number of RELATED tier signals

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes (idempotent with IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_app_discovery_user ON app_discovery_events(user_id);
CREATE INDEX IF NOT EXISTS idx_app_discovery_job ON app_discovery_events(job_id);
CREATE INDEX IF NOT EXISTS idx_app_discovery_store ON app_discovery_events(app_store, app_category);
CREATE INDEX IF NOT EXISTS idx_app_discovery_selection ON app_discovery_events(was_auto_selected, user_kept_selected);
CREATE INDEX IF NOT EXISTS idx_app_discovery_score ON app_discovery_events(llm_relevance_score);
CREATE INDEX IF NOT EXISTS idx_app_discovery_domain ON app_discovery_events(hypothesis_domain);

-- RLS: Users can only see their own discovery events
ALTER TABLE app_discovery_events ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist before recreating
DROP POLICY IF EXISTS "Users can view their own app discovery events" ON app_discovery_events;
DROP POLICY IF EXISTS "Service role can insert app discovery events" ON app_discovery_events;
DROP POLICY IF EXISTS "Service role can update app discovery events" ON app_discovery_events;

CREATE POLICY "Users can view their own app discovery events"
  ON app_discovery_events FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Service role can insert app discovery events"
  ON app_discovery_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update app discovery events"
  ON app_discovery_events FOR UPDATE
  USING (true);

-- Function to update updated_at timestamp (CREATE OR REPLACE is idempotent)
CREATE OR REPLACE FUNCTION update_app_discovery_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists before recreating
DROP TRIGGER IF EXISTS trigger_app_discovery_updated_at ON app_discovery_events;

CREATE TRIGGER trigger_app_discovery_updated_at
  BEFORE UPDATE ON app_discovery_events
  FOR EACH ROW
  EXECUTE FUNCTION update_app_discovery_updated_at();

-- Comments for documentation
COMMENT ON TABLE app_discovery_events IS 'Tracks app discovery, LLM scoring, and user selection for the learning system';
COMMENT ON COLUMN app_discovery_events.hypothesis_domain IS 'Extracted domain from hypothesis for pattern analysis';
COMMENT ON COLUMN app_discovery_events.discovery_method IS 'How this app was found: keyword_search, competitor_search, category_search';
COMMENT ON COLUMN app_discovery_events.llm_relevance_score IS 'Claude Haiku relevance score 0-10';
COMMENT ON COLUMN app_discovery_events.user_kept_selected IS 'True if user kept app selected, false if deselected, null if unknown';
COMMENT ON COLUMN app_discovery_events.signals_from_app IS 'Total pain signals found from this app reviews (filled post-research)';
