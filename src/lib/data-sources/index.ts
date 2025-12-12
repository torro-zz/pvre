// Data Source Orchestrator
// Manages multiple Reddit data sources with automatic failover and caching

import {
  DataSource,
  SearchParams,
  SearchResult,
  CoverageResult,
  SubredditCoverage,
  RedditPost,
  RedditComment,
  SamplePost,
} from './types'
import { ArcticShiftSource } from './arctic-shift'
import { PullPushSource } from './pullpush'
import { getCachedData, setCachedData, generateCacheKey } from './cache'

// Initialize data sources in priority order
const sources: DataSource[] = [
  new ArcticShiftSource(),
  new PullPushSource(),
]

/**
 * Get the first available data source
 */
export async function getAvailableSource(): Promise<DataSource | null> {
  for (const source of sources) {
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

  await Promise.all(
    sources.map(async (source) => {
      try {
        status[source.name] = await source.isAvailable()
      } catch {
        status[source.name] = false
      }
    })
  )

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
  for (const source of sources) {
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

  // Check post count for each subreddit
  for (const subreddit of subreddits) {
    try {
      const count = await sourceUsed.getPostCount(subreddit, keywords)
      coverageResults.push({
        name: subreddit,
        estimatedPosts: count,
        relevanceScore: count >= 50 ? 'high' : count >= 20 ? 'medium' : 'low',
      })
    } catch (error) {
      console.warn(`Failed to get count for r/${subreddit}:`, error)
      coverageResults.push({
        name: subreddit,
        estimatedPosts: 0,
        relevanceScore: 'low',
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
        sourceUsed!.getSamplePosts(s.name, 2)
      )
      const sampleResults = await Promise.all(samplePromises)
      samplePosts = sampleResults.flat().slice(0, 5) // Max 5 total samples
    } catch (error) {
      console.warn('Failed to fetch sample posts:', error)
      // Continue without samples - not a critical feature
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
  // Remove common words and extract meaningful keywords
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

// Re-export types for convenience
export * from './types'
export { generateCacheKey } from './cache'
