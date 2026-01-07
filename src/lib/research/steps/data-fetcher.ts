/**
 * Data Fetcher Step - Fetch data from all configured sources
 *
 * This step orchestrates data fetching from:
 * - Reddit (via Arctic Shift)
 * - Hacker News (optional)
 * - App Store reviews (for selected apps or App Gap mode)
 * - Google Play reviews (for selected apps or App Gap mode)
 * - Cross-store lookup (App Gap mode only)
 *
 * USAGE:
 *   const result = await dataFetcherStep.execute(input, ctx)
 *   // result.posts = [...all posts from all sources]
 *   // result.comments = [...all comments]
 *   // result.sources = ['Reddit', 'App Store', ...]
 *
 * See: docs/REFACTORING_PLAN.md Phase 3
 */

import type {
  PipelineStep,
  DataFetchInput,
  DataFetchOutput,
} from '@/lib/research/pipeline'
import type { ResearchContext } from '@/lib/research/pipeline'
import { isAppGapMode, getAppData } from '@/lib/research/pipeline'
import {
  fetchMultiSourceData,
  shouldIncludeHN,
  type RedditPost,
  type RedditComment,
} from '@/lib/data-sources'
import { googlePlayAdapter } from '@/lib/data-sources/adapters/google-play-adapter'
import { appStoreAdapter } from '@/lib/data-sources/adapters/app-store-adapter'
import { findAndFetchCrossStoreReviews } from './cross-store-lookup'
import type { AppDetails } from '@/lib/data-sources/types'

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Default sample size per source */
const DEFAULT_SAMPLE_SIZE = 300

/** Default review limit for app-specific fetching */
const APP_REVIEW_LIMIT = 500

// =============================================================================
// EXTENDED INPUT/OUTPUT TYPES
// =============================================================================

export interface DataFetcherInput extends DataFetchInput {
  /** User-selected data sources (if any) */
  selectedDataSources?: string[]
  /** User-selected apps for review fetching */
  selectedApps?: AppDetails[]
  /** Sample size per source (user-selected depth) */
  sampleSizePerSource?: number
  /** Subreddit posting velocities for adaptive fetching */
  subredditVelocities?: Map<string, number>
}

export interface DataFetcherOutput extends DataFetchOutput {
  /** Cross-store app data if found */
  crossStoreAppData?: AppDetails
  /** Subreddit weights (for later use) */
  subredditWeights?: Map<string, number>
}

// =============================================================================
// STEP IMPLEMENTATION
// =============================================================================

/**
 * Data Fetcher Step
 *
 * Fetches data from all configured sources based on research mode:
 * - Hypothesis mode: Reddit + optional HN + optional app stores
 * - App Gap mode: App store reviews only (skips Reddit)
 */
export const dataFetcherStep: PipelineStep<DataFetcherInput, DataFetcherOutput> = {
  name: 'Data Fetcher',

  async execute(input, ctx): Promise<DataFetcherOutput> {
    const {
      subreddits,
      keywords,
      hypothesis,
      selectedDataSources,
      selectedApps,
      sampleSizePerSource = DEFAULT_SAMPLE_SIZE,
      subredditVelocities,
    } = input

    let posts: RedditPost[] = []
    let comments: RedditComment[] = []
    const sources: string[] = []
    let crossStoreAppData: AppDetails | undefined

    // =========================================================================
    // APP GAP MODE: Fetch app store reviews only
    // =========================================================================
    if (isAppGapMode(ctx)) {
      const appData = getAppData(ctx)
      console.log(`  [Data Fetcher] App Gap mode - fetching reviews for: ${appData.name}`)

      // Fetch primary app reviews
      const primaryReviews = await fetchAppReviews(appData)
      if (primaryReviews.length > 0) {
        posts = [...posts, ...primaryReviews]
        sources.push(appData.store === 'app_store' ? 'App Store' : 'Google Play')
        console.log(`  Added ${primaryReviews.length} reviews from ${appData.store}`)
      }

      // Cross-store lookup
      try {
        const crossStoreResult = await findAndFetchCrossStoreReviews(appData)
        if (crossStoreResult.matchedApp) {
          crossStoreAppData = crossStoreResult.matchedApp
          if (crossStoreResult.reviews.length > 0) {
            posts = [...posts, ...crossStoreResult.reviews]
            sources.push(crossStoreResult.matchedApp.store === 'app_store' ? 'App Store' : 'Google Play')
            console.log(`  Added ${crossStoreResult.reviews.length} cross-store reviews`)
          }
        }
      } catch (error) {
        console.warn(`  Cross-store lookup failed (non-blocking):`, error)
      }

      return {
        posts,
        comments: [],
        sources,
        crossStoreAppData,
        metadata: {
          source: sources.join(' + ') || 'App Store',
        },
      }
    }

    // =========================================================================
    // HYPOTHESIS MODE: Fetch from Reddit + optional sources
    // =========================================================================
    console.log(`  [Data Fetcher] Hypothesis mode - fetching from ${subreddits.length} subreddits`)

    // Determine which sources to include
    const includesHN = selectedDataSources
      ? selectedDataSources.includes('Hacker News')
      : shouldIncludeHN(hypothesis)

    const hasSelectedApps = selectedApps && selectedApps.length > 0
    const includesGooglePlay = hasSelectedApps ? false : (selectedDataSources?.includes('Google Play') ?? false)
    const includesAppStore = hasSelectedApps ? false : (selectedDataSources?.includes('App Store') ?? false)

    // Fetch from Reddit + HN
    if (subreddits.length > 0) {
      const multiSourceData = await fetchMultiSourceData({
        subreddits,
        keywords: keywords.primary,
        limit: sampleSizePerSource,
        subredditVelocities,
      }, hypothesis, includesHN, includesGooglePlay, includesAppStore)

      posts = multiSourceData.posts
      comments = multiSourceData.comments
      sources.push(...multiSourceData.sources)

      console.log(`  Fetched ${posts.length} posts, ${comments.length} comments from ${sources.join(' + ')}`)
    }

    // Fetch reviews for selected apps
    if (hasSelectedApps) {
      const reviewsPerApp = Math.ceil(100 / selectedApps!.length)

      for (const app of selectedApps!) {
        try {
          const appReviews = await fetchAppReviews(app, reviewsPerApp)
          if (appReviews.length > 0) {
            posts = [...posts, ...appReviews]
            if (!sources.includes(app.store === 'app_store' ? 'App Store' : 'Google Play')) {
              sources.push(app.store === 'app_store' ? 'App Store' : 'Google Play')
            }
            console.log(`  Added ${appReviews.length} reviews from ${app.name} (${app.store})`)
          }
        } catch (error) {
          console.warn(`  Failed to fetch reviews for ${app.name}:`, error)
        }
      }
    }

    return {
      posts,
      comments,
      sources,
      metadata: {
        source: sources.join(' + ') || 'Reddit',
      },
    }
  },
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Fetch reviews for a specific app.
 */
async function fetchAppReviews(
  app: AppDetails,
  limit: number = APP_REVIEW_LIMIT
): Promise<RedditPost[]> {
  if (app.store === 'google_play') {
    return googlePlayAdapter.getReviewsForAppId(app.appId, { limit })
  } else if (app.store === 'app_store') {
    return appStoreAdapter.getReviewsForAppId(app.appId, { limit })
  }
  return []
}

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

export { fetchAppReviews }
