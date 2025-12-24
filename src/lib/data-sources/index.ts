/**
 * Data Source Orchestration Layer
 *
 * Main entry point for data fetching across multiple sources.
 * Uses the Phase 3 adapter architecture while maintaining backward compatibility.
 *
 * Supports: Reddit (Arctic Shift, PullPush) and Hacker News (Algolia)
 */

import {
  DataSource,
  SearchParams,
  SearchResult,
  CoverageResult,
  SubredditCoverage,
  RedditPost,
  RedditComment,
  SamplePost,
  AppDetails,
  PostStats,
} from './types'
import { RedditAdapter, redditAdapter } from './adapters/reddit-adapter'
import { HackerNewsAdapter, hackerNewsAdapter } from './adapters/hacker-news-adapter'
import { googlePlayAdapter } from './adapters/google-play-adapter'
import { appStoreAdapter } from './adapters/app-store-adapter'
import { trustpilotAdapter } from './adapters/trustpilot-adapter'
import { PullPushSource } from './pullpush'
import { getCachedData, setCachedData, generateCacheKey } from './cache'
import Anthropic from '@anthropic-ai/sdk'

// =============================================================================
// APP RELEVANCE SCORING
// =============================================================================

/**
 * Scored app with relevance information
 */
export interface ScoredApp extends AppDetails {
  relevanceScore: number      // 0-10 scale
  relevanceReason: string     // Human-readable explanation
}

/**
 * App discovery metadata from hypothesis interpretation
 */
export interface AppDiscoveryContext {
  hypothesis: string
  audience?: string
  problem?: string
  domainKeywords?: string[]
  expectedCategories?: string[]
  antiCategories?: string[]
  competitorApps?: string[]
}

const anthropic = new Anthropic()

/**
 * Score apps for relevance to a hypothesis using Claude Haiku
 * This is the core intelligence that filters out irrelevant apps
 */
