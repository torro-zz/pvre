'use client'

import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  TrendingUp,
  DollarSign,
  Target,
  Lightbulb,
  AlertTriangle,
  ArrowRight,
  MessageSquare,
  Users,
  Clock,
  PieChart,
  Timer,
  Shield,
} from 'lucide-react'
import { CommunityVoiceResult } from '@/app/api/research/community-voice/route'
import { CompetitorIntelligenceResult } from '@/app/api/research/competitor-intelligence/route'
import { ViabilityVerdict, RedFlag } from '@/lib/analysis/viability-calculator'
import { AnimatedCard, StaggerContainer, staggerItem } from '@/components/ui/animated-components'
import { DualVerdictDisplay } from '@/components/research/dual-verdict-display'
import { DimensionScore, StatusLabels } from '@/lib/analysis/viability-calculator'
import { cn } from '@/lib/utils'
import { BarChart3, Info } from 'lucide-react'
import { DataSourceBadge } from '@/components/ui/data-source-badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

// ============================================
// Types
// ============================================

interface Insight {
  type: 'pain' | 'wtp' | 'timing' | 'opportunity' | 'risk'
  text: string
  icon: React.ElementType
  color: 'red' | 'green' | 'amber' | 'blue' | 'purple'
}

interface SummaryTabProps {
  communityVoiceResult?: CommunityVoiceResult
  competitorResult?: CompetitorIntelligenceResult
  verdict: ViabilityVerdict
  hypothesis: string
  marketData?: {
    score: number
    som: { value: number; description?: string }
    sam?: { value: number; description?: string }
    tam?: { value: number; description?: string }
  }
  timingData?: {
    score: number
    trend: string
    growthRate?: number
    timingWindow?: string
    // Google Trends data (verified)
    trendData?: {
      keywords: string[]
      percentageChange: number
      dataAvailable: boolean
    } | null
  }
  filteringMetrics?: {
    postsFound: number
    postsAnalyzed: number
    coreSignals?: number
    relatedSignals?: number
  }
  onViewEvidence?: () => void
  onViewAction?: () => void
}

// ============================================
// Helper Functions
// ============================================

// Helper for singular/plural
function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}

function extractTopInsights(
  communityVoice?: CommunityVoiceResult,
  competitor?: CompetitorIntelligenceResult,
  market?: SummaryTabProps['marketData'],
  timing?: SummaryTabProps['timingData'],
  postsAnalyzed?: number
): Insight[] {
  const insights: Insight[] = []

  // Pain intensity - cap claims to posts analyzed to avoid impossible statements
  if (communityVoice?.painSummary) {
    const ps = communityVoice.painSummary
    // Cap highIntensityCount to postsAnalyzed to avoid "4 people" from "2 posts"
    const claimCount = postsAnalyzed
      ? Math.min(ps.highIntensityCount || 0, postsAnalyzed)
      : ps.highIntensityCount || 0

    if (claimCount >= 2) {
      insights.push({
        type: 'pain',
        text: `${claimCount} ${pluralize(claimCount, 'post', 'posts')} showed severe pain (8-10/10)`,
        icon: AlertTriangle,
        color: 'red'
      })
    } else if (ps.totalSignals && ps.totalSignals >= 10) {
      insights.push({
        type: 'pain',
        text: `${ps.totalSignals} pain signals detected across communities`,
        icon: MessageSquare,
        color: 'amber'
      })
    }

    // WTP signals - also cap and use proper grammar
    if (ps.willingnessToPayCount && ps.willingnessToPayCount > 0) {
      const wtpCount = postsAnalyzed
        ? Math.min(ps.willingnessToPayCount, postsAnalyzed)
        : ps.willingnessToPayCount
      insights.push({
        type: 'wtp',
        text: `${wtpCount} ${pluralize(wtpCount, 'person', 'people')} showed willingness to pay`,
        icon: DollarSign,
        color: 'green'
      })
    }
  }

  // Market growth - prefer Google Trends (verified) over AI estimate
  const googleTrendsYoY = timing?.trendData?.dataAvailable ? timing.trendData.percentageChange : null
  const growthRate = googleTrendsYoY ?? timing?.growthRate

  if (growthRate !== null && growthRate !== undefined && growthRate > 10) {
    insights.push({
      type: 'timing',
      text: `Market growing ${growthRate > 0 ? '+' : ''}${growthRate}% YoY${googleTrendsYoY !== null ? ' (Google Trends)' : ''} - strong timing`,
      icon: TrendingUp,
      color: 'green'
    })
  } else if (timing?.trend === 'rising') {
    insights.push({
      type: 'timing',
      text: 'Market interest is rising - good timing to enter',
      icon: TrendingUp,
      color: 'green'
    })
  }

  // Competition
  if (competitor?.gaps?.length && competitor.gaps.length > 0) {
    insights.push({
      type: 'opportunity',
      text: `${competitor.gaps.length} competitive gaps identified`,
      icon: Target,
      color: 'blue'
    })
  }

  // Underserved niches from themes
  if (communityVoice?.themeAnalysis?.themes) {
    const contextualThemes = communityVoice.themeAnalysis.themes.filter(
      t => (t as { tier?: string }).tier === 'contextual'
    )
    if (contextualThemes.length > 0) {
      insights.push({
        type: 'opportunity',
        text: `${contextualThemes.length} adjacent opportunities worth exploring`,
        icon: Lightbulb,
        color: 'purple'
      })
    }
  }

  return insights.slice(0, 5)
}

