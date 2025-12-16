/**
 * Hacker News Data Source Adapter
 *
 * Uses the Algolia HN Search API (free, no auth required)
 * Great for tech/SaaS validation - same audience as PVRE target users
 *
 * API Docs: https://hn.algolia.com/api
 */

import {
  DataSourceAdapter,
  UnifiedSignal,
  SearchOptions,
  SamplePost,
  RedditPost,
  RedditComment,
} from '../types'

const HN_API_BASE = 'https://hn.algolia.com/api/v1'

// Stop words to filter out for keyword extraction
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
  'want', 'help', 'app', 'tool', 'platform', 'using', 'use', 'make',
])

// Pain-signal words that indicate real problems (prioritize these in search)
const PAIN_WORDS = new Set([
  'burnout', 'struggle', 'problem', 'issue', 'frustrated', 'frustrating',
  'difficult', 'challenging', 'overwhelmed', 'stressed', 'anxiety', 'stuck',
  'failing', 'failed', 'broken', 'pain', 'hate', 'terrible', 'awful',
  'confused', 'lost', 'tired', 'exhausted', 'overworked', 'chaos', 'mess',
])

// HN Algolia API response types
interface HNHit {
  objectID: string
  title?: string
  story_text?: string  // For Ask HN / self posts
  url?: string
  author: string
  points: number
  num_comments: number
  created_at_i: number  // Unix timestamp
  story_id?: number
  parent_id?: number
  comment_text?: string  // For comments
  _tags?: string[]
}

interface HNSearchResponse {
  hits: HNHit[]
  nbHits: number
  page: number
  nbPages: number
  hitsPerPage: number
}

/**
 * Hacker News adapter implementing the unified DataSourceAdapter interface
 */
export class HackerNewsAdapter implements DataSourceAdapter {
  source = 'hacker_news' as const
  name = 'Hacker News'

  /**
   * Search HN for content matching the query
   * Returns unified signals for the orchestrator
   */
  async search(query: string, options?: SearchOptions): Promise<UnifiedSignal[]> {
    const searchTerms = this.extractSearchTerms(query)
    if (!searchTerms) return []

    const limit = options?.maxResults || 100
    const tagFilter = 'story' // Includes Ask HN, Show HN

    const url = `${HN_API_BASE}/search?query=${encodeURIComponent(searchTerms)}&tags=${tagFilter}&hitsPerPage=${Math.min(limit, 1000)}`

    try {
      const response = await fetch(url)
      if (!response.ok) {
        console.error(`[HackerNewsAdapter] API error: ${response.status}`)
        return []
      }

      const data: HNSearchResponse = await response.json()
      return data.hits.map(hit => this.toUnifiedSignal(hit))
    } catch (error) {
      console.error('[HackerNewsAdapter] Search failed:', error)
      return []
    }
  }

  /**
   * Get comments for a specific HN story
   */
  async getComments(storyId: string): Promise<UnifiedSignal[]> {
    try {
      const response = await fetch(`${HN_API_BASE}/items/${storyId}`)
      if (!response.ok) return []

      const data = await response.json()
      // HN items endpoint returns nested children
      return this.flattenComments(data.children || [])
    } catch {
      return []
    }
  }

  /**
   * Health check for the HN Algolia API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${HN_API_BASE}/search?query=test&hitsPerPage=1`, {
        signal: AbortSignal.timeout(5000),
      })
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Get estimated post count for a hypothesis
   */
  async getPostCount(hypothesis: string): Promise<number> {
    const searchTerms = this.extractSearchTerms(hypothesis)
    if (!searchTerms) return 0

    try {
      const response = await fetch(
        `${HN_API_BASE}/search?query=${encodeURIComponent(searchTerms)}&tags=story&hitsPerPage=0`
      )
      if (!response.ok) return 0

      const data: HNSearchResponse = await response.json()
      return data.nbHits
    } catch {
      return 0
    }
  }

