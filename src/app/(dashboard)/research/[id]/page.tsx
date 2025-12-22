import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { CommunityVoiceResults } from '@/components/research/community-voice-results'
import { ResearchHeroStats } from '@/components/research/research-hero-stats'
import { CompetitorResults } from '@/components/research/competitor-results'
import { CompetitorRunner } from '@/components/research/competitor-runner'
import { ViabilityVerdictDisplay } from '@/components/research/viability-verdict'
import { CompetitorPromptModal, CompetitorPromptBanner } from '@/components/research/competitor-prompt-modal'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ResearchTabsProvider } from '@/components/research/research-tabs-context'
import { ControlledTabs } from '@/components/research/controlled-tabs'
import Link from 'next/link'
import { ArrowLeft, Calendar, Clock, AlertCircle, TrendingUp, Shield, Target, PieChart, Timer } from 'lucide-react'
import { PDFDownloadButton } from '@/components/research/pdf-download-button'
import { ReportProblem } from '@/components/research/report-problem'
import { AskAnythingSidebar } from '@/components/research/ask-anything-sidebar'
import { StatusPoller } from '@/components/research/status-poller'
import { ResearchTrigger } from '@/components/research/research-trigger'
import { PartialResultsContainer } from '@/components/research/partial-results-container'
import { CommunityVoiceResult } from '@/app/api/research/community-voice/route'
import { CompetitorIntelligenceResult } from '@/app/api/research/competitor-intelligence/route'
import {
  calculateViability,
  PainScoreInput,
  CompetitionScoreInput,
  MarketScoreInput,
  TimingScoreInput,
  TwoAxisInput,
} from '@/lib/analysis/viability-calculator'
import { SearchCoverageSection, createSourceCoverage } from '@/components/research/search-coverage-section'
import { AdjacentOpportunitiesSection, extractAdjacentOpportunities } from '@/components/research/adjacent-opportunities'
import { calculateOverallPainScore } from '@/lib/analysis/pain-detector'
import { AppOverview } from '@/components/research/app-overview'
import { UserFeedback } from '@/components/research/user-feedback'
import { Opportunities } from '@/components/research/opportunities'
import { DataQualityInsights, DataQualityDiagnostics } from '@/components/research/data-quality-insights'
import { Smartphone, MessageSquare, Sparkles } from 'lucide-react'
import type { AppDetails } from '@/lib/data-sources/types'

export const dynamic = 'force-dynamic'

interface ResearchJob {
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
    [key: string]: unknown
  } | null
}

