/**
 * Google Play Store Data Source Adapter
 *
 * Uses google-play-scraper npm package (free, no auth required)
 * Great for mobile app validation - reviews contain real user pain points
 *
 * Package: https://www.npmjs.com/package/google-play-scraper
 */

import gplay from 'google-play-scraper'
import {
  DataSourceAdapter,
  UnifiedSignal,
  SearchOptions,
  SamplePost,
  RedditPost,
  AppDetails,
} from '../types'
import { extractAppId } from '../app-url-utils'

// Sort options (not typed in the package)
const SORT = {
  HELPFULNESS: 1,
  NEWEST: 2,
  RATING: 3,
} as const

// Stop words for keyword extraction (similar to HN adapter)
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

// App review response type from google-play-scraper
interface PlayReview {
  id: string
  userName: string
  date: string
  score: number
  text: string
  replyDate?: string
  replyText?: string
  thumbsUp: number
  url?: string
  criterias?: Array<{ criteria: string; rating: number }>
}

// App search result type
interface PlayApp {
  appId: string
  title: string
  summary?: string
  developer: string
  score: number
  scoreText?: string
  installs?: string
  reviews?: number
  icon?: string
  url: string
}

/**
 * Google Play adapter implementing the unified DataSourceAdapter interface
 */
export class GooglePlayAdapter implements DataSourceAdapter {
  source = 'google_play' as const
  name = 'Google Play'

