/**
 * Universal Filter
 *
 * THE single source of truth for filtering posts/signals from any data source.
 * This file is LOCKED after validation - no changes without full regression test.
 *
 * ARCHITECTURE:
 * - Input: NormalizedPost[] from any adapter (Reddit, App Store, etc.)
 * - Output: ScoredSignal[] with embedding scores and pass/fail
 * - Threshold: 0.34 (calibrated against 14 gold nuggets, Dec 2025)
 *
 * HOW IT WORKS:
 * 1. Generate hypothesis embedding (cached)
 * 2. Generate embeddings for all posts (batched, cached)
 * 3. Calculate cosine similarity
 * 4. Classify into HIGH (≥0.50) / MEDIUM (≥0.34) / LOW (<0.34)
 * 5. Return signals that passed (HIGH + MEDIUM)
 *
 * CALIBRATION:
 * Threshold 0.34 was calibrated against 14 gold nuggets for "freelancer payment" hypothesis.
 * At 0.34: 6/8 gold nuggets pass (75% hit rate)
 * See scripts/calibrate-thresholds.ts for calibration methodology.
 */

import {
  generateEmbedding,
  generateEmbeddings,
  cosineSimilarity,
  classifySimilarity,
  SIMILARITY_THRESHOLDS,
  type SimilarityTier,
} from '@/lib/embeddings/embedding-service'
import { NormalizedPost, ScoredSignal, FilterResult, FilterMetrics } from '@/lib/adapters/types'

/**
 * Filter configuration
 */
export interface FilterConfig {
  /** Minimum similarity threshold (default: 0.34) */
  threshold?: number

  /** Maximum posts to process (default: unlimited) */
  maxPosts?: number

  /** Progress callback for streaming updates */
  onProgress?: (message: string) => void
}

/**
 * Default filter configuration
 * CALIBRATED: 0.34 threshold captures 75% of gold nuggets
 */
const DEFAULT_CONFIG: Required<Omit<FilterConfig, 'onProgress'>> = {
  threshold: SIMILARITY_THRESHOLDS.MEDIUM, // 0.34
  maxPosts: Infinity,
}

/**
 * Filter normalized posts by semantic similarity to hypothesis.
 *
 * This is THE filter - all data sources use this exact logic.
 * Adding new data sources = new adapter, filter unchanged.
 *
 * @param posts - Normalized posts from any data source adapter
 * @param hypothesis - The business hypothesis to compare against
 * @param config - Optional filter configuration
 * @returns FilterResult with passed signals, filtered signals, and metrics
 */
export async function filterByEmbedding(
  posts: NormalizedPost[],
  hypothesis: string,
  config?: FilterConfig
): Promise<FilterResult> {
  const startTime = Date.now()
  const { threshold, maxPosts } = { ...DEFAULT_CONFIG, ...config }
  const onProgress = config?.onProgress

  // Limit posts if configured
  const postsToProcess = maxPosts < posts.length ? posts.slice(0, maxPosts) : posts

  onProgress?.(`Filtering ${postsToProcess.length} posts against hypothesis...`)

  // Step 1: Generate hypothesis embedding
  onProgress?.('Generating hypothesis embedding...')
  const hypothesisEmbedding = await generateEmbedding(hypothesis)

  if (!hypothesisEmbedding || hypothesisEmbedding.length === 0) {
    // Fallback: pass all as MEDIUM if embedding fails
    console.warn('[UniversalFilter] Hypothesis embedding failed, passing all posts')
    const signals: ScoredSignal[] = postsToProcess.map(post => ({
      post,
      embeddingScore: 0.5,
      tier: 'MEDIUM' as const,
      passed: true,
    }))

    return {
      signals,
      filtered: [],
      metrics: createMetrics(postsToProcess.length, postsToProcess.length, postsToProcess.length, 0, postsToProcess.length, 0, startTime),
    }
  }

  // Step 2: Generate embeddings for all posts
  const textsForEmbedding = postsToProcess.map(post => post.textForEmbedding)
  onProgress?.(`Generating embeddings for ${textsForEmbedding.length} posts...`)
  const postEmbeddings = await generateEmbeddings(textsForEmbedding)

  // Step 3: Calculate similarities and classify
  const signals: ScoredSignal[] = []
  const filtered: ScoredSignal[] = []
  let highCount = 0
  let mediumCount = 0
  let lowCount = 0

  for (let i = 0; i < postsToProcess.length; i++) {
    const post = postsToProcess[i]
    const embedding = postEmbeddings[i]?.embedding

    // If embedding failed, skip this post
    if (!embedding || embedding.length === 0) {
      lowCount++
      filtered.push({
        post,
        embeddingScore: 0,
        tier: 'LOW',
        passed: false,
      })
      continue
    }

    // Calculate cosine similarity
    const score = cosineSimilarity(hypothesisEmbedding, embedding)
    const tier = classifyWithThreshold(score, threshold)
    const passed = tier !== 'LOW'

    const signal: ScoredSignal = {
      post,
      embeddingScore: score,
      tier,
      passed,
    }

    if (passed) {
      signals.push(signal)
      if (tier === 'HIGH') highCount++
      else mediumCount++
    } else {
      filtered.push(signal)
      lowCount++
    }
  }

  onProgress?.(`Filter complete: ${signals.length} passed, ${filtered.length} filtered`)

  return {
    signals,
    filtered,
    metrics: createMetrics(
      posts.length,
      postsToProcess.length, // passedKeywordGate not used here
      signals.length,
      signals.length,
      highCount,
      mediumCount,
      startTime
    ),
  }
}

