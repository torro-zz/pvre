// Cache Layer for Reddit Data
// Stores fetched data in Supabase to reduce API calls and enable stale fallback

import { createAdminClient } from '@/lib/supabase/admin'
import { RedditPost, RedditComment, CachedData } from './types'

const CACHE_TTL_DAYS = 7 // 7-day TTL for cache entries

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

    const expiresAt = new Date(data.expires_at)
    const isExpired = expiresAt < new Date()

    // Parse posts - handle both normalized and raw formats
    const posts = (data.posts || []).map((p: RedditPost | Record<string, unknown>) => {
      // If already normalized, return as-is
      if ('body' in p && 'numComments' in p && 'createdUtc' in p) {
        return p as RedditPost
      }
      // Otherwise, normalize from raw format
      return {
        id: p.id as string,
        title: p.title as string,
        body: (p.selftext || p.body || '') as string,
        author: p.author as string,
        subreddit: p.subreddit as string,
        score: p.score as number,
        numComments: (p.num_comments || p.numComments || 0) as number,
        createdUtc: (p.created_utc || p.createdUtc || 0) as number,
        permalink: p.permalink as string,
        url: p.url as string | undefined,
      }
    })

    // Parse comments if available
    const comments = (data.comments || []).map((c: RedditComment | Record<string, unknown>) => {
      if ('createdUtc' in c && 'parentId' in c && 'postId' in c) {
        return c as RedditComment
      }
      return {
        id: c.id as string,
        body: c.body as string,
        author: c.author as string,
        subreddit: c.subreddit as string,
        score: c.score as number,
        createdUtc: (c.created_utc || c.createdUtc || 0) as number,
        parentId: (c.parent_id || c.parentId || '') as string,
        postId: (c.link_id?.toString().replace('t3_', '') || c.postId || '') as string,
        permalink: c.permalink as string | undefined,
      }
    })

    return {
      posts,
      comments,
      fetchedAt: data.fetched_at,
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
          posts: data.posts,
          comments: data.comments || [],
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
