/**
 * Trustpilot Data Source Adapter
 *
 * Fetches business reviews from Trustpilot for B2B/SaaS validation.
 * Great for understanding customer pain points with existing solutions.
 *
 * Architecture:
 * - Uses simple HTTP requests (no Puppeteer!)
 * - Extracts data from __NEXT_DATA__ JSON embedded in HTML
 * - Works on serverless platforms (Vercel, AWS Lambda)
 */

import {
  DataSourceAdapter,
  UnifiedSignal,
  SearchOptions,
  SamplePost,
  RedditPost,
  RedditComment,
} from '../types'

interface TrustpilotReview {
  id: string
  text: string
  title: string
  rating: number
  dates: {
    publishedDate: string
    experiencedDate?: string
  }
  consumer: {
    displayName: string
    displayLocation?: string
  }
  likes: number
  language: string
  location?: string
}

interface TrustpilotBusiness {
  businessUnitId: string
  displayName: string
  identifyingName: string
  stars: number
  trustScore: number
  numberOfReviews: number
  logoUrl?: string
  location?: {
    country?: string
    city?: string
  }
  categories?: Array<{
    categoryId: string
    displayName: string
  }>
  contact?: {
    website?: string
  }
}

interface TrustpilotSearchResponse {
  businessUnits: TrustpilotBusiness[]
  hasMore: boolean
  pagination?: {
    totalResults: number
  }
}

interface TrustpilotReviewPageResponse {
  businessUnit: {
    displayName: string
    identifyingName: string
    numberOfReviews: number
    trustScore: number
  }
  reviews: TrustpilotReview[]
}

// Stop words for search term extraction
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
  'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its', 'people',
  'want', 'help', 'app', 'tool', 'platform', 'using', 'use', 'make', 'service',
])

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/**
 * Extract __NEXT_DATA__ JSON from Trustpilot HTML page
 */
function extractNextData<T>(html: string): T | null {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/)
  if (!match) return null

  try {
    const data = JSON.parse(match[1])
    return data.props?.pageProps as T
  } catch {
    return null
  }
}

/**
 * Trustpilot adapter implementing the unified DataSourceAdapter interface
 * Uses simple HTTP requests - no Puppeteer required!
 */
export class TrustpilotAdapter implements DataSourceAdapter {
  source = 'trustpilot' as const
  name = 'Trustpilot'

  /**
   * Search Trustpilot for businesses and their reviews
   */
  async search(query: string, options?: SearchOptions): Promise<UnifiedSignal[]> {
    const searchTerms = this.extractSearchTerms(query)
    if (!searchTerms) return []

    const limit = options?.maxResults || 50

    try {
      // Step 1: Find relevant businesses via search
      const businesses = await this.searchBusinesses(searchTerms, 5)
      if (businesses.length === 0) {
        console.log('[TrustpilotAdapter] No businesses found for:', searchTerms)
        return []
      }

      // Step 2: Fetch reviews from top businesses (prioritize by review count)
      const sortedBusinesses = businesses
        .filter(b => b.numberOfReviews >= 5)
        .sort((a, b) => b.numberOfReviews - a.numberOfReviews)
        .slice(0, 3) // Top 3 businesses

      if (sortedBusinesses.length === 0) {
        console.log('[TrustpilotAdapter] No businesses with enough reviews')
        return []
      }

      const reviewsPerBusiness = Math.ceil(limit / sortedBusinesses.length)
      const allSignals: UnifiedSignal[] = []

      for (const business of sortedBusinesses) {
        try {
          const reviews = await this.fetchReviews(business, reviewsPerBusiness)
          allSignals.push(...reviews)
        } catch (error) {
          console.error(`[TrustpilotAdapter] Failed to fetch reviews for ${business.displayName}:`, error)
        }
      }

      return allSignals.slice(0, limit)
    } catch (error) {
      console.error('[TrustpilotAdapter] Search failed:', error)
      return []
    }
  }

  /**
   * Health check - verify Trustpilot is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch('https://www.trustpilot.com/search?query=test', {
        signal: controller.signal,
        headers: { 'User-Agent': USER_AGENT },
      })

      clearTimeout(timeoutId)
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Get estimated review count for a hypothesis
   */
  async getPostCount(hypothesis: string): Promise<number> {
    const searchTerms = this.extractSearchTerms(hypothesis)
    if (!searchTerms) return 0

    try {
      const businesses = await this.searchBusinesses(searchTerms, 10)
      return businesses.reduce((sum, b) => sum + b.numberOfReviews, 0)
    } catch {
      return 0
    }
  }

  /**
   * Get sample reviews for preview
   */
  async getSamplePosts(hypothesis: string, limit: number = 5): Promise<SamplePost[]> {
    const searchTerms = this.extractSearchTerms(hypothesis)
    if (!searchTerms) return []

    try {
      const businesses = await this.searchBusinesses(searchTerms, limit)
      return businesses.slice(0, limit).map(b => ({
        title: `${b.displayName} (${b.numberOfReviews} reviews, ${b.trustScore}★)`,
        subreddit: 'trustpilot',
        score: Math.round(b.trustScore * 20), // Normalize to 0-100
        permalink: `https://www.trustpilot.com/review/${b.identifyingName}`,
      }))
    } catch {
      return []
    }
  }

  // ===========================================================================
  // LEGACY METHODS (for backward compatibility)
  // ===========================================================================

  /**
   * Legacy: Search Trustpilot returning RedditPost format
   */
  async searchReviewsLegacy(
    keywords: string[],
    options: { limit?: number } = {}
  ): Promise<RedditPost[]> {
    const { limit = 50 } = options
    const query = keywords.join(' ')

    try {
      const signals = await this.search(query, { maxResults: limit })
      return signals.map(s => this.toRedditPost(s))
    } catch {
      return []
    }
  }

