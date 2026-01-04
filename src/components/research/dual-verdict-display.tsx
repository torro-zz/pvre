'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Target,
  TrendingUp,
  MessageSquare,
  Users,
  Clock,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
} from 'lucide-react'
import {
  HypothesisConfidence,
  MarketOpportunity,
  HypothesisConfidenceLevel,
  MarketOpportunityLevel,
  VerdictLevel,
  VERDICT_THRESHOLDS,
} from '@/lib/analysis/viability-calculator'
import { cn } from '@/lib/utils'
import { getVerdictLevel } from '@/lib/utils/verdict-messages'

interface DualVerdictDisplayProps {
  hypothesisConfidence: HypothesisConfidence
  marketOpportunity: MarketOpportunity
  overallScore?: number // Overall verdict score (0-10)
  className?: string
}

// Score gauge component for each axis
function ScoreGauge({ score, max = 10, label, level, colorClass }: {
  score: number
  max?: number
  label: string
  level: string
  colorClass: string
}) {
  const percentage = (score / max) * 100

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-20">
        {/* Background circle */}
        <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
          <circle
            cx={40}
            cy={40}
            r={35}
            fill="none"
            strokeWidth={6}
            className="stroke-muted/20"
          />
          <circle
            cx={40}
            cy={40}
            r={35}
            fill="none"
            strokeWidth={6}
            strokeLinecap="round"
            className={colorClass}
            strokeDasharray={2 * Math.PI * 35}
            strokeDashoffset={2 * Math.PI * 35 * (1 - percentage / 100)}
          />
        </svg>
        {/* Score number */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold">{score.toFixed(1)}</span>
        </div>
      </div>
      <Badge variant="secondary" className={cn(
        'text-xs font-medium',
        level === 'high' || level === 'strong' ? 'bg-green-100 text-green-700' :
        level === 'partial' || level === 'moderate' ? 'bg-yellow-100 text-yellow-700' :
        'bg-red-100 text-red-700'
      )}>
        {label}
      </Badge>
    </div>
  )
}

// Factor breakdown mini-bar
function FactorBar({ label, value, icon: Icon }: {
  label: string
  value: number
  icon: React.ElementType
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground w-24 truncate">{label}</span>
      <div className="flex-1 max-w-16">
        <Progress value={value * 10} className="h-1.5" />
      </div>
      <span className="text-xs font-mono text-muted-foreground w-6 text-right">{value.toFixed(1)}</span>
    </div>
  )
}

// Get interpretation text for hypothesis confidence
function getHypothesisInterpretation(level: HypothesisConfidenceLevel): string {
  switch (level) {
    case 'high':
      return 'Strong evidence for your specific hypothesis in the data'
    case 'partial':
      return 'Some signals found, but adjacent problems may be more prominent'
    case 'low':
      return 'Your specific angle wasn\'t prominent - consider the adjacent opportunities'
  }
}

// Get interpretation text for market opportunity
function getMarketInterpretation(level: MarketOpportunityLevel): string {
  switch (level) {
    case 'strong':
      return 'Active market with good timing and validated demand'
    case 'moderate':
      return 'Market exists but may need better positioning or timing'
    case 'weak':
      return 'Limited market signals - may need more research'
  }
}

export function DualVerdictDisplay({
  hypothesisConfidence,
  marketOpportunity,
  overallScore,
  className,
}: DualVerdictDisplayProps) {
  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          Two-Axis Viability Assessment
        </CardTitle>
        <CardDescription>
          Separating market opportunity from hypothesis fit
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Two score cards - responsive grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Hypothesis Confidence */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <h4 className="font-medium text-sm text-center">Hypothesis Confidence</h4>
            <p className="text-xs text-muted-foreground text-center">
              Did we find YOUR specific hypothesis?
            </p>
            <div className="flex justify-center">
              <ScoreGauge
                score={hypothesisConfidence.score}
                label={hypothesisConfidence.level.toUpperCase()}
                level={hypothesisConfidence.level}
                colorClass={
                  hypothesisConfidence.level === 'high' ? 'stroke-green-500' :
                  hypothesisConfidence.level === 'partial' ? 'stroke-yellow-500' :
                  'stroke-red-500'
                }
              />
            </div>
            <p className="text-xs text-center text-muted-foreground">
              {getHypothesisInterpretation(hypothesisConfidence.level)}
            </p>

            {/* Factor breakdown */}
            <div className="pt-2 border-t space-y-1.5">
              <FactorBar
                label="Direct signals"
                value={hypothesisConfidence.factors.directSignalScore}
                icon={Target}
              />
              <FactorBar
                label="Volume"
                value={hypothesisConfidence.factors.volumeScore}
                icon={MessageSquare}
              />
              <FactorBar
                label="Multi-source"
                value={hypothesisConfidence.factors.multiSourceScore}
                icon={Users}
              />
            </div>
          </div>

          {/* Market Opportunity */}
          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <h4 className="font-medium text-sm text-center">Market Opportunity</h4>
            <p className="text-xs text-muted-foreground text-center">
              Is there a viable market here?
            </p>
            <div className="flex justify-center">
              <ScoreGauge
                score={marketOpportunity.score}
                label={marketOpportunity.level.toUpperCase()}
                level={marketOpportunity.level}
                colorClass={
                  marketOpportunity.level === 'strong' ? 'stroke-green-500' :
                  marketOpportunity.level === 'moderate' ? 'stroke-yellow-500' :
                  'stroke-red-500'
                }
              />
            </div>
            <p className="text-xs text-center text-muted-foreground">
              {getMarketInterpretation(marketOpportunity.level)}
            </p>

            {/* Factor breakdown */}
            <div className="pt-2 border-t space-y-1.5">
              <FactorBar
                label="Market size"
                value={marketOpportunity.factors.marketSizeContribution / 0.3}
                icon={BarChart3}
              />
              <FactorBar
                label="Timing"
                value={marketOpportunity.factors.timingContribution / 0.25}
                icon={Clock}
              />
              <FactorBar
                label="Activity"
                value={marketOpportunity.factors.activityContribution / 0.25}
                icon={TrendingUp}
              />
            </div>
          </div>
        </div>

        {/* What This Means section */}
        <div className="border rounded-lg p-4 bg-background space-y-3">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-muted-foreground" />
            What This Means
          </h4>
          <WhatThisMeans
            hypothesisLevel={hypothesisConfidence.level}
            marketLevel={marketOpportunity.level}
            directSignalPercent={hypothesisConfidence.directSignalPercent}
            overallScore={overallScore}
          />
        </div>
      </CardContent>
    </Card>
  )
}

