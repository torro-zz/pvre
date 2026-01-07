/**
 * ResearchContext - Unified context for research pipeline
 *
 * REPLACES scattered mode detection patterns:
 *   BEFORE: if (appData && appData.appId) { ... }  // appears 9+ times
 *   AFTER:  if (isAppGapMode(ctx)) { ... }
 *
 * See: docs/REFACTORING_PLAN.md Phase 1
 */

import type { AppDetails } from '@/lib/data-sources/types'
import type { StructuredHypothesis } from '@/types/research'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Research mode - determines which pipeline path to take.
 *
 * - hypothesis: User entered a problem hypothesis (Reddit-focused)
 * - app-gap: User selected an app to analyze (App Store reviews + Reddit)
 */
export type ResearchMode = 'hypothesis' | 'app-gap'

/**
 * Research configuration - settings that affect pipeline behavior.
 */
export interface ResearchConfig {
  /** Max subreddits to analyze */
  maxSubreddits: number
  /** Enable tiered filter (embedding-based) */
  useTieredFilter: boolean
  /** Enable two-stage filter (Haiku verification) */
  useTwoStageFilter: boolean
  /** Time range for data fetching (months) */
  timeRangeMonths: number
  /** Max posts to fetch per subreddit */
  maxPostsPerSubreddit: number
}

/**
 * Mutable state accumulated during pipeline execution.
 */
export interface ResearchState {
  /** Subreddits discovered for analysis */
  subredditsToSearch: string[]
  /** Keywords extracted from hypothesis */
  keywords: string[]
  /** Posts fetched from all sources */
  postsFound: number
  /** Posts after filtering */
  postsAnalyzed: number
  /** Current processing stage */
  currentStage: string
  /** Error if pipeline failed */
  error?: string
}

/**
 * ResearchContext - all data needed to execute the research pipeline.
 *
 * This replaces scattered mode checks with a single typed context.
 */
export interface ResearchContext {
  // Identity
  mode: ResearchMode
  jobId: string
  userId: string

  // Input
  hypothesis: string
  structuredHypothesis?: StructuredHypothesis

  // App Gap mode only
  appData?: AppDetails
  crossStoreAppData?: AppDetails

  // Configuration
  config: ResearchConfig

  // Mutable state
  state: ResearchState
}

// =============================================================================
// MODE DETECTION HELPERS
// =============================================================================

/**
 * Check if context is in App Gap mode.
 *
 * USAGE:
 *   if (isAppGapMode(ctx)) {
 *     // App Gap specific logic
 *   }
 */
export function isAppGapMode(ctx: ResearchContext): boolean {
  return ctx.mode === 'app-gap'
}

/**
 * Check if context is in Hypothesis mode.
 */
export function isHypothesisMode(ctx: ResearchContext): boolean {
  return ctx.mode === 'hypothesis'
}

/**
 * Get app data, asserting we're in App Gap mode.
 * Throws if not in App Gap mode or appData is missing.
 */
export function getAppData(ctx: ResearchContext): AppDetails {
  if (!isAppGapMode(ctx)) {
    throw new Error('getAppData called outside App Gap mode')
  }
  if (!ctx.appData) {
    throw new Error('App Gap mode but appData is missing')
  }
  return ctx.appData
}

// =============================================================================
// STANDALONE MODE DETECTION (for use without full context)
// =============================================================================

/**
 * Detect research mode from coverage data.
 *
 * Use this when you only have coverage_data and don't have a full context.
 * Prefer using ResearchContext when available.
 */
export function detectModeFromCoverageData(
  coverageData: { mode?: string; appData?: { appId?: string } | null } | null | undefined
): ResearchMode {
  if (coverageData?.mode === 'app-analysis') {
    return 'app-gap'
  }
  if (coverageData?.appData?.appId) {
    return 'app-gap'
  }
  return 'hypothesis'
}

/**
 * Detect research mode from app data.
 *
 * Use this when you only have appData.
 */
export function detectModeFromAppData(
  appData: { appId?: string } | null | undefined
): ResearchMode {
  if (appData?.appId) {
    return 'app-gap'
  }
  return 'hypothesis'
}

// =============================================================================
// CONTEXT CREATION
// =============================================================================

/**
 * Default research configuration.
 */
export const DEFAULT_CONFIG: ResearchConfig = {
  maxSubreddits: 5,
  useTieredFilter: true,
  useTwoStageFilter: false,
  timeRangeMonths: 6,
  maxPostsPerSubreddit: 100,
}

/**
 * Create initial empty state.
 */
export function createInitialState(): ResearchState {
  return {
    subredditsToSearch: [],
    keywords: [],
    postsFound: 0,
    postsAnalyzed: 0,
    currentStage: 'initializing',
  }
}

/**
 * Create research context from job data.
 *
 * @param jobId - Research job ID
 * @param userId - User ID who owns the job
 * @param hypothesis - The hypothesis or app name to analyze
 * @param appData - App details if in App Gap mode
 * @param structuredHypothesis - Parsed structured hypothesis (optional)
 * @param config - Configuration overrides (optional)
 */
export function createContext(
  jobId: string,
  userId: string,
  hypothesis: string,
  appData?: AppDetails | null,
  structuredHypothesis?: StructuredHypothesis,
  config?: Partial<ResearchConfig>
): ResearchContext {
  const mode = detectModeFromAppData(appData)

  return {
    mode,
    jobId,
    userId,
    hypothesis,
    structuredHypothesis,
    appData: appData || undefined,
    crossStoreAppData: undefined, // Set later via setCrossStoreAppData
    config: { ...DEFAULT_CONFIG, ...config },
    state: createInitialState(),
  }
}

// =============================================================================
// CONTEXT MUTATIONS
// =============================================================================

/**
 * Set cross-store app data (e.g., Play Store app when user submitted App Store URL).
 */
export function setCrossStoreAppData(
  ctx: ResearchContext,
  crossStoreAppData: AppDetails
): void {
  ctx.crossStoreAppData = crossStoreAppData
}

/**
 * Update the current processing stage.
 */
export function setStage(ctx: ResearchContext, stage: string): void {
  ctx.state.currentStage = stage
}

/**
 * Set an error on the context.
 */
export function setError(ctx: ResearchContext, error: string): void {
  ctx.state.error = error
}

/**
 * Update subreddits to search.
 */
export function setSubreddits(ctx: ResearchContext, subreddits: string[]): void {
  ctx.state.subredditsToSearch = subreddits
}

/**
 * Update keywords.
 */
export function setKeywords(ctx: ResearchContext, keywords: string[]): void {
  ctx.state.keywords = keywords
}
