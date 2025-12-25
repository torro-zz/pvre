'use client'

import { motion } from 'framer-motion'
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
import { RecommendationBanner } from './recommendation-banner'
import {
  AnimatedGauge,
  AnimatedCard,
  AnimatedBadge,
} from '@/components/ui/animated-components'

interface VerdictHeroProps {
  verdict: ViabilityVerdict
  hypothesis: string
  className?: string
  onViewDetails?: () => void
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

  // Constructive sublabels based on score (not scary labels)
  const getConfidenceSublabel = (score: number) => {
    if (score >= 8) return 'Strong problem-market fit'
    if (score >= 6) return 'Good foundation to build on'
    if (score >= 4) return 'Some evidence, needs validation'
    return 'Your angle needs refinement'
  }

  const getOpportunitySublabel = (score: number) => {
    if (score >= 8) return 'Clear market opportunity'
    if (score >= 6) return 'Solid market indicators'
    if (score >= 4) return 'Opportunity exists, explore further'
    return 'Market signals are limited'
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
    <AnimatedCard
      className={cn(
        'rounded-xl border bg-gradient-to-br from-card to-muted/20 overflow-hidden',
        className
      )}
      delay={0}
    >
      <div className="p-4 sm:p-6">
        {/* Header row */}
        <motion.div
          className="flex items-start justify-between gap-4 mb-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="flex items-center gap-2">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.5, delay: 0.2, type: 'spring', stiffness: 200 }}
            >
              <Target className="h-5 w-5 text-primary" />
            </motion.div>
            <h2 className="font-semibold text-base">Quick Verdict</h2>
            <TrustBadge level="calculated" size="sm" />
          </div>
          {hasRedFlags && (
            <AnimatedBadge delay={0.6}>
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {verdict.redFlags!.length} warning{verdict.redFlags!.length > 1 ? 's' : ''}
              </Badge>
            </AnimatedBadge>
          )}
        </motion.div>

        {/* Two-axis scores with staggered animation */}
        {hasTwoAxisData ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4">
            <AnimatedGauge
              score={verdict.hypothesisConfidence!.score}
              label="Hypothesis Confidence"
              sublabel={getConfidenceSublabel(verdict.hypothesisConfidence!.score)}
              colorClass={getConfidenceColor(verdict.hypothesisConfidence!.level)}
              delay={0.2}
            />
            <AnimatedGauge
              score={verdict.marketOpportunity!.score}
              label="Market Opportunity"
              sublabel={getOpportunitySublabel(verdict.marketOpportunity!.score)}
              colorClass={getOpportunityColor(verdict.marketOpportunity!.level)}
              delay={0.4}
            />
          </div>
        ) : (
          <div className="flex justify-center mb-4">
            <AnimatedGauge
              score={verdict.overallScore}
              label="Viability Score"
              sublabel={verdict.confidence.toUpperCase()}
              colorClass={
                verdict.overallScore >= 7 ? 'stroke-emerald-500' :
                verdict.overallScore >= 5 ? 'stroke-amber-500' :
                'stroke-red-500'
              }
              size="md"
              delay={0.2}
            />
          </div>
        )}

        {/* Recommendation Banner - prominent action guidance */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
        >
          <RecommendationBanner
            verdict={verdict.verdict}
            verdictDescription={getOverallMessage()}
            onViewDetails={onViewDetails}
          />
        </motion.div>
      </div>
    </AnimatedCard>
  )
}
