'use client'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { ExternalLink, MessageSquare, ArrowUp, Calendar, Flame } from 'lucide-react'
import { PainSignal } from '@/lib/analysis/pain-detector'
import { cn } from '@/lib/utils'

// Format large numbers compactly (1234 -> "1.2K")
function formatNumber(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
  }
  return num.toString()
}

// Check if engagement qualifies as "Community Validated"
function isCommunityValidated(upvotes?: number, numComments?: number): boolean {
  return (upvotes !== undefined && upvotes >= 100) ||
         (numComments !== undefined && numComments >= 50)
}

interface PainScoreCardProps {
  signal: PainSignal
}

// Detect source type from subreddit name
function getSourceType(subreddit: string): 'reddit' | 'hackernews' | 'google_play' | 'app_store' | 'trustpilot' {
  const lower = subreddit.toLowerCase()
  if (lower === 'hackernews' || lower === 'askhn' || lower === 'showhn') return 'hackernews'
  if (lower === 'google_play') return 'google_play'
  if (lower === 'app_store') return 'app_store'
  if (lower === 'trustpilot') return 'trustpilot'
  return 'reddit'
}

// Format source display name
function formatSourceName(subreddit: string): string {
  const sourceType = getSourceType(subreddit)
  if (sourceType === 'hackernews') {
    if (subreddit.toLowerCase() === 'askhn') return 'Ask HN'
    if (subreddit.toLowerCase() === 'showhn') return 'Show HN'
    return 'Hacker News'
  }
  if (sourceType === 'google_play') return 'Google Play'
  if (sourceType === 'app_store') return 'App Store'
  if (sourceType === 'trustpilot') return 'Trustpilot'
  return `r/${subreddit}`
}

// Get source link text
function getSourceLinkText(subreddit: string): string {
  const sourceType = getSourceType(subreddit)
  if (sourceType === 'hackernews') return 'View on HN'
  if (sourceType === 'google_play') return 'View on Play Store'
  if (sourceType === 'app_store') return 'View on App Store'
  if (sourceType === 'trustpilot') return 'View on Trustpilot'
  return 'View on Reddit'
}

// Get source badge styling
function getSourceBadgeClass(subreddit: string): string {
  const sourceType = getSourceType(subreddit)
  if (sourceType === 'hackernews') return 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950/50 dark:text-orange-400 dark:border-orange-800'
  if (sourceType === 'google_play') return 'bg-green-100 text-green-700 border-green-300 dark:bg-green-950/50 dark:text-green-400 dark:border-green-800'
  if (sourceType === 'app_store') return 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800'
  if (sourceType === 'trustpilot') return 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800'
  return ''
}

function getScoreColor(score: number): string {
  if (score >= 7) return 'bg-red-500'
  if (score >= 4) return 'bg-yellow-500'
  return 'bg-green-500'
}

function getScoreBadgeVariant(
  score: number
): 'destructive' | 'default' | 'secondary' {
  if (score >= 7) return 'destructive'
  if (score >= 4) return 'default'
  return 'secondary'
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

export function PainScoreCard({ signal }: PainScoreCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-2">
            <Badge variant={getScoreBadgeVariant(signal.score)}>
              Score: {Math.round(signal.score * 10) / 10}
            </Badge>
            <Badge variant="outline" className={cn("text-xs", getSourceBadgeClass(signal.source.subreddit))}>
              {formatSourceName(signal.source.subreddit)}
            </Badge>
            {signal.solutionSeeking && (
              <Badge variant="secondary" className="text-xs">
                Seeking Solution
              </Badge>
            )}
            {signal.willingnessToPaySignal && (
              <Badge className="text-xs bg-green-600">
                WTP Signal
              </Badge>
            )}
          </div>
          <div
            className={`w-3 h-3 rounded-full ${getScoreColor(signal.score)}`}
            title={`Pain intensity: ${signal.intensity}`}
          />
        </div>

        {signal.title && (
          <h4 className="font-medium mb-2 text-sm">
            {truncateText(signal.title, 100)}
          </h4>
        )}

        <p className="text-sm text-muted-foreground mb-3">
          {truncateText(signal.text, 300)}
        </p>

        {signal.signals.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {signal.signals.slice(0, 5).map((s) => (
              <span
                key={s}
                className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
              >
                {s}
              </span>
            ))}
            {signal.signals.length > 5 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                +{signal.signals.length - 5} more
              </span>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          {/* Upvotes - show actual count if available */}
          {signal.source.upvotes !== undefined && signal.source.upvotes > 0 && (
            <span className="flex items-center gap-1">
              <ArrowUp className="h-3 w-3" />
              {formatNumber(signal.source.upvotes)}
            </span>
          )}
          {/* Comments - show actual count if available */}
          {signal.source.numComments !== undefined && signal.source.numComments > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {formatNumber(signal.source.numComments)}
            </span>
          )}
          {/* Date */}
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(signal.source.createdUtc)}
          </span>
          {/* Hot badge for community-validated signals */}
          {isCommunityValidated(signal.source.upvotes, signal.source.numComments) && (
            <Badge variant="outline" className="h-5 text-[10px] bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800">
              <Flame className="h-2.5 w-2.5 mr-0.5" />
              Hot
            </Badge>
          )}
        </div>
        <a
          href={signal.source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          {getSourceLinkText(signal.source.subreddit)}
          <ExternalLink className="h-3 w-3" />
        </a>
      </CardFooter>
    </Card>
  )
}

// Compact version for lists
export function PainScoreCardCompact({ signal }: PainScoreCardProps) {
  return (
    <div className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={getScoreBadgeVariant(signal.score)} className="text-xs">
            {Math.round(signal.score * 10) / 10}
          </Badge>
          <span className={cn("text-xs",
            getSourceType(signal.source.subreddit) === 'hackernews' ? 'text-orange-600 dark:text-orange-400' :
            getSourceType(signal.source.subreddit) === 'trustpilot' ? 'text-emerald-600 dark:text-emerald-400' :
            'text-muted-foreground')}>
            {formatSourceName(signal.source.subreddit)}
          </span>
        </div>
        <a
          href={signal.source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <p className="text-sm">
        {truncateText(signal.title || signal.text, 150)}
      </p>
      <div className="flex flex-wrap gap-1 mt-2">
        {signal.signals.slice(0, 3).map((s) => (
          <span
            key={s}
            className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
          >
            {s}
          </span>
        ))}
      </div>
    </div>
  )
}