export async function scoreAppRelevance(
  apps: AppDetails[],
  context: AppDiscoveryContext
): Promise<ScoredApp[]> {
  if (apps.length === 0) return []

  // Stage 1: Category gate (free, fast) - filter out obvious mismatches
  const categoryFilteredApps = apps.filter(app => {
    // If we have antiCategories, filter them out
    if (context.antiCategories && context.antiCategories.length > 0) {
      const appCategory = app.category.toLowerCase()
      const isAntiCategory = context.antiCategories.some(
        anti => appCategory.includes(anti.toLowerCase())
      )
      if (isAntiCategory) {
        console.log(`[AppRelevance] Category gate filtered: ${app.name} (${app.category})`)
        return false
      }
    }
    return true
  })

  if (categoryFilteredApps.length === 0) {
    console.log('[AppRelevance] All apps filtered by category gate')
    return []
  }

  // Stage 2: LLM relevance scoring (Claude Haiku)
  const appsForScoring = categoryFilteredApps.slice(0, 15) // Limit to 15 for cost efficiency

  const appDescriptions = appsForScoring.map((app, i) => `
APP ${i + 1}:
- Name: ${app.name}
- Developer: ${app.developer}
- Category: ${app.category}
- Rating: ${app.rating.toFixed(1)} stars (${app.reviewCount.toLocaleString()} reviews)
- Price: ${app.price}${app.hasIAP ? ' + In-App Purchases' : ''}
- Description: ${app.description.slice(0, 300)}${app.description.length > 300 ? '...' : ''}
`).join('\n')

  const prompt = `You are evaluating mobile apps for relevance to a business hypothesis.

HYPOTHESIS: "${context.hypothesis}"
${context.audience ? `TARGET AUDIENCE: ${context.audience}` : ''}
${context.problem ? `PROBLEM BEING SOLVED: ${context.problem}` : ''}
${context.domainKeywords?.length ? `KEY DOMAIN TERMS: ${context.domainKeywords.join(', ')}` : ''}
${context.expectedCategories?.length ? `EXPECTED CATEGORIES: ${context.expectedCategories.join(', ')}` : ''}

APPS TO EVALUATE:
${appDescriptions}

For each app, score its relevance (0-10) to the hypothesis:
- 9-10: DIRECT MATCH - App serves this exact audience AND solves this exact problem
- 7-8: STRONG MATCH - App serves similar audience OR solves related problem
- 5-6: PARTIAL MATCH - Some overlap in audience or problem domain
- 3-4: WEAK MATCH - Tangentially related, different primary purpose
- 0-2: NO MATCH - Different audience, different problem, not relevant

Be STRICT. Generic apps that happen to match keywords but serve different audiences should score 3 or below.
Example: For "expat health insurance", a US-only job search app should score 1-2 even if it matches "job" keyword.

Respond ONLY with a JSON array (no markdown, no explanation):
[
  {"appIndex": 1, "score": 8, "reason": "Brief explanation"},
  {"appIndex": 2, "score": 3, "reason": "Brief explanation"}
]`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-latest',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude')
    }

    // Parse JSON response
    let scores: Array<{ appIndex: number; score: number; reason: string }>
    try {
      // Handle potential markdown code blocks
      let jsonStr = content.text.trim()
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim()
      }
      scores = JSON.parse(jsonStr)
    } catch (parseError) {
      console.error('[AppRelevance] Failed to parse scores:', content.text)
      // Fallback: return apps without scores
      return appsForScoring.map(app => ({
        ...app,
        relevanceScore: 5,
        relevanceReason: 'Could not score - using default',
      }))
    }

    // Map scores back to apps
    const scoredApps: ScoredApp[] = appsForScoring.map((app, i) => {
      const scoreData = scores.find(s => s.appIndex === i + 1)
      return {
        ...app,
        relevanceScore: scoreData?.score ?? 5,
        relevanceReason: scoreData?.reason ?? 'No score provided',
      }
    })

    // Sort by relevance score (descending) and filter low scores
    const filteredApps = scoredApps
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .filter(app => app.relevanceScore >= 5) // Only keep score >= 5

    console.log(`[AppRelevance] Scored ${appsForScoring.length} apps, ${filteredApps.length} passed threshold`)
    filteredApps.forEach(app => {
      console.log(`  - ${app.name}: ${app.relevanceScore}/10 (${app.relevanceReason})`)
    })

    return filteredApps
  } catch (error) {
    console.error('[AppRelevance] Scoring failed:', error)
    // Fallback: return apps without filtering
    return appsForScoring.map(app => ({
      ...app,
      relevanceScore: 5,
      relevanceReason: 'Scoring unavailable',
    }))
  }
}

// Re-export the orchestrator and adapters
export { orchestrator, shouldIncludeHN, shouldIncludeGooglePlay, shouldIncludeTrustpilot } from './orchestrator'
export { RedditAdapter, redditAdapter } from './adapters/reddit-adapter'
export { HackerNewsAdapter, hackerNewsAdapter } from './adapters/hacker-news-adapter'
export { googlePlayAdapter } from './adapters/google-play-adapter'
export { appStoreAdapter } from './adapters/app-store-adapter'

// Initialize legacy data sources for Reddit failover
// The new RedditAdapter wraps Arctic Shift; we keep PullPush as fallback
const legacySources: DataSource[] = [
  // Wrap the new adapter in the legacy DataSource interface
  {
    name: redditAdapter.name,
    isAvailable: () => redditAdapter.healthCheck(),
    searchPosts: (params) => redditAdapter.searchPostsLegacy(params),
    searchComments: (params) => redditAdapter.searchCommentsLegacy(params),
    getPostCount: (subreddit, keywords) => redditAdapter.getPostCount(subreddit),
    getPostStats: (subreddit, keywords) => redditAdapter.getPostStats(subreddit),
    getSamplePosts: (subreddit, limit, keywords) =>
      redditAdapter.getSamplePostsWithKeywords(subreddit, limit, keywords),
  },
  new PullPushSource(), // Fallback
]

/**
 * Get the first available data source (for Reddit)
 */
