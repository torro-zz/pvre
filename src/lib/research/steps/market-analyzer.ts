/**
 * Market Analyzer Step - Market sizing and timing analysis
 *
 * This step performs:
 * - Market sizing analysis (TAM/SAM/SOM calculations)
 * - Timing analysis (Google Trends, competition timing)
 *
 * Both analyses are optional and non-blocking - failures don't stop the pipeline.
 *
 * USAGE:
 *   const result = await marketAnalyzerStep.execute(input, ctx)
 *   // result.marketSizing = { score, tam, sam, som, ... } or undefined
 *   // result.timing = { score, trends, ... } or undefined
 *
 * See: docs/REFACTORING_PLAN.md Phase 4
 */

import type { PipelineStep } from '@/lib/research/pipeline'
import type { ResearchContext } from '@/lib/research/pipeline'
import { isAppGapMode, getAppData } from '@/lib/research/pipeline'
import {
  calculateMarketSize,
  type MarketSizingResult,
} from '@/lib/analysis/market-sizing'
import {
  analyzeTiming,
  type TimingResult,
} from '@/lib/analysis/timing-analyzer'
import type { TargetGeography } from '@/types/research'

// =============================================================================
// INPUT/OUTPUT TYPES
// =============================================================================

export interface MarketAnalyzerInput {
  /** Original hypothesis for context */
  hypothesis: string
  /** Target geography for market scoping */
  targetGeography?: TargetGeography
  /** Monthly Spending Capacity target */
  mscTarget?: number
  /** Target price point */
  targetPrice?: number
}

export interface MarketAnalyzerOutput {
  /** Market sizing result (optional - may fail) */
  marketSizing?: MarketSizingResult
  /** Timing analysis result (optional - may fail) */
  timing?: TimingResult
}

// =============================================================================
// STEP IMPLEMENTATION
// =============================================================================

/**
 * Market Analyzer Step
 *
 * Runs market sizing and timing analysis in parallel.
 * Both are optional - failures are logged but don't block the pipeline.
 */
export const marketAnalyzerStep: PipelineStep<MarketAnalyzerInput, MarketAnalyzerOutput> = {
  name: 'Market Analyzer',

  async execute(input, ctx): Promise<MarketAnalyzerOutput> {
    const { hypothesis, targetGeography, mscTarget, targetPrice } = input

    console.log(`  Running market sizing and timing analysis`)

    // Run both analyses in parallel (both are optional, non-blocking)
    const [marketSizing, timing] = await Promise.all([
      // Market sizing
      (async (): Promise<MarketSizingResult | undefined> => {
        try {
          const result = await calculateMarketSize({
            hypothesis,
            geography: targetGeography?.location || 'Global',
            geographyScope: targetGeography?.scope || 'global',
            mscTarget,
            targetPrice,
          })
          console.log(`  Market sizing complete - Score: ${result.score}/10`)
          return result
        } catch (error) {
          console.error(`  Market sizing failed (non-blocking):`, error)
          return undefined
        }
      })(),

      // Timing analysis
      (async (): Promise<TimingResult | undefined> => {
        try {
          const appData = getAppData(ctx)
          const result = await analyzeTiming({
            hypothesis,
            appName: appData?.name, // App Gap mode: include app name for Google Trends
          })
          console.log(`  Timing analysis complete - Score: ${result.score}/10`)
          return result
        } catch (error) {
          console.error(`  Timing analysis failed (non-blocking):`, error)
          return undefined
        }
      })(),
    ])

    return {
      marketSizing,
      timing,
    }
  },
}

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

export type { MarketSizingResult, TimingResult }
