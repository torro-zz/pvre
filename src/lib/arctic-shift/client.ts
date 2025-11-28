// Arctic Shift API Client
// Free Reddit data archive - no API key required
// Docs: https://github.com/ArthurHeitmann/arctic_shift/blob/master/api/README.md

import {
  RedditPost,
  RedditComment,
  Subreddit,
  SearchPostsParams,
  SearchCommentsParams,
  SearchSubredditsParams,
  ArcticShiftResponse,
} from './types'

const BASE_URL = 'https://arctic-shift.photon-reddit.com'
const DEFAULT_LIMIT = 50
const REQUEST_DELAY_MS = 500 // Delay between requests to be respectful

// Helper to add delay between requests
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Build query string from params
function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value))
    }
  })

  return searchParams.toString()
}

// Generic fetch with error handling and retries
async function fetchWithRetry<T>(
  url: string,
  retries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return data as T
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      console.warn(`Arctic Shift request failed (attempt ${attempt + 1}/${retries}):`, lastError.message)

      if (attempt < retries - 1) {
        await delay(delayMs * Math.pow(2, attempt)) // Exponential backoff
      }
    }
  }

  throw lastError || new Error('Request failed after retries')
}

/**
 * Search for Reddit posts
 */
export async function searchPosts(params: SearchPostsParams): Promise<RedditPost[]> {
  const queryParams = {
    ...params,
    limit: params.limit || DEFAULT_LIMIT,
  }

  const queryString = buildQueryString(queryParams)
  const url = `${BASE_URL}/api/posts/search?${queryString}`

  const response = await fetchWithRetry<ArcticShiftResponse<RedditPost>>(url)
  return response.data || []
}

/**
 * Search for Reddit comments
 */
export async function searchComments(params: SearchCommentsParams): Promise<RedditComment[]> {
  const queryParams = {
    ...params,
    limit: params.limit || DEFAULT_LIMIT,
  }

  const queryString = buildQueryString(queryParams)
  const url = `${BASE_URL}/api/comments/search?${queryString}`

  const response = await fetchWithRetry<ArcticShiftResponse<RedditComment>>(url)
  return response.data || []
}

/**
 * Search for subreddits by prefix
 */
export async function searchSubreddits(params: SearchSubredditsParams): Promise<Subreddit[]> {
  const queryParams = {
    ...params,
    limit: params.limit || 20,
  }

  const queryString = buildQueryString(queryParams)
  const url = `${BASE_URL}/api/subreddits/search?${queryString}`

  const response = await fetchWithRetry<ArcticShiftResponse<Subreddit>>(url)
  return response.data || []
}

/**
 * Fetch posts from multiple subreddits with rate limiting
 */
export async function fetchPostsFromSubreddits(
  subreddits: string[],
  options: {
    limit?: number
    after?: string
    before?: string
  } = {}
): Promise<RedditPost[]> {
  const allPosts: RedditPost[] = []

  for (const subreddit of subreddits) {
    try {
      const posts = await searchPosts({
        subreddit,
        limit: options.limit || 30,
        after: options.after,
        before: options.before,
        sort: 'desc',
      })

      allPosts.push(...posts)

      // Add delay between requests to be respectful
      if (subreddits.indexOf(subreddit) < subreddits.length - 1) {
        await delay(REQUEST_DELAY_MS)
      }
    } catch (error) {
      console.warn(`Failed to fetch posts from r/${subreddit}:`, error)
      // Continue with other subreddits even if one fails
    }
  }

  return allPosts
}

/**
 * Fetch comments from multiple subreddits with rate limiting
 */
export async function fetchCommentsFromSubreddits(
  subreddits: string[],
  options: {
    limit?: number
    after?: string
    before?: string
    bodyContains?: string
  } = {}
): Promise<RedditComment[]> {
  const allComments: RedditComment[] = []

  for (const subreddit of subreddits) {
    try {
      const comments = await searchComments({
        subreddit,
        body: options.bodyContains,
        limit: options.limit || 30,
        after: options.after,
        before: options.before,
        sort: 'desc',
      })

      allComments.push(...comments)

      // Add delay between requests
      if (subreddits.indexOf(subreddit) < subreddits.length - 1) {
        await delay(REQUEST_DELAY_MS)
      }
    } catch (error) {
      console.warn(`Failed to fetch comments from r/${subreddit}:`, error)
    }
  }

  return allComments
}

/**
 * Get the permalink URL for a post
 */
export function getPostUrl(post: RedditPost): string {
  if (post.permalink) {
    return `https://reddit.com${post.permalink}`
  }
  return `https://reddit.com/r/${post.subreddit}/comments/${post.id}`
}

/**
 * Get the permalink URL for a comment
 */
export function getCommentUrl(comment: RedditComment): string {
  if (comment.permalink) {
    return `https://reddit.com${comment.permalink}`
  }
  const postId = comment.link_id?.replace('t3_', '') || ''
  return `https://reddit.com/r/${comment.subreddit}/comments/${postId}/_/${comment.id}`
}
