'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  DollarSign,
  MessageSquare,
  Users,
  Database,
  Info,
  ArrowRight,
  Target,
  XCircle,
  HelpCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AnimatedNumber,
  AnimatedProgress,
  AnimatedCard,
  AnimatedBadge,
  StaggerContainer,
  staggerItem,
} from '@/components/ui/animated-components'
import {
  ViabilityVerdict,
  HypothesisConfidence,
  MarketOpportunity,
} from '@/lib/analysis/viability-calculator'
import {
  getVerdictMessage as getSharedVerdictMessage,
  getVerdictLevel,
} from '@/lib/utils/verdict-messages'

// ============================================
// Types
// ============================================

interface RedFlag {
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  message: string
}

interface InvestorMetricsHeroProps {
  // Core scores
  painScore: number
  painScoreConfidence: 'very_low' | 'low' | 'medium' | 'high'

  // Two-axis verdict (if available)
  hypothesisConfidence?: HypothesisConfidence
  marketOpportunity?: MarketOpportunity

  // Key signals
  totalSignals: number
  coreSignals?: number
  wtpCount: number
  wtpSources?: { reddit: number; appStore: number; other: number }

  // Data quality
  dataConfidence: 'very_low' | 'low' | 'medium' | 'high'
  relevanceRate: number
  recencyScore?: number

  // Context
  postsAnalyzed: number
  communitiesCount: number
  dataSources: string[]
  hypothesis?: string  // For "Edit & Re-run" link

  // Additional metrics for compact row
  marketSizing?: {
    samFormatted?: string
    tamFormatted?: string
    growthPercent?: number
  }
  timingScore?: number
  competitionScore?: number

  // Verdict & guidance
  verdict?: ViabilityVerdict
  redFlags?: RedFlag[]

  // Actions
  onViewEvidence?: () => void
  onViewAction?: () => void
  onScrollToSection?: (section: string) => void

  className?: string
}

// ============================================
// Helper Components
// ============================================

function MetricGauge({
  score,
  label,
  sublabel,
  colorClass,
  delay = 0,
  size = 'md'
}: {
  score: number
  label: string
  sublabel: string
  colorClass: string
  delay?: number
  size?: 'sm' | 'md'
}) {
  const percentage = (score / 10) * 100
  const gaugeSize = size === 'sm' ? 64 : 80
  const strokeWidth = size === 'sm' ? 5 : 6

  // Score-based glow effects
  const getGlowClass = (score: number) => {
    if (score >= 7) return 'shadow-lg shadow-emerald-500/20 ring-1 ring-emerald-500/20'
    if (score >= 5) return 'shadow-lg shadow-amber-500/20 ring-1 ring-amber-500/20'
    return 'shadow-lg shadow-red-500/20 ring-1 ring-red-500/20'
  }

  return (
    <motion.div
      className={cn(
        'flex flex-col items-center text-center p-4 rounded-xl transition-all',
        getGlowClass(score)
      )}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      <div className="relative" style={{ width: gaugeSize, height: gaugeSize }}>
        <AnimatedProgress
          percentage={percentage}
          size={gaugeSize}
          strokeWidth={strokeWidth}
          colorClass={colorClass}
          delay={delay + 0.2}
          duration={1.0}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <AnimatedNumber
            value={score}
            decimals={1}
            delay={delay + 0.3}
            duration={1.0}
            className={cn('font-bold', size === 'sm' ? 'text-xl' : 'text-2xl')}
          />
        </div>
      </div>
      <motion.div
        className="mt-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: delay + 0.5 }}
      >
        <div className="text-sm font-semibold">{label}</div>
        <div className="text-xs text-muted-foreground">{sublabel}</div>
      </motion.div>
    </motion.div>
  )
}

