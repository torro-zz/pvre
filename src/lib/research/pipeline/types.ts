/**
 * Pipeline Types - Interfaces for composable research pipeline steps
 *
 * Each step in the research pipeline implements PipelineStep interface,
 * allowing for consistent execution, error handling, and testing.
 *
 * See: docs/REFACTORING_PLAN.md Phase 3
 */

import type { ResearchContext } from './context'

// =============================================================================
// PIPELINE STEP INTERFACE
// =============================================================================

/**
 * A single step in the research pipeline.
 *
 * Steps are composable units that:
 * - Take input and produce output
 * - Have access to the full ResearchContext
 * - Can be conditionally skipped
 * - Report their own execution time
 */
export interface PipelineStep<TInput = void, TOutput = void> {
  /** Human-readable name for logging */
  name: string

  /** Execute the step */
  execute(input: TInput, ctx: ResearchContext): Promise<TOutput>

  /** Optional: Check if step should be skipped */
  shouldSkip?(ctx: ResearchContext): boolean

  /** Optional: Reason for skipping (for logging) */
  skipReason?(ctx: ResearchContext): string
}

/**
 * Result of executing a pipeline step.
 */
export interface StepResult<T> {
  /** The output data */
  data: T
  /** Whether the step was skipped */
  skipped: boolean
  /** Reason for skipping (if skipped) */
  skipReason?: string
  /** Execution time in milliseconds */
  durationMs: number
}

// =============================================================================
// STEP EXECUTION HELPERS
// =============================================================================

/**
 * Execute a pipeline step with timing and skip handling.
 */
export async function executeStep<TInput, TOutput>(
  step: PipelineStep<TInput, TOutput>,
  input: TInput,
  ctx: ResearchContext
): Promise<StepResult<TOutput | null>> {
  // Check if step should be skipped
  if (step.shouldSkip?.(ctx)) {
    const reason = step.skipReason?.(ctx) || 'Condition not met'
    console.log(`[${step.name}] SKIPPED: ${reason}`)
    return {
      data: null,
      skipped: true,
      skipReason: reason,
      durationMs: 0,
    }
  }

  // Execute with timing
  const start = performance.now()
  console.log(`[${step.name}] Starting...`)

  try {
    const data = await step.execute(input, ctx)
    const durationMs = performance.now() - start

    console.log(`[${step.name}] Completed in ${durationMs.toFixed(0)}ms`)

    return {
      data,
      skipped: false,
      durationMs,
    }
  } catch (error) {
    const durationMs = performance.now() - start
    console.error(`[${step.name}] Failed after ${durationMs.toFixed(0)}ms:`, error)
    throw error
  }
}

// =============================================================================
// COMMON STEP INPUT/OUTPUT TYPES
// =============================================================================

/**
 * Input for keyword extraction step.
 */
export interface KeywordExtractionInput {
  hypothesis: string
  structuredHypothesis?: {
    audience?: string
    problem?: string
  }
}

/**
 * Output from keyword extraction step.
 */
export interface KeywordExtractionOutput {
  primary: string[]
  secondary: string[]
  exclude: string[]
  searchContext: string
}

/**
 * Input for subreddit discovery step.
 */
export interface SubredditDiscoveryInput {
  searchContext: string
  hypothesis: string
}

/**
 * Output from subreddit discovery step.
 */
export interface SubredditDiscoveryOutput {
  subreddits: string[]
  subredditVelocities: Map<string, number>
  /** Relevance weights for each subreddit (0-1 scale) */
  subredditWeights: Map<string, number>
}

/**
 * Input for data fetching step.
 */
export interface DataFetchInput {
  subreddits: string[]
  keywords: KeywordExtractionOutput
  hypothesis: string
}

/**
 * Output from data fetching step (raw posts and comments).
 */
export interface DataFetchOutput {
  posts: import('@/lib/data-sources/types').RedditPost[]
  comments: import('@/lib/data-sources/types').RedditComment[]
  sources: string[]
  metadata: {
    source: string
    warning?: string
  }
}
