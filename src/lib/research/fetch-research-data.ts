/**
 * Shared data fetching and processing for research results page.
 * Used by both tabbed view and horizontal scroll view.
 */

import { createClient } from '@/lib/supabase/server'
import { CommunityVoiceResult } from '@/app/api/research/community-voice/route'
import { CompetitorIntelligenceResult } from '@/app/api/research/competitor-intelligence/route'
import {
  calculateViability,
  PainScoreInput,
  CompetitionScoreInput,
  MarketScoreInput,
  TimingScoreInput,
  TwoAxisInput,
  ViabilityVerdict,
} from '@/lib/analysis/viability-calculator'
import { calculateOverallPainScore } from '@/lib/analysis/pain-detector'
import { detectModeFromCoverageData } from '@/lib/research/pipeline'
import type { AppDetails } from '@/lib/data-sources/types'

// ============================================================================
// Types
// ============================================================================

export interface ResearchJob {
  id: string
  hypothesis: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
  updated_at: string
  user_id: string
  error_message?: string | null
  coverage_data?: {
    mode?: 'hypothesis' | 'app-analysis'
    appData?: AppDetails | null
    structuredHypothesis?: {
      audience?: string
      problem?: string
    }
    // Display fields (for dashboard/header recognition)
    originalInput?: string   // What the user originally typed
    shortTitle?: string      // AI-cleaned short title for display
    [key: string]: unknown
  } | null
}

export interface ResearchResult<T = CommunityVoiceResult | CompetitorIntelligenceResult> {
  id: string
  job_id: string
  module_name: string
  data: T
  created_at: string
}

export interface ExpansionAttempt {
  type: 'time_range' | 'fetch_limit' | 'communities'
  value: string
  success: boolean
  signalsGained: number
}

export interface FilteringMetrics {
  postsFound: number
  postsAnalyzed: number
  coreSignals: number
  relatedSignals: number
  postFilterRate?: number
  stage2FilterRate?: number
  narrowProblemWarning?: boolean
  qualityLevel?: 'low' | 'medium' | 'high'
  expansionAttempts?: ExpansionAttempt[]
  communitiesSearched?: string[]
  timeRangeMonths?: number
  // Tiered filter metrics (when USE_TIERED_FILTER is enabled)
  tieredMetrics?: {
    core: number       // Score >= 0.45
    strong: number     // Score >= 0.35
    related: number    // Score >= 0.25
    adjacent: number   // Score >= 0.15
    total: number      // Total signals across all tiers
    processingTimeMs: number
  }
}

// Raw result from Supabase (before type casting)
export interface RawResearchResult {
  id: string
  job_id: string | null
  module_name: string
  data: unknown
  created_at: string | null
}

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
  crossStoreAppData: AppDetails | null  // App found via cross-store lookup (e.g., Play Store when user submitted App Store URL)
  structuredHypothesis?: { audience?: string; problem?: string }
  // Display fields for header
  shortTitle?: string
  originalInput?: string
  filteringMetrics: FilteringMetrics | null
  showSidebar: boolean
  allResultsCount: number
}

// ============================================================================
// Main Fetch Function
// ============================================================================

