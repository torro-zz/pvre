'use client'

/**
 * MarketSignals Component
 *
 * Displays VERIFIED market data as proxies for market size.
 * This complements the AI-estimated TAM/SAM/SOM with actual data points
 * users can independently verify.
 *
 * Data sources:
 * - Community Size: Subreddit subscriber counts (from Arctic Shift API)
 * - Discussion Volume: Posts found/analyzed (from search results)
 * - Google Trends YoY: Growth rate (from Google Trends API)
 * - Engagement: Upvotes/comments (from Reddit API)
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataSourceBadge } from '@/components/ui/data-source-badge'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  MessageSquare,
  TrendingUp,
  BarChart3,
  Database,
  Filter,
  ThumbsUp,
  Info,
} from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface MarketSignalsProps {
  // Community metrics (verified from Arctic Shift)
  totalSubscribers?: number
  communitiesCount?: number
  communityNames?: string[]

  // Discussion metrics (verified from search)
  totalPostsFound?: number
  postsAnalyzed?: number
  commentsAnalyzed?: number

  // Google Trends (verified from Google API)
  googleTrendsYoY?: number | null
  googleTrendsAvailable?: boolean

  // Engagement metrics (verified from posts)
  totalUpvotes?: number
  totalComments?: number

  // Data sources used
  dataSources?: string[]
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toLocaleString()
}

export function MarketSignals({
  totalSubscribers,
  communitiesCount,
  communityNames = [],
  totalPostsFound,
  postsAnalyzed,
  commentsAnalyzed,
  googleTrendsYoY,
  googleTrendsAvailable,
  totalUpvotes,
  totalComments,
  dataSources = [],
}: MarketSignalsProps) {
  // Calculate derived metrics
  const relevanceRate = totalPostsFound && postsAnalyzed && totalPostsFound > 0
    ? Math.round((postsAnalyzed / totalPostsFound) * 100)
    : null

  // Check if we have any data to display
  const hasData = totalSubscribers || totalPostsFound || googleTrendsYoY !== undefined || totalUpvotes

  if (!hasData) {
    return null
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Database className="h-4 w-4 text-emerald-600" />
            Verified Market Signals
          </CardTitle>
          <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 text-xs">
            Real Data
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          These metrics come directly from APIs — not AI estimates
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Community Size - VERIFIED */}
          {totalSubscribers && totalSubscribers > 0 && (
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-medium text-blue-800 dark:text-blue-200">
                    Community Size
                  </span>
                </div>
                <DataSourceBadge type="verified" showLabel={false} />
              </div>
              <div className="text-xl font-bold text-blue-900 dark:text-blue-100">
                {formatNumber(totalSubscribers)}
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400">
                across {communitiesCount || communityNames.length} communities
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="mt-1.5 text-[10px] text-blue-500 dark:text-blue-400 flex items-center gap-1 cursor-help">
                    <Info className="h-2.5 w-2.5" />
                    Proxy for audience reach
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[220px]">
                  Total subscribers in the communities where your target audience discusses problems.
                  A larger community size suggests more potential customers.
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Discussion Volume - VERIFIED */}
          {totalPostsFound && totalPostsFound > 0 && (
            <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                  <span className="text-xs font-medium text-purple-800 dark:text-purple-200">
                    Discussion Volume
                  </span>
                </div>
                <DataSourceBadge type="verified" showLabel={false} />
              </div>
              <div className="text-xl font-bold text-purple-900 dark:text-purple-100">
                {formatNumber(totalPostsFound)}
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400 cursor-help">
                    <Filter className="h-2.5 w-2.5" />
                    {postsAnalyzed?.toLocaleString() || '—'} matched
                    {relevanceRate !== null && (
                      <span className="text-purple-500 dark:text-purple-400">
                        ({relevanceRate}%)
                      </span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[280px]">
                  <div className="space-y-1.5">
                    <p className="font-medium">Match Rate: {relevanceRate}%</p>
                    <p className="text-xs opacity-90">
                      Percentage of posts that passed relevance filtering for your hypothesis.
                    </p>
                    <div className="text-xs opacity-75 pt-1 border-t border-white/20">
                      {relevanceRate !== null && relevanceRate < 5 && "Low — many posts were off-topic"}
                      {relevanceRate !== null && relevanceRate >= 5 && relevanceRate < 15 && "Moderate — some signal in noise"}
                      {relevanceRate !== null && relevanceRate >= 15 && relevanceRate < 30 && "Good — strong problem awareness"}
                      {relevanceRate !== null && relevanceRate >= 30 && "Excellent — highly focused discussions"}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="mt-1.5 text-[10px] text-purple-500 dark:text-purple-400 flex items-center gap-1 cursor-help">
                    <Info className="h-2.5 w-2.5" />
                    Proxy for problem awareness
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[220px]">
                  Posts found in these communities that match your domain.
                  Higher volume suggests the problem is actively discussed.
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Google Trends YoY - VERIFIED */}
          {googleTrendsAvailable && googleTrendsYoY !== undefined && googleTrendsYoY !== null && (
            <div className={cn(
              "p-3 rounded-lg border",
              googleTrendsYoY > 0
                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                : googleTrendsYoY < 0
                ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                : "bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800"
            )}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className={cn(
                    "h-3.5 w-3.5",
                    googleTrendsYoY > 0 ? "text-emerald-600 dark:text-emerald-400" :
                    googleTrendsYoY < 0 ? "text-red-600 dark:text-red-400" :
                    "text-slate-600 dark:text-slate-400"
                  )} />
                  <span className={cn(
                    "text-xs font-medium",
                    googleTrendsYoY > 0 ? "text-emerald-800 dark:text-emerald-200" :
                    googleTrendsYoY < 0 ? "text-red-800 dark:text-red-200" :
                    "text-slate-800 dark:text-slate-200"
                  )}>
                    Search Trend
                  </span>
                </div>
                <DataSourceBadge type="verified" showLabel={false} />
              </div>
              <div className={cn(
                "text-xl font-bold",
                googleTrendsYoY > 0 ? "text-emerald-900 dark:text-emerald-100" :
                googleTrendsYoY < 0 ? "text-red-900 dark:text-red-100" :
                "text-slate-900 dark:text-slate-100"
              )}>
                {googleTrendsYoY > 0 ? '+' : ''}{googleTrendsYoY}%
              </div>
              <div className={cn(
                "text-xs",
                googleTrendsYoY > 0 ? "text-emerald-600 dark:text-emerald-400" :
                googleTrendsYoY < 0 ? "text-red-600 dark:text-red-400" :
                "text-slate-600 dark:text-slate-400"
              )}>
                year over year (Google Trends)
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "mt-1.5 text-[10px] flex items-center gap-1 cursor-help",
                    googleTrendsYoY > 0 ? "text-emerald-500 dark:text-emerald-400" :
                    googleTrendsYoY < 0 ? "text-red-500 dark:text-red-400" :
                    "text-slate-500 dark:text-slate-400"
                  )}>
                    <Info className="h-2.5 w-2.5" />
                    Proxy for market momentum
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[220px]">
                  Search interest trend from Google Trends.
                  Rising trends suggest growing market demand.
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Engagement - VERIFIED */}
          {(totalUpvotes || totalComments) && (totalUpvotes! > 0 || totalComments! > 0) && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <ThumbsUp className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-medium text-amber-800 dark:text-amber-200">
                    Engagement
                  </span>
                </div>
                <DataSourceBadge type="verified" showLabel={false} />
              </div>
              <div className="text-xl font-bold text-amber-900 dark:text-amber-100">
                {formatNumber((totalUpvotes || 0) + (totalComments || 0))}
              </div>
              <div className="text-xs text-amber-600 dark:text-amber-400">
                {totalUpvotes ? `${formatNumber(totalUpvotes)} upvotes` : ''}
                {totalUpvotes && totalComments ? ' · ' : ''}
                {totalComments ? `${formatNumber(totalComments)} comments` : ''}
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="mt-1.5 text-[10px] text-amber-500 dark:text-amber-400 flex items-center gap-1 cursor-help">
                    <Info className="h-2.5 w-2.5" />
                    Proxy for interest level
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[220px]">
                  Total engagement on analyzed posts.
                  Higher engagement suggests people actively care about this problem.
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        {/* Data sources footer */}
        {dataSources.length > 0 && (
          <div className="mt-4 pt-3 border-t flex items-center gap-2 text-xs text-muted-foreground">
            <Database className="h-3 w-3" />
            <span>Data from: {dataSources.join(', ')}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
