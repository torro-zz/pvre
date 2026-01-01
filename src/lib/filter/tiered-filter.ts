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

// =============================================================================
// TIERED SAMPLE QUALITY CHECK
// =============================================================================

/**
 * Result of sample quality check for coverage preview.
 * Same interface as QualitySampleResult in relevance-filter.ts for compatibility.
 */
export interface TieredQualitySampleResult {
  predictedRelevance: number // 0-100 percentage
  predictedConfidence: 'very_low' | 'low' | 'medium' | 'high'
  qualityWarning: 'none' | 'caution' | 'strong_warning'
  sampleSize: number
  removedPostRate?: number
  sampleRelevant: Array<{
    title: string
    body_preview: string
    subreddit: string
  }>
  sampleFiltered: Array<{
    title: string
    body_preview: string
    subreddit: string
    filterReason: string
  }>
  filteredTopics: Array<{ topic: string; count: number }>
  suggestion?: string
  broadenings?: string[]
  // Tiered-specific metadata
  tierBreakdown?: {
    core: number
    strong: number
    related: number
    adjacent: number
    noise: number
  }
}

/**
 * Simple post interface for sample quality check.
 * Matches the RedditPost structure used by coverage-check.
 */
interface SamplePost {
  id: string
  title: string
  body: string
  subreddit: string
  score?: number
}

/**
 * Tiered sample quality check for coverage preview.
 *
 * Uses embeddings instead of Haiku domain gate to predict relevance.
 * Cost: ~$0.001 (embeddings only, no AI calls)
 *
 * @param posts - Sample posts from coverage check
 * @param hypothesis - The business hypothesis
 * @returns Quality sample result with predicted relevance
 */
