/**
 * Reddit Data Source Adapter
 *
 * Implements the unified DataSourceAdapter interface for Reddit data.
 * Uses Arctic Shift API as the primary source with PullPush fallback.
 *
 * This adapter bridges the new unified interface with the existing
 * Reddit-specific data fetching logic.
 */

import {
  DataSourceAdapter,
  UnifiedSignal,
  SearchOptions,
  SamplePost,
  RedditPost,
  RedditComment,
  SearchParams,
  DataSource,
  PostStats,
} from '../types'
import {
  searchPosts as arcticSearchPosts,
  searchComments as arcticSearchComments,
} from '../../arctic-shift/client'
import {
  RedditPost as ArcticPost,
  RedditComment as ArcticComment,
} from '../../arctic-shift/types'
import { getCachedData, setCachedData, generateCacheKey } from '../cache'

const ARCTIC_SHIFT_BASE = 'https://arctic-shift.photon-reddit.com'

// In-memory cache for coverage stats (short-lived, per-process)
// Key: subreddit name, Value: { stats, fetchedAt }
const statsCache = new Map<string, { stats: PostStats; fetchedAt: number }>()
const STATS_CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes
const HEALTH_CHECK_TIMEOUT = 5000

/**
 * Reddit adapter implementing the unified DataSourceAdapter interface
 */
export class RedditAdapter implements DataSourceAdapter {
  source = 'reddit' as const
  name = 'Reddit (Arctic Shift)'

  /**
   * Search Reddit for content matching the query
   * Returns unified signals for the orchestrator
   */
  async search(query: string, options?: SearchOptions): Promise<UnifiedSignal[]> {
    // For Reddit, we need subreddits - extract from query or use defaults
    // This is a simplified implementation; real usage goes through the orchestrator
    // which handles subreddit discovery separately
    const posts = await this.searchPostsLegacy({
      subreddits: [], // Will be populated by orchestrator
      keywords: query ? [query] : undefined,
      limit: options?.maxResults || 100,
      timeRange: options?.dateRange ? {
        after: options.dateRange.start,
        before: options.dateRange.end,
      } : undefined,
    })

    return posts.map(post => this.toUnifiedSignal(post))
  }

  /**
   * Health check for the Arctic Shift API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT)

      const response = await fetch(`${ARCTIC_SHIFT_BASE}/api/posts/search?limit=1`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })

      clearTimeout(timeoutId)
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Get estimated post count for a subreddit
   */
  async getPostCount(subreddit: string): Promise<number> {
    try {
      const posts = await arcticSearchPosts({
        subreddit,
        limit: 100,
        sort: 'desc',
      })
      return posts.length
    } catch {
      return 0
    }
  }

  /**
   * Get post count AND posting velocity for adaptive time-stratified fetching
   * Velocity is calculated from the timestamp spread of sample posts
   * Results are cached to avoid redundant API calls
   */
  async getPostStats(subreddit: string): Promise<PostStats> {
    // 1. Check in-memory cache first (fastest)
    const cachedEntry = statsCache.get(subreddit.toLowerCase())
    if (cachedEntry && Date.now() - cachedEntry.fetchedAt < STATS_CACHE_TTL_MS) {
      console.log(`[RedditAdapter] Cache HIT (memory) for r/${subreddit}`)
      return cachedEntry.stats
    }

    // 2. Check Supabase cache for existing posts
    const cacheKey = generateCacheKey([subreddit], [], undefined)
    const supabaseCache = await getCachedData(cacheKey)

    if (supabaseCache && supabaseCache.posts.length > 0 && !supabaseCache.isExpired) {
      console.log(`[RedditAdapter] Cache HIT (supabase) for r/${subreddit} - ${supabaseCache.posts.length} posts`)
      const stats = this.calculateStatsFromPosts(supabaseCache.posts, subreddit)
      // Update in-memory cache
      statsCache.set(subreddit.toLowerCase(), { stats, fetchedAt: Date.now() })
      return stats
    }

    // 3. Fetch fresh data from API
    try {
      const posts = await arcticSearchPosts({
        subreddit,
        limit: 100,
        sort: 'desc', // Newest first
      })

      const stats = this.calculateStatsFromPosts(posts, subreddit)

      // Cache in memory
      statsCache.set(subreddit.toLowerCase(), { stats, fetchedAt: Date.now() })

      // Cache in Supabase for persistence across requests
      if (posts.length > 0) {
        await setCachedData(cacheKey, {
          posts: posts.map(p => ({
            id: p.id,
            title: p.title,
            body: p.selftext || '',
            author: p.author,
            subreddit: p.subreddit,
            score: p.score,
            numComments: p.num_comments,
            createdUtc: p.created_utc,
            permalink: p.permalink,
            url: p.url,
          })),
          subreddits: [subreddit],
        })
      }

      console.log(`[RedditAdapter] Fresh fetch for r/${subreddit}: ${posts.length} posts`)
      return stats
    } catch {
      return { count: 0, postsPerDay: 1 } // Default to medium activity on error
    }
  }

