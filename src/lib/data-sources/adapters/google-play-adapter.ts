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
} from '../types'

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
}

// Export singleton instance
export const googlePlayAdapter = new GooglePlayAdapter()
