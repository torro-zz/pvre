/**
 * AI Discussion Trend Module
 *
 * Tracks how much people discuss problems in AI-related contexts on Reddit.
 * Uses a dual-strategy approach:
 *   - Strategy A: Search AI-specific subreddits for problem keywords (high precision)
 *   - Strategy B: Search all subreddits for problem + AI terms (high recall)
 *
 * This provides a unique "AI interest" signal that's more relevant for PVRE
 * than generic Google Trends data.
 */

import { searchPosts } from '@/lib/arctic-shift/client'
import type { RedditPost } from '@/lib/arctic-shift/types'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'

// =============================================================================
// CONFIGURATION
// =============================================================================

// AI-specific subreddits (high precision)
const AI_SUBREDDITS = [
  'ChatGPT',
  'ClaudeAI',
  'LocalLLaMA',
  'artificial',
  'OpenAI',
  'MachineLearning',
  'ArtificialIntelligence',
]

// AI terms to combine with problem keywords for global search
const AI_TERMS = ['ChatGPT', 'Claude', 'GPT', 'AI', 'LLM']

// Negative terms to filter out false positives
const NEGATIVE_TERMS = ['stock', 'crypto', 'NFT', 'trading bot', 'pump', 'dump']

// Minimum posts threshold for reliable trend calculation
const MIN_VOLUME_THRESHOLD = 15

// Cache TTL in milliseconds (24 hours)
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

// Debug logging - set DEBUG_AI_TREND=true to enable verbose logs
const DEBUG = process.env.DEBUG_AI_TREND === 'true'

// Common stop words to filter out when extracting tokens
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who',
  'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few',
  'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
  'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now',
])

// Short domain-specific tokens that should NOT be filtered out (important signal)
const ALLOWED_SHORT_TOKENS = new Set([
  'ai', 'ml', 'llm', 'nlp', 'cv', 'dl',  // AI/ML terms
  'ui', 'ux', 'api', 'sdk', 'cli',       // Tech terms
  'saas', 'b2b', 'b2c', 'crm', 'erp',    // Business terms
  'ios', 'aws', 'gcp',                    // Platform terms
])

// Special tokens with punctuation that should be preserved as-is
const PUNCTUATION_TOKENS: Record<string, string> = {
  'c++': 'cpp',
  'c#': 'csharp',
  '.net': 'dotnet',
  'node.js': 'nodejs',
  'vue.js': 'vuejs',
  'react.js': 'reactjs',
  'next.js': 'nextjs',
  'r&d': 'research',
}

// =============================================================================
// TYPES
// =============================================================================

export interface AITrendResult {
  keywords: string[]
  // 30-day metrics (responsive)
  current30d: number
  baseline30d: number
  change30d: number
  // 90-day metrics (stable)
  current90d: number
  baseline90d: number
  change90d: number
  // Primary trend (uses 30d for direction, 90d for confidence)
  trend: 'rising' | 'stable' | 'falling'
  percentageChange: number
  confidence: 'high' | 'medium' | 'low'
  totalVolume: number
  dataAvailable: boolean
  insufficientData: boolean
  sources: string[]
  // For potential future visualization
  weeklyBuckets?: { week: string; count: number }[]
}

interface PostWithWeight {
  post: RedditPost
  weight: number
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate engagement weight for a post
 * Uses log scale to prevent viral posts from dominating
 */
function calculateWeight(score: number, numComments: number): number {
  const raw = Math.log(1 + Math.max(0, score)) + Math.log(1 + Math.max(0, numComments))
  return Math.min(raw, 10) // Cap at 10 to prevent outlier distortion
}

/**
 * Check if post contains negative terms (false positive filter)
 */
function containsNegativeTerms(post: RedditPost): boolean {
  const text = `${post.title} ${post.selftext}`.toLowerCase()
  return NEGATIVE_TERMS.some((term) => text.includes(term.toLowerCase()))
}

/**
 * Check if post mentions AI terms (for global search validation)
 */
function containsAITerms(post: RedditPost): boolean {
  const text = `${post.title} ${post.selftext}`.toLowerCase()
  return AI_TERMS.some((term) => text.toLowerCase().includes(term.toLowerCase()))
}

/**
 * Generate cache key for trend data
 */
function generateCacheKey(keywords: string[]): string {
  const normalized = keywords.map((k) => k.toLowerCase().trim()).sort().join('|')
  const hash = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16)
  return `ai_trend:${hash}`
}

