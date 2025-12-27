'use client'

/**
 * TabbedView - Research results in a tabbed interface.
 *
 * Phase 4 Redesign - New Tab Structure:
 * - Summary: Key insights, data quality, quick actions
 * - Evidence: Pain signals, quotes, themes (was Community)
 * - Market: Sizing, timing, competitors (combined)
 * - Action: Next steps, interview guide
 *
 * Uses ResearchDataContext for all data.
 */

import { useResearchData } from '@/components/research/research-data-provider'
import { CommunityVoiceResults } from '@/components/research/community-voice-results'
import { InvestorMetricsHero } from '@/components/research/investor-metrics-hero'
import { SummaryTab } from '@/components/research/summary-tab'
import { ActionTab } from '@/components/research/action-tab'
import { CompetitorResults } from '@/components/research/competitor-results'
import { CompetitorRunner } from '@/components/research/competitor-runner'
import { TrustBadge } from '@/components/ui/trust-badge'
import { CompetitorPromptModal } from '@/components/research/competitor-prompt-modal'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ResearchTabsProvider } from '@/components/research/research-tabs-context'
import { ControlledTabs } from '@/components/research/controlled-tabs'
import Link from 'next/link'
import { TrendingUp, Shield, Target, PieChart, Timer, Smartphone, MessageSquare, Sparkles, BarChart3, CheckCircle2 } from 'lucide-react'
import { SearchCoverageSection } from '@/components/research/search-coverage-section'
import { createSourceCoverageData } from '@/lib/utils/coverage-helpers'
import { AppOverview } from '@/components/research/app-overview'
import { UserFeedback } from '@/components/research/user-feedback'
import { Opportunities } from '@/components/research/opportunities'
import { DataQualityInsights } from '@/components/research/data-quality-insights'

