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

// Stop words to filter out for keyword extraction
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'to', 'of',
  'in', 'for', 'on', 'with', 'at', 'by', 'from', 'up', 'about', 'into',
  'over', 'after', 'that', 'this', 'what', 'which', 'who', 'how', 'when',
  'where', 'why', 'and', 'or', 'but', 'if', 'because', 'as', 'until',
  'while', 'so', 'than', 'too', 'very', 'just', 'also', 'now', 'here',
  'there', 'then', 'only', 'own', 'same', 'both', 'each', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'any', 'all',
  'their', 'they', 'them', 'these', 'those', 'i', 'me', 'my', 'we', 'our',
  'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its', 'people',
  'want', 'help', 'app', 'tool', 'platform', 'using', 'use', 'make',
])

// Pain-signal words that indicate real problems (prioritize these in search)
const PAIN_WORDS = new Set([
  'burnout', 'struggle', 'problem', 'issue', 'frustrated', 'frustrating',
  'difficult', 'challenging', 'overwhelmed', 'stressed', 'anxiety', 'stuck',
  'failing', 'failed', 'broken', 'pain', 'hate', 'terrible', 'awful',
  'confused', 'lost', 'tired', 'exhausted', 'overworked', 'chaos', 'mess',
])

/**
 * Extract key search terms from hypothesis for HN search
 * HN's Algolia uses AND for multi-word queries, so we need short, focused queries
 * Prioritizes pain-signal words over generic terms
 */
function extractHNSearchTerms(hypothesis: string): string {
  const words = hypothesis
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w))

  // Separate pain words from regular words
  const painWords = words.filter(w => PAIN_WORDS.has(w))
  const regularWords = words.filter(w => !PAIN_WORDS.has(w))

  // Prioritize: audience/domain word + pain word
  // e.g., "freelancer burnout" is better than "productivity freelancers"
  const result: string[] = []

  // Add first audience/domain word
  if (regularWords.length > 0) {
    result.push(regularWords[0])
  }

  // Add pain word if we have one
  if (painWords.length > 0) {
    result.push(painWords[0])
  }

  // Fill remaining slot with another regular word
  if (result.length < 2 && regularWords.length > 1) {
    result.push(regularWords[1])
  }

  return result.join(' ')
}

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
 * @param hypothesis - Natural language hypothesis to search for
 */
export async function getHNSamplePosts(
  hypothesis: string,
  limit: number = 5
): Promise<SamplePost[]> {
  // Extract key terms - HN search uses AND, so fewer words = more results
  const searchTerms = extractHNSearchTerms(hypothesis)

  if (!searchTerms) return []

  // Use 'story' tag only - it includes all post types (Ask HN, Show HN, etc.)
  const posts = await searchHNStories([searchTerms], { limit, tags: ['story'] })

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
 * Get estimated post count for a hypothesis
 * @param hypothesis - Natural language hypothesis to search for
 */
export async function getHNPostCount(hypothesis: string): Promise<number> {
  // Extract key terms - HN search uses AND, so fewer words = more results
  const searchTerms = extractHNSearchTerms(hypothesis)

  if (!searchTerms) return 0

  try {
    // Use 'story' tag only - it includes all post types (Ask HN, Show HN, etc.)
    const response = await fetch(
      `${HN_API_BASE}/search?query=${encodeURIComponent(searchTerms)}&tags=story&hitsPerPage=0`
    )

    if (!response.ok) return 0

    const data: HNSearchResponse = await response.json()
    return data.nbHits
  } catch {
    return 0
  }
}
