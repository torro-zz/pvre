'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  Clock,
  Users
} from 'lucide-react'

export interface ExpansionAttempt {
  type: 'time_range' | 'fetch_limit' | 'communities'
  value: string
  success: boolean
  signalsGained: number
}

export interface DataQualityDiagnostics {
  postsFound: number
  postsPassedFilter: number
  relevanceRate: number
  coreSignals: number
  confidence: 'very_low' | 'low' | 'medium' | 'high'
  expansionAttempts?: ExpansionAttempt[]
  communitiesSearched?: string[]
  timeRangeMonths?: number
}

interface DataQualityInsightsProps {
  diagnostics: DataQualityDiagnostics
}

function getRelevanceExplanation(rate: number): string {
  if (rate < 10) return 'Very broad topic — most posts are off-topic'
  if (rate < 20) return 'Broad hypothesis — significant filtering needed'
  if (rate < 40) return 'Moderate match — some noise in results'
  if (rate < 60) return 'Good match — most posts are relevant'
  return 'Excellent match — highly focused data'
}

function getConfidenceExplanation(confidence: string, signals: number): string {
  if (confidence === 'very_low') return `Only ${signals} signals found — results may not be representative`
  if (confidence === 'low') return `${signals} signals found — moderate reliability`
  if (confidence === 'medium') return `${signals} signals found — good reliability`
  return `${signals}+ signals found — high reliability`
}

function getSuggestion(diagnostics: DataQualityDiagnostics): string {
  const { relevanceRate, coreSignals, confidence } = diagnostics

  if (relevanceRate < 20 && coreSignals < 15) {
    return 'Try a more specific hypothesis or different keywords'
  }
  if (relevanceRate < 30) {
    return 'Consider narrowing your hypothesis to find more focused discussions'
  }
  if (coreSignals < 15) {
    return 'Try adding more related communities or a longer time range'
  }
  if (confidence === 'low' || confidence === 'very_low') {
    return 'Results may improve with a broader time range'
  }
  return 'Data quality is acceptable for initial validation'
}

export function DataQualityInsights({ diagnostics }: DataQualityInsightsProps) {
  const [expanded, setExpanded] = useState(false)

  const {
    relevanceRate,
    confidence,
    coreSignals,
    postsFound,
    postsPassedFilter,
    expansionAttempts = [],
    communitiesSearched = [],
    timeRangeMonths = 3
  } = diagnostics

  // Only show if there's a quality issue
  const hasIssue = relevanceRate < 30 || confidence === 'very_low' || confidence === 'low'

  if (!hasIssue) return null

  return (
    <Card className="border-amber-200 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5">
      <CardContent className="pt-4">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Data Quality Notice
            </span>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-amber-600" />
          ) : (
            <ChevronDown className="w-4 h-4 text-amber-600" />
          )}
        </button>

        {expanded && (
          <div className="mt-4 space-y-4">
            {/* Relevance Breakdown */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Search className="w-3.5 h-3.5 text-muted-foreground" />
                Relevance ({Math.round(relevanceRate)}%)
              </div>
              <div className="pl-5.5 space-y-0.5 text-xs text-muted-foreground">
                <p>{postsFound.toLocaleString()} posts fetched</p>
                <p>{postsPassedFilter.toLocaleString()} passed relevance filter ({Math.round(relevanceRate)}%)</p>
                <p className="text-amber-700 dark:text-amber-400">
                  {getRelevanceExplanation(relevanceRate)}
                </p>
              </div>
            </div>

            {/* Confidence Breakdown */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                Confidence ({confidence.replace('_', ' ')})
              </div>
              <div className="pl-5.5 space-y-0.5 text-xs text-muted-foreground">
                <p>{coreSignals} core pain signals detected</p>
                <p>Minimum recommended: 30 signals</p>
                <p className="text-amber-700 dark:text-amber-400">
                  {getConfidenceExplanation(confidence, coreSignals)}
                </p>
              </div>
            </div>

            {/* Search Parameters */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                Search Parameters
              </div>
              <div className="pl-5.5 space-y-0.5 text-xs text-muted-foreground">
                <p>Time range: {timeRangeMonths} months</p>
                {communitiesSearched.length > 0 && (
                  <p>Communities: {communitiesSearched.slice(0, 5).join(', ')}{communitiesSearched.length > 5 ? ` +${communitiesSearched.length - 5} more` : ''}</p>
                )}
              </div>
            </div>

            {/* Expansion Attempts */}
            {expansionAttempts.length > 0 && (
              <div className="space-y-1">
                <div className="text-sm font-medium">What We Tried</div>
                <div className="pl-1 space-y-1">
                  {expansionAttempts.map((attempt, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {attempt.success ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <XCircle className="w-3 h-3 text-muted-foreground" />
                      )}
                      <span className={attempt.success ? 'text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground'}>
                        {attempt.type === 'time_range' && `Expanded time range to ${attempt.value}`}
                        {attempt.type === 'fetch_limit' && `Increased fetch limit to ${attempt.value}`}
                        {attempt.type === 'communities' && `Searched ${attempt.value} additional communities`}
                        {attempt.success && attempt.signalsGained > 0 && ` (+${attempt.signalsGained} signals)`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestion */}
            <div className="pt-2 border-t border-amber-200 dark:border-amber-500/20">
              <p className="text-xs text-amber-800 dark:text-amber-300">
                <strong>Tip:</strong> {getSuggestion(diagnostics)}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