  /**
   * Get sample posts for preview
   */
  async getSamplePosts(hypothesis: string, limit: number = 5): Promise<SamplePost[]> {
    const searchTerms = this.extractSearchTerms(hypothesis)
    if (!searchTerms) return []

    try {
      const response = await fetch(
        `${HN_API_BASE}/search?query=${encodeURIComponent(searchTerms)}&tags=story&hitsPerPage=${limit}`
      )
      if (!response.ok) return []

      const data: HNSearchResponse = await response.json()
      return data.hits.slice(0, limit).map(hit => ({
        title: hit.title || '',
        subreddit: 'hackernews',
        score: hit.points || 0,
        permalink: `https://news.ycombinator.com/item?id=${hit.objectID}`,
      }))
    } catch {
      return []
    }
  }

  // ===========================================================================
  // LEGACY METHODS (for backward compatibility with existing code)
  // These return RedditPost/RedditComment format for the existing pipeline
  // ===========================================================================

  /**
   * Legacy: Search HN stories returning RedditPost format
   */
  async searchStoriesLegacy(
    keywords: string[],
    options: { limit?: number; tags?: string[] } = {}
  ): Promise<RedditPost[]> {
    const { limit = 100, tags = ['story'] } = options
    const query = keywords.join(' ')
    const tagFilter = tags.join(',')

    const url = `${HN_API_BASE}/search?query=${encodeURIComponent(query)}&tags=${tagFilter}&hitsPerPage=${Math.min(limit, 1000)}`

    try {
      const response = await fetch(url)
      if (!response.ok) return []

      const data: HNSearchResponse = await response.json()
      return data.hits.map(hit => this.toRedditPost(hit))
    } catch {
      return []
    }
  }

  /**
   * Legacy: Search Ask HN posts
   */
  async searchAskHNLegacy(keywords: string[], limit: number = 50): Promise<RedditPost[]> {
    return this.searchStoriesLegacy(keywords, { limit, tags: ['ask_hn'] })
  }

