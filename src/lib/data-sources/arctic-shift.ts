// Arctic Shift Data Source Adapter
// Wraps the existing Arctic Shift client into the DataSource interface

import {
  DataSource,
  RedditPost,
  RedditComment,
  SearchParams,
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
    const { subreddits, keywords, limit = 50, timeRange } = params
    const allPosts: RedditPost[] = []

    // Build a more focused query - use first 2 keywords only to avoid over-filtering
    // The Claude relevance filter will do the fine-grained filtering
    const queryKeywords = keywords?.slice(0, 2)
    const query = queryKeywords && queryKeywords.length > 0
      ? queryKeywords.join(' ')  // Space = implicit AND in most search APIs
      : undefined

    for (const subreddit of subreddits) {
      try {
        const posts = await arcticSearchPosts({
          subreddit,
          query,
          limit: Math.min(limit, 100),
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
    const { subreddits, keywords, limit = 30, timeRange } = params
    const allComments: RedditComment[] = []

    // Use first 2 keywords for focused search
    const queryKeywords = keywords?.slice(0, 2)
    const bodyQuery = queryKeywords && queryKeywords.length > 0
      ? queryKeywords.join(' ')
      : undefined

    for (const subreddit of subreddits) {
      try {
        const comments = await arcticSearchComments({
          subreddit,
          body: bodyQuery,
          limit: Math.min(limit, 100),
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

  async getPostCount(subreddit: string, keywords?: string[]): Promise<number> {
    try {
      // Arctic Shift doesn't have a direct count endpoint, so we fetch a small batch
      // and use the response to estimate (this is a limitation)
      const queryKeywords = keywords?.slice(0, 2)
      const posts = await arcticSearchPosts({
        subreddit,
        query: queryKeywords?.join(' '),
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
