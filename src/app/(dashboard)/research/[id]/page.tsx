import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { CommunityVoiceResults } from '@/components/research/community-voice-results'
import { DataQualityCard } from '@/components/research/data-quality-card'
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
import { ResearchMetadata } from '@/components/research/research-metadata'
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
} from '@/lib/analysis/viability-calculator'
import { calculateOverallPainScore } from '@/lib/analysis/pain-detector'

export const dynamic = 'force-dynamic'

interface ResearchJob {
  id: string
  hypothesis: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
  updated_at: string
  user_id: string
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

    painScoreInput = {
      overallScore: painScoreResult.score,
      confidence: painScoreResult.confidence,
      totalSignals: painSummary.totalSignals,
      willingnessToPayCount: painSummary.willingnessToPayCount,
    }
  }

  if (competitorResult?.data?.competitionScore) {
    const compScore = competitorResult.data.competitionScore
    competitionScoreInput = {
      score: compScore.score,
      confidence: compScore.confidence,
      competitorCount: competitorResult.data.metadata.competitorsAnalyzed,
      threats: compScore.threats || [],
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

  const viabilityVerdict = calculateViability(painScoreInput, competitionScoreInput, marketScoreInput, timingScoreInput)

  // For backwards compatibility
  const result = communityVoiceResult

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back button and header */}
      <div className="mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold mb-2">{researchJob.hypothesis}</h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatDate(researchJob.created_at)}
                </span>
                {result?.data?.metadata?.processingTimeMs && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {(result.data.metadata.processingTimeMs / 1000).toFixed(1)}s processing
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
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
                    ? 'bg-green-100 text-green-700'
                    : researchJob.status === 'processing'
                    ? 'bg-blue-100 text-blue-700'
                    : researchJob.status === 'failed'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-700'
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
                  <CommunityVoiceResults
                    results={communityVoiceResult.data}
                    jobId={id}
                    hypothesis={researchJob.hypothesis}
                    showNextStep={false}
                  />
                  {communityVoiceResult.data.metadata.filteringMetrics && (
                    <DataQualityCard
                      postsFound={communityVoiceResult.data.metadata.filteringMetrics.postsFound}
                      postsAnalyzed={communityVoiceResult.data.metadata.filteringMetrics.postsAnalyzed}
                      postsFiltered={communityVoiceResult.data.metadata.filteringMetrics.postsFiltered}
                      postFilterRate={communityVoiceResult.data.metadata.filteringMetrics.postFilterRate}
                      commentsFound={communityVoiceResult.data.metadata.filteringMetrics.commentsFound}
                      commentsAnalyzed={communityVoiceResult.data.metadata.filteringMetrics.commentsAnalyzed}
                      commentsFiltered={communityVoiceResult.data.metadata.filteringMetrics.commentsFiltered}
                      commentFilterRate={communityVoiceResult.data.metadata.filteringMetrics.commentFilterRate}
                      qualityLevel={communityVoiceResult.data.metadata.filteringMetrics.qualityLevel}
                    />
                  )}
                  <ResearchMetadata
                    postsAnalyzed={communityVoiceResult.data.metadata.postsAnalyzed}
                    commentsAnalyzed={communityVoiceResult.data.metadata.commentsAnalyzed}
                    subredditsSearched={communityVoiceResult.data.subreddits.analyzed}
                    dateRange={communityVoiceResult.data.painSummary.dateRange}
                    dataConfidence={communityVoiceResult.data.painSummary.dataConfidence}
                    temporalDistribution={communityVoiceResult.data.painSummary.temporalDistribution}
                    recencyScore={communityVoiceResult.data.painSummary.recencyScore}
                    dataSource="Reddit discussions"
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
                <p className="text-muted-foreground mb-4">
                  Unfortunately, the research process encountered an error.
                </p>
                <Link href="/research">
                  <Button>Try Again</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : communityVoiceResult?.data || competitorResult?.data ? (
          /* Tabbed Results Interface */
          <ResearchTabsProvider>
            {/* Competitor Prompt Modal - shows when Community Voice is done but no competitors */}
            {communityVoiceResult?.data && !competitorResult?.data && (
              <CompetitorPromptModal
                jobId={id}
                hypothesis={researchJob.hypothesis}
              />
            )}

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
                  <CommunityVoiceResults
                    results={communityVoiceResult.data}
                    jobId={id}
                    hypothesis={researchJob.hypothesis}
                    showNextStep={false}
                  />
                  {/* Data Quality Card - Filtering transparency */}
                  {communityVoiceResult.data.metadata.filteringMetrics && (
                    <DataQualityCard
                      postsFound={communityVoiceResult.data.metadata.filteringMetrics.postsFound}
                      postsAnalyzed={communityVoiceResult.data.metadata.filteringMetrics.postsAnalyzed}
                      postsFiltered={communityVoiceResult.data.metadata.filteringMetrics.postsFiltered}
                      postFilterRate={communityVoiceResult.data.metadata.filteringMetrics.postFilterRate}
                      commentsFound={communityVoiceResult.data.metadata.filteringMetrics.commentsFound}
                      commentsAnalyzed={communityVoiceResult.data.metadata.filteringMetrics.commentsAnalyzed}
                      commentsFiltered={communityVoiceResult.data.metadata.filteringMetrics.commentsFiltered}
                      commentFilterRate={communityVoiceResult.data.metadata.filteringMetrics.commentFilterRate}
                      qualityLevel={communityVoiceResult.data.metadata.filteringMetrics.qualityLevel}
                    />
                  )}
                  {/* Research Metadata - Data quality and transparency */}
                  <ResearchMetadata
                    postsAnalyzed={communityVoiceResult.data.metadata.postsAnalyzed}
                    commentsAnalyzed={communityVoiceResult.data.metadata.commentsAnalyzed}
                    subredditsSearched={communityVoiceResult.data.subreddits.analyzed}
                    dateRange={communityVoiceResult.data.painSummary.dateRange}
                    dataConfidence={communityVoiceResult.data.painSummary.dataConfidence}
                    temporalDistribution={communityVoiceResult.data.painSummary.temporalDistribution}
                    recencyScore={communityVoiceResult.data.painSummary.recencyScore}
                    dataSource="Reddit discussions"
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
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h3 className="text-lg font-semibold">Market Sizing Analysis</h3>
                          <p className="text-sm text-muted-foreground">
                            TAM/SAM/SOM estimation via Fermi analysis
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold">
                            {marketData.score.toFixed(1)}
                            <span className="text-lg text-muted-foreground">/10</span>
                          </div>
                          <Badge variant={
                            marketData.mscAnalysis.achievability === 'highly_achievable' ? 'default' :
                            marketData.mscAnalysis.achievability === 'achievable' ? 'secondary' :
                            'destructive'
                          }>
                            {marketData.mscAnalysis.achievability.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>

                      {/* TAM/SAM/SOM Breakdown */}
                      <div className="space-y-4">
                        <div className="p-4 bg-blue-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-blue-900">TAM (Total Addressable Market)</span>
                            <span className="text-blue-700 font-bold">
                              {marketData.tam.value.toLocaleString()} users
                            </span>
                          </div>
                          <p className="text-sm text-blue-700">{marketData.tam.description}</p>
                          <p className="text-xs text-blue-600 mt-1">{marketData.tam.reasoning}</p>
                        </div>

                        <div className="p-4 bg-green-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-green-900">SAM (Serviceable Available Market)</span>
                            <span className="text-green-700 font-bold">
                              {marketData.sam.value.toLocaleString()} users
                            </span>
                          </div>
                          <p className="text-sm text-green-700">{marketData.sam.description}</p>
                          <p className="text-xs text-green-600 mt-1">{marketData.sam.reasoning}</p>
                        </div>

                        <div className="p-4 bg-purple-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-purple-900">SOM (Serviceable Obtainable Market)</span>
                            <span className="text-purple-700 font-bold">
                              {marketData.som.value.toLocaleString()} users
                            </span>
                          </div>
                          <p className="text-sm text-purple-700">{marketData.som.description}</p>
                          <p className="text-xs text-purple-600 mt-1">{marketData.som.reasoning}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* MSC Analysis */}
                  <Card>
                    <CardContent className="pt-6">
                      <h3 className="text-lg font-semibold mb-4">Revenue Goal Analysis</h3>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="p-4 bg-muted rounded-lg">
                          <div className="text-sm text-muted-foreground">Customers Needed</div>
                          <div className="text-2xl font-bold">
                            {marketData.mscAnalysis.customersNeeded.toLocaleString()}
                          </div>
                        </div>
                        <div className="p-4 bg-muted rounded-lg">
                          <div className="text-sm text-muted-foreground">Penetration Required</div>
                          <div className="text-2xl font-bold">
                            {marketData.mscAnalysis.penetrationRequired.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {marketData.mscAnalysis.verdict}
                      </p>
                    </CardContent>
                  </Card>

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
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between mb-6">
                        <div>
                          <h3 className="text-lg font-semibold">Market Timing Analysis</h3>
                          <p className="text-sm text-muted-foreground">
                            Tailwinds, headwinds, and timing window assessment
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold">
                            {timingData.score.toFixed(1)}
                            <span className="text-lg text-muted-foreground">/10</span>
                          </div>
                          <Badge variant={
                            timingData.trend === 'rising' ? 'default' :
                            timingData.trend === 'stable' ? 'secondary' :
                            'destructive'
                          }>
                            {timingData.trend === 'rising' ? '↑ Rising' :
                             timingData.trend === 'stable' ? '→ Stable' :
                             '↓ Falling'}
                          </Badge>
                        </div>
                      </div>

                      {/* Timing Window */}
                      <div className="p-4 bg-muted rounded-lg mb-6">
                        <div className="text-sm text-muted-foreground">Timing Window</div>
                        <div className="text-xl font-bold">{timingData.timingWindow}</div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {timingData.verdict}
                        </p>
                      </div>

                      {/* Tailwinds */}
                      {timingData.tailwinds && timingData.tailwinds.length > 0 && (
                        <div className="mb-6">
                          <h4 className="font-medium text-green-700 mb-3 flex items-center gap-2">
                            <span className="text-lg">↑</span> Tailwinds ({timingData.tailwinds.length})
                          </h4>
                          <div className="space-y-3">
                            {timingData.tailwinds.map((tw, i) => (
                              <div key={i} className="p-3 bg-green-50 rounded-lg border border-green-200">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium text-green-900">{tw.signal}</span>
                                  <Badge variant="outline" className={
                                    tw.impact === 'high' ? 'bg-green-100 text-green-800 border-green-300' :
                                    tw.impact === 'medium' ? 'bg-green-50 text-green-700 border-green-200' :
                                    'bg-gray-50 text-gray-600 border-gray-200'
                                  }>
                                    {tw.impact} impact
                                  </Badge>
                                </div>
                                <p className="text-sm text-green-700">{tw.description}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Headwinds */}
                      {timingData.headwinds && timingData.headwinds.length > 0 && (
                        <div>
                          <h4 className="font-medium text-red-700 mb-3 flex items-center gap-2">
                            <span className="text-lg">↓</span> Headwinds ({timingData.headwinds.length})
                          </h4>
                          <div className="space-y-3">
                            {timingData.headwinds.map((hw, i) => (
                              <div key={i} className="p-3 bg-red-50 rounded-lg border border-red-200">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium text-red-900">{hw.signal}</span>
                                  <Badge variant="outline" className={
                                    hw.impact === 'high' ? 'bg-red-100 text-red-800 border-red-300' :
                                    hw.impact === 'medium' ? 'bg-red-50 text-red-700 border-red-200' :
                                    'bg-gray-50 text-gray-600 border-gray-200'
                                  }>
                                    {hw.impact} impact
                                  </Badge>
                                </div>
                                <p className="text-sm text-red-700">{hw.description}</p>
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
  )
}
