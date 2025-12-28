import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { CommunityVoiceResults } from '@/components/research/community-voice-results'
import { ResearchHeroStats } from '@/components/research/research-hero-stats'
import { CompetitorResults } from '@/components/research/competitor-results'
import { CompetitorRunner } from '@/components/research/competitor-runner'
import { CompetitorPromptBanner } from '@/components/research/competitor-prompt-modal'
import { ViabilityVerdictDisplay } from '@/components/research/viability-verdict'
import { VerdictHero } from '@/components/research/verdict-hero'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ResearchTabsProvider } from '@/components/research/research-tabs-context'
import { ControlledTabs } from '@/components/research/controlled-tabs'
import Link from 'next/link'
import { ArrowLeft, Calendar, Clock, AlertCircle, TrendingUp, Shield, Target, PieChart, Timer } from 'lucide-react'
import { ExportDropdown } from '@/components/research/export-dropdown'
import { ReportProblem } from '@/components/research/report-problem'
import { ChatPanel } from '@/components/research/chat-panel'
import { CollapsibleText } from '@/components/ui/collapsible-section'
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
import { calculateOverallPainScore } from '@/lib/analysis/pain-detector'
import { fetchResearchData, formatDate } from '@/lib/research/fetch-research-data'
import { ResearchDataProvider } from '@/components/research/research-data-provider'
import { ResultsLayout } from '@/components/research/layouts'

export const dynamic = 'force-dynamic'

// Types imported from fetch-research-data.ts

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

  // Use shared data fetching utility
  const { data: researchData, error: fetchError, notFound: isNotFound } = await fetchResearchData(id, user.id)

  if (isNotFound || !researchData) {
    notFound()
  }

  // Destructure for easier access
  const {
    job: researchJob,
    communityVoiceResult,
    competitorResult,
    marketSizingResult,
    timingResult,
    marketData,
    timingData,
    painScoreInput,
    viabilityVerdict,
    isAppAnalysis,
    appData,
    structuredHypothesis,
    filteringMetrics,
    showSidebar,
    allResultsCount,
  } = researchData

  // For backwards compatibility
  const result = communityVoiceResult

  return (
    <div className="max-w-6xl mx-auto">
      {/* Main Content */}
      <div className="w-full">
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
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground mt-1.5 flex-shrink-0">Audience</span>
                    <h1 className="text-xl font-semibold">
                      <CollapsibleText text={structuredHypothesis.audience} maxLength={80} />
                    </h1>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground mt-0.5 flex-shrink-0">Problem</span>
                    <p className="text-base text-muted-foreground">
                      <CollapsibleText text={structuredHypothesis.problem} maxLength={120} />
                    </p>
                  </div>
                </div>
              ) : (
                <h1 className="text-xl font-semibold leading-snug">
                  <CollapsibleText text={researchJob.hypothesis} maxLength={100} />
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
                <ExportDropdown
                  jobId={id}
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
            initialResultsCount={allResultsCount}
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
                      wtpCount={communityVoiceResult.data.painSummary?.willingnessToPayCount ?? 0}
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
          /* Results Layout - switches between Tabbed and Scroll views based on user preference */
          <ResearchDataProvider data={researchData}>
            <ResultsLayout />
          </ResearchDataProvider>
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

      {/* Chat Drawer - floating button that opens side drawer */}
      {showSidebar && (
        <ChatPanel jobId={id} hypothesis={researchJob.hypothesis} />
      )}
    </div>
  )
}
