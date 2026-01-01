/**
 * Tiered Filter
 *
 * New filtering approach that classifies signals into relevance tiers
 * instead of binary pass/fail. Feature-flagged via USE_TIERED_FILTER.
 *
 * Key differences from two-stage pipeline:
 * - No Haiku verification (saves 150 AI calls)
 * - All signals preserved in tiers (core/strong/related/adjacent)
 * - Source weights applied for analysis prioritization
 * - AI budget moved to synthesis instead of gatekeeping
 *
 * ARCHITECTURE:
 * - Input: NormalizedPost[] from any adapter
 * - Output: TieredSignals with signals organized by relevance tier
 * - Thresholds: CORE ≥0.45, STRONG ≥0.35, RELATED ≥0.25, ADJACENT ≥0.15
 */

import {
  generateEmbedding,
  generateEmbeddings,
  cosineSimilarity,
} from '@/lib/embeddings/embedding-service'
import {
  NormalizedPost,
  TieredSignals,
  TieredScoredSignal,
  TieredFilterStats,
  SignalTier,
} from '@/lib/adapters/types'
import {
  TIER_THRESHOLDS,
  SOURCE_WEIGHTS,
  WTP_SOURCE_WEIGHTS,
} from './config'

/**
 * Configuration for tiered filtering
 */
export interface TieredFilterConfig {
  /** Progress callback for streaming updates */
  onProgress?: (message: string) => void

  /** Maximum posts to process (default: unlimited) */
  maxPosts?: number
}

/**
 * Filter posts into relevance tiers based on embedding similarity.
 *
 * Unlike the two-stage pipeline, this preserves ALL signals in graduated tiers:
 * - CORE (≥0.45): Direct match to hypothesis
 * - STRONG (≥0.35): Highly relevant
 * - RELATED (≥0.25): Same problem space
 * - ADJACENT (≥0.15): Nearby problems (useful for pivot opportunities)
 *
 * Signals below 0.15 are discarded (too noisy to be useful).
 *
 * @param posts - Normalized posts from any data source adapter
 * @param hypothesis - The business hypothesis to compare against
 * @param config - Optional configuration
 * @returns TieredSignals with signals organized by relevance tier
 */