/**
 * Get Unix timestamp for N days ago
 */
function daysAgo(days: number): number {
  return Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000)
}

/**
 * Calculate percentage change between two values
 */
function calculateChange(current: number, baseline: number): number {
  if (baseline === 0) {
    return current > 0 ? 100 : 0
  }
  return Math.round(((current - baseline) / baseline) * 100)
}

/**
 * Determine trend direction from percentage change
 */
function getTrendDirection(change: number): 'rising' | 'stable' | 'falling' {
  if (change > 15) return 'rising'
  if (change < -15) return 'falling'
  return 'stable'
}

/**
 * Extract single-word tokens from keywords (including multi-word phrases)
 * Filters out stop words and short tokens, returns unique tokens capped at limit
 *
 * Handles:
 * - Multi-word phrases → individual tokens
 * - Short domain terms (AI, ML, LLM) → preserved via allowlist
 * - Punctuation tokens (C++, C#, node.js) → normalized (cpp, csharp, nodejs)
 */
function extractSearchTokens(keywords: string[], limit: number = 3): string[] {
  const tokens = new Set<string>()

  for (const keyword of keywords) {
    let lowerKeyword = keyword.toLowerCase().trim()

    // Check for punctuation tokens first (exact match for whole keyword)
    if (PUNCTUATION_TOKENS[lowerKeyword]) {
      tokens.add(PUNCTUATION_TOKENS[lowerKeyword])
      continue
    }

    // Check for punctuation tokens within the phrase and replace them
    // e.g., "node.js sdk" → extract "nodejs" then continue with "sdk"
    for (const [punctToken, normalized] of Object.entries(PUNCTUATION_TOKENS)) {
      if (lowerKeyword.includes(punctToken)) {
        tokens.add(normalized)
        // Remove the matched token from the string to avoid double-processing
        lowerKeyword = lowerKeyword.replace(punctToken, ' ')
      }
    }

    // Split on whitespace and common separators
    const words = lowerKeyword.split(/[\s\-_,]+/)

    for (const word of words) {
      // Clean: remove leading/trailing punctuation but preserve internal structure
      const cleaned = word.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '').trim()
      if (!cleaned) continue

      // Check punctuation tokens for individual words too
      if (PUNCTUATION_TOKENS[cleaned]) {
        tokens.add(PUNCTUATION_TOKENS[cleaned])
        continue
      }

      // Skip stop words
      if (STOP_WORDS.has(cleaned)) continue

      // Allow short tokens if they're in the allowlist (AI, ML, etc.)
      if (cleaned.length <= 2 && !ALLOWED_SHORT_TOKENS.has(cleaned)) continue

      // Must be alphanumeric (or in allowlist)
      if (!/^[a-z0-9]+$/i.test(cleaned) && !ALLOWED_SHORT_TOKENS.has(cleaned)) continue

      tokens.add(cleaned)
    }
  }

  // Return as array, capped at limit
  return Array.from(tokens).slice(0, limit)
}

/**
 * Debug logger - only logs when DEBUG_AI_TREND=true
 */
