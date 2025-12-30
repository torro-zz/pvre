/**
 * Embedding Service
 *
 * Provides semantic similarity filtering using OpenAI text-embedding-3-large.
 * Uses 1536 dimensions (reduced from 3072 for pgvector HNSW compatibility).
 *
 * Features:
 * - Single text and batch embedding generation
 * - Caching via Supabase embedding_cache table
 * - Cosine similarity calculation
 * - Graceful error handling with fallback
 */

import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'

// Configuration
const EMBEDDING_MODEL = 'text-embedding-3-large'
const EMBEDDING_DIMENSIONS = 1536  // Reduced for HNSW index compatibility
const MAX_BATCH_SIZE = 100  // OpenAI limit per request

// Similarity thresholds (calibrated from testing)
// Test hypothesis: "Freelancers struggling to get paid on time by clients"
// - Direct pain posts scored 0.54-0.77
// - Tangential (invoicing tools) scored 0.44-0.46
// - Borderline relevant scored 0.35-0.40
// - Irrelevant (pizza, dogs) scored 0.04-0.15
//
// Dec 2025: Lowered MEDIUM from 0.40 to 0.35, but quality was 0/15.
// Raised back to 0.40 - borderline posts (0.35-0.40) are often irrelevant
// to the SPECIFIC problem even if they're in the same general topic.
export const SIMILARITY_THRESHOLDS = {
  HIGH: 0.50,    // CORE candidate - directly about the problem
  MEDIUM: 0.40,  // RELATED candidate - same domain, might be relevant
  LOW: 0.40,     // Below this = reject without AI call
} as const

export type SimilarityTier = 'HIGH' | 'MEDIUM' | 'LOW'

export interface EmbeddingResult {
  text: string
  embedding: number[]
  cached: boolean
}

export interface SimilarityResult {
  text: string
  similarity: number
  tier: SimilarityTier
}

// Lazy-initialized OpenAI client
let openaiClient: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set')
    }
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}

/**
 * Generate SHA256 hash of text for cache lookup
 */
function hashText(text: string): string {
  const normalized = text.trim().toLowerCase()
  return crypto.createHash('sha256').update(normalized).digest('hex')
}

/**
 * Check cache for existing embeddings
 */
async function getCachedEmbeddings(
  textHashes: string[]
): Promise<Map<string, number[]>> {
  if (textHashes.length === 0) return new Map()

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('embedding_cache')
      .select('text_hash, embedding')
      .in('text_hash', textHashes)

    if (error) {
      console.warn('[EmbeddingService] Cache lookup failed:', error.message)
      return new Map()
    }

    const cache = new Map<string, number[]>()
    for (const row of data || []) {
      // Parse the vector string from Supabase into number array
      // pgvector returns as string like "[0.1,0.2,...]"
      const embedding = typeof row.embedding === 'string'
        ? JSON.parse(row.embedding)
        : row.embedding
      cache.set(row.text_hash, embedding)
    }
    return cache
  } catch (error) {
    console.warn('[EmbeddingService] Cache error:', error)
    return new Map()
  }
}

/**
 * Store embeddings in cache
 */
async function cacheEmbeddings(
  items: Array<{ text: string; hash: string; embedding: number[] }>
): Promise<void> {
  if (items.length === 0) return

  try {
    const supabase = createAdminClient()
    const rows = items.map(({ text, hash, embedding }) => ({
      text_hash: hash,
      text_preview: text.slice(0, 200),
      embedding: `[${embedding.join(',')}]`,  // Format for pgvector
      model: EMBEDDING_MODEL,
    }))

    const { error } = await supabase
      .from('embedding_cache')
      .upsert(rows, { onConflict: 'text_hash' })

    if (error) {
      console.warn('[EmbeddingService] Cache write failed:', error.message)
    }
  } catch (error) {
    console.warn('[EmbeddingService] Cache write error:', error)
  }
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const results = await generateEmbeddings([text])
  return results[0]?.embedding ?? null
}

