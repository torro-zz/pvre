'use client'

import { useState, useRef } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScoreGauge } from '@/components/ui/score-gauge'
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Lightbulb,
  Shield,
  BarChart3,
  Info,
  ArrowRight,
  Target,
  PieChart,
  ChevronDown,
  ChevronUp,
  Zap,
} from 'lucide-react'
import Link from 'next/link'
import { useResearchTabs } from './research-tabs-context'
import {
  ViabilityVerdict,
  VerdictColors,
  StatusColors,
  StatusLabels,
  VerdictLevel,
  SampleSizeLabel,
} from '@/lib/analysis/viability-calculator'
import { cn } from '@/lib/utils'
import { DualVerdictDisplay } from './dual-verdict-display'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { VerdictHero } from './verdict-hero'

interface ViabilityVerdictProps {
  verdict: ViabilityVerdict
  hypothesis: string
  jobId?: string
  isAppAnalysis?: boolean
  interviewQuestions?: {
    contextQuestions: string[]
    problemQuestions: string[]
    solutionQuestions: string[]
  }
  onRunCommunityVoice?: () => void
  onRunCompetitors?: () => void
}

// Mini ring component for dimension scores
function MiniScoreRing({
  score,
  max = 10,
  size = 48,
  strokeWidth = 4,
  className
}: {
  score: number
  max?: number
  size?: number
  strokeWidth?: number
  className?: string
}) {
  const percentage = (score / max) * 100
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  const getColor = (pct: number) => {
    if (pct >= 75) return '#10b981' // green
    if (pct >= 50) return '#f59e0b' // yellow
    if (pct >= 25) return '#f97316' // orange
    return '#ef4444' // red
  }

  const color = getColor(percentage)

  return (
    <div className={cn('relative', className)} style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-muted/20"
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold" style={{ color }}>
          {score.toFixed(1)}
        </span>
      </div>
    </div>
  )
}

// Wave bar visualization for confidence levels
function WaveBar({
  value,
  max = 100,
  label,
  color = 'primary'
}: {
  value: number
  max?: number
  label?: string
  color?: 'primary' | 'success' | 'warning' | 'danger'
}) {
  const percentage = (value / max) * 100
  const colorClasses = {
    primary: 'from-blue-500 to-cyan-400',
    success: 'from-emerald-500 to-green-400',
    warning: 'from-amber-500 to-yellow-400',
    danger: 'from-red-500 to-orange-400',
  }

  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-medium">{value.toFixed(0)}%</span>
        </div>
      )}
      <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out',
            colorClasses[color]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