function debugLog(message: string, ...args: unknown[]): void {
  if (DEBUG) {
    console.log(message, ...args)
  }
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Check if a term is purely alphanumeric (safe for word-boundary matching)
 */
function isAlphanumericOnly(term: string): boolean {
  return /^[a-z0-9]+$/i.test(term)
}

/**
 * Check if text contains a term, using word-boundary matching for short alphanumeric tokens
 * to prevent false positives (e.g., "net" matching "internet")
 *
 * - Short alphanumeric tokens (<=4 chars): word-boundary match (whole word only)
 * - Tokens with special chars (c++, c#, .net): escaped includes() match
 * - Longer tokens/phrases: simple includes() for flexibility
 */
function textContainsTerm(text: string, term: string): boolean {
  // For short alphanumeric tokens, use word-boundary matching
  if (term.length <= 4 && isAlphanumericOnly(term)) {
    const regex = new RegExp(`\\b${term}\\b`, 'i')
    return regex.test(text)
  }

  // For tokens with special characters, use escaped regex for exact match
  // This handles c++, c#, .net, etc. safely
  if (!isAlphanumericOnly(term) && !term.includes(' ')) {
    const escaped = escapeRegex(term)
    const regex = new RegExp(escaped, 'i')
    return regex.test(text)
  }

  // For longer terms or phrases, simple includes is fine
  return text.includes(term)
}

// =============================================================================
// SEARCH FUNCTIONS
// =============================================================================

/**
 * Strategy A: Search AI-specific subreddits for problem keywords
 * High precision - people discussing problems in AI contexts
 *
 * Arctic Shift times out on multi-word title queries, so we extract
 * single-word tokens from all keywords (including phrases).
 */
async function searchAISubreddits(
  keywords: string[],
  afterTimestamp: number,
  beforeTimestamp: number
): Promise<RedditPost[]> {
  // Extract single-word tokens from all keywords (handles multi-word phrases)
  const searchTokens = extractSearchTokens(keywords, 3)

  if (searchTokens.length === 0) {
    console.log('[AITrend:StrategyA] Skipping: no valid tokens extracted from keywords')
    return []
  }

  const allPosts: RedditPost[] = []
  const startTime = Date.now()
  const totalCalls = AI_SUBREDDITS.length * searchTokens.length

  console.log(`[AITrend:StrategyA] Starting: ${AI_SUBREDDITS.length} subreddits × ${searchTokens.length} tokens = ${totalCalls} API calls (tokens: ${searchTokens.join(', ')})`)

  let callCount = 0
  for (const subreddit of AI_SUBREDDITS) {
    for (const token of searchTokens) {
      callCount++
      const callStart = Date.now()
      try {
        // Search in title (most relevant)
        const posts = await searchPosts({
          subreddit,
          title: token,
          after: String(afterTimestamp),
          before: String(beforeTimestamp),
          limit: 100,
          sort: 'desc',
        })
        allPosts.push(...posts)
        debugLog(`[AITrend:StrategyA] Call ${callCount}/${totalCalls}: r/${subreddit} "${token}" - ${posts.length} posts, ${Date.now() - callStart}ms`)
      } catch (error) {
        console.warn(`[AITrend:StrategyA] Call ${callCount}/${totalCalls} FAILED (${Date.now() - callStart}ms): r/${subreddit} "${token}":`, error)
      }
    }
  }

  console.log(`[AITrend:StrategyA] Complete: ${callCount} calls, ${allPosts.length} posts, ${Date.now() - startTime}ms total`)
  return allPosts
}

/**
 * Strategy B: Search AI subreddits broadly for problem keywords
 * High recall - catches discussions about using AI for this problem
 *
 * Note: Arctic Shift has issues with multi-word queries, so we search
 * AI subreddits and filter by keyword + AI term presence in results.
 * Posts in AI subreddits that don't mention AI terms are filtered out
 * to ensure we're capturing genuine AI-related discussions.
 *
 * Matching uses BOTH original phrases AND extracted tokens for better recall.
 */
async function searchGlobalWithAITerms(
  keywords: string[],
  afterTimestamp: number,
  beforeTimestamp: number
): Promise<RedditPost[]> {
  const allPosts: RedditPost[] = []
  const startTime = Date.now()

  // Build match terms: original keywords + extracted tokens for better recall
  const tokens = extractSearchTokens(keywords, 5)
  const matchTerms = [...new Set([...keywords.map((k) => k.toLowerCase()), ...tokens])]

  // Search AI subreddits more broadly, then filter
  const subredditsToSearch = AI_SUBREDDITS.slice(0, 4) // Top 4 most active
  console.log(`[AITrend:StrategyB] Starting: ${subredditsToSearch.length} subreddits, matching ${matchTerms.length} terms`)

  let callCount = 0
  for (const subreddit of subredditsToSearch) {
    callCount++
    const callStart = Date.now()
    try {
      const posts = await searchPosts({
        subreddit,
        after: String(afterTimestamp),
        before: String(beforeTimestamp),
        limit: 100,
        sort: 'desc',
      })

      // Filter to posts that mention keywords/tokens AND AI terms
      // This ensures we're capturing genuine AI-related problem discussions
      // Uses word-boundary matching for short tokens to prevent false positives
      const relevantPosts = posts.filter((post) => {
        const text = `${post.title} ${post.selftext}`.toLowerCase()
        const hasKeyword = matchTerms.some((term) => textContainsTerm(text, term))
        const hasAITerm = containsAITerms(post)
        return hasKeyword && hasAITerm
      })

      allPosts.push(...relevantPosts)
      debugLog(`[AITrend:StrategyB] Call ${callCount}/${subredditsToSearch.length}: r/${subreddit} - ${posts.length} fetched, ${relevantPosts.length} relevant, ${Date.now() - callStart}ms`)
    } catch (error) {
      console.warn(`[AITrend:StrategyB] Call ${callCount}/${subredditsToSearch.length} FAILED (${Date.now() - callStart}ms): r/${subreddit}:`, error)
    }
  }

  console.log(`[AITrend:StrategyB] Complete: ${callCount} calls, ${allPosts.length} posts, ${Date.now() - startTime}ms total`)
  return allPosts
}

/**
 * Fetch and process posts for a time window
 */
async function getPostsForWindow(
  keywords: string[],
  afterTimestamp: number,
  beforeTimestamp: number
): Promise<PostWithWeight[]> {
  // Run both strategies in parallel
  const [strategyAPosts, strategyBPosts] = await Promise.all([
    searchAISubreddits(keywords, afterTimestamp, beforeTimestamp),
    searchGlobalWithAITerms(keywords, afterTimestamp, beforeTimestamp),
  ])

  // Combine and dedupe by post ID
  const seenIds = new Set<string>()
  const uniquePosts: RedditPost[] = []

  // Add Strategy A posts (higher precision)
  for (const post of strategyAPosts) {
    if (!seenIds.has(post.id)) {
      seenIds.add(post.id)
      uniquePosts.push(post)
    }
  }

  // Add Strategy B posts that aren't duplicates
  for (const post of strategyBPosts) {
    if (!seenIds.has(post.id)) {
      seenIds.add(post.id)
      uniquePosts.push(post)
    }
  }

  // Filter out false positives and calculate weights
  const weightedPosts: PostWithWeight[] = []
  for (const post of uniquePosts) {
    if (!containsNegativeTerms(post)) {
      weightedPosts.push({
        post,
        weight: calculateWeight(post.score, post.num_comments),
      })
    }
  }

  return weightedPosts
}

/**
 * Calculate weighted sum for a set of posts
 */
function calculateWeightedSum(posts: PostWithWeight[]): number {
  return posts.reduce((sum, p) => sum + p.weight, 0)
}

// =============================================================================
// CACHE FUNCTIONS
// =============================================================================

/**
 * Get cached trend data from Supabase
 */
async function getCachedTrend(cacheKey: string): Promise<AITrendResult | null> {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('reddit_cache')
      .select('*')
      .eq('cache_key', cacheKey)
      .single()

    if (error || !data) {
      return null
    }

    const expiresAt = data.expires_at ? new Date(data.expires_at) : new Date(0)
    if (expiresAt < new Date()) {
      return null // Expired
    }

    // Posts field contains our trend result
    return data.posts as unknown as AITrendResult
  } catch (error) {
    console.warn('[AITrend] Cache lookup failed:', error)
    return null
  }
}

