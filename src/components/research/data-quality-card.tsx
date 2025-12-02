'use client'

import { Info, Filter, CheckCircle, AlertTriangle } from 'lucide-react'

interface DataQualityCardProps {
  postsFound: number
  postsAnalyzed: number
  postsFiltered: number
  postFilterRate: number
  commentsFound: number
  commentsAnalyzed: number
  commentsFiltered: number
  commentFilterRate: number
  qualityLevel: 'high' | 'medium' | 'low'
}

export function DataQualityCard({
  postsFound,
  postsAnalyzed,
  postsFiltered,
  postFilterRate,
  commentsFound,
  commentsAnalyzed,
  commentsFiltered,
  commentFilterRate,
  qualityLevel,
}: DataQualityCardProps) {
  const totalFound = postsFound + commentsFound
  const totalAnalyzed = postsAnalyzed + commentsAnalyzed
  const totalFiltered = postsFiltered + commentsFiltered
  const avgFilterRate = totalFound > 0 ? (totalFiltered / totalFound) * 100 : 0

  const qualityConfig = {
    high: {
      label: 'High Relevance',
      color: 'text-green-400',
      bg: 'bg-green-500/10',
      border: 'border-green-500/20',
      icon: CheckCircle,
      message: 'Most content found was directly relevant to your hypothesis.',
    },
    medium: {
      label: 'Medium Relevance',
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/20',
      icon: Info,
      message: 'Some content was filtered as off-topic. Results based on relevant posts only.',
    },
    low: {
      label: 'Limited Relevance',
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/20',
      icon: AlertTriangle,
      message: 'Many posts were off-topic. Consider refining your hypothesis for more targeted results.',
    },
  }

  const config = qualityConfig[qualityLevel]
  const Icon = config.icon

  return (
    <div className={`p-4 rounded-xl border ${config.bg} ${config.border}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${config.color}`} />
        <span className={`text-sm font-medium ${config.color}`}>
          Data Quality: {config.label}
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 mb-3">
        <div>
          <p className="text-2xl font-semibold text-foreground">{totalFound}</p>
          <p className="text-xs text-muted-foreground">Content found</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-foreground">{totalAnalyzed}</p>
          <p className="text-xs text-muted-foreground">Relevant</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-muted-foreground">{totalFiltered}</p>
          <p className="text-xs text-muted-foreground">Filtered out</p>
        </div>
      </div>

      {/* Filter Rate Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted-foreground">Relevance rate</span>
          <span className={config.color}>{(100 - avgFilterRate).toFixed(0)}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full ${qualityLevel === 'high' ? 'bg-green-500' : qualityLevel === 'medium' ? 'bg-yellow-500' : 'bg-orange-500'}`}
            style={{ width: `${100 - avgFilterRate}%` }}
          />
        </div>
      </div>

      {/* Breakdown */}
      <div className="flex gap-4 text-xs text-muted-foreground mb-3">
        <span>Posts: {postsAnalyzed}/{postsFound}</span>
        <span>Comments: {commentsAnalyzed}/{commentsFound}</span>
      </div>

      {/* Message */}
      <p className="text-xs text-muted-foreground">
        {config.message}
      </p>

      {/* Explanation */}
      <details className="mt-3">
        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
          Why were posts filtered?
        </summary>
        <p className="mt-2 text-xs text-muted-foreground pl-2 border-l border-border">
          We use AI to check if each post actually discusses problems related to
          your hypothesis. Posts about unrelated topics (even if they contain
          pain language like &quot;frustrated&quot; or &quot;struggling&quot;) are excluded to ensure
          your score reflects real, relevant pain signals.
        </p>
      </details>
    </div>
  )
}
