'use client'

import { Info, Calendar, Database, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ResearchMetadataProps {
  postsAnalyzed: number
  commentsAnalyzed?: number
  subredditsSearched: string[]
  dateRange?: {
    oldest: string
    newest: string
  }
  dataConfidence: 'high' | 'medium' | 'low' | 'very_low'
  temporalDistribution?: {
    last30Days: number
    last90Days: number
    last180Days: number
    older: number
  }
  recencyScore?: number
  dataSource?: string
  isStale?: boolean
  warning?: string
}

const confidenceConfig = {
  high: {
    color: 'text-green-500',
    bg: 'bg-green-500/20',
    label: 'HIGH',
  },
  medium: {
    color: 'text-blue-500',
    bg: 'bg-blue-500/20',
    label: 'MEDIUM',
  },
  low: {
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/20',
    label: 'LOW',
  },
  very_low: {
    color: 'text-red-500',
    bg: 'bg-red-500/20',
    label: 'VERY LOW',
  },
}

export function ResearchMetadata({
  postsAnalyzed,
  commentsAnalyzed,
  subredditsSearched,
  dateRange,
  dataConfidence,
  temporalDistribution,
  recencyScore,
  dataSource,
  isStale,
  warning,
}: ResearchMetadataProps) {
  const config = confidenceConfig[dataConfidence]

  // Calculate temporal breakdown percentages
  const totalTemporal = temporalDistribution
    ? temporalDistribution.last30Days +
      temporalDistribution.last90Days +
      temporalDistribution.last180Days +
      temporalDistribution.older
    : 0

  const getTemporalPercent = (count: number) =>
    totalTemporal > 0 ? Math.round((count / totalTemporal) * 100) : 0

  return (
    <div className="p-4 bg-muted/30 border rounded-lg text-sm">
      <div className="flex items-center gap-2 mb-3">
        <Info className="w-4 h-4 text-muted-foreground" />
        <h4 className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
          About This Research
        </h4>
      </div>

      {/* Warning banner if present */}
      {warning && (
        <div className="mb-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-yellow-600 dark:text-yellow-400 text-xs">
          {warning}
        </div>
      )}

      {/* Stale data indicator */}
      {isStale && (
        <div className="mb-3 p-2 bg-orange-500/10 border border-orange-500/20 rounded text-orange-600 dark:text-orange-400 text-xs">
          Using cached data. Live sources temporarily unavailable.
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Data Source */}
        <div>
          <p className="text-muted-foreground text-xs">Data source</p>
          <p className="font-medium flex items-center gap-1">
            <Database className="w-3 h-3" />
            {dataSource || 'Reddit discussions'}
          </p>
        </div>

        {/* Posts Analyzed */}
        <div>
          <p className="text-muted-foreground text-xs">Content analyzed</p>
          <p className="font-medium">
            {postsAnalyzed.toLocaleString()} posts
            {commentsAnalyzed ? `, ${commentsAnalyzed.toLocaleString()} comments` : ''}
          </p>
        </div>

        {/* Communities */}
        <div>
          <p className="text-muted-foreground text-xs">Communities</p>
          <p className="font-medium">
            {subredditsSearched.slice(0, 3).map(s => `r/${s}`).join(', ')}
            {subredditsSearched.length > 3 && ` +${subredditsSearched.length - 3} more`}
          </p>
        </div>

        {/* Date Range */}
        {dateRange && (
          <div>
            <p className="text-muted-foreground text-xs">Date range</p>
            <p className="font-medium flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {dateRange.oldest} - {dateRange.newest}
            </p>
          </div>
        )}
      </div>

      {/* Temporal Distribution */}
      {temporalDistribution && totalTemporal > 0 && (
        <div className="mb-4">
          <p className="text-muted-foreground text-xs mb-2 flex items-center gap-1">
            <BarChart3 className="w-3 h-3" />
            Data freshness
          </p>
          <div className="flex h-2 rounded-full overflow-hidden bg-muted">
            {temporalDistribution.last30Days > 0 && (
              <div
                className="bg-green-500"
                style={{ width: `${getTemporalPercent(temporalDistribution.last30Days)}%` }}
                title={`Last 30 days: ${temporalDistribution.last30Days} posts`}
              />
            )}
            {temporalDistribution.last90Days > 0 && (
              <div
                className="bg-blue-500"
                style={{ width: `${getTemporalPercent(temporalDistribution.last90Days)}%` }}
                title={`30-90 days: ${temporalDistribution.last90Days} posts`}
              />
            )}
            {temporalDistribution.last180Days > 0 && (
              <div
                className="bg-yellow-500"
                style={{ width: `${getTemporalPercent(temporalDistribution.last180Days)}%` }}
                title={`90-180 days: ${temporalDistribution.last180Days} posts`}
              />
            )}
            {temporalDistribution.older > 0 && (
              <div
                className="bg-zinc-500"
                style={{ width: `${getTemporalPercent(temporalDistribution.older)}%` }}
                title={`Older: ${temporalDistribution.older} posts`}
              />
            )}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              0-30d
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              30-90d
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              90-180d
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-zinc-500" />
              180d+
            </span>
          </div>
        </div>
      )}

      {/* Data Confidence */}
      <div className="pt-3 border-t">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs">Data confidence</span>
          <span
            className={cn(
              'px-2 py-0.5 rounded text-xs font-medium',
              config.bg,
              config.color
            )}
          >
            {config.label}
          </span>
        </div>

        {recencyScore !== undefined && (
          <div className="flex items-center justify-between mt-2">
            <span className="text-muted-foreground text-xs">Recency score</span>
            <span className="text-xs font-medium">
              {Math.round(recencyScore * 100)}%
            </span>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-3">
          This is directional research based on public discussions.
          Validate findings with real customer interviews.
        </p>
      </div>
    </div>
  )
}
