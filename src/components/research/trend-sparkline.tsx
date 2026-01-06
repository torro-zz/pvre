'use client'

/**
 * TrendSparkline - Multi-line sparkline chart for Google Trends data
 *
 * Shows each keyword as a separate colored line with the average highlighted.
 * Hover over lines to see keyword names and their individual trends.
 */

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { KeywordTrend } from '@/lib/data-sources/google-trends'

interface TrendDataPoint {
  time: string
  formattedTime: string
  value: number[]
}

interface TrendSparklineProps {
  timelineData: TrendDataPoint[]
  keywords: string[]
  keywordBreakdown?: KeywordTrend[]
  className?: string
}

// Color palette for lines (max 4 keywords)
const LINE_COLORS = [
  { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.1)', name: 'emerald' },  // emerald-500
  { stroke: '#3b82f6', fill: 'rgba(59, 130, 246, 0.1)', name: 'blue' },     // blue-500
  { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.1)', name: 'amber' },    // amber-500
  { stroke: '#8b5cf6', fill: 'rgba(139, 92, 246, 0.1)', name: 'violet' },   // violet-500
]

const AVERAGE_COLOR = { stroke: '#1f2937', fill: 'rgba(31, 41, 55, 0.15)' } // gray-800

export function TrendSparkline({ timelineData, keywords, keywordBreakdown, className }: TrendSparklineProps) {
  const [hoveredKeyword, setHoveredKeyword] = useState<number | null>(null)
  const [hoveredAverage, setHoveredAverage] = useState(false)

  // Filter out keywords with no meaningful search volume
  // This prevents confusing flat lines at zero when one keyword dominates
  const meaningfulKeywordIndices = useMemo(() => {
    if (!keywordBreakdown) return keywords.map((_, i) => i)

    return keywordBreakdown
      .map((kw, index) => ({ kw, index }))
      .filter(({ kw }) => kw.q4Average > 0.5) // Has recent search volume
      .map(({ index }) => index)
  }, [keywordBreakdown, keywords])

  // Count filtered keywords for user info
  const filteredCount = keywords.length - meaningfulKeywordIndices.length

  // Chart dimensions
  const width = 320
  const height = 80
  const padding = { top: 8, right: 8, bottom: 8, left: 8 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  // Process data and calculate paths
  const { paths, averagePath, maxValue, avgPercentChange } = useMemo(() => {
    if (!timelineData || timelineData.length === 0) {
      return { paths: [], averagePath: '', maxValue: 100, avgPercentChange: 0 }
    }

    // Find max value across all keywords for scaling
    let max = 0
    timelineData.forEach(point => {
      point.value.forEach(v => {
        if (v > max) max = v
      })
    })
    max = max || 100 // Prevent division by zero

    // Generate path for each meaningful keyword only
    const keywordPaths = meaningfulKeywordIndices.slice(0, 4).map((keywordIndex) => {
      const points = timelineData.map((point, i) => {
        const x = padding.left + (i / (timelineData.length - 1)) * chartWidth
        const y = padding.top + chartHeight - ((point.value[keywordIndex] || 0) / max) * chartHeight
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
      })
      return { path: points.join(' '), originalIndex: keywordIndex }
    })

    // Calculate average line - only from meaningful keywords (not zeros)
    const avgPoints = timelineData.map((point, i) => {
      // Only average the meaningful keywords, not the zero-volume ones
      const meaningfulValues = meaningfulKeywordIndices.slice(0, 4).map(idx => point.value[idx] || 0)
      const avg = meaningfulValues.length > 0
        ? meaningfulValues.reduce((sum, v) => sum + v, 0) / meaningfulValues.length
        : 0
      const x = padding.left + (i / (timelineData.length - 1)) * chartWidth
      const y = padding.top + chartHeight - (avg / max) * chartHeight
      return { x, y, avg }
    })
    const avgPath = avgPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

    // Calculate average percentage change (simple: compare avg of first quarter to last quarter)
    const quarterLen = Math.floor(avgPoints.length / 4)
    const firstQuarterAvg = avgPoints.slice(0, quarterLen).reduce((sum, p) => sum + p.avg, 0) / quarterLen
    const lastQuarterAvg = avgPoints.slice(-quarterLen).reduce((sum, p) => sum + p.avg, 0) / quarterLen
    const pctChange = firstQuarterAvg > 0
      ? Math.round(((lastQuarterAvg - firstQuarterAvg) / firstQuarterAvg) * 100)
      : (lastQuarterAvg > 0 ? 100 : 0)

    return {
      paths: keywordPaths,
      averagePath: avgPath,
      maxValue: max,
      avgPercentChange: pctChange
    }
  }, [timelineData, keywords, meaningfulKeywordIndices, chartWidth, chartHeight, padding])

  // If no timeline data but we have keywords, show a simple fallback
  const hasTimelineData = timelineData && timelineData.length > 0

  if (keywords.length === 0) {
    return null
  }

  // Get trend direction for average
  const avgTrend = avgPercentChange > 15 ? 'rising' : avgPercentChange < -15 ? 'falling' : 'stable'

  // Format percentage nicely
  const formatPct = (pct: number) => {
    if (Math.abs(pct) >= 1000) return `${pct > 0 ? '+' : ''}${(pct / 1000).toFixed(1)}K%`
    return `${pct > 0 ? '+' : ''}${pct}%`
  }

  // Fallback mode: show keyword bars when no timeline data
  if (!hasTimelineData) {
    // Calculate average from keywordBreakdown if available
    const fallbackAvg = keywordBreakdown && keywordBreakdown.length > 0
      ? Math.round(keywordBreakdown.reduce((sum, k) => sum + k.percentageChange, 0) / keywordBreakdown.length)
      : 0
    const fallbackTrend = fallbackAvg > 15 ? 'rising' : fallbackAvg < -15 ? 'falling' : 'stable'

    return (
      <div className={cn("space-y-2", className)}>
        {/* Headline */}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className={cn(
              "text-2xl font-bold",
              fallbackTrend === 'rising' ? 'text-emerald-600 dark:text-emerald-400' :
              fallbackTrend === 'falling' ? 'text-red-600 dark:text-red-400' :
              'text-slate-600 dark:text-slate-400'
            )}>
              {formatPct(fallbackAvg)}
            </span>
            <span className="text-sm text-muted-foreground">avg YoY</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {keywords.slice(0, 4).length} keywords
          </span>
        </div>

        {/* Per-keyword bars (fallback visualization) */}
        {keywordBreakdown && keywordBreakdown.length > 0 && (
          <div className="space-y-1.5">
            {keywordBreakdown.slice(0, 4).map((kw, index) => {
              const maxAbs = Math.max(...keywordBreakdown.map(k => Math.abs(k.percentageChange)), 1)
              const barWidth = Math.min((Math.abs(kw.percentageChange) / maxAbs) * 100, 100)
              const kwTrend = kw.percentageChange > 15 ? 'rising' : kw.percentageChange < -15 ? 'falling' : 'stable'

              return (
                <div key={index} className="space-y-0.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="truncate max-w-[180px] text-muted-foreground" title={kw.keyword}>
                      {kw.keyword}
                    </span>
                    <span className={cn(
                      "font-medium",
                      kwTrend === 'rising' ? 'text-emerald-600' :
                      kwTrend === 'falling' ? 'text-red-600' : 'text-slate-500'
                    )}>
                      {formatPct(kw.percentageChange)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        kwTrend === 'rising' ? 'bg-emerald-500' :
                        kwTrend === 'falling' ? 'bg-red-500' : 'bg-slate-400'
                      )}
                      style={{ width: `${Math.max(barWidth, 3)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Keywords list if no breakdown */}
        {(!keywordBreakdown || keywordBreakdown.length === 0) && (
          <div className="text-xs text-muted-foreground">
            Keywords: {keywords.slice(0, 4).join(', ')}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Headline: Average trend */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <span className={cn(
            "text-2xl font-bold",
            avgTrend === 'rising' ? 'text-emerald-600 dark:text-emerald-400' :
            avgTrend === 'falling' ? 'text-red-600 dark:text-red-400' :
            'text-slate-600 dark:text-slate-400'
          )}>
            {formatPct(avgPercentChange)}
          </span>
          <span className="text-sm text-muted-foreground">avg YoY</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {keywords.slice(0, 4).length} keywords
        </span>
      </div>

      {/* SVG Chart */}
      <div className="relative">
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="overflow-visible"
          preserveAspectRatio="none"
        >
          {/* Grid lines (subtle) */}
          <line
            x1={padding.left}
            y1={padding.top + chartHeight / 2}
            x2={width - padding.right}
            y2={padding.top + chartHeight / 2}
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeDasharray="4 4"
          />

          {/* Individual keyword lines (only meaningful ones) */}
          {paths.map(({ path, originalIndex }, displayIndex) => {
            const color = LINE_COLORS[displayIndex]
            const isHovered = hoveredKeyword === displayIndex
            const isDimmed = hoveredKeyword !== null && hoveredKeyword !== displayIndex && !hoveredAverage

            return (
              <g key={originalIndex}>
                <path
                  d={path}
                  fill="none"
                  stroke={color.stroke}
                  strokeWidth={isHovered ? 2.5 : 1.5}
                  strokeOpacity={isDimmed ? 0.2 : isHovered ? 1 : 0.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-all duration-150"
                />
              </g>
            )
          })}

          {/* Average line (bold) */}
          <path
            d={averagePath}
            fill="none"
            stroke={AVERAGE_COLOR.stroke}
            strokeWidth={hoveredAverage ? 3.5 : 2.5}
            strokeOpacity={hoveredKeyword !== null && !hoveredAverage ? 0.3 : 1}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={hoveredAverage ? "none" : "none"}
            className="transition-all duration-150 dark:stroke-slate-200"
          />

          {/* Invisible hover areas for each line */}
          {paths.map(({ path, originalIndex }, displayIndex) => (
            <path
              key={`hover-${originalIndex}`}
              d={path}
              fill="none"
              stroke="transparent"
              strokeWidth={12}
              onMouseEnter={() => setHoveredKeyword(displayIndex)}
              onMouseLeave={() => setHoveredKeyword(null)}
              className="cursor-pointer"
            />
          ))}

          {/* Invisible hover area for average line */}
          <path
            d={averagePath}
            fill="none"
            stroke="transparent"
            strokeWidth={12}
            onMouseEnter={() => setHoveredAverage(true)}
            onMouseLeave={() => setHoveredAverage(false)}
            className="cursor-pointer"
          />
        </svg>

        {/* Tooltip */}
        {(hoveredKeyword !== null || hoveredAverage) && (
          <div className="absolute top-0 right-0 bg-background/95 backdrop-blur-sm border rounded-md px-2 py-1 text-xs shadow-sm">
            {hoveredAverage ? (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-gray-800 dark:bg-gray-200" />
                <span className="font-medium">Average</span>
                <span className={cn(
                  avgTrend === 'rising' ? 'text-emerald-600' :
                  avgTrend === 'falling' ? 'text-red-600' : 'text-slate-600'
                )}>
                  {formatPct(avgPercentChange)}
                </span>
              </div>
            ) : hoveredKeyword !== null && paths[hoveredKeyword] && (
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: LINE_COLORS[hoveredKeyword].stroke }}
                />
                <span className="font-medium truncate max-w-[150px]">
                  {keywords[paths[hoveredKeyword].originalIndex]}
                </span>
                {keywordBreakdown?.[paths[hoveredKeyword].originalIndex] && (
                  <span className={cn(
                    keywordBreakdown[paths[hoveredKeyword].originalIndex].trend === 'rising' ? 'text-emerald-600' :
                    keywordBreakdown[paths[hoveredKeyword].originalIndex].trend === 'falling' ? 'text-red-600' : 'text-slate-600'
                  )}>
                    {formatPct(keywordBreakdown[paths[hoveredKeyword].originalIndex].percentageChange)}
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend - compact inline */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-4 h-0.5 bg-gray-800 dark:bg-gray-200 rounded" />
          <span>Average</span>
        </div>
        {paths.map(({ originalIndex }, displayIndex) => (
          <div
            key={originalIndex}
            className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors"
            onMouseEnter={() => setHoveredKeyword(displayIndex)}
            onMouseLeave={() => setHoveredKeyword(null)}
          >
            <div
              className="w-4 h-0.5 rounded"
              style={{ backgroundColor: LINE_COLORS[displayIndex].stroke }}
            />
            <span className="truncate max-w-[80px]" title={keywords[originalIndex]}>{keywords[originalIndex]}</span>
          </div>
        ))}
        {filteredCount > 0 && (
          <span className="text-muted-foreground/60 italic" title="Keywords with no search volume are hidden">
            +{filteredCount} with no volume
          </span>
        )}
      </div>
    </div>
  )
}
