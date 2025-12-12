// Arctic Shift Data Source Adapter
// Wraps the existing Arctic Shift client into the DataSource interface

import {
  DataSource,
  RedditPost,
  RedditComment,
  SearchParams,
  SamplePost,
} from './types'
import {
  searchPosts as arcticSearchPosts,
  searchComments as arcticSearchComments,
} from '../arctic-shift/client'
import {
  RedditPost as ArcticPost,
  RedditComment as ArcticComment,
} from '../arctic-shift/types'

const ARCTIC_SHIFT_BASE = 'https://arctic-shift.photon-reddit.com'
const HEALTH_CHECK_TIMEOUT = 5000

export class ArcticShiftSource implements DataSource {
  name = 'arctic-shift'

  async isAvailable(): Promise<boolean> {
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

  async searchPosts(params: SearchParams): Promise<RedditPost[]> {
    const { subreddits, limit = 100, timeRange } = params
    const allPosts: RedditPost[] = []

    // Don't use query param - multi-word queries cause Arctic Shift timeouts (422 errors)
    // Fetch by subreddit + time range only, let Claude relevance filter do the filtering
    // Arctic Shift API caps at 100 per request; 'auto' is supported but unpredictable (100-1000)

    for (const subreddit of subreddits) {
      try {
        const posts = await arcticSearchPosts({
          subreddit,
          limit: limit === 'auto' ? 'auto' : Math.min(limit, 100),
          after: timeRange?.after ? this.formatDate(timeRange.after) : undefined,
          before: timeRange?.before ? this.formatDate(timeRange.before) : undefined,
          sort: 'desc',
        })

        allPosts.push(...posts.map(p => this.normalizePost(p)))
      } catch (error) {
        console.warn(`Arctic Shift: Failed to fetch posts from r/${subreddit}:`, error)
        // Continue with other subreddits
      }
    }

    return allPosts
  }

  async searchComments(params: SearchParams): Promise<RedditComment[]> {
    const { subreddits, limit = 100, timeRange } = params
    const allComments: RedditComment[] = []

    // Don't use body param - multi-word queries cause Arctic Shift timeouts (422 errors)
    // Fetch by subreddit + time range only, let Claude relevance filter do the filtering

    for (const subreddit of subreddits) {
      try {
        const comments = await arcticSearchComments({
          subreddit,
          limit: limit === 'auto' ? 'auto' : Math.min(limit, 100),
          after: timeRange?.after ? this.formatDate(timeRange.after) : undefined,
          before: timeRange?.before ? this.formatDate(timeRange.before) : undefined,
          sort: 'desc',
        })

        allComments.push(...comments.map(c => this.normalizeComment(c)))
      } catch (error) {
        console.warn(`Arctic Shift: Failed to fetch comments from r/${subreddit}:`, error)
      }
    }

    return allComments
  }

  async getPostCount(subreddit: string, _keywords?: string[]): Promise<number> {
    try {
      // Arctic Shift doesn't have a direct count endpoint, so we fetch a small batch
      // and use the response to estimate (this is a limitation)
      // Don't use query param - causes timeouts
      const posts = await arcticSearchPosts({
        subreddit,
        limit: 100,
        sort: 'desc',
      })

      // If we got 100, there are likely more
      // This is an approximation - Arctic Shift doesn't return total count
      return posts.length
    } catch {
      return 0
    }
  }

  async getSamplePosts(subreddit: string, limit: number = 3): Promise<SamplePost[]> {
    try {
      const posts = await arcticSearchPosts({
        subreddit,
        limit: Math.min(limit, 10), // Cap at 10 for preview
        sort: 'desc',
      })

      return posts.map(p => ({
        title: p.title,
        subreddit: p.subreddit,
        score: p.score,
        permalink: p.permalink,
      }))
    } catch {
      return []
    }
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
