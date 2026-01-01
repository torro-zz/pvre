'use client'

/**
 * TieredMetricsDisplay - Displays tiered signal breakdown
 *
 * Shows the distribution of signals across relevance tiers when
 * the tiered filter is enabled (USE_TIERED_FILTER = true).
 *
 * Tier breakdown:
 * - CORE (>=0.45): Direct match to hypothesis
 * - STRONG (>=0.35): Highly relevant
 * - RELATED (>=0.25): Same problem space
 * - ADJACENT (>=0.15): Nearby problems (pivot opportunities)
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Target,
  Zap,
  Link2,
  Compass,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useState } from 'react'

interface TieredMetrics {
  core: number
  strong: number
  related: number
  adjacent: number
  total: number
  processingTimeMs: number
}

interface TieredMetricsDisplayProps {
  metrics: TieredMetrics
  className?: string
}

const TIER_CONFIG = [
  {
    key: 'core' as const,
    label: 'Core',
    description: 'Direct match to hypothesis',
    icon: Target,
    color: 'bg-emerald-500',
    textColor: 'text-emerald-700 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    threshold: '≥0.45',
  },
  {
    key: 'strong' as const,
    label: 'Strong',
    description: 'Highly relevant signals',
    icon: Zap,
    color: 'bg-blue-500',
    textColor: 'text-blue-700 dark:text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    threshold: '≥0.35',
  },
  {
    key: 'related' as const,
    label: 'Related',
    description: 'Same problem space',
    icon: Link2,
    color: 'bg-amber-500',
    textColor: 'text-amber-700 dark:text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    threshold: '≥0.25',
  },
  {
    key: 'adjacent' as const,
    label: 'Adjacent',
    description: 'Nearby problems (pivots)',
    icon: Compass,
    color: 'bg-purple-500',
    textColor: 'text-purple-700 dark:text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    threshold: '≥0.15',
  },
]

export function TieredMetricsDisplay({ metrics, className }: TieredMetricsDisplayProps) {
  const [showDetails, setShowDetails] = useState(false)

  // Calculate analysis signals (CORE + STRONG used for theme extraction)
  const analysisSignals = metrics.core + metrics.strong

  // Calculate percentages
  const getPercentage = (count: number) =>
    metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Tiered Signal Breakdown
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {metrics.total} total
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Stats */}
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">Analysis:</span>
            <span className="font-medium">{analysisSignals}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            <span className="text-muted-foreground">Pivot potential:</span>
            <span className="font-medium">{metrics.adjacent}</span>
          </div>
        </div>

        {/* Tier Bars */}
        <div className="space-y-3">
          {TIER_CONFIG.map((tier) => {
            const count = metrics[tier.key]
            const percentage = getPercentage(count)
            const Icon = tier.icon

            return (
              <div key={tier.key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-3.5 w-3.5 ${tier.textColor}`} />
                    <span className="font-medium">{tier.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {tier.threshold}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{count}</span>
                    <span className="text-xs text-muted-foreground w-8 text-right">
                      {percentage}%
                    </span>
                  </div>
                </div>
                <Progress
                  value={percentage}
                  className="h-2"
                  // Custom color via CSS variable would be nice but Progress uses primary
                />
              </div>
            )
          })}
        </div>

        {/* Expandable Details */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showDetails ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
          <span>{showDetails ? 'Hide' : 'Show'} tier details</span>
        </button>

        {showDetails && (
          <div className="space-y-2 pt-2 border-t">
            {TIER_CONFIG.map((tier) => (
              <div
                key={tier.key}
                className={`flex items-start gap-2 p-2 rounded-md ${tier.bgColor} border ${tier.borderColor}`}
              >
                <Info className={`h-3.5 w-3.5 mt-0.5 ${tier.textColor}`} />
                <div>
                  <span className={`text-xs font-medium ${tier.textColor}`}>
                    {tier.label}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {tier.description}
                  </p>
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground pt-1">
              Theme extraction uses CORE + STRONG signals ({analysisSignals} total).
              ADJACENT signals can reveal pivot opportunities.
            </p>
            <p className="text-xs text-muted-foreground">
              Processed in {metrics.processingTimeMs}ms
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Compact version for inline display in data quality section
 */
export function TieredMetricsBadges({ metrics }: { metrics: TieredMetrics }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TIER_CONFIG.map((tier) => {
        const count = metrics[tier.key]
        if (count === 0) return null

        const Icon = tier.icon
        return (
          <Badge
            key={tier.key}
            variant="outline"
            className={`${tier.bgColor} ${tier.borderColor} ${tier.textColor} text-xs font-normal`}
            title={tier.description}
          >
            <Icon className="h-3 w-3 mr-1" />
            {tier.label}: {count}
          </Badge>
        )
      })}
    </div>
  )
}