export async function getAvailableSource(): Promise<DataSource | null> {
  for (const source of legacySources) {
    try {
      if (await source.isAvailable()) {
        return source
      }
      console.log(`Data source ${source.name} is unavailable, trying next...`)
    } catch (error) {
      console.warn(`Error checking ${source.name} availability:`, error)
    }
  }
  return null
}

/**
 * Check availability of all sources
 */
export async function checkSourcesStatus(): Promise<Record<string, boolean>> {
  const status: Record<string, boolean> = {}

  // Check Reddit sources
  await Promise.all(
    legacySources.map(async (source) => {
      try {
        status[source.name] = await source.isAvailable()
      } catch {
        status[source.name] = false
      }
    })
  )

  // Check HN
  try {
    status['Hacker News'] = await hackerNewsAdapter.healthCheck()
  } catch {
    status['Hacker News'] = false
  }

  return status
}

/**
 * Fetch Reddit data with automatic failover and caching
 */
export async function fetchRedditData(params: SearchParams): Promise<SearchResult> {
  const { subreddits, keywords, timeRange } = params
  const cacheKey = generateCacheKey(subreddits, keywords, timeRange)

  // 1. Check cache first
  const cached = await getCachedData(cacheKey)

  if (cached && !cached.isExpired) {
    console.log('Using fresh cached data')
    return {
      posts: cached.posts,
      comments: cached.comments,
      metadata: {
        source: 'cache',
        fetchedAt: new Date(cached.fetchedAt),
        isStale: false,
        postsFromCache: true,
        commentsFromCache: true,
      },
    }
  }

  // 2. Try each data source in order
  for (const source of legacySources) {
    try {
      const isUp = await source.isAvailable()
      if (!isUp) {
        console.log(`${source.name} unavailable, trying next source...`)
        continue
      }

      console.log(`Fetching from ${source.name}...`)

      // Fetch posts and comments in parallel
      const [posts, comments] = await Promise.all([
        source.searchPosts(params),
        source.searchComments(params),
      ])

      // 3. Cache the results
      await setCachedData(cacheKey, {
        posts,
        comments,
        subreddits,
        searchQuery: keywords?.join(' '),
      })

      return {
        posts,
        comments,
        metadata: {
          source: source.name,
          fetchedAt: new Date(),
          isStale: false,
        },
      }
    } catch (error) {
      console.error(`${source.name} failed:`, error)
      continue
    }
  }

  // 4. Fall back to stale cache if available
  if (cached) {
    console.log('All sources failed, using stale cached data')
    return {
      posts: cached.posts,
      comments: cached.comments,
      metadata: {
        source: 'cache',
        fetchedAt: new Date(cached.fetchedAt),
        isStale: true,
        warning: 'Using cached data. Live data sources temporarily unavailable.',
        postsFromCache: true,
        commentsFromCache: true,
      },
    }
  }

  // 5. No data available
  console.warn('No data available from any source or cache')
  return {
    posts: [],
    comments: [],
    metadata: {
      source: 'none',
      fetchedAt: new Date(),
      isStale: false,
      warning: 'Reddit data temporarily unavailable. Please try again later.',
    },
  }
}

/**
 * Check data coverage for a hypothesis (used by coverage-check endpoint)
 * Now includes posting velocity for adaptive time-stratified fetching
 */
