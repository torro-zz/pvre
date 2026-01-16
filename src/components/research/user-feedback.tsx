'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DollarSign,
  Megaphone,
  Shield,
  Zap,
  Lightbulb,
  Star,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  TrendingUp,
  Users,
  ExternalLink,
  Info,
} from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import type { PainSignal } from '@/lib/analysis/pain-detector'
import type { AppDetails } from '@/lib/data-sources/types'

interface UserFeedbackProps {
  painSignals: PainSignal[]
  appData?: AppDetails  // Full app data for overall rating display
  crossStoreAppData?: AppDetails | null  // App from other store (e.g., Play Store when primary is App Store)
  appName?: string  // Fallback if appData not provided
  analyzedReviewCount?: number  // Total reviews fetched before filtering (default 500)
}

// Opportunity categories with their keywords and display info
const OPPORTUNITY_CATEGORIES = {
  pricing: {
    label: 'Pricing & Monetization',
    icon: DollarSign,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
    borderColor: 'border-emerald-200 dark:border-emerald-500/20',
    keywords: ['expensive', 'cost', 'pay', 'money', 'price', 'subscription', 'premium', 'free', 'purchase', 'buy', 'afford', 'worth', 'overpriced', 'cheap', 'fee', 'in-app', 'iap', 'microtransaction']
  },
  ads: {
    label: 'Ads',
    icon: Megaphone,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-500/10',
    borderColor: 'border-orange-200 dark:border-orange-500/20',
    keywords: ['ads', 'advertisement', 'commercial', 'banner', 'popup', 'pop-up', 'annoying ad', 'too many ad', 'ad-free', 'remove ad']
  },
  content: {
    label: 'Content & Moderation',
    icon: Shield,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 dark:bg-purple-500/10',
    borderColor: 'border-purple-200 dark:border-purple-500/20',
    keywords: ['inappropriate', 'moderation', 'content', 'character', 'nsfw', 'adult', 'children', 'kid', 'safe', 'filter', 'report', 'offensive', 'toxic', 'harassment']
  },
  performance: {
    label: 'Performance & Bugs',
    icon: Zap,
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-500/10',
    borderColor: 'border-red-200 dark:border-red-500/20',
    keywords: ['crash', 'bug', 'slow', 'lag', 'freeze', 'glitch', 'error', 'broken', 'fix', 'issue', 'problem', 'stuck', 'load', 'loading', 'performance', 'battery', 'memory']
  },
  features: {
    label: 'Missing Features',
    icon: Lightbulb,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-500/10',
    borderColor: 'border-amber-200 dark:border-amber-500/20',
    keywords: ['wish', 'want', 'need', 'should', 'would be nice', 'please add', 'missing', 'lack', 'option', 'feature', 'setting', 'ability', 'could', 'hope']
  }
}

type OpportunityCategory = keyof typeof OPPORTUNITY_CATEGORIES

type SourceType = 'reddit' | 'hackernews' | 'google_play' | 'app_store' | 'trustpilot' | 'unknown'

function getSourceType(subreddit?: string): SourceType {
  if (!subreddit) return 'unknown'
  const lower = subreddit.toLowerCase()
  if (lower === 'hackernews' || lower === 'askhn' || lower === 'showhn') return 'hackernews'
  if (lower === 'google_play') return 'google_play'
  if (lower === 'app_store') return 'app_store'
  if (lower === 'trustpilot') return 'trustpilot'
  return 'reddit'
}

function formatSourceName(subreddit?: string): string {
  if (!subreddit) return 'Unknown'
  const sourceType = getSourceType(subreddit)
  if (sourceType === 'hackernews') {
    if (subreddit.toLowerCase() === 'askhn') return 'Ask HN'
    if (subreddit.toLowerCase() === 'showhn') return 'Show HN'
    return 'Hacker News'
  }
  if (sourceType === 'google_play') return 'Google Play'
  if (sourceType === 'app_store') return 'App Store'
  if (sourceType === 'trustpilot') return 'Trustpilot'
  return `r/${subreddit.replace(/^r\//, '')}`
}

