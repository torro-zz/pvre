'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Heart, AlertTriangle, Lightbulb, Star, ChevronDown, ChevronUp, MessageSquare, ThumbsUp, ThumbsDown } from 'lucide-react'
import type { PainSignal } from '@/lib/analysis/pain-detector'

interface UserFeedbackProps {
  painSignals: PainSignal[]
  appName?: string
}

// Categorize signals into love, pain, and feature requests
function categorizeSignals(signals: PainSignal[]) {
  // Filter to only app store reviews
  const appStoreSignals = signals.filter(
    s => s.source.subreddit === 'google_play' || s.source.subreddit === 'app_store'
  )

  const love: PainSignal[] = []
  const pain: PainSignal[] = []
  const featureRequests: PainSignal[] = []

  for (const signal of appStoreSignals) {
    // Feature requests: solution-seeking signals
    if (signal.solutionSeeking) {
      featureRequests.push(signal)
      continue
    }

    // Positive signals (love): low intensity with hope/neutral emotion
    if ((signal.emotion === 'hope' || signal.emotion === 'neutral') && signal.intensity === 'low') {
      love.push(signal)
      continue
    }

    // Everything else is a pain point
    pain.push(signal)
  }

  return { love, pain, featureRequests }
}

// Group similar signals by extracting key phrases
function groupSimilarSignals(signals: PainSignal[]): { theme: string; signals: PainSignal[]; count: number }[] {
  // Simple grouping by first signal keyword
  const groups = new Map<string, PainSignal[]>()

  for (const signal of signals) {
    // Use the first signal indicator as the theme
    const theme = signal.signals[0] || 'General feedback'
    const existing = groups.get(theme) || []
    existing.push(signal)
    groups.set(theme, existing)
  }

  // Convert to array and sort by count
  return Array.from(groups.entries())
    .map(([theme, signals]) => ({ theme, signals, count: signals.length }))
    .sort((a, b) => b.count - a.count)
}

function FeedbackSection({
  title,
  icon: Icon,
  iconColor,
  bgColor,
  signals,
  emptyMessage,
}: {
  title: string
  icon: typeof Heart
  iconColor: string
  bgColor: string
  signals: PainSignal[]
  emptyMessage: string
}) {
  const [expanded, setExpanded] = useState(false)
  const grouped = groupSimilarSignals(signals)
  const displayGroups = expanded ? grouped : grouped.slice(0, 3)

  if (signals.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <Icon className={`h-8 w-8 mx-auto mb-2 ${iconColor} opacity-50`} />
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <div className={`${bgColor} p-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${iconColor}`} />
            <h3 className="font-semibold">{title}</h3>
          </div>
          <Badge variant="secondary">{signals.length} mentions</Badge>
        </div>
      </div>

      <CardContent className="pt-4">
        <div className="space-y-4">
          {displayGroups.map((group, i) => (
            <div key={i} className="border-b last:border-0 pb-4 last:pb-0">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">{group.theme}</span>
                <Badge variant="outline" className="text-xs">
                  {group.count}x
                </Badge>
              </div>
              {/* Show a sample quote */}
              {group.signals[0] && (
                <blockquote className="text-sm text-muted-foreground italic border-l-2 border-muted pl-3">
                  "{group.signals[0].text.slice(0, 150)}{group.signals[0].text.length > 150 ? '...' : ''}"
                </blockquote>
              )}
            </div>
          ))}
        </div>

        {grouped.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-4"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                Show Less <ChevronUp className="ml-2 h-4 w-4" />
              </>
            ) : (
              <>
                Show {grouped.length - 3} More <ChevronDown className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export function UserFeedback({ painSignals, appName }: UserFeedbackProps) {
  const { love, pain, featureRequests } = categorizeSignals(painSignals)
  const totalReviews = love.length + pain.length + featureRequests.length

  // Calculate sentiment breakdown
  const sentimentScore = totalReviews > 0
    ? Math.round((love.length / totalReviews) * 100)
    : 50

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-purple-500/10 p-6">
          <h2 className="text-xl font-bold mb-1">User Feedback Analysis</h2>
          <p className="text-sm text-muted-foreground">
            Insights from {totalReviews} app store reviews{appName ? ` for ${appName}` : ''}
          </p>
        </div>

        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
              <ThumbsUp className="h-6 w-6 mx-auto mb-2 text-emerald-600 dark:text-emerald-400" />
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {love.length}
              </div>
              <p className="text-xs text-emerald-600 dark:text-emerald-500">Positive</p>
            </div>

            <div className="text-center p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
              <ThumbsDown className="h-6 w-6 mx-auto mb-2 text-red-600 dark:text-red-400" />
              <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                {pain.length}
              </div>
              <p className="text-xs text-red-600 dark:text-red-500">Pain Points</p>
            </div>

            <div className="text-center p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
              <Lightbulb className="h-6 w-6 mx-auto mb-2 text-amber-600 dark:text-amber-400" />
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                {featureRequests.length}
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-500">Requests</p>
            </div>
          </div>

          {/* Sentiment Bar */}
          {totalReviews > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span>Overall Sentiment</span>
                <span>{sentimentScore}% positive</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
                  style={{ width: `${sentimentScore}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* What Users Love */}
      <FeedbackSection
        title="What Users Love"
        icon={Heart}
        iconColor="text-emerald-600 dark:text-emerald-400"
        bgColor="bg-emerald-50 dark:bg-emerald-500/10"
        signals={love}
        emptyMessage="No strongly positive feedback found in the analyzed reviews"
      />

      {/* Pain Points */}
      <FeedbackSection
        title="Pain Points"
        icon={AlertTriangle}
        iconColor="text-red-600 dark:text-red-400"
        bgColor="bg-red-50 dark:bg-red-500/10"
        signals={pain}
        emptyMessage="No significant pain points found in the analyzed reviews"
      />

      {/* Feature Requests */}
      <FeedbackSection
        title="Feature Requests"
        icon={Lightbulb}
        iconColor="text-amber-600 dark:text-amber-400"
        bgColor="bg-amber-50 dark:bg-amber-500/10"
        signals={featureRequests}
        emptyMessage="No feature requests detected in the analyzed reviews"
      />

      {/* No App Store Data Message */}
      {totalReviews === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No App Store Reviews Analyzed</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              App store data sources weren't included in this research run.
              User feedback will appear here when Google Play or App Store is selected as a data source.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
