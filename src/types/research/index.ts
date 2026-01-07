/**
 * Research Types - Barrel Export
 *
 * Single source of truth for all research-related types.
 * Import from '@/types/research' for canonical types.
 *
 * USAGE:
 *   import { PainSignal, ResearchJob, CommunityVoiceResult } from '@/types/research'
 *
 * CONSOLIDATION STATUS:
 * - core.ts: ResearchJob, PainSignal, PainSummary (canonical)
 * - competitor.ts: Competitor, CompetitorGap, CompetitorIntelligenceResult (canonical)
 * - filter.ts: FilteringMetrics, RelevanceDecision (canonical)
 * - result.ts: CommunityVoiceResult, ResearchPageData (canonical)
 */

// =============================================================================
// CORE TYPES
// =============================================================================

export type {
  // Enums & Simple Types
  RelevanceTier,
  EmotionType,
  WTPConfidence,
  DataConfidence,
  IntensityLevel,
  FeedbackCategory,
  GeographyScope,
  ResearchJobStatus,
  ResearchMode,

  // Structured Hypothesis
  TargetGeography,
  StructuredHypothesis,

  // Pain Signal
  PainSignalSource,
  PainSignal,

  // Pain Summary
  EmotionsBreakdown,
  TemporalDistribution,
  DiscussionVelocity,
  WTPQuote,
  SubredditCount,
  PainSummary,

  // Score Result
  ScoreResult,

  // Research Job
  ResearchJobCoverageData,
  ResearchJob,

  // Interview Guide
  InterviewGuide,

  // Create Job Input
  CreateResearchJobInput,
} from './core'

// =============================================================================
// COMPETITOR TYPES
// =============================================================================

export type {
  // Enums
  ThreatLevel,
  FundingLevel,
  MarketShareEstimate,
  MarketMaturityLevel,
  CompetitionIntensity,
  GapDifficulty,

  // Competitor
  Competitor,
  CompetitorSimple,

  // Competitor Gap
  GapSourceBreakdown,
  CompetitorGap,

  // Positioning
  PositioningRecommendation,

  // Competition Score
  CompetitionScoreFactors,
  CompetitionScoreBreakdown,

  // Competitor Matrix
  CompetitorMatrixScore,
  CompetitorMatrixEntry,
  CompetitorMatrix,

  // Market Overview
  MarketOverview,

  // Full Result
  CompetitorIntelligenceMetadata,
  CompetitorIntelligenceResult,

  // Options
  GeographyInfo,
  AnalyzeCompetitorsOptions,
} from './competitor'

// =============================================================================
// FILTER TYPES
// =============================================================================

export type {
  // Enums
  QualityLevel,
  ExpansionType,
  DecisionStage,

  // Expansion
  ExpansionAttempt,

  // Relevance Decision
  RelevanceDecision,

  // Filter Metrics
  TwoStageMetrics,
  TieredMetrics,
  FilteringMetrics,
  FilterMetrics,

  // Filter Result
  FilterResult,
} from './filter'

// =============================================================================
// RESULT TYPES
// =============================================================================

export type {
  // Token Usage
  TokenUsage,

  // Relevance Decisions
  RelevanceDecisions,

  // Metadata
  CommunityVoiceMetadata,

  // Interview Questions
  InterviewQuestions,

  // Subreddit Discovery
  SubredditDiscovery,

  // Community Voice Result
  CommunityVoiceResult,

  // Research Result (DB wrapper)
  ResearchResult,

  // Page Data
  ResearchPageData,
} from './result'

// =============================================================================
// RE-EXPORTS FROM ANALYSIS MODULES
// =============================================================================

// These types remain in their modules (complex with dependencies)
// but are re-exported here for convenience
export type {
  ThemeAnalysis,
  Theme,
  WtpSignal,
  StrategicRecommendation,
  CompetitorInsight,
} from '@/lib/analysis/theme-extractor'

export type {
  MarketSizingResult,
  MarketSizeEstimate,
  PricingScenario,
} from '@/lib/analysis/market-sizing'

export type {
  TimingResult,
  TimingSignal,
} from '@/lib/analysis/timing-analyzer'

export type {
  KeywordTrend,
} from '@/lib/data-sources/google-trends'

export type {
  SignalCluster,
  ClusteringResult,
} from '@/lib/embeddings/clustering'
