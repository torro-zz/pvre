import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  calculateViability,
  PainScoreInput,
  CompetitionScoreInput,
  MarketScoreInput,
  TimingScoreInput,
  ViabilityVerdict,
} from '@/lib/analysis/viability-calculator'
import { calculateOverallPainScore } from '@/lib/analysis/pain-detector'
import { CommunityVoiceResult } from '@/app/api/research/community-voice/route'
import { CompetitorIntelligenceResult } from '@/app/api/research/competitor-intelligence/route'

export interface ComparisonHypothesis {
  id: string
  hypothesis: string
  createdAt: string
  status: 'pending' | 'processing' | 'completed' | 'failed'

  // Viability verdict (calculated)
  viability: ViabilityVerdict | null

  // Individual scores
  painScore: number | null
  marketScore: number | null
  competitionScore: number | null
  timingScore: number | null

  // Confidence levels
  painConfidence: 'low' | 'medium' | 'high' | null
  marketConfidence: 'low' | 'medium' | 'high' | null
  competitionConfidence: 'low' | 'medium' | 'high' | null
  timingConfidence: 'low' | 'medium' | 'high' | null

  // Key metrics
  painSignalCount: number
  willingnessToPayCount: number
  competitorCount: number
  postsAnalyzed: number

  // Market data
  tam: number | null
  sam: number | null
  som: number | null
  penetrationRequired: number | null

  // Timing signals
  tailwindCount: number
  headwindCount: number
  trend: 'rising' | 'stable' | 'falling' | null

  // Data quality
  sampleSizeLabel: 'high_confidence' | 'moderate_confidence' | 'low_confidence' | 'very_limited' | null
}