export function TabbedView() {
  const data = useResearchData()
  const {
    job,
    communityVoiceResult,
    competitorResult,
    marketData,
    timingData,
    painScoreInput,
    viabilityVerdict,
    isAppAnalysis,
    appData,
    filteringMetrics,
  } = data

  return (
    <ResearchTabsProvider defaultTab={isAppAnalysis ? 'app-overview' : 'summary'}>
      {/* Competitor Prompt Modal - shows when Community Voice is done but no competitors */}
      {communityVoiceResult?.data && !competitorResult?.data && !isAppAnalysis && (
        <CompetitorPromptModal
          jobId={job.id}
          hypothesis={job.hypothesis}
        />
      )}

      {/* Search Coverage Section - "What We Searched" transparency */}
      {communityVoiceResult?.data?.metadata?.filteringMetrics && (
        <SearchCoverageSection
          sources={createSourceCoverageData(
            {
              postsFound: communityVoiceResult.data.metadata.filteringMetrics.postsFound,
              postsAnalyzed: communityVoiceResult.data.metadata.filteringMetrics.postsAnalyzed,
              coreSignals: communityVoiceResult.data.metadata.filteringMetrics.coreSignals,
              relatedSignals: communityVoiceResult.data.metadata.filteringMetrics.relatedSignals,
              communitiesSearched: communityVoiceResult.data.subreddits?.analyzed,
              sources: communityVoiceResult.data.metadata.dataSources,
            },
            communityVoiceResult.data.painSummary?.totalSignals || 0
          )}
          totalAnalyzed={communityVoiceResult.data.metadata.filteringMetrics.postsFound || 0}
          className="mb-6"
        />
      )}

      {/* Investor Metrics Hero - Unified display above tabs */}
      {communityVoiceResult?.data && (
        <InvestorMetricsHero
          painScore={painScoreInput?.overallScore ?? 0}
          painScoreConfidence={painScoreInput?.confidence ?? 'low'}
          hypothesisConfidence={viabilityVerdict.hypothesisConfidence}
          marketOpportunity={viabilityVerdict.marketOpportunity}
          totalSignals={communityVoiceResult.data.painSummary?.totalSignals ?? 0}
          coreSignals={filteringMetrics?.coreSignals}
          wtpCount={communityVoiceResult.data.painSummary?.willingnessToPayCount ?? 0}
          dataConfidence={communityVoiceResult.data.painSummary?.dataConfidence ?? 'low'}
          relevanceRate={filteringMetrics?.postsFound ? Math.round((filteringMetrics.postsAnalyzed / filteringMetrics.postsFound) * 100) : 0}
          recencyScore={communityVoiceResult.data.painSummary?.recencyScore}
          postsAnalyzed={communityVoiceResult.data.metadata?.postsAnalyzed ?? 0}
          communitiesCount={communityVoiceResult.data.subreddits?.analyzed?.length ?? 0}
          dataSources={communityVoiceResult.data.metadata?.dataSources ?? []}
          hypothesis={job.hypothesis}
          timingScore={timingData?.score}
          competitionScore={competitorResult?.data?.competitionScore?.score}
          marketSizing={marketData ? {
            samFormatted: marketData.sam ? `${(marketData.sam.value / 1000000).toFixed(1)}M` : undefined,
            tamFormatted: marketData.tam ? `${(marketData.tam.value / 1000000).toFixed(1)}M` : undefined,
          } : undefined}
          verdict={viabilityVerdict}
          redFlags={viabilityVerdict.redFlags}
          className="mb-6"
        />
      )}

      <ControlledTabs className="space-y-6">
        {/* App-Centric Tabs */}
        {isAppAnalysis ? (
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="app-overview" className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              <span className="hidden sm:inline">App</span>
              {appData && <span className="w-2 h-2 rounded-full bg-green-500" />}
            </TabsTrigger>
            <TabsTrigger value="user-feedback" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Feedback</span>
              {communityVoiceResult?.data && <span className="w-2 h-2 rounded-full bg-green-500" />}
            </TabsTrigger>
            <TabsTrigger value="community" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Market</span>
              {communityVoiceResult?.data && <span className="w-2 h-2 rounded-full bg-green-500" />}
            </TabsTrigger>
            <TabsTrigger value="opportunities" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Gaps</span>
              {communityVoiceResult?.data && <span className="w-2 h-2 rounded-full bg-green-500" />}
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
          /* Regular Hypothesis Tabs - Phase 4 Redesign */
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="summary" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Summary</span>
              {communityVoiceResult?.data && <span className="w-2 h-2 rounded-full bg-green-500" />}
            </TabsTrigger>
            <TabsTrigger value="evidence" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Evidence</span>
              {communityVoiceResult?.data?.painSummary?.totalSignals && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {communityVoiceResult.data.painSummary.totalSignals}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="market" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Market</span>
              {(marketData || timingData || competitorResult?.data) && <span className="w-2 h-2 rounded-full bg-green-500" />}
            </TabsTrigger>
            <TabsTrigger value="action" className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              <span className="hidden sm:inline">Action</span>
            </TabsTrigger>
          </TabsList>
        )}

        {/* App-Centric Tab Content */}
        {isAppAnalysis && (
          <>
            <TabsContent value="app-overview">
              {appData ? (
                <AppOverview appData={appData} />
              ) : (
                <Card>
                  <CardContent className="py-12">
                    <div className="text-center">
                      <Smartphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">App Data Not Available</h3>
                      <p className="text-muted-foreground">App details could not be loaded.</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

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
                      <p className="text-muted-foreground">User feedback will appear once analysis is complete.</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

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
                      <p className="text-muted-foreground">Market opportunities will appear once analysis is complete.</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </>
        )}

        {/* Summary Tab - Key insights and quick verdict */}
        <TabsContent value="summary">
          {communityVoiceResult?.data ? (
            <SummaryTab
              communityVoiceResult={communityVoiceResult.data}
              competitorResult={competitorResult?.data}
              verdict={viabilityVerdict}
              hypothesis={job.hypothesis}
              marketData={marketData ?? undefined}
              timingData={timingData ?? undefined}
              filteringMetrics={filteringMetrics ?? undefined}
            />
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Research Not Complete</h3>
                  <p className="text-muted-foreground mb-4">
                    Run Community Voice analysis to get your summary and insights.
                  </p>
                  <Link href={`/research?hypothesis=${encodeURIComponent(job.hypothesis)}`}>
                    <Button>
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Start Research
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Evidence Tab - Pain signals, quotes, themes */}
        <TabsContent value="evidence">
          {communityVoiceResult?.data ? (
            <div className="space-y-6">
              {/* Data Quality Insights - detailed breakdown */}
              {filteringMetrics && (
                <DataQualityInsights
                  diagnostics={{
                    postsFound: filteringMetrics.postsFound,
                    postsPassedFilter: filteringMetrics.postsAnalyzed,
                    relevanceRate: filteringMetrics.postsFound > 0 ? Math.round((filteringMetrics.postsAnalyzed / filteringMetrics.postsFound) * 100) : 0,
                    coreSignals: filteringMetrics.coreSignals,
                    confidence: communityVoiceResult.data.painSummary?.dataConfidence ?? 'low',
                    expansionAttempts: filteringMetrics.expansionAttempts,
                    communitiesSearched: filteringMetrics.communitiesSearched || communityVoiceResult.data.subreddits?.analyzed,
                    timeRangeMonths: filteringMetrics.timeRangeMonths,
                  }}
                />
              )}
              <CommunityVoiceResults
                results={communityVoiceResult.data}
                jobId={job.id}
                hypothesis={job.hypothesis}
                showNextStep={false}
              />
            </div>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Evidence Not Available</h3>
                  <p className="text-muted-foreground mb-4">
                    Run Community Voice analysis to discover pain signals and quotes.
                  </p>
                  <Link href={`/research?hypothesis=${encodeURIComponent(job.hypothesis)}`}>
                    <Button>
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Start Research
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Market Tab - Combines sizing, timing, and competitors */}
        <TabsContent value="market">
          <div className="space-y-8">
            {/* Market Sizing Section */}
            {marketData ? (
              <MarketTabContent marketData={marketData} hypothesis={job.hypothesis} />
            ) : (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center">
                    <PieChart className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <h3 className="font-semibold mb-1">Market Sizing</h3>
                    <p className="text-sm text-muted-foreground">
                      Automatically generated when research completes.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Timing Section */}
            {timingData ? (
              <TimingTabContent timingData={timingData} hypothesis={job.hypothesis} />
            ) : (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center">
                    <Timer className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <h3 className="font-semibold mb-1">Market Timing</h3>
                    <p className="text-sm text-muted-foreground">
                      Tailwinds and headwinds analysis will appear here.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Competitors Section */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Competition</h2>
                {competitorResult?.data && (
                  <Badge variant="secondary">
                    {competitorResult.data.metadata?.competitorsAnalyzed || 0} analyzed
                  </Badge>
                )}
              </div>
              {competitorResult?.data ? (
                <CompetitorResults results={competitorResult.data} />
              ) : (
                <CompetitorRunner jobId={job.id} hypothesis={job.hypothesis} />
              )}
            </div>
          </div>
        </TabsContent>

        {/* Action Tab - Next steps and interview guide */}
        <TabsContent value="action">
          {communityVoiceResult?.data ? (
            <ActionTab
              communityVoiceResult={communityVoiceResult.data}
              verdict={viabilityVerdict}
              hypothesis={job.hypothesis}
            />
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Action Plan Not Available</h3>
                  <p className="text-muted-foreground mb-4">
                    Complete research to get personalized next steps.
                  </p>
                  <Link href={`/research?hypothesis=${encodeURIComponent(job.hypothesis)}`}>
                    <Button>
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Start Research
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </ControlledTabs>
    </ResearchTabsProvider>
  )
}

// ============================================================================
// Sub-components for Market and Timing tabs
// ============================================================================

function MarketTabContent({ marketData, hypothesis }: { marketData: NonNullable<ReturnType<typeof useResearchData>['marketData']>; hypothesis: string }) {
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500/10 via-emerald-500/10 to-purple-500/10 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold">Market Sizing Analysis</h3>
              <p className="text-sm text-muted-foreground mt-1">TAM/SAM/SOM estimation via Fermi analysis</p>
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
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-200 dark:border-blue-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-blue-900 dark:text-blue-100">TAM (Total Addressable Market)</span>
                <span className="text-blue-700 dark:text-blue-300 font-bold text-lg">
                  {marketData.tam.value.toLocaleString()} users
                </span>
              </div>
              <p className="text-sm text-blue-700 dark:text-blue-300">{marketData.tam.description}</p>
            </div>

            <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-emerald-900 dark:text-emerald-100">SAM (Serviceable Available Market)</span>
                <span className="text-emerald-700 dark:text-emerald-300 font-bold text-lg">
                  {marketData.sam.value.toLocaleString()} users
                </span>
              </div>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">{marketData.sam.description}</p>
            </div>

            <div className="p-4 bg-purple-50 dark:bg-purple-500/10 rounded-xl border border-purple-200 dark:border-purple-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-purple-900 dark:text-purple-100">SOM (Serviceable Obtainable Market)</span>
                <span className="text-purple-700 dark:text-purple-300 font-bold text-lg">
                  {marketData.som.value.toLocaleString()} users
                </span>
              </div>
              <p className="text-sm text-purple-700 dark:text-purple-300">{marketData.som.description}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">Revenue Goal Analysis</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-4 bg-muted/50 rounded-xl border">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Customers Needed</div>
              <div className="text-3xl font-bold mt-1">{marketData.mscAnalysis.customersNeeded.toLocaleString()}</div>
            </div>
            <div className="p-4 bg-muted/50 rounded-xl border">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Penetration Required</div>
              <div className="text-3xl font-bold mt-1">{marketData.mscAnalysis.penetrationRequired.toFixed(1)}%</div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">{marketData.mscAnalysis.verdict}</p>
        </CardContent>
      </Card>
    </div>
  )
}

function TimingTabContent({ timingData, hypothesis }: { timingData: NonNullable<ReturnType<typeof useResearchData>['timingData']>; hypothesis: string }) {
  return (
    <div className="space-y-6">
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
              <p className="text-sm text-muted-foreground mt-1">Tailwinds, headwinds, and timing window assessment</p>
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
          {timingData.trendData?.dataAvailable && (
            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800 mb-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">Google Trends Data</span>
                </div>
                <TrustBadge level="verified" size="sm" tooltip="Real data from Google Trends API" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold ${
                  timingData.trendData.percentageChange > 0 ? 'text-emerald-600' :
                  timingData.trendData.percentageChange < 0 ? 'text-red-600' : 'text-blue-600'
                }`}>
                  {timingData.trendData.percentageChange > 0 ? '+' : ''}{timingData.trendData.percentageChange}%
                </span>
                <span className="text-sm text-muted-foreground">over past year</span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Keywords analyzed: {timingData.trendData.keywords.join(', ')}
              </div>
            </div>
          )}

          {!timingData.trendData?.dataAvailable && (
            <div className="flex items-center gap-2 mb-4 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <TrustBadge level="ai-estimate" size="sm" />
              <span className="text-xs text-amber-700 dark:text-amber-400">
                Trend data based on AI analysis. Real-time Google Trends data unavailable.
              </span>
            </div>
          )}

          <div className="p-4 bg-muted/50 rounded-xl border mb-6">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Timing Window</div>
            <div className="text-2xl font-bold mt-1">{timingData.timingWindow}</div>
            <p className="text-sm text-muted-foreground mt-2">{timingData.verdict}</p>
          </div>

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
  )
}