  /**
   * Calculate stats from an array of posts
   */
  private calculateStatsFromPosts(posts: Array<{ created_utc?: number; createdUtc?: number }>, subreddit: string): PostStats {
    if (posts.length < 2) {
      return { count: posts.length, postsPerDay: 0.5 }
    }

    // Calculate posting velocity from timestamp spread
    const timestamps = posts.map(p => p.created_utc ?? p.createdUtc ?? 0).sort((a, b) => b - a)
    const newestTimestamp = timestamps[0]
    const oldestTimestamp = timestamps[timestamps.length - 1]

    // Calculate days spanned (minimum 1 day to avoid division issues)
    const secondsSpanned = newestTimestamp - oldestTimestamp
    const daysSpanned = Math.max(secondsSpanned / 86400, 1)

    // Posts per day = count / days
    const postsPerDay = posts.length / daysSpanned

    console.log(`[RedditAdapter] r/${subreddit}: ${posts.length} posts over ${daysSpanned.toFixed(1)} days = ${postsPerDay.toFixed(1)} posts/day`)

    return { count: posts.length, postsPerDay }
  }

  /**
   * Get sample posts for preview (uses cache when available)
   */
  async getSamplePosts(subreddit: string, limit: number = 3): Promise<SamplePost[]> {
    try {
      // Check Supabase cache first
      const cacheKey = generateCacheKey([subreddit], [], undefined)
      const cached = await getCachedData(cacheKey)

      if (cached && cached.posts.length > 0 && !cached.isExpired) {
        console.log(`[RedditAdapter] Sample posts cache HIT for r/${subreddit}`)
        return cached.posts.slice(0, limit).map(p => ({
          title: p.title,
          subreddit: p.subreddit,
          score: p.score,
          permalink: p.permalink || `https://reddit.com/r/${p.subreddit}/comments/${p.id}`,
        }))
      }

      // Fetch fresh if not cached
      const posts = await arcticSearchPosts({
        subreddit,
        limit: Math.min(limit, 10),
        sort: 'desc',
      })

      return posts.slice(0, limit).map(p => ({
        title: p.title,
        subreddit: p.subreddit,
        score: p.score,
        permalink: p.permalink,
      }))
    } catch {
      return []
    }
  }

  // ===========================================================================
  // LEGACY METHODS (for backward compatibility with existing code)
  // These maintain the RedditPost/RedditComment format used by relevance filter
  // ===========================================================================

  /**
   * Legacy method: Search posts returning RedditPost format
   * Used by existing relevance filter and analysis pipeline
   */
  async searchPostsLegacy(params: SearchParams): Promise<RedditPost[]> {
    const { subreddits, limit = 100, timeRange } = params
    const allPosts: RedditPost[] = []

    for (const subreddit of subreddits) {
      try {
        const posts = await arcticSearchPosts({
          subreddit,
          limit: limit === 'auto' ? 'auto' : Math.min(limit as number, 100),
          after: timeRange?.after ? this.formatDate(timeRange.after) : undefined,
          before: timeRange?.before ? this.formatDate(timeRange.before) : undefined,
          sort: 'desc',
        })

        allPosts.push(...posts.map(p => this.normalizePost(p)))
      } catch (error) {
        console.warn(`[RedditAdapter] Failed to fetch posts from r/${subreddit}:`, error)
      }
    }

    return allPosts
  }

  /**
   * Legacy method: Search comments returning RedditComment format
   */
  async searchCommentsLegacy(params: SearchParams): Promise<RedditComment[]> {
    const { subreddits, limit = 100, timeRange } = params
    const allComments: RedditComment[] = []

    for (const subreddit of subreddits) {
      try {
        const comments = await arcticSearchComments({
          subreddit,
          limit: limit === 'auto' ? 'auto' : Math.min(limit as number, 100),
          after: timeRange?.after ? this.formatDate(timeRange.after) : undefined,
          before: timeRange?.before ? this.formatDate(timeRange.before) : undefined,
          sort: 'desc',
        })

        allComments.push(...comments.map(c => this.normalizeComment(c)))
      } catch (error) {
        console.warn(`[RedditAdapter] Failed to fetch comments from r/${subreddit}:`, error)
      }
    }

    return allComments
  }

