'use client'

import { Database, Calendar, Clock, Users, Zap } from 'lucide-react'
import { ScoreGauge } from '@/components/ui/score-gauge'
import { StatBlock } from '@/components/ui/stat-card'
import { MetricRow, StatusBadge } from '@/components/ui/metric-row'

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
            <MetricRow label="Relevance" value={relevanceRate} icon={Zap} />
          </div>

          {/* Confidence */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              Confidence
            </span>
            <StatusBadge status={dataConfidence} />
          </div>

          {/* Recency */}
          {recencyScore !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Recency
              </span>
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