export async function checkCoverage(
  subreddits: string[],
  keywords?: string[]
): Promise<CoverageResult> {
  const coverageResults: SubredditCoverage[] = []
  let sourceUsed: DataSource | null = null

  // Find an available source
  sourceUsed = await getAvailableSource()

  if (!sourceUsed) {
    return {
      subreddits: [],
      totalEstimatedPosts: 0,
      dataConfidence: 'very_low',
      recommendation: 'refine',
      refinementSuggestions: [
        'Data sources temporarily unavailable',
        'Please try again in a few minutes',
      ],
    }
  }

  // Check post count AND velocity for each subreddit
  for (const subreddit of subreddits) {
    try {
      const stats = await sourceUsed.getPostStats(subreddit, keywords)
      coverageResults.push({
        name: subreddit,
        estimatedPosts: stats.count,
        relevanceScore: stats.count >= 50 ? 'high' : stats.count >= 20 ? 'medium' : 'low',
        postsPerDay: stats.postsPerDay, // NEW: velocity for adaptive fetching
      })
    } catch (error) {
      console.warn(`Failed to get stats for r/${subreddit}:`, error)
      coverageResults.push({
        name: subreddit,
        estimatedPosts: 0,
        relevanceScore: 'low',
        postsPerDay: 1, // Default to medium activity
      })
    }
  }

  // Calculate totals and confidence
  const totalPosts = coverageResults.reduce((sum, s) => sum + s.estimatedPosts, 0)

  let dataConfidence: CoverageResult['dataConfidence']
  let recommendation: CoverageResult['recommendation']
  let refinementSuggestions: string[] = []

  if (totalPosts >= 200) {
    dataConfidence = 'high'
    recommendation = 'proceed'
  } else if (totalPosts >= 100) {
    dataConfidence = 'medium'
    recommendation = 'proceed'
  } else if (totalPosts >= 30) {
    dataConfidence = 'low'
    recommendation = 'caution'
    refinementSuggestions = [
      'Try broader keywords in your hypothesis',
      'Consider adjacent problem spaces',
      'Results may be directional only',
    ]
  } else {
    dataConfidence = 'very_low'
    recommendation = 'refine'
    refinementSuggestions = [
      'Very limited data available for this hypothesis',
      'Try rephrasing with more common terms',
      'Consider if Reddit is the right data source for this market',
    ]
  }

  // Fetch sample posts from top 3 subreddits for live preview
  let samplePosts: SamplePost[] = []
  const topSubreddits = coverageResults
    .filter(s => s.estimatedPosts > 0)
    .sort((a, b) => b.estimatedPosts - a.estimatedPosts)
    .slice(0, 3)

  if (sourceUsed && topSubreddits.length > 0) {
    try {
      const samplePromises = topSubreddits.map(s =>
        sourceUsed!.getSamplePosts(s.name, 2, keywords)
      )
      const sampleResults = await Promise.all(samplePromises)
      samplePosts = sampleResults.flat().slice(0, 5)
    } catch (error) {
      console.warn('Failed to fetch sample posts:', error)
    }
  }

  return {
    subreddits: coverageResults,
    totalEstimatedPosts: totalPosts,
    dataConfidence,
    recommendation,
    refinementSuggestions: refinementSuggestions.length > 0 ? refinementSuggestions : undefined,
    samplePosts: samplePosts.length > 0 ? samplePosts : undefined,
  }
}

/**
 * Extract keywords from hypothesis text
 */
export function extractKeywords(hypothesis: string): string[] {
  const stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
    'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
    'from', 'up', 'about', 'into', 'over', 'after', 'that', 'this',
    'what', 'which', 'who', 'whom', 'how', 'when', 'where', 'why',
    'and', 'or', 'but', 'if', 'because', 'as', 'until', 'while',
    'although', 'since', 'unless', 'so', 'than', 'too', 'very',
    'just', 'also', 'now', 'here', 'there', 'then', 'only', 'own',
    'same', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
    'such', 'no', 'nor', 'not', 'any', 'all', 'their', 'they', 'them',
    'these', 'those', 'i', 'me', 'my', 'we', 'our', 'you', 'your',
    'he', 'him', 'his', 'she', 'her', 'it', 'its', 'people', 'want',
  ])

  return hypothesis
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word))
    .slice(0, 8)
}

/**
 * Fetch Hacker News data for tech-related hypotheses
 * Uses the new HackerNewsAdapter
 */
