/**
 * Core research types - Single source of truth
 *
 * CONSOLIDATES:
 * - ResearchJob from: types/research.ts, fetch-research-data.ts
 * - PainSignal from: types/research.ts, pain-detector.ts
 * - PainSummary from: pain-detector.ts
 *
 * NOTE: types/database.ts ResearchJob is auto-generated from Supabase schema.
 * This file defines the APPLICATION-level type with richer fields.
 */

import type { AppDetails } from '@/lib/data-sources/types'

// =============================================================================
// ENUMS & SIMPLE TYPES
// =============================================================================

export type RelevanceTier = 'CORE' | 'RELATED' | 'N'

export type EmotionType =
  | 'frustration'
  | 'anxiety'
  | 'disappointment'
  | 'confusion'
  | 'hope'
  | 'neutral'

export type WTPConfidence = 'none' | 'low' | 'medium' | 'high'

export type DataConfidence = 'very_low' | 'low' | 'medium' | 'high'

export type IntensityLevel = 'low' | 'medium' | 'high'

export type FeedbackCategory = 'pricing' | 'ads' | 'content' | 'performance' | 'features'

// =============================================================================
// STRUCTURED HYPOTHESIS
// =============================================================================

export type GeographyScope = 'local' | 'national' | 'global'

export interface TargetGeography {
  scope: GeographyScope
  location?: string
  detectedFrom?: string
}

export interface StructuredHypothesis {
  audience: string
  problem: string
  problemLanguage?: string
  solution?: string
  excludeTopics?: string
  targetGeography?: TargetGeography
}

// =============================================================================
// PAIN SIGNAL (Canonical - from pain-detector.ts)
// =============================================================================

export interface PainSignalSource {
  type: 'post' | 'comment'
  id: string
  subreddit: string
  author: string
  url: string
  createdUtc: number
  engagementScore: number
  rating?: number // Star rating (1-5) for app store reviews
  upvotes?: number
  numComments?: number
}

/**
 * Pain signal - a single piece of evidence of user pain.
 *
 * This is the CANONICAL version combining fields from:
 * - types/research.ts (simple version with text, source_url, subreddit, intensity, category, emotion)
 * - pain-detector.ts (full version with scoring, signals, WTP analysis)
 */
export interface PainSignal {
  // Core content
  text: string
  title?: string

  // Scoring
  score: number
  intensity: IntensityLevel
  signals: string[]

  // Solution/WTP analysis
  solutionSeeking: boolean
  willingnessToPaySignal: boolean
  wtpConfidence: WTPConfidence
  wtpSourceReliability?: 'high' | 'medium' | 'low'

  // Classification
  tier?: RelevanceTier
  emotion: EmotionType
  feedbackCategory?: FeedbackCategory
  feedbackCategoryConfidence?: number

  // Source metadata
  source: PainSignalSource

  // Legacy fields (for backwards compatibility with old data)
  /** @deprecated Use source.url instead */
  source_url?: string
  /** @deprecated Use source.subreddit instead */
  subreddit?: string
  /** @deprecated Use signals array instead */
  category?: string
}

// =============================================================================
// PAIN SUMMARY
// =============================================================================

export interface EmotionsBreakdown {
  frustration: number
  anxiety: number
  disappointment: number
  confusion: number
  hope: number
  neutral: number
}

export interface TemporalDistribution {
  last30Days: number
  last90Days: number
  last180Days: number
  older: number
}

export interface DiscussionVelocity {
  percentageChange: number | null
  trend: 'rising' | 'stable' | 'declining' | 'insufficient_data'
  recentCount: number
  previousCount: number
  confidence: WTPConfidence
  insufficientData?: boolean
}

/**
 * Unified Discussion Trends - combines AI Discussion Trends and Discussion Velocity
 * into a single metric for clearer display in the Market tab.
 */
