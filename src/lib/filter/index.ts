/**
 * Filter Index
 *
 * Export the universal filter - THE single source of truth for filtering.
 * This filter works with normalized posts from any data source.
 */

export {
  filterByEmbedding,
  filterWithEmbedding,
  scorePost,
  getDefaultThreshold,
  type FilterConfig,
} from './universal-filter'

// Re-export types for convenience
export type {
  NormalizedPost,
  ScoredSignal,
  FilterResult,
  FilterMetrics,
} from '@/lib/adapters/types'