/**
 * Filter posts with a pre-computed hypothesis embedding.
 * Use this when filtering multiple batches against the same hypothesis.
 *
 * @param posts - Normalized posts from any data source adapter
 * @param hypothesisEmbedding - Pre-computed hypothesis embedding
 * @param config - Optional filter configuration
 */
export async function filterWithEmbedding(
  posts: NormalizedPost[],
  hypothesisEmbedding: number[],
  config?: FilterConfig
): Promise<FilterResult> {
  const startTime = Date.now()
  const { threshold, maxPosts } = { ...DEFAULT_CONFIG, ...config }
  const onProgress = config?.onProgress

  // Limit posts if configured
  const postsToProcess = maxPosts < posts.length ? posts.slice(0, maxPosts) : posts

  // Generate embeddings for all posts
  const textsForEmbedding = postsToProcess.map(post => post.textForEmbedding)
  onProgress?.(`Generating embeddings for ${textsForEmbedding.length} posts...`)
  const postEmbeddings = await generateEmbeddings(textsForEmbedding)

  // Calculate similarities and classify
  const signals: ScoredSignal[] = []
  const filtered: ScoredSignal[] = []
  let highCount = 0
  let mediumCount = 0

  for (let i = 0; i < postsToProcess.length; i++) {
    const post = postsToProcess[i]
    const embedding = postEmbeddings[i]?.embedding

    if (!embedding || embedding.length === 0) {
      filtered.push({
        post,
        embeddingScore: 0,
        tier: 'LOW',
        passed: false,
      })
      continue
    }

    const score = cosineSimilarity(hypothesisEmbedding, embedding)
    const tier = classifyWithThreshold(score, threshold)
    const passed = tier !== 'LOW'

    const signal: ScoredSignal = {
      post,
      embeddingScore: score,
      tier,
      passed,
    }

    if (passed) {
      signals.push(signal)
      if (tier === 'HIGH') highCount++
      else mediumCount++
    } else {
      filtered.push(signal)
    }
  }

  onProgress?.(`Filter complete: ${signals.length} passed, ${filtered.length} filtered`)

  return {
    signals,
    filtered,
    metrics: createMetrics(
      posts.length,
      postsToProcess.length,
      signals.length,
      signals.length,
      highCount,
      mediumCount,
      startTime
    ),
  }
}

/**
 * Classify similarity score with custom threshold.
 * HIGH: ≥0.50, MEDIUM: ≥threshold, LOW: <threshold
 */
function classifyWithThreshold(score: number, threshold: number): SimilarityTier {
  if (score >= SIMILARITY_THRESHOLDS.HIGH) return 'HIGH'
  if (score >= threshold) return 'MEDIUM'
  return 'LOW'
}

/**
 * Create metrics object
 */
function createMetrics(
  totalInput: number,
  passedKeywordGate: number,
  passedEmbedding: number,
  finalCount: number,
  highSimilarity: number,
  mediumSimilarity: number,
  startTime: number
): FilterMetrics {
  return {
    totalInput,
    passedKeywordGate,
    passedEmbedding,
    finalCount,
    highSimilarity,
    mediumSimilarity,
    lowSimilarity: totalInput - finalCount,
    processingTimeMs: Date.now() - startTime,
  }
}

/**
 * Get the default threshold.
 * Exposed for testing and debugging.
 */
export function getDefaultThreshold(): number {
  return DEFAULT_CONFIG.threshold
}

/**
 * Score a single post against a hypothesis.
 * Useful for debugging and testing.
 */
export async function scorePost(
  post: NormalizedPost,
  hypothesis: string
): Promise<ScoredSignal> {
  const hypothesisEmbedding = await generateEmbedding(hypothesis)
  const postEmbedding = await generateEmbedding(post.textForEmbedding)

  if (!hypothesisEmbedding || !postEmbedding || hypothesisEmbedding.length === 0 || postEmbedding.length === 0) {
    return {
      post,
      embeddingScore: 0,
      tier: 'LOW',
      passed: false,
    }
  }

  const score = cosineSimilarity(hypothesisEmbedding, postEmbedding)
  const tier = classifySimilarity(score)

  return {
    post,
    embeddingScore: score,
    tier,
    passed: tier !== 'LOW',
  }
}
