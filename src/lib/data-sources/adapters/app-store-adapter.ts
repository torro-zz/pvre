/**
 * Apple App Store Data Source Adapter
 *
 * Uses app-store-scraper npm package (free, no auth required)
 * Complements Google Play for complete mobile app validation
 *
 * Package: https://www.npmjs.com/package/app-store-scraper
 */

import store from 'app-store-scraper'
import {
  DataSourceAdapter,
  UnifiedSignal,
  SearchOptions,
  SamplePost,
  RedditPost,
  AppDetails,
} from '../types'
import { extractAppId } from '../app-url-utils'

// Sort options (string values for App Store)
const SORT = {
  HELPFUL: 'mostHelpful',
  RECENT: 'mostRecent',
} as const

// Stop words for keyword extraction
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'to', 'of',
  'in', 'for', 'on', 'with', 'at', 'by', 'from', 'up', 'about', 'into',
  'over', 'after', 'that', 'this', 'what', 'which', 'who', 'how', 'when',
  'where', 'why', 'and', 'or', 'but', 'if', 'because', 'as', 'until',
  'while', 'so', 'than', 'too', 'very', 'just', 'also', 'now', 'here',
  'there', 'then', 'only', 'own', 'same', 'both', 'each', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'any', 'all',
  'their', 'they', 'them', 'these', 'those', 'i', 'me', 'my', 'we', 'our',
  'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its', 'app',
  'apps', 'application', 'download', 'downloaded', 'install', 'installed',
])

// App Store review type
interface AppStoreReview {
  id: string
  userName: string
  date: string
  score: number
  title: string
  text: string
  url?: string
  version?: string
}

// App Store search result type
interface AppStoreApp {
  id: number
  appId: string
  title: string
  description?: string
  developer: string
  score: number
  reviews?: number
  icon?: string
  url: string
}

/**
 * App Store adapter implementing the unified DataSourceAdapter interface
 */
export class AppStoreAdapter implements DataSourceAdapter {
  source = 'app_store' as const
  name = 'App Store'

  /**
   * Search App Store for app reviews matching the query
   * Returns unified signals for the orchestrator
   */
  async search(query: string, options?: SearchOptions): Promise<UnifiedSignal[]> {
    const searchTerms = this.extractSearchTerms(query)
    if (!searchTerms) return []

    const maxResults = options?.maxResults || 100
    const reviewsPerApp = Math.min(50, Math.ceil(maxResults / 3))

    try {
      // First, find relevant apps
      const apps = await store.search({
        term: searchTerms,
        num: 5,
        country: 'us',
      }) as AppStoreApp[]

      if (!apps || apps.length === 0) return []

      // Get reviews from each app in parallel
      const reviewPromises = apps.slice(0, 3).map(async (app) => {
        try {
          const reviews = await store.reviews({
            id: app.id,
            page: 1,
            country: 'us',
            sort: SORT.HELPFUL,
          }) as AppStoreReview[]
          return { app, reviews: reviews.slice(0, reviewsPerApp) }
        } catch (error) {
          console.error(`[AppStoreAdapter] Failed to get reviews for ${app.appId}:`, error)
          return { app, reviews: [] }
        }
      })

      const results = await Promise.all(reviewPromises)

      // Convert to unified signals
      const signals: UnifiedSignal[] = []
      for (const { app, reviews } of results) {
        for (const review of reviews) {
          signals.push(this.toUnifiedSignal(review, app))
        }
      }

      return signals.slice(0, maxResults)
    } catch (error) {
      console.error('[AppStoreAdapter] Search failed:', error)
      return []
    }
  }

  /**
   * Health check for App Store scraper
   */
  async healthCheck(): Promise<boolean> {
    try {
      const results = await store.search({
        term: 'productivity',
        num: 1,
        country: 'us',
      })
      return Array.isArray(results) && results.length > 0
    } catch {
      return false
    }
  }

  /**
   * Get estimated review count for apps matching the query
   */
  async getPostCount(query: string): Promise<number> {
    const searchTerms = this.extractSearchTerms(query)
    if (!searchTerms) return 0

    try {
      const apps = await store.search({
        term: searchTerms,
        num: 5,
        country: 'us',
      }) as AppStoreApp[]

      if (!apps || apps.length === 0) return 0

      // Sum up review counts from top apps
      return apps.reduce((sum, app) => sum + (app.reviews || 0), 0)
    } catch {
      return 0
    }
  }