export interface UnifiedDiscussionTrends {
  trend: 'rising' | 'stable' | 'falling' | 'insufficient_data'
  percentageChange: number | null
  confidence: 'high' | 'medium' | 'low' | 'none'

  // Which source provided the primary data
  primarySource: 'ai_discussion' | 'pain_signals' | 'combined'

  // Volume info
  totalVolume: number
  volumeLabel: string  // "42 AI discussions" or "9 filtered signals"

  // Period breakdown (for comparison bars)
  recentCount: number
  previousCount: number

  // Optional 30d/90d changes (from AI Discussion when available)
  change30d?: number
  change90d?: number

  // Source details
  sources?: string[]  // ["r/ChatGPT", "r/ClaudeAI"]
  insufficientData: boolean
}

export interface WTPQuote {
  text: string
  subreddit: string
  url?: string
  createdUtc?: number
  upvotes?: number
  numComments?: number
  rating?: number
}

export interface SubredditCount {
  name: string
  count: number
}

export interface PainSummary {
  // Core metrics
  totalSignals: number
  averageScore: number
  highIntensityCount: number
  mediumIntensityCount: number
  lowIntensityCount: number
  solutionSeekingCount: number
  willingnessToPayCount: number

  // Distribution
  topSubreddits: SubredditCount[]

  // Transparency
  dataConfidence: DataConfidence
  strongestSignals: string[]
  wtpQuotes: WTPQuote[]

  // Temporal analysis
  temporalDistribution: TemporalDistribution
  dateRange?: {
    oldest: string
    newest: string
  }
  recencyScore: number

  // Optional enrichments
  emotionsBreakdown?: EmotionsBreakdown
  discussionVelocity?: DiscussionVelocity
}

// =============================================================================
// SCORE RESULT (from pain analysis)
// =============================================================================

export interface ScoreResult {
  score: number
  signals: string[]
  highIntensityCount: number
  mediumIntensityCount: number
  lowIntensityCount: number
  solutionSeekingCount: number
  willingnessToPayCount: number
  wtpConfidence: WTPConfidence
  strongestSignal: string | null
  hasNegativeContext: boolean
  hasWTPExclusion: boolean
}

// =============================================================================
// RESEARCH JOB (Canonical - application-level)
// =============================================================================

export type ResearchJobStatus = 'pending' | 'processing' | 'completed' | 'failed'

export type ResearchMode = 'hypothesis' | 'app-analysis'

export interface ResearchJobCoverageData {
  mode?: ResearchMode
  appData?: AppDetails | null
  structuredHypothesis?: {
    audience?: string
    problem?: string
  }
  originalInput?: string
  shortTitle?: string
  [key: string]: unknown
}

/**
 * Research job - tracks a research request through its lifecycle.
 *
 * NOTE: This is the APPLICATION-level type. The database row type is
 * auto-generated in types/database.ts from the Supabase schema.
 */
export interface ResearchJob {
  id: string
  user_id: string
  hypothesis: string
  structured_hypothesis?: StructuredHypothesis
  status: ResearchJobStatus
  error_message?: string | null
  created_at: string
  updated_at: string

  // Coverage data (stored as JSONB in DB)
  coverage_data?: ResearchJobCoverageData | null

  // Legacy fields (for backwards compatibility)
  /** @deprecated Results are now stored in research_results table */
  pain_signals?: PainSignal[]
  /** @deprecated Results are now stored in research_results table */
  competitors?: unknown[]
  /** @deprecated Results are now stored in research_results table */
  interview_guide?: unknown | null
}

// =============================================================================
// INTERVIEW GUIDE
// =============================================================================

export interface InterviewGuide {
  intro_questions: string[]
  pain_exploration: string[]
  solution_validation: string[]
  closing_questions: string[]
}

// =============================================================================
// CREATE JOB INPUT
// =============================================================================

export interface CreateResearchJobInput {
  hypothesis: string
  structuredHypothesis?: StructuredHypothesis
}
