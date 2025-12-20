// Arctic Shift Data Source Adapter
// Wraps the existing Arctic Shift client into the DataSource interface

import {
  DataSource,
  RedditPost,
  RedditComment,
  SearchParams,
  SamplePost,
  PostStats,
} from './types'
import {
  searchPosts as arcticSearchPosts,
  searchComments as arcticSearchComments,
  searchPostsPaginated,
  searchCommentsPaginated,
} from '../arctic-shift/client'
import {
  RedditPost as ArcticPost,
  RedditComment as ArcticComment,
} from '../arctic-shift/types'

const ARCTIC_SHIFT_BASE = 'https://arctic-shift.photon-reddit.com'
const HEALTH_CHECK_TIMEOUT = 5000

// Time constants for adaptive time windows
const DAY_MS = 24 * 60 * 60 * 1000
const DAYS_30 = 30 * DAY_MS
const DAYS_90 = 90 * DAY_MS
const DAYS_180 = 180 * DAY_MS
const DAYS_365 = 365 * DAY_MS

// Activity thresholds (posts per day)
const HIGH_ACTIVITY_THRESHOLD = 20
const MEDIUM_ACTIVITY_THRESHOLD = 5

interface TimeWindow {
  after: Date
  before: Date
  label: string  // For logging
}

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
    const { subreddits, limit = 100, timeRange, subredditVelocities } = params
    const allPosts: RedditPost[] = []
    const seenIds = new Set<string>()

    // Don't use query param - multi-word queries cause Arctic Shift timeouts (422 errors)
    // Fetch by subreddit + time range only, let Claude relevance filter do the filtering

    // Determine target per subreddit ('auto' defaults to 100 for predictability)
    const targetPerSubreddit = limit === 'auto' ? 100 : limit

    for (const subreddit of subreddits) {
      try {
        // Get posting velocity for this subreddit (default to medium activity)
        const postsPerDay = subredditVelocities?.get(subreddit) ?? 10

        // Get adaptive time windows based on activity level
        const windows = this.getTimeWindows(postsPerDay, timeRange)
        const postsPerWindow = Math.ceil(targetPerSubreddit / windows.length)

        console.log(`[AdaptiveFetch] r/${subreddit}: ${postsPerDay.toFixed(1)} posts/day → ${windows.length} windows × ${postsPerWindow} posts`)

        // Fetch from each time window
        for (const window of windows) {
          try {
            let posts: ArcticPost[]

            if (postsPerWindow <= 100) {
              posts = await arcticSearchPosts({
                subreddit,
                limit: postsPerWindow,
                after: this.formatDate(window.after),
                before: this.formatDate(window.before),
                sort: 'desc',
              })
            } else {
              // Use pagination for > 100 posts per window
              posts = await searchPostsPaginated({
                subreddit,
                after: this.formatDate(window.after),
                before: this.formatDate(window.before),
                sort: 'desc',
              }, postsPerWindow)
            }

            // Deduplicate posts (in case of overlapping windows or duplicate data)
            for (const post of posts) {
              if (!seenIds.has(post.id)) {
                seenIds.add(post.id)
                allPosts.push(this.normalizePost(post))
              }
            }

            console.log(`[AdaptiveFetch] r/${subreddit} ${window.label}: fetched ${posts.length} posts`)
          } catch (windowError) {
            console.warn(`Arctic Shift: Failed to fetch ${window.label} for r/${subreddit}:`, windowError)
            // Continue with other windows
          }
        }
      } catch (error) {
        console.warn(`Arctic Shift: Failed to fetch posts from r/${subreddit}:`, error)
        // Continue with other subreddits
      }
    }

    return allPosts
  }

  /**
   * Get adaptive time windows based on subreddit posting velocity
   * HIGH activity (>20/day): 3 windows for comprehensive year coverage
   * MEDIUM activity (5-20/day): 2 windows for good coverage
   * LOW activity (<5/day): 1 window spanning the full year
   */
  private getTimeWindows(postsPerDay: number, timeRange?: { after?: Date; before?: Date }): TimeWindow[] {
    const now = timeRange?.before ? timeRange.before.getTime() : Date.now()
    const yearAgo = now - DAYS_365

    // If explicit time range provided, respect it as a single window
    if (timeRange?.after) {
      return [{
        after: timeRange.after,
        before: new Date(now),
        label: 'custom',
      }]
    }

    if (postsPerDay > HIGH_ACTIVITY_THRESHOLD) {
      // HIGH activity: 3 windows [0-30d], [30-180d], [180-365d]
      return [
        { after: new Date(now - DAYS_30), before: new Date(now), label: '0-30d' },
        { after: new Date(now - DAYS_180), before: new Date(now - DAYS_30), label: '30-180d' },
        { after: new Date(yearAgo), before: new Date(now - DAYS_180), label: '180-365d' },
      ]
    } else if (postsPerDay >= MEDIUM_ACTIVITY_THRESHOLD) {
      // MEDIUM activity: 2 windows [0-90d], [90-365d]
      return [
        { after: new Date(now - DAYS_90), before: new Date(now), label: '0-90d' },
        { after: new Date(yearAgo), before: new Date(now - DAYS_90), label: '90-365d' },
      ]
    } else {
      // LOW activity: 1 window spanning the full year
      return [
        { after: new Date(yearAgo), before: new Date(now), label: '0-365d' },
      ]
    }
  }

  async searchComments(params: SearchParams): Promise<RedditComment[]> {
    const { subreddits, limit = 100, timeRange, subredditVelocities } = params
    const allComments: RedditComment[] = []
    const seenIds = new Set<string>()

    // Don't use body param - multi-word queries cause Arctic Shift timeouts (422 errors)
    // Fetch by subreddit + time range only, let Claude relevance filter do the filtering

    // Determine target per subreddit ('auto' defaults to 100 for predictability)
    const targetPerSubreddit = limit === 'auto' ? 100 : limit

    for (const subreddit of subreddits) {
      try {
        // Get posting velocity for this subreddit (default to medium activity)
        const postsPerDay = subredditVelocities?.get(subreddit) ?? 10

        // Get adaptive time windows based on activity level
        const windows = this.getTimeWindows(postsPerDay, timeRange)
        const commentsPerWindow = Math.ceil(targetPerSubreddit / windows.length)

        // Fetch from each time window
        for (const window of windows) {
          try {
            let comments: ArcticComment[]

            if (commentsPerWindow <= 100) {
              comments = await arcticSearchComments({
                subreddit,
                limit: commentsPerWindow,
                after: this.formatDate(window.after),
                before: this.formatDate(window.before),
                sort: 'desc',
              })
            } else {
              // Use pagination for > 100 comments per window
              comments = await searchCommentsPaginated({
                subreddit,
                after: this.formatDate(window.after),
                before: this.formatDate(window.before),
                sort: 'desc',
              }, commentsPerWindow)
            }

            // Deduplicate comments
            for (const comment of comments) {
              if (!seenIds.has(comment.id)) {
                seenIds.add(comment.id)
                allComments.push(this.normalizeComment(comment))
              }
            }
          } catch (windowError) {
            console.warn(`Arctic Shift: Failed to fetch comments ${window.label} for r/${subreddit}:`, windowError)
          }
        }
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

  /**
   * Get post count AND posting velocity for adaptive time-stratified fetching
   * Velocity is calculated from the timestamp spread of sample posts
   */
  async getPostStats(subreddit: string, _keywords?: string[]): Promise<PostStats> {
    try {
      const posts = await arcticSearchPosts({
        subreddit,
        limit: 100,
        sort: 'desc', // Newest first
      })

      if (posts.length < 2) {
        return { count: posts.length, postsPerDay: 0.5 } // Very low activity default
      }

      // Calculate posting velocity from timestamp spread
      // Sort by timestamp to find range (should already be sorted, but be safe)
      const timestamps = posts.map(p => p.created_utc).sort((a, b) => b - a)
      const newestTimestamp = timestamps[0]
      const oldestTimestamp = timestamps[timestamps.length - 1]

      // Calculate days spanned (minimum 1 day to avoid division issues)
      const secondsSpanned = newestTimestamp - oldestTimestamp
      const daysSpanned = Math.max(secondsSpanned / 86400, 1)

      // Posts per day = count / days
      const postsPerDay = posts.length / daysSpanned

      console.log(`[PostStats] r/${subreddit}: ${posts.length} posts over ${daysSpanned.toFixed(1)} days = ${postsPerDay.toFixed(1)} posts/day`)

      return { count: posts.length, postsPerDay }
    } catch {
      return { count: 0, postsPerDay: 1 } // Default to medium activity on error
    }
  }

  async getSamplePosts(subreddit: string, limit: number = 3, keywords?: string[]): Promise<SamplePost[]> {
    try {
      // Fetch more posts if we have keywords to filter by
      const fetchLimit = keywords && keywords.length > 0 ? 100 : Math.min(limit, 10)

      const posts = await arcticSearchPosts({
        subreddit,
        limit: fetchLimit,
        sort: 'desc',
      })

      let filteredPosts = posts

      // If keywords provided, filter for posts that match
      if (keywords && keywords.length > 0) {
        const keywordLower = keywords.map(k => k.toLowerCase())

        // Extract core topic words from keywords (important nouns/verbs that define the topic)
        const allKeywordWords = keywordLower.flatMap(k => k.split(/\s+/))
        const topicWords = allKeywordWords.filter(w =>
          w.length > 3 &&
          !['getting', 'without', 'about', 'from', 'with', 'that', 'this', 'keep', 'keeps', 'best', 'product'].includes(w)
        )
        const uniqueTopicWords = [...new Set(topicWords)]

        // Score each post by relevance
        const scoredPosts = posts.map(post => {
          const titleLower = post.title.toLowerCase()
          const bodyLower = (post.selftext || '').toLowerCase()
          const combined = titleLower + ' ' + bodyLower

          let score = 0

          // Exact phrase match (highest value)
          for (const keyword of keywordLower) {
            if (combined.includes(keyword)) {
              score += 10
            }
          }

          // Count topic word matches (medium value)
          for (const word of uniqueTopicWords) {
            if (titleLower.includes(word)) {
              score += 3 // Title match is more valuable
            } else if (bodyLower.includes(word)) {
              score += 1
            }
          }

          // Boost posts that match multiple different topic words
          const matchedWords = uniqueTopicWords.filter(w => combined.includes(w))
          if (matchedWords.length >= 3) {
            score += 5 // Bonus for matching multiple topic words
          }

          return { post, score, matchedWords: matchedWords.length }
        })

        // Filter to posts with at least some relevance, then sort by score
        filteredPosts = scoredPosts
          .filter(sp => sp.score > 0 && sp.matchedWords >= 2) // Require at least 2 topic words
          .sort((a, b) => b.score - a.score)
          .map(sp => sp.post)

        // If strict filtering yields no results, fall back to posts matching at least 1 important word
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
