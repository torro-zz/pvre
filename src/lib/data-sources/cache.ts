// Cache Layer for Reddit Data
// Stores fetched data in Supabase to reduce API calls and enable stale fallback

import { createAdminClient } from '@/lib/supabase/admin'
import { RedditPost, RedditComment, CachedData } from './types'
import crypto from 'crypto'

const CACHE_TTL_DAYS = 90 // 90-day TTL for cache entries (Reddit data is valuable and stable)
const QUERY_CACHE_TTL_HOURS = 24 // 24-hour TTL for Arctic Shift query results

export interface CacheResult {
  posts: RedditPost[]
  comments: RedditComment[]
  fetchedAt: string
  isExpired: boolean
}

/**
 * Generate a cache key from search parameters
 */
export function generateCacheKey(
  subreddits: string[],
  keywords?: string[],
  timeRange?: { after?: Date; before?: Date }
): string {
  const parts = [
    subreddits.sort().join(','),
    keywords?.sort().join(',') || '',
    timeRange?.after?.toISOString() || '',
    timeRange?.before?.toISOString() || '',
  ]
  return parts.join('|')
}

/**
 * Get cached data if available
 */
export async function getCachedData(cacheKey: string): Promise<CacheResult | null> {
  try {
    const supabase = createAdminClient()

    // Try new cache_key column first, fall back to subreddit+search_query
    const { data, error } = await supabase
      .from('reddit_cache')
      .select('*')
      .eq('cache_key', cacheKey)
      .single()

    if (error || !data) {
      return null
    }

    const expiresAt = data.expires_at ? new Date(data.expires_at) : new Date(0)
    const isExpired = expiresAt < new Date()

    // Parse posts - handle both normalized and raw formats
    const rawPosts = Array.isArray(data.posts) ? data.posts : []
    const posts = rawPosts.map((raw: unknown) => {
      const p = raw as RedditPost | Record<string, unknown>
      // If already normalized, return as-is
      if ('body' in p && 'numComments' in p && 'createdUtc' in p) {
        return p as RedditPost
      }
      // Otherwise, normalize from raw format
      return {
        id: p.id as string,
        title: p.title as string,
        body: ((p as Record<string, unknown>).selftext || p.body || '') as string,
        author: p.author as string,
        subreddit: p.subreddit as string,
        score: p.score as number,
        numComments: ((p as Record<string, unknown>).num_comments || (p as Record<string, unknown>).numComments || 0) as number,
        createdUtc: ((p as Record<string, unknown>).created_utc || (p as Record<string, unknown>).createdUtc || 0) as number,
        permalink: p.permalink as string,
        url: p.url as string | undefined,
      }
    })

    // Parse comments if available
    const rawComments = Array.isArray(data.comments) ? data.comments : []
    const comments = rawComments.map((raw: unknown) => {
      const c = raw as RedditComment | Record<string, unknown>
      if ('createdUtc' in c && 'parentId' in c && 'postId' in c) {
        return c as RedditComment
      }
      const rec = c as Record<string, unknown>
      return {
        id: c.id as string,
        body: c.body as string,
        author: c.author as string,
        subreddit: c.subreddit as string,
        score: c.score as number,
        createdUtc: (rec.created_utc || rec.createdUtc || 0) as number,
        parentId: (rec.parent_id || rec.parentId || '') as string,
        postId: ((rec.link_id as string | undefined)?.toString().replace('t3_', '') || rec.postId || '') as string,
        permalink: c.permalink as string | undefined,
      }
    })

    return {
      posts,
      comments,
      fetchedAt: data.fetched_at || new Date().toISOString(),
      isExpired,
    }
  } catch (error) {
    console.warn('Cache lookup failed:', error)
    return null
  }
}

/**
 * Store data in cache
 */
export async function setCachedData(
  cacheKey: string,
  data: {
    posts: RedditPost[]
    comments?: RedditComment[]
    subreddits?: string[]
    searchQuery?: string
  }
): Promise<void> {
  try {
    const supabase = createAdminClient()

    const expiresAt = new Date(Date.now() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000)

    // Extract subreddit from cache key for backward compatibility
    const subreddit = data.subreddits?.[0] || cacheKey.split('|')[0].split(',')[0] || 'unknown'
    const searchQuery = data.searchQuery || cacheKey.split('|')[1] || ''

    await supabase
      .from('reddit_cache')
      .upsert(
        {
          cache_key: cacheKey,
          subreddit, // For backward compatibility
          search_query: searchQuery, // For backward compatibility
          posts: JSON.parse(JSON.stringify(data.posts)),
          comments: JSON.parse(JSON.stringify(data.comments || [])),
          fetched_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        },
        {
          onConflict: 'cache_key',
        }
      )
  } catch (error) {
    console.warn('Cache write failed:', error)
    // Don't throw - cache write failure shouldn't block the main flow
  }
}

/**
 * Clear expired cache entries
 */
export async function clearExpiredCache(): Promise<number> {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('reddit_cache')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('id')

    if (error) {
      console.warn('Cache cleanup failed:', error)
      return 0
    }

    return data?.length || 0
  } catch (error) {
    console.warn('Cache cleanup failed:', error)
    return 0
  }
}

// =============================================================================
// QUERY-LEVEL CACHE (for Arctic Shift API requests)
// =============================================================================

/**
 * Generate cache key for an Arctic Shift API query
 * Uses SHA256 hash of the full URL to create a unique, fixed-length key
 */
export function generateQueryCacheKey(url: string): string {
  const hash = crypto.createHash('sha256').update(url).digest('hex').slice(0, 32)
  return `arctic_query:${hash}`
}

/**
 * Get cached query result from Supabase
 * Returns null if not cached or expired
 */
export async function getQueryCache<T>(cacheKey: string): Promise<T | null> {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('reddit_cache')
      .select('posts, expires_at')
      .eq('cache_key', cacheKey)
      .single()

    if (error || !data) {
      return null
    }

    const expiresAt = data.expires_at ? new Date(data.expires_at) : new Date(0)
    if (expiresAt < new Date()) {
      return null // Expired
    }

    // The 'posts' column stores the raw API response
    return data.posts as T
  } catch (error) {
    console.warn('[QueryCache] Lookup failed:', error)
    return null
  }
}

/**
 * Store query result in Supabase cache
 * Uses 24-hour TTL for query results
 */
export async function setQueryCache<T>(cacheKey: string, result: T, url?: string): Promise<void> {
  try {
    const supabase = createAdminClient()

    const expiresAt = new Date(Date.now() + QUERY_CACHE_TTL_HOURS * 60 * 60 * 1000)

    await supabase.from('reddit_cache').upsert(
      {
        cache_key: cacheKey,
        subreddit: 'arctic_query', // Marker for query cache entries
        search_query: url?.slice(0, 500) || '', // Store URL for debugging (truncated)
        posts: JSON.parse(JSON.stringify(result)), // Store raw API response
        comments: [], // Not used for query cache
        fetched_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      },
      {
        onConflict: 'cache_key',
      }
    )
  } catch (error) {
    console.warn('[QueryCache] Write failed:', error)
    // Don't throw - cache failure shouldn't block main flow
  }
}
