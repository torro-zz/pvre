'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle, AlertTriangle, Loader2, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { StructuredHypothesis } from '@/types/research'

export interface SubredditCoverage {
  name: string
  estimatedPosts: number
  relevanceScore: 'high' | 'medium' | 'low'
}

export interface CoverageData {
  subreddits: SubredditCoverage[]
  totalEstimatedPosts: number
  dataConfidence: 'high' | 'medium' | 'low' | 'very_low'
  recommendation: 'proceed' | 'refine' | 'caution'
  refinementSuggestions?: string[]
  keywords: string[]
  problemPhrases?: string[] // New: phrases we'll search for
}

interface CoveragePreviewProps {
  hypothesis: string
  structuredHypothesis?: StructuredHypothesis // New: structured input
  onProceed: (coverageData: CoverageData) => void
  onRefine: () => void
  disabled?: boolean
}

const confidenceConfig = {
  high: {
    icon: CheckCircle,
    color: 'text-green-500',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    label: 'Good Data Coverage',
  },
  medium: {
    icon: CheckCircle,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    label: 'Moderate Data Coverage',
  },
  low: {
    icon: AlertTriangle,
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    label: 'Limited Data Available',
  },
  very_low: {
    icon: AlertCircle,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    label: 'Very Limited Data',
  },
}

const relevanceColors = {
  high: 'bg-green-500/20 text-green-600 dark:text-green-400',
  medium: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
  low: 'bg-zinc-500/20 text-zinc-600 dark:text-zinc-400',
}

export function CoveragePreview({
  hypothesis,
  structuredHypothesis,
  onProceed,
  onRefine,
  disabled = false,
}: CoveragePreviewProps) {
  const [coverage, setCoverage] = useState<CoverageData | null>(null)
  const [loading, setLoading] = useState(false)
  const [checked, setChecked] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkCoverage = async () => {
    // Validate based on structured input if available
    const hasValidInput = structuredHypothesis
      ? (structuredHypothesis.audience && structuredHypothesis.problem)
      : (hypothesis.trim() && hypothesis.length >= 10)

    if (!hasValidInput) {
      setError('Please fill in the required fields')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/research/coverage-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hypothesis,
          structuredHypothesis, // Pass structured data for better extraction
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Coverage check failed')
      }

      const data = await res.json()
      setCoverage(data)
      setChecked(true)
    } catch (err) {
      console.error('Coverage check failed:', err)
      setError(err instanceof Error ? err.message : 'Coverage check failed')
    } finally {
      setLoading(false)
    }
  }

  // Auto-trigger coverage check when component mounts
  useEffect(() => {
    if (hypothesis.trim() && hypothesis.length >= 10 && !checked && !loading) {
      checkCoverage()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run on mount

  // Reset when hypothesis changes significantly
  const resetCheck = () => {
    setChecked(false)
    setCoverage(null)
    setError(null)
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
          <div>
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setError(null)}
              className="mt-2 text-xs"
            >
              Try again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!checked) {
    return (
      <div className="p-4 rounded-lg border bg-muted/30 border-muted">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <div>
            <p className="font-medium">Checking data availability...</p>
            <p className="text-sm text-muted-foreground">
              Scanning Reddit for relevant discussions
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!coverage) return null

  const config = confidenceConfig[coverage.dataConfidence]
  const Icon = config.icon

  return (
    <div className={cn('p-4 rounded-lg border', config.bg, config.border)}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <Icon className={cn('w-5 h-5 mt-0.5', config.color)} />
        <div className="flex-1">
          <h3 className="font-semibold">{config.label}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Found ~{coverage.totalEstimatedPosts.toLocaleString()} relevant discussions on Reddit
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={resetCheck} className="text-xs">
          Reset
        </Button>
      </div>

      {/* Subreddit breakdown */}
      {coverage.subreddits.length > 0 && (
        <div className="space-y-2 mb-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Communities to analyze
          </p>
          <div className="space-y-1.5">
            {coverage.subreddits.slice(0, 5).map((sub) => (
              <div
                key={sub.name}
                className="flex items-center justify-between text-sm"
              >
                <span className="font-mono text-xs">r/{sub.name}</span>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded',
                      relevanceColors[sub.relevanceScore]
                    )}
                  >
                    {sub.estimatedPosts} posts
                  </span>
                </div>
              </div>
            ))}
            {coverage.subreddits.length > 5 && (
              <p className="text-xs text-muted-foreground">
                +{coverage.subreddits.length - 5} more communities
              </p>
            )}
          </div>
        </div>
      )}

      {/* Problem phrases - key innovation: show users what we're searching for */}
      {coverage.problemPhrases && coverage.problemPhrases.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-background/50 border border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              We&apos;ll search for people expressing
            </p>
          </div>
          <div className="space-y-1">
            {coverage.problemPhrases.map((phrase, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                <span className="text-foreground">&ldquo;{phrase}&rdquo;</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Keywords used (fallback if no problem phrases) */}
      {coverage.keywords.length > 0 && (!coverage.problemPhrases || coverage.problemPhrases.length === 0) && (
        <div className="mb-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            Search keywords
          </p>
          <div className="flex flex-wrap gap-1">
            {coverage.keywords.map((keyword) => (
              <span
                key={keyword}
                className="text-xs px-2 py-0.5 rounded bg-secondary"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions if coverage is low */}
      {coverage.refinementSuggestions && coverage.refinementSuggestions.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-background/50">
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
            Suggestions
          </p>
          <ul className="text-sm text-muted-foreground space-y-1">
            {coverage.refinementSuggestions.map((suggestion, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-muted-foreground">•</span>
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action buttons - type="button" prevents form submission */}
      <div className="flex gap-3">
        {coverage.recommendation === 'refine' ? (
          <>
            <Button type="button" onClick={onRefine} variant="default" className="flex-1" disabled={disabled}>
              Refine Hypothesis
            </Button>
            <Button type="button" onClick={() => onProceed(coverage)} variant="outline" disabled={disabled}>
              Run Anyway
            </Button>
          </>
        ) : coverage.recommendation === 'caution' ? (
          <>
            <Button type="button" onClick={() => onProceed(coverage)} variant="default" className="flex-1" disabled={disabled}>
              {disabled ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                'Start Research'
              )}
            </Button>
            <Button type="button" onClick={onRefine} variant="outline" disabled={disabled}>
              Refine First
            </Button>
          </>
        ) : (
          <Button type="button" onClick={() => onProceed(coverage)} variant="default" className="flex-1" disabled={disabled}>
            {disabled ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              'Start Research'
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
