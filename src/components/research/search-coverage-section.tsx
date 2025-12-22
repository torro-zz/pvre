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

interface SourceCoverage {
  name: string
  icon: React.ElementType
  scope: string  // e.g., "8 communities", "5 apps"
  volume: string  // e.g., "692 posts", "250 reviews"
  signals: number
}

interface SearchCoverageSectionProps {
  sources: SourceCoverage[]
  totalAnalyzed: number
  className?: string
}

// Icon mapping for data sources
const sourceIcons: Record<string, React.ElementType> = {
  reddit: MessageSquare,
  'google_play': Smartphone,
  'app_store': Smartphone,
  'hacker_news': Globe,
  'g2': Database,
  'capterra': Database,
  default: FileText,
}

// Helper to create coverage data from filtering metrics
export function createSourceCoverage(
  filteringMetrics: {
    postsFound?: number
    postsAnalyzed?: number
    coreSignals?: number
    relatedSignals?: number
    communitiesSearched?: string[]
    sources?: string[]
  },
  totalSignals: number
): SourceCoverage[] {
  const sources: SourceCoverage[] = []

  // Reddit is always included if we have posts
  if (filteringMetrics.postsAnalyzed && filteringMetrics.postsAnalyzed > 0) {
    const communityCount = filteringMetrics.communitiesSearched?.length || 0
    sources.push({
      name: 'Reddit',
      icon: MessageSquare,
      scope: `${communityCount} ${communityCount === 1 ? 'community' : 'communities'}`,
      volume: `${filteringMetrics.postsFound || filteringMetrics.postsAnalyzed} posts`,
      signals: filteringMetrics.coreSignals || 0,
    })
  }

  // Add other sources if available
  if (filteringMetrics.sources) {
    for (const source of filteringMetrics.sources) {
      if (source !== 'reddit' && source !== 'Reddit') {
        sources.push({
          name: formatSourceName(source),
          icon: sourceIcons[source.toLowerCase()] || sourceIcons.default,
          scope: '—',
          volume: '—',
          signals: 0,  // Would need per-source breakdown
        })
      }
    }
  }

  return sources
}

function formatSourceName(source: string): string {
  const names: Record<string, string> = {
    reddit: 'Reddit',
    google_play: 'Google Play',
    app_store: 'App Store',
    hacker_news: 'Hacker News',
    g2: 'G2 Reviews',
    capterra: 'Capterra',
  }
  return names[source.toLowerCase()] || source
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
                  const Icon = source.icon
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