export interface ComparisonResponse {
  hypotheses: ComparisonHypothesis[]
  bestByCategory: {
    viability: string | null    // job ID with highest overall score
    pain: string | null         // job ID with highest pain score
    market: string | null       // job ID with largest market
    competition: string | null  // job ID with best competition score (least competitive)
    timing: string | null       // job ID with best timing
    confidence: string | null   // job ID with best data quality
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get job IDs from query params
    const searchParams = request.nextUrl.searchParams
    const jobIdsParam = searchParams.get('jobs')

    if (!jobIdsParam) {
      return NextResponse.json({ error: 'Missing jobs parameter' }, { status: 400 })
    }

    const jobIds = jobIdsParam.split(',').filter(id => id.trim())

    if (jobIds.length < 2) {
      return NextResponse.json({ error: 'Need at least 2 jobs to compare' }, { status: 400 })
    }

    if (jobIds.length > 4) {
      return NextResponse.json({ error: 'Maximum 4 jobs can be compared at once' }, { status: 400 })
    }

    // Fetch all research jobs
    const { data: jobs, error: jobsError } = await supabase
      .from('research_jobs')
      .select('*')
      .in('id', jobIds)
      .eq('user_id', user.id)

    if (jobsError) {
      console.error('Error fetching jobs:', jobsError)
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
    }

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ error: 'No jobs found' }, { status: 404 })
    }

    // Fetch all results for these jobs
    const { data: allResults, error: resultsError } = await supabase
      .from('research_results')
      .select('*')
      .in('job_id', jobIds)

    if (resultsError) {
      console.error('Error fetching results:', resultsError)
      return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 })
    }

    // Index results by job_id
    const resultsByJobId: Record<string, NonNullable<typeof allResults>> = {}
    for (const result of allResults || []) {
      const jobId = result.job_id
      if (!jobId) continue // Skip results without job_id
      if (!resultsByJobId[jobId]) {
        resultsByJobId[jobId] = []
      }
      resultsByJobId[jobId].push(result)
    }

    // Process each job into comparison format
    const hypotheses: ComparisonHypothesis[] = jobs.map(job => {
      const jobResults = resultsByJobId[job.id] || []

      // Extract results by module
      const communityVoiceResult = jobResults.find(
        r => r.module_name === 'community_voice' || r.module_name === 'pain_analysis'
      )?.data as CommunityVoiceResult | undefined

      const competitorResult = jobResults.find(
        r => r.module_name === 'competitor_intel' || r.module_name === 'competitor_intelligence'
      )?.data as CompetitorIntelligenceResult | undefined

      const marketSizingResult = jobResults.find(
        r => r.module_name === 'market_sizing'
      )?.data as CommunityVoiceResult['marketSizing'] | undefined

      const timingResult = jobResults.find(
        r => r.module_name === 'timing_analysis'
      )?.data as CommunityVoiceResult['timing'] | undefined

      // Calculate viability inputs
      let painScoreInput: PainScoreInput | null = null
      let competitionScoreInput: CompetitionScoreInput | null = null
      let marketScoreInput: MarketScoreInput | null = null
      let timingScoreInput: TimingScoreInput | null = null

      if (communityVoiceResult?.painSummary) {
        const rawPainSummary = communityVoiceResult.painSummary
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
          wtpQuotes: (rawPainSummary as { wtpQuotes?: { text: string; subreddit: string }[] }).wtpQuotes || [],
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

        // Calculate average intensity on 0-1 scale: high=1.0, medium=0.6, low=0.3
        let averageIntensity = 0.5 // Default middle value
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
          postsAnalyzed: communityVoiceResult.metadata?.postsAnalyzed,
          averageIntensity,
        }
      }

      if (competitorResult?.competitionScore) {
        const compScore = competitorResult.competitionScore

        // Determine if any competitor offers free alternatives
        const hasFreeAlternatives = competitorResult.competitors?.some(c => {
          const pricing = (c.pricingModel?.toLowerCase() || '') + ' ' + (c.pricingRange?.toLowerCase() || '')
          return pricing.includes('free') || pricing.includes('$0') || pricing.includes('freemium')
        }) || false

        competitionScoreInput = {
          score: compScore.score,
          confidence: compScore.confidence,
          competitorCount: competitorResult.metadata?.competitorsAnalyzed || 0,
          threats: compScore.threats || [],
          hasFreeAlternatives,
          marketMaturity: competitorResult.marketOverview?.maturityLevel,
        }
      }

      const marketData = communityVoiceResult?.marketSizing || marketSizingResult
      if (marketData) {
        marketScoreInput = {
          score: marketData.score,
          confidence: marketData.confidence,
          penetrationRequired: marketData.mscAnalysis.penetrationRequired,
          achievability: marketData.mscAnalysis.achievability,
        }
      }

      const timingData = communityVoiceResult?.timing || timingResult
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

      // Calculate viability
      const viability = calculateViability(painScoreInput, competitionScoreInput, marketScoreInput, timingScoreInput)

      return {
        id: job.id,
        hypothesis: job.hypothesis,
        createdAt: job.created_at || new Date().toISOString(),
        status: job.status as 'pending' | 'processing' | 'completed' | 'failed',

        viability: viability.availableDimensions > 0 ? viability : null,

        painScore: painScoreInput?.overallScore ?? null,
        marketScore: marketScoreInput?.score ?? null,
        competitionScore: competitionScoreInput?.score ?? null,
        timingScore: timingScoreInput?.score ?? null,

        painConfidence: painScoreInput ? normalizeConfidence(painScoreInput.confidence) : null,
        marketConfidence: marketScoreInput ? normalizeConfidence(marketScoreInput.confidence) : null,
        competitionConfidence: competitionScoreInput?.confidence ?? null,
        timingConfidence: timingScoreInput?.confidence ?? null,

        painSignalCount: communityVoiceResult?.painSummary?.totalSignals || 0,
        willingnessToPayCount: communityVoiceResult?.painSummary?.willingnessToPayCount || 0,
        competitorCount: competitorResult?.metadata?.competitorsAnalyzed || 0,
        postsAnalyzed: communityVoiceResult?.metadata?.postsAnalyzed || 0,

        tam: marketData?.tam?.value ?? null,
        sam: marketData?.sam?.value ?? null,
        som: marketData?.som?.value ?? null,
        penetrationRequired: marketData?.mscAnalysis?.penetrationRequired ?? null,

        tailwindCount: timingData?.tailwinds?.length || 0,
        headwindCount: timingData?.headwinds?.length || 0,
        trend: timingData?.trend ?? null,

        sampleSizeLabel: viability.sampleSize?.label ?? null,
      }
    })

    // Calculate best by category
    const bestByCategory = {
      viability: findBestBy(hypotheses, h => h.viability?.overallScore),
      pain: findBestBy(hypotheses, h => h.painScore),
      market: findBestBy(hypotheses, h => h.tam), // Largest TAM
      competition: findBestBy(hypotheses, h => h.competitionScore), // Higher = less competitive
      timing: findBestBy(hypotheses, h => h.timingScore),
      confidence: findBestBy(hypotheses, h => {
        // Score based on sample size
        const labels = { 'high_confidence': 4, 'moderate_confidence': 3, 'low_confidence': 2, 'very_limited': 1 }
        return h.sampleSizeLabel ? labels[h.sampleSizeLabel] : 0
      }),
    }

    const response: ComparisonResponse = {
      hypotheses,
      bestByCategory,
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Comparison API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function normalizeConfidence(
  confidence: 'very_low' | 'low' | 'medium' | 'high'
): 'low' | 'medium' | 'high' {
  return confidence === 'very_low' ? 'low' : confidence
}

function findBestBy(
  hypotheses: ComparisonHypothesis[],
  getValue: (h: ComparisonHypothesis) => number | null | undefined
): string | null {
  let bestId: string | null = null
  let bestValue = -Infinity

  for (const h of hypotheses) {
    const value = getValue(h)
    if (value !== null && value !== undefined && value > bestValue) {
      bestValue = value
      bestId = h.id
    }
  }

  return bestId
}
