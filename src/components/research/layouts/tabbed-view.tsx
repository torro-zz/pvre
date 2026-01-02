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
import { InvestorMetricsHero } from '@/components/research/investor-metrics-hero'
import { SummaryTab } from '@/components/research/summary-tab'
import { ActionTab } from '@/components/research/action-tab'
import { MarketTab } from '@/components/research/market-tab'
import { EvidenceTab } from '@/components/research/evidence-tab'
import { ViabilityVerdictDisplay } from '@/components/research/viability-verdict'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ResearchTabsProvider } from '@/components/research/research-tabs-context'
import { ControlledTabs } from '@/components/research/controlled-tabs'
import Link from 'next/link'
import { TrendingUp, Target, Smartphone, MessageSquare, Sparkles, BarChart3, CheckCircle2 } from 'lucide-react'
import { SearchCoverageSection } from '@/components/research/search-coverage-section'
import { createSourceCoverageData } from '@/lib/utils/coverage-helpers'
import { AppOverview } from '@/components/research/app-overview'
import { UserFeedback } from '@/components/research/user-feedback'
import { Opportunities } from '@/components/research/opportunities'

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
      {/* Note: CompetitorPromptModal removed - competitor analysis now runs automatically */}

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
            <TabsTrigger value="market" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Market</span>
              {(marketData || timingData) && <span className="w-2 h-2 rounded-full bg-green-500" />}
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

        {/* Evidence Tab - Pain signals, quotes, themes with sub-navigation */}
        <TabsContent value="evidence">
          {communityVoiceResult?.data ? (
            <EvidenceTab
              communityVoiceResult={communityVoiceResult.data}
              filteringMetrics={filteringMetrics ?? undefined}
            />
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

        {/* Market Tab - Sub-tabbed structure with Overview, Sizing, Timing, Competitors, etc. */}
        <TabsContent value="market">
          <MarketTab jobId={job.id} hypothesis={job.hypothesis} />
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

        {/* Verdict Tab - Overall viability assessment */}
        <TabsContent value="verdict">
          {viabilityVerdict.availableDimensions > 0 ? (
            <ViabilityVerdictDisplay
              verdict={viabilityVerdict}
              hypothesis={job.hypothesis}
              jobId={job.id}
              isAppAnalysis={isAppAnalysis}
              interviewQuestions={communityVoiceResult?.data?.interviewQuestions}
            />
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Verdict Not Available</h3>
                  <p className="text-muted-foreground mb-4">
                    Complete research analysis to get your viability verdict.
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