  /**
   * Search Google Play for app reviews matching the query
   * Returns unified signals for the orchestrator
   */
  async search(query: string, options?: SearchOptions): Promise<UnifiedSignal[]> {
    const searchTerms = this.extractSearchTerms(query)
    if (!searchTerms) return []

    const maxResults = options?.maxResults || 100
    const reviewsPerApp = Math.min(50, Math.ceil(maxResults / 3)) // Get reviews from multiple apps

    try {
      // First, find relevant apps
      const apps = await gplay.search({
        term: searchTerms,
        num: 5, // Search top 5 apps
        lang: 'en',
        country: 'us',
      }) as PlayApp[]

      if (!apps || apps.length === 0) return []

      // Get reviews from each app in parallel
      const reviewPromises = apps.slice(0, 3).map(async (app) => {
        try {
          const reviews = await gplay.reviews({
            appId: app.appId,
            num: reviewsPerApp,
            lang: 'en',
            country: 'us',
            sort: SORT.HELPFULNESS,
          })
          return { app, reviews: reviews.data as PlayReview[] }
        } catch (error) {
          console.error(`[GooglePlayAdapter] Failed to get reviews for ${app.appId}:`, error)
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
      console.error('[GooglePlayAdapter] Search failed:', error)
      return []
    }
  }

  /**
   * Health check for Google Play scraper
   */
  async healthCheck(): Promise<boolean> {
    try {
      const results = await gplay.search({
        term: 'productivity',
        num: 1,
      })
      return Array.isArray(results) && results.length > 0
    } catch {
      return false
    }
  }

  /**
   * Get estimated review count for apps matching the query
   * Note: Search results don't include review counts, so we fetch full app details
   */
  async getPostCount(query: string): Promise<number> {
    const searchTerms = this.extractSearchTerms(query)
    if (!searchTerms) return 0

    try {
      const apps = await gplay.search({
        term: searchTerms,
        num: 5,
      }) as PlayApp[]

      if (!apps || apps.length === 0) return 0

      // Fetch full details for top 3 apps to get review counts
      const detailPromises = apps.slice(0, 3).map(async (app) => {
        try {
          const details = await gplay.app({ appId: app.appId })
          return details.reviews || 0
        } catch {
          return 0
        }
      })

      const reviewCounts = await Promise.all(detailPromises)
      return reviewCounts.reduce((sum, count) => sum + count, 0)
    } catch {
      return 0
    }
  }

  /**
   * Search for apps and return their details
   * Used by coverage check to show users which apps will be analyzed
   * Now fetches more apps (10-15) for LLM scoring to filter
   */
  async searchAppsWithDetails(query: string, options?: {
    maxApps?: number
    domainKeywords?: string[]
    competitorApps?: string[]
  }): Promise<{
    apps: AppDetails[]
    totalReviews: number
  }> {
    const { maxApps = 10, domainKeywords, competitorApps } = options || {}

    try {
      // Multi-query strategy: run multiple searches in parallel
      const searchQueries: string[] = []

      // Query 1: Original hypothesis-based search
      const primaryTerms = this.extractSearchTerms(query)
      if (primaryTerms) {
        searchQueries.push(primaryTerms)
      }

      // Query 2: Domain keywords (if provided)
      if (domainKeywords && domainKeywords.length > 0) {
        const domainQuery = domainKeywords.slice(0, 3).join(' ')
        if (domainQuery && !searchQueries.includes(domainQuery)) {
          searchQueries.push(domainQuery)
        }
      }

      // Query 3: Competitor app names (if provided)
      if (competitorApps && competitorApps.length > 0) {
        for (const competitor of competitorApps.slice(0, 2)) {
          if (competitor && !searchQueries.includes(competitor)) {
            searchQueries.push(competitor)
          }
        }
      }

      if (searchQueries.length === 0) {
        return { apps: [], totalReviews: 0 }
      }

      console.log(`[GooglePlayAdapter] Running ${searchQueries.length} search queries:`, searchQueries)

      // Run all searches in parallel
      const searchPromises = searchQueries.map(term =>
        gplay.search({
          term,
          num: 8, // Get more results per query
          lang: 'en',
          country: 'us',
        }).catch(err => {
          console.warn(`[GooglePlayAdapter] Search failed for "${term}":`, err)
          return []
        })
      )

      const searchResultsArrays = await Promise.all(searchPromises)

      // Merge and dedupe results by appId
      const seenAppIds = new Set<string>()
      const uniqueApps: PlayApp[] = []

      for (const results of searchResultsArrays) {
        for (const app of (results as PlayApp[])) {
          if (!seenAppIds.has(app.appId)) {
            seenAppIds.add(app.appId)
            uniqueApps.push(app)
          }
        }
      }

      console.log(`[GooglePlayAdapter] Found ${uniqueApps.length} unique apps from ${searchQueries.length} queries`)

      if (uniqueApps.length === 0) {
        return { apps: [], totalReviews: 0 }
      }

      // Get full details for top N apps (increased from 3 to maxApps)
      const appsToFetch = uniqueApps.slice(0, maxApps)
      const appDetailsPromises = appsToFetch.map(async (app) => {
        try {
          const details = await gplay.app({ appId: app.appId })
          return {
            appId: details.appId,
            store: 'google_play' as const,
            name: details.title,
            developer: details.developer,
            category: details.genre || details.genreId || 'Unknown',
            description: details.description || '',
            rating: details.score || 0,
            reviewCount: details.reviews || 0,
            price: details.free ? 'Free' : (details.priceText || 'Paid'),
            hasIAP: details.offersIAP || false,
            installs: details.installs || undefined,
            lastUpdated: String(details.updated || ''),
            iconUrl: details.icon || undefined,
            url: details.url || `https://play.google.com/store/apps/details?id=${app.appId}`,
          } as AppDetails
        } catch (error) {
          console.error(`[GooglePlayAdapter] Failed to get details for ${app.appId}:`, error)
          return null
        }
      })

      const appDetails = (await Promise.all(appDetailsPromises)).filter(
        (app): app is AppDetails => app !== null
      )

      const totalReviews = appDetails.reduce((sum, app) => sum + app.reviewCount, 0)

      return { apps: appDetails, totalReviews }
    } catch (error) {
      console.error('[GooglePlayAdapter] searchAppsWithDetails failed:', error)
      return { apps: [], totalReviews: 0 }
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
      if (appIdOrUrl.includes('play.google.com')) {
        const parsed = extractAppId(appIdOrUrl)
        if (!parsed || parsed.store !== 'google_play') {
          console.error('[GooglePlayAdapter] Invalid Google Play URL:', appIdOrUrl)
          return null
        }
        appId = parsed.appId
      }

      const details = await gplay.app({ appId })

      return {
        appId: details.appId,
        store: 'google_play' as const,
        name: details.title,
        developer: details.developer,
        category: details.genre || details.genreId || 'Unknown',
        description: details.description || '',
        rating: details.score || 0,
        reviewCount: details.reviews || 0,
        price: details.free ? 'Free' : (details.priceText || 'Paid'),
        hasIAP: details.offersIAP || false,
        installs: details.installs || undefined,
        lastUpdated: String(details.updated || ''),
        iconUrl: details.icon || undefined,
        url: details.url || `https://play.google.com/store/apps/details?id=${appId}`,
      }
    } catch (error) {
      console.error('[GooglePlayAdapter] getAppDetails failed:', error)
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
      const apps = await gplay.search({
        term: searchTerms,
        num: 3,
      }) as PlayApp[]

      if (!apps || apps.length === 0) return []

      // Get a few reviews from the top app
      const topApp = apps[0]
      const reviews = await gplay.reviews({
        appId: topApp.appId,
        num: limit,
        lang: 'en',
        country: 'us',
        sort: SORT.HELPFULNESS,
      })

      return (reviews.data as PlayReview[]).slice(0, limit).map(review => ({
        title: review.text.slice(0, 100) + (review.text.length > 100 ? '...' : ''),
        subreddit: topApp.title, // Use app name as "community"
        score: review.thumbsUp || 0,
        permalink: `https://play.google.com/store/apps/details?id=${topApp.appId}`,
      }))
    } catch {
      return []
    }
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Extract search terms from hypothesis for Google Play search
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
   * Convert Play review to unified signal format
   */
  private toUnifiedSignal(review: PlayReview, app: PlayApp): UnifiedSignal {
    return {
      id: `gplay_${review.id}`,
      source: 'google_play',
      sourceType: 'review',
      title: '', // Reviews don't have titles
      body: review.text,
      url: `https://play.google.com/store/apps/details?id=${app.appId}`,
      author: review.userName || 'Anonymous',
      community: app.title, // Use app name as community
      createdAt: new Date(review.date),
      engagementScore: this.calculateEngagement(review),
      rawEngagement: {
        rating: review.score,
        upvotes: review.thumbsUp,
      },
    }
  }

  /**
   * Calculate engagement score (0-100) from review data
   */
  private calculateEngagement(review: PlayReview): number {
    // Weight: thumbsUp + inverse of rating (lower ratings = more pain signal value)
    const thumbsUpScore = Math.min(50, review.thumbsUp * 5)
    const ratingScore = (5 - review.score) * 10 // 1-star = 40, 5-star = 0
    return Math.min(100, thumbsUpScore + ratingScore)
  }

  // ===========================================================================
  // APP-CENTRIC METHODS (for app analysis mode)
  // ===========================================================================

  /**
   * Fetch reviews for a specific app by ID
   * Used in app-centric analysis mode to get reviews for the exact app being analyzed
   */
  async getReviewsForAppId(
    appId: string,
    options: { limit?: number; sort?: 'helpfulness' | 'newest' | 'rating' } = {}
  ): Promise<RedditPost[]> {
    const { limit = 500, sort = 'helpfulness' } = options

    const sortMap = {
      helpfulness: SORT.HELPFULNESS,
      newest: SORT.NEWEST,
      rating: SORT.RATING,
    }

    try {
      // Fetch app details for the app name
      const appDetails = await gplay.app({ appId })
      const appName = appDetails.title || appId

      // Fetch reviews directly by app ID
      const reviewsResult = await gplay.reviews({
        appId,
        num: limit,
        lang: 'en',
        country: 'us',
        sort: sortMap[sort],
      })

      const reviews = reviewsResult.data as PlayReview[]
      console.log(`[GooglePlayAdapter] Fetched ${reviews.length} reviews for ${appName} (${appId})`)

      // Convert to RedditPost format for pipeline compatibility
      return reviews.map(review => ({
        id: `gplay_${review.id}`,
        title: review.text.slice(0, 100) + (review.text.length > 100 ? '...' : ''),
        body: review.text,
        author: review.userName || 'Anonymous',
        subreddit: 'google_play', // Source attribution for pain signals
        score: review.thumbsUp || 0,
        numComments: 0,
        createdUtc: Math.floor(new Date(review.date).getTime() / 1000),
        permalink: `https://play.google.com/store/apps/details?id=${appId}`,
        url: `https://play.google.com/store/apps/details?id=${appId}`,
        // Store rating in score for filtering (low ratings = more pain)
        rating: review.score,
      } as RedditPost & { rating?: number }))
    } catch (error) {
      console.error(`[GooglePlayAdapter] getReviewsForAppId failed for ${appId}:`, error)
      return []
    }
  }

  // ===========================================================================
  // LEGACY METHODS (for backward compatibility with existing pipeline)
  // Returns RedditPost format for the existing relevance filter and analyzers
  // ===========================================================================

  /**
   * Legacy: Search Google Play reviews returning RedditPost format
   * Note: App reviews don't have comments - only posts (reviews)
   */
  async searchReviewsLegacy(
    keywords: string[],
    options: { limit?: number } = {}
  ): Promise<RedditPost[]> {
    const { limit = 500 } = options
    const query = keywords.join(' ')

    try {
      const signals = await this.search(query, { maxResults: limit })
      return signals.map(signal => this.signalToRedditPost(signal))
    } catch (error) {
      console.error('[GooglePlayAdapter] searchReviewsLegacy failed:', error)
      return []
    }
  }

  /**
   * Convert UnifiedSignal to RedditPost format for legacy pipeline
   */
  private signalToRedditPost(signal: UnifiedSignal): RedditPost {
    return {
      id: signal.id,
      title: signal.body.slice(0, 100) + (signal.body.length > 100 ? '...' : ''),
      body: signal.body,
      author: signal.author,
      subreddit: 'google_play', // Source attribution for pain signals
      score: signal.rawEngagement.upvotes || 0,
      numComments: 0, // Reviews don't have comments
      createdUtc: Math.floor(signal.createdAt.getTime() / 1000),
      permalink: signal.url,
      url: signal.url,
    }
  }
}

// Export singleton instance
export const googlePlayAdapter = new GooglePlayAdapter()
