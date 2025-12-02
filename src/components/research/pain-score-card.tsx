'use client'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { ExternalLink, MessageCircle, ThumbsUp, Calendar } from 'lucide-react'
import { PainSignal } from '@/lib/analysis/pain-detector'

interface PainScoreCardProps {
  signal: PainSignal
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
              Score: {signal.score}
            </Badge>
            <Badge variant="outline" className="text-xs">
              r/{signal.source.subreddit}
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
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3" />
            {signal.source.engagementScore.toFixed(1)}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDate(signal.source.createdUtc)}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="h-3 w-3" />
            {signal.source.type}
          </span>
        </div>
        <a
          href={signal.source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          View on Reddit
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
            {signal.score}
          </Badge>
          <span className="text-xs text-muted-foreground">
            r/{signal.source.subreddit}
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
