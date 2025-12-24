'use client'

/**
 * ScrollView - New single-scroll results layout (Phase 2).
 *
 * This component renders research results in a single vertical scroll:
 * - Verdict Hero (sticky at top)
 * - Evidence Section (pain signals, quotes)
 * - Opportunity Section (WTP, gaps)
 * - Context Section (trends, competitors)
 *
 * TODO: Build out full implementation
 */

import { useResearchData } from '@/components/research/research-data-provider'
import { VerdictHero } from '@/components/research/verdict-hero'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, Lightbulb, BarChart3 } from 'lucide-react'

export function ScrollView() {
  const data = useResearchData()
  const { job, viabilityVerdict, communityVoiceResult, competitorResult, marketData, timingData } = data

  return (
    <div className="space-y-8">
      {/* Verdict Hero - Always visible at top */}
      {viabilityVerdict.availableDimensions > 0 && (
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-4 -mx-4 px-4 pt-4 border-b">
          <VerdictHero
            verdict={viabilityVerdict}
            hypothesis={job.hypothesis}
          />
        </div>
      )}

      {/* Section 1: Evidence */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </div>
          <h2 className="text-xl font-bold">Evidence</h2>
          <Badge variant="secondary" className="ml-2">
            {communityVoiceResult?.data?.painSummary?.totalSignals || 0} signals
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Pain Summary Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Pain Signals</CardTitle>
            </CardHeader>
            <CardContent>
              {communityVoiceResult?.data?.painSummary ? (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Total Signals</span>
                    <span className="font-medium">{communityVoiceResult.data.painSummary.totalSignals}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">High Intensity</span>
                    <span className="font-medium text-red-600">{communityVoiceResult.data.painSummary.highIntensityCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">WTP Signals</span>
                    <span className="font-medium text-green-600">{communityVoiceResult.data.painSummary.willingnessToPayCount}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No pain data available</p>
              )}
            </CardContent>
          </Card>

          {/* Top Quotes Preview */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top Quotes</CardTitle>
            </CardHeader>
            <CardContent>
              {communityVoiceResult?.data?.themeAnalysis?.keyQuotes?.slice(0, 2).map((quote, i) => (
                <div key={i} className="text-sm border-l-2 border-primary/30 pl-3 py-1 mb-2">
                  <p className="italic line-clamp-2">&ldquo;{quote.quote}&rdquo;</p>
                  <p className="text-xs text-muted-foreground mt-1">{quote.source}</p>
                </div>
              )) || (
                <p className="text-sm text-muted-foreground">No quotes available</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Section 2: Opportunity */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <Lightbulb className="h-4 w-4 text-green-600" />
          </div>
          <h2 className="text-xl font-bold">Opportunity</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* WTP Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Willingness to Pay</CardTitle>
            </CardHeader>
            <CardContent>
              {communityVoiceResult?.data?.painSummary?.wtpQuotes?.length ? (
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-green-600">
                    {communityVoiceResult.data.painSummary.wtpQuotes.length} WTP signals
                  </div>
                  <p className="text-sm text-muted-foreground">
                    People are actively looking for paid solutions
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No explicit WTP signals found</p>
              )}
            </CardContent>
          </Card>

          {/* Market Size Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Market Size</CardTitle>
            </CardHeader>
            <CardContent>
              {marketData ? (
                <div className="space-y-2">
                  <div className="text-2xl font-bold">
                    {marketData.som.value.toLocaleString()}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Obtainable market (SOM)
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Market sizing not available</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Section 3: Context */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <BarChart3 className="h-4 w-4 text-purple-600" />
          </div>
          <h2 className="text-xl font-bold">Context</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Timing Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Market Timing</CardTitle>
            </CardHeader>
            <CardContent>
              {timingData ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl font-bold ${
                      timingData.trend === 'rising' ? 'text-green-600' :
                      timingData.trend === 'stable' ? 'text-blue-600' :
                      'text-red-600'
                    }`}>
                      {timingData.score.toFixed(1)}/10
                    </span>
                    <Badge className={
                      timingData.trend === 'rising' ? 'bg-green-500' :
                      timingData.trend === 'stable' ? 'bg-blue-500' :
                      'bg-red-500'
                    }>
                      {timingData.trend}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {timingData.timingWindow}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Timing analysis not available</p>
              )}
            </CardContent>
          </Card>

          {/* Competition Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Competition</CardTitle>
            </CardHeader>
            <CardContent>
              {competitorResult?.data ? (
                <div className="space-y-2">
                  <div className="text-2xl font-bold">
                    {competitorResult.data.metadata.competitorsAnalyzed} competitors
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {competitorResult.data.marketOverview?.maturityLevel || 'Market analysis available'}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Competition analysis not run</p>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
