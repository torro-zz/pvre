/**
 * Research Pipeline Steps - Composable units of research execution
 *
 * Each step implements the PipelineStep interface and handles
 * a specific part of the research process.
 *
 * See: docs/REFACTORING_PLAN.md Phase 3
 */

// Cross-Store Lookup (Phase 2)
export {
  findCrossStoreApp,
  fetchCrossStoreReviews,
  findAndFetchCrossStoreReviews,
  getOtherStore,
  type CrossStoreResult,
  type CrossStoreReviewsResult,
  type StoreType,
} from './cross-store-lookup'

// Keyword Extractor (Phase 3)
export {
  keywordExtractorStep,
  buildSearchContext,
  extractUserPhrases,
  extractUserExcludes,
} from './keyword-extractor'

// Subreddit Discovery (Phase 3)
export {
  subredditDiscoveryStep,
  getEmptySubredditResult,
} from './subreddit-discovery'
