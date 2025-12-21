/**
 * Data Source Orchestrator
 *
 * Manages multiple data sources and coordinates searches across them.
 * Implements the unified architecture from Phase 3 of the implementation plan.
 *
 * Key responsibilities:
 * - Register and manage adapters
 * - Search across multiple sources in parallel
 * - Handle failures gracefully (one source failing doesn't break everything)
 * - Merge results into unified format
 */

import {
  DataSourceAdapter,
  UnifiedSignal,
  SearchOptions,
  SamplePost,
  SourceType,
} from './types'
import { RedditAdapter, redditAdapter } from './adapters/reddit-adapter'
import { HackerNewsAdapter, hackerNewsAdapter } from './adapters/hacker-news-adapter'
import { GooglePlayAdapter, googlePlayAdapter } from './adapters/google-play-adapter'
import { AppStoreAdapter, appStoreAdapter } from './adapters/app-store-adapter'

// Keywords that indicate HN should be included as a data source
const TECH_KEYWORDS = [
  'startup', 'saas', 'developer', 'engineer', 'programmer', 'coding',
  'software', 'app', 'api', 'tech', 'technology', 'ai', 'ml', 'machine learning',
  'bootstrap', 'indie', 'maker', 'founder', 'entrepreneur', 'vc', 'funding',
  'devtools', 'developer tools', 'open source', 'cloud', 'infra', 'infrastructure',
  'b2b', 'enterprise', 'automation', 'workflow', 'productivity tool',
  // Remote work is a major HN topic
  'remote', 'remote work', 'work from home', 'wfh', 'distributed team',
  'async', 'asynchronous', 'timezone', 'hybrid work', 'freelancer', 'freelance',
  'digital nomad', 'coworking', 'home office',
]

// Keywords that indicate Google Play should be included as a data source
const MOBILE_APP_KEYWORDS = [
  'mobile app', 'android', 'ios', 'iphone', 'smartphone', 'phone app',
  'mobile game', 'fitness app', 'health app', 'tracking app', 'meditation',
  'habit tracker', 'sleep tracker', 'calorie', 'workout', 'exercise app',
  'dating app', 'social app', 'messaging app', 'photo app', 'video app',
  'music app', 'podcast', 'audiobook', 'e-reader', 'news app',
  'banking app', 'finance app', 'budget app', 'expense tracker',
  'task manager', 'to-do', 'reminder app', 'calendar app', 'note-taking',
  'learning app', 'language learning', 'education app', 'kids app',
  'shopping app', 'delivery app', 'food ordering', 'ride-sharing',
]

/**
 * Check if hypothesis should include Hacker News as a source
 */
export function shouldIncludeHN(hypothesis: string): boolean {
  const lowerHypothesis = hypothesis.toLowerCase()
  return TECH_KEYWORDS.some(keyword => lowerHypothesis.includes(keyword))
}

/**
 * Check if hypothesis should include Google Play as a source
 */
export function shouldIncludeGooglePlay(hypothesis: string): boolean {
  const lowerHypothesis = hypothesis.toLowerCase()
  return MOBILE_APP_KEYWORDS.some(keyword => lowerHypothesis.includes(keyword))
}

/**
 * Data Source Orchestrator
 *
 * Usage:
 * ```typescript
 * const orchestrator = new DataSourceOrchestrator()
 *
 * // Search all sources
 * const signals = await orchestrator.searchAll('freelancer burnout', ['reddit', 'hacker_news'])
 *
 * // Check which sources are available
 * const status = await orchestrator.checkHealth()
 * ```
 */
export class DataSourceOrchestrator {
  private adapters: Map<SourceType, DataSourceAdapter> = new Map()

  constructor() {
    // Register default adapters
    this.registerAdapter(redditAdapter)
    this.registerAdapter(hackerNewsAdapter)
    this.registerAdapter(googlePlayAdapter)
    this.registerAdapter(appStoreAdapter)
  }

  /**
   * Register a new adapter
   */
  registerAdapter(adapter: DataSourceAdapter): void {
    this.adapters.set(adapter.source, adapter)
  }

  /**
   * Get a specific adapter
   */
  getAdapter(source: SourceType): DataSourceAdapter | undefined {
    return this.adapters.get(source)
  }

  /**
   * Get all registered adapters
   */
  getAllAdapters(): DataSourceAdapter[] {
    return Array.from(this.adapters.values())
  }

  /**
   * Search across multiple sources in parallel
   * Returns merged results from all successful sources
   */
  async searchAll(
    query: string,
    sources: SourceType[],
    options?: SearchOptions
  ): Promise<{ signals: UnifiedSignal[]; sources: string[] }> {
    const sourcesUsed: string[] = []

    // Search all sources in parallel
    const results = await Promise.allSettled(
      sources.map(async source => {
        const adapter = this.adapters.get(source)
        if (!adapter) {
          console.warn(`[Orchestrator] No adapter for source: ${source}`)
          return []
        }

        try {
          const signals = await adapter.search(query, options)
          if (signals.length > 0) {
            sourcesUsed.push(adapter.name)
          }
          return signals
        } catch (error) {
          console.error(`[Orchestrator] ${adapter.name} search failed:`, error)
          return []
        }
      })
    )

    // Merge successful results
    const signals = results
      .filter((r): r is PromiseFulfilledResult<UnifiedSignal[]> => r.status === 'fulfilled')
      .flatMap(r => r.value)

    return { signals, sources: sourcesUsed }
  }

  /**
   * Check health of all registered adapters
   */
  async checkHealth(): Promise<Record<string, boolean>> {
    const status: Record<string, boolean> = {}

    await Promise.all(
      Array.from(this.adapters.entries()).map(async ([source, adapter]) => {
        try {
          status[source] = await adapter.healthCheck()
        } catch {
          status[source] = false
        }
      })
    )

    return status
  }

  /**
   * Get post count from a specific source
   */
  async getPostCount(source: SourceType, query: string): Promise<number> {
    const adapter = this.adapters.get(source)
    if (!adapter) return 0

    try {
      return await adapter.getPostCount(query)
    } catch {
      return 0
    }
  }

  /**
   * Get sample posts from a specific source
   */
  async getSamplePosts(
    source: SourceType,
    query: string,
    limit: number = 5
  ): Promise<SamplePost[]> {
    const adapter = this.adapters.get(source)
    if (!adapter) return []

    try {
      return await adapter.getSamplePosts(query, limit)
    } catch {
      return []
    }
  }

  /**
   * Smart source selection based on hypothesis
   */
  recommendSources(hypothesis: string): SourceType[] {
    const sources: SourceType[] = ['reddit'] // Reddit is always included

    if (shouldIncludeHN(hypothesis)) {
      sources.push('hacker_news')
    }

    if (shouldIncludeGooglePlay(hypothesis)) {
      sources.push('google_play')
      sources.push('app_store')
    }

    // Future: Add more source recommendations based on domain
    // if (isConsumerProduct(hypothesis)) sources.push('tiktok', 'youtube')

    return sources
  }
}

// Export singleton instance for convenience
export const orchestrator = new DataSourceOrchestrator()

// Re-export adapters for direct access when needed
export { redditAdapter, hackerNewsAdapter, googlePlayAdapter, appStoreAdapter }
export { RedditAdapter } from './adapters/reddit-adapter'
export { HackerNewsAdapter } from './adapters/hacker-news-adapter'
export { GooglePlayAdapter } from './adapters/google-play-adapter'
export { AppStoreAdapter } from './adapters/app-store-adapter'
