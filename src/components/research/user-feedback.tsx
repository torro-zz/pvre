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
} from 'lucide-react'
import type { PainSignal } from '@/lib/analysis/pain-detector'

interface UserFeedbackProps {
  painSignals: PainSignal[]
  appName?: string
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
    label: 'Ads & Interruptions',
    icon: Megaphone,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-500/10',
    borderColor: 'border-orange-200 dark:border-orange-500/20',
    keywords: ['ad', 'ads', 'advertisement', 'commercial', 'banner', 'popup', 'pop-up', 'interrupt', 'annoying ad', 'too many ad', 'ad-free', 'remove ad']
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

interface Opportunity {
  category: OpportunityCategory
  signals: PainSignal[]
  fromHappyUsers: number // count from 4-5 star reviews
  totalCount: number
}

// Categorize a signal into opportunity categories based on text content
function categorizeSignal(signal: PainSignal): OpportunityCategory[] {
  const text = (signal.text + ' ' + (signal.title || '')).toLowerCase()
  const categories: OpportunityCategory[] = []

  for (const [category, config] of Object.entries(OPPORTUNITY_CATEGORIES)) {
    const hasKeyword = config.keywords.some(keyword => text.includes(keyword))
    if (hasKeyword) {
      categories.push(category as OpportunityCategory)
    }
  }

  // If solution-seeking, also add to features
  if (signal.solutionSeeking && !categories.includes('features')) {
    categories.push('features')
  }

  return categories
}

// Extract opportunities from all signals
function extractOpportunities(signals: PainSignal[]): Opportunity[] {
  // Filter to only app store reviews
  const appStoreSignals = signals.filter(
    s => s.source.subreddit === 'google_play' || s.source.subreddit === 'app_store'
  )

  // Group signals by category
  const categoryMap = new Map<OpportunityCategory, PainSignal[]>()

  for (const signal of appStoreSignals) {
    const categories = categorizeSignal(signal)
    for (const category of categories) {
      const existing = categoryMap.get(category) || []
      existing.push(signal)
      categoryMap.set(category, existing)
    }
  }

  // Convert to opportunities array with stats
  const opportunities: Opportunity[] = []

  for (const [category, categorySignals] of categoryMap.entries()) {
    const fromHappyUsers = categorySignals.filter(s => {
      const rating = s.source.rating
      return rating !== undefined && rating >= 4
    }).length

    opportunities.push({
      category,
      signals: categorySignals,
      fromHappyUsers,
      totalCount: categorySignals.length
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

// Expandable quote component with star rating
function QuoteWithRating({ signal }: { signal: PainSignal }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const text = signal.text
  const isLong = text.length > 200
  const displayText = isExpanded || !isLong ? text : text.slice(0, 200) + '...'
  const rating = signal.source.rating

  return (
    <div className="py-3 border-b last:border-0">
      {/* Star rating */}
      {rating !== undefined && (
        <div className="flex items-center gap-1 mb-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`h-3 w-3 ${i < rating ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground/30'}`}
            />
          ))}
          {rating >= 4 && (
            <Badge variant="outline" className="ml-2 text-[10px] py-0 text-emerald-600 border-emerald-300">
              Happy user
            </Badge>
          )}
        </div>
      )}
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
          {displaySignals.map((signal, i) => (
            <QuoteWithRating key={i} signal={signal} />
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

export function UserFeedback({ painSignals, appName }: UserFeedbackProps) {
  const sentiment = calculateSentiment(painSignals)
  const opportunities = extractOpportunities(painSignals)

  const sentimentScore = sentiment.total > 0
    ? Math.round((sentiment.positive / sentiment.total) * 100)
    : 50

  // Count total opportunities from happy users
  const totalHappyUserOpportunities = opportunities.reduce((sum, o) => sum + o.fromHappyUsers, 0)

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-purple-500/10 p-6">
          <h2 className="text-xl font-bold mb-1">User Feedback Analysis</h2>
          <p className="text-sm text-muted-foreground">
            Insights from {sentiment.total} app store reviews{appName ? ` for ${appName}` : ''}
          </p>
        </div>

        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
              <ThumbsUp className="h-6 w-6 mx-auto mb-2 text-emerald-600 dark:text-emerald-400" />
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {sentiment.positive}
              </div>
              <p className="text-xs text-emerald-600 dark:text-emerald-500">4-5 Stars</p>
            </div>

            <div className="text-center p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
              <Star className="h-6 w-6 mx-auto mb-2 text-amber-600 dark:text-amber-400" />
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                {sentiment.neutral}
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-500">3 Stars</p>
            </div>

            <div className="text-center p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
              <ThumbsDown className="h-6 w-6 mx-auto mb-2 text-red-600 dark:text-red-400" />
              <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                {sentiment.negative}
              </div>
              <p className="text-xs text-red-600 dark:text-red-500">1-2 Stars</p>
            </div>
          </div>

          {/* Sentiment Bar */}
          {sentiment.total > 0 && (
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

      {/* Opportunities Header */}
      {opportunities.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Opportunities Found</h2>
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
          Pain points extracted from all reviews. Complaints from 4-5★ users = high opportunity (they're almost satisfied).
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