  /**
   * Legacy: Search HN comments returning RedditComment format
   */
  async searchCommentsLegacy(keywords: string[], limit: number = 100): Promise<RedditComment[]> {
    const query = keywords.join(' ')
    const url = `${HN_API_BASE}/search?query=${encodeURIComponent(query)}&tags=comment&hitsPerPage=${Math.min(limit, 1000)}`

    try {
      const response = await fetch(url)
      if (!response.ok) return []

      const data: HNSearchResponse = await response.json()
      return data.hits
        .filter(hit => hit.comment_text)
        .map(hit => this.toRedditComment(hit))
    } catch {
      return []
    }
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Extract key search terms from hypothesis for HN search
   *
   * IMPORTANT: HN's Algolia uses AND logic for multi-word queries.
   * We need to balance specificity (relevant results) with breadth (enough results).
   *
   * Strategy:
   * 1. For domain-specific hypotheses (tech, startup), use the main topic keyword
   * 2. For general hypotheses, use 2-3 core words to get relevant results
   * 3. Avoid stop words but keep meaningful context words
   */
  private extractSearchTerms(hypothesis: string): string {
    const words = hypothesis
      .toLowerCase()
      .replace(/[^\w\s'-]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !STOP_WORDS.has(w))

    // Domain-specific words that work well on HN (tech-savvy audience)
    const domainKeywords = new Set([
      // Work & productivity
      'freelance', 'freelancer', 'startup', 'saas', 'developer', 'designer',
      'remote', 'productivity', 'automation', 'workflow', 'invoice', 'invoicing',
      'calendar', 'scheduling', 'email', 'hiring', 'recruiting', 'management',
      'analytics', 'dashboard', 'reporting', 'integration', 'api',
      // Health & wellness
      'fitness', 'health', 'meditation', 'sleep', 'tracking', 'tracker',
      // Habits & self-improvement (common HN topics)
      'habits', 'habit', 'procrastination', 'motivation', 'discipline', 'focus',
      'learning', 'reading', 'writing', 'journaling', 'goals', 'routine',
      // Finance & business
      'budget', 'investing', 'savings', 'finance', 'taxes', 'accounting',
      'pricing', 'subscription', 'revenue', 'customers', 'marketing',
      // Technical
      'database', 'security', 'privacy', 'encryption', 'performance',
      'testing', 'deployment', 'infrastructure', 'monitoring',
      // Real estate / housing (HN discusses these)
      'housing', 'rent', 'rental', 'apartment', 'student', 'university', 'college',
      'landlord', 'tenant', 'roommate', 'real-estate', 'mortgage',
    ])

    const domainWords = words.filter(w => domainKeywords.has(w) || PAIN_WORDS.has(w))

    // If we found domain words, use up to 2 most relevant ones
    if (domainWords.length >= 2) {
      return domainWords.slice(0, 2).join(' ')
    }
    if (domainWords.length === 1) {
      // Add one more context word if available
      const contextWord = words.find(w => !domainKeywords.has(w) && !PAIN_WORDS.has(w))
      if (contextWord) {
        return `${domainWords[0]} ${contextWord}`
      }
      return domainWords[0]
    }

    // Fallback: use first 2 meaningful words to maintain relevance
    // This is better than using 1 random word which gives irrelevant results
    if (words.length >= 2) {
      return words.slice(0, 2).join(' ')
    }
    return words[0] || ''
  }

  private toUnifiedSignal(hit: HNHit): UnifiedSignal {
    const isAskHN = hit._tags?.includes('ask_hn')
    const isShowHN = hit._tags?.includes('show_hn')

    let community = 'hackernews'
    if (isAskHN) community = 'AskHN'
    else if (isShowHN) community = 'ShowHN'

    return {
      id: `hn_${hit.objectID}`,
      source: 'hacker_news',
      sourceType: 'discussion',
      title: hit.title || '',
      body: hit.story_text || '',
      url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`,
      author: hit.author || 'unknown',
      community,
      createdAt: new Date(hit.created_at_i * 1000),
      engagementScore: this.calculateEngagement(hit),
      rawEngagement: {
        points: hit.points,
        comments: hit.num_comments,
      },
    }
  }

  private toRedditPost(hit: HNHit): RedditPost {
    const isAskHN = hit._tags?.includes('ask_hn')
    const isShowHN = hit._tags?.includes('show_hn')

    let category = 'hackernews'
    if (isAskHN) category = 'AskHN'
    else if (isShowHN) category = 'ShowHN'

    return {
      id: hit.objectID,
      title: hit.title || '',
      body: hit.story_text || '',
      author: hit.author || 'unknown',
      subreddit: category,
      score: hit.points || 0,
      numComments: hit.num_comments || 0,
      createdUtc: hit.created_at_i,
      permalink: `https://news.ycombinator.com/item?id=${hit.objectID}`,
      url: hit.url,
    }
  }

  private toRedditComment(hit: HNHit): RedditComment {
    return {
      id: hit.objectID,
      body: hit.comment_text || '',
      author: hit.author || 'unknown',
      subreddit: 'hackernews',
      score: hit.points || 0,
      createdUtc: hit.created_at_i,
      parentId: hit.parent_id?.toString() || '',
      postId: hit.story_id?.toString() || '',
      permalink: `https://news.ycombinator.com/item?id=${hit.objectID}`,
    }
  }

  private flattenComments(children: HNHit[], acc: UnifiedSignal[] = []): UnifiedSignal[] {
    for (const child of children) {
      if (child.comment_text) {
        acc.push({
          id: `hn_${child.objectID}`,
          source: 'hacker_news',
          sourceType: 'comment',
          title: '',
          body: child.comment_text,
          url: `https://news.ycombinator.com/item?id=${child.objectID}`,
          author: child.author || 'unknown',
          community: 'hackernews',
          createdAt: new Date(child.created_at_i * 1000),
          engagementScore: Math.min(100, (child.points || 0) / 2),
          rawEngagement: { points: child.points },
        })
      }
      // Recursively flatten nested comments
      if ((child as any).children) {
        this.flattenComments((child as any).children, acc)
      }
    }
    return acc
  }

  private calculateEngagement(hit: HNHit): number {
    // Normalize to 0-100 based on HN typical ranges
    const points = hit.points || 0
    const comments = hit.num_comments || 0
    return Math.min(100, (points + comments * 2) / 5)
  }
}

// Export singleton instance for convenience
export const hackerNewsAdapter = new HackerNewsAdapter()
