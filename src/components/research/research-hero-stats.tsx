'use client'

import { Database, Calendar, Clock, Users, Zap, Info } from 'lucide-react'
import { ScoreGauge } from '@/components/ui/score-gauge'
import { StatBlock } from '@/components/ui/stat-card'
import { MetricRow, StatusBadge } from '@/components/ui/metric-row'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

interface ResearchHeroStatsProps {
  painScore: number
  painScoreConfidence: 'very_low' | 'low' | 'medium' | 'high'
  totalSignals: number
  coreSignals?: number
  relevanceRate: number
  dataConfidence: 'very_low' | 'low' | 'medium' | 'high'
  recencyScore?: number
  dataSources?: string[]
  communitiesCount: number
  communityNames?: string[]
  dateRange?: { oldest: string; newest: string }
  postsAnalyzed: number
  totalPostsFound: number
  commentsAnalyzed?: number
  processingTimeMs?: number
}

export function ResearchHeroStats({
  painScore,
  painScoreConfidence,
  totalSignals,
  coreSignals,
  relevanceRate,
  dataConfidence,
  recencyScore,
  dataSources = [],
  communitiesCount,
  communityNames = [],
  dateRange,
  postsAnalyzed,
  totalPostsFound,
  commentsAnalyzed,
  processingTimeMs,
}: ResearchHeroStatsProps) {

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Main content */}
      <div className="p-6">
        <div className="flex items-center gap-8">
          {/* Left: Score gauge */}
          <div className="flex-shrink-0">
            <ScoreGauge score={painScore} label="Pain Score" />
          </div>

          {/* Divider */}
          <div className="w-px h-24 bg-border" />

          {/* Right: Key stats */}
          <div className="flex-1 flex items-center justify-around">
            <StatBlock
              label="Signals"
              value={totalSignals}
              subValue={coreSignals !== undefined ? `${coreSignals} core` : undefined}
              accent
            />
            <StatBlock
              label="Analyzed"
              value={postsAnalyzed}
              subValue={`of ${totalPostsFound.toLocaleString()}`}
            />
            {commentsAnalyzed !== undefined && commentsAnalyzed > 0 && (
              <StatBlock
                label="Comments"
                value={commentsAnalyzed}
              />
            )}
          </div>
        </div>

        {/* Quality metrics row */}
        <div className="mt-6 pt-5 border-t flex flex-wrap items-center gap-6">
          {/* Relevance */}
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-1.5">
              <MetricRow label="Relevance" value={relevanceRate} icon={Zap} />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  Percentage of posts that directly relate to your hypothesis. Higher = more focused data.
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Confidence */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Confidence
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-3 h-3 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[220px]">
                  Based on signal count. Very Low (&lt;10), Low (10-30), Medium (30-100), High (100+).
                </TooltipContent>
              </Tooltip>
            </div>
            <StatusBadge status={dataConfidence} />
          </div>

          {/* Recency */}
          {recencyScore !== undefined && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  Recency
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3 h-3 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[180px]">
                    How recent the data is. 100% = all from the last 30 days.
                  </TooltipContent>
                </Tooltip>
              </div>
              <span className="text-sm font-semibold text-foreground">
                {Math.round(recencyScore * 100)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-muted/30 border-t flex flex-wrap items-center gap-5 text-xs text-muted-foreground">
        {dataSources.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5" />
            <span>{dataSources.join(' · ')}</span>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          <span>{communitiesCount} communities</span>
        </div>

        {dateRange && (
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>{dateRange.oldest} → {dateRange.newest}</span>
          </div>
        )}

        {processingTimeMs !== undefined && (
          <div className="flex items-center gap-1.5 ml-auto">
            <Clock className="w-3.5 h-3.5" />
            <span>{(processingTimeMs / 1000).toFixed(1)}s</span>
          </div>
        )}
      </div>
    </div>
  )
}