function getSourceBadgeClass(subreddit?: string): string {
  const sourceType = getSourceType(subreddit)
  if (sourceType === 'hackernews') return 'bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-950/50 dark:text-orange-400 dark:border-orange-800'
  if (sourceType === 'google_play') return 'bg-green-50 text-green-700 border-green-300 dark:bg-green-950/50 dark:text-green-400 dark:border-green-800'
  if (sourceType === 'app_store') return 'bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800'
  if (sourceType === 'trustpilot') return 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800'
  if (sourceType === 'unknown') return 'bg-muted text-muted-foreground border-muted-foreground/20'
  return 'bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-950/50 dark:text-orange-400 dark:border-orange-800'
}

function getSourceLinkText(subreddit?: string): string {
  const sourceType = getSourceType(subreddit)
  if (sourceType === 'hackernews') return 'View on HN'
  if (sourceType === 'google_play') return 'View on Google Play'
  if (sourceType === 'app_store') return 'View on App Store'
  if (sourceType === 'trustpilot') return 'View on Trustpilot'
  if (sourceType === 'unknown') return 'View source'
  return 'View on Reddit'
}

// Signal with additional category information for deduplication
interface CategorizedSignal {
  signal: PainSignal
  alsoIn: OpportunityCategory[]  // Other categories this signal matched
}

interface Opportunity {
  category: OpportunityCategory
  signals: CategorizedSignal[]  // Changed from PainSignal[] to include "also in" info
  fromHappyUsers: number // count from 4-5 star reviews
  totalCount: number
}

// Priority order for category assignment (higher priority = assigned first)
const CATEGORY_PRIORITY: OpportunityCategory[] = ['pricing', 'performance', 'features', 'ads', 'content']

// Categorize a signal and return categories with match counts for prioritization
function categorizeSignalWithCounts(signal: PainSignal): { category: OpportunityCategory; matchCount: number }[] {
  // Phase 3: If signal has semantic category from embeddings, use it as primary
  if (signal.feedbackCategory && signal.feedbackCategoryConfidence && signal.feedbackCategoryConfidence > 0.3) {
    const semanticCategory = signal.feedbackCategory as OpportunityCategory
    // Return semantic category with high match count to prioritize it
    const result = [{ category: semanticCategory, matchCount: 100 }]

    // Also check for keyword matches in other categories for "also in" display
    const text = (signal.text + ' ' + (signal.title || '')).toLowerCase()
    for (const [category, config] of Object.entries(OPPORTUNITY_CATEGORIES)) {
      if (category === semanticCategory) continue // Skip primary
      const matchCount = config.keywords.filter(keyword => text.includes(keyword)).length
      if (matchCount > 0) {
        result.push({ category: category as OpportunityCategory, matchCount })
      }
    }

    return result
  }

  // Fallback: Keyword-based categorization
  const text = (signal.text + ' ' + (signal.title || '')).toLowerCase()
  const matches: { category: OpportunityCategory; matchCount: number }[] = []

  for (const [category, config] of Object.entries(OPPORTUNITY_CATEGORIES)) {
    const matchCount = config.keywords.filter(keyword => text.includes(keyword)).length
    if (matchCount > 0) {
      matches.push({ category: category as OpportunityCategory, matchCount })
    }
  }

  // If solution-seeking, also add to features if not already there
  if (signal.solutionSeeking && !matches.some(m => m.category === 'features')) {
    matches.push({ category: 'features', matchCount: 1 })
  }

  // Sort by match count (highest first), then by priority order
  return matches.sort((a, b) => {
    if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount
    return CATEGORY_PRIORITY.indexOf(a.category) - CATEGORY_PRIORITY.indexOf(b.category)
  })
}

