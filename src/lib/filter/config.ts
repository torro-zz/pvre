/**
 * Filter Configuration
 *
 * All thresholds and caps in one place for easy tuning.
 * Changes here affect the entire filtering pipeline.
 */

/**
 * Feature flag to enable/disable two-stage filter in production.
 * Set to false for instant rollback to old filter path.
 *
 * When true: Uses filterSignals() with Haiku AI verification
 * When false: Uses filterRelevantPosts() (embedding-only)
 */
export const USE_TWO_STAGE_FILTER = true

export const FILTER_CONFIG = {
  // =============================================================================
  // Stage 1: Embedding Filter
  // =============================================================================

  /**
   * Embedding similarity threshold (loose to catch candidates)
   * Posts scoring >= this pass to Stage 2
   *
   * History:
   * - 0.34: Original calibrated threshold (75% gold nugget hit rate)
   * - 0.28: Loosened for two-stage pipeline (Dec 2025)
   */
  EMBEDDING_THRESHOLD: 0.28,

  /**
   * High similarity threshold (unchanged)
   * Posts scoring >= this are marked as HIGH tier
   */
  HIGH_THRESHOLD: 0.50,

  // =============================================================================
  // Stage 2: Rank and Cap
  // =============================================================================

  /**
   * Maximum posts to send to AI verification
   * This is the COST CAP - never exceeded regardless of Stage 1 output
   *
   * With Haiku at ~$0.001 per call, 50 calls = ~$0.05
   */
  AI_VERIFICATION_CAP: 50,

  // =============================================================================
  // Stage 3: AI Verification
  // =============================================================================

  /**
   * Model for verification
   * Haiku is fast and cheap - perfect for YES/NO classification
   */
  AI_MODEL: 'claude-3-5-haiku-latest',

  /**
   * Strict verification mode
   * When true, only "YES" passes. When false, accepts "MAYBE" too.
   */
  AI_STRICT: true,

  /**
   * Max tokens for verification response
   * Only need YES/NO, so keep this minimal
   */
  AI_MAX_TOKENS: 10,

  /**
   * Batch size for parallel verification
   * Balance between speed and rate limiting
   */
  AI_BATCH_SIZE: 10,
} as const

/**
 * Type for filter configuration
 */
export type FilterConfig = typeof FILTER_CONFIG

// =============================================================================
// TIERED FILTER CONFIGURATION (PRODUCTION - Jan 2026)
// =============================================================================

/**
 * Feature flag to enable/disable tiered filter pipeline.
 * ENABLED for production after testing showed 17x more signals at 10% lower cost.
 *
 * When true: Uses filterSignalsTiered() with graduated relevance tiers
 * When false: Uses existing two-stage filter (legacy behavior)
 */
export const USE_TIERED_FILTER = true

/**
 * Tier thresholds for signal classification.
 * Based on embedding similarity scores (0-1).
 *
 * Calibration notes (Jan 2026):
 * - CORE 0.40: Direct matches to hypothesis (lowered from 0.45 to capture 35+ signals)
 * - STRONG 0.35: Clearly relevant, same problem
 * - RELATED 0.25: Same problem space, useful context
 * - ADJACENT 0.15: Nearby problems, pivot opportunities
 */
export const TIER_THRESHOLDS = {
  CORE: 0.40,
  STRONG: 0.35,
  RELATED: 0.25,
  ADJACENT: 0.15,
} as const

/**
 * Source reliability weights for general analysis.
 * Higher weight = more reliable signal.
 *
 * Weighting rationale:
 * - App stores: Verified purchasers, real users
 * - Trustpilot: Real customers, verified reviews
 * - Reddit posts: Community discussion, some noise
 * - Comments: Shorter, more reactive
 */
export const SOURCE_WEIGHTS: Record<string, number> = {
  // High reliability (verified users/purchasers)
  appstore: 1.0,
  playstore: 1.0,
  trustpilot: 1.0,

  // Medium-high reliability (community discussion)
  reddit: 0.9,        // Posts
  hackernews: 0.85,

  // Medium reliability (shorter/reactive content)
  reddit_comment: 0.7,
  tiktok: 0.6,
  youtube_comment: 0.6,

  // Default for unknown sources
  other: 0.5,
}

/**
 * Source weights specifically for WTP (Willingness to Pay) analysis.
 * People express WTP differently on different platforms.
 *
 * Reddit WTP is often hyperbolic ("take my money!") vs
 * App Store WTP is from actual purchasers ("worth every penny").
 */
export const WTP_SOURCE_WEIGHTS: Record<string, number> = {
  // Real purchasers - highest WTP reliability
  appstore: 1.0,
  playstore: 1.0,
  trustpilot: 1.0,

  // Sometimes hypothetical
  hackernews: 0.7,

  // Often hyperbolic ("shut up and take my money")
  reddit: 0.5,
  reddit_comment: 0.4,

  // Rarely serious about payment
  tiktok: 0.3,
  youtube_comment: 0.3,

  // Default
  other: 0.3,
}

/**
 * Maximum signals per AI synthesis call.
 * Token cap: 50 CORE + 50 STRONG = 100 max.
 */
export const TIERED_SYNTHESIS_CAPS = {
  CORE_MAX: 50,
  STRONG_MAX: 50,
  TOTAL_MAX: 100,
} as const

/**
 * Signal caps based on sample size depth (Quick/Standard/Deep).
 * Keeps response payloads proportional to the fetch depth.
 */
export const SIGNAL_CAPS_BY_SAMPLE_SIZE = {
  150: 50,
  300: 100,
  450: 200,
} as const

export const DEFAULT_SIGNAL_CAP = SIGNAL_CAPS_BY_SAMPLE_SIZE[300]

export function getSignalCapForSampleSize(sampleSizePerSource?: number): number {
  if (!sampleSizePerSource) return DEFAULT_SIGNAL_CAP
  return SIGNAL_CAPS_BY_SAMPLE_SIZE[sampleSizePerSource as keyof typeof SIGNAL_CAPS_BY_SAMPLE_SIZE] ?? DEFAULT_SIGNAL_CAP
}