export async function fetchHNData(
  keywords: string[],
  options: { includeComments?: boolean } = {}
): Promise<{ posts: RedditPost[]; comments: RedditComment[] }> {
  const { includeComments = true } = options

  try {
    // Fetch stories (regular + Ask HN for more pain signals)
    const [stories, askHN, comments] = await Promise.all([
      hackerNewsAdapter.searchStoriesLegacy(keywords, { limit: 50, tags: ['story'] }),
      hackerNewsAdapter.searchAskHNLegacy(keywords, 30),
      includeComments ? hackerNewsAdapter.searchCommentsLegacy(keywords, 50) : Promise.resolve([]),
    ])

    // Combine and dedupe posts
    const allPosts = [...stories, ...askHN]
    const uniquePosts = allPosts.filter(
      (post, index, self) => index === self.findIndex(p => p.id === post.id)
    )

    console.log(`HN: Found ${uniquePosts.length} posts, ${comments.length} comments`)

    return {
      posts: uniquePosts,
      comments,
    }
  } catch (error) {
    console.error('Failed to fetch HN data:', error)
    return { posts: [], comments: [] }
  }
}

/**
 * Fetch Google Play reviews for mobile app validation
 * Uses the GooglePlayAdapter's legacy method for pipeline compatibility
 */
export async function fetchGooglePlayData(
  keywords: string[]
): Promise<{ posts: RedditPost[] }> {
  try {
    if (!(await googlePlayAdapter.healthCheck())) {
      console.log('Google Play adapter unavailable')
      return { posts: [] }
    }

    const posts = await googlePlayAdapter.searchReviewsLegacy(keywords, { limit: 50 })
    console.log(`Google Play: Found ${posts.length} reviews`)
    return { posts }
  } catch (error) {
    console.error('Failed to fetch Google Play data:', error)
    return { posts: [] }
  }
}

/**
 * Fetch App Store reviews for mobile app validation
 * Uses the AppStoreAdapter's legacy method for pipeline compatibility
 */
export async function fetchAppStoreData(
  keywords: string[]
): Promise<{ posts: RedditPost[] }> {
  try {
    if (!(await appStoreAdapter.healthCheck())) {
      console.log('App Store adapter unavailable')
      return { posts: [] }
    }

    const posts = await appStoreAdapter.searchReviewsLegacy(keywords, { limit: 50 })
    console.log(`App Store: Found ${posts.length} reviews`)
    return { posts }
  } catch (error) {
    console.error('Failed to fetch App Store data:', error)
    return { posts: [] }
  }
}

/**
 * Fetch Trustpilot reviews for B2B/SaaS validation
 * Uses the TrustpilotAdapter's legacy method for pipeline compatibility
 */
export async function fetchTrustpilotData(
  keywords: string[]
): Promise<{ posts: RedditPost[] }> {
  try {
    if (!(await trustpilotAdapter.healthCheck())) {
      console.log('Trustpilot adapter unavailable')
      return { posts: [] }
    }

    const posts = await trustpilotAdapter.searchReviewsLegacy(keywords, { limit: 50 })
    console.log(`Trustpilot: Found ${posts.length} reviews`)
    return { posts }
  } catch (error) {
    console.error('Failed to fetch Trustpilot data:', error)
    return { posts: [] }
  }
}

/**
 * Fetch data from all relevant sources based on hypothesis
 * @param includeHN - Optional explicit control for HN inclusion
 * @param includeGooglePlay - Optional explicit control for Google Play inclusion
 * @param includeAppStore - Optional explicit control for App Store inclusion
 * @param includeTrustpilot - Optional explicit control for Trustpilot inclusion
 */
