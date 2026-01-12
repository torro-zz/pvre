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
import {
  rateLimitedHttpFetch,
  updateRateLimitState,
  getRateLimitDelay,
  type RequestPriority,
  type RateLimitedFetchOptions,
} from './rate-limiter'
import { generateQueryCacheKey, getQueryCache, setQueryCache } from '@/lib/data-sources/cache'

const BASE_URL = 'https://arctic-shift.photon-reddit.com'
const DEFAULT_LIMIT = 50
const REQUEST_DELAY_MS = 300 // Delay between requests for legacy functions

// Helper to add delay between requests (only used for legacy functions)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Request context for priority routing
// Set this before making requests to route them appropriately
let currentRequestPriority: RequestPriority = 'research'
let currentJobId: string | undefined

/**
 * Set the request context for priority routing
 * Call this at the start of a coverage check or research flow
 */
export function setRequestContext(priority: RequestPriority, jobId?: string): void {
  currentRequestPriority = priority
  currentJobId = jobId
}

/**
 * Clear the request context (reset to defaults)
 */
export function clearRequestContext(): void {
  currentRequestPriority = 'research'
  currentJobId = undefined
}

/**
 * Get current request options for rate limiting
 */
function getRequestOptions(): RateLimitedFetchOptions {
  return {
    priority: currentRequestPriority,
    jobId: currentJobId,
  }
}

// Build query string from params
function buildQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const searchParams = new URLSearchParams()

  Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([key, value]) => {
      searchParams.append(key, String(value))
    })

  return searchParams.toString()
}

