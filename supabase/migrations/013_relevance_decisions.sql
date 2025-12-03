-- Migration: Add relevance_decisions table for quality audit
-- This tracks individual Y/N decisions from the Claude relevance filter

CREATE TABLE IF NOT EXISTS relevance_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES research_jobs(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'comment')),
  reddit_id TEXT NOT NULL,
  title TEXT,
  body_preview TEXT,  -- First 200 chars for audit
  subreddit TEXT,
  decision CHAR(1) NOT NULL CHECK (decision IN ('Y', 'N')),
  batch_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying all decisions for a job
CREATE INDEX idx_relevance_decisions_job ON relevance_decisions(job_id);

-- Index for querying by decision type (find all rejected posts)
CREATE INDEX idx_relevance_decisions_type ON relevance_decisions(job_id, decision);

-- Index for analyzing decisions by subreddit
CREATE INDEX idx_relevance_decisions_subreddit ON relevance_decisions(subreddit, decision);

-- RLS: Users can only see decisions for their own jobs
ALTER TABLE relevance_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own relevance decisions"
  ON relevance_decisions FOR SELECT
  USING (
    job_id IN (
      SELECT id FROM research_jobs WHERE user_id = auth.uid()
    )
  );

-- Service role can insert (used by the API)
CREATE POLICY "Service role can insert relevance decisions"
  ON relevance_decisions FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE relevance_decisions IS 'Tracks individual Y/N relevance decisions from Claude filter for quality audits';
COMMENT ON COLUMN relevance_decisions.content_type IS 'post or comment';
COMMENT ON COLUMN relevance_decisions.body_preview IS 'First 200 chars for audit without storing full content';
COMMENT ON COLUMN relevance_decisions.batch_index IS 'Position in the filter batch (0-indexed)';