function SignalStat({
  icon: Icon,
  value,
  label,
  accent = false,
  warning = false,
  tooltip,
  delay = 0,
}: {
  icon: React.ElementType
  value: number | string
  label: string
  accent?: boolean
  warning?: boolean
  tooltip?: string
  delay?: number
}) {
  const content = (
    <motion.div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg',
        accent && 'bg-emerald-50 dark:bg-emerald-950/30',
        warning && 'bg-amber-50 dark:bg-amber-950/30',
        !accent && !warning && 'bg-muted/50'
      )}
      variants={staggerItem}
    >
      <Icon className={cn(
        'h-4 w-4',
        accent && 'text-emerald-600 dark:text-emerald-400',
        warning && 'text-amber-600 dark:text-amber-400',
        !accent && !warning && 'text-muted-foreground'
      )} />
      <div>
        <div className={cn(
          'text-lg font-bold',
          accent && 'text-emerald-700 dark:text-emerald-300',
          warning && 'text-amber-700 dark:text-amber-300'
        )}>
          {value}
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
      {warning && (
        <motion.div
          className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center ml-auto"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: delay + 0.3, type: 'spring', stiffness: 400 }}
        >
          <span className="text-[10px] text-white font-bold">!</span>
        </motion.div>
      )}
    </motion.div>
  )

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px]">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    )
  }

  return content
}

function DataQualityBadge({ confidence }: { confidence: 'very_low' | 'low' | 'medium' | 'high' }) {
  const config = {
    very_low: { label: 'Needs Validation', color: 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400' },
    low: { label: 'Limited Evidence', color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400' },
    medium: { label: 'Solid Foundation', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400' },
    high: { label: 'Strong Signal', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400' },
  }
  const { label, color } = config[confidence]

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className={cn('text-xs font-medium', color)}>
          {confidence === 'high' && <CheckCircle2 className="h-3 w-3 mr-1" />}
          {confidence === 'very_low' && <AlertTriangle className="h-3 w-3 mr-1" />}
          {label}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[220px]">
        Based on {confidence === 'very_low' ? '<10' : confidence === 'low' ? '10-30' : confidence === 'medium' ? '30-100' : '100+'} signals
      </TooltipContent>
    </Tooltip>
  )
}

// Color coding helper for scores
function getScoreColor(value: number | string, colorType?: 'score' | 'count' | 'neutral'): string {
  if (colorType === 'neutral' || typeof value === 'string') return ''
  const numValue = typeof value === 'number' ? value : parseFloat(value)
  if (isNaN(numValue)) return ''

  if (colorType === 'count') {
    return numValue === 0 ? 'text-red-500' : ''
  }

  // Score-based coloring
  if (numValue >= 8) return 'text-emerald-500'
  if (numValue >= 6) return 'text-amber-500'
  if (numValue >= 4) return 'text-orange-500'
  return 'text-red-500'
}

// Interpretive label helpers for metrics
function getPainLabel(score: number): string {
  if (score >= 8) return 'Strong'
  if (score >= 6) return 'Moderate'
  if (score >= 4) return 'Low'
  return 'Minimal'
}

function getTimingLabel(score: number): string {
  if (score >= 8) return 'Rising ↑'
  if (score >= 6) return 'Flat →'
  if (score >= 4) return 'Uncertain'
  return 'Declining ↓'
}

function getVerdictLabel(score: number): { text: string; color: string } {
  // Use shared utility thresholds for consistency
  const level = getVerdictLevel(score)
  switch (level) {
    case 'strong': return { text: 'Strong Signal', color: 'text-emerald-500' }
    case 'mixed': return { text: 'Mixed Signal', color: 'text-amber-500' }
    case 'weak': return { text: 'Weak Signal', color: 'text-orange-500' }
    default: return { text: 'No Signal', color: 'text-red-500' }
  }
}

// Quick Metrics Row - compact horizontal display
function QuickMetricsRow({
  metrics,
  onScrollToSection,
}: {
  metrics: Array<{
    label: string
    value: string | number
    suffix?: string  // e.g., "/10" or "users"
    interpretiveLabel?: string  // e.g., "Strong", "Mixed Signal"
    interpretiveLabelColor?: string  // Tailwind color class
    section?: string
    highlight?: boolean
    tooltip?: string
    colorType?: 'score' | 'count' | 'neutral'  // For color coding
  }>
  onScrollToSection?: (section: string) => void
}) {
  return (
    <motion.div
      className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
    >
      {metrics.map((metric, index) => {
        const colorClass = getScoreColor(metric.value, metric.colorType)

        const isClickable = metric.section && onScrollToSection
        const button = (
          <motion.div
            key={metric.label}
            role={isClickable ? "button" : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onClick={() => isClickable && onScrollToSection?.(metric.section!)}
            onKeyDown={isClickable ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onScrollToSection?.(metric.section!)
              }
            } : undefined}
            className={cn(
              'flex flex-col items-center p-2 rounded-lg transition-colors text-center w-full',
              isClickable
                ? 'hover:bg-muted/50 cursor-pointer'
                : 'cursor-default',
              metric.highlight && 'bg-primary/5'
            )}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.2 + index * 0.05 }}
          >
            <div className="flex items-baseline gap-0.5">
              {typeof metric.value === 'number' ? (
                <AnimatedNumber
                  value={metric.value}
                  decimals={metric.value % 1 !== 0 ? 1 : 0}
                  delay={0.3 + index * 0.05}
                  duration={0.8}
                  className={cn(
                    'text-lg font-bold',
                    colorClass || (metric.highlight && 'text-primary')
                  )}
                />
              ) : (
                <span className={cn('text-lg font-bold', colorClass || (metric.highlight && 'text-primary'))}>
                  {metric.value}
                </span>
              )}
              {metric.suffix && (
                <span className={cn('text-sm font-medium', colorClass || 'text-muted-foreground')}>
                  {metric.suffix}
                </span>
              )}
            </div>
            {metric.interpretiveLabel && (
              <span className={cn(
                'text-[10px] font-medium mt-0.5',
                metric.interpretiveLabelColor || 'text-muted-foreground'
              )}>
                {metric.interpretiveLabel}
              </span>
            )}
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide mt-0.5">
              {metric.label}
            </span>
          </motion.div>
        )

        if (metric.tooltip) {
          return (
            <Tooltip key={metric.label}>
              <TooltipTrigger asChild>{button}</TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[240px] text-xs">
                {metric.tooltip}
              </TooltipContent>
            </Tooltip>
          )
        }

        return button
      })}
    </motion.div>
  )
}