// ============================================
// Sub-Components
// ============================================

function InsightCard({ insight, index }: { insight: Insight; index: number }) {
  const colorClasses = {
    red: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800',
    green: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800',
    amber: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800',
    blue: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800',
    purple: 'bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800',
  }

  const iconColors = {
    red: 'text-red-600 dark:text-red-400',
    green: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    blue: 'text-blue-600 dark:text-blue-400',
    purple: 'text-purple-600 dark:text-purple-400',
  }

  const Icon = insight.icon

  return (
    <motion.div
      className={`flex items-start gap-3 p-3 rounded-lg border ${colorClasses[insight.color]}`}
      variants={staggerItem}
    >
      <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${iconColors[insight.color]}`} />
      <span className="text-sm font-medium">{insight.text}</span>
    </motion.div>
  )
}

function DataQualityCard({
  filteringMetrics,
  painSummary,
  dataSources,
}: {
  filteringMetrics?: SummaryTabProps['filteringMetrics']
  painSummary?: CommunityVoiceResult['painSummary']
  dataSources?: string[]
}) {
  const totalSignals = painSummary?.totalSignals ?? 0
  const coreSignals = filteringMetrics?.coreSignals ?? 0
  const supportingSignals = (filteringMetrics?.relatedSignals ?? 0)
  const postsAnalyzed = filteringMetrics?.postsAnalyzed ?? 0
  const recencyScore = painSummary?.recencyScore ?? 0
  const confidence = painSummary?.dataConfidence ?? 'low'

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Data Quality
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-2xl font-bold">{totalSignals}</div>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-xs text-muted-foreground flex items-center gap-1 cursor-help">
                  {coreSignals} core, {supportingSignals} supporting
                  <Info className="h-3 w-3 opacity-60" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[280px]">
                <p className="text-xs">
                  <strong>Core:</strong> Directly match your hypothesis.
                  <strong> Supporting:</strong> Related but indirect evidence.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div>
            <div className="text-2xl font-bold">{postsAnalyzed.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">posts analyzed</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{Math.round(recencyScore * 100)}%</div>
            <div className="text-xs text-muted-foreground">recent data</div>
          </div>
          <div>
            <Badge variant="outline" className={
              confidence === 'high' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
              confidence === 'medium' ? 'bg-blue-50 text-blue-700 border-blue-200' :
              confidence === 'low' ? 'bg-amber-50 text-amber-700 border-amber-200' :
              'bg-red-50 text-red-700 border-red-200'
            }>
              {confidence === 'high' ? 'High' :
               confidence === 'medium' ? 'Good' :
               confidence === 'low' ? 'Low' : 'Limited'} confidence
            </Badge>
          </div>
        </div>
        {dataSources && dataSources.length > 0 && (
          <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
            Sources: {dataSources.join(', ')}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RedFlagsCard({ redFlags }: { redFlags: RedFlag[] }) {
  if (!redFlags || redFlags.length === 0) return null

  return (
    <Card className="border-red-200 dark:border-red-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Red Flags ({redFlags.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {redFlags.slice(0, 3).map((flag, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-sm"
            >
              <Badge
                variant="outline"
                className={
                  flag.severity === 'HIGH'
                    ? 'bg-red-100 text-red-700 border-red-200'
                    : flag.severity === 'MEDIUM'
                    ? 'bg-amber-100 text-amber-700 border-amber-200'
                    : 'bg-muted text-muted-foreground'
                }
              >
                {flag.severity}
              </Badge>
              <span className="text-muted-foreground">{flag.message}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function getMarketLabel(score: number): { label: string; color: string } {
  if (score >= 8) return { label: 'Large Opportunity', color: 'text-emerald-600 dark:text-emerald-400' }
  if (score >= 6) return { label: 'Good Opportunity', color: 'text-amber-600 dark:text-amber-400' }
  if (score >= 4) return { label: 'Moderate', color: 'text-orange-600 dark:text-orange-400' }
  return { label: 'Limited', color: 'text-red-600 dark:text-red-400' }
}

function MarketCard({ marketData }: { marketData: SummaryTabProps['marketData'] }) {
  if (!marketData) return null

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`
    return num.toLocaleString()
  }

  const { label, color } = getMarketLabel(marketData.score)

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <PieChart className="h-4 w-4 text-blue-500" />
            Market Size
          </CardTitle>
          <DataSourceBadge type="estimate" showLabel={false} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-3xl font-bold">{marketData.score.toFixed(1)}</span>
          <span className="text-muted-foreground">/10</span>
        </div>
        <div className={`text-sm font-medium mb-3 ${color}`}>
          {label}
        </div>
        <div className="space-y-2 text-sm">
          {marketData.sam && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">SAM</span>
              <div className="flex items-center gap-1.5">
                <span className="font-medium">{formatNumber(marketData.sam.value)} users</span>
              </div>
            </div>
          )}
          {marketData.som && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">SOM</span>
              <div className="flex items-center gap-1.5">
                <span className="font-medium">{formatNumber(marketData.som.value)} users</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function TimingCard({ timingData }: { timingData: SummaryTabProps['timingData'] }) {
  if (!timingData) return null

  const getTrendColor = (trend: string) => {
    if (trend === 'rising') return 'text-emerald-600 dark:text-emerald-400'
    if (trend === 'stable') return 'text-blue-600 dark:text-blue-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getTrendIcon = (trend: string) => {
    if (trend === 'rising') return '↑'
    if (trend === 'stable') return '→'
    return '↓'
  }

  // Check for Google Trends data (verified source)
  const hasGoogleTrends = timingData.trendData?.dataAvailable
  const googleTrendsYoY = hasGoogleTrends ? timingData.trendData?.percentageChange : null
  // Use Google Trends if available, otherwise fall back to AI estimate
  const displayGrowthRate = googleTrendsYoY ?? timingData.growthRate

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Timer className="h-4 w-4 text-purple-500" />
          Timing
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-3xl font-bold">{timingData.score.toFixed(1)}</span>
          <span className="text-muted-foreground">/10</span>
        </div>
        <div className="space-y-2 text-sm">
          {/* Google Trends YoY - prominently displayed when available */}
          {displayGrowthRate !== undefined && displayGrowthRate !== null && (
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">YoY Growth</span>
                {hasGoogleTrends ? (
                  <DataSourceBadge type="verified" showLabel={false} />
                ) : (
                  <DataSourceBadge type="estimate" showLabel={false} />
                )}
              </div>
              <span className={`font-semibold ${displayGrowthRate > 0 ? 'text-emerald-600 dark:text-emerald-400' : displayGrowthRate < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                {displayGrowthRate > 0 ? '+' : ''}{displayGrowthRate}%
              </span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Trend</span>
            <span className={`font-medium ${getTrendColor(timingData.trend)}`}>
              {getTrendIcon(timingData.trend)} {timingData.trend.charAt(0).toUpperCase() + timingData.trend.slice(1)}
            </span>
          </div>
          {timingData.timingWindow && (
            <div className="pt-1">
              <Badge variant="secondary" className="text-xs">
                {timingData.timingWindow}
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function getCompetitionLabel(count: number): { label: string; color: string } {
  if (count <= 3) return { label: 'Blue Ocean', color: 'text-emerald-600 dark:text-emerald-400' }
  if (count <= 6) return { label: 'Moderate Entry', color: 'text-amber-600 dark:text-amber-400' }
  if (count <= 10) return { label: 'Competitive', color: 'text-orange-600 dark:text-orange-400' }
  return { label: 'Crowded', color: 'text-red-600 dark:text-red-400' }
}

function CompetitionCard({ competitorResult }: { competitorResult?: CompetitorIntelligenceResult }) {
  if (!competitorResult) return null

  const highThreatCount = competitorResult.competitors?.filter(c => c.threatLevel === 'high').length || 0
  const totalCount = competitorResult.competitors?.length || 0
  const gapsCount = competitorResult.gaps?.length || 0
  const { label, color } = getCompetitionLabel(totalCount)

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-orange-500" />
            Competition
          </CardTitle>
          <DataSourceBadge type="calculated" showLabel={false} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-3xl font-bold">{totalCount}</span>
          <span className="text-muted-foreground">found</span>
        </div>
        <div className={`text-sm font-medium mb-3 ${color}`}>
          {label}
        </div>
        <div className="space-y-2 text-sm">
          {highThreatCount > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">High Threat</span>
              <span className="font-medium text-red-600 dark:text-red-400">{highThreatCount}</span>
            </div>
          )}
          {gapsCount > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Gaps</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                {gapsCount} found
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function ScoreBreakdownCard({ dimensions, overallScore }: { dimensions: DimensionScore[]; overallScore: number }) {
  if (!dimensions || dimensions.length === 0) return null

  const getDimensionIcon = (name: string) => {
    switch (name) {
      case 'Pain Score': return Target
      case 'Market Score': return PieChart
      case 'Competition Score': return Shield
      case 'Timing Score': return Timer
      default: return Target
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            Score Breakdown
          </CardTitle>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold">{overallScore.toFixed(1)}</span>
            <span className="text-sm text-muted-foreground">/10</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {dimensions.map((dim) => {
            const Icon = getDimensionIcon(dim.name)
            const barWidth = (dim.score / 10) * 100
            return (
              <div key={dim.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{dim.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {Math.round(dim.weight * 100)}%
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{dim.score.toFixed(1)}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px]',
                        dim.status === 'strong' && 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400',
                        dim.status === 'adequate' && 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400',
                        dim.status === 'needs_work' && 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400',
                        dim.status === 'critical' && 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400',
                      )}
                    >
                      {StatusLabels[dim.status]}
                    </Badge>
                  </div>
                </div>
                {/* Score bar */}
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      dim.status === 'strong' && 'bg-emerald-500',
                      dim.status === 'adequate' && 'bg-amber-500',
                      dim.status === 'needs_work' && 'bg-orange-500',
                      dim.status === 'critical' && 'bg-red-500',
                    )}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                {dim.summary && (
                  <p className="text-xs text-muted-foreground line-clamp-1">{dim.summary}</p>
                )}
              </div>
            )
          })}
        </div>
        {/* Formula note */}
        <div className="mt-4 pt-3 border-t">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <p>
              Score = Pain ({Math.round((dimensions.find(d => d.name === 'Pain Score')?.weight ?? 0.35) * 100)}%) +
              Market ({Math.round((dimensions.find(d => d.name === 'Market Score')?.weight ?? 0.25) * 100)}%) +
              Competition ({Math.round((dimensions.find(d => d.name === 'Competition Score')?.weight ?? 0.25) * 100)}%) +
              Timing ({Math.round((dimensions.find(d => d.name === 'Timing Score')?.weight ?? 0.15) * 100)}%)
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// Main Component
// ============================================

export function SummaryTab({
  communityVoiceResult,
  competitorResult,
  verdict,
  hypothesis,
  marketData,
  timingData,
  filteringMetrics,
  onViewEvidence,
  onViewAction,
}: SummaryTabProps) {
  const insights = extractTopInsights(
    communityVoiceResult,
    competitorResult,
    marketData,
    timingData,
    filteringMetrics?.postsAnalyzed
  )
  const hasRedFlags = verdict.redFlags && verdict.redFlags.length > 0
  const hasMarketData = marketData || timingData || competitorResult
  const hasTwoAxisData = verdict.hypothesisConfidence && verdict.marketOpportunity

  return (
    <div className="space-y-6">
      {/* Two-Axis Viability Assessment - when available */}
      {hasTwoAxisData && (
        <AnimatedCard>
          <DualVerdictDisplay
            hypothesisConfidence={verdict.hypothesisConfidence!}
            marketOpportunity={verdict.marketOpportunity!}
            overallScore={verdict.overallScore}
          />
        </AnimatedCard>
      )}

      {/* Score Breakdown - when dimensions available */}
      {verdict.dimensions && verdict.dimensions.length > 0 && (
        <AnimatedCard delay={0.1}>
          <ScoreBreakdownCard
            dimensions={verdict.dimensions}
            overallScore={verdict.overallScore}
          />
        </AnimatedCard>
      )}

      {/* Top Row: Key Insights (full width or 2/3) + Quick Stats Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Key Insights - spans 2 columns on large screens */}
        {insights.length > 0 && (
          <AnimatedCard className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                    Key Insights
                  </CardTitle>
                  {onViewEvidence && (
                    <Button variant="ghost" size="sm" onClick={onViewEvidence}>
                      View Evidence
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <StaggerContainer className="space-y-2" staggerDelay={0.1} initialDelay={0.2}>
                  {insights.map((insight, i) => (
                    <InsightCard key={i} insight={insight} index={i} />
                  ))}
                </StaggerContainer>
              </CardContent>
            </Card>
          </AnimatedCard>
        )}

        {/* Data Quality Card - 1 column */}
        <AnimatedCard delay={0.15} className={insights.length === 0 ? 'lg:col-span-3' : ''}>
          <DataQualityCard
            filteringMetrics={filteringMetrics}
            painSummary={communityVoiceResult?.painSummary}
            dataSources={communityVoiceResult?.metadata?.dataSources}
          />
        </AnimatedCard>
      </div>

      {/* Middle Row: Market/Timing/Competition Grid */}
      {hasMarketData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {marketData && (
            <AnimatedCard delay={0.2}>
              <MarketCard marketData={marketData} />
            </AnimatedCard>
          )}
          {timingData && (
            <AnimatedCard delay={0.25}>
              <TimingCard timingData={timingData} />
            </AnimatedCard>
          )}
          {competitorResult && (
            <AnimatedCard delay={0.3}>
              <CompetitionCard competitorResult={competitorResult} />
            </AnimatedCard>
          )}
        </div>
      )}

      {/* Red Flags - full width if present */}
      {hasRedFlags && (
        <AnimatedCard delay={0.35}>
          <RedFlagsCard redFlags={verdict.redFlags!} />
        </AnimatedCard>
      )}

      {/* Quick Actions - full width */}
      <AnimatedCard delay={hasRedFlags ? 0.45 : 0.4}>
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3">
              {onViewEvidence && (
                <Button variant="outline" className="flex-1" onClick={onViewEvidence}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Review Evidence
                </Button>
              )}
              {onViewAction && (
                <Button className="flex-1" onClick={onViewAction}>
                  <Target className="h-4 w-4 mr-2" />
                  View Next Steps
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </AnimatedCard>
    </div>
  )
}