  /**
   * Legacy: Get reviews as comments format
   */
  async searchCommentsLegacy(keywords: string[], limit: number = 100): Promise<RedditComment[]> {
    const query = keywords.join(' ')

    try {
      const signals = await this.search(query, { maxResults: limit })
      return signals.map(s => this.toRedditComment(s))
    } catch {
      return []
    }
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Search for businesses on Trustpilot via HTTP
   */
  private async searchBusinesses(query: string, limit: number = 5): Promise<TrustpilotBusiness[]> {
    try {
      const searchUrl = `https://www.trustpilot.com/search?query=${encodeURIComponent(query)}`

      const response = await fetch(searchUrl, {
        headers: { 'User-Agent': USER_AGENT },
      })

      if (!response.ok) {
        console.error('[TrustpilotAdapter] Search request failed:', response.status)
        return []
      }

      const html = await response.text()
      const pageData = extractNextData<TrustpilotSearchResponse>(html)

      if (!pageData?.businessUnits) {
        console.log('[TrustpilotAdapter] No business units in response')
        return []
      }

      return pageData.businessUnits.slice(0, limit)
    } catch (error) {
      console.error('[TrustpilotAdapter] Business search failed:', error)
      return []
    }
  }

  /**
   * Fetch reviews for a specific business via HTTP
   */
  private async fetchReviews(business: TrustpilotBusiness, limit: number): Promise<UnifiedSignal[]> {
    try {
      // Fetch the review page
      const reviewUrl = `https://www.trustpilot.com/review/${business.identifyingName}`

      const response = await fetch(reviewUrl, {
        headers: { 'User-Agent': USER_AGENT },
      })

      if (!response.ok) {
        console.error(`[TrustpilotAdapter] Review page failed for ${business.identifyingName}:`, response.status)
        return []
      }

      const html = await response.text()
      const pageData = extractNextData<TrustpilotReviewPageResponse>(html)

      if (!pageData?.reviews) {
        console.log(`[TrustpilotAdapter] No reviews in response for ${business.displayName}`)
        return []
      }

      // Convert reviews to UnifiedSignal format
      return pageData.reviews
        .slice(0, limit)
        .map(review => this.toUnifiedSignal(review, business))
    } catch (error) {
      console.error(`[TrustpilotAdapter] Review fetch failed for ${business.displayName}:`, error)
      return []
    }
  }

  /**
   * Extract search terms from hypothesis
   */
  private extractSearchTerms(hypothesis: string): string {
    const words = hypothesis
      .toLowerCase()
      .replace(/[^\w\s'-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !STOP_WORDS.has(w))

    // Domain-specific words for Trustpilot (B2B, services, SaaS)
    const domainKeywords = new Set([
      'software', 'crm', 'erp', 'saas', 'accounting', 'payroll', 'invoicing',
      'booking', 'scheduling', 'marketing', 'email', 'hosting', 'cloud',
      'insurance', 'banking', 'finance', 'legal', 'consulting', 'agency',
      'delivery', 'shipping', 'logistics', 'ecommerce', 'retail',
      'telecom', 'internet', 'provider', 'subscription', 'membership',
    ])

    const domainWords = words.filter(w => domainKeywords.has(w))

    if (domainWords.length >= 1) {
      return domainWords.slice(0, 2).join(' ')
    }

    // Use first 2-3 meaningful words
    return words.slice(0, 3).join(' ')
  }

  /**
   * Convert Trustpilot review to UnifiedSignal
   */
  private toUnifiedSignal(review: TrustpilotReview, business: TrustpilotBusiness): UnifiedSignal {
    const createdAt = new Date(review.dates.publishedDate)

    return {
      id: `tp_${review.id}`,
      source: 'trustpilot',
      sourceType: 'review',
      title: review.title || '',
      body: review.text || '',
      url: `https://www.trustpilot.com/reviews/${review.id}`,
      author: review.consumer?.displayName || 'Anonymous',
      community: business.displayName,
      createdAt,
      engagementScore: this.calculateEngagement(review),
      rawEngagement: {
        rating: review.rating,
        upvotes: review.likes || 0,
      },
    }
  }

  /**
   * Convert to legacy RedditPost format
   */
  private toRedditPost(signal: UnifiedSignal): RedditPost {
    return {
      id: signal.id,
      title: signal.title,
      body: signal.body,
      author: signal.author,
      subreddit: 'trustpilot',
      score: Math.round(signal.engagementScore),
      numComments: 0,
      createdUtc: Math.floor(signal.createdAt.getTime() / 1000),
      permalink: signal.url,
      url: signal.url,
    }
  }

  /**
   * Convert to legacy RedditComment format
   */
  private toRedditComment(signal: UnifiedSignal): RedditComment {
    return {
      id: signal.id,
      body: `${signal.title}\n\n${signal.body}`,
      author: signal.author,
      subreddit: 'trustpilot',
      score: Math.round(signal.engagementScore),
      createdUtc: Math.floor(signal.createdAt.getTime() / 1000),
      parentId: '',
      postId: signal.community,
      permalink: signal.url,
    }
  }

  /**
   * Calculate engagement score from review
   * Low ratings = higher pain signal value for research
   */
  private calculateEngagement(review: TrustpilotReview): number {
    // Inverse rating weight: 1-star = 80pts, 5-star = 0pts
    // This prioritizes negative reviews which show pain points
    const ratingScore = (5 - review.rating) * 20
    // Add bonus for reviews that got likes (engagement)
    const likesBonus = Math.min(20, (review.likes || 0) * 2)
    return Math.min(100, Math.max(0, ratingScore + likesBonus))
  }
}

// Export singleton instance
export const trustpilotAdapter = new TrustpilotAdapter()
