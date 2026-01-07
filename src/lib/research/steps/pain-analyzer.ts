/**
 * Pain Analyzer Step - Extract and analyze pain signals from posts
 *
 * This step analyzes filtered posts and comments to extract:
 * - Pain signals with tier awareness (CORE vs RELATED)
 * - Pain summary statistics
 * - Subreddit weight application
 *
 * USAGE:
 *   const result = await painAnalyzerStep.execute(input, ctx)
 *   // result.painSignals = [...all extracted pain signals]
 *   // result.painSummary = { totalSignals, avgIntensity, ... }
 *
 * See: docs/REFACTORING_PLAN.md Phase 3
 */

import type { PipelineStep } from '@/lib/research/pipeline'
import type { ResearchContext } from '@/lib/research/pipeline'
import { isAppGapMode } from '@/lib/research/pipeline'
import {
  analyzePosts,
  analyzeComments,
  combinePainSignals,
  getPainSummary,
  filterPraiseSignals,
  type PainSignal,
  type PainSummary,
} from '@/lib/analysis/pain-detector'
import { applySubredditWeights } from '@/lib/analysis/subreddit-weights'
import type { RedditPost, RedditComment } from '@/lib/data-sources/types'

// =============================================================================
// INPUT/OUTPUT TYPES
// =============================================================================

export interface PainAnalyzerInput {
  /** Posts classified as CORE (high confidence match) */
  corePosts: RedditPost[]
  /** Posts classified as RELATED (broader context match) */
  relatedPosts: RedditPost[]
  /** Comments that passed relevance filtering */
  comments: RedditComment[]
  /** Subreddit weights for signal scoring */
  subredditWeights: Map<string, number>
}

export interface PainAnalyzerOutput {
  /** All extracted pain signals */
  painSignals: PainSignal[]
  /** Summary statistics */
  painSummary: PainSummary
  /** Original post counts for metrics */
  postCounts: {
    core: number
    related: number
    comments: number
  }
}

// =============================================================================
// STEP IMPLEMENTATION
// =============================================================================

/**
 * Pain Analyzer Step
 *
 * Extracts pain signals from filtered posts and comments.
 * Applies tier awareness, subreddit weights, and praise filtering.
 */
export const painAnalyzerStep: PipelineStep<PainAnalyzerInput, PainAnalyzerOutput> = {
  name: 'Pain Analyzer',

  async execute(input, ctx): Promise<PainAnalyzerOutput> {
    const { corePosts, relatedPosts, comments, subredditWeights } = input

    console.log(`  Analyzing: ${corePosts.length} core posts, ${relatedPosts.length} related, ${comments.length} comments`)

    // =========================================================================
    // Step 1: Extract pain signals with tier awareness
    // =========================================================================
    const corePostSignals = analyzePosts(corePosts).map(s => ({
      ...s,
      tier: 'CORE' as const,
    }))

    const relatedPostSignals = analyzePosts(relatedPosts).map(s => ({
      ...s,
      tier: 'RELATED' as const,
    }))

    const postSignals = [...corePostSignals, ...relatedPostSignals]
    const commentSignals = analyzeComments(comments)
    let allPainSignals = combinePainSignals(postSignals, commentSignals)

    console.log(`  Found ${allPainSignals.length} pain signals before filtering`)

    // =========================================================================
    // Step 2: Apply subreddit weights
    // =========================================================================
    if (subredditWeights.size > 0) {
      applySubredditWeights(allPainSignals, subredditWeights)
      console.log(`  Applied weights from ${subredditWeights.size} subreddits`)
    }

    // =========================================================================
    // Step 3: Filter pure praise from app store reviews (App Gap mode only)
    // =========================================================================
    if (isAppGapMode(ctx)) {
      const appStoreSignals = allPainSignals.filter(
        s => s.source.subreddit === 'google_play' || s.source.subreddit === 'app_store'
      )

      if (appStoreSignals.length > 0) {
        console.log(`  Filtering pure praise from ${appStoreSignals.length} app store signals`)
        try {
          const filteredAppStoreSignals = await filterPraiseSignals(appStoreSignals)
          const removedCount = appStoreSignals.length - filteredAppStoreSignals.length
          console.log(`  Removed ${removedCount} pure praise signals`)

          // Keep non-app-store signals + filtered app store signals
          const nonAppStoreSignals = allPainSignals.filter(
            s => s.source.subreddit !== 'google_play' && s.source.subreddit !== 'app_store'
          )
          allPainSignals = [...nonAppStoreSignals, ...filteredAppStoreSignals]
        } catch (error) {
          console.error(`  Praise filter failed (non-blocking):`, error)
        }
      }
    }

    // =========================================================================
    // Step 4: Get pain summary statistics
    // =========================================================================
    const painSummary = getPainSummary(allPainSignals)

    console.log(`  Final: ${allPainSignals.length} signals, avg score: ${painSummary.averageScore.toFixed(1)}`)

    return {
      painSignals: allPainSignals,
      painSummary,
      postCounts: {
        core: corePosts.length,
        related: relatedPosts.length,
        comments: comments.length,
      },
    }
  },
}

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

export type { PainSignal, PainSummary }