// Generic fetch with error handling, caching, retries, and priority routing
// All requests go through the rate limiter to handle concurrent users
// Handles 422 "Timeout" errors with longer backoff (server-side query timeouts)
// Uses query-level caching to reduce API load (24-hour TTL)
// Uses request coalescing to share identical in-flight requests
async function fetchWithRetry<T>(
  url: string,
  retries = 3,
  delayMs = 1000,
  useCache = true
): Promise<T> {
  // Check cache first (for cacheable requests)
  if (useCache) {
    const cacheKey = generateQueryCacheKey(url)
    const cached = await getQueryCache<T>(cacheKey)
    if (cached) {
      console.log('[ArcticShift] Cache hit:', url.slice(0, 100))
      return cached
    }
  }

  let lastError: Error | null = null

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Check if API rate limit headers indicate we should wait
      const rateLimitDelay = getRateLimitDelay()
      if (rateLimitDelay > 0) {
        console.log(`[ArcticShift] Waiting ${rateLimitDelay}ms for API rate limit reset...`)
        await delay(rateLimitDelay)
      }

      // Log request URL for debugging (only first attempt to reduce noise)
      if (attempt === 0) {
        const priority = currentRequestPriority
        console.log(`[ArcticShift] Request (${priority}):`, url.slice(0, 100))
      }

      // Use rate limiter with coalescing to prevent API overload
      // Priority and jobId are automatically applied from context
      const response = await rateLimitedHttpFetch(
        url,
        () => fetch(url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'PVRE/1.0 (research tool)',
          },
        }),
        getRequestOptions()
      )

      // Update rate limit state from response headers (for adaptive throttling)
      updateRateLimitState(response.headers)

      if (!response.ok) {
        // Get response body for better error diagnosis
        const errorBody = await response.text()
        console.error('[ArcticShift] Error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorBody.slice(0, 500), // Limit body size for logs
          url,
        })

        // Special handling for 422 "Timeout" errors from Arctic Shift
        // These indicate server-side query timeouts, not rate limits
        // Use longer backoff to give the server time to recover
        if (response.status === 422) {
          let is422Timeout = false
          try {
            const parsed = JSON.parse(errorBody) as {
              error?: string
              message?: string
              detail?: string
              errors?: string[] | string
            }
            const fields = [parsed.error, parsed.message, parsed.detail]
            const errorList = Array.isArray(parsed.errors) ? parsed.errors : [parsed.errors]
            const combined = [...fields, ...errorList].filter((value): value is string => Boolean(value))
            is422Timeout = combined.some((value) => value.toLowerCase().includes('timeout'))
          } catch {
            is422Timeout = errorBody.toLowerCase().includes('timeout')
          }
          if (is422Timeout && attempt < retries - 1) {
            const timeoutDelay = 10000 + (attempt * 5000) // 10s, 15s, 20s
            console.warn(`[ArcticShift] Server timeout (422), waiting ${timeoutDelay / 1000}s before retry...`)
            await delay(timeoutDelay)
            continue // Skip to next attempt
          }
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      // Cache successful responses (async, don't wait)
      if (useCache) {
        const cacheKey = generateQueryCacheKey(url)
        setQueryCache(cacheKey, data, url).catch(() => {
          // Ignore cache write errors
        })
      }

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
 * Sanitize subreddit name - remove r/ prefix if present
 */
function sanitizeSubreddit(subreddit: string | undefined): string | undefined {
  if (!subreddit) return undefined
  return subreddit.replace(/^r\//, '').trim().toLowerCase()
}

/**
 * Search for Reddit posts
 */
export async function searchPosts(params: SearchPostsParams): Promise<RedditPost[]> {
  // Sanitize parameters to prevent 422 errors
  // Use 'auto' for limit to allow API to return up to 1000 results based on capacity
  const sanitizedParams: SearchPostsParams = {
    ...params,
    subreddit: sanitizeSubreddit(params.subreddit),
    limit: params.limit === 'auto' ? 'auto' : Math.min(Math.max(params.limit || DEFAULT_LIMIT, 1), 100), // Support 'auto' or clamp to valid range
  }

  // Remove empty query to avoid 422
  if (sanitizedParams.query === '') {
    delete sanitizedParams.query
  }

  const queryString = buildQueryString(sanitizedParams as Record<string, string | number | boolean | undefined>)
  const url = `${BASE_URL}/api/posts/search?${queryString}`

  const response = await fetchWithRetry<ArcticShiftResponse<RedditPost>>(url)
  return response.data || []
}

/**
 * Search for Reddit comments
 */
export async function searchComments(params: SearchCommentsParams): Promise<RedditComment[]> {
  // Sanitize parameters to prevent 422 errors
  // Use 'auto' for limit to allow API to return up to 1000 results based on capacity
  const sanitizedParams: SearchCommentsParams = {
    ...params,
    subreddit: sanitizeSubreddit(params.subreddit),
    limit: params.limit === 'auto' ? 'auto' : Math.min(Math.max(params.limit || DEFAULT_LIMIT, 1), 100), // Support 'auto' or clamp to valid range
  }

  // Remove empty body query to avoid 422
  if (sanitizedParams.body === '') {
    delete sanitizedParams.body
  }

  const queryString = buildQueryString(sanitizedParams as Record<string, string | number | boolean | undefined>)
  const url = `${BASE_URL}/api/comments/search?${queryString}`

  const response = await fetchWithRetry<ArcticShiftResponse<RedditComment>>(url)
  return response.data || []
}

/**
 * Fetch posts with pagination support (for limits > 100)
 * Makes multiple requests using timestamp-based pagination to get more posts
 */
export async function searchPostsPaginated(
  params: SearchPostsParams,
  targetCount: number
): Promise<RedditPost[]> {
  const allPosts: RedditPost[] = []
  const seenIds = new Set<string>()
  let lastTimestamp: number | undefined
  const maxPages = Math.ceil(targetCount / 100)

  for (let page = 0; page < maxPages && allPosts.length < targetCount; page++) {
    const pageParams: SearchPostsParams = {
      ...params,
      limit: 100,
      // For pagination: use before=lastTimestamp to get older posts
      before: lastTimestamp ? String(lastTimestamp) : params.before,
    }

    const posts = await searchPosts(pageParams)

    if (posts.length === 0) {
      // No more posts available
      break
    }

    // Deduplicate by ID (edge case: posts at exact same timestamp)
    for (const post of posts) {
      if (!seenIds.has(post.id) && allPosts.length < targetCount) {
        seenIds.add(post.id)
        allPosts.push(post)
      }
    }

    // Get timestamp of oldest post for next page
    // (sort=desc means newest first, so last post is oldest)
    const oldestPost = posts[posts.length - 1]
    lastTimestamp = oldestPost.created_utc
    // Rate limiting handled by rateLimitedFetch - no manual delay needed
  }

  return allPosts
}

/**
 * Fetch comments with pagination support (for limits > 100)
 * Makes multiple requests using timestamp-based pagination to get more comments
 */
export async function searchCommentsPaginated(
  params: SearchCommentsParams,
  targetCount: number
): Promise<RedditComment[]> {
  const allComments: RedditComment[] = []
  const seenIds = new Set<string>()
  let lastTimestamp: number | undefined
  const maxPages = Math.ceil(targetCount / 100)

  for (let page = 0; page < maxPages && allComments.length < targetCount; page++) {
    const pageParams: SearchCommentsParams = {
      ...params,
      limit: 100,
      before: lastTimestamp ? String(lastTimestamp) : params.before,
    }

    const comments = await searchComments(pageParams)

    if (comments.length === 0) {
      break
    }

    // Deduplicate by ID
    for (const comment of comments) {
      if (!seenIds.has(comment.id) && allComments.length < targetCount) {
        seenIds.add(comment.id)
        allComments.push(comment)
      }
    }

    // Get timestamp of oldest comment for next page
    const oldestComment = comments[comments.length - 1]
    lastTimestamp = oldestComment.created_utc
    // Rate limiting handled by rateLimitedFetch - no manual delay needed
  }

  return allComments
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