/**
 * Save trend data to Supabase cache
 */
async function setCachedTrend(cacheKey: string, result: AITrendResult): Promise<void> {
  try {
    const supabase = createAdminClient()

    const expiresAt = new Date(Date.now() + CACHE_TTL_MS)

    await supabase.from('reddit_cache').upsert(
      {
        cache_key: cacheKey,
        subreddit: 'ai_trends', // For backwards compatibility
        search_query: result.keywords.join(','),
        posts: JSON.parse(JSON.stringify(result)), // Store trend result
        comments: [], // Not used for trends
        fetched_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      },
      {
        onConflict: 'cache_key',
      }
    )
  } catch (error) {
    console.warn('[AITrend] Cache write failed:', error)
  }
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

/**
 * Get AI Discussion Trend for given keywords
 *
 * Analyzes Reddit discussions about problems in AI-related contexts
 * to determine if interest is rising, stable, or falling.
 */
export async function getAIDiscussionTrend(keywords: string[]): Promise<AITrendResult | null> {
  if (keywords.length === 0) {
    return null
  }

  // Clean and normalize keywords
  const cleanKeywords = keywords
    .map((k) => k.toLowerCase().trim())
    .filter((k) => k.length > 2)
    .slice(0, 5) // Max 5 keywords

  if (cleanKeywords.length === 0) {
    return null
  }

  // Check cache first
  const cacheKey = generateCacheKey(cleanKeywords)
  const cached = await getCachedTrend(cacheKey)
  if (cached) {
    console.log('[AITrend] Using cached trend data for:', cleanKeywords)
    return cached
  }

  console.log('[AITrend] Fetching fresh trend data for:', cleanKeywords)

  try {
    const now = Math.floor(Date.now() / 1000)

    // Define time windows
    const windows = {
      current30d: { after: daysAgo(30), before: now },
      baseline30d: { after: daysAgo(60), before: daysAgo(30) },
      current90d: { after: daysAgo(90), before: now },
      baseline90d: { after: daysAgo(180), before: daysAgo(90) },
    }

    // Fetch posts for all windows sequentially to avoid overwhelming Arctic Shift API
    // (Parallel requests caused 422 "Timeout" errors - see KNOWN_ISSUES.md)
    let current30dPosts: PostWithWeight[] = []
    let baseline30dPosts: PostWithWeight[] = []
    let current90dPosts: PostWithWeight[] = []
    let baseline90dPosts: PostWithWeight[] = []

    const totalStart = Date.now()
    debugLog(`\n[AITrend] Starting 4 sequential window fetches for keywords: ${cleanKeywords.join(', ')}`)

    let windowStart = Date.now()
    try {
      debugLog(`[AITrend] Window 1/4: current30d...`)
      current30dPosts = await getPostsForWindow(cleanKeywords, windows.current30d.after, windows.current30d.before)
      debugLog(`[AITrend] Window 1/4 complete: ${current30dPosts.length} posts, ${Date.now() - windowStart}ms`)
    } catch (error) {
      console.warn(`[AITrend] Window 1/4 FAILED after ${Date.now() - windowStart}ms:`, error)
    }

    windowStart = Date.now()
    try {
      debugLog(`[AITrend] Window 2/4: baseline30d...`)
      baseline30dPosts = await getPostsForWindow(cleanKeywords, windows.baseline30d.after, windows.baseline30d.before)
      debugLog(`[AITrend] Window 2/4 complete: ${baseline30dPosts.length} posts, ${Date.now() - windowStart}ms`)
    } catch (error) {
      console.warn(`[AITrend] Window 2/4 FAILED after ${Date.now() - windowStart}ms:`, error)
    }

    windowStart = Date.now()
    try {
      debugLog(`[AITrend] Window 3/4: current90d...`)
      current90dPosts = await getPostsForWindow(cleanKeywords, windows.current90d.after, windows.current90d.before)
      debugLog(`[AITrend] Window 3/4 complete: ${current90dPosts.length} posts, ${Date.now() - windowStart}ms`)
    } catch (error) {
      console.warn(`[AITrend] Window 3/4 FAILED after ${Date.now() - windowStart}ms:`, error)
    }

    windowStart = Date.now()
    try {
      debugLog(`[AITrend] Window 4/4: baseline90d...`)
      baseline90dPosts = await getPostsForWindow(cleanKeywords, windows.baseline90d.after, windows.baseline90d.before)
      debugLog(`[AITrend] Window 4/4 complete: ${baseline90dPosts.length} posts, ${Date.now() - windowStart}ms`)
    } catch (error) {
      console.warn(`[AITrend] Window 4/4 FAILED after ${Date.now() - windowStart}ms:`, error)
    }

    console.log(`[AITrend] Fetched 4 windows in ${Date.now() - totalStart}ms (${current30dPosts.length + baseline30dPosts.length + current90dPosts.length + baseline90dPosts.length} total posts)`)

    // Calculate weighted sums
    const current30d = calculateWeightedSum(current30dPosts)
    const baseline30d = calculateWeightedSum(baseline30dPosts)
    const current90d = calculateWeightedSum(current90dPosts)
    const baseline90d = calculateWeightedSum(baseline90dPosts)

    // Calculate changes
    const change30d = calculateChange(current30d, baseline30d)
    const change90d = calculateChange(current90d, baseline90d)

    // Total volume for confidence calculation
    const totalVolume = current30dPosts.length + baseline30dPosts.length

    // Check minimum volume threshold
    const insufficientData = totalVolume < MIN_VOLUME_THRESHOLD

    // Determine confidence based on volume
    let confidence: 'high' | 'medium' | 'low'
    if (totalVolume >= 50) {
      confidence = 'high'
    } else if (totalVolume >= MIN_VOLUME_THRESHOLD) {
      confidence = 'medium'
    } else {
      confidence = 'low'
    }

    // Primary trend uses 30d for responsiveness
    // But if 30d and 90d disagree significantly, use 90d (more stable)
    let primaryChange = change30d
    const trend30d = getTrendDirection(change30d)
    const trend90d = getTrendDirection(change90d)

    // If 30d and 90d disagree, use 90d for stability
    if (trend30d !== trend90d && Math.abs(change90d) > 10) {
      primaryChange = change90d
    }

    const trend = getTrendDirection(primaryChange)

    // Collect unique subreddits from posts
    const sourcesSet = new Set<string>()
    ;[...current30dPosts, ...baseline30dPosts].forEach((p) => {
      sourcesSet.add(`r/${p.post.subreddit}`)
    })
    const sources = Array.from(sourcesSet).slice(0, 5)

    const result: AITrendResult = {
      keywords: cleanKeywords,
      current30d: Math.round(current30d * 100) / 100,
      baseline30d: Math.round(baseline30d * 100) / 100,
      change30d,
      current90d: Math.round(current90d * 100) / 100,
      baseline90d: Math.round(baseline90d * 100) / 100,
      change90d,
      trend,
      percentageChange: primaryChange,
      confidence,
      totalVolume,
      dataAvailable: true,
      insufficientData,
      sources,
    }

    // Cache the result
    await setCachedTrend(cacheKey, result)

    console.log('[AITrend] Trend calculated:', {
      keywords: cleanKeywords,
      trend,
      change30d,
      change90d,
      volume: totalVolume,
      confidence,
    })

    return result
  } catch (error) {
    console.error('[AITrend] Failed to calculate trend:', error)
    return null
  }
}

/**
 * Clear trend cache (for testing/debugging)
 */
export async function clearTrendCache(keywords: string[]): Promise<void> {
  const cacheKey = generateCacheKey(keywords)
  try {
    const supabase = createAdminClient()
    await supabase.from('reddit_cache').delete().eq('cache_key', cacheKey)
  } catch (error) {
    console.warn('[AITrend] Failed to clear cache:', error)
  }
}
