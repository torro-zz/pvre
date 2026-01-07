/**
 * Research result types - Single source of truth for API responses
 *
 * CONSOLIDATES:
 * - CommunityVoiceResult from: community-voice/route.ts
 *
 * NOTE: Complex analysis types (ThemeAnalysis, MarketSizingResult, TimingResult)
 * remain in their analyzer modules. We re-export them here for convenience.
 */

import type { PainSignal, PainSummary } from './core'
import type { FilteringMetrics, RelevanceDecision } from './filter'
import type { AppDetails } from '@/lib/data-sources/types'

// Re-export analysis types from their canonical locations
export type { ThemeAnalysis, Theme, WtpSignal, StrategicRecommendation, CompetitorInsight } from '@/lib/analysis/theme-extractor'
export type { MarketSizingResult, MarketSizeEstimate, PricingScenario } from '@/lib/analysis/market-sizing'
export type { TimingResult, TimingSignal } from '@/lib/analysis/timing-analyzer'
export type { KeywordTrend } from '@/lib/data-sources/google-trends'
export type { SignalCluster, ClusteringResult } from '@/lib/embeddings/clustering'

// =============================================================================
// TOKEN USAGE TRACKING
// =============================================================================

export interface TokenUsage {
  totalCalls: number
  totalInputTokens: number
  totalOutputTokens: number
  totalTokens: number
  totalCostUsd: number
  costBreakdown: { model: string; calls: number; cost: number }[]
}

// =============================================================================
// RELEVANCE DECISIONS (For audit)
// =============================================================================

export interface RelevanceDecisions {
  posts: RelevanceDecision[]
  comments: RelevanceDecision[]
}

// =============================================================================
// COMMUNITY VOICE METADATA
// =============================================================================

export interface CommunityVoiceMetadata {
  postsAnalyzed: number
  commentsAnalyzed: number
  processingTimeMs: number
  timestamp: string
  dataSources?: string[]
  filteringMetrics?: FilteringMetrics
  tokenUsage?: TokenUsage
  relevanceDecisions?: RelevanceDecisions
  crossStoreAppData?: AppDetails
}

// =============================================================================
// INTERVIEW QUESTIONS
// =============================================================================

export interface InterviewQuestions {
  contextQuestions: string[]
  problemQuestions: string[]
  solutionQuestions: string[]
}

// =============================================================================
// SUBREDDIT DISCOVERY
// =============================================================================

export interface SubredditDiscovery {
  discovered: string[]
  analyzed: string[]
}

// =============================================================================
// COMMUNITY VOICE RESULT (Canonical)
// =============================================================================

// Import complex types that we don't consolidate (they stay in their modules)
import type { ThemeAnalysis } from '@/lib/analysis/theme-extractor'
import type { MarketSizingResult } from '@/lib/analysis/market-sizing'
import type { TimingResult } from '@/lib/analysis/timing-analyzer'
import type { SignalCluster } from '@/lib/embeddings/clustering'

/**
 * Full community voice analysis result.
 *
 * This is the canonical type for the /api/research/community-voice response.
 */
export interface CommunityVoiceResult {
  hypothesis: string

  subreddits: SubredditDiscovery

  painSignals: PainSignal[]

  painSummary: PainSummary

  themeAnalysis: ThemeAnalysis

  interviewQuestions: InterviewQuestions

  // Optional analysis modules (may not be present in older results)
  marketSizing?: MarketSizingResult
  timing?: TimingResult

  // App Gap mode: Clustered signals
  clusters?: SignalCluster[]

  // Metadata
  metadata: CommunityVoiceMetadata
}

// =============================================================================
// RESEARCH PAGE DATA (For UI)
// =============================================================================

import type { ResearchJob, StructuredHypothesis } from './core'
import type { CompetitorIntelligenceResult } from './competitor'
import type {
  PainScoreInput,
  CompetitionScoreInput,
  MarketScoreInput,
  TimingScoreInput,
  ViabilityVerdict,
} from '@/lib/analysis/viability-calculator'

/**
 * Research result wrapper for database storage.
 */
export interface ResearchResult<T = CommunityVoiceResult | CompetitorIntelligenceResult> {
  id: string
  job_id: string
  module_name: string
  data: T
  created_at: string
}

/**
 * All data needed to render the research results page.
 *
 * Used by fetch-research-data.ts.
 */
export interface ResearchPageData {
  job: ResearchJob
  communityVoiceResult: ResearchResult<CommunityVoiceResult> | null
  competitorResult: ResearchResult<CompetitorIntelligenceResult> | null
  marketSizingResult: ResearchResult | null
  timingResult: ResearchResult | null
  marketData: CommunityVoiceResult['marketSizing'] | null
  timingData: CommunityVoiceResult['timing'] | null
  painScoreInput: PainScoreInput | null
  competitionScoreInput: CompetitionScoreInput | null
  marketScoreInput: MarketScoreInput | null
  timingScoreInput: TimingScoreInput | null
  viabilityVerdict: ViabilityVerdict
  isAppAnalysis: boolean
  appData: AppDetails | null
  crossStoreAppData: AppDetails | null
  structuredHypothesis?: StructuredHypothesis
  shortTitle?: string
  originalInput?: string
  filteringMetrics: FilteringMetrics | null
  showSidebar: boolean
  allResultsCount: number
}