  /**
   * Get full app details from app ID or URL
   * Used for App-Centric Analysis Mode
   */
  async getAppDetails(appIdOrUrl: string): Promise<AppDetails | null> {
    try {
      // Extract app ID if URL is provided
      let appId = appIdOrUrl
      let market = 'us'

      if (appIdOrUrl.includes('apps.apple.com') || appIdOrUrl.includes('itunes.apple.com')) {
        const parsed = extractAppId(appIdOrUrl)
        if (!parsed || parsed.store !== 'app_store') {
          console.error('[AppStoreAdapter] Invalid App Store URL:', appIdOrUrl)
          return null
        }
        appId = parsed.appId
        market = parsed.market || 'us'
      }

      const details = await store.app({ id: appId, country: market })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const appDetails = details as any

      return {
        appId: String(appDetails.id),
        store: 'app_store' as const,
        name: appDetails.title,
        developer: appDetails.developer,
        category: appDetails.primaryGenre || appDetails.genres?.[0] || 'Unknown',
        description: appDetails.description || '',
        rating: appDetails.score || 0,
        reviewCount: appDetails.reviews || 0,
        price: appDetails.free ? 'Free' : (appDetails.price ? `$${appDetails.price}` : 'Paid'),
        hasIAP: appDetails.offersIAP || false,
        lastUpdated: appDetails.updated || appDetails.currentVersionReleaseDate || '',
        iconUrl: appDetails.icon || undefined,
        url: appDetails.url || `https://apps.apple.com/${market}/app/app/id${appId}`,
      }
    } catch (error) {
      console.error('[AppStoreAdapter] getAppDetails failed:', error)
      return null
    }
  }

  /**
   * Get sample reviews for preview
   */
  async getSamplePosts(query: string, limit: number = 5): Promise<SamplePost[]> {
    const searchTerms = this.extractSearchTerms(query)
    if (!searchTerms) return []

    try {
      // Find relevant apps
      const apps = await store.search({
        term: searchTerms,
        num: 3,
        country: 'us',
      }) as AppStoreApp[]

      if (!apps || apps.length === 0) return []

      // Get a few reviews from the top app
      const topApp = apps[0]
      const reviews = await store.reviews({
        id: topApp.id,
        page: 1,
        country: 'us',
        sort: SORT.HELPFUL,
      }) as AppStoreReview[]

      return reviews.slice(0, limit).map(review => ({
        title: review.title || review.text.slice(0, 100) + (review.text.length > 100 ? '...' : ''),
        subreddit: topApp.title, // Use app name as "community"
        score: 0, // App Store reviews don't have upvotes
        permalink: topApp.url,
      }))
    } catch {
      return []
    }
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Extract search terms from hypothesis for App Store search
   */
  private extractSearchTerms(hypothesis: string): string {
    const words = hypothesis
      .toLowerCase()
      .replace(/[^\w\s'-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w))

    // Return first 3 meaningful words
    return words.slice(0, 3).join(' ')
  }

  /**
   * Convert App Store review to unified signal format
   */
  private toUnifiedSignal(review: AppStoreReview, app: AppStoreApp): UnifiedSignal {
    return {
      id: `appstore_${review.id}`,
      source: 'app_store',
      sourceType: 'review',
      title: review.title || '',
      body: review.text,
      url: app.url,
      author: review.userName || 'Anonymous',
      community: app.title, // Use app name as community
      createdAt: new Date(review.date),
      engagementScore: this.calculateEngagement(review),
      rawEngagement: {
        rating: review.score,
      },
    }
  }

  /**
   * Calculate engagement score (0-100) from review data
   * App Store reviews don't have upvotes, so we use rating as signal
   */
  private calculateEngagement(review: AppStoreReview): number {
    // Lower ratings = more pain signal value for validation
    return (5 - review.score) * 20 // 1-star = 80, 5-star = 0
  }

  // ===========================================================================
  // LEGACY METHODS (for backward compatibility with existing pipeline)
  // Returns RedditPost format for the existing relevance filter and analyzers
  // ===========================================================================

  /**
   * Legacy: Search App Store reviews returning RedditPost format
   * Note: App reviews don't have comments - only posts (reviews)
   */
  async searchReviewsLegacy(
    keywords: string[],
    options: { limit?: number } = {}
  ): Promise<RedditPost[]> {
    const { limit = 100 } = options
    const query = keywords.join(' ')

    try {
      const signals = await this.search(query, { maxResults: limit })
      return signals.map(signal => this.signalToRedditPost(signal))
    } catch (error) {
      console.error('[AppStoreAdapter] searchReviewsLegacy failed:', error)
      return []
    }
  }

  /**
   * Convert UnifiedSignal to RedditPost format for legacy pipeline
   */
  private signalToRedditPost(signal: UnifiedSignal): RedditPost {
    return {
      id: signal.id,
      title: signal.title || signal.body.slice(0, 100) + (signal.body.length > 100 ? '...' : ''),
      body: signal.body,
      author: signal.author,
      subreddit: 'app_store', // Source attribution for pain signals
      score: 0, // App Store reviews don't have upvotes
      numComments: 0, // Reviews don't have comments
      createdUtc: Math.floor(signal.createdAt.getTime() / 1000),
      permalink: signal.url,
      url: signal.url,
    }
  }
}

// Export singleton instance
export const appStoreAdapter = new AppStoreAdapter()
