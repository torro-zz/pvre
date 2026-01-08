/**
 * Research Pipeline Steps - Composable units of research execution
 *
 * Each step implements the PipelineStep interface and handles
 * a specific part of the research process.
 *
 * See: docs/REFACTORING_PLAN.md Phase 3-4
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

// Data Fetcher (Phase 4)
export {
  dataFetcherStep,
  fetchAppReviews,
  type DataFetcherInput,
  type DataFetcherOutput,
} from './data-fetcher'

// Pain Analyzer (Phase 4)
export {
  painAnalyzerStep,
  type PainAnalyzerInput,
  type PainAnalyzerOutput,
  type PainSignal,
  type PainSummary,
} from './pain-analyzer'

// Theme Analyzer (Phase 4d)
export {
  themeAnalyzerStep,
  type ThemeAnalyzerInput,
  type ThemeAnalyzerOutput,
  type InterviewQuestions,
  type ThemeAnalysis,
} from './theme-analyzer'

// Market Analyzer (Phase 4e)
export {
  marketAnalyzerStep,
  type MarketAnalyzerInput,
  type MarketAnalyzerOutput,
  type MarketSizingResult,
  type TimingResult,
} from './market-analyzer'

// Competitor Detector (Phase 4f)
export {
  competitorDetectorStep,
  type CompetitorDetectorInput,
  type CompetitorDetectorOutput,
} from './competitor-detector'
