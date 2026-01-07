/**
 * Subreddit Discovery Step - Discover relevant subreddits for research
 *
 * This step discovers which subreddits are most relevant to the hypothesis.
 * In App Gap mode, this step is skipped (app store reviews only).
 *
 * USAGE:
 *   const result = await subredditDiscoveryStep.execute(input, ctx)
 *   // result.subreddits = ['programming', 'webdev', ...]
 *
 * See: docs/REFACTORING_PLAN.md Phase 3
 */

import { discoverSubreddits } from '@/lib/reddit/subreddit-discovery'
import { getSubredditWeights } from '@/lib/analysis/subreddit-weights'
import type {
  PipelineStep,
  SubredditDiscoveryInput,
  SubredditDiscoveryOutput,
} from '@/lib/research/pipeline'
import type { ResearchContext } from '@/lib/research/pipeline'
import { isAppGapMode } from '@/lib/research/pipeline'

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Maximum subreddits to search */
const MAX_SUBREDDITS = 15

// =============================================================================
// STEP IMPLEMENTATION
// =============================================================================

/**
 * Subreddit Discovery Step
 *
 * Discovers relevant subreddits using Claude, or uses user-selected ones.
 * Skipped in App Gap mode (returns empty arrays).
 */
export const subredditDiscoveryStep: PipelineStep<SubredditDiscoveryInput, SubredditDiscoveryOutput> = {
  name: 'Subreddit Discovery',

  shouldSkip(ctx: ResearchContext): boolean {
    return isAppGapMode(ctx)
  },

  skipReason(_ctx: ResearchContext): string {
    return 'App Gap mode - using app store reviews only'
  },

  async execute(input, ctx): Promise<SubredditDiscoveryOutput> {
    const { searchContext, hypothesis } = input

    // Check for user-selected subreddits in context
    const userSelectedSubreddits = (ctx as { userSelectedSubreddits?: string[] }).userSelectedSubreddits

    let subreddits: string[]

    if (userSelectedSubreddits && userSelectedSubreddits.length > 0) {
      // User has selected specific subreddits from coverage preview
      console.log(`  Using ${userSelectedSubreddits.length} user-selected subreddits`)
      subreddits = userSelectedSubreddits.slice(0, MAX_SUBREDDITS)
    } else {
      // Discover using Claude
      console.log(`  Discovering subreddits for: "${searchContext.slice(0, 50)}..."`)
      const discoveryResult = await discoverSubreddits(searchContext)
      subreddits = discoveryResult.subreddits.slice(0, MAX_SUBREDDITS)
      console.log(`  Discovered ${subreddits.length} subreddits`)
    }

    if (subreddits.length === 0) {
      throw new Error('Could not identify relevant subreddits for this hypothesis')
    }

    console.log(`  Subreddits: ${subreddits.join(', ')}`)

    // Calculate subreddit relevance weights
    console.log('  Calculating subreddit relevance weights...')
    const subredditWeights = await getSubredditWeights(hypothesis, subreddits)
    console.log(`  Weights calculated for ${subredditWeights.size} subreddits`)

    // Note: subredditVelocities will be populated by data fetcher
    return {
      subreddits,
      subredditVelocities: new Map(),
    }
  },
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get empty result for App Gap mode.
 */
export function getEmptySubredditResult(): SubredditDiscoveryOutput {
  return {
    subreddits: [],
    subredditVelocities: new Map(),
  }
}
