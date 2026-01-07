/**
 * Research Pipeline Orchestrator
 *
 * Orchestrates the execution of research pipeline steps in sequence.
 * This is the main entry point for running research.
 *
 * USAGE:
 *   const ctx = createContext(jobId, userId, hypothesis, appData)
 *   const result = await runResearchPipeline(ctx)
 *
 * The orchestrator:
 * 1. Executes steps in dependency order
 * 2. Handles step skipping for mode-specific logic
 * 3. Provides logging and timing for each step
 * 4. Accumulates results for final compilation
 *
 * See: docs/REFACTORING_PLAN.md Phase 4
 */

import type { ResearchContext } from './context'
import type { StepResult } from './types'
import { executeStep } from './types'
import { isAppGapMode } from './context'
import {
  keywordExtractorStep,
  subredditDiscoveryStep,
  dataFetcherStep,
  painAnalyzerStep,
  type DataFetcherInput,
  type DataFetcherOutput,
  type PainAnalyzerOutput,
} from '@/lib/research/steps'
import type { KeywordExtractionOutput, SubredditDiscoveryOutput } from './types'

// =============================================================================
// PIPELINE RESULT TYPE
// =============================================================================

/**
 * Result accumulated across all pipeline steps.
 */
export interface PipelineAccumulator {
  // Step 1: Keywords
  keywords?: KeywordExtractionOutput
  searchContext?: string

  // Step 2: Subreddits
  subreddits?: string[]
  subredditVelocities?: Map<string, number>

  // Step 3: Data
  data?: DataFetcherOutput

  // Step 5: Pain Analysis
  painAnalysis?: PainAnalyzerOutput

  // Timing
  stepTimings: Map<string, number>
  totalDurationMs: number
}

// =============================================================================
// ORCHESTRATOR
// =============================================================================

/**
 * Run the research pipeline.
 *
 * Executes steps in order:
 * 1. Keyword Extractor
 * 2. Subreddit Discovery (skipped in App Gap mode)
 * 3. Data Fetcher
 * ... (filter, analysis steps to be added)
 *
 * @param ctx - Research context with mode, hypothesis, and configuration
 * @param options - Orchestration options
 * @returns Accumulated pipeline results
 */
export async function runResearchPipeline(
  ctx: ResearchContext,
  options: {
    /** External data to inject (e.g., user-selected subreddits) */
    userSelectedSubreddits?: string[]
    selectedDataSources?: string[]
    selectedApps?: unknown[]
    sampleSizePerSource?: number
    subredditVelocities?: Map<string, number>
    subredditWeights?: Map<string, number>
  } = {}
): Promise<PipelineAccumulator> {
  const startTime = performance.now()
  const stepTimings = new Map<string, number>()
  const accumulator: PipelineAccumulator = {
    stepTimings,
    totalDurationMs: 0,
  }

  console.log(`\n=== RESEARCH PIPELINE START ===`)
  console.log(`  Mode: ${ctx.mode}`)
  console.log(`  Hypothesis: "${ctx.hypothesis.slice(0, 60)}..."`)
  if (isAppGapMode(ctx)) {
    console.log(`  App: ${ctx.appData?.name} (${ctx.appData?.store})`)
  }
  console.log(``)

  // =========================================================================
  // Step 1: Keyword Extraction
  // =========================================================================
  const keywordResult = await executeStep(keywordExtractorStep, {
    hypothesis: ctx.hypothesis,
    structuredHypothesis: ctx.structuredHypothesis,
  }, ctx) as StepResult<KeywordExtractionOutput>

  if (keywordResult.data) {
    accumulator.keywords = keywordResult.data
    accumulator.searchContext = keywordResult.data.searchContext
  }
  stepTimings.set('Keyword Extractor', keywordResult.durationMs)

  // =========================================================================
  // Step 2: Subreddit Discovery (skipped in App Gap mode)
  // =========================================================================
  let subredditsResult: StepResult<SubredditDiscoveryOutput | null>

  if (options.userSelectedSubreddits && options.userSelectedSubreddits.length > 0) {
    // User has selected specific subreddits - skip discovery
    console.log(`[Subreddit Discovery] Using ${options.userSelectedSubreddits.length} user-selected subreddits`)
    accumulator.subreddits = options.userSelectedSubreddits
    accumulator.subredditVelocities = options.subredditVelocities || new Map()
    stepTimings.set('Subreddit Discovery', 0)
    subredditsResult = { data: null, skipped: true, skipReason: 'User-selected subreddits', durationMs: 0 }
  } else {
    // Discover subreddits using Claude
    subredditsResult = await executeStep(subredditDiscoveryStep, {
      searchContext: accumulator.searchContext || ctx.hypothesis,
      hypothesis: ctx.hypothesis,
    }, ctx)

    if (subredditsResult.data) {
      accumulator.subreddits = subredditsResult.data.subreddits
      accumulator.subredditVelocities = subredditsResult.data.subredditVelocities
    } else if (isAppGapMode(ctx)) {
      // App Gap mode - empty subreddits is expected
      accumulator.subreddits = []
      accumulator.subredditVelocities = new Map()
    }
    stepTimings.set('Subreddit Discovery', subredditsResult.durationMs)
  }

  // =========================================================================
  // Step 3: Data Fetching
  // =========================================================================
  const dataInput: DataFetcherInput = {
    subreddits: accumulator.subreddits || [],
    keywords: accumulator.keywords || { primary: [], secondary: [], exclude: [], searchContext: '' },
    hypothesis: ctx.hypothesis,
    selectedDataSources: options.selectedDataSources,
    selectedApps: options.selectedApps as DataFetcherInput['selectedApps'],
    sampleSizePerSource: options.sampleSizePerSource,
    subredditVelocities: accumulator.subredditVelocities || options.subredditVelocities,
  }

  const dataResult = await executeStep(dataFetcherStep, dataInput, ctx) as StepResult<DataFetcherOutput>

  if (dataResult.data) {
    accumulator.data = dataResult.data
    // Store cross-store app data in context for later use
    if (dataResult.data.crossStoreAppData) {
      ctx.crossStoreAppData = dataResult.data.crossStoreAppData
    }
  }
  stepTimings.set('Data Fetcher', dataResult.durationMs)

  // =========================================================================
  // Pipeline Complete (for now - filter and analysis steps to be added)
  // =========================================================================
  accumulator.totalDurationMs = performance.now() - startTime

  console.log(`\n=== RESEARCH PIPELINE COMPLETE ===`)
  console.log(`  Total time: ${accumulator.totalDurationMs.toFixed(0)}ms`)
  console.log(`  Posts fetched: ${accumulator.data?.posts.length || 0}`)
  console.log(`  Comments fetched: ${accumulator.data?.comments.length || 0}`)
  console.log(`  Sources: ${accumulator.data?.sources.join(', ') || 'none'}`)
  console.log(``)

  return accumulator
}

// =============================================================================
// STEP EXECUTION HELPERS
// =============================================================================

/**
 * Log step timings summary.
 */
export function logStepTimings(accumulator: PipelineAccumulator): void {
  console.log(`\n=== STEP TIMINGS ===`)
  for (const [step, duration] of accumulator.stepTimings) {
    console.log(`  ${step}: ${duration.toFixed(0)}ms`)
  }
  console.log(`  TOTAL: ${accumulator.totalDurationMs.toFixed(0)}ms`)
  console.log(``)
}
