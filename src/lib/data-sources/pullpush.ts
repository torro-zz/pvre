// PullPush Data Source - Backup Reddit Archive
// API docs: https://pullpush.io/

import {
  DataSource,
  RedditPost,
  RedditComment,
  SearchParams,
  SamplePost,
  PostStats,
} from './types'

const PULLPUSH_BASE = 'https://api.pullpush.io/reddit'
const HEALTH_CHECK_TIMEOUT = 5000
const REQUEST_DELAY_MS = 500

// Helper to add delay between requests
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Generic fetch with retries
async function fetchWithRetry<T>(
  url: string,
  retries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json() as T
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.warn(`PullPush request failed (attempt ${attempt + 1}/${retries}):`, lastError.message)

      if (attempt < retries - 1) {
        await delay(delayMs * Math.pow(2, attempt))
      }
    }
  }

  throw lastError || new Error('PullPush request failed after retries')
}

interface PullPushResponse<T> {
  data: T[]
  metadata?: {
    total_results?: number
  }
}

interface PullPushPost {
  id: string
  title: string
  selftext?: string
  author: string
  subreddit: string
  score: number
  num_comments: number
  created_utc: number
  url?: string
  permalink?: string
}

interface PullPushComment {
  id: string
  body: string
  author: string
  subreddit: string
  score: number
  created_utc: number
  parent_id: string
  link_id: string
}