export function ViabilityVerdictDisplay({
  verdict,
  hypothesis,
  jobId,
  isAppAnalysis,
  interviewQuestions,
  onRunCommunityVoice,
  onRunCompetitors,
}: ViabilityVerdictProps) {
  const [showRedFlags, setShowRedFlags] = useState(false)
  const [showInterviewGuide, setShowInterviewGuide] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const detailsRef = useRef<HTMLDivElement>(null)
  const colors = VerdictColors[verdict.verdict]
  const { setActiveTab, setCommunitySubTab } = useResearchTabs()

  // Handler for "See Why" button - expands details and scrolls to them
  const handleSeeWhy = () => {
    setShowDetails(true)
    // Scroll to details after a short delay to allow render
    setTimeout(() => {
      detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  // Handler for "Interview Guide" button
  const handleInterviewGuide = () => {
    if (isAppAnalysis) {
      setShowInterviewGuide(!showInterviewGuide)
      setShowDetails(true)
    } else {
      setActiveTab('action')
    }
  }

  const getVerdictLabel = (level: VerdictLevel) => {
    switch (level) {
      case 'strong': return 'Strong Signal'
      case 'mixed': return 'Mixed Signal'
      case 'weak': return 'Weak Signal'
      case 'none': return 'No Signal'
    }
  }

  const getVerdictGradient = (level: VerdictLevel) => {
    switch (level) {
      case 'strong': return 'from-emerald-500/20 to-green-500/5'
      case 'mixed': return 'from-amber-500/20 to-yellow-500/5'
      case 'weak': return 'from-orange-500/20 to-amber-500/5'
      case 'none': return 'from-red-500/20 to-orange-500/5'
    }
  }

  const getDimensionIcon = (name: string) => {
    switch (name) {
      case 'Pain Score': return TrendingUp
      case 'Market Score': return PieChart
      case 'Timing Score': return BarChart3
      case 'Competition Score': return Shield
      default: return Target
    }
  }

  const getSampleSizeColor = (label: SampleSizeLabel) => {
    switch (label) {
      case 'high_confidence': return 'success'
      case 'moderate_confidence': return 'primary'
      case 'low_confidence': return 'warning'
      case 'very_limited': return 'danger'
    }
  }

  // Check if we have the new two-axis verdict system data
  const hasTwoAxisData = verdict.hypothesisConfidence && verdict.marketOpportunity

  return (
    <div className="space-y-6">
      {/* Simplified Verdict Hero - Always visible above the fold */}
      <VerdictHero
        verdict={verdict}
        onSeeWhy={handleSeeWhy}
        onInterviewGuide={handleInterviewGuide}
        isAppAnalysis={isAppAnalysis}
      />

      {/* Collapsible Details Section */}
      <div ref={detailsRef}>
        {/* Toggle button for details when collapsed */}
        {!showDetails && (
          <button
            onClick={() => setShowDetails(true)}
            className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2"
          >
            <ChevronDown className="h-4 w-4" />
            Show detailed breakdown
          </button>
        )}

        {/* Detailed sections - shown when expanded */}
        {showDetails && (
          <div className="space-y-6">
            {/* Collapse button */}
            <button
              onClick={() => setShowDetails(false)}
              className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2"
            >
              <ChevronUp className="h-4 w-4" />
              Hide details
            </button>

            {/* v6 Report Redesign: Two-Axis Verdict Display (when available) */}
            {hasTwoAxisData && (
              <DualVerdictDisplay
                hypothesisConfidence={verdict.hypothesisConfidence!}
                marketOpportunity={verdict.marketOpportunity!}
                overallScore={verdict.overallScore}
              />
            )}

      {/* Subtle Red Flags Alert - Collapsible */}
      {verdict.redFlags && verdict.redFlags.length > 0 && (
        <div className="rounded-xl border border-red-200/50 dark:border-red-900/50 bg-gradient-to-r from-red-50/50 to-transparent dark:from-red-950/30 dark:to-transparent overflow-hidden">
          <button
            onClick={() => setShowRedFlags(!showRedFlags)}
            className="w-full px-4 py-3 flex items-center justify-between hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-red-100 dark:bg-red-900/50">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              <div className="text-left">
                <span className="text-sm font-medium text-red-700 dark:text-red-300">
                  {verdict.redFlags.length} Warning{verdict.redFlags.length > 1 ? 's' : ''} Detected
                </span>
                <span className="text-xs text-red-600/70 dark:text-red-400/70 ml-2">
                  Review before proceeding
                </span>
              </div>
            </div>
            {showRedFlags ? (
              <ChevronUp className="h-4 w-4 text-red-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-red-500" />
            )}
          </button>

          {showRedFlags && (
            <div className="px-4 pb-4 space-y-2">
              {verdict.redFlags.map((flag, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-lg bg-white/50 dark:bg-black/20 border border-red-100 dark:border-red-900/30"
                >
                  <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-red-800 dark:text-red-200">
                      {flag.title}
                    </div>
                    <div className="text-xs text-red-600/80 dark:text-red-400/80 mt-0.5">
                      {flag.message}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] flex-shrink-0',
                      flag.severity === 'HIGH' && 'border-red-300 text-red-600 bg-red-50 dark:bg-red-950',
                      flag.severity === 'MEDIUM' && 'border-orange-300 text-orange-600 bg-orange-50 dark:bg-orange-950',
                      flag.severity === 'LOW' && 'border-yellow-300 text-yellow-600 bg-yellow-50 dark:bg-yellow-950',
                    )}
                  >
                    {flag.severity}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

            {/* Limited Data Warning - More subtle */}
      {verdict.sampleSize && (verdict.sampleSize.label === 'very_limited' || verdict.sampleSize.label === 'low_confidence') && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30">
          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-medium text-amber-800 dark:text-amber-200">
              Limited data available.
            </span>
            <span className="text-amber-700 dark:text-amber-300">
              {' '}Consider expanding your search to additional communities for higher confidence.
            </span>
          </div>
        </div>
      )}

      {/* Dimension Breakdown - Modern Grid with Mini Rings */}
      {verdict.dimensions.length > 0 && (
        <div className="rounded-2xl border bg-card/50 backdrop-blur-sm overflow-hidden">
          <div className="px-6 py-4 border-b bg-muted/30">
            <h4 className="font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Score Breakdown
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Individual dimension contributions
            </p>
          </div>

          <div className="p-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {verdict.dimensions.map((dim) => {
                const Icon = getDimensionIcon(dim.name)
                return (
                  <div
                    key={dim.name}
                    className="flex items-center gap-4 p-3 rounded-xl bg-muted/20 hover:bg-muted/30 transition-colors"
                  >
                    <MiniScoreRing score={dim.score} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium">{dim.name}</span>
                        {dim.name === 'Market Score' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[250px]">
                              <p>Market Score factors in competition intensity and penetration difficulty. This differs from Market Opportunity which measures raw market size and timing.</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        <Badge variant="outline" className="text-[10px] ml-auto">
                          {Math.round(dim.weight * 100)}%
                        </Badge>
                      </div>
                      {dim.summary && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {dim.summary}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] flex-shrink-0',
                        dim.status === 'strong' && 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400',
                        dim.status === 'adequate' && 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400',
                        dim.status === 'needs_work' && 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400',
                        dim.status === 'critical' && 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400',
                      )}
                    >
                      {StatusLabels[dim.status]}
                    </Badge>
                  </div>
                )
              })}
            </div>

            {/* Score discrepancy explanation - when Market Score differs from Market Opportunity */}
            {verdict.dimensions.find(d => d.name === 'Market Score') && (
              <div className="mt-4 pt-4 border-t border-border/50">
                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
                  <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <p>
                    <strong className="text-foreground">Note:</strong> Market Score factors in competition intensity and penetration difficulty.
                    This may differ from Market Opportunity (shown above), which measures raw market size and timing.
                  </p>
                </div>
              </div>
            )}

            {/* Missing dimensions hint */}
            {!verdict.isComplete && (
              <div className="mt-4 pt-4 border-t border-border/50">
                <p className="text-xs text-muted-foreground mb-2">
                  Run additional research to complete your verdict:
                </p>
                <div className="flex flex-wrap gap-2">
                  {!verdict.dimensions.find((d) => d.name === 'Pain Score') && (
                    <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                      <Link href={jobId ? `/research?jobId=${jobId}` : '/research'}>
                        <TrendingUp className="h-3 w-3 mr-1" />
                        Community Voice
                      </Link>
                    </Button>
                  )}
                  {!verdict.dimensions.find((d) => d.name === 'Competition Score') && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setActiveTab('market')}
                    >
                      <Shield className="h-3 w-3 mr-1" />
                      Competitors
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state for no dimensions */}
      {verdict.dimensions.length === 0 && (
        <div className="text-center py-12 px-6 rounded-2xl border border-dashed">
          <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground mb-1">No research dimensions available yet</p>
          <p className="text-sm text-muted-foreground/70">
            Run research modules to generate your Viability Verdict
          </p>
        </div>
      )}

      {/* Recommendations - Clean card design */}
      {verdict.recommendations.length > 0 && (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="px-6 py-4 border-b bg-gradient-to-r from-amber-50/50 to-transparent dark:from-amber-950/20">
            <h4 className="font-semibold flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Next Steps
            </h4>
          </div>
          <div className="p-4 space-y-2">
            {verdict.recommendations.map((rec, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex-shrink-0">
                  {i + 1}
                </div>
                <span className="text-sm text-muted-foreground leading-relaxed">{rec}</span>
              </div>
            ))}
          </div>

          {/* Interview Guide CTA */}
          {verdict.isComplete && verdict.verdict !== 'none' && (
            <div className="px-6 py-4 border-t bg-gradient-to-r from-emerald-50/50 to-transparent dark:from-emerald-950/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-emerald-800 dark:text-emerald-200 text-sm">
                    Ready to validate with real customers?
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    Get personalized Mom Test interview questions
                  </p>
                </div>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => {
                    if (isAppAnalysis) {
                      // For App mode: Toggle inline interview guide
                      setShowInterviewGuide(!showInterviewGuide)
                    } else {
                      // For Hypothesis mode: Navigate to Action tab
                      setActiveTab('action')
                    }
                  }}
                >
                  Interview Guide
                  {isAppAnalysis ? (
                    showInterviewGuide ? <ChevronUp className="h-3.5 w-3.5 ml-1.5" /> : <ChevronDown className="h-3.5 w-3.5 ml-1.5" />
                  ) : (
                    <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  )}
                </Button>
              </div>

              {/* Inline Interview Guide for App Mode */}
              {isAppAnalysis && showInterviewGuide && interviewQuestions && (
                <div className="mt-4 pt-4 border-t border-emerald-200 dark:border-emerald-800">
                  <div className="space-y-4">
                    {/* Context Questions */}
                    <div>
                      <h4 className="text-sm font-medium mb-2 text-emerald-800 dark:text-emerald-200">Context Questions</h4>
                      <ol className="space-y-1.5">
                        {interviewQuestions.contextQuestions.slice(0, 3).map((q, i) => (
                          <li key={i} className="text-sm text-muted-foreground pl-5 relative">
                            <span className="absolute left-0">{i + 1}.</span>
                            {typeof q === 'string' ? q : (q as { question?: string }).question || String(q)}
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Problem Questions */}
                    <div>
                      <h4 className="text-sm font-medium mb-2 text-emerald-800 dark:text-emerald-200">Problem Exploration</h4>
                      <ol className="space-y-1.5">
                        {interviewQuestions.problemQuestions.slice(0, 3).map((q, i) => (
                          <li key={i} className="text-sm text-muted-foreground pl-5 relative">
                            <span className="absolute left-0">{i + 1}.</span>
                            {typeof q === 'string' ? q : (q as { question?: string }).question || String(q)}
                          </li>
                        ))}
                      </ol>
                    </div>

                    {/* Solution Questions */}
                    <div>
                      <h4 className="text-sm font-medium mb-2 text-emerald-800 dark:text-emerald-200">Solution Testing</h4>
                      <ol className="space-y-1.5">
                        {interviewQuestions.solutionQuestions.slice(0, 3).map((q, i) => (
                          <li key={i} className="text-sm text-muted-foreground pl-5 relative">
                            <span className="absolute left-0">{i + 1}.</span>
                            {typeof q === 'string' ? q : (q as { question?: string }).question || String(q)}
                          </li>
                        ))}
                      </ol>
                    </div>

                    <p className="text-xs text-muted-foreground italic pt-2 border-t">
                      Based on "The Mom Test" - focus on past behavior, not hypotheticals
                    </p>
                  </div>
                </div>
              )}

              {/* No interview questions available message */}
              {isAppAnalysis && showInterviewGuide && !interviewQuestions && (
                <div className="mt-4 pt-4 border-t border-emerald-200 dark:border-emerald-800">
                  <p className="text-sm text-muted-foreground">
                    Interview questions are generated from user feedback analysis. Complete the Feedback tab analysis first.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

            {/* Dealbreakers - Always visible if present (per plan) */}
            {verdict.dealbreakers.length > 0 && (
              <div className="rounded-xl border border-red-200 dark:border-red-900 bg-gradient-to-r from-red-50/30 to-transparent dark:from-red-950/20 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="font-medium text-sm text-red-700 dark:text-red-300">
                    Dealbreakers Detected
                  </span>
                </div>
                <ul className="space-y-2">
                  {verdict.dealbreakers.map((dealbreaker, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                      <span className="text-red-400">-</span>
                      {dealbreaker}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Info footer - Minimal */}
            <div className="flex items-start gap-2 text-xs text-muted-foreground px-1">
              <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <p>
                Score formula: Pain (35%) + Market (25%) + Competition (25%) + Timing (15%).
                Market uses TAM/SAM/SOM Fermi estimation. Timing identifies tailwinds and headwinds.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