export async function fetchMultiSourceData(
  params: SearchParams,
  hypothesis: string,
  includeHN?: boolean,
  includeGooglePlay?: boolean,
  includeAppStore?: boolean,
  includeTrustpilot?: boolean
): Promise<SearchResult & { sources: string[] }> {
  const { shouldIncludeHN } = await import('./orchestrator')
  const sourcesUsed: string[] = []

  // Always fetch Reddit data
  const redditResult = await fetchRedditData(params)
  if (redditResult.posts.length > 0 || redditResult.comments.length > 0) {
    sourcesUsed.push(redditResult.metadata.source === 'cache' ? 'Reddit (cached)' : 'Reddit')
  }

  let allPosts = [...redditResult.posts]
  let allComments = [...redditResult.comments]

  const keywords = extractKeywords(hypothesis)

  // Add HN data if explicitly requested OR if auto-detected as tech-related
  const shouldFetchHN = includeHN !== undefined ? includeHN : shouldIncludeHN(hypothesis)
  if (shouldFetchHN) {
    if (await hackerNewsAdapter.healthCheck()) {
      const hnData = await fetchHNData(keywords)

      if (hnData.posts.length > 0) {
        allPosts = [...allPosts, ...hnData.posts]
        allComments = [...allComments, ...hnData.comments]
        sourcesUsed.push('Hacker News')
        console.log(`Added ${hnData.posts.length} HN posts to analysis`)
      }
    }
  }

  // Add Google Play data if explicitly requested (no auto-include - too noisy)
  if (includeGooglePlay) {
    const googlePlayData = await fetchGooglePlayData(keywords)

    if (googlePlayData.posts.length > 0) {
      allPosts = [...allPosts, ...googlePlayData.posts]
      sourcesUsed.push('Google Play')
      console.log(`Added ${googlePlayData.posts.length} Google Play reviews to analysis`)
    }
  }

  // Add App Store data if explicitly requested (no auto-include - too noisy)
  if (includeAppStore) {
    const appStoreData = await fetchAppStoreData(keywords)

    if (appStoreData.posts.length > 0) {
      allPosts = [...allPosts, ...appStoreData.posts]
      sourcesUsed.push('App Store')
      console.log(`Added ${appStoreData.posts.length} App Store reviews to analysis`)
    }
  }

  // Add Trustpilot data if explicitly requested or auto-detected for B2B/SaaS
  const { shouldIncludeTrustpilot } = await import('./orchestrator')
  const shouldFetchTrustpilot = includeTrustpilot !== undefined ? includeTrustpilot : shouldIncludeTrustpilot(hypothesis)
  if (shouldFetchTrustpilot) {
    const trustpilotData = await fetchTrustpilotData(keywords)

    if (trustpilotData.posts.length > 0) {
      allPosts = [...allPosts, ...trustpilotData.posts]
      sourcesUsed.push('Trustpilot')
      console.log(`Added ${trustpilotData.posts.length} Trustpilot reviews to analysis`)
    }
  }

  return {
    posts: allPosts,
    comments: allComments,
    metadata: {
      ...redditResult.metadata,
      source: sourcesUsed.join(' + ') || 'none',
    },
    sources: sourcesUsed,
  }
}

/**
 * Check HN coverage for a hypothesis
 * Uses the new HackerNewsAdapter
 */
export async function checkHNCoverage(hypothesis: string): Promise<{
  available: boolean
  estimatedPosts: number
  samplePosts: SamplePost[]
}> {
  if (!(await hackerNewsAdapter.healthCheck())) {
    return { available: false, estimatedPosts: 0, samplePosts: [] }
  }

  const [count, samples] = await Promise.all([
    hackerNewsAdapter.getPostCount(hypothesis),
    hackerNewsAdapter.getSamplePosts(hypothesis, 3),
  ])

  return {
    available: true,
    estimatedPosts: count,
    samplePosts: samples,
  }
}

/**
 * Check Google Play coverage for a hypothesis
 * Returns app review data for mobile app validation
 * Now with smart LLM-based relevance scoring
 */
export async function checkGooglePlayCoverage(
  hypothesis: string,
  appDiscoveryContext?: AppDiscoveryContext
): Promise<{
  available: boolean
  estimatedPosts: number
  samplePosts: SamplePost[]
  apps: ScoredApp[]
}> {
  if (!(await googlePlayAdapter.healthCheck())) {
    return { available: false, estimatedPosts: 0, samplePosts: [], apps: [] }
  }

  // Build search options from context
  const searchOptions = appDiscoveryContext ? {
    maxApps: 12,
    domainKeywords: appDiscoveryContext.domainKeywords,
    competitorApps: appDiscoveryContext.competitorApps,
  } : { maxApps: 10 }

  const [appsResult, samples] = await Promise.all([
    googlePlayAdapter.searchAppsWithDetails(hypothesis, searchOptions),
    googlePlayAdapter.getSamplePosts(hypothesis, 3),
  ])

  // Score apps for relevance if we have context
  let scoredApps: ScoredApp[]
  if (appDiscoveryContext && appsResult.apps.length > 0) {
    scoredApps = await scoreAppRelevance(appsResult.apps, appDiscoveryContext)
    console.log(`[GooglePlay] Scored ${appsResult.apps.length} apps, ${scoredApps.length} passed relevance filter`)
  } else {
    // No context - return apps with default scores
    scoredApps = appsResult.apps.map(app => ({
      ...app,
      relevanceScore: 5,
      relevanceReason: 'No scoring context available',
    }))
  }

  // Calculate total reviews from scored apps only
  const totalReviews = scoredApps.reduce((sum, app) => sum + app.reviewCount, 0)

  return {
    available: true,
    estimatedPosts: totalReviews,
    samplePosts: samples,
    apps: scoredApps,
  }
}

