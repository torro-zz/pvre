'use client'

/**
 * MarketTab - Restructured Market tab with sub-navigation
 *
 * Sub-tabs:
 * - Overview: Dashboard grid with summary cards
 * - Sizing: TAM/SAM/SOM + Revenue Goal Analysis
 * - Timing: Google Trends + Tailwinds + Headwinds
 * - Competition: Competition Score + Pricing + Competitor List
 * - Opportunities: Market gaps (from competitor analysis)
 * - Positioning: Positioning recommendations
 */

import { useState } from 'react'
import { useResearchData } from '@/components/research/research-data-provider'
import { CompetitorResults } from '@/components/research/competitor-results'
import { CompetitorRunner } from '@/components/research/competitor-runner'
import { TrustBadge } from '@/components/ui/trust-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  TrendingUp,
  PieChart,
  Timer,
  Shield,
  Lightbulb,
  Target,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Users,
  BarChart3,
  AlertTriangle,
  Info,
} from 'lucide-react'
import type { CompetitorGap, PositioningRecommendation } from '@/types/research'
import type { CompetitorIntelligenceResult } from '@/app/api/research/competitor-intelligence/route'

type MarketSubTab = 'overview' | 'sizing' | 'timing' | 'competition' | 'opportunities' | 'positioning'

interface MarketTabProps {
  jobId: string
  hypothesis: string
}

export function MarketTab({ jobId, hypothesis }: MarketTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<MarketSubTab>('overview')
  const data = useResearchData()
  const { marketData, timingData, competitorResult, communityVoiceResult } = data

  // Extract discussion velocity from pain summary for timing display
  const discussionVelocity = communityVoiceResult?.data?.painSummary?.discussionVelocity

  const subTabs: { id: MarketSubTab; label: string; icon: React.ReactNode; available: boolean }[] = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 className="h-4 w-4" />, available: true },
    { id: 'sizing', label: 'Sizing', icon: <PieChart className="h-4 w-4" />, available: !!marketData },
    { id: 'timing', label: 'Timing', icon: <Timer className="h-4 w-4" />, available: !!timingData },
    { id: 'competition', label: 'Competition', icon: <Shield className="h-4 w-4" />, available: true },
    { id: 'opportunities', label: 'Opportunities', icon: <Lightbulb className="h-4 w-4" />, available: !!competitorResult?.data?.gaps },
    { id: 'positioning', label: 'Positioning', icon: <Target className="h-4 w-4" />, available: !!competitorResult?.data?.positioningRecommendations },
  ]

  return (
    <div className="space-y-6">
      {/* Sub-tab Navigation */}
      <div className="flex flex-wrap gap-2 p-1 bg-muted/50 rounded-lg border">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            disabled={!tab.available && tab.id !== 'overview' && tab.id !== 'competition'}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all',
              activeSubTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50',
              !tab.available && tab.id !== 'overview' && tab.id !== 'competition' && 'opacity-50 cursor-not-allowed'
            )}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Sub-tab Content */}
      {activeSubTab === 'overview' && (
        <MarketOverviewDashboard
          marketData={marketData}
          timingData={timingData}
          competitorData={competitorResult?.data}
          onNavigate={setActiveSubTab}
        />
      )}

      {activeSubTab === 'sizing' && (
        <SizingSubTab marketData={marketData} />
      )}

      {activeSubTab === 'timing' && (
        <TimingSubTab timingData={timingData} discussionVelocity={discussionVelocity} />
      )}

      {activeSubTab === 'competition' && (
        <CompetitionSubTab
          competitorData={competitorResult?.data}
          jobId={jobId}
          hypothesis={hypothesis}
          onNavigate={setActiveSubTab}
        />
      )}

      {activeSubTab === 'opportunities' && (
        <OpportunitiesSubTab gaps={competitorResult?.data?.gaps} onNavigate={setActiveSubTab} />
      )}

      {activeSubTab === 'positioning' && (
        <PositioningSubTab
          positioning={competitorResult?.data?.positioningRecommendations}
          gapsCount={competitorResult?.data?.gaps?.length}
          onNavigate={setActiveSubTab}
        />
      )}
    </div>
  )
}

// =============================================================================
// Market Overview Dashboard
// =============================================================================