interface ResearchResult<T = CommunityVoiceResult | CompetitorIntelligenceResult> {
  id: string
  job_id: string
  module_name: string
  data: T
  created_at: string
}

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function ResearchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Fetch the research job
  const { data: job, error: jobError } = await supabase
    .from('research_jobs')
    .select('*')
    .eq('id', id)
    .single()

  if (jobError || !job) {
    notFound()
  }

  const researchJob = job as ResearchJob

  // Verify user owns this job
  if (researchJob.user_id !== user.id) {
    notFound()
  }

  // Extract app-centric mode data from coverage_data
  const isAppAnalysis = researchJob.coverage_data?.mode === 'app-analysis'
  const appData = researchJob.coverage_data?.appData || null

  // Extract structured hypothesis for cleaner display
  const structuredHypothesis = researchJob.coverage_data?.structuredHypothesis as {
    audience?: string
    problem?: string
  } | undefined

  // Fetch all research results for this job
  const { data: allResults, error: resultsError } = await supabase
    .from('research_results')
    .select('*')
    .eq('job_id', id)

  console.log('Fetching results for job:', id)
  console.log('All results:', allResults?.length || 0, 'found')
  console.log('Results error:', resultsError?.message || 'None')

  // Extract community voice and competitor results
  // Check both old module names (community_voice, competitor_intel) and new step-based names (pain_analysis, competitor_intelligence)
  const communityVoiceResult = allResults?.find(
    (r) => r.module_name === 'community_voice' || r.module_name === 'pain_analysis'
  ) as ResearchResult<CommunityVoiceResult> | undefined

  const competitorResult = allResults?.find(
    (r) => r.module_name === 'competitor_intel' || r.module_name === 'competitor_intelligence'
  ) as ResearchResult<CompetitorIntelligenceResult> | undefined

  // Also fetch market sizing and timing if stored separately (step-based flow)
  const marketSizingResult = allResults?.find(
    (r) => r.module_name === 'market_sizing'
  )

  const timingResult = allResults?.find(
    (r) => r.module_name === 'timing_analysis'
  )

  // Calculate viability score if we have at least one result
  let painScoreInput: PainScoreInput | null = null
  let competitionScoreInput: CompetitionScoreInput | null = null
  let marketScoreInput: MarketScoreInput | null = null
  let timingScoreInput: TimingScoreInput | null = null

  if (communityVoiceResult?.data?.painSummary) {
    const rawPainSummary = communityVoiceResult.data.painSummary

    // Create a complete PainSummary with defaults for backward compatibility
    const painSummary = {
      totalSignals: rawPainSummary.totalSignals || 0,
      averageScore: rawPainSummary.averageScore || 0,
      highIntensityCount: rawPainSummary.highIntensityCount || 0,
      mediumIntensityCount: rawPainSummary.mediumIntensityCount || 0,
      lowIntensityCount: rawPainSummary.lowIntensityCount || 0,
      solutionSeekingCount: rawPainSummary.solutionSeekingCount || 0,
      willingnessToPayCount: rawPainSummary.willingnessToPayCount || 0,
      topSubreddits: rawPainSummary.topSubreddits || [],
      // New fields with defaults for old data
      dataConfidence: (rawPainSummary as { dataConfidence?: 'very_low' | 'low' | 'medium' | 'high' }).dataConfidence || 'low',
      strongestSignals: (rawPainSummary as { strongestSignals?: string[] }).strongestSignals || [],
      wtpQuotes: (rawPainSummary as { wtpQuotes?: { text: string; subreddit: string }[] }).wtpQuotes || [],
      // Phase 2: Temporal distribution fields with defaults for backwards compatibility
      temporalDistribution: (rawPainSummary as { temporalDistribution?: { last30Days: number; last90Days: number; last180Days: number; older: number } }).temporalDistribution || {
        last30Days: 0,
        last90Days: 0,
        last180Days: 0,
        older: rawPainSummary.totalSignals || 0, // Assume all old data is older
      },
      dateRange: (rawPainSummary as { dateRange?: { oldest: string; newest: string } }).dateRange,
      recencyScore: (rawPainSummary as { recencyScore?: number }).recencyScore ?? 0.5, // Default to middle score
    }

    // Calculate the overall pain score using the enhanced calculator
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
      postsAnalyzed: communityVoiceResult.data.metadata?.postsAnalyzed,
      averageIntensity,
    }
  }

  if (competitorResult?.data?.competitionScore) {
    const compScore = competitorResult.data.competitionScore

    // Determine if any competitor offers free alternatives
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

  // Extract market sizing from community voice result OR separate market_sizing result (step-based flow)
  const marketData = communityVoiceResult?.data?.marketSizing || (marketSizingResult?.data as CommunityVoiceResult['marketSizing'])
  if (marketData) {
    marketScoreInput = {
      score: marketData.score,
      confidence: marketData.confidence,
      penetrationRequired: marketData.mscAnalysis.penetrationRequired,
      achievability: marketData.mscAnalysis.achievability,
    }
  }

  // Extract timing from community voice result OR separate timing_analysis result (step-based flow)
  const timingData = communityVoiceResult?.data?.timing || (timingResult?.data as CommunityVoiceResult['timing'])
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

  // Prepare two-axis input for Report Redesign v6
  const filteringMetrics = communityVoiceResult?.data?.metadata?.filteringMetrics
  const twoAxisInput: TwoAxisInput | undefined = filteringMetrics ? {
    filteringMetrics: {
      coreSignals: filteringMetrics.coreSignals || 0,
      relatedSignals: filteringMetrics.relatedSignals || 0,
      postsAnalyzed: filteringMetrics.postsAnalyzed || 0,
      sources: ['reddit'],  // Currently only Reddit
    },
    marketScore: marketScoreInput?.score,
    timingScore: timingScoreInput?.score,
    competitorCount: competitionScoreInput?.competitorCount,
  } : undefined

  const viabilityVerdict = calculateViability(painScoreInput, competitionScoreInput, marketScoreInput, timingScoreInput, twoAxisInput)

  // P1 FIX: Add additional red flags from filteringMetrics
  // Only show warnings when they indicate actual problems (not just normal filtering)
  if (filteringMetrics) {
    // Initialize redFlags array if needed
    if (!viabilityVerdict.redFlags) {
      viabilityVerdict.redFlags = []
    }

    // Flag narrow problem definition - only if the narrowness actually hurt results
    // (threshold raised to 70% and requires <15 posts in relevance-filter.ts)
    if (filteringMetrics.narrowProblemWarning) {
      viabilityVerdict.redFlags.push({
        severity: 'MEDIUM',
        title: 'Narrow Problem Definition',
        message: `${Math.round(filteringMetrics.stage2FilterRate || 0)}% of domain-relevant posts didn't match your specific problem. Consider broadening your hypothesis.`,
      })
    }

    // Flag very low data quality - only if we have very few posts to analyze
    // Raised threshold: 95% filter rate AND less than 10 posts analyzed
    const postsAnalyzed = filteringMetrics.postsAnalyzed || 0
    if (filteringMetrics.qualityLevel === 'low' && filteringMetrics.postFilterRate > 95 && postsAnalyzed < 10) {
      viabilityVerdict.redFlags.push({
        severity: 'MEDIUM',
        title: 'Very High Filter Rate',
        message: `Only ${postsAnalyzed} relevant posts found. Results may be less reliable.`,
      })
    }
  }

  // For backwards compatibility
  const result = communityVoiceResult

  // Determine if we should show the sidebar (only when we have completed results)
  const showSidebar = researchJob.status === 'completed' && (communityVoiceResult?.data || competitorResult?.data)

  return (
    <div className="flex gap-6 max-w-7xl mx-auto">
      {/* Main Content */}
      <div className={showSidebar ? "flex-1 min-w-0" : "max-w-4xl mx-auto w-full"}>
      {/* Back button and header */}
      <div className="mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="mb-4 -ml-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>

          {/* Clean Hypothesis Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Show structured hypothesis if available, otherwise truncated raw hypothesis */}
              {structuredHypothesis?.audience && structuredHypothesis?.problem ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Audience</span>
                    <h1 className="text-xl font-semibold">{structuredHypothesis.audience}</h1>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Problem</span>
                    <p className="text-base text-muted-foreground">{structuredHypothesis.problem}</p>
                  </div>
                </div>
              ) : (
                <h1 className="text-xl font-semibold leading-snug line-clamp-2" title={researchJob.hypothesis}>
                  {researchJob.hypothesis.length > 120
                    ? researchJob.hypothesis.slice(0, 120) + '...'
                    : researchJob.hypothesis}
                </h1>
              )}
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-3">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {formatDate(researchJob.created_at)}
                </span>
                {result?.data?.metadata?.processingTimeMs && (
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    {(result.data.metadata.processingTimeMs / 1000).toFixed(1)}s processing
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {(communityVoiceResult?.data || competitorResult?.data) && (
                <PDFDownloadButton
                  reportData={{
                    hypothesis: researchJob.hypothesis,
                    createdAt: formatDate(researchJob.created_at),
                    viability: viabilityVerdict,
                    communityVoice: communityVoiceResult?.data,
                    competitors: competitorResult?.data,
                  }}
                />
              )}
              <Badge
                className={
                  researchJob.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-400'
                    : researchJob.status === 'processing'
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-500/20 dark:text-blue-400'
                    : researchJob.status === 'failed'
                    ? 'bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-500/20 dark:text-red-400'
                    : 'bg-muted text-muted-foreground'
                }
              >
                {researchJob.status.charAt(0).toUpperCase() + researchJob.status.slice(1)}
              </Badge>
            </div>
          </div>
        </div>

        {/* Results or status message */}
        {/* Show partial results during processing if we have any results */}
        {(researchJob.status === 'processing' || researchJob.status === 'pending') && (communityVoiceResult?.data || competitorResult?.data) ? (
          <ResearchTabsProvider>
          <PartialResultsContainer
            jobId={id}
            jobStatus={researchJob.status}
            initialResultsCount={allResults?.length || 0}
          >
            <ControlledTabs className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="community" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                <span className="hidden sm:inline">Community</span>
                {communityVoiceResult?.data && (
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                )}
              </TabsTrigger>
              <TabsTrigger value="market" className="flex items-center gap-2">
                <PieChart className="h-4 w-4" />
                <span className="hidden sm:inline">Market</span>
                {(communityVoiceResult?.data?.marketSizing || marketSizingResult) && (
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                )}
              </TabsTrigger>
              <TabsTrigger value="timing" className="flex items-center gap-2">
                <Timer className="h-4 w-4" />
                <span className="hidden sm:inline">Timing</span>
                {(communityVoiceResult?.data?.timing || timingResult) && (
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                )}
              </TabsTrigger>
              <TabsTrigger value="competitors" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">Competitors</span>
                {competitorResult?.data && (
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                )}
              </TabsTrigger>
              <TabsTrigger value="verdict" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                <span className="hidden sm:inline">Verdict</span>
                {viabilityVerdict.availableDimensions > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {viabilityVerdict.overallScore.toFixed(1)}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Community Voice Tab */}
            <TabsContent value="community">
              {communityVoiceResult?.data ? (
                <div className="space-y-6">
                  {/* Research Hero Stats - Compact summary with Pain Score gauge */}
                  {communityVoiceResult.data.metadata.filteringMetrics && painScoreInput && (
                    <ResearchHeroStats
                      painScore={painScoreInput.overallScore}
                      painScoreConfidence={painScoreInput.confidence}
                      totalSignals={communityVoiceResult.data.painSummary?.totalSignals ?? 0}
                      coreSignals={communityVoiceResult.data.metadata.filteringMetrics.coreSignals}
                      relevanceRate={communityVoiceResult.data.metadata.filteringMetrics.postsFound > 0 ? Math.round((communityVoiceResult.data.metadata.filteringMetrics.postsAnalyzed / communityVoiceResult.data.metadata.filteringMetrics.postsFound) * 100) : 0}
                      dataConfidence={communityVoiceResult.data.painSummary?.dataConfidence ?? 'low'}
                      recencyScore={communityVoiceResult.data.painSummary?.recencyScore}
                      dataSources={communityVoiceResult.data.metadata.dataSources}
                      communitiesCount={communityVoiceResult.data.subreddits?.analyzed?.length ?? 0}
                      communityNames={communityVoiceResult.data.subreddits?.analyzed}
                      dateRange={communityVoiceResult.data.painSummary?.dateRange}
                      postsAnalyzed={communityVoiceResult.data.metadata.postsAnalyzed}
                      totalPostsFound={communityVoiceResult.data.metadata.filteringMetrics.postsFound}
                      commentsAnalyzed={communityVoiceResult.data.metadata.commentsAnalyzed}
                      processingTimeMs={communityVoiceResult.data.metadata.processingTimeMs}
                    />
                  )}
                  <CommunityVoiceResults
                    results={communityVoiceResult.data}
                    jobId={id}
                    hypothesis={researchJob.hypothesis}
                    showNextStep={false}
                  />
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center">
                      <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Community Voice Processing</h3>
                      <p className="text-muted-foreground">
                        Analysis is still in progress...
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Market Tab - simplified for partial results */}
            <TabsContent value="market">
              {marketData ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-lg font-semibold">Market Sizing Analysis</h3>
                        <p className="text-sm text-muted-foreground">TAM/SAM/SOM estimation</p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold">{marketData.score.toFixed(1)}<span className="text-lg text-muted-foreground">/10</span></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center">
                      <PieChart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Market Sizing Processing</h3>
                      <p className="text-muted-foreground">Analysis is still in progress...</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Timing Tab - simplified for partial results */}
            <TabsContent value="timing">
              {timingData ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-lg font-semibold">Market Timing Analysis</h3>
                        <p className="text-sm text-muted-foreground">Tailwinds and headwinds</p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold">{timingData.score.toFixed(1)}<span className="text-lg text-muted-foreground">/10</span></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center">
                      <Timer className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Timing Analysis Processing</h3>
                      <p className="text-muted-foreground">Analysis is still in progress...</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Competitors Tab */}
            <TabsContent value="competitors">
              {competitorResult?.data ? (
                <CompetitorResults results={competitorResult.data} />
              ) : (
                <CompetitorRunner jobId={id} hypothesis={researchJob.hypothesis} />
              )}
            </TabsContent>

            {/* Verdict Tab */}
            <TabsContent value="verdict">
              {communityVoiceResult?.data && !competitorResult?.data && (
                <div className="mb-6">
                  <CompetitorPromptBanner
                    jobId={id}
                    hypothesis={researchJob.hypothesis}
                  />
                </div>
              )}
              <ViabilityVerdictDisplay
                verdict={viabilityVerdict}
                hypothesis={researchJob.hypothesis}
                jobId={id}
              />
            </TabsContent>
            </ControlledTabs>
          </PartialResultsContainer>
          </ResearchTabsProvider>
        ) : researchJob.status === 'processing' ? (
          <StatusPoller jobId={id} initialStatus="processing" hypothesis={researchJob.hypothesis} />
        ) : researchJob.status === 'pending' ? (
          <ResearchTrigger jobId={id} hypothesis={researchJob.hypothesis} />
        ) : researchJob.status === 'failed' ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Research Failed</h3>
                <p className="text-muted-foreground mb-2">
                  {researchJob.error_message || 'Unfortunately, the research process encountered an error.'}
                </p>
                <p className="text-sm text-green-600 mb-4">
                  Your credit has been automatically refunded.
                </p>
                <Link href="/research">
                  <Button>Try Again</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : communityVoiceResult?.data || competitorResult?.data ? (
          /* Tabbed Results Interface */
          <ResearchTabsProvider defaultTab={isAppAnalysis ? 'app-overview' : 'community'}>
            {/* Competitor Prompt Modal - shows when Community Voice is done but no competitors */}
            {communityVoiceResult?.data && !competitorResult?.data && !isAppAnalysis && (
              <CompetitorPromptModal
                jobId={id}
                hypothesis={researchJob.hypothesis}
              />
            )}

            <ControlledTabs className="space-y-6">
            {/* App-Centric Tabs */}
            {isAppAnalysis ? (
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="app-overview" className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  <span className="hidden sm:inline">App</span>
                  {appData && (
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="user-feedback" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">Feedback</span>
                  {communityVoiceResult?.data && (
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="community" className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="hidden sm:inline">Market</span>
                  {communityVoiceResult?.data && (
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="opportunities" className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  <span className="hidden sm:inline">Gaps</span>
                  {communityVoiceResult?.data && (
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="verdict" className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  <span className="hidden sm:inline">Verdict</span>
                  {viabilityVerdict.availableDimensions > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {viabilityVerdict.overallScore.toFixed(1)}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            ) : (
              /* Regular Hypothesis Tabs */
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="community" className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="hidden sm:inline">Community</span>
                  {communityVoiceResult?.data && (
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="market" className="flex items-center gap-2">
                  <PieChart className="h-4 w-4" />
                  <span className="hidden sm:inline">Market</span>
                  {(communityVoiceResult?.data?.marketSizing || marketSizingResult) && (
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="timing" className="flex items-center gap-2">
                  <Timer className="h-4 w-4" />
                  <span className="hidden sm:inline">Timing</span>
                  {(communityVoiceResult?.data?.timing || timingResult) && (
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="competitors" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  <span className="hidden sm:inline">Competitors</span>
                  {competitorResult?.data && (
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="verdict" className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  <span className="hidden sm:inline">Verdict</span>
                  {viabilityVerdict.availableDimensions > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {viabilityVerdict.overallScore.toFixed(1)}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            )}

            {/* App-Centric Tab Content */}
            {isAppAnalysis && (
              <>
                {/* App Overview Tab */}
                <TabsContent value="app-overview">
                  {appData ? (
                    <AppOverview appData={appData} />
                  ) : (
                    <Card>
                      <CardContent className="py-12">
                        <div className="text-center">
                          <Smartphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <h3 className="text-lg font-semibold mb-2">App Data Not Available</h3>
                          <p className="text-muted-foreground">
                            App details could not be loaded for this research.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* User Feedback Tab */}
                <TabsContent value="user-feedback">
                  {communityVoiceResult?.data ? (
                    <UserFeedback
                      painSignals={communityVoiceResult.data.painSignals || []}
                      appName={appData?.name}
                    />
                  ) : (
                    <Card>
                      <CardContent className="py-12">
                        <div className="text-center">
                          <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <h3 className="text-lg font-semibold mb-2">Feedback Analysis Pending</h3>
                          <p className="text-muted-foreground">
                            User feedback will appear here once analysis is complete.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Opportunities Tab */}
                <TabsContent value="opportunities">
                  {communityVoiceResult?.data ? (
                    <Opportunities
                      appData={appData}
                      painSignals={communityVoiceResult.data.painSignals || []}
                      painSummary={communityVoiceResult.data.painSummary}
                      wtpQuotes={communityVoiceResult.data.painSummary?.wtpQuotes}
                    />
                  ) : (
                    <Card>
                      <CardContent className="py-12">
                        <div className="text-center">
                          <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <h3 className="text-lg font-semibold mb-2">Opportunities Analysis Pending</h3>
                          <p className="text-muted-foreground">
                            Market opportunities will appear here once analysis is complete.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </>
            )}

            {/* Community Voice Tab */}
            <TabsContent value="community">
              {communityVoiceResult?.data ? (
                <div className="space-y-6">
                  {/* Research Hero Stats - Compact summary with Pain Score gauge */}
                  {communityVoiceResult.data.metadata.filteringMetrics && painScoreInput && (
                    <>
                      <ResearchHeroStats
                        painScore={painScoreInput.overallScore}
                        painScoreConfidence={painScoreInput.confidence}
                        totalSignals={communityVoiceResult.data.painSummary?.totalSignals ?? 0}
                        coreSignals={communityVoiceResult.data.metadata.filteringMetrics.coreSignals}
                        relevanceRate={communityVoiceResult.data.metadata.filteringMetrics.postsFound > 0 ? Math.round((communityVoiceResult.data.metadata.filteringMetrics.postsAnalyzed / communityVoiceResult.data.metadata.filteringMetrics.postsFound) * 100) : 0}
                        dataConfidence={communityVoiceResult.data.painSummary?.dataConfidence ?? 'low'}
                        recencyScore={communityVoiceResult.data.painSummary?.recencyScore}
                        dataSources={communityVoiceResult.data.metadata.dataSources}
                        communitiesCount={communityVoiceResult.data.subreddits?.analyzed?.length ?? 0}
                        communityNames={communityVoiceResult.data.subreddits?.analyzed}
                        dateRange={communityVoiceResult.data.painSummary?.dateRange}
                        postsAnalyzed={communityVoiceResult.data.metadata.postsAnalyzed}
                        totalPostsFound={communityVoiceResult.data.metadata.filteringMetrics.postsFound}
                        commentsAnalyzed={communityVoiceResult.data.metadata.commentsAnalyzed}
                        processingTimeMs={communityVoiceResult.data.metadata.processingTimeMs}
                      />
                      {/* Data Quality Insights - shows when scores are low */}
                      <DataQualityInsights
                        diagnostics={{
                          postsFound: communityVoiceResult.data.metadata.filteringMetrics.postsFound,
                          postsPassedFilter: communityVoiceResult.data.metadata.filteringMetrics.postsAnalyzed,
                          relevanceRate: communityVoiceResult.data.metadata.filteringMetrics.postsFound > 0 ? Math.round((communityVoiceResult.data.metadata.filteringMetrics.postsAnalyzed / communityVoiceResult.data.metadata.filteringMetrics.postsFound) * 100) : 0,
                          coreSignals: communityVoiceResult.data.metadata.filteringMetrics.coreSignals,
                          confidence: communityVoiceResult.data.painSummary?.dataConfidence ?? 'low',
                          expansionAttempts: communityVoiceResult.data.metadata.filteringMetrics.expansionAttempts,
                          communitiesSearched: communityVoiceResult.data.metadata.filteringMetrics.communitiesSearched || communityVoiceResult.data.subreddits?.analyzed,
                          timeRangeMonths: communityVoiceResult.data.metadata.filteringMetrics.timeRangeMonths,
                        }}
                      />
                    </>
                  )}
                  <CommunityVoiceResults
                    results={communityVoiceResult.data}
                    jobId={id}
                    hypothesis={researchJob.hypothesis}
                    showNextStep={false}
                  />
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center">
                      <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Community Voice Not Run</h3>
                      <p className="text-muted-foreground mb-4">
                        Run Community Voice analysis to discover pain points and market signals.
                      </p>
                      <Link href={`/research?hypothesis=${encodeURIComponent(researchJob.hypothesis)}`}>
                        <Button>
                          <TrendingUp className="h-4 w-4 mr-2" />
                          Run Community Voice
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Market Tab */}
            <TabsContent value="market">
              {marketData ? (
                <div className="space-y-6">
                  {/* Market Score Overview */}
                  <Card className="overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-500/10 via-emerald-500/10 to-purple-500/10 p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xl font-bold">Market Sizing Analysis</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            TAM/SAM/SOM estimation via Fermi analysis
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-4xl font-bold">
                            {marketData.score.toFixed(1)}
                            <span className="text-xl text-muted-foreground">/10</span>
                          </div>
                          <Badge className={
                            marketData.mscAnalysis.achievability === 'highly_achievable'
                              ? 'bg-emerald-500 hover:bg-emerald-600'
                              : marketData.mscAnalysis.achievability === 'achievable'
                              ? 'bg-blue-500 hover:bg-blue-600'
                              : 'bg-red-500 hover:bg-red-600'
                          }>
                            {marketData.mscAnalysis.achievability.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <CardContent className="pt-6">
                      {/* TAM/SAM/SOM Breakdown */}
                      <div className="space-y-4">
                        <div className="p-4 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-200 dark:border-blue-500/20">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-blue-900 dark:text-blue-100">TAM (Total Addressable Market)</span>
                            <span className="text-blue-700 dark:text-blue-300 font-bold text-lg">
                              {marketData.tam.value.toLocaleString()} users
                            </span>
                          </div>
                          <p className="text-sm text-blue-700 dark:text-blue-300">{marketData.tam.description}</p>
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{marketData.tam.reasoning}</p>
                        </div>

                        <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-emerald-900 dark:text-emerald-100">SAM (Serviceable Available Market)</span>
                            <span className="text-emerald-700 dark:text-emerald-300 font-bold text-lg">
                              {marketData.sam.value.toLocaleString()} users
                            </span>
                          </div>
                          <p className="text-sm text-emerald-700 dark:text-emerald-300">{marketData.sam.description}</p>
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">{marketData.sam.reasoning}</p>
                        </div>

                        <div className="p-4 bg-purple-50 dark:bg-purple-500/10 rounded-xl border border-purple-200 dark:border-purple-500/20">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-purple-900 dark:text-purple-100">SOM (Serviceable Obtainable Market)</span>
                            <span className="text-purple-700 dark:text-purple-300 font-bold text-lg">
                              {marketData.som.value.toLocaleString()} users
                            </span>
                          </div>
                          <p className="text-sm text-purple-700 dark:text-purple-300">{marketData.som.description}</p>
                          <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">{marketData.som.reasoning}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* MSC Analysis */}
                  <Card>
                    <CardContent className="pt-6">
                      <h3 className="text-lg font-semibold mb-4">Revenue Goal Analysis</h3>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="p-4 bg-muted/50 rounded-xl border">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Customers Needed</div>
                          <div className="text-3xl font-bold mt-1">
                            {marketData.mscAnalysis.customersNeeded.toLocaleString()}
                          </div>
                        </div>
                        <div className="p-4 bg-muted/50 rounded-xl border">
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Penetration Required</div>
                          <div className="text-3xl font-bold mt-1">
                            {marketData.mscAnalysis.penetrationRequired.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
                        {marketData.mscAnalysis.verdict}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Pricing Scenarios */}
                  {marketData.pricingScenarios && marketData.pricingScenarios.length > 0 && (
                    <Card>
                      <CardContent className="pt-6">
                        <h3 className="text-lg font-semibold mb-2">Pricing Scenarios</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          How different price points affect your path to revenue goal
                        </p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-2 px-3 font-medium">Price</th>
                                <th className="text-right py-2 px-3 font-medium">Customers</th>
                                <th className="text-right py-2 px-3 font-medium">Penetration</th>
                                <th className="text-left py-2 px-3 font-medium">Achievability</th>
                              </tr>
                            </thead>
                            <tbody>
                              {marketData.pricingScenarios.map((scenario: { price: number; label: string; customersNeeded: number; penetrationRequired: number; achievability: string; isUserPrice: boolean }, i: number) => (
                                <tr
                                  key={i}
                                  className={`border-b last:border-0 ${scenario.isUserPrice ? 'bg-primary/5 font-medium' : ''}`}
                                >
                                  <td className="py-2 px-3">
                                    <div className="flex items-center gap-2">
                                      <span>${scenario.price}/mo</span>
                                      <span className="text-xs text-muted-foreground">({scenario.label})</span>
                                      {scenario.isUserPrice && (
                                        <Badge variant="outline" className="text-xs">Selected</Badge>
                                      )}
                                    </div>
                                  </td>
                                  <td className="text-right py-2 px-3">
                                    {scenario.customersNeeded.toLocaleString()}
                                  </td>
                                  <td className="text-right py-2 px-3">
                                    {scenario.penetrationRequired.toFixed(1)}%
                                  </td>
                                  <td className="py-2 px-3">
                                    <Badge
                                      variant={
                                        scenario.achievability === 'highly_achievable' || scenario.achievability === 'achievable'
                                          ? 'default'
                                          : scenario.achievability === 'challenging'
                                          ? 'secondary'
                                          : 'destructive'
                                      }
                                      className={
                                        scenario.achievability === 'highly_achievable'
                                          ? 'bg-green-500 hover:bg-green-600'
                                          : scenario.achievability === 'achievable'
                                          ? 'bg-blue-500 hover:bg-blue-600'
                                          : ''
                                      }
                                    >
                                      {scenario.achievability.replace('_', ' ')}
                                    </Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p className="text-xs text-muted-foreground mt-4">
                          💡 Higher prices mean fewer customers needed but may limit your addressable market
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Suggestions */}
                  {marketData.suggestions && marketData.suggestions.length > 0 && (
                    <Card>
                      <CardContent className="pt-6">
                        <h3 className="text-lg font-semibold mb-4">Suggestions</h3>
                        <ul className="space-y-2">
                          {marketData.suggestions.map((suggestion, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <span className="text-primary">•</span>
                              <span>{suggestion}</span>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center">
                      <PieChart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Market Sizing Not Available</h3>
                      <p className="text-muted-foreground mb-4">
                        Market sizing is automatically generated when you run Community Voice analysis.
                      </p>
                      <Link href={`/research?hypothesis=${encodeURIComponent(researchJob.hypothesis)}`}>
                        <Button>
                          <TrendingUp className="h-4 w-4 mr-2" />
                          Run Community Voice
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Timing Tab */}
            <TabsContent value="timing">
              {timingData ? (
                <div className="space-y-6">
                  {/* Timing Score Overview */}
                  <Card className="overflow-hidden">
                    <div className={`p-6 ${
                      timingData.trend === 'rising'
                        ? 'bg-gradient-to-r from-emerald-500/10 to-emerald-500/5'
                        : timingData.trend === 'stable'
                        ? 'bg-gradient-to-r from-blue-500/10 to-blue-500/5'
                        : 'bg-gradient-to-r from-red-500/10 to-red-500/5'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xl font-bold">Market Timing Analysis</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            Tailwinds, headwinds, and timing window assessment
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-4xl font-bold">
                            {timingData.score.toFixed(1)}
                            <span className="text-xl text-muted-foreground">/10</span>
                          </div>
                          <Badge className={
                            timingData.trend === 'rising'
                              ? 'bg-emerald-500 hover:bg-emerald-600'
                              : timingData.trend === 'stable'
                              ? 'bg-blue-500 hover:bg-blue-600'
                              : 'bg-red-500 hover:bg-red-600'
                          }>
                            {timingData.trend === 'rising' ? '↑ Rising' :
                             timingData.trend === 'stable' ? '→ Stable' :
                             '↓ Falling'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <CardContent className="pt-6">
                      {/* Timing Window */}
                      <div className="p-4 bg-muted/50 rounded-xl border mb-6">
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Timing Window</div>
                        <div className="text-2xl font-bold mt-1">{timingData.timingWindow}</div>
                        <p className="text-sm text-muted-foreground mt-2">
                          {timingData.verdict}
                        </p>
                      </div>

                      {/* Tailwinds */}
                      {timingData.tailwinds && timingData.tailwinds.length > 0 && (
                        <div className="mb-6">
                          <h4 className="font-semibold text-emerald-700 dark:text-emerald-400 mb-3 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                              <span className="text-sm">↑</span>
                            </div>
                            Tailwinds ({timingData.tailwinds.length})
                          </h4>
                          <div className="space-y-3">
                            {timingData.tailwinds.map((tw, i) => (
                              <div key={i} className="p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium text-emerald-900 dark:text-emerald-100">{tw.signal}</span>
                                  <Badge className={
                                    tw.impact === 'high' ? 'bg-emerald-600 hover:bg-emerald-700' :
                                    tw.impact === 'medium' ? 'bg-emerald-500 hover:bg-emerald-600' :
                                    'bg-emerald-400 hover:bg-emerald-500'
                                  }>
                                    {tw.impact} impact
                                  </Badge>
                                </div>
                                <p className="text-sm text-emerald-700 dark:text-emerald-300">{tw.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Headwinds */}
                      {timingData.headwinds && timingData.headwinds.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
                              <span className="text-sm">↓</span>
                            </div>
                            Headwinds ({timingData.headwinds.length})
                          </h4>
                          <div className="space-y-3">
                            {timingData.headwinds.map((hw, i) => (
                              <div key={i} className="p-4 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-200 dark:border-red-500/20">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium text-red-900 dark:text-red-100">{hw.signal}</span>
                                  <Badge className={
                                    hw.impact === 'high' ? 'bg-red-600 hover:bg-red-700' :
                                    hw.impact === 'medium' ? 'bg-red-500 hover:bg-red-600' :
                                    'bg-red-400 hover:bg-red-500'
                                  }>
                                    {hw.impact} impact
                                  </Badge>
                                </div>
                                <p className="text-sm text-red-700 dark:text-red-300">{hw.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center">
                      <Timer className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Timing Analysis Not Available</h3>
                      <p className="text-muted-foreground mb-4">
                        Timing analysis is automatically generated when you run Community Voice analysis.
                      </p>
                      <Link href={`/research?hypothesis=${encodeURIComponent(researchJob.hypothesis)}`}>
                        <Button>
                          <TrendingUp className="h-4 w-4 mr-2" />
                          Run Community Voice
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Competitors Tab */}
            <TabsContent value="competitors">
              {competitorResult?.data ? (
                <CompetitorResults results={competitorResult.data} />
              ) : (
                <CompetitorRunner jobId={id} hypothesis={researchJob.hypothesis} />
              )}
            </TabsContent>

            {/* Verdict Tab */}
            <TabsContent value="verdict">
              {/* Banner when competitors are missing */}
              {communityVoiceResult?.data && !competitorResult?.data && (
                <div className="mb-6">
                  <CompetitorPromptBanner
                    jobId={id}
                    hypothesis={researchJob.hypothesis}
                  />
                </div>
              )}
              <ViabilityVerdictDisplay
                verdict={viabilityVerdict}
                hypothesis={researchJob.hypothesis}
                jobId={id}
              />
            </TabsContent>
            </ControlledTabs>
          </ResearchTabsProvider>
        ) : (
          /* No results at all - offer to start research */
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Research Not Started</h3>
                <p className="text-muted-foreground mb-4">
                  Start your 4-step research process to validate this hypothesis.
                </p>
                <Link href={`/research?hypothesis=${encodeURIComponent(researchJob.hypothesis)}`}>
                  <Button size="lg">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Start Research
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Report Problem Section */}
        {researchJob.status === 'completed' && (
          <div className="mt-8 pt-8 border-t">
            <ReportProblem jobId={researchJob.id} />
          </div>
        )}
      </div>

      {/* Chat Sidebar */}
      {showSidebar && (
        <div className="hidden lg:block w-80 flex-shrink-0">
          <div className="sticky top-4 h-[calc(100vh-6rem)] rounded-lg border shadow-sm overflow-hidden">
            <AskAnythingSidebar jobId={id} hypothesis={researchJob.hypothesis} />
          </div>
        </div>
      )}
    </div>
  )
}