export async function fetchResearchData(
  jobId: string,
  userId: string
): Promise<{ data: ResearchPageData | null; error: string | null; notFound: boolean }> {
  const supabase = await createClient()

  // Fetch the research job
  const { data: job, error: jobError } = await supabase
    .from('research_jobs')
    .select('*')
    .eq('id', jobId)
    .single()

  if (jobError || !job) {
    return { data: null, error: 'Job not found', notFound: true }
  }

  const researchJob = job as ResearchJob

  // Verify user owns this job
  if (researchJob.user_id !== userId) {
    return { data: null, error: 'Unauthorized', notFound: true }
  }

  // Extract app-centric mode data from coverage_data
  const researchMode = detectModeFromCoverageData(researchJob.coverage_data)
  const isAppAnalysis = researchMode === 'app-gap'
  const appData = researchJob.coverage_data?.appData || null
  const structuredHypothesis = researchJob.coverage_data?.structuredHypothesis
  // Display fields for header
  const shortTitle = researchJob.coverage_data?.shortTitle
  const originalInput = researchJob.coverage_data?.originalInput

  // Fetch all research results for this job
  const { data: allResults } = await supabase
    .from('research_results')
    .select('*')
    .eq('job_id', jobId)

  // Extract results by module name
  const communityVoiceResult = allResults?.find(
    (r) => r.module_name === 'community_voice' || r.module_name === 'pain_analysis'
  ) as ResearchResult<CommunityVoiceResult> | undefined

  const competitorResult = allResults?.find(
    (r) => r.module_name === 'competitor_intel' || r.module_name === 'competitor_intelligence'
  ) as ResearchResult<CompetitorIntelligenceResult> | undefined

  const marketSizingResult = allResults?.find(
    (r) => r.module_name === 'market_sizing'
  ) as ResearchResult | undefined

  const timingResult = allResults?.find(
    (r) => r.module_name === 'timing_analysis'
  ) as ResearchResult | undefined

  // Calculate viability scores
  const { painScoreInput, competitionScoreInput, marketScoreInput, timingScoreInput, marketData, timingData } =
    calculateScoreInputs(communityVoiceResult, competitorResult, marketSizingResult, timingResult)

  // Extract cross-store app data from community_voice metadata
  const crossStoreAppData = (communityVoiceResult?.data?.metadata as Record<string, unknown>)?.crossStoreAppData as AppDetails | undefined || null

  // Prepare two-axis input
  const filteringMetrics = communityVoiceResult?.data?.metadata?.filteringMetrics as FilteringMetrics | undefined
  const metadataSources = communityVoiceResult?.data?.metadata?.dataSources
  const hasMetadataSources = Array.isArray(metadataSources) && metadataSources.length > 0
  const communityCount = filteringMetrics?.communitiesSearched?.length || 0
  const hasRedditSignals = communityCount > 0 && (filteringMetrics?.postsAnalyzed || 0) > 0
  const twoAxisSources = hasMetadataSources
    ? metadataSources
    : isAppAnalysis && !hasRedditSignals
      ? ['app_stores']
      : ['reddit']
  const twoAxisInput: TwoAxisInput | undefined = filteringMetrics ? {
    filteringMetrics: {
      coreSignals: filteringMetrics.coreSignals || 0,
      relatedSignals: filteringMetrics.relatedSignals || 0,
      postsAnalyzed: filteringMetrics.postsAnalyzed || 0,
      sources: twoAxisSources,
    },
    marketScore: marketScoreInput?.score,
    timingScore: timingScoreInput?.score,
    competitorCount: competitionScoreInput?.competitorCount,
  } : undefined

  // Calculate viability
  const viabilityVerdict = calculateViability(
    painScoreInput,
    competitionScoreInput,
    marketScoreInput,
    timingScoreInput,
    twoAxisInput
  )

  // Add red flags from filtering metrics
  addRedFlagsFromFilteringMetrics(viabilityVerdict, filteringMetrics)

  // Determine sidebar visibility
  const showSidebar = researchJob.status === 'completed' &&
    (communityVoiceResult?.data || competitorResult?.data)

  return {
    data: {
      job: researchJob,
      communityVoiceResult: communityVoiceResult || null,
      competitorResult: competitorResult || null,
      marketSizingResult: marketSizingResult || null,
      timingResult: timingResult || null,
      marketData: marketData || null,
      timingData: timingData || null,
      painScoreInput,
      competitionScoreInput,
      marketScoreInput,
      timingScoreInput,
      viabilityVerdict,
      isAppAnalysis,
      appData,
      crossStoreAppData,  // App from other store (e.g., Play Store when user submitted App Store URL)
      structuredHypothesis,
      shortTitle,
      originalInput,
      filteringMetrics: filteringMetrics || null,
      showSidebar: !!showSidebar,
      allResultsCount: allResults?.length || 0,
    },
    error: null,
    notFound: false,
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function calculateScoreInputs(
  communityVoiceResult: ResearchResult<CommunityVoiceResult> | undefined,
  competitorResult: ResearchResult<CompetitorIntelligenceResult> | undefined,
  marketSizingResult: ResearchResult | undefined,
  timingResult: ResearchResult | undefined
) {
  let painScoreInput: PainScoreInput | null = null
  let competitionScoreInput: CompetitionScoreInput | null = null
  let marketScoreInput: MarketScoreInput | null = null
  let timingScoreInput: TimingScoreInput | null = null

  // Pain score calculation
  if (communityVoiceResult?.data?.painSummary) {
    const rawPainSummary = communityVoiceResult.data.painSummary

    const painSummary = {
      totalSignals: rawPainSummary.totalSignals || 0,
      averageScore: rawPainSummary.averageScore || 0,
      highIntensityCount: rawPainSummary.highIntensityCount || 0,
      mediumIntensityCount: rawPainSummary.mediumIntensityCount || 0,
      lowIntensityCount: rawPainSummary.lowIntensityCount || 0,
      solutionSeekingCount: rawPainSummary.solutionSeekingCount || 0,
      willingnessToPayCount: rawPainSummary.willingnessToPayCount || 0,
      topSubreddits: rawPainSummary.topSubreddits || [],
      dataConfidence: (rawPainSummary as { dataConfidence?: 'very_low' | 'low' | 'medium' | 'high' }).dataConfidence || 'low',
      strongestSignals: (rawPainSummary as { strongestSignals?: string[] }).strongestSignals || [],
      wtpQuotes: (rawPainSummary as { wtpQuotes?: { text: string; subreddit: string; url?: string }[] }).wtpQuotes || [],
      temporalDistribution: (rawPainSummary as { temporalDistribution?: { last30Days: number; last90Days: number; last180Days: number; older: number } }).temporalDistribution || {
        last30Days: 0,
        last90Days: 0,
        last180Days: 0,
        older: rawPainSummary.totalSignals || 0,
      },
      dateRange: (rawPainSummary as { dateRange?: { oldest: string; newest: string } }).dateRange,
      recencyScore: (rawPainSummary as { recencyScore?: number }).recencyScore ?? 0.5,
    }

    const painScoreResult = calculateOverallPainScore(painSummary)

    let averageIntensity = 0.5
    if (painSummary.totalSignals > 0) {
      const weightedSum =
        (painSummary.highIntensityCount * 1.0) +
        (painSummary.mediumIntensityCount * 0.6) +
        (painSummary.lowIntensityCount * 0.3)
      averageIntensity = weightedSum / painSummary.totalSignals
    }

    painScoreInput = {
      overallScore: painScoreResult.score,
      confidence: painScoreResult.confidence,
      totalSignals: painSummary.totalSignals,
      willingnessToPayCount: painSummary.willingnessToPayCount,
      postsAnalyzed: communityVoiceResult.data.metadata?.postsAnalyzed,
      averageIntensity,
    }
  }

  // Competition score
  if (competitorResult?.data?.competitionScore) {
    const compScore = competitorResult.data.competitionScore

    const hasFreeAlternatives = competitorResult.data.competitors?.some(c => {
      const pricing = (c.pricingModel?.toLowerCase() || '') + ' ' + (c.pricingRange?.toLowerCase() || '')
      return pricing.includes('free') || pricing.includes('$0') || pricing.includes('freemium')
    }) || false

    competitionScoreInput = {
      score: compScore.score,
      confidence: compScore.confidence,
      competitorCount: competitorResult.data.metadata.competitorsAnalyzed,
      threats: compScore.threats || [],
      hasFreeAlternatives,
      marketMaturity: competitorResult.data.marketOverview?.maturityLevel,
    }
  }

  // Market sizing - from community voice OR separate result
  const marketData = communityVoiceResult?.data?.marketSizing ||
    (marketSizingResult?.data as CommunityVoiceResult['marketSizing'])

  if (marketData) {
    marketScoreInput = {
      score: marketData.score,
      confidence: marketData.confidence,
      penetrationRequired: marketData.mscAnalysis.penetrationRequired,
      achievability: marketData.mscAnalysis.achievability,
    }
  }

  // Timing - from community voice OR separate result
  const timingData = communityVoiceResult?.data?.timing ||
    (timingResult?.data as CommunityVoiceResult['timing'])

  if (timingData) {
    timingScoreInput = {
      score: timingData.score,
      confidence: timingData.confidence,
      trend: timingData.trend,
      tailwindsCount: timingData.tailwinds?.length || 0,
      headwindsCount: timingData.headwinds?.length || 0,
      timingWindow: timingData.timingWindow,
    }
  }

  return {
    painScoreInput,
    competitionScoreInput,
    marketScoreInput,
    timingScoreInput,
    marketData,
    timingData,
  }
}

function addRedFlagsFromFilteringMetrics(
  viabilityVerdict: ViabilityVerdict,
  filteringMetrics: FilteringMetrics | undefined
) {
  if (!filteringMetrics) return

  if (!viabilityVerdict.redFlags) {
    viabilityVerdict.redFlags = []
  }

  // Flag narrow problem definition
  if (filteringMetrics.narrowProblemWarning) {
    viabilityVerdict.redFlags.push({
      severity: 'MEDIUM',
      title: 'Narrow Problem Definition',
      message: `${Math.round(filteringMetrics.stage2FilterRate || 0)}% of domain-relevant posts didn't match your specific problem. Consider broadening your hypothesis.`,
    })
  }

  // Flag very low data quality
  const postsAnalyzed = filteringMetrics.postsAnalyzed || 0
  if (filteringMetrics.qualityLevel === 'low' &&
      (filteringMetrics.postFilterRate || 0) > 95 &&
      postsAnalyzed < 10) {
    viabilityVerdict.redFlags.push({
      severity: 'MEDIUM',
      title: 'Very High Filter Rate',
      message: `Only ${postsAnalyzed} relevant posts found. Results may be less reliable.`,
    })
  }
}

// ============================================================================
// Utility: Format Date
// ============================================================================

export function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
