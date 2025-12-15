/**
 * Hacker News Data Source Adapter
 *
 * Uses the Algolia HN Search API (free, no auth required)
 * Great for tech/SaaS validation - same audience as PVRE target users
 *
 * API Docs: https://hn.algolia.com/api
 */

import { RedditPost, RedditComment, SamplePost } from './types'

const HN_API_BASE = 'https://hn.algolia.com/api/v1'

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
 * Search HN for stories matching keywords
 */
export async function searchHNStories(
  keywords: string[],
  options: {
    limit?: number
    tags?: ('story' | 'ask_hn' | 'show_hn' | 'comment')[]
    numericFilters?: string  // e.g., "points>10"
  } = {}
): Promise<RedditPost[]> {
  const { limit = 100, tags = ['story'], numericFilters } = options

  const query = keywords.join(' ')
  const tagFilter = tags.join(',')

  let url = `${HN_API_BASE}/search?query=${encodeURIComponent(query)}&tags=${tagFilter}&hitsPerPage=${Math.min(limit, 1000)}`

  if (numericFilters) {
    url += `&numericFilters=${encodeURIComponent(numericFilters)}`
  }

  try {
    const response = await fetch(url)

    if (!response.ok) {
      console.error(`HN API error: ${response.status} ${response.statusText}`)
      return []
    }

    const data: HNSearchResponse = await response.json()

    // Convert HN hits to RedditPost format for compatibility with existing pipeline
    return data.hits.map((hit) => normalizeHNPost(hit))
  } catch (error) {
    console.error('HN search error:', error)
    return []
  }
}

/**
 * Search HN Ask posts (great for pain signals - people asking for help)
 */
export async function searchAskHN(
  keywords: string[],
  limit: number = 50
): Promise<RedditPost[]> {
  return searchHNStories(keywords, { limit, tags: ['ask_hn'] })
}

/**
 * Search HN Show posts (competitor/solution launches)
 */
export async function searchShowHN(
  keywords: string[],
  limit: number = 50
): Promise<RedditPost[]> {
  return searchHNStories(keywords, { limit, tags: ['show_hn'] })
}

/**
 * Search HN comments for pain signals
 */
export async function searchHNComments(
  keywords: string[],
  limit: number = 100
): Promise<RedditComment[]> {
  const query = keywords.join(' ')

  const url = `${HN_API_BASE}/search?query=${encodeURIComponent(query)}&tags=comment&hitsPerPage=${Math.min(limit, 1000)}`

  try {
    const response = await fetch(url)

    if (!response.ok) {
      console.error(`HN API error: ${response.status} ${response.statusText}`)
      return []
    }

    const data: HNSearchResponse = await response.json()

    return data.hits
      .filter((hit) => hit.comment_text)
      .map((hit) => normalizeHNComment(hit))
  } catch (error) {
    console.error('HN comment search error:', error)
    return []
  }
}

/**
 * Get sample posts for preview
 */
export async function getHNSamplePosts(
  keywords: string[],
  limit: number = 5
): Promise<SamplePost[]> {
  const posts = await searchHNStories(keywords, { limit, tags: ['story', 'ask_hn'] })

  return posts.slice(0, limit).map((post) => ({
    title: post.title,
    subreddit: 'hackernews', // Use 'hackernews' as community identifier
    score: post.score,
    permalink: post.permalink,
  }))
}

/**
 * Normalize HN post to RedditPost format for pipeline compatibility
 */
function normalizeHNPost(hit: HNHit): RedditPost {
  const isAskHN = hit._tags?.includes('ask_hn')
  const isShowHN = hit._tags?.includes('show_hn')

  // Determine subreddit-equivalent category
  let category = 'hackernews'
  if (isAskHN) category = 'AskHN'
  else if (isShowHN) category = 'ShowHN'

  return {
    id: hit.objectID,
    title: hit.title || '',
    body: hit.story_text || '', // Ask HN posts have body text
    author: hit.author || 'unknown',
    subreddit: category, // Use category as subreddit for compatibility
    score: hit.points || 0,
    numComments: hit.num_comments || 0,
    createdUtc: hit.created_at_i,
    permalink: `https://news.ycombinator.com/item?id=${hit.objectID}`,
    url: hit.url,
  }
}

/**
 * Normalize HN comment to RedditComment format
 */
function normalizeHNComment(hit: HNHit): RedditComment {
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

/**
 * Check if HN API is available
 */
export async function isHNAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${HN_API_BASE}/search?query=test&hitsPerPage=1`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Get estimated post count for keywords
 */
export async function getHNPostCount(keywords: string[]): Promise<number> {
  const query = keywords.join(' ')

  try {
    const response = await fetch(
      `${HN_API_BASE}/search?query=${encodeURIComponent(query)}&tags=story,ask_hn&hitsPerPage=0`
    )

    if (!response.ok) return 0

    const data: HNSearchResponse = await response.json()
    return data.nbHits
  } catch {
    return 0
  }
}
