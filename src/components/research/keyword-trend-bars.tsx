'use client'

/**
 * KeywordTrendBars - Per-keyword Google Trends breakdown
 *
 * Shows each keyword's individual performance with visual bars
 * so users can see which keywords are driving the aggregate number.
 */

import { useState } from 'react'
import { ChevronDown, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { KeywordTrend } from '@/lib/data-sources/google-trends'

interface KeywordTrendBarsProps {
  keywords: string[]
  keywordBreakdown?: KeywordTrend[]
  aggregateChange: number
}

export function KeywordTrendBars({ keywords, keywordBreakdown, aggregateChange }: KeywordTrendBarsProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // If no breakdown data, don't render the expandable section
  if (!keywordBreakdown || keywordBreakdown.length === 0) {
    return null
  }

  // Find the max absolute percentage change to scale the bars
  const maxAbsChange = Math.max(
    ...keywordBreakdown.map(k => Math.abs(k.percentageChange)),
    1 // Prevent division by zero
  )

  // Get trend icon
  const getTrendIcon = (trend: 'rising' | 'stable' | 'falling') => {
    switch (trend) {
      case 'rising':
        return <TrendingUp className="h-3 w-3 text-emerald-600" />
      case 'falling':
        return <TrendingDown className="h-3 w-3 text-red-600" />
      default:
        return <Minus className="h-3 w-3 text-slate-500" />
    }
  }

  // Get bar color based on trend
  const getBarColor = (trend: 'rising' | 'stable' | 'falling', percentageChange: number) => {
    if (trend === 'rising' || percentageChange > 15) {
      return 'bg-emerald-500'
    } else if (trend === 'falling' || percentageChange < -15) {
      return 'bg-red-500'
    }
    return 'bg-slate-400'
  }

  // Format large percentages nicely
  const formatPercentage = (pct: number) => {
    if (Math.abs(pct) >= 1000) {
      return `${pct > 0 ? '+' : ''}${(pct / 1000).toFixed(1)}K%`
    }
    return `${pct > 0 ? '+' : ''}${pct}%`
  }

  return (
    <div className="mt-3 border-t border-blue-200 dark:border-blue-800 pt-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left text-xs text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 transition-colors"
      >
        <span className="flex items-center gap-1">
          <Info className="h-3 w-3" />
          See keyword breakdown ({keywordBreakdown.length} keywords)
        </span>
        <ChevronDown className={cn(
          "h-4 w-4 transition-transform",
          isExpanded && "rotate-180"
        )} />
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-2">
          {keywordBreakdown.map((kw, index) => {
            // Calculate bar width as percentage of max
            const barWidth = Math.min(
              (Math.abs(kw.percentageChange) / maxAbsChange) * 100,
              100
            )

            return (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    {getTrendIcon(kw.trend)}
                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[150px]" title={kw.keyword}>
                      {kw.keyword}
                    </span>
                  </div>
                  <span className={cn(
                    "font-mono font-medium",
                    kw.trend === 'rising' ? 'text-emerald-600 dark:text-emerald-400' :
                    kw.trend === 'falling' ? 'text-red-600 dark:text-red-400' :
                    'text-slate-600 dark:text-slate-400'
                  )}>
                    {formatPercentage(kw.percentageChange)}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      getBarColor(kw.trend, kw.percentageChange)
                    )}
                    style={{ width: `${Math.max(barWidth, 2)}%` }}
                  />
                </div>
                {/* Q1 vs Q4 detail */}
                <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-500">
                  <span>Q1 avg: {kw.q1Average.toFixed(1)}</span>
                  <span>Q4 avg: {kw.q4Average.toFixed(1)}</span>
                </div>
              </div>
            )
          })}

          {/* Explanation footer */}
          <div className="mt-3 pt-2 border-t border-blue-100 dark:border-blue-900 text-[10px] text-blue-600 dark:text-blue-400">
            <p className="italic">
              Aggregate ({formatPercentage(aggregateChange)}) = weighted average based on first keyword.
              High % often means emerging topic with low Q1 baseline.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
