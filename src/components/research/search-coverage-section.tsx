'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  MessageSquare,
  Smartphone,
  Globe,
  Database,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SourceCoverageData } from '@/lib/utils/coverage-helpers'

interface SearchCoverageSectionProps {
  sources: SourceCoverageData[]
  totalAnalyzed: number
  className?: string
}

// Icon mapping for data sources
const sourceIcons: Record<SourceCoverageData['iconType'], React.ElementType> = {
  reddit: MessageSquare,
  google_play: Smartphone,
  app_store: Smartphone,
  hacker_news: Globe,
  g2: Database,
  capterra: Database,
  default: FileText,
}

export function SearchCoverageSection({
  sources,
  totalAnalyzed,
  className,
}: SearchCoverageSectionProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const totalSignals = sources.reduce((sum, s) => sum + s.signals, 0)

  // Compact summary for collapsed state
  const sourceNames = sources.map(s => s.name).join(' · ')

  return (
    <div className={cn('border rounded-lg bg-card', className)}>
      {/* Compact header - always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-muted/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3 text-sm">
          <span className="font-medium text-muted-foreground">Sources Covered:</span>
          <span className="text-foreground">{sourceNames}</span>
          <Badge variant="secondary" className="font-mono text-xs">
            {totalSignals} signals
          </Badge>
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </button>

      {/* Expandable details */}
      {isExpanded && (
        <div className="border-t px-4 py-3">
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-1.5 font-medium text-xs">Source</th>
                  <th className="text-left px-3 py-1.5 font-medium text-xs">Scope</th>
                  <th className="text-left px-3 py-1.5 font-medium text-xs">Volume</th>
                  <th className="text-right px-3 py-1.5 font-medium text-xs">Signals</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sources.map((source, i) => {
                  const Icon = sourceIcons[source.iconType]
                  return (
                    <tr key={i} className="hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs">{source.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground text-xs">
                        {source.scope}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground text-xs">
                        {source.volume}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <Badge variant="secondary" className="font-mono text-xs">
                          {source.signals}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Summary row */}
          <div className="flex items-center justify-between px-1 mt-2 text-xs text-muted-foreground">
            <span>
              Total: <span className="font-medium text-foreground">{totalAnalyzed.toLocaleString()}</span> items analyzed
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// Simplified version for inline display (no card wrapper)
export function SearchCoverageInline({
  filteringMetrics,
  totalSignals,
  className,
}: {
  filteringMetrics: {
    postsFound?: number
    postsAnalyzed?: number
    coreSignals?: number
    communitiesSearched?: string[]
  }
  totalSignals: number
  className?: string
}) {
  const communityCount = filteringMetrics.communitiesSearched?.length || 0
  const postsFound = filteringMetrics.postsFound || 0
  const postsAnalyzed = filteringMetrics.postsAnalyzed || 0

  return (
    <div className={cn('flex items-center gap-4 text-sm text-muted-foreground', className)}>
      <div className="flex items-center gap-1.5">
        <MessageSquare className="w-3.5 h-3.5" />
        <span>Reddit: {communityCount} communities</span>
      </div>
      <div className="h-4 w-px bg-border" />
      <span>{postsFound.toLocaleString()} posts found</span>
      <div className="h-4 w-px bg-border" />
      <span>{postsAnalyzed.toLocaleString()} analyzed</span>
      <div className="h-4 w-px bg-border" />
      <span className="font-medium text-foreground">{totalSignals} signals</span>
    </div>
  )
}
