'use client'

import { cn } from '@/lib/utils'
import { Quote, DollarSign, TrendingUp, ExternalLink } from 'lucide-react'
import { TrustBadge, TrustLevel } from './trust-badge'
import { Badge } from './badge'

export interface QuoteData {
  quote: string
  source: string
  painScore?: number
  relevanceScore?: number
  isWtp?: boolean
  url?: string
  timestamp?: string
}

interface QuoteCardProps {
  data: QuoteData
  trustLevel?: TrustLevel
  variant?: 'default' | 'compact' | 'featured'
  showRelevance?: boolean
  className?: string
}

function getPainLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 7) return 'high'
  if (score >= 4) return 'medium'
  return 'low'
}

const painColors = {
  high: 'border-l-red-500',
  medium: 'border-l-amber-500',
  low: 'border-l-slate-400',
}

const painBadgeColors = {
  high: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400',
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
}

export function QuoteCard({
  data,
  trustLevel = 'verified',
  variant = 'default',
  showRelevance = false,
  className,
}: QuoteCardProps) {
  const painLevel = data.painScore !== undefined ? getPainLevel(data.painScore) : null

  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'flex items-start gap-2 p-3 rounded-lg bg-muted/30 border-l-3',
          painLevel ? painColors[painLevel] : 'border-l-muted',
          className
        )}
      >
        <Quote className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm italic leading-relaxed line-clamp-2">"{data.quote}"</p>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span>r/{data.source.replace(/^r\//, '')}</span>
            {data.isWtp && (
              <Badge variant="outline" className="h-5 text-[10px] bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">
                <DollarSign className="h-2.5 w-2.5 mr-0.5" />
                WTP
              </Badge>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'featured') {
    return (
      <div
        className={cn(
          'relative p-5 rounded-xl border-2 bg-gradient-to-br from-card to-muted/20',
          painLevel === 'high' ? 'border-red-200 dark:border-red-900/50' : 'border-border',
          className
        )}
      >
        {/* Top badges row */}
        <div className="flex items-center justify-between mb-3">
          <TrustBadge level={trustLevel} size="sm" />
          <div className="flex items-center gap-2">
            {data.isWtp && (
              <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-400 dark:border-green-800">
                <DollarSign className="h-3 w-3 mr-1" />
                Payment Intent
              </Badge>
            )}
            {painLevel && data.painScore !== undefined && (
              <Badge variant="outline" className={painBadgeColors[painLevel]}>
                Pain: {data.painScore.toFixed(1)}
              </Badge>
            )}
          </div>
        </div>

        {/* Quote with large quote mark */}
        <div className="relative pl-8">
          <Quote className="absolute left-0 top-0 h-6 w-6 text-primary/30" />
          <p className="text-lg leading-relaxed font-medium">"{data.quote}"</p>
        </div>

        {/* Source and metadata */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">r/{data.source.replace(/^r\//, '')}</span>
            {data.timestamp && <span>{data.timestamp}</span>}
          </div>
          {data.url && (
            <a
              href={data.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
            >
              View original
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        {/* Relevance indicator */}
        {showRelevance && data.relevanceScore !== undefined && (
          <div className="absolute -top-2 -right-2">
            <div
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                data.relevanceScore >= 7
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                  : data.relevanceScore >= 4
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              )}
            >
              <TrendingUp className="h-3 w-3" />
              {data.relevanceScore.toFixed(0)}/10
            </div>
          </div>
        )}
      </div>
    )
  }

  // Default variant
  return (
    <div
      className={cn(
        'p-4 rounded-lg border bg-card border-l-4',
        painLevel ? painColors[painLevel] : 'border-l-muted',
        className
      )}
    >
      {/* Header with source and badges */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">r/{data.source.replace(/^r\//, '')}</span>
          <TrustBadge level={trustLevel} size="sm" />
        </div>
        <div className="flex items-center gap-2">
          {data.isWtp && (
            <Badge variant="outline" className="h-5 text-[10px] bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800">
              <DollarSign className="h-2.5 w-2.5 mr-0.5" />
              WTP
            </Badge>
          )}
          {painLevel && data.painScore !== undefined && (
            <Badge variant="outline" className={cn('h-5 text-[10px]', painBadgeColors[painLevel])}>
              {data.painScore.toFixed(1)}
            </Badge>
          )}
        </div>
      </div>

      {/* Quote */}
      <div className="flex items-start gap-2">
        <Quote className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
        <p className="text-sm italic leading-relaxed">"{data.quote}"</p>
      </div>

      {/* Footer with timestamp and link */}
      {(data.timestamp || data.url) && (
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          {data.timestamp && <span>{data.timestamp}</span>}
          {data.url && (
            <a
              href={data.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary flex items-center gap-1"
            >
              Source
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
    </div>
  )
}

// List component for multiple quotes
interface QuoteListProps {
  quotes: QuoteData[]
  trustLevel?: TrustLevel
  variant?: 'default' | 'compact' | 'featured'
  showRelevance?: boolean
  maxQuotes?: number
  className?: string
}

export function QuoteList({
  quotes,
  trustLevel = 'verified',
  variant = 'default',
  showRelevance = false,
  maxQuotes,
  className,
}: QuoteListProps) {
  const displayQuotes = maxQuotes ? quotes.slice(0, maxQuotes) : quotes

  return (
    <div className={cn('space-y-3', className)}>
      {displayQuotes.map((quote, index) => (
        <QuoteCard
          key={index}
          data={quote}
          trustLevel={trustLevel}
          variant={variant}
          showRelevance={showRelevance}
        />
      ))}
    </div>
  )
}

// WTP-specific quote card
interface WtpQuoteCardProps {
  quote: string
  source: string
  className?: string
}

export function WtpQuoteCard({ quote, source, className }: WtpQuoteCardProps) {
  return (
    <QuoteCard
      data={{
        quote,
        source,
        isWtp: true,
      }}
      trustLevel="verified"
      variant="default"
      className={cn('border-l-green-500', className)}
    />
  )
}
