/**
 * Cross-Store Lookup - Find the same app on the OTHER store
 *
 * In App Gap mode, if a user submits an App Store URL, we also want reviews
 * from Google Play (and vice versa). This module handles:
 * - Finding the matching app on the other store
 * - Fetching reviews from the matched app
 *
 * USAGE:
 *   const result = await findCrossStoreApp(appData)
 *   if (result.matchedApp) {
 *     const reviews = await fetchCrossStoreReviews(result.matchedApp)
 *   }
 *
 * See: docs/REFACTORING_PLAN.md Phase 2
 */

import type { AppDetails, RedditPost } from '@/lib/data-sources/types'
import { googlePlayAdapter } from '@/lib/data-sources/adapters/google-play-adapter'
import { appStoreAdapter } from '@/lib/data-sources/adapters/app-store-adapter'
import { extractCoreAppName } from '@/lib/research/gates/app-name-gate'

// =============================================================================
// TYPES
// =============================================================================

export type StoreType = 'app_store' | 'google_play'

export interface CrossStoreResult {
  /** The matched app on the other store, or null if not found */
  matchedApp: AppDetails | null
  /** Which store was searched */
  searchedStore: StoreType
  /** The core app name used for searching */
  coreAppName: string
  /** Number of results returned from search */
  searchResultCount: number
}

export interface CrossStoreReviewsResult {
  /** Reviews fetched from the cross-store app */
  reviews: RedditPost[]
  /** The store they came from */
  store: StoreType
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Minimum review count to consider a match valid (avoids clones/fakes) */
const MIN_REVIEW_COUNT = 1000

/** Maximum apps to search for */
const MAX_SEARCH_RESULTS = 5

/** Default review limit when fetching */
const DEFAULT_REVIEW_LIMIT = 500

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Get the opposite store for cross-store lookup.
 */
export function getOtherStore(store: StoreType): StoreType {
  return store === 'google_play' ? 'app_store' : 'google_play'
}

/**
 * Find the matching app on the OTHER store.
 *
 * @param appData - The app details from the original store
 * @returns Result with matched app (or null) and metadata
 *
 * @example
 * const result = await findCrossStoreApp(appData)
 * if (result.matchedApp) {
 *   console.log(`Found ${result.matchedApp.name} on ${result.searchedStore}`)
 * }
 */
export async function findCrossStoreApp(appData: AppDetails): Promise<CrossStoreResult> {
  const coreAppName = extractCoreAppName(appData.name)
  const otherStore = getOtherStore(appData.store as StoreType)

  console.log(`[Cross-Store] Searching ${otherStore} for "${coreAppName}"...`)

  // Search the other store
  const otherAdapter = otherStore === 'app_store' ? appStoreAdapter : googlePlayAdapter
  const searchResults = await otherAdapter.searchAppsWithDetails(coreAppName, {
    maxApps: MAX_SEARCH_RESULTS,
  })

  // Find matching app: same core name + high review count (real app, not clone)
  const matchingApp = searchResults.apps.find(app => {
    const resultCoreName = extractCoreAppName(app.name)
    return resultCoreName === coreAppName && app.reviewCount > MIN_REVIEW_COUNT
  })

  if (matchingApp) {
    console.log(
      `[Cross-Store] Found: ${matchingApp.name} (${matchingApp.reviewCount} reviews)`
    )

    // Build full AppDetails from the search result
    const matchedAppDetails: AppDetails = {
      appId: matchingApp.appId,
      name: matchingApp.name,
      developer: matchingApp.developer,
      rating: matchingApp.rating,
      reviewCount: matchingApp.reviewCount,
      category: matchingApp.category,
      store: otherStore,
      url: matchingApp.url,
      iconUrl: matchingApp.iconUrl,
      price: matchingApp.price || 'Free',
      hasIAP: matchingApp.hasIAP || false,
      description: matchingApp.description || '',
      lastUpdated: matchingApp.lastUpdated,
    }

    return {
      matchedApp: matchedAppDetails,
      searchedStore: otherStore,
      coreAppName,
      searchResultCount: searchResults.apps.length,
    }
  }

  console.log(`[Cross-Store] No matching app found on ${otherStore} for "${coreAppName}"`)

  return {
    matchedApp: null,
    searchedStore: otherStore,
    coreAppName,
    searchResultCount: searchResults.apps.length,
  }
}

/**
 * Fetch reviews from a cross-store app.
 *
 * @param appData - The matched app details from findCrossStoreApp
 * @param limit - Maximum reviews to fetch (default: 500)
 * @returns Reviews from the cross-store app
 */
export async function fetchCrossStoreReviews(
  appData: AppDetails,
  limit: number = DEFAULT_REVIEW_LIMIT
): Promise<CrossStoreReviewsResult> {
  const store = appData.store as StoreType
  let reviews: RedditPost[] = []

  if (store === 'google_play') {
    reviews = await googlePlayAdapter.getReviewsForAppId(appData.appId, { limit })
  } else {
    reviews = await appStoreAdapter.getReviewsForAppId(appData.appId, { limit })
  }

  if (reviews.length > 0) {
    const storeLabel = store === 'google_play' ? 'Google Play' : 'App Store'
    console.log(`[Cross-Store] Fetched ${reviews.length} ${storeLabel} reviews`)
  }

  return {
    reviews,
    store,
  }
}

/**
 * Convenience function: Find and fetch cross-store reviews in one call.
 *
 * @param appData - The app details from the original store
 * @param reviewLimit - Maximum reviews to fetch (default: 500)
 * @returns Object with matchedApp, reviews, and metadata
 */
export async function findAndFetchCrossStoreReviews(
  appData: AppDetails,
  reviewLimit: number = DEFAULT_REVIEW_LIMIT
): Promise<{
  matchedApp: AppDetails | null
  reviews: RedditPost[]
  searchedStore: StoreType
  coreAppName: string
}> {
  const result = await findCrossStoreApp(appData)

  if (!result.matchedApp) {
    return {
      matchedApp: null,
      reviews: [],
      searchedStore: result.searchedStore,
      coreAppName: result.coreAppName,
    }
  }

  const reviewsResult = await fetchCrossStoreReviews(result.matchedApp, reviewLimit)

  return {
    matchedApp: result.matchedApp,
    reviews: reviewsResult.reviews,
    searchedStore: result.searchedStore,
    coreAppName: result.coreAppName,
  }
}