/**
 * Check App Store coverage for a hypothesis
 * Returns iOS app review data for mobile app validation
 * Now with smart LLM-based relevance scoring
 */
export async function checkAppStoreCoverage(
  hypothesis: string,
  appDiscoveryContext?: AppDiscoveryContext
): Promise<{
  available: boolean
  estimatedPosts: number
  samplePosts: SamplePost[]
  apps: ScoredApp[]
}> {
  if (!(await appStoreAdapter.healthCheck())) {
    return { available: false, estimatedPosts: 0, samplePosts: [], apps: [] }
  }

  // Build search options from context
  const searchOptions = appDiscoveryContext ? {
    maxApps: 12,
    domainKeywords: appDiscoveryContext.domainKeywords,
    competitorApps: appDiscoveryContext.competitorApps,
  } : { maxApps: 10 }

  const [appsResult, samples] = await Promise.all([
    appStoreAdapter.searchAppsWithDetails(hypothesis, searchOptions),
    appStoreAdapter.getSamplePosts(hypothesis, 3),
  ])

  // Score apps for relevance if we have context
  let scoredApps: ScoredApp[]
  if (appDiscoveryContext && appsResult.apps.length > 0) {
    scoredApps = await scoreAppRelevance(appsResult.apps, appDiscoveryContext)
    console.log(`[AppStore] Scored ${appsResult.apps.length} apps, ${scoredApps.length} passed relevance filter`)
  } else {
    // No context - return apps with default scores
    scoredApps = appsResult.apps.map(app => ({
      ...app,
      relevanceScore: 5,
      relevanceReason: 'No scoring context available',
    }))
  }

  // Calculate total reviews from scored apps only
  const totalReviews = scoredApps.reduce((sum, app) => sum + app.reviewCount, 0)

  return {
    available: true,
    estimatedPosts: totalReviews,
    samplePosts: samples,
    apps: scoredApps,
  }
}

// ===========================================================================
// LEGACY EXPORTS (for backward compatibility)
// These functions are used by existing code and should continue to work
// ===========================================================================

/**
 * @deprecated Use hackerNewsAdapter.searchStoriesLegacy instead
 */
export async function searchHNStories(
  keywords: string[],
  options?: { limit?: number; tags?: string[] }
): Promise<RedditPost[]> {
  return hackerNewsAdapter.searchStoriesLegacy(keywords, options)
}

/**
 * @deprecated Use hackerNewsAdapter.searchAskHNLegacy instead
 */
export async function searchAskHN(keywords: string[], limit?: number): Promise<RedditPost[]> {
  return hackerNewsAdapter.searchAskHNLegacy(keywords, limit)
}

/**
 * @deprecated Use hackerNewsAdapter.searchCommentsLegacy instead
 */
export async function searchHNComments(keywords: string[], limit?: number): Promise<RedditComment[]> {
  return hackerNewsAdapter.searchCommentsLegacy(keywords, limit)
}

/**
 * @deprecated Use hackerNewsAdapter.healthCheck instead
 */
export async function isHNAvailable(): Promise<boolean> {
  return hackerNewsAdapter.healthCheck()
}

// Re-export types for convenience
export * from './types'
export { generateCacheKey } from './cache'