/**
 * Generate embeddings for multiple texts (batch processing)
 * Uses caching to avoid redundant API calls
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<EmbeddingResult[]> {
  if (texts.length === 0) return []

  // Normalize and hash texts
  const items = texts.map(text => ({
    original: text,
    normalized: text.trim(),
    hash: hashText(text),
  }))

  // Check cache first
  const hashes = items.map(i => i.hash)
  const cached = await getCachedEmbeddings(hashes)

  // Separate cached and uncached
  const results: EmbeddingResult[] = []
  const toEmbed: Array<{ index: number; text: string; hash: string }> = []

  items.forEach((item, index) => {
    const cachedEmbedding = cached.get(item.hash)
    if (cachedEmbedding) {
      results[index] = {
        text: item.original,
        embedding: cachedEmbedding,
        cached: true,
      }
    } else {
      toEmbed.push({ index, text: item.normalized, hash: item.hash })
    }
  })

  // Generate embeddings for uncached texts
  if (toEmbed.length > 0) {
    try {
      const openai = getOpenAIClient()

      // Process in batches
      for (let i = 0; i < toEmbed.length; i += MAX_BATCH_SIZE) {
        const batch = toEmbed.slice(i, i + MAX_BATCH_SIZE)
        const textsToEmbed = batch.map(b => b.text)

        const response = await openai.embeddings.create({
          model: EMBEDDING_MODEL,
          input: textsToEmbed,
          dimensions: EMBEDDING_DIMENSIONS,
        })

        // Map results back
        const toCache: Array<{ text: string; hash: string; embedding: number[] }> = []

        response.data.forEach((embeddingData, batchIndex) => {
          const item = batch[batchIndex]
          const embedding = embeddingData.embedding

          results[item.index] = {
            text: items[item.index].original,
            embedding,
            cached: false,
          }

          toCache.push({
            text: item.text,
            hash: item.hash,
            embedding,
          })
        })

        // Cache new embeddings (fire and forget)
        cacheEmbeddings(toCache).catch(() => {})
      }
    } catch (error) {
      console.error('[EmbeddingService] OpenAI API error:', error)
      // Return partial results with nulls for failed embeddings
      toEmbed.forEach(item => {
        if (!results[item.index]) {
          results[item.index] = {
            text: items[item.index].original,
            embedding: [],
            cached: false,
          }
        }
      })
    }
  }

  return results
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  if (denominator === 0) return 0

  return dotProduct / denominator
}

/**
 * Classify similarity score into tier
 */
export function classifySimilarity(score: number): SimilarityTier {
  if (score >= SIMILARITY_THRESHOLDS.HIGH) return 'HIGH'
  if (score >= SIMILARITY_THRESHOLDS.MEDIUM) return 'MEDIUM'
  return 'LOW'
}

/**
 * Compare multiple texts against a reference embedding
 * Returns similarity scores and tier classifications
 */
export function compareSimilarities(
  referenceEmbedding: number[],
  candidateEmbeddings: EmbeddingResult[]
): SimilarityResult[] {
  return candidateEmbeddings.map(candidate => {
    const similarity = candidate.embedding.length > 0
      ? cosineSimilarity(referenceEmbedding, candidate.embedding)
      : 0

    return {
      text: candidate.text,
      similarity,
      tier: classifySimilarity(similarity),
    }
  })
}

/**
 * Filter texts by semantic similarity to hypothesis
 * Returns texts grouped by tier (HIGH, MEDIUM) - LOW is filtered out
 */
export async function filterBySimilarity(
  hypothesisText: string,
  candidateTexts: string[],
  sendProgress?: (msg: string) => void
): Promise<{
  high: Array<{ text: string; similarity: number }>
  medium: Array<{ text: string; similarity: number }>
  filtered: number
  hypothesisEmbedding: number[]
}> {
  sendProgress?.(`Generating embeddings for ${candidateTexts.length} candidates...`)

  // Generate hypothesis embedding
  const hypothesisEmbedding = await generateEmbedding(hypothesisText)
  if (!hypothesisEmbedding || hypothesisEmbedding.length === 0) {
    // Fallback: return all as medium tier if embedding fails
    console.warn('[EmbeddingService] Hypothesis embedding failed, passing all candidates')
    return {
      high: [],
      medium: candidateTexts.map(text => ({ text, similarity: 0.5 })),
      filtered: 0,
      hypothesisEmbedding: [],
    }
  }

  // Generate candidate embeddings
  const candidateResults = await generateEmbeddings(candidateTexts)

  // Compare similarities
  const similarities = compareSimilarities(hypothesisEmbedding, candidateResults)

  // Group by tier
  const high: Array<{ text: string; similarity: number }> = []
  const medium: Array<{ text: string; similarity: number }> = []
  let filtered = 0

  for (const result of similarities) {
    if (result.tier === 'HIGH') {
      high.push({ text: result.text, similarity: result.similarity })
    } else if (result.tier === 'MEDIUM') {
      medium.push({ text: result.text, similarity: result.similarity })
    } else {
      filtered++
    }
  }

  sendProgress?.(`Embedding filter: ${high.length} HIGH, ${medium.length} MEDIUM, ${filtered} filtered`)

  return { high, medium, filtered, hypothesisEmbedding }
}

/**
 * Generate multi-facet embeddings for a hypothesis
 * Creates 3 embeddings capturing different angles:
 * - Pain facet: "People struggling with X, frustrated by X"
 * - Solution facet: "Looking for solutions to X, need help with X"
 * - Experience facet: "My experience with X, dealing with X"
 *
 * This improves recall by matching posts that express the problem
 * in different ways (some express pain, some seek solutions, some share experiences)
 */