export async function filterSignalsTiered(
  posts: NormalizedPost[],
  hypothesis: string,
  config?: TieredFilterConfig
): Promise<TieredSignals> {
  const startTime = Date.now()
  const onProgress = config?.onProgress
  const maxPosts = config?.maxPosts ?? Infinity

  // Limit posts if configured
  const postsToProcess = maxPosts < posts.length ? posts.slice(0, maxPosts) : posts

  onProgress?.(`[Tiered Filter] Processing ${postsToProcess.length} posts...`)

  // Initialize tier arrays
  const core: TieredScoredSignal[] = []
  const strong: TieredScoredSignal[] = []
  const related: TieredScoredSignal[] = []
  const adjacent: TieredScoredSignal[] = []

  // Track stats
  const bySource: Record<string, number> = {}

  // Step 1: Generate hypothesis embedding
  onProgress?.('[Tiered Filter] Generating hypothesis embedding...')
  const hypothesisEmbedding = await generateEmbedding(hypothesis)

  if (!hypothesisEmbedding || hypothesisEmbedding.length === 0) {
    console.warn('[TieredFilter] Hypothesis embedding failed, returning empty tiers')
    return createEmptyResult(startTime)
  }

  // Step 2: Generate embeddings for all posts
  const textsForEmbedding = postsToProcess.map(post => post.textForEmbedding)
  onProgress?.(`[Tiered Filter] Generating embeddings for ${textsForEmbedding.length} posts...`)
  const postEmbeddings = await generateEmbeddings(textsForEmbedding)

  // Step 3: Score and classify each post
  for (let i = 0; i < postsToProcess.length; i++) {
    const post = postsToProcess[i]
    const embedding = postEmbeddings[i]?.embedding

    // Skip posts with failed embeddings
    if (!embedding || embedding.length === 0) {
      continue
    }

    // Calculate cosine similarity
    const score = cosineSimilarity(hypothesisEmbedding, embedding)

    // Skip signals below ADJACENT threshold (too noisy)
    if (score < TIER_THRESHOLDS.ADJACENT) {
      continue
    }

    // Classify into tier
    const tier = classifyTier(score)

    // Apply source weights
    const sourceKey = getSourceKey(post)
    const sourceWeight = SOURCE_WEIGHTS[sourceKey] ?? SOURCE_WEIGHTS.other
    const wtpWeight = WTP_SOURCE_WEIGHTS[sourceKey] ?? WTP_SOURCE_WEIGHTS.other

    // Create tiered signal
    const signal: TieredScoredSignal = {
      post,
      score,
      tier,
      sourceWeight,
      wtpWeight,
    }

    // Add to appropriate tier
    switch (tier) {
      case 'core':
        core.push(signal)
        break
      case 'strong':
        strong.push(signal)
        break
      case 'related':
        related.push(signal)
        break
      case 'adjacent':
        adjacent.push(signal)
        break
    }

    // Track source stats
    bySource[post.source] = (bySource[post.source] || 0) + 1
  }

  // Sort each tier by score (descending)
  core.sort((a, b) => b.score - a.score)
  strong.sort((a, b) => b.score - a.score)
  related.sort((a, b) => b.score - a.score)
  adjacent.sort((a, b) => b.score - a.score)

  const total = core.length + strong.length + related.length + adjacent.length
  const processingTimeMs = Date.now() - startTime

  onProgress?.(`[Tiered Filter] Complete: ${core.length} core, ${strong.length} strong, ${related.length} related, ${adjacent.length} adjacent (${processingTimeMs}ms)`)

  return {
    core,
    strong,
    related,
    adjacent,
    stats: {
      total,
      bySource,
      byTier: {
        core: core.length,
        strong: strong.length,
        related: related.length,
        adjacent: adjacent.length,
      },
      processingTimeMs,
    },
  }
}

/**
 * Classify a similarity score into a tier.
 */
function classifyTier(score: number): SignalTier {
  if (score >= TIER_THRESHOLDS.CORE) return 'core'
  if (score >= TIER_THRESHOLDS.STRONG) return 'strong'
  if (score >= TIER_THRESHOLDS.RELATED) return 'related'
  return 'adjacent'
}

/**
 * Get the source key for weight lookup.
 * Handles source normalization (e.g., 'reddit' vs 'reddit_comment').
 */
function getSourceKey(post: NormalizedPost): string {
  const source = post.source

  // Check if it's a comment (has specific metadata patterns)
  // Reddit comments typically have parent_id or are marked differently
  if (source === 'reddit' && post.metadata?.isComment) {
    return 'reddit_comment'
  }

  return source
}

/**
 * Create empty result for error cases.
 */
function createEmptyResult(startTime: number): TieredSignals {
  return {
    core: [],
    strong: [],
    related: [],
    adjacent: [],
    stats: {
      total: 0,
      bySource: {},
      byTier: {
        core: 0,
        strong: 0,
        related: 0,
        adjacent: 0,
      },
      processingTimeMs: Date.now() - startTime,
    },
  }
}

/**
 * Get signals for analysis (CORE + STRONG only).
 * These are the most relevant signals for theme extraction and WTP detection.
 */
export function getSignalsForAnalysis(tiered: TieredSignals): TieredScoredSignal[] {
  return [...tiered.core, ...tiered.strong]
}

/**
 * Get signals for competitor analysis (CORE + STRONG + RELATED).
 * Competitors may be mentioned in broader context.
 */
export function getSignalsForCompetitors(tiered: TieredSignals): TieredScoredSignal[] {
  return [...tiered.core, ...tiered.strong, ...tiered.related]
}

/**
 * Get all signals as flat array.
 */
export function getAllSignals(tiered: TieredSignals): TieredScoredSignal[] {
  return [...tiered.core, ...tiered.strong, ...tiered.related, ...tiered.adjacent]
}