// Extract opportunities with deduplication - each signal appears in ONE primary category
function extractOpportunities(signals: PainSignal[]): Opportunity[] {
  // Filter to only app store reviews
  const appStoreSignals = signals.filter(
    s => s.source.subreddit === 'google_play' || s.source.subreddit === 'app_store'
  )

  // Assign each signal to ONE primary category, tracking other matches
  const categoryMap = new Map<OpportunityCategory, CategorizedSignal[]>()

  for (const signal of appStoreSignals) {
    const matches = categorizeSignalWithCounts(signal)
    if (matches.length === 0) continue  // Signal doesn't match any category

    // Primary category is the first (highest match count / priority)
    const primaryCategory = matches[0].category
    // Other categories are the rest
    const alsoIn = matches.slice(1).map(m => m.category)

    const existing = categoryMap.get(primaryCategory) || []
    existing.push({ signal, alsoIn })
    categoryMap.set(primaryCategory, existing)
  }

  // Convert to opportunities array with stats
  const opportunities: Opportunity[] = []

  for (const [category, categorizedSignals] of categoryMap.entries()) {
    const fromHappyUsers = categorizedSignals.filter(cs => {
      const rating = cs.signal.source.rating
      return rating !== undefined && rating >= 4
    }).length

    opportunities.push({
      category,
      signals: categorizedSignals,
      fromHappyUsers,
      totalCount: categorizedSignals.length
    })
  }

  // Sort by total count (most mentioned first)
  return opportunities.sort((a, b) => b.totalCount - a.totalCount)
}

// Calculate sentiment stats
function calculateSentiment(signals: PainSignal[]) {
  const appStoreSignals = signals.filter(
    s => s.source.subreddit === 'google_play' || s.source.subreddit === 'app_store'
  )

  let positive = 0
  let negative = 0
  let neutral = 0

  for (const signal of appStoreSignals) {
    const rating = signal.source.rating
    if (rating !== undefined) {
      if (rating >= 4) positive++
      else if (rating <= 2) negative++
      else neutral++
    }
  }

  return { positive, negative, neutral, total: appStoreSignals.length }
}

// Expandable quote component with star rating and "Also in:" tags
function QuoteWithRating({ categorizedSignal }: { categorizedSignal: CategorizedSignal }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { signal, alsoIn } = categorizedSignal
  const text = signal.text
  const isLong = text.length > 200
  const displayText = isExpanded || !isLong ? text : text.slice(0, 200) + '...'
  const rating = signal.source.rating
  const isGooglePlay = signal.source.subreddit === 'google_play'
  const isAppStore = signal.source.subreddit === 'app_store'

  return (
    <div className="py-3 border-b last:border-0">
      {/* Source badge + Star rating */}
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        {/* Source indicator */}
        {isGooglePlay && (
          <Badge variant="outline" className="text-[10px] py-0 bg-green-50 text-green-700 border-green-300 dark:bg-green-950/50 dark:text-green-400 dark:border-green-800">
            Google Play
          </Badge>
        )}
        {isAppStore && (
          <Badge variant="outline" className="text-[10px] py-0 bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800">
            App Store
          </Badge>
        )}
        {/* Star rating */}
        {rating !== undefined && (
          <>
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-3 w-3 ${i < rating ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground/30'}`}
              />
            ))}
          </>
        )}
        {rating !== undefined && rating >= 4 && (
          <Badge variant="outline" className="ml-1 text-[10px] py-0 text-emerald-600 border-emerald-300">
            Happy user
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        &quot;{displayText}&quot;
        {isLong && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="ml-2 text-primary hover:underline text-xs font-medium"
          >
            {isExpanded ? 'Show less' : 'Read more'}
          </button>
        )}
      </p>
      {/* Also in: tags for cross-category signals */}
      {alsoIn.length > 0 && (
        <p className="text-xs text-muted-foreground/70 mt-1.5 italic">
          Also in: {alsoIn.map(cat => OPPORTUNITY_CATEGORIES[cat].label).join(', ')}
        </p>
      )}
    </div>
  )
}