  /**
   * Legacy method: Get sample posts with keyword filtering (uses cache when available)
   */
  async getSamplePostsWithKeywords(
    subreddit: string,
    limit: number = 3,
    keywords?: string[]
  ): Promise<SamplePost[]> {
    try {
      const fetchLimit = keywords && keywords.length > 0 ? 100 : Math.min(limit, 10)

      // Check Supabase cache first
      const cacheKey = generateCacheKey([subreddit], [], undefined)
      const cached = await getCachedData(cacheKey)

      let posts: ArcticPost[]

      if (cached && cached.posts.length >= fetchLimit && !cached.isExpired) {
        console.log(`[RedditAdapter] getSamplePostsWithKeywords cache HIT for r/${subreddit}`)
        // Convert cached posts to ArcticPost format for filtering
        posts = cached.posts.map(p => ({
          id: p.id,
          title: p.title,
          selftext: p.body,
          author: p.author,
          subreddit: p.subreddit,
          score: p.score,
          num_comments: p.numComments,
          created_utc: p.createdUtc,
          permalink: p.permalink,
          url: p.url,
        })) as unknown as ArcticPost[]
      } else {
        // Fetch fresh
        posts = await arcticSearchPosts({
          subreddit,
          limit: fetchLimit,
          sort: 'desc',
        })
      }

      let filteredPosts = posts

      if (keywords && keywords.length > 0) {
        const keywordLower = keywords.map(k => k.toLowerCase())
        const allKeywordWords = keywordLower.flatMap(k => k.split(/\s+/))
        const topicWords = allKeywordWords.filter(w =>
          w.length > 3 &&
          !['getting', 'without', 'about', 'from', 'with', 'that', 'this', 'keep', 'keeps', 'best', 'product'].includes(w)
        )
        const uniqueTopicWords = [...new Set(topicWords)]

        const scoredPosts = posts.map(post => {
          const titleLower = post.title.toLowerCase()
          const bodyLower = (post.selftext || '').toLowerCase()
          const combined = titleLower + ' ' + bodyLower

          let score = 0
          for (const keyword of keywordLower) {
            if (combined.includes(keyword)) score += 10
          }
          for (const word of uniqueTopicWords) {
            if (titleLower.includes(word)) score += 3
            else if (bodyLower.includes(word)) score += 1
          }

          const matchedWords = uniqueTopicWords.filter(w => combined.includes(w))
          if (matchedWords.length >= 3) score += 5

          return { post, score, matchedWords: matchedWords.length }
        })

        filteredPosts = scoredPosts
          .filter(sp => sp.score > 0 && sp.matchedWords >= 2)
          .sort((a, b) => b.score - a.score)
          .map(sp => sp.post)

        if (filteredPosts.length === 0) {
          filteredPosts = scoredPosts
            .filter(sp => sp.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(sp => sp.post)
        }
      }

      return filteredPosts.slice(0, limit).map(p => ({
        title: p.title,
        subreddit: p.subreddit,
        score: p.score,
        permalink: p.permalink,
      }))
    } catch {
      return []
    }
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  private toUnifiedSignal(post: RedditPost): UnifiedSignal {
    return {
      id: `reddit_${post.id}`,
      source: 'reddit',
      sourceType: 'discussion',
      title: post.title,
      body: post.body,
      url: post.permalink.startsWith('http')
        ? post.permalink
        : `https://reddit.com${post.permalink}`,
      author: post.author,
      community: post.subreddit,
      createdAt: new Date(post.createdUtc * 1000),
      engagementScore: this.calculateEngagement(post),
      rawEngagement: {
        upvotes: post.score,
        comments: post.numComments,
      },
    }
  }

  private calculateEngagement(post: RedditPost): number {
    // Normalize to 0-100 based on typical Reddit ranges
    const score = post.score || 0
    const comments = post.numComments || 0
    return Math.min(100, (score + comments * 2) / 10)
  }

  private normalizePost(raw: ArcticPost): RedditPost {
    return {
      id: raw.id,
      title: raw.title,
      body: raw.selftext || '',
      author: raw.author,
      subreddit: raw.subreddit,
      score: raw.score,
      numComments: raw.num_comments,
      createdUtc: raw.created_utc,
      permalink: raw.permalink,
      url: raw.url,
    }
  }

  private normalizeComment(raw: ArcticComment): RedditComment {
    return {
      id: raw.id,
      body: raw.body,
      author: raw.author,
      subreddit: raw.subreddit,
      score: raw.score,
      createdUtc: raw.created_utc,
      parentId: raw.parent_id,
      postId: raw.link_id?.replace('t3_', '') || '',
      permalink: raw.permalink,
    }
  }

  private formatDate(date: Date): string {
    return String(Math.floor(date.getTime() / 1000))
  }
}

// Export singleton instance for convenience
export const redditAdapter = new RedditAdapter()
