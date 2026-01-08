'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AlertTriangle, ChevronDown, ArrowRight, CheckCircle2, XCircle, HelpCircle } from 'lucide-react'
import {
  ViabilityVerdict,
  VerdictColors,
  VerdictLevel,
} from '@/lib/analysis/viability-calculator'
import { getVerdictMessage } from '@/lib/utils/verdict-messages'

interface VerdictHeroProps {
  verdict: ViabilityVerdict
  onSeeWhy: () => void
  onInterviewGuide: () => void
  isAppAnalysis?: boolean
}

function getVerdictLabel(level: VerdictLevel): string {
  switch (level) {
    case 'strong': return 'Strong Signal'
    case 'mixed': return 'Mixed Signal'
    case 'weak': return 'Weak Signal'
    case 'none': return 'No Signal'
  }
}

function getVerdictIcon(level: VerdictLevel, hasCriticalConcerns: boolean) {
  if (hasCriticalConcerns) {
    return <AlertTriangle className="h-5 w-5" />
  }
  switch (level) {
    case 'strong': return <CheckCircle2 className="h-5 w-5" />
    case 'mixed': return <HelpCircle className="h-5 w-5" />
    case 'weak': return <AlertTriangle className="h-5 w-5" />
    case 'none': return <XCircle className="h-5 w-5" />
  }
}

export function VerdictHero({
  verdict,
  onSeeWhy,
  onInterviewGuide,
  isAppAnalysis = false,
}: VerdictHeroProps) {
  const colors = VerdictColors[verdict.verdict]
  const hasCriticalConcerns = verdict.dealbreakers.length > 0 ||
    (verdict.redFlags?.some(f => f.severity === 'HIGH') ?? false)

  const verdictMessage = getVerdictMessage(verdict.overallScore, hasCriticalConcerns)
  const actionMessage = verdictMessage.action
  const actionColors = { text: verdictMessage.colors.text, bg: verdictMessage.colors.bg }
  const gradient = verdictMessage.colors.gradient

  return (
    <div className={cn(
      'relative rounded-2xl border overflow-hidden',
      'bg-gradient-to-br',
      gradient,
      'border-border/50'
    )}>
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-48 h-48 rounded-full bg-gradient-to-br from-white/10 to-transparent blur-2xl" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 rounded-full bg-gradient-to-tr from-white/5 to-transparent blur-xl" />
      </div>

      <div className="relative p-8 sm:p-10">
        {/* Score and Label - Centered */}
        <div className="text-center mb-6">
          <div className="text-5xl sm:text-6xl font-bold tracking-tight mb-2">
            {verdict.overallScore.toFixed(1)}
            <span className="text-2xl sm:text-3xl text-muted-foreground font-normal">/10</span>
          </div>
          <Badge className={cn('px-4 py-1.5 text-sm', colors.bg, 'text-white')}>
            {getVerdictLabel(verdict.verdict)}
          </Badge>
        </div>

        {/* Action Message */}
        <div className={cn(
          'flex items-center justify-center gap-2 py-3 px-4 rounded-lg mx-auto max-w-md mb-6',
          actionColors.bg
        )}>
          <span className={actionColors.text}>
            {getVerdictIcon(verdict.verdict, hasCriticalConcerns)}
          </span>
          <span className={cn('font-medium', actionColors.text)}>
            {actionMessage}
          </span>
        </div>

        {/* Recommendation Text */}
        <div className="text-center mb-8 max-w-xl mx-auto">
          <p className="text-muted-foreground leading-relaxed">
            {verdict.verdictDescription}
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            variant="outline"
            onClick={onSeeWhy}
            className="w-full sm:w-auto min-w-[160px]"
          >
            See Why
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
          <Button
            onClick={onInterviewGuide}
            className="w-full sm:w-auto min-w-[160px] bg-emerald-600 hover:bg-emerald-700"
          >
            Interview Guide
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>

        {/* Confidence Indicators - Subtle row */}
        <div className="flex items-center justify-center gap-6 mt-8 pt-6 border-t border-border/30">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className={cn(
              'w-2.5 h-2.5 rounded-full',
              verdict.confidence === 'high' && 'bg-emerald-500',
              verdict.confidence === 'medium' && 'bg-amber-500',
              verdict.confidence === 'low' && 'bg-red-500',
            )} />
            <span className="capitalize">{verdict.confidence} confidence</span>
          </div>
          <div className="h-4 w-px bg-border/50" />
          <div className="text-sm text-muted-foreground">
            {verdict.availableDimensions}/{verdict.totalDimensions} dimensions
          </div>
          {verdict.sampleSize && (
            <>
              <div className="h-4 w-px bg-border/50" />
              <div className="text-sm text-muted-foreground">
                {verdict.sampleSize.postsAnalyzed} posts analyzed
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
