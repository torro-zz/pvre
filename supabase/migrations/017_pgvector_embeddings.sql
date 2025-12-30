-- Migration: Add pgvector for semantic similarity filtering
-- Purpose: Enable embedding-based pre-filtering to reduce irrelevant signals from 64% to <10%

-- Step 1: Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Add hypothesis embedding to research_jobs
-- Using 1536 dimensions (text-embedding-3-large with dimension reduction for HNSW compatibility)
-- HNSW index has 2000 dim limit, so we use reduced dimensions via OpenAI API parameter
ALTER TABLE research_jobs
ADD COLUMN IF NOT EXISTS hypothesis_embedding vector(1536);

-- Step 3: Create embedding cache table
-- Stores embeddings to avoid recomputing for the same text
CREATE TABLE IF NOT EXISTS embedding_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text_hash text NOT NULL UNIQUE,  -- SHA256 hash of the text
  text_preview text NOT NULL,       -- First 200 chars for debugging
  embedding vector(1536) NOT NULL,  -- 1536 dims for HNSW compatibility
  model text NOT NULL DEFAULT 'text-embedding-3-large',
  created_at timestamptz DEFAULT now(),
  last_used_at timestamptz DEFAULT now(),
  use_count integer DEFAULT 1
);

-- Index for fast hash lookups
CREATE INDEX IF NOT EXISTS idx_embedding_cache_hash ON embedding_cache(text_hash);

-- Index for hypothesis embedding similarity search (cosine distance)
-- Only create if there are actually embeddings to index
-- Note: This uses HNSW index for fast approximate nearest neighbor search
CREATE INDEX IF NOT EXISTS idx_research_jobs_embedding
ON research_jobs USING hnsw (hypothesis_embedding vector_cosine_ops)
WHERE hypothesis_embedding IS NOT NULL;

-- Step 4: Add RLS policies for embedding_cache
ALTER TABLE embedding_cache ENABLE ROW LEVEL SECURITY;

-- Service role can read/write (embeddings are computed server-side)
CREATE POLICY "Service role full access to embedding_cache"
ON embedding_cache
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Anon/authenticated can read cached embeddings (for client-side similarity)
CREATE POLICY "Anyone can read embedding_cache"
ON embedding_cache
FOR SELECT
TO anon, authenticated
USING (true);

-- Step 5: Function to update last_used_at and use_count when cache is hit
CREATE OR REPLACE FUNCTION update_embedding_cache_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- This trigger would be called from application code via RPC if needed
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Comment explaining the schema
COMMENT ON TABLE embedding_cache IS 'Cache for OpenAI text embeddings to avoid recomputation';
COMMENT ON COLUMN research_jobs.hypothesis_embedding IS 'OpenAI text-embedding-3-large vector (3072 dims) for semantic similarity';
COMMENT ON COLUMN embedding_cache.text_hash IS 'SHA256 hash of normalized text for deduplication';