// ============================================
// Main Component
// ============================================

export function InvestorMetricsHero({
  painScore,
  painScoreConfidence,
  hypothesisConfidence,
  marketOpportunity,
  totalSignals,
  coreSignals,
  wtpCount,
  wtpSources,
  dataConfidence,
  relevanceRate,
  recencyScore,
  postsAnalyzed,
  communitiesCount,
  dataSources,
  hypothesis,
  marketSizing,
  timingScore,
  competitionScore,
  verdict,
  redFlags = [],
  onViewEvidence,
  onViewAction,
  onScrollToSection,
  className,
}: InvestorMetricsHeroProps) {
  const hasTwoAxisData = hypothesisConfidence && marketOpportunity

  // Constructive sublabels - positive framing that guides action
  const getPainSublabel = (score: number) => {
    if (score >= 8) return 'Urgent need detected'
    if (score >= 6) return 'Clear frustration'
    if (score >= 4) return 'Growing awareness'
    return 'Early stage opportunity'
  }

  const getConfidenceSublabel = (score: number) => {
    if (score >= 8) return 'Strong fit'
    if (score >= 6) return 'Solid evidence'
    if (score >= 4) return 'Gathering momentum'
    return 'Building foundation'
  }

  const getOpportunitySublabel = (score: number) => {
    if (score >= 8) return 'Strong opportunity'
    if (score >= 6) return 'Clear potential'
    if (score >= 4) return 'Promising signs'
    return 'Early indicators'
  }

  const getGaugeColor = (score: number) => {
    if (score >= 7) return 'stroke-emerald-500'
    if (score >= 5) return 'stroke-amber-500'
    return 'stroke-red-500'
  }

  // Auto-generate warnings based on data patterns
  const autoWarnings: RedFlag[] = []

  if (wtpCount === 0 && painScore >= 5) {
    autoWarnings.push({
      severity: 'HIGH',
      message: 'High pain but no payment intent detected. Monetization risk.'
    })
  }

  if (wtpSources && wtpSources.appStore > wtpSources.reddit * 3 && wtpSources.appStore > 0) {
    autoWarnings.push({
      severity: 'MEDIUM',
      message: `${wtpSources.appStore} of ${wtpCount} WTP signals from competitor reviews. Validate with new market research.`
    })
  }

  if (relevanceRate < 50) {
    autoWarnings.push({
      severity: 'MEDIUM',
      message: `Only ${relevanceRate}% of signals relevant to hypothesis. Review evidence carefully.`
    })
  }

  const allWarnings = [...redFlags, ...autoWarnings]
  const hasWarnings = allWarnings.length > 0

  // Check for dealbreakers (critical issues that should override "Proceed with Confidence")
  const hasDealbreakers = verdict?.dealbreakers && verdict.dealbreakers.length > 0
  const hasHighSeverityFlags = allWarnings.some(w => w.severity === 'HIGH')
  const hasCriticalConcerns = hasDealbreakers || hasHighSeverityFlags

  // Verdict message - Use shared utility for consistent messaging across all components
  const verdictScore = verdict?.overallScore || painScore
  const sharedVerdict = getSharedVerdictMessage(verdictScore, hasCriticalConcerns)

  const getVerdictMessage = () => {
    // Use the shared verdict message for consistency
    return sharedVerdict.longMessage
  }

  const getVerdictColor = () => {
    // Use shared verdict colors for consistency
    return `${sharedVerdict.colors.gradient} ${sharedVerdict.colors.border}`
  }

  return (
    <AnimatedCard
      className={cn('rounded-xl border bg-card shadow-sm overflow-hidden', className)}
      delay={0}
    >
      {/* Header */}
      <motion.div
        className="px-6 pt-5 pb-4 flex items-center justify-between"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <h2 className="font-semibold text-base">Investor Metrics</h2>
        {/* Removed redundant badges - consolidated warning banner shown below */}
      </motion.div>

      {/* Quick Metrics Row - compact at-a-glance numbers */}
      <div className="px-6">
        <QuickMetricsRow
          metrics={[
            {
              label: 'Pain',
              value: painScore,
              suffix: '/10',
              section: 'evidence',
              colorType: 'score' as const,
              interpretiveLabel: getPainLabel(painScore),
              interpretiveLabelColor: getScoreColor(painScore, 'score'),
              tooltip: painScore >= 8
                ? "Pain Score 8-10 (Strong): Users express urgent, frequent frustration. High willingness to seek solutions."
                : painScore >= 6
                ? "Pain Score 6-7.9 (Moderate): Clear frustration detected, but may not be urgent. Good opportunity with positioning."
                : painScore >= 4
                ? "Pain Score 4-5.9 (Low): Some awareness of the problem, but limited urgency. May need market education."
                : "Pain Score 0-3.9 (Minimal): Little evidence of pain. Consider pivoting or broadening hypothesis.",
            },
            {
              label: 'Signals',
              value: totalSignals,
              section: 'evidence',
              colorType: 'count' as const,
              interpretiveLabel: totalSignals > 0 ? 'found' : undefined,
              tooltip: coreSignals !== undefined
                ? `${totalSignals} total signals found. ${coreSignals} are core (directly match your hypothesis), ${totalSignals - coreSignals} are supporting.`
                : `${totalSignals} signals found matching your hypothesis.`,
            },
            {
              label: 'WTP',
              value: wtpCount,
              section: 'evidence',
              colorType: 'count' as const,
              interpretiveLabel: wtpCount > 0 ? '💰 found' : undefined,
              interpretiveLabelColor: wtpCount > 0 ? 'text-emerald-500' : undefined,
              tooltip: wtpCount === 0
                ? "WTP (Willingness to Pay): Mentions of paying for solutions, price discussions, or subscription willingness. None found - this is a validation gap."
                : wtpCount <= 3
                ? `WTP (Willingness to Pay): ${wtpCount} signal${wtpCount === 1 ? '' : 's'} found. Some payment intent - gather more evidence to validate monetization.`
                : wtpCount <= 8
                ? `WTP (Willingness to Pay): ${wtpCount} signals found. Good evidence of payment intent from users.`
                : `WTP (Willingness to Pay): ${wtpCount} signals found. Strong monetization signal - many users discuss paying for solutions.`,
            },
            {
              label: 'Market',
              value: marketSizing?.samFormatted || (marketOpportunity?.score?.toFixed(1) || '—'),
              suffix: marketSizing?.samFormatted ? ' users' : '/10',
              section: 'market',
              colorType: 'neutral' as const,
            },
            {
              label: 'Timing',
              value: timingScore !== undefined ? timingScore : '—',
              suffix: timingScore !== undefined ? '/10' : undefined,
              section: 'market',
              colorType: 'score' as const,
              interpretiveLabel: timingScore !== undefined ? getTimingLabel(timingScore) : undefined,
              interpretiveLabelColor: timingScore !== undefined ? getScoreColor(timingScore, 'score') : undefined,
              tooltip: timingScore === undefined
                ? "Timing analysis not available. Based on market trends and tailwinds/headwinds."
                : timingScore >= 8
                ? "Timing 8-10 (Rising): Strong tailwinds detected. Market interest growing - good time to enter."
                : timingScore >= 6
                ? "Timing 6-7.9 (Stable): Balanced market conditions. No urgent timing pressure either way."
                : timingScore >= 4
                ? "Timing 4-5.9 (Uncertain): Mixed signals in market trends. Timing may be challenging."
                : "Timing 0-3.9 (Declining): Headwinds detected. Consider timing carefully before entering.",
            },
            {
              label: 'Verdict',
              value: verdict?.overallScore || 0,
              suffix: '/10',
              section: 'action',
              colorType: 'score' as const,
              interpretiveLabel: getVerdictLabel(verdict?.overallScore || 0).text,
              interpretiveLabelColor: getVerdictLabel(verdict?.overallScore || 0).color,
              tooltip: (verdict?.overallScore || 0) >= 7.5
                ? "Verdict 7.5+ (Strong Signal): Multiple positive signals align. Proceed with confidence but validate key assumptions."
                : (verdict?.overallScore || 0) >= 5.0
                ? "Verdict 5.0-7.4 (Mixed Signal): Some promising signals, some concerns. Investigate gaps before committing."
                : (verdict?.overallScore || 0) >= 4.0
                ? "Verdict 4.0-4.9 (Weak Signal): Significant gaps in evidence. Consider pivoting or deeper validation."
                : "Verdict <4.0 (No Signal): Insufficient evidence found. Strongly consider alternative approaches.",
            },
          ]}
          onScrollToSection={onScrollToSection}
        />
      </div>

      {/* Consolidated Limited Data Banner */}
      {(dataConfidence === 'very_low' || dataConfidence === 'low') && (
        <motion.div
          className="mx-6 mt-3 px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-amber-700 dark:text-amber-300 text-sm">
                Limited Data
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                Results based on {postsAnalyzed.toLocaleString()} relevant post{postsAnalyzed === 1 ? '' : 's'}.
                {postsAnalyzed < 10 && ' Consider broadening your search for stronger signals.'}
              </p>
            </div>
            {hypothesis && (
              <Button
                variant="ghost"
                size="sm"
                className="text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-xs h-7"
                asChild
              >
                <a href={`/research?hypothesis=${encodeURIComponent(hypothesis)}`}>
                  Edit & Re-run
                  <ArrowRight className="h-3 w-3 ml-1" />
                </a>
              </Button>
            )}
          </div>
        </motion.div>
      )}

      {/* Two-Panel Section: Recommendation + Market Snapshot */}
      <div className={cn(
        'mx-6 mt-4 grid gap-4',
        marketSizing?.samFormatted ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
      )}>
        {/* Left Panel: Recommendation */}
        <motion.div
          className={cn(
            'rounded-xl border px-4 py-4 bg-gradient-to-r',
            getVerdictColor()
          )}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {/* Icon based on verdict level - uses shared utility for consistency */}
                {sharedVerdict.level === 'strong' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                ) : sharedVerdict.level === 'mixed' ? (
                  <HelpCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                ) : sharedVerdict.level === 'weak' ? (
                  <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                )}
                <span className="font-semibold">
                  {/* Use shared verdict action for consistency */}
                  {sharedVerdict.action}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{getVerdictMessage()}</p>
            </div>
            {onViewAction && (
              <Button
                variant="ghost"
                size="sm"
                className="flex-shrink-0"
                onClick={onViewAction}
              >
                View Next Steps
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </motion.div>

        {/* Right Panel: Market Snapshot (only if market sizing data available) */}
        {marketSizing?.samFormatted && (
          <motion.div
            className="rounded-xl border px-4 py-4 bg-muted/30"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">Market Snapshot</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {marketSizing.tamFormatted && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">TAM</div>
                  <div className="font-semibold">{marketSizing.tamFormatted} users</div>
                </div>
              )}
              <div>
                <div className="text-xs text-muted-foreground uppercase tracking-wide">SAM</div>
                <div className="font-semibold">{marketSizing.samFormatted} users</div>
              </div>
              {competitionScore !== undefined && competitionScore > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Competition</div>
                  <div className="font-semibold">{competitionScore.toFixed(1)}/10</div>
                </div>
              )}
              {marketSizing.growthPercent !== undefined && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Growth</div>
                  <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                    +{marketSizing.growthPercent}%
                  </div>
                </div>
              )}
            </div>
            {onScrollToSection && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-3 text-xs"
                onClick={() => onScrollToSection('market')}
              >
                View Full Analysis
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </motion.div>
        )}
      </div>

      {/* Footer stats - compact inline */}
      <div className="px-6 pb-4 pt-2">
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          {dataSources.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              <span>{dataSources.join(' · ')}</span>
            </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="flex items-center gap-1.5 cursor-help hover:text-foreground transition-colors">
                <Users className="w-3.5 h-3.5" />
                <span>{communitiesCount} communities</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[240px]">
              <p className="text-xs">
                <strong>Sample Breadth:</strong> Data from {communitiesCount} communit{communitiesCount === 1 ? 'y' : 'ies'}.
                {communitiesCount < 3
                  ? " Limited perspective — consider validating across more sources."
                  : communitiesCount < 7
                  ? " Moderate coverage — results reflect several audience segments."
                  : " Good coverage — diverse perspectives captured."}
              </p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="flex items-center gap-1.5 cursor-help hover:text-foreground transition-colors">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>{postsAnalyzed.toLocaleString()} posts</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[260px]">
              <p className="text-xs">
                <strong>Sample Size:</strong> {postsAnalyzed.toLocaleString()} relevant posts analyzed.
                {postsAnalyzed < 20
                  ? " Small sample — interpret scores cautiously. Results may not be representative."
                  : postsAnalyzed < 50
                  ? " Moderate sample — provides directional insights."
                  : " Good sample size — provides statistically meaningful insights."}
              </p>
            </TooltipContent>
          </Tooltip>
          {recencyScore !== undefined && (
            <div className="flex items-center gap-1.5">
              <span>Recency: {Math.round(recencyScore * 100)}%</span>
            </div>
          )}
        </div>
      </div>
    </AnimatedCard>
  )
}
