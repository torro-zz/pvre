-- Migration: Research Folders
-- Description: Add folder organization for research jobs

-- Create folders table
CREATE TABLE IF NOT EXISTS research_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT 'blue',
  icon TEXT DEFAULT 'folder',
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Add folder_id to research_jobs
ALTER TABLE research_jobs ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES research_folders(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE research_folders ENABLE ROW LEVEL SECURITY;

-- RLS policies for research_folders
CREATE POLICY "Users see own folders" ON research_folders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users create own folders" ON research_folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own folders" ON research_folders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users delete own folders" ON research_folders
  FOR DELETE USING (auth.uid() = user_id);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_research_jobs_folder ON research_jobs(folder_id);
CREATE INDEX IF NOT EXISTS idx_research_folders_user ON research_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_research_folders_order ON research_folders(user_id, order_index);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_research_folders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS update_research_folders_updated_at ON research_folders;
CREATE TRIGGER update_research_folders_updated_at
  BEFORE UPDATE ON research_folders
  FOR EACH ROW
  EXECUTE FUNCTION update_research_folders_updated_at();