export async function generateMultiFacetEmbeddings(
  hypothesisText: string
): Promise<{ embeddings: number[][]; facets: string[] } | null> {
  // Create 3 facets that capture different angles of experiencing the problem
  // Each facet emphasizes the SPECIFIC PROBLEM, not just the domain/audience
  const facets = [
    // Pain facet: First-person frustration with THIS problem
    `I am frustrated because ${hypothesisText}. This is a major problem for me. I am struggling with ${hypothesisText} and it's affecting my work.`,
    // Complaint facet: Explicit complaints about the specific issue
    `${hypothesisText} is a huge issue. Why does ${hypothesisText} keep happening? So tired of dealing with ${hypothesisText}.`,
    // Solution-seeking facet: Looking for help with THIS specific problem
    `How do I solve ${hypothesisText}? Any tips for ${hypothesisText}? Looking for advice on ${hypothesisText} because I'm stuck.`,
  ]

  const results = await generateEmbeddings(facets)

  // Check if all embeddings were generated successfully
  const validEmbeddings = results.filter(r => r.embedding.length > 0)
  if (validEmbeddings.length === 0) {
    return null
  }

  return {
    embeddings: results.map(r => r.embedding),
    facets,
  }
}

/**
 * Compare a candidate against multiple facet embeddings and return max similarity
 * This ensures posts expressing the problem in ANY way (pain, solution-seeking, experience)
 * get matched, improving recall
 */
export function maxSimilarityAcrossFacets(
  facetEmbeddings: number[][],
  candidateEmbedding: number[]
): number {
  if (facetEmbeddings.length === 0 || candidateEmbedding.length === 0) {
    return 0
  }

  let maxSim = 0
  for (const facetEmb of facetEmbeddings) {
    if (facetEmb.length > 0) {
      const sim = cosineSimilarity(facetEmb, candidateEmbedding)
      if (sim > maxSim) {
        maxSim = sim
      }
    }
  }
  return maxSim
}

/**
 * Filter texts by multi-facet semantic similarity to hypothesis
 * Uses 3 facets (pain, solution, experience) and takes MAX similarity
 * Returns texts grouped by tier (HIGH, MEDIUM) - LOW is filtered out
 *
 * This is the main entry point for multi-facet filtering, improving recall
 * over single-embedding filtering
 */
export async function filterByMultiFacetSimilarity(
  hypothesisText: string,
  candidateTexts: string[],
  sendProgress?: (msg: string) => void
): Promise<{
  high: Array<{ text: string; similarity: number }>
  medium: Array<{ text: string; similarity: number }>
  filtered: number
  hypothesisEmbeddings: number[][]
}> {
  sendProgress?.(`Generating multi-facet embeddings for hypothesis...`)

  // Generate multi-facet hypothesis embeddings
  const facetResult = await generateMultiFacetEmbeddings(hypothesisText)
  if (!facetResult || facetResult.embeddings.every(e => e.length === 0)) {
    // Fallback: return all as medium tier if embedding fails
    console.warn('[EmbeddingService] Multi-facet embedding failed, passing all candidates')
    return {
      high: [],
      medium: candidateTexts.map(text => ({ text, similarity: 0.5 })),
      filtered: 0,
      hypothesisEmbeddings: [],
    }
  }

  sendProgress?.(`Generating embeddings for ${candidateTexts.length} candidates...`)

  // Generate candidate embeddings
  const candidateResults = await generateEmbeddings(candidateTexts)

  // Compare against all facets and take max similarity
  const high: Array<{ text: string; similarity: number }> = []
  const medium: Array<{ text: string; similarity: number }> = []
  let filtered = 0

  for (let i = 0; i < candidateResults.length; i++) {
    const candidate = candidateResults[i]
    if (candidate.embedding.length === 0) {
      // If candidate embedding failed, pass through as medium
      medium.push({ text: candidate.text, similarity: 0.4 })
      continue
    }

    const similarity = maxSimilarityAcrossFacets(facetResult.embeddings, candidate.embedding)
    const tier = classifySimilarity(similarity)

    if (tier === 'HIGH') {
      high.push({ text: candidate.text, similarity })
    } else if (tier === 'MEDIUM') {
      medium.push({ text: candidate.text, similarity })
    } else {
      filtered++
    }
  }

  sendProgress?.(`Multi-facet filter: ${high.length} HIGH, ${medium.length} MEDIUM, ${filtered} filtered`)

  return { high, medium, filtered, hypothesisEmbeddings: facetResult.embeddings }
}

/**
 * Check if embedding service is available
 */
export function isEmbeddingServiceAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY
}