export class PullPushSource implements DataSource {
  name = 'pullpush'

  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT)

      const response = await fetch(`${PULLPUSH_BASE}/search/submission?size=1`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })

      clearTimeout(timeoutId)
      return response.ok
    } catch {
      return false
    }
  }

  async searchPosts(params: SearchParams): Promise<RedditPost[]> {
    const { subreddits, keywords, limit = 50, timeRange } = params
    const allPosts: RedditPost[] = []

    // PullPush doesn't support 'auto' - use 100 as max if 'auto' is passed
    const effectiveLimit = limit === 'auto' ? 100 : limit

    // Use first 2 keywords for focused search
    const queryKeywords = keywords?.slice(0, 2)

    // PullPush requires individual subreddit requests
    for (let i = 0; i < subreddits.length; i++) {
      const subreddit = subreddits[i]
      try {
        const queryParams = new URLSearchParams({
          subreddit,
          size: String(Math.min(effectiveLimit, 100)),
          sort: 'score',
          sort_type: 'desc',
        })

        if (queryKeywords && queryKeywords.length > 0) {
          queryParams.set('q', queryKeywords.join(' '))
        }

        if (timeRange?.after) {
          queryParams.set('after', String(Math.floor(timeRange.after.getTime() / 1000)))
        }

        if (timeRange?.before) {
          queryParams.set('before', String(Math.floor(timeRange.before.getTime() / 1000)))
        }

        const url = `${PULLPUSH_BASE}/search/submission?${queryParams}`
        const response = await fetchWithRetry<PullPushResponse<PullPushPost>>(url)

        if (response.data) {
          allPosts.push(...response.data.map(p => this.normalizePost(p)))
        }

        // Rate limiting between requests
        if (i < subreddits.length - 1) {
          await delay(REQUEST_DELAY_MS)
        }
      } catch (error) {
        console.warn(`PullPush: Failed to fetch posts from r/${subreddit}:`, error)
      }
    }

    return allPosts
  }

  async searchComments(params: SearchParams): Promise<RedditComment[]> {
    const { subreddits, keywords, limit = 30, timeRange } = params
    const allComments: RedditComment[] = []

    // PullPush doesn't support 'auto' - use 100 as max if 'auto' is passed
    const effectiveLimit = limit === 'auto' ? 100 : limit

    // Use first 2 keywords for focused search
    const queryKeywords = keywords?.slice(0, 2)

    // PullPush requires individual subreddit requests
    for (let i = 0; i < subreddits.length; i++) {
      const subreddit = subreddits[i]
      try {
        const queryParams = new URLSearchParams({
          subreddit,
          size: String(Math.min(effectiveLimit, 100)),
          sort: 'score',
          sort_type: 'desc',
        })

        if (queryKeywords && queryKeywords.length > 0) {
          queryParams.set('q', queryKeywords.join(' '))
        }

        if (timeRange?.after) {
          queryParams.set('after', String(Math.floor(timeRange.after.getTime() / 1000)))
        }

        if (timeRange?.before) {
          queryParams.set('before', String(Math.floor(timeRange.before.getTime() / 1000)))
        }

        const url = `${PULLPUSH_BASE}/search/comment?${queryParams}`
        const response = await fetchWithRetry<PullPushResponse<PullPushComment>>(url)

        if (response.data) {
          allComments.push(...response.data.map(c => this.normalizeComment(c)))
        }

        // Rate limiting between requests
        if (i < subreddits.length - 1) {
          await delay(REQUEST_DELAY_MS)
        }
      } catch (error) {
        console.warn(`PullPush: Failed to fetch comments from r/${subreddit}:`, error)
      }
    }

    return allComments
  }

  async getPostCount(subreddit: string, keywords?: string[]): Promise<number> {
    try {
      const queryKeywords = keywords?.slice(0, 2)
      const queryParams = new URLSearchParams({
        subreddit,
        size: '0',
        metadata: 'true',
      })

      if (queryKeywords && queryKeywords.length > 0) {
        queryParams.set('q', queryKeywords.join(' '))
      }

      const url = `${PULLPUSH_BASE}/search/submission?${queryParams}`
      const response = await fetchWithRetry<PullPushResponse<PullPushPost>>(url)

      return response.metadata?.total_results || response.data?.length || 0
    } catch {
      return 0
    }
  }

  /**
   * Get post count AND posting velocity for adaptive time-stratified fetching
   * Velocity is calculated from the timestamp spread of sample posts
   */
  async getPostStats(subreddit: string, keywords?: string[]): Promise<PostStats> {
    try {
      const queryParams = new URLSearchParams({
        subreddit,
        size: '100',
        sort: 'created_utc',
        sort_type: 'desc',
      })

      const url = `${PULLPUSH_BASE}/search/submission?${queryParams}`
      const response = await fetchWithRetry<PullPushResponse<PullPushPost>>(url)

      if (!response.data || response.data.length < 2) {
        return { count: response.data?.length || 0, postsPerDay: 0.5 }
      }

      // Calculate posting velocity from timestamp spread
      const timestamps = response.data.map(p => p.created_utc).sort((a, b) => b - a)
      const newestTimestamp = timestamps[0]
      const oldestTimestamp = timestamps[timestamps.length - 1]

      // Calculate days spanned (minimum 1 day to avoid division issues)
      const secondsSpanned = newestTimestamp - oldestTimestamp
      const daysSpanned = Math.max(secondsSpanned / 86400, 1)

      const postsPerDay = response.data.length / daysSpanned

      console.log(`[PullPush] r/${subreddit}: ${response.data.length} posts over ${daysSpanned.toFixed(1)} days = ${postsPerDay.toFixed(1)} posts/day`)

      return { count: response.data.length, postsPerDay }
    } catch {
      return { count: 0, postsPerDay: 1 } // Default to medium activity on error
    }
  }

  async getSamplePosts(subreddit: string, limit: number = 3, keywords?: string[]): Promise<SamplePost[]> {
    try {
      // Fetch more posts if filtering by keywords
      const fetchSize = keywords && keywords.length > 0 ? 50 : Math.min(limit, 10)

      const queryParams = new URLSearchParams({
        subreddit,
        size: String(fetchSize),
        sort: 'score',
        sort_type: 'desc',
      })

      const url = `${PULLPUSH_BASE}/search/submission?${queryParams}`
      const response = await fetchWithRetry<PullPushResponse<PullPushPost>>(url)

      if (response.data) {
        let posts = response.data

        // Filter by keywords if provided
        if (keywords && keywords.length > 0) {
          const keywordLower = keywords.map(k => k.toLowerCase())

          posts = posts.filter(post => {
            const titleLower = post.title.toLowerCase()
            const bodyLower = (post.selftext || '').toLowerCase()
            const combined = titleLower + ' ' + bodyLower

            return keywordLower.some(keyword => {
              const words = keyword.split(/\s+/)
              return words.every(word => combined.includes(word))
            })
          })

          // Fallback to looser matching
          if (posts.length === 0) {
            posts = response.data.filter(post => {
              const titleLower = post.title.toLowerCase()
              return keywordLower.some(keyword => {
                const words = keyword.split(/\s+/)
                return words.some(word => word.length > 3 && titleLower.includes(word))
              })
            })
          }
        }

        return posts.slice(0, limit).map(p => ({
          title: p.title,
          subreddit: p.subreddit,
          score: p.score,
          permalink: p.permalink || `/r/${p.subreddit}/comments/${p.id}`,
        }))
      }
      return []
    } catch {
      return []
    }
  }

  private normalizePost(raw: PullPushPost): RedditPost {
    return {
      id: raw.id,
      title: raw.title,
      body: raw.selftext || '',
      author: raw.author,
      subreddit: raw.subreddit,
      score: raw.score,
      numComments: raw.num_comments,
      createdUtc: raw.created_utc,
      permalink: raw.permalink || `/r/${raw.subreddit}/comments/${raw.id}`,
      url: raw.url,
    }
  }

  private normalizeComment(raw: PullPushComment): RedditComment {
    return {
      id: raw.id,
      body: raw.body,
      author: raw.author,
      subreddit: raw.subreddit,
      score: raw.score,
      createdUtc: raw.created_utc,
      parentId: raw.parent_id,
      postId: raw.link_id?.replace('t3_', '') || '',
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }
}