interface MarketOverviewDashboardProps {
  marketData: ReturnType<typeof useResearchData>['marketData']
  timingData: ReturnType<typeof useResearchData>['timingData']
  competitorData: CompetitorIntelligenceResult | undefined
  onNavigate: (tab: MarketSubTab) => void
}

function MarketOverviewDashboard({ marketData, timingData, competitorData, onNavigate }: MarketOverviewDashboardProps) {
  // Helper for "Why This Matters" context on each card
  const getSizingContext = (score: number) => {
    if (score >= 8) return 'Large opportunity - room to scale'
    if (score >= 6) return 'Solid market - focus on differentiation'
    if (score >= 4) return 'Niche market - target high-value customers'
    return 'Very niche - validate demand carefully'
  }

  const getTimingContext = (score: number, trend: string) => {
    if (trend === 'rising' && score >= 7) return 'Perfect timing - market momentum is building'
    if (trend === 'rising') return 'Growing interest - good time to enter'
    if (trend === 'stable' && score >= 5) return 'Steady market - focus on execution'
    if (trend === 'stable') return 'Flat demand - differentiation is key'
    return 'Declining interest - proceed with caution'
  }

  const getCompetitionContext = (score: number) => {
    if (score >= 8) return 'Crowded space - need strong differentiation'
    if (score >= 6) return 'Competitive - find your unique angle'
    if (score >= 4) return 'Moderate competition - room to carve a niche'
    return 'Open market - first-mover opportunity'
  }

  const getOpportunitiesContext = (count: number) => {
    if (count >= 5) return 'Multiple entry points to exploit'
    if (count >= 3) return 'Several gaps to target'
    if (count >= 1) return 'Focused opportunity available'
    return 'Analysis needed to find gaps'
  }

  // Helper to get score label with consistent interpretation
  const getScoreLabel = (score: number, type: 'sizing' | 'timing' | 'competition') => {
    if (type === 'competition') {
      // For competition: higher score = more competition = harder
      if (score >= 8) return { label: 'Crowded', color: 'text-red-600 dark:text-red-400' }
      if (score >= 6) return { label: 'Competitive', color: 'text-amber-600 dark:text-amber-400' }
      if (score >= 4) return { label: 'Moderate', color: 'text-blue-600 dark:text-blue-400' }
      return { label: 'Open', color: 'text-emerald-600 dark:text-emerald-400' }
    }
    if (type === 'timing') {
      if (score >= 8) return { label: 'Excellent', color: 'text-emerald-600 dark:text-emerald-400' }
      if (score >= 6) return { label: 'Good', color: 'text-blue-600 dark:text-blue-400' }
      if (score >= 4) return { label: 'Fair', color: 'text-amber-600 dark:text-amber-400' }
      return { label: 'Poor', color: 'text-red-600 dark:text-red-400' }
    }
    // Sizing
    if (score >= 8) return { label: 'Large', color: 'text-emerald-600 dark:text-emerald-400' }
    if (score >= 6) return { label: 'Medium', color: 'text-blue-600 dark:text-blue-400' }
    if (score >= 4) return { label: 'Limited', color: 'text-amber-600 dark:text-amber-400' }
    return { label: 'Niche', color: 'text-muted-foreground' }
  }

  const gapsCount = competitorData?.gaps?.length || 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-lg font-semibold">Market Overview</h2>
        <Badge variant="outline" className="text-xs">Quick Summary</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sizing Card */}
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onNavigate('sizing')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
                <PieChart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              {marketData && (
                <Badge variant="secondary" className={getScoreLabel(marketData.score, 'sizing').color}>
                  {getScoreLabel(marketData.score, 'sizing').label}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold">Market Sizing</h3>
              {marketData && (
                <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-700 text-[10px]">
                  ESTIMATE
                </Badge>
              )}
            </div>
            {marketData ? (
              <>
                <div className="text-2xl font-bold mb-2">
                  {marketData.score.toFixed(1)}<span className="text-lg text-muted-foreground">/10</span>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div>SAM: {(marketData.sam.value * 0.7 / 1000).toFixed(0)}-{(marketData.sam.value * 1.3 / 1000).toFixed(0)}K</div>
                  <div>SOM: {(marketData.som.value * 0.7 / 1000).toFixed(0)}-{(marketData.som.value * 1.3 / 1000).toFixed(0)}K</div>
                </div>
                <p className="text-xs italic text-blue-600 dark:text-blue-400 mt-2 pt-2 border-t border-dashed border-muted">
                  {getSizingContext(marketData.score)}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Not analyzed yet</p>
            )}
            <div className="mt-3 flex items-center text-xs text-primary">
              View Details <ChevronRight className="h-3 w-3 ml-1" />
            </div>
          </CardContent>
        </Card>

        {/* Timing Card */}
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onNavigate('timing')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg">
                <Timer className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              {timingData && (
                <Badge variant="secondary" className={cn(
                  timingData.trend === 'rising' ? 'text-emerald-600' :
                  timingData.trend === 'stable' ? 'text-blue-600' : 'text-red-600'
                )}>
                  {timingData.trend === 'rising' ? '↑ Rising' :
                   timingData.trend === 'stable' ? '→ Stable' : '↓ Falling'}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold">Market Timing</h3>
              {timingData?.trendData?.dataAvailable && (
                <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-700 text-[10px]">
                  VERIFIED
                </Badge>
              )}
            </div>
            {timingData ? (
              <>
                <div className="text-2xl font-bold mb-2">
                  {timingData.score.toFixed(1)}<span className="text-lg text-muted-foreground">/10</span>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {timingData.trendData?.dataAvailable && (
                    <div className={timingData.trendData.percentageChange > 0 ? 'text-emerald-600' : 'text-red-600'}>
                      {timingData.trendData.percentageChange > 0 ? '+' : ''}{timingData.trendData.percentageChange}% Trends
                    </div>
                  )}
                  <div>{timingData.timingWindow}</div>
                </div>
                <p className="text-xs italic text-emerald-600 dark:text-emerald-400 mt-2 pt-2 border-t border-dashed border-muted">
                  {getTimingContext(timingData.score, timingData.trend)}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Not analyzed yet</p>
            )}
            <div className="mt-3 flex items-center text-xs text-primary">
              View Details <ChevronRight className="h-3 w-3 ml-1" />
            </div>
          </CardContent>
        </Card>

        {/* Competition Card */}
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onNavigate('competition')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-500/20 rounded-lg">
                <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              {competitorData?.competitionScore && (
                <Badge variant="secondary" className={getScoreLabel(competitorData.competitionScore.score, 'competition').color}>
                  {getScoreLabel(competitorData.competitionScore.score, 'competition').label}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold">Competition</h3>
              {competitorData && (
                <Badge variant="outline" className="bg-slate-50 dark:bg-slate-950/50 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600 text-[10px]">
                  CALCULATED
                </Badge>
              )}
            </div>
            {competitorData ? (
              <>
                <div className="text-2xl font-bold mb-2">
                  {competitorData.competitionScore?.score.toFixed(1) || '—'}<span className="text-lg text-muted-foreground">/10</span>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div>{competitorData.metadata?.competitorsAnalyzed || 0} players</div>
                  <div>{competitorData.marketOverview?.competitionIntensity} competition</div>
                </div>
                <p className="text-xs italic text-amber-600 dark:text-amber-400 mt-2 pt-2 border-t border-dashed border-muted">
                  {getCompetitionContext(competitorData.competitionScore?.score || 0)}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Run competitor analysis</p>
            )}
            <div className="mt-3 flex items-center text-xs text-primary">
              View Details <ChevronRight className="h-3 w-3 ml-1" />
            </div>
          </CardContent>
        </Card>

        {/* Opportunities Card */}
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onNavigate('opportunities')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-500/20 rounded-lg">
                <Lightbulb className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              {gapsCount > 0 && (
                <Badge variant="secondary" className="text-purple-600">
                  {gapsCount} found
                </Badge>
              )}
            </div>
            <h3 className="font-semibold mb-1">Opportunities</h3>
            {gapsCount > 0 ? (
              <>
                <div className="text-2xl font-bold mb-2">
                  {gapsCount}<span className="text-lg text-muted-foreground"> gaps</span>
                </div>
                <div className="text-sm text-muted-foreground line-clamp-2">
                  {competitorData?.gaps?.[0]?.opportunity || 'Market gaps identified'}
                </div>
                <p className="text-xs italic text-purple-600 dark:text-purple-400 mt-2 pt-2 border-t border-dashed border-muted">
                  {getOpportunitiesContext(gapsCount)}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Run competitor analysis</p>
            )}
            <div className="mt-3 flex items-center text-xs text-primary">
              View Details <ChevronRight className="h-3 w-3 ml-1" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Market Forces Summary (Tailwinds/Headwinds) */}
      {timingData && (timingData.tailwinds?.length || timingData.headwinds?.length) && (
        <Card className="mt-4">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">Market Forces</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tailwinds Summary */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <ChevronUp className="h-4 w-4" />
                  <span className="font-medium">Tailwinds ({timingData.tailwinds?.length || 0})</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {timingData.tailwinds?.slice(0, 4).map((tw, i) => (
                    <Badge key={i} variant="outline" className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 text-xs">
                      {tw.signal}
                    </Badge>
                  ))}
                  {(timingData.tailwinds?.length || 0) > 4 && (
                    <Badge variant="outline" className="text-xs">+{(timingData.tailwinds?.length || 0) - 4} more</Badge>
                  )}
                </div>
              </div>

              {/* Headwinds Summary */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                  <ChevronDown className="h-4 w-4" />
                  <span className="font-medium">Headwinds ({timingData.headwinds?.length || 0})</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {timingData.headwinds?.slice(0, 4).map((hw, i) => (
                    <Badge key={i} variant="outline" className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 text-xs">
                      {hw.signal}
                    </Badge>
                  ))}
                  {(timingData.headwinds?.length || 0) > 4 && (
                    <Badge variant="outline" className="text-xs">+{(timingData.headwinds?.length || 0) - 4} more</Badge>
                  )}
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => onNavigate('timing')}>
              View detailed analysis <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// =============================================================================
// Sizing Sub-Tab
// =============================================================================

interface SizingSubTabProps {
  marketData: ReturnType<typeof useResearchData>['marketData']
}

function SizingSubTab({ marketData }: SizingSubTabProps) {
  const [showMethodology, setShowMethodology] = useState(false)

  if (!marketData) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <PieChart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Market Sizing Not Available</h3>
            <p className="text-muted-foreground">Market sizing is generated automatically during research.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Score */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-blue-500/10 via-emerald-500/10 to-purple-500/10 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold">Market Sizing Analysis</h3>
                <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700 text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  FERMI ESTIMATE
                </Badge>
              </div>
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
          {/* Methodology Disclosure */}
          <div className="mb-6 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
            <button
              onClick={() => setShowMethodology(!showMethodology)}
              className="flex items-center justify-between w-full text-left"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  These are Fermi estimates with wide error margins
                </span>
              </div>
              <ChevronDown className={cn("h-4 w-4 transition-transform", showMethodology && "rotate-180")} />
            </button>
            {showMethodology && (
              <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-300">
                <p className="mb-2"><strong>How was this calculated?</strong></p>
                <p>Market sizes are estimated using Fermi analysis based on:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Industry reports and market research</li>
                  <li>Startup ecosystem data</li>
                  <li>Bottom-up calculation from addressable segments</li>
                </ul>
                <p className="mt-2 italic">Actual market size may vary significantly. Use these as directional indicators, not precise figures.</p>
              </div>
            )}
          </div>

          {/* TAM/SAM/SOM Funnel Visualization */}
          <div className="flex flex-col items-center space-y-3">
            {/* TAM - Widest */}
            <div className="w-full p-4 bg-blue-50 dark:bg-blue-500/10 rounded-xl border-2 border-blue-300 dark:border-blue-500/40">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-blue-900 dark:text-blue-100">TAM (Total Addressable Market)</span>
                <div className="text-right">
                  <span className="text-blue-700 dark:text-blue-300 font-bold text-lg">
                    {(marketData.tam.value * 0.7 / 1000000).toFixed(0)}-{(marketData.tam.value * 1.3 / 1000000).toFixed(0)}M users
                  </span>
                  <span className="text-xs text-blue-500 dark:text-blue-400 ml-1">(±30%)</span>
                </div>
              </div>
              <p className="text-sm text-blue-700 dark:text-blue-300">{marketData.tam.description}</p>
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-2 font-medium">
                ~${((marketData.tam.value * 50) / 1000000).toFixed(0)}M-${((marketData.tam.value * 100) / 1000000).toFixed(0)}M ARR potential*
              </p>
            </div>

            {/* Connector Arrow */}
            <div className="text-muted-foreground">
              <ChevronDown className="h-5 w-5" />
            </div>

            {/* SAM - Medium Width */}
            <div className="w-[85%] p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border-2 border-emerald-300 dark:border-emerald-500/40">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-emerald-900 dark:text-emerald-100">SAM (Serviceable Available Market)</span>
                <div className="text-right">
                  <span className="text-emerald-700 dark:text-emerald-300 font-bold text-lg">
                    {(marketData.sam.value * 0.7 / 1000).toFixed(0)}-{(marketData.sam.value * 1.3 / 1000).toFixed(0)}K users
                  </span>
                  <span className="text-xs text-emerald-500 dark:text-emerald-400 ml-1">(±30%)</span>
                </div>
              </div>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">{marketData.sam.description}</p>
              <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-2 font-medium">
                ~${((marketData.sam.value * 50) / 1000000).toFixed(1)}M-${((marketData.sam.value * 100) / 1000000).toFixed(1)}M ARR potential*
              </p>
            </div>

            {/* Connector Arrow */}
            <div className="text-muted-foreground">
              <ChevronDown className="h-5 w-5" />
            </div>

            {/* SOM - Narrowest */}
            <div className="w-[65%] p-4 bg-purple-50 dark:bg-purple-500/10 rounded-xl border-2 border-purple-300 dark:border-purple-500/40">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-purple-900 dark:text-purple-100">SOM (Serviceable Obtainable)</span>
                <div className="text-right">
                  <span className="text-purple-700 dark:text-purple-300 font-bold text-lg">
                    {(marketData.som.value * 0.7 / 1000).toFixed(0)}-{(marketData.som.value * 1.3 / 1000).toFixed(0)}K users
                  </span>
                  <span className="text-xs text-purple-500 dark:text-purple-400 ml-1">(±30%)</span>
                </div>
              </div>
              <p className="text-sm text-purple-700 dark:text-purple-300">{marketData.som.description}</p>
              <p className="text-sm text-purple-600 dark:text-purple-400 mt-2 font-medium">
                ~${((marketData.som.value * 50) / 1000).toFixed(0)}K-${((marketData.som.value * 100) / 1000).toFixed(0)}K ARR potential*
              </p>
            </div>

            {/* Footnote */}
            <p className="text-xs text-muted-foreground italic text-center pt-2">
              *Assuming $50-100 average annual revenue per user
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Goal Analysis */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">Revenue Goal Analysis</h3>

          {/* Context explanation */}
          <div className="mb-4 p-3 bg-muted/50 rounded-lg text-sm">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <span className="font-medium">To reach your revenue goal:</span>
                <p className="text-muted-foreground mt-1">
                  Based on SOM of {marketData.som.value.toLocaleString()} reachable users,
                  you need {marketData.mscAnalysis.customersNeeded.toLocaleString()} paying customers
                  ({marketData.mscAnalysis.penetrationRequired.toFixed(1)}% penetration).
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-4 bg-muted/50 rounded-xl border">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Customers Needed</div>
              <div className="text-3xl font-bold mt-1">{marketData.mscAnalysis.customersNeeded.toLocaleString()}</div>
            </div>
            <div className="p-4 bg-muted/50 rounded-xl border">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Market Penetration</div>
              <div className="text-3xl font-bold mt-1">{marketData.mscAnalysis.penetrationRequired.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground mt-1">of {(marketData.som.value / 1000).toFixed(0)}K SOM</div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">{marketData.mscAnalysis.verdict}</p>
        </CardContent>
      </Card>
    </div>
  )
}

// =============================================================================
// Timing Sub-Tab
// =============================================================================

interface TimingSubTabProps {
  timingData: ReturnType<typeof useResearchData>['timingData']
  discussionVelocity?: {
    percentageChange: number
    trend: 'rising' | 'stable' | 'declining'
    recentCount: number
    previousCount: number
    confidence: 'low' | 'medium' | 'high'
  }
}

function TimingSubTab({ timingData, discussionVelocity }: TimingSubTabProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  if (!timingData) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <Timer className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Market Timing Not Available</h3>
            <p className="text-muted-foreground">Timing analysis is generated automatically during research.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Score */}
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
              <p className="text-sm text-muted-foreground mt-1">Tailwinds, headwinds, and timing window</p>
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
          {/* Timing Data Sources */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Google Trends Data */}
            {timingData.trendData?.dataAvailable && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">Google Trends</span>
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
                  <span className="text-sm text-muted-foreground">YoY</span>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Keywords: {timingData.trendData.keywords.join(', ')}
                </div>
              </div>
            )}

            {/* Discussion Velocity - CALCULATED from posts */}
            {discussionVelocity && (discussionVelocity.recentCount > 0 || discussionVelocity.previousCount > 0) && (
              <div className={`p-4 rounded-xl border ${
                discussionVelocity.trend === 'rising'
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                  : discussionVelocity.trend === 'declining'
                  ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
                  : 'bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <BarChart3 className={`h-4 w-4 ${
                      discussionVelocity.trend === 'rising' ? 'text-emerald-600' :
                      discussionVelocity.trend === 'declining' ? 'text-red-600' : 'text-slate-600'
                    }`} />
                    <span className={`text-sm font-semibold ${
                      discussionVelocity.trend === 'rising' ? 'text-emerald-900 dark:text-emerald-100' :
                      discussionVelocity.trend === 'declining' ? 'text-red-900 dark:text-red-100' : 'text-slate-900 dark:text-slate-100'
                    }`}>Discussion Velocity</span>
                  </div>
                  <TrustBadge level="calculated" size="sm" tooltip="Calculated from post timestamps" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-bold ${
                    discussionVelocity.percentageChange > 0 ? 'text-emerald-600' :
                    discussionVelocity.percentageChange < 0 ? 'text-red-600' : 'text-slate-600'
                  }`}>
                    {discussionVelocity.percentageChange > 0 ? '+' : ''}{discussionVelocity.percentageChange}%
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {discussionVelocity.trend === 'rising' ? '↑' : discussionVelocity.trend === 'declining' ? '↓' : '→'}
                  </span>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {discussionVelocity.recentCount} posts (90d) vs {discussionVelocity.previousCount} prior
                  {discussionVelocity.confidence !== 'high' && (
                    <span className="ml-1 text-amber-600">• {discussionVelocity.confidence} sample</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {!timingData.trendData?.dataAvailable && (
            <div className="flex items-center gap-2 mb-4 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <TrustBadge level="ai-estimate" size="sm" />
              <span className="text-xs text-amber-700 dark:text-amber-400">
                Trend data based on AI analysis. Real-time Google Trends data unavailable.
              </span>
            </div>
          )}

          {/* Timing Window */}
          <div className="p-4 bg-muted/50 rounded-xl border mb-6">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Timing Window</div>
              <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700 text-xs">
                <BarChart3 className="h-3 w-3 mr-1" />
                AI ANALYSIS
              </Badge>
            </div>
            <div className="text-2xl font-bold mt-1">{timingData.timingWindow}</div>
            <p className="text-sm text-muted-foreground mt-2">{timingData.verdict}</p>
          </div>
        </CardContent>
      </Card>

      {/* Market Forces - Side-by-Side Comparison */}
      {(timingData.tailwinds?.length || timingData.headwinds?.length) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Market Forces</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Side-by-side comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tailwinds Column */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-emerald-200 dark:border-emerald-800">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                    <ChevronUp className="h-4 w-4 text-emerald-600" />
                  </div>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    Tailwinds ({timingData.tailwinds?.length || 0})
                  </span>
                </div>
                {timingData.tailwinds?.slice(0, 5).map((tw, i) => (
                  <div key={i} className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg border border-emerald-200 dark:border-emerald-500/20">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm text-emerald-900 dark:text-emerald-100">{tw.signal}</span>
                      <Badge variant="outline" className="text-xs bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 border-emerald-300">
                        {tw.impact}
                      </Badge>
                    </div>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">{tw.description}</p>
                  </div>
                ))}
                {(timingData.tailwinds?.length || 0) > 5 && (
                  <p className="text-xs text-muted-foreground text-center">+{(timingData.tailwinds?.length || 0) - 5} more</p>
                )}
                {!timingData.tailwinds?.length && (
                  <p className="text-sm text-muted-foreground italic">No tailwinds identified</p>
                )}
              </div>

              {/* Headwinds Column */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-red-200 dark:border-red-800">
                  <div className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
                    <ChevronDown className="h-4 w-4 text-red-600" />
                  </div>
                  <span className="font-semibold text-red-700 dark:text-red-400">
                    Headwinds ({timingData.headwinds?.length || 0})
                  </span>
                </div>
                {timingData.headwinds?.slice(0, 5).map((hw, i) => (
                  <div key={i} className="p-3 bg-red-50 dark:bg-red-500/10 rounded-lg border border-red-200 dark:border-red-500/20">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm text-red-900 dark:text-red-100">{hw.signal}</span>
                      <Badge variant="outline" className="text-xs bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400 border-red-300">
                        {hw.impact}
                      </Badge>
                    </div>
                    <p className="text-xs text-red-700 dark:text-red-300">{hw.description}</p>
                  </div>
                ))}
                {(timingData.headwinds?.length || 0) > 5 && (
                  <p className="text-xs text-muted-foreground text-center">+{(timingData.headwinds?.length || 0) - 5} more</p>
                )}
                {!timingData.headwinds?.length && (
                  <p className="text-sm text-muted-foreground italic">No headwinds identified</p>
                )}
              </div>
            </div>

            {/* Net Signal Summary */}
            <div className={`p-4 rounded-lg border-2 ${
              (timingData.tailwinds?.length || 0) > (timingData.headwinds?.length || 0)
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700'
                : (timingData.headwinds?.length || 0) > (timingData.tailwinds?.length || 0)
                ? 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-700'
                : 'bg-muted/50 border-border'
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold">Net Signal</span>
                <div className="flex items-center gap-2">
                  {(timingData.tailwinds?.length || 0) > (timingData.headwinds?.length || 0) ? (
                    <>
                      <TrendingUp className="h-5 w-5 text-emerald-600" />
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">Favorable</span>
                    </>
                  ) : (timingData.headwinds?.length || 0) > (timingData.tailwinds?.length || 0) ? (
                    <>
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      <span className="font-bold text-red-700 dark:text-red-400">Challenging</span>
                    </>
                  ) : (
                    <span className="font-bold text-muted-foreground">Balanced</span>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {timingData.tailwinds?.length || 0} tailwinds vs {timingData.headwinds?.length || 0} headwinds
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// =============================================================================
// Competition Sub-Tab
// =============================================================================

interface CompetitionSubTabProps {
  competitorData: CompetitorIntelligenceResult | undefined
  jobId: string
  hypothesis: string
  onNavigate?: (tab: MarketSubTab) => void
}

function CompetitionSubTab({ competitorData, jobId, hypothesis, onNavigate }: CompetitionSubTabProps) {
  if (!competitorData) {
    return <CompetitorRunner jobId={jobId} hypothesis={hypothesis} />
  }

  const gapsCount = competitorData.gaps?.length || 0
  const positioningCount = competitorData.positioningRecommendations?.length || 0

  return (
    <div className="space-y-6">
      <CompetitorResults results={competitorData} />

      {/* Cross-links to related sections */}
      {onNavigate && (gapsCount > 0 || positioningCount > 0) && (
        <Card className="border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-950/20">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg">
                <Lightbulb className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-indigo-800 dark:text-indigo-300 mb-2">
                  Based on this analysis, see our suggested:
                </h3>
                <div className="flex flex-wrap gap-2">
                  {gapsCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onNavigate('opportunities')}
                      className="bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/50"
                    >
                      <Lightbulb className="h-4 w-4 mr-2" />
                      Opportunities ({gapsCount})
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                  {positioningCount > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onNavigate('positioning')}
                      className="bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border-indigo-300 dark:border-indigo-700 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                    >
                      <Target className="h-4 w-4 mr-2" />
                      Positioning ({positioningCount})
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// =============================================================================
// Opportunities Sub-Tab
// =============================================================================

interface OpportunitiesSubTabProps {
  gaps?: CompetitorGap[]
  onNavigate?: (tab: MarketSubTab) => void
}

function OpportunitiesSubTab({ gaps, onNavigate }: OpportunitiesSubTabProps) {
  // Helper to get effort label based on difficulty
  const getEffortLabel = (difficulty: string) => {
    switch (difficulty) {
      case 'low': return 'Quick Win (1-2 weeks)'
      case 'medium': return 'Medium Effort (1-3 months)'
      case 'high': return 'Major Initiative (3+ months)'
      default: return 'Effort TBD'
    }
  }

  if (!gaps || gaps.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Opportunities Found</h3>
            <p className="text-muted-foreground">Run competitor analysis to identify market opportunities.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Lightbulb className="h-5 w-5 text-purple-600" />
        <h2 className="text-lg font-semibold">Market Opportunities</h2>
        <Badge variant="secondary">{gaps.length} identified</Badge>
      </div>

      {gaps.map((gap, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${
                gap.difficulty === 'low' ? 'bg-emerald-100 dark:bg-emerald-500/20' :
                gap.difficulty === 'medium' ? 'bg-amber-100 dark:bg-amber-500/20' :
                'bg-red-100 dark:bg-red-500/20'
              }`}>
                <Lightbulb className={`h-4 w-4 ${
                  gap.difficulty === 'low' ? 'text-emerald-600 dark:text-emerald-400' :
                  gap.difficulty === 'medium' ? 'text-amber-600 dark:text-amber-400' :
                  'text-red-600 dark:text-red-400'
                }`} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">{gap.opportunity}</h3>
                <p className="text-sm text-muted-foreground mb-3">{gap.description}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Color-coded Difficulty Badge */}
                  <Badge variant="outline" className={
                    gap.difficulty === 'low'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-700'
                      : gap.difficulty === 'medium'
                      ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-700'
                      : 'bg-red-50 text-red-700 border-red-300 dark:bg-red-950/50 dark:text-red-400 dark:border-red-700'
                  }>
                    {gap.difficulty === 'low' && '🟢'}
                    {gap.difficulty === 'medium' && '🟡'}
                    {gap.difficulty === 'high' && '🔴'}
                    {' '}{gap.difficulty} difficulty
                  </Badge>
                  {/* Effort Indicator */}
                  <Badge variant="secondary" className="text-xs">
                    {getEffortLabel(gap.difficulty)}
                  </Badge>
                </div>
                {/* Cross-link to Positioning */}
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('positioning')}
                    className="mt-3 text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    See positioning strategy <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// =============================================================================
// Positioning Sub-Tab
// =============================================================================

interface PositioningSubTabProps {
  positioning?: PositioningRecommendation[]
  gapsCount?: number
  onNavigate?: (tab: MarketSubTab) => void
}

function PositioningSubTab({ positioning, gapsCount = 0, onNavigate }: PositioningSubTabProps) {
  if (!positioning || positioning.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Positioning Data</h3>
            <p className="text-muted-foreground">Run competitor analysis to get positioning recommendations.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Target className="h-5 w-5 text-indigo-600" />
        <h2 className="text-lg font-semibold">Positioning Recommendations</h2>
        <Badge variant="secondary">{positioning.length} strategies</Badge>
      </div>

      {positioning.map((pos, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-500/20 rounded-full flex items-center justify-center font-bold text-indigo-600 dark:text-indigo-400">
                {i + 1}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">{pos.strategy}</h3>
                <p className="text-sm text-muted-foreground mb-2">{pos.description}</p>
                <div className="text-xs text-muted-foreground mb-2">
                  <span className="font-medium">Target: </span>{pos.targetNiche}
                </div>
                {pos.keyDifferentiators && pos.keyDifferentiators.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {pos.keyDifferentiators.map((diff, j) => (
                      <Badge key={j} variant="outline" className="bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 text-xs">
                        {diff}
                      </Badge>
                    ))}
                  </div>
                )}
                {/* Cross-link to Opportunities */}
                {onNavigate && gapsCount > 0 && (
                  <button
                    onClick={() => onNavigate('opportunities')}
                    className="mt-3 text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                  >
                    Addresses {gapsCount} market {gapsCount === 1 ? 'opportunity' : 'opportunities'} <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