// Opportunity card component
function OpportunityCard({ opportunity }: { opportunity: Opportunity }) {
  const [expanded, setExpanded] = useState(false)
  const config = OPPORTUNITY_CATEGORIES[opportunity.category]
  const Icon = config.icon
  const displaySignals = expanded ? opportunity.signals : opportunity.signals.slice(0, 2)
  const happyUserPercent = opportunity.totalCount > 0
    ? Math.round((opportunity.fromHappyUsers / opportunity.totalCount) * 100)
    : 0

  return (
    <Card className={`overflow-hidden border ${config.borderColor}`}>
      <div className={`${config.bgColor} p-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${config.color}`} />
            <h3 className="font-semibold">{config.label}</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {opportunity.totalCount} mentions
            </Badge>
          </div>
        </div>

        {/* Opportunity insight - highlight if many from happy users */}
        {opportunity.fromHappyUsers > 0 && (
          <div className="flex items-center gap-1.5 mt-2 text-xs">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-emerald-700 dark:text-emerald-400 font-medium">
              {opportunity.fromHappyUsers} from 4-5★ reviews ({happyUserPercent}%)
            </span>
            <span className="text-muted-foreground">
              — high opportunity signal
            </span>
          </div>
        )}
      </div>

      <CardContent className="pt-4">
        <div className="space-y-0">
          {displaySignals.map((categorizedSignal, i) => (
            <QuoteWithRating key={i} categorizedSignal={categorizedSignal} />
          ))}
        </div>

        {opportunity.signals.length > 2 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-3"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                Show Less <ChevronUp className="ml-2 h-4 w-4" />
              </>
            ) : (
              <>
                Show {opportunity.signals.length - 2} More <ChevronDown className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

// Source quote component
function SourceQuote({ signal }: { signal: PainSignal }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const text = signal.text
  const isLong = text.length > 200
  const displayText = isExpanded || !isLong ? text : text.slice(0, 200) + '...'
  const subreddit = signal.source.subreddit

  return (
    <div className="py-3 border-b last:border-0">
      <div className="flex items-center gap-2 mb-1.5">
        <Badge variant="outline" className={`text-[10px] py-0 ${getSourceBadgeClass(subreddit)}`}>
          {formatSourceName(subreddit)}
        </Badge>
        {signal.intensity === 'high' && (
          <Badge variant="outline" className="text-[10px] py-0 text-red-600 border-red-300">
            High intensity
          </Badge>
        )}
        {signal.solutionSeeking && (
          <Badge variant="outline" className="text-[10px] py-0 text-blue-600 border-blue-300">
            Seeking solution
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        "{displayText}"
        {isLong && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="ml-2 text-primary hover:underline text-xs font-medium"
          >
            {isExpanded ? 'Show less' : 'Read more'}
          </button>
        )}
      </p>
      {signal.source.url && (
        <a
          href={signal.source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
        >
          {getSourceLinkText(subreddit)} <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  )
}

// Community discussions section
function CommunityDiscussions({ signals }: { signals: PainSignal[] }) {
  const [expanded, setExpanded] = useState(false)
  const displaySignals = expanded ? signals : signals.slice(0, 3)

  // Group by subreddit for stats
  const subredditCounts = signals.reduce((acc, s) => {
    const sub = s.source.subreddit || 'unknown'
    acc[sub] = (acc[sub] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const topSubreddits = Object.entries(subredditCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  return (
    <Card className="overflow-hidden border-blue-200 dark:border-blue-500/20">
      <div className="bg-blue-50 dark:bg-blue-500/10 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h3 className="font-semibold">Community Discussions</h3>
          </div>
          <Badge variant="secondary" className="text-xs">
            {signals.length} mentions
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          What people are saying about this app across communities
        </p>
        {topSubreddits.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {topSubreddits.map(([sub, count]) => (
              <Badge key={sub} variant="outline" className="text-[10px]">
                {formatSourceName(sub)} ({count})
              </Badge>
            ))}
          </div>
        )}
      </div>

      <CardContent className="pt-4">
        <div className="space-y-0">
          {displaySignals.map((signal, i) => (
            <SourceQuote key={i} signal={signal} />
          ))}
        </div>

        {signals.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-3"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                Show Less <ChevronUp className="ml-2 h-4 w-4" />
              </>
            ) : (
              <>
                Show {signals.length - 3} More <ChevronDown className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export function UserFeedback({ painSignals, appData, crossStoreAppData, appName, analyzedReviewCount = 500 }: UserFeedbackProps) {
  const sentiment = calculateSentiment(painSignals)
  const opportunities = extractOpportunities(painSignals)

  // Separate non-app-store signals for community discussions section
  const communitySignals = painSignals.filter(
    s => s.source.subreddit && s.source.subreddit !== 'google_play' && s.source.subreddit !== 'app_store'
  )

  const sentimentScore = sentiment.total > 0
    ? Math.round((sentiment.positive / sentiment.total) * 100)
    : 50

  // Count total opportunities from happy users
  const totalHappyUserOpportunities = opportunities.reduce((sum, o) => sum + o.fromHappyUsers, 0)

  // Use appData for display, fallback to appName
  const displayName = appData?.name || appName

  // Format review count for display (e.g., 274000 -> "274K")
  const formatReviewCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
    if (count >= 1000) return `${(count / 1000).toFixed(0)}K`
    return count.toString()
  }

  return (
    <div className="space-y-6">
      {/* Store Rating - Side-by-Side Compact Design */}
      {appData?.rating && (
        <Card className="overflow-hidden">
          <CardContent className="py-3 px-4">
            {(() => {
              // Determine which app is from which store
              const appStoreApp = appData.store === 'app_store' ? appData : crossStoreAppData?.store === 'app_store' ? crossStoreAppData : null
              const playStoreApp = appData.store === 'google_play' ? appData : crossStoreAppData?.store === 'google_play' ? crossStoreAppData : null

              return (
                <div className="grid grid-cols-2 gap-3">
                  {/* App Store */}
                  <div
                    className={`flex items-center justify-between p-2.5 rounded-lg border-2 transition-all ${
                      appStoreApp
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                        : 'border-dashed border-muted-foreground/20'
                    }`}
                  >
                    <span className={`text-sm font-medium ${appStoreApp ? 'text-blue-700 dark:text-blue-400' : 'text-muted-foreground'}`}>
                      App Store
                    </span>
                    {appStoreApp ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
                            {appStoreApp.rating.toFixed(1)}
                          </span>
                          <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatReviewCount(appStoreApp.reviewCount)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">N/A</span>
                    )}
                  </div>

                  {/* Play Store */}
                  <div
                    className={`flex items-center justify-between p-2.5 rounded-lg border-2 transition-all ${
                      playStoreApp
                        ? 'border-green-500 bg-green-50 dark:bg-green-500/10'
                        : 'border-dashed border-muted-foreground/20'
                    }`}
                  >
                    <span className={`text-sm font-medium ${playStoreApp ? 'text-green-700 dark:text-green-400' : 'text-muted-foreground'}`}>
                      Play Store
                    </span>
                    {playStoreApp ? (
                      <div className="flex items-center gap-2">
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
                            {playStoreApp.rating.toFixed(1)}
                          </span>
                          <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatReviewCount(playStoreApp.reviewCount)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">N/A</span>
                    )}
                  </div>
                </div>
              )
            })()}
          </CardContent>
        </Card>
      )}

      {/* Pain Signal Breakdown */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-purple-500/10 p-6">
          <h2 className="text-xl font-bold mb-1">Pain Signal Analysis</h2>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            {sentiment.total} pain signals extracted from {analyzedReviewCount} reviews{displayName ? ` for ${displayName}` : ''}
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3.5 w-3.5 text-muted-foreground/70 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                Pain signals are reviews containing complaints, frustrations, or feature requests.
                This breakdown shows the star ratings of users who left these specific signals.
              </TooltipContent>
            </Tooltip>
          </p>
        </div>

        <CardContent className="pt-6">
          {/* Improved rating breakdown */}
          <div className="space-y-3">
            {/* Positive signals */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 w-24">
                <ThumbsUp className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-medium">4-5 ★</span>
              </div>
              <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full flex items-center justify-end pr-2"
                  style={{ width: `${sentiment.total > 0 ? (sentiment.positive / sentiment.total) * 100 : 0}%`, minWidth: sentiment.positive > 0 ? '2rem' : '0' }}
                >
                  {sentiment.positive > 0 && (
                    <span className="text-xs font-medium text-white">{sentiment.positive}</span>
                  )}
                </div>
              </div>
              <span className="text-sm text-muted-foreground w-16 text-right">
                {sentiment.total > 0 ? Math.round((sentiment.positive / sentiment.total) * 100) : 0}%
              </span>
            </div>

            {/* Neutral signals */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 w-24">
                <Star className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium">3 ★</span>
              </div>
              <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full flex items-center justify-end pr-2"
                  style={{ width: `${sentiment.total > 0 ? (sentiment.neutral / sentiment.total) * 100 : 0}%`, minWidth: sentiment.neutral > 0 ? '2rem' : '0' }}
                >
                  {sentiment.neutral > 0 && (
                    <span className="text-xs font-medium text-white">{sentiment.neutral}</span>
                  )}
                </div>
              </div>
              <span className="text-sm text-muted-foreground w-16 text-right">
                {sentiment.total > 0 ? Math.round((sentiment.neutral / sentiment.total) * 100) : 0}%
              </span>
            </div>

            {/* Negative signals */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 w-24">
                <ThumbsDown className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium">1-2 ★</span>
              </div>
              <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full flex items-center justify-end pr-2"
                  style={{ width: `${sentiment.total > 0 ? (sentiment.negative / sentiment.total) * 100 : 0}%`, minWidth: sentiment.negative > 0 ? '2rem' : '0' }}
                >
                  {sentiment.negative > 0 && (
                    <span className="text-xs font-medium text-white">{sentiment.negative}</span>
                  )}
                </div>
              </div>
              <span className="text-sm text-muted-foreground w-16 text-right">
                {sentiment.total > 0 ? Math.round((sentiment.negative / sentiment.total) * 100) : 0}%
              </span>
            </div>
          </div>

          {/* Summary insight */}
          {sentiment.total > 0 && (
            <p className="text-xs text-muted-foreground mt-4 pt-4 border-t">
              {sentiment.positive > sentiment.negative
                ? `💡 Most pain signals come from satisfied users (4-5★) — these are improvement opportunities, not dealbreakers.`
                : sentiment.negative > sentiment.positive
                  ? `⚠️ Most pain signals come from dissatisfied users (1-2★) — these indicate serious issues.`
                  : `📊 Pain signals are evenly distributed across rating levels.`
              }
            </p>
          )}
        </CardContent>
      </Card>

      {/* Community Discussions - Show first as it's often more insightful */}
      {communitySignals.length > 0 && (
        <CommunityDiscussions signals={communitySignals} />
      )}

      {/* Opportunities Header */}
      {opportunities.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">App Store Feedback</h2>
          </div>
          {totalHappyUserOpportunities > 0 && (
            <Badge variant="outline" className="text-emerald-600 border-emerald-300">
              <TrendingUp className="h-3 w-3 mr-1" />
              {totalHappyUserOpportunities} mentions from 4-5★
            </Badge>
          )}
        </div>
      )}

      {opportunities.length > 0 && (
        <p className="text-sm text-muted-foreground -mt-4">
          Pain points extracted from app reviews. Complaints from 4-5★ users = high opportunity (they're almost satisfied).
        </p>
      )}

      {/* Opportunity Cards */}
      {opportunities.map((opportunity) => (
        <OpportunityCard key={opportunity.category} opportunity={opportunity} />
      ))}

      {/* No Opportunities Found */}
      {opportunities.length === 0 && sentiment.total > 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <ThumbsUp className="h-12 w-12 mx-auto mb-4 text-emerald-500 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Major Pain Points Detected</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              The analyzed reviews don't show strong patterns of complaints.
              This could mean the competitor is doing well, or there's limited review data.
            </p>
          </CardContent>
        </Card>
      )}

      {/* No App Store Data Message */}
      {sentiment.total === 0 && (
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
