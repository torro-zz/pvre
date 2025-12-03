'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle, AlertTriangle, Loader2, MessageCircle, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  // User modifications
  userSelectedSubreddits?: string[] // AI-suggested subs user wants to keep
  userAddedSubreddits?: string[] // Custom subs user added
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

  // Subreddit editing state
  const [selectedSubreddits, setSelectedSubreddits] = useState<Set<string>>(new Set())
  const [customSubreddits, setCustomSubreddits] = useState<string[]>([])
  const [newSubreddit, setNewSubreddit] = useState('')
  const [showAddInput, setShowAddInput] = useState(false)

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
      // Initialize all AI-suggested subreddits as selected
      const names: string[] = data.subreddits?.map((s: SubredditCoverage) => s.name) || []
      setSelectedSubreddits(new Set(names))
      setCustomSubreddits([])
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
    setSelectedSubreddits(new Set())
    setCustomSubreddits([])
    setShowAddInput(false)
    setNewSubreddit('')
  }

  // Toggle subreddit selection
  const toggleSubreddit = (name: string) => {
    setSelectedSubreddits(prev => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }

  // Add custom subreddit
  const addCustomSubreddit = () => {
    const cleaned = newSubreddit.trim().toLowerCase().replace(/^r\//, '')
    if (cleaned && !customSubreddits.includes(cleaned) && !selectedSubreddits.has(cleaned)) {
      setCustomSubreddits(prev => [...prev, cleaned])
      setSelectedSubreddits(prev => new Set([...prev, cleaned]))
      setNewSubreddit('')
      setShowAddInput(false)
    }
  }

  // Remove custom subreddit
  const removeCustomSubreddit = (name: string) => {
    setCustomSubreddits(prev => prev.filter(s => s !== name))
    setSelectedSubreddits(prev => {
      const next = new Set(prev)
      next.delete(name)
      return next
    })
  }

  // Build final coverage data with user modifications
  const getFinalCoverageData = (): CoverageData => {
    if (!coverage) throw new Error('No coverage data')
    return {
      ...coverage,
      userSelectedSubreddits: Array.from(selectedSubreddits),
      userAddedSubreddits: customSubreddits,
    }
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

      {/* Subreddit breakdown - editable */}
      {coverage.subreddits.length > 0 && (
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Communities to analyze
            </p>
            <span className="text-xs text-muted-foreground">
              {selectedSubreddits.size} selected
            </span>
          </div>
          <div className="space-y-1.5">
            {/* AI-suggested subreddits with checkboxes */}
            {coverage.subreddits.slice(0, 8).map((sub) => (
              <div
                key={sub.name}
                className={cn(
                  'flex items-center justify-between text-sm p-1.5 rounded transition-colors cursor-pointer hover:bg-background/50',
                  !selectedSubreddits.has(sub.name) && 'opacity-50'
                )}
                onClick={() => toggleSubreddit(sub.name)}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedSubreddits.has(sub.name)}
                    onChange={() => toggleSubreddit(sub.name)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-3.5 w-3.5 rounded border-muted-foreground/30"
                  />
                  <span className="font-mono text-xs">r/{sub.name}</span>
                </div>
                <span
                  className={cn(
                    'text-xs px-2 py-0.5 rounded',
                    relevanceColors[sub.relevanceScore]
                  )}
                >
                  {sub.estimatedPosts} posts
                </span>
              </div>
            ))}

            {/* User-added custom subreddits */}
            {customSubreddits.map((name) => (
              <div
                key={`custom-${name}`}
                className="flex items-center justify-between text-sm p-1.5 rounded bg-primary/5 border border-primary/20"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-primary" />
                  <span className="font-mono text-xs">r/{name}</span>
                  <span className="text-xs text-primary">(custom)</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeCustomSubreddit(name)}
                  className="p-0.5 hover:bg-destructive/10 rounded"
                >
                  <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}

            {/* Add custom subreddit */}
            {showAddInput ? (
              <div className="flex items-center gap-2 p-1.5">
                <span className="text-xs text-muted-foreground">r/</span>
                <Input
                  type="text"
                  value={newSubreddit}
                  onChange={(e) => setNewSubreddit(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addCustomSubreddit()
                    } else if (e.key === 'Escape') {
                      setShowAddInput(false)
                      setNewSubreddit('')
                    }
                  }}
                  placeholder="subreddit name"
                  className="h-7 text-xs font-mono flex-1"
                  autoFocus
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addCustomSubreddit}
                  className="h-7 px-2"
                  disabled={!newSubreddit.trim()}
                >
                  Add
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAddInput(false)
                    setNewSubreddit('')
                  }}
                  className="h-7 px-2"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddInput(true)}
                className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 p-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Add a subreddit I know
              </button>
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

      {/* Validation: need at least one subreddit */}
      {selectedSubreddits.size === 0 && (
        <div className="mb-4 p-2 rounded bg-yellow-500/10 border border-yellow-500/20">
          <p className="text-xs text-yellow-600 dark:text-yellow-400">
            Select at least one subreddit to analyze
          </p>
        </div>
      )}

      {/* Action buttons - type="button" prevents form submission */}
      <div className="flex gap-3">
        {coverage.recommendation === 'refine' ? (
          <>
            <Button type="button" onClick={onRefine} variant="default" className="flex-1" disabled={disabled}>
              Refine Hypothesis
            </Button>
            <Button type="button" onClick={() => onProceed(getFinalCoverageData())} variant="outline" disabled={disabled || selectedSubreddits.size === 0}>
              Run Anyway
            </Button>
          </>
        ) : coverage.recommendation === 'caution' ? (
          <>
            <Button type="button" onClick={() => onProceed(getFinalCoverageData())} variant="default" className="flex-1" disabled={disabled || selectedSubreddits.size === 0}>
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
          <Button type="button" onClick={() => onProceed(getFinalCoverageData())} variant="default" className="flex-1" disabled={disabled || selectedSubreddits.size === 0}>
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