// Generate contextual "What This Means" section
// Now considers the OVERALL verdict score to avoid contradictory messages
function WhatThisMeans({
  hypothesisLevel,
  marketLevel,
  directSignalPercent,
  overallScore,
}: {
  hypothesisLevel: HypothesisConfidenceLevel
  marketLevel: MarketOpportunityLevel
  directSignalPercent: number
  overallScore?: number
}) {
  const findings: { type: 'positive' | 'caution' | 'info'; text: string }[] = []

  // Determine overall verdict level from score
  const verdictLevel = overallScore !== undefined ? getVerdictLevel(overallScore) : null
  const isOverallPositive = verdictLevel === 'strong' || verdictLevel === 'mixed'
  const isOverallNegative = verdictLevel === 'weak' || verdictLevel === 'none'

  // Positive findings - but only show if overall verdict supports it
  // This prevents "Active market" checkmarks when overall score is 3.1
  if (marketLevel === 'strong') {
    if (isOverallPositive) {
      findings.push({ type: 'positive', text: 'Active market with validated demand' })
    } else if (isOverallNegative) {
      findings.push({ type: 'caution', text: 'Market activity detected, but other factors limit viability' })
    }
  }

  if (hypothesisLevel === 'high') {
    if (isOverallPositive) {
      findings.push({ type: 'positive', text: 'Strong evidence supporting your specific hypothesis' })
    } else if (isOverallNegative) {
      // High hypothesis match but low overall = market/timing issues
      findings.push({ type: 'caution', text: 'Hypothesis matches signals, but market/timing scores are low' })
    }
  }

  if (directSignalPercent >= 50) {
    // Cap at 100% to prevent impossible percentages (e.g., 105%)
    const pct = Math.round(Math.min(100, directSignalPercent))
    if (isOverallPositive) {
      findings.push({ type: 'positive', text: `${pct}% of signals directly match your hypothesis` })
    } else {
      // Still show the stat, but as info not positive
      findings.push({ type: 'info', text: `${pct}% of signals match, but overall viability is low` })
    }
  }

  // Caution findings
  if (hypothesisLevel === 'low' && marketLevel !== 'weak') {
    findings.push({ type: 'caution', text: 'Market exists, but for different problems - see Adjacent Opportunities' })
  }
  if (hypothesisLevel === 'partial') {
    findings.push({ type: 'caution', text: 'Your hypothesis shows some signals, but related problems are also prominent' })
  }
  if (marketLevel === 'weak') {
    findings.push({ type: 'caution', text: 'Limited market activity - consider searching different sources' })
  }

  // Info/Guidance - now aligned with overall verdict
  if (verdictLevel === 'strong') {
    findings.push({ type: 'info', text: 'Proceed to user interviews to validate willingness-to-pay' })
  } else if (verdictLevel === 'mixed') {
    findings.push({ type: 'info', text: 'Validate key concerns before committing resources' })
  } else if (verdictLevel === 'weak') {
    findings.push({ type: 'info', text: 'Significant pivots may be needed - review adjacent opportunities' })
  } else if (verdictLevel === 'none') {
    findings.push({ type: 'info', text: 'Consider pivoting to a different problem or target audience' })
  } else {
    // Fallback when no overall score (legacy behavior)
    if (hypothesisLevel === 'high') {
      findings.push({ type: 'info', text: 'Proceed to user interviews to validate willingness-to-pay' })
    } else if (hypothesisLevel === 'partial') {
      findings.push({ type: 'info', text: 'Interview with exploration - let adjacent problems emerge naturally' })
    } else {
      findings.push({ type: 'info', text: 'Consider pivoting to an adjacent problem with stronger signals' })
    }
  }

  return (
    <div className="space-y-2">
      {findings.map((finding, i) => (
        <div key={i} className="flex items-start gap-2 text-sm">
          {finding.type === 'positive' ? (
            <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
          ) : finding.type === 'caution' ? (
            <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
          ) : (
            <TrendingUp className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          )}
          <span className="text-muted-foreground">{finding.text}</span>
        </div>
      ))}
    </div>
  )
}
