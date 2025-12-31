/**
 * Filter Configuration
 *
 * All thresholds and caps in one place for easy tuning.
 * Changes here affect the entire filtering pipeline.
 */

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