export async function tieredSampleQualityCheck(
  posts: SamplePost[],
  hypothesis: string
): Promise<TieredQualitySampleResult> {
  // Take up to 40 random posts for sampling
  const sampleSize = Math.min(40, posts.length)
  const shuffled = [...posts].sort(() => Math.random() - 0.5)
  const sample = shuffled.slice(0, sampleSize)

  if (sample.length < 10) {
    return {
      predictedRelevance: 0,
      predictedConfidence: 'very_low',
      qualityWarning: 'strong_warning',
      sampleSize: sample.length,
      sampleRelevant: [],
      sampleFiltered: [],
      filteredTopics: [],
      suggestion: 'Very few posts found. Try different keywords or communities.',
      tierBreakdown: { core: 0, strong: 0, related: 0, adjacent: 0, noise: sample.length },
    }
  }

  // Generate hypothesis embedding
  const hypothesisEmbedding = await generateEmbedding(hypothesis)
  if (!hypothesisEmbedding || hypothesisEmbedding.length === 0) {
    return {
      predictedRelevance: 0,
      predictedConfidence: 'very_low',
      qualityWarning: 'strong_warning',
      sampleSize: sample.length,
      sampleRelevant: [],
      sampleFiltered: [],
      filteredTopics: [],
      suggestion: 'Could not analyze posts. Please try again.',
      tierBreakdown: { core: 0, strong: 0, related: 0, adjacent: 0, noise: sample.length },
    }
  }

  // Generate embeddings for sample posts
  const textsForEmbedding = sample.map(post => {
    const text = post.body
      ? `${post.title}: ${post.body}`
      : post.title
    return text.slice(0, 500) // Limit to 500 chars for efficiency
  })
  const postEmbeddings = await generateEmbeddings(textsForEmbedding)

  // Score and classify each post
  const scoredPosts: Array<{
    post: SamplePost
    score: number
    tier: SignalTier | 'noise'
  }> = []

  for (let i = 0; i < sample.length; i++) {
    const post = sample[i]
    const embedding = postEmbeddings[i]?.embedding

    if (!embedding || embedding.length === 0) {
      scoredPosts.push({ post, score: 0, tier: 'noise' })
      continue
    }

    const score = cosineSimilarity(hypothesisEmbedding, embedding)
    const tier = score >= TIER_THRESHOLDS.ADJACENT ? classifyTier(score) : 'noise'
    scoredPosts.push({ post, score, tier })
  }

  // Count tiers
  const tierBreakdown = {
    core: scoredPosts.filter(p => p.tier === 'core').length,
    strong: scoredPosts.filter(p => p.tier === 'strong').length,
    related: scoredPosts.filter(p => p.tier === 'related').length,
    adjacent: scoredPosts.filter(p => p.tier === 'adjacent').length,
    noise: scoredPosts.filter(p => p.tier === 'noise').length,
  }

  // Relevant = CORE + STRONG (what gets analyzed)
  const relevantCount = tierBreakdown.core + tierBreakdown.strong
  const predictedRelevance = Math.round((relevantCount / sample.length) * 100)

  // Estimate final signal count (CORE + STRONG from full dataset)
  // Assume sample is representative
  const estimatedSignals = relevantCount

  // Determine confidence level
  let predictedConfidence: TieredQualitySampleResult['predictedConfidence']
  if (estimatedSignals < 5) {
    predictedConfidence = 'very_low'
  } else if (estimatedSignals < 10) {
    predictedConfidence = 'low'
  } else if (estimatedSignals < 20) {
    predictedConfidence = 'medium'
  } else {
    predictedConfidence = 'high'
  }

  // Determine warning level
  let qualityWarning: TieredQualitySampleResult['qualityWarning'] = 'none'
  if (predictedRelevance < 8) {
    qualityWarning = 'strong_warning'
  } else if (predictedRelevance < 20) {
    qualityWarning = 'caution'
  }

  // Prepare sample relevant posts (up to 3 CORE + STRONG)
  const relevantPosts = scoredPosts
    .filter(p => p.tier === 'core' || p.tier === 'strong')
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)

  const sampleRelevant = relevantPosts.map(p => ({
    title: p.post.title,
    body_preview: (p.post.body || '').slice(0, 150) + ((p.post.body || '').length > 150 ? '...' : ''),
    subreddit: p.post.subreddit,
  }))

  // Prepare sample filtered posts (RELATED, ADJACENT, NOISE)
  const filteredPosts = scoredPosts
    .filter(p => p.tier !== 'core' && p.tier !== 'strong')
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  const sampleFiltered = filteredPosts.map(p => ({
    title: p.post.title,
    body_preview: (p.post.body || '').slice(0, 100) + ((p.post.body || '').length > 100 ? '...' : ''),
    subreddit: p.post.subreddit,
    filterReason: getFilterReason(p.tier, p.score),
  }))

  // Analyze filtered topics - group by subreddit for now
  const filteredBySubreddit = new Map<string, number>()
  for (const p of scoredPosts.filter(p => p.tier !== 'core' && p.tier !== 'strong')) {
    const count = filteredBySubreddit.get(p.post.subreddit) || 0
    filteredBySubreddit.set(p.post.subreddit, count + 1)
  }
  const filteredTopics = Array.from(filteredBySubreddit.entries())
    .map(([topic, count]) => ({ topic: `r/${topic}`, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3)

  // Generate suggestion if quality is low
  let suggestion: string | undefined
  if (qualityWarning === 'strong_warning') {
    suggestion = 'Very few relevant signals found. Consider refining your hypothesis with more specific problem language.'
  } else if (qualityWarning === 'caution') {
    suggestion = 'Moderate relevance detected. Results may require manual review.'
  }

  return {
    predictedRelevance,
    predictedConfidence,
    qualityWarning,
    sampleSize: sample.length,
    sampleRelevant,
    sampleFiltered,
    filteredTopics,
    suggestion,
    tierBreakdown,
  }
}

/**
 * Get human-readable filter reason based on tier.
 */
function getFilterReason(tier: SignalTier | 'noise', score: number): string {
  switch (tier) {
    case 'related':
      return `Related topic (score: ${score.toFixed(2)})`
    case 'adjacent':
      return `Adjacent problem (score: ${score.toFixed(2)})`
    case 'noise':
      return `Off-topic (score: ${score.toFixed(2)})`
    default:
      return `Low relevance (score: ${score.toFixed(2)})`
  }
}
