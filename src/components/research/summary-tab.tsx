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
} from 'lucide-react'
import { CommunityVoiceResult } from '@/app/api/research/community-voice/route'
import { CompetitorIntelligenceResult } from '@/app/api/research/competitor-intelligence/route'
import { ViabilityVerdict, RedFlag } from '@/lib/analysis/viability-calculator'
import { AnimatedCard, StaggerContainer, staggerItem } from '@/components/ui/animated-components'

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
    som: { value: number }
  }
  timingData?: {
    score: number
    trend: string
    growthRate?: number
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

function extractTopInsights(
  communityVoice?: CommunityVoiceResult,
  competitor?: CompetitorIntelligenceResult,
  market?: SummaryTabProps['marketData'],
  timing?: SummaryTabProps['timingData']
): Insight[] {
  const insights: Insight[] = []

  // Pain intensity
  if (communityVoice?.painSummary) {
    const ps = communityVoice.painSummary
    if (ps.highIntensityCount && ps.highIntensityCount >= 3) {
      insights.push({
        type: 'pain',
        text: `${ps.highIntensityCount} people described severe pain (8-10/10)`,
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

    // WTP signals
    if (ps.willingnessToPayCount && ps.willingnessToPayCount > 0) {
      insights.push({
        type: 'wtp',
        text: `${ps.willingnessToPayCount} people showed willingness to pay`,
        icon: DollarSign,
        color: 'green'
      })
    }
  }

  // Market growth
  if (timing?.growthRate && timing.growthRate > 10) {
    insights.push({
      type: 'timing',
      text: `Market growing ${timing.growthRate}% YoY - strong timing`,
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
            <div className="text-xs text-muted-foreground">
              {coreSignals} core, {supportingSignals} supporting
            </div>
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
  const insights = extractTopInsights(communityVoiceResult, competitorResult, marketData, timingData)
  const hasRedFlags = verdict.redFlags && verdict.redFlags.length > 0

  return (
    <div className="space-y-6">
      {/* Key Insights */}
      {insights.length > 0 && (
        <AnimatedCard>
          <Card>
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

      {/* Red Flags */}
      {hasRedFlags && (
        <AnimatedCard delay={0.3}>
          <RedFlagsCard redFlags={verdict.redFlags!} />
        </AnimatedCard>
      )}

      {/* Data Quality */}
      <AnimatedCard delay={hasRedFlags ? 0.4 : 0.3}>
        <DataQualityCard
          filteringMetrics={filteringMetrics}
          painSummary={communityVoiceResult?.painSummary}
          dataSources={communityVoiceResult?.metadata?.dataSources}
        />
      </AnimatedCard>

      {/* Quick Actions */}
      <AnimatedCard delay={hasRedFlags ? 0.5 : 0.4}>
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
