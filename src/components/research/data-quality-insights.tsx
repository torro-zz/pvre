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
  totalSignals: number  // P0 Fix 2: Add total signals for consistent display
  confidence: 'very_low' | 'low' | 'medium' | 'high'
  expansionAttempts?: ExpansionAttempt[]
  communitiesSearched?: string[]
  timeRangeMonths?: number
}

interface DataQualityInsightsProps {
  diagnostics: DataQualityDiagnostics
}

function getRelevanceExplanation(rate: number): string {
  // P0 Fix 4: Soften accusatory language - never blame the user
  if (rate < 10) return 'Limited matches found. Consider refining your search terms.'
  if (rate < 20) return 'These communities discuss many topics. Try more specific keywords.'
  if (rate < 40) return 'Moderate match — some filtering applied'
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
  const { relevanceRate, totalSignals, confidence } = diagnostics

  if (relevanceRate < 20 && totalSignals < 15) {
    return 'Try more specific keywords or different communities'
  }
  if (relevanceRate < 30) {
    return 'Try more specific keywords to find focused discussions'
  }
  if (totalSignals < 15) {
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
    totalSignals,
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
        {/* P1 Fix 6: Better collapsed state with key info visible */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Limited Data:
            </span>
            <span className="text-sm text-amber-700 dark:text-amber-400">
              {postsPassedFilter} relevant posts from {postsFound.toLocaleString()} scanned
            </span>
          </div>
          <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 flex-shrink-0">
            {expanded ? 'Collapse' : 'Details'}
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </span>
        </button>

        {expanded && (
          <div className="mt-4 space-y-4">
            {/* Relevance Breakdown - P0 Fix 1 & 3: Don't show 0% when matches exist */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Search className="w-3.5 h-3.5 text-muted-foreground" />
                Relevance
              </div>
              <div className="pl-5.5 space-y-0.5 text-xs text-muted-foreground">
                <p>{postsPassedFilter} of {postsFound.toLocaleString()} posts matched your hypothesis</p>
                <p className="text-amber-700 dark:text-amber-400">
                  {getRelevanceExplanation(relevanceRate)}
                </p>
              </div>
            </div>

            {/* Confidence Breakdown - P0 Fix 2: Consistent signal counts */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                Confidence ({confidence.replace('_', ' ')})
              </div>
              <div className="pl-5.5 space-y-0.5 text-xs text-muted-foreground">
                <p>{totalSignals} signals found ({coreSignals} high-relevance)</p>
                <p>Minimum recommended: 30 signals for reliable results</p>
                <p className="text-amber-700 dark:text-amber-400">
                  {getConfidenceExplanation(confidence, totalSignals)}
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
