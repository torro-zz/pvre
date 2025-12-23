'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  MessageSquare,
  Smartphone,
  Globe,
  Database,
  FileText,
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
  const totalSignals = sources.reduce((sum, s) => sum + s.signals, 0)

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Search className="w-4 h-4 text-primary" />
          What We Searched
        </CardTitle>
        <CardDescription>
          Transparency about data sources and coverage
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Source table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Source</th>
                  <th className="text-left px-3 py-2 font-medium">Scope</th>
                  <th className="text-left px-3 py-2 font-medium">Volume</th>
                  <th className="text-right px-3 py-2 font-medium">Signals</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sources.map((source, i) => {
                  const Icon = sourceIcons[source.iconType]
                  return (
                    <tr key={i} className="hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          <span>{source.name}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {source.scope}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {source.volume}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Badge variant="secondary" className="font-mono">
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
          <div className="flex items-center justify-between px-1 text-sm">
            <span className="text-muted-foreground">
              Total: <span className="font-medium text-foreground">{totalAnalyzed.toLocaleString()}</span> items analyzed across{' '}
              <span className="font-medium text-foreground">{sources.length}</span>{' '}
              {sources.length === 1 ? 'source' : 'sources'}
            </span>
            <Badge variant="outline" className="font-mono">
              {totalSignals} signals detected
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
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
