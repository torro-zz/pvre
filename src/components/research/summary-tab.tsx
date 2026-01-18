'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  TrendingUp,
  DollarSign,
  Target,
  Lightbulb,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react'
import { CommunityVoiceResult } from '@/app/api/research/community-voice/route'
import { CompetitorIntelligenceResult } from '@/app/api/research/competitor-intelligence/route'
import { ViabilityVerdict } from '@/lib/analysis/viability-calculator'
import { AnimatedCard } from '@/components/ui/animated-components'
import { cn } from '@/lib/utils'
import { useResearchTabs } from '@/components/research/research-tabs-context'

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
  isAppAnalysis?: boolean
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
}: SummaryTabProps) {
  const { setActiveTab, setMarketSubTab } = useResearchTabs()
  const insights = extractTopInsights(
    communityVoiceResult,
    competitorResult,
    marketData,
    timingData,
    filteringMetrics?.postsAnalyzed
  )
  const insightItems = insights.map((insight) => ({
    text: insight.text,
    isWarning: insight.color === 'red' || insight.color === 'amber',
  }))
  const redFlagItems = (verdict.redFlags ?? []).map((flag) => ({
    text: flag.message,
    isWarning: true,
  }))
  const summaryItems = [...insightItems, ...redFlagItems].slice(0, 5)
  const totalSignals =
    communityVoiceResult?.painSummary?.totalSignals ??
    (filteringMetrics?.coreSignals ?? 0) + (filteringMetrics?.relatedSignals ?? 0)
  const postsAnalyzed = filteringMetrics?.postsAnalyzed ?? filteringMetrics?.postsFound ?? 0
  const sourcesCount = communityVoiceResult?.metadata?.dataSources?.length ?? 0

  return (
    <div className="space-y-4">
      <AnimatedCard>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="text-base font-semibold">
              <span className="text-muted-foreground">VERDICT:</span>{' '}
              {verdict.overallScore.toFixed(1)}/10 — {verdict.calibratedVerdictLabel || verdict.verdictLabel}
            </div>
            {summaryItems.length > 0 && (
              <ul className="space-y-2">
                {summaryItems.map((item, index) => (
                  <li key={`${item.text}-${index}`} className="flex items-start gap-2 text-sm">
                    <span
                      className={cn(
                        'mt-0.5',
                        item.isWarning ? 'text-amber-600' : 'text-emerald-600'
                      )}
                    >
                      {item.isWarning ? '⚠' : '✓'}
                    </span>
                    <span
                      className={cn(
                        item.isWarning
                          ? 'text-amber-900 dark:text-amber-200'
                          : 'text-emerald-900 dark:text-emerald-200'
                      )}
                    >
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">
              Based on {totalSignals.toLocaleString()} {pluralize(totalSignals, 'signal', 'signals')} from{' '}
              {postsAnalyzed.toLocaleString()} {pluralize(postsAnalyzed, 'post', 'posts')} across{' '}
              {sourcesCount.toLocaleString()} {pluralize(sourcesCount, 'community', 'communities')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('evidence')}
              >
                Evidence
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('market')}
              >
                Market
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setMarketSubTab('opportunities')
                  setActiveTab('market')
                }}
              >
                Gaps
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('action')}
              >
                Next Steps
              </Button>
            </div>
          </CardContent>
        </Card>
      </AnimatedCard>
    </div>
  )
}
