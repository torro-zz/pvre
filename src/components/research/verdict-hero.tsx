'use client'

import { cn } from '@/lib/utils'
import { TrustBadge } from '@/components/ui/trust-badge'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  Target,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ChevronRight,
} from 'lucide-react'
import {
  HypothesisConfidence,
  MarketOpportunity,
  ViabilityVerdict,
} from '@/lib/analysis/viability-calculator'

interface VerdictHeroProps {
  verdict: ViabilityVerdict
  hypothesis: string
  className?: string
  onViewDetails?: () => void
}

// Compact gauge for hero display
function CompactGauge({
  score,
  label,
  sublabel,
  colorClass,
  size = 'md',
}: {
  score: number
  label: string
  sublabel: string
  colorClass: string
  size?: 'sm' | 'md'
}) {
  const percentage = (score / 10) * 100
  const gaugeSize = size === 'sm' ? 56 : 72
  const strokeWidth = size === 'sm' ? 5 : 6
  const radius = (gaugeSize - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className="flex items-center gap-3">
      <div className="relative" style={{ width: gaugeSize, height: gaugeSize }}>
        <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${gaugeSize} ${gaugeSize}`}>
          <circle
            cx={gaugeSize / 2}
            cy={gaugeSize / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            className="stroke-muted/20"
          />
          <circle
            cx={gaugeSize / 2}
            cy={gaugeSize / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className={colorClass}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('font-bold', size === 'sm' ? 'text-lg' : 'text-xl')}>
            {score.toFixed(1)}
          </span>
        </div>
      </div>
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{sublabel}</div>
      </div>
    </div>
  )
}

export function VerdictHero({
  verdict,
  hypothesis,
  className,
  onViewDetails,
}: VerdictHeroProps) {
  const hasTwoAxisData = verdict.hypothesisConfidence && verdict.marketOpportunity

  if (!hasTwoAxisData && verdict.availableDimensions === 0) {
    return null // Don't show hero if no data
  }

  const getConfidenceColor = (level: string) => {
    switch (level) {
      case 'high': return 'stroke-emerald-500'
      case 'partial': return 'stroke-amber-500'
      case 'low': return 'stroke-red-500'
      default: return 'stroke-muted'
    }
  }

  const getOpportunityColor = (level: string) => {
    switch (level) {
      case 'strong': return 'stroke-emerald-500'
      case 'moderate': return 'stroke-amber-500'
      case 'weak': return 'stroke-red-500'
      default: return 'stroke-muted'
    }
  }

  const getOverallMessage = () => {
    if (!hasTwoAxisData) {
      return verdict.verdictDescription
    }

    const hLevel = verdict.hypothesisConfidence!.level
    const mLevel = verdict.marketOpportunity!.level

    if (hLevel === 'high' && (mLevel === 'strong' || mLevel === 'moderate')) {
      return 'Strong hypothesis with viable market - proceed to customer interviews'
    }
    if (hLevel === 'high' && mLevel === 'weak') {
      return 'Hypothesis validated but market may be limited - explore adjacent segments'
    }
    if (hLevel === 'partial' && mLevel === 'strong') {
      return 'Market opportunity exists but for related problems - review adjacent opportunities'
    }
    if (hLevel === 'low' && mLevel === 'strong') {
      return 'Market exists for different problems - consider pivoting to adjacent opportunities'
    }
    return 'More research needed to validate this hypothesis'
  }

  const hasRedFlags = verdict.redFlags && verdict.redFlags.length > 0

  return (
    <div className={cn(
      'rounded-xl border bg-gradient-to-br from-card to-muted/20 overflow-hidden',
      className
    )}>
      <div className="p-4 sm:p-6">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-base">Quick Verdict</h2>
            <TrustBadge level="calculated" size="sm" />
          </div>
          {hasRedFlags && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {verdict.redFlags!.length} warning{verdict.redFlags!.length > 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {/* Two-axis scores */}
        {hasTwoAxisData ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4">
            <CompactGauge
              score={verdict.hypothesisConfidence!.score}
              label="Hypothesis Confidence"
              sublabel={`${verdict.hypothesisConfidence!.level.toUpperCase()} - Is YOUR problem real?`}
              colorClass={getConfidenceColor(verdict.hypothesisConfidence!.level)}
            />
            <CompactGauge
              score={verdict.marketOpportunity!.score}
              label="Market Opportunity"
              sublabel={`${verdict.marketOpportunity!.level.toUpperCase()} - Is there a market?`}
              colorClass={getOpportunityColor(verdict.marketOpportunity!.level)}
            />
          </div>
        ) : (
          <div className="flex justify-center mb-4">
            <CompactGauge
              score={verdict.overallScore}
              label="Viability Score"
              sublabel={verdict.confidence.toUpperCase()}
              colorClass={
                verdict.overallScore >= 7 ? 'stroke-emerald-500' :
                verdict.overallScore >= 5 ? 'stroke-amber-500' :
                'stroke-red-500'
              }
              size="md"
            />
          </div>
        )}

        {/* Bottom line message */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30">
          {verdict.overallScore >= 6 ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
          ) : verdict.overallScore >= 4 ? (
            <HelpCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
          )}
          <p className="text-sm text-muted-foreground flex-1">
            {getOverallMessage()}
          </p>
        </div>

        {/* View details link */}
        {onViewDetails && (
          <button
            onClick={onViewDetails}
            className="mt-3 text-xs text-primary hover:underline flex items-center gap-1"
          >
            View full verdict breakdown
            <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  )
}
