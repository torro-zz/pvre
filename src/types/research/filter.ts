/**
 * Filtering and relevance types - Single source of truth
 *
 * CONSOLIDATES:
 * - FilteringMetrics from: community-voice/route.ts, fetch-research-data.ts
 * - RelevanceDecision from: relevance-filter.ts
 * - FilterMetrics from: relevance-filter.ts
 */

import type { RelevanceTier } from './core'

// =============================================================================
// ENUMS & SIMPLE TYPES
// =============================================================================

export type QualityLevel = 'high' | 'medium' | 'low'

export type ExpansionType = 'time_range' | 'fetch_limit' | 'communities'

export type DecisionStage = 'quality' | 'domain' | 'problem'

// =============================================================================
// EXPANSION ATTEMPT (Adaptive Fetching)
// =============================================================================

export interface ExpansionAttempt {
  type: ExpansionType
  value: string
  success: boolean
  signalsGained: number
}

// =============================================================================
// RELEVANCE DECISION (For audit trail)
// =============================================================================

/**
 * Individual relevance decision for a post/comment.
 * Used for quality audit and debugging.
 */
export interface RelevanceDecision {
  reddit_id: string
  title?: string
  body_preview: string
  subreddit: string
  decision: 'Y' | 'N'
  tier?: RelevanceTier
  stage?: DecisionStage
  reason?: string
}

// =============================================================================
// TWO-STAGE FILTER METRICS
// =============================================================================

export interface TwoStageMetrics {
  stage1Candidates: number    // After embedding filter
  stage2Candidates: number    // After cap (always <= 50)
  stage3Verified: number      // After Haiku verification
  verificationRate: number    // stage3 / stage2
  processingTimeMs: number
}

// =============================================================================
// TIERED FILTER METRICS
// =============================================================================

export interface TieredMetrics {
  core: number       // Score >= 0.45
  strong: number     // Score >= 0.35
  related: number    // Score >= 0.25
  adjacent: number   // Score >= 0.15
  total: number      // Total signals
  processingTimeMs: number
}

// =============================================================================
// FILTERING METRICS (Canonical - from community-voice/route.ts)
// =============================================================================

/**
 * Comprehensive filtering metrics for data quality transparency.
 *
 * Consolidated from community-voice/route.ts and fetch-research-data.ts.
 */
export interface FilteringMetrics {
  // Post filtering
  postsFound: number
  postsAnalyzed: number
  postsFiltered: number
  postFilterRate: number

  // Comment filtering
  commentsFound: number
  commentsAnalyzed: number
  commentsFiltered: number
  commentFilterRate: number

  // Quality assessment
  qualityLevel: QualityLevel

  // Signal tiering
  coreSignals: number       // CORE: intersection match (problem + context)
  relatedSignals: number    // RELATED: single-domain match

  // Title-only recovery
  titleOnlyPosts: number    // Posts analyzed by title only (body was removed)

  // Pre-filter ranking
  preFilterSkipped?: number  // Low-quality posts skipped before AI processing

  // Stage 2 (problem-specific) filter metrics
  stage2FilterRate?: number  // % of Stage 1 passes that failed Stage 2
  narrowProblemWarning?: boolean  // True if >50% of Stage 1 passes failed Stage 2

  // Adaptive fetching diagnostics
  expansionAttempts?: ExpansionAttempt[]
  timeRangeMonths?: number
  communitiesSearched?: string[]

  // Two-stage filter metrics (when enabled)
  twoStageMetrics?: TwoStageMetrics

  // Tiered filter metrics (when enabled)
  tieredMetrics?: TieredMetrics
}

// =============================================================================
// FILTER METRICS (Internal - from relevance-filter.ts)
// =============================================================================

/**
 * Internal filter metrics used by relevance-filter.ts.
 * More detailed than FilteringMetrics (which is for API responses).
 */
export interface FilterMetrics {
  before: number
  after: number
  filteredOut: number
  filterRate: number
  preFilterSkipped: number
  embeddingFiltered: number
  embeddingHighSimilarity: number
  embeddingMediumSimilarity: number
  stage3Filtered: number  // Quality gate
  stage1Filtered: number  // Domain gate
  stage2Filtered: number  // Problem match
  titleOnlyPosts: number
  coreSignals: number
  relatedSignals: number
  stage2FilterRate: number
  narrowProblemWarning: boolean
}

// =============================================================================
// FILTER RESULT
// =============================================================================

export interface FilterResult<T> {
  items: T[]
  metrics: FilterMetrics
  decisions: RelevanceDecision[]
}
