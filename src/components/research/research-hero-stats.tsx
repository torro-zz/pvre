'use client'

import { Database, Calendar, Clock, Users, Info, DollarSign } from 'lucide-react'
import { ScoreGauge } from '@/components/ui/score-gauge'
import { StatBlock } from '@/components/ui/stat-card'
import { StatusBadge } from '@/components/ui/metric-row'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { TrustBadge } from '@/components/ui/trust-badge'

interface ResearchHeroStatsProps {
  painScore: number
  painScoreConfidence: 'very_low' | 'low' | 'medium' | 'high'
  totalSignals: number
  coreSignals?: number
  wtpCount?: number
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
  wtpCount = 0,
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

  // Determine WTP strength for visual indicator
  const getWtpStrength = (count: number): 'none' | 'weak' | 'moderate' | 'strong' => {
    if (count === 0) return 'none'
    if (count <= 3) return 'weak'
    if (count <= 8) return 'moderate'
    return 'strong'
  }
  const wtpStrength = getWtpStrength(wtpCount)

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
            {/* WTP - Most important signal, shown first */}
            <div className="relative">
              <StatBlock
                label="WTP Signals"
                value={wtpCount}
                subValue={wtpStrength === 'none' ? 'No payment intent' : wtpStrength === 'weak' ? 'Weak' : wtpStrength === 'moderate' ? 'Moderate' : 'Strong'}
                accent={wtpCount > 0}
              />
              {wtpCount === 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center cursor-help">
                      <span className="text-[10px] text-white font-bold">!</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[200px]">
                    No one mentioned paying for a solution. This is a critical validation gap.
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <StatBlock
              label="Signals"
              value={totalSignals}
              subValue={coreSignals !== undefined ? `${coreSignals} core` : undefined}
            />
            <StatBlock
              label="Posts Scanned"
              value={postsAnalyzed}
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
