'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle, AlertTriangle, Loader2, MessageCircle, Plus, X, Globe, MapPin, Building2, DollarSign, Target, FileText, ExternalLink, Sparkles, Database } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { StructuredHypothesis, TargetGeography, GeographyScope, detectGeographyFromAudience } from '@/types/research'

export interface SubredditCoverage {
  name: string
  estimatedPosts: number
  relevanceScore: 'high' | 'medium' | 'low'
}

export interface SamplePost {
  title: string
  subreddit: string
  score: number
  permalink: string
}

export interface CoverageData {
  subreddits: SubredditCoverage[]
  totalEstimatedPosts: number
  dataConfidence: 'high' | 'medium' | 'low' | 'very_low'
  recommendation: 'proceed' | 'refine' | 'caution'
  refinementSuggestions?: string[]
  keywords: string[]
  problemPhrases?: string[] // New: phrases we'll search for
  samplePosts?: SamplePost[] // Live preview of actual posts
  // 3-stage discovery results
  discoveryWarning?: string | null
  discoveryRecommendation?: 'proceed' | 'proceed_with_caution' | 'reconsider'
  domain?: {
    primaryDomain: string
    secondaryDomains: string[]
    audienceDescriptor: string
  }
  // User modifications
  userSelectedSubreddits?: string[] // AI-suggested subs user wants to keep
  userAddedSubreddits?: string[] // Custom subs user added
  // Geography for market sizing scoping
  targetGeography?: TargetGeography
  // Revenue goal and pricing for market sizing
  mscTarget?: number // Minimum Success Criteria (revenue goal in $)
  targetPrice?: number // Monthly price per customer in $
  // Data sources
  dataSources?: string[] // Available data sources
  hackerNews?: {
    included: boolean
    estimatedPosts: number
    samplePosts: SamplePost[]
  }
  googlePlay?: {
    included: boolean
    estimatedPosts: number
    samplePosts: SamplePost[]
  }
  appStore?: {
    included: boolean
    estimatedPosts: number
    samplePosts: SamplePost[]
  }
  selectedDataSources?: string[] // User-selected sources to use
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

  // Geography state for market sizing scoping
  const [targetGeography, setTargetGeography] = useState<TargetGeography | undefined>(undefined)
  const [showGeographyEditor, setShowGeographyEditor] = useState(false)
  const [customLocation, setCustomLocation] = useState('')

  // Revenue goal and pricing state for market sizing
  const [mscTarget, setMscTarget] = useState<number>(1000000) // Default $1M ARR
  const [targetPrice, setTargetPrice] = useState<number>(29) // Default $29/month
  const [showPricingEditor, setShowPricingEditor] = useState(false)

  // Data sources state
  const [selectedDataSources, setSelectedDataSources] = useState<Set<string>>(new Set(['Reddit']))

  // MSC presets
  const mscPresets = [
    { value: 100000, label: '$100k', description: 'Lifestyle business' },
    { value: 500000, label: '$500k', description: 'Sustainable small business' },
    { value: 1000000, label: '$1M', description: 'Growth business' },
    { value: 10000000, label: '$10M+', description: 'Venture-scale' },
  ]

  // Detect geography from audience on mount
  useEffect(() => {
    if (structuredHypothesis?.audience && !targetGeography) {
      const detected = detectGeographyFromAudience(structuredHypothesis.audience)
      if (detected) {
        setTargetGeography(detected)
      }
    }
  }, [structuredHypothesis?.audience, targetGeography])

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
      // Only auto-select high and medium relevance subreddits
      // Low-relevance subreddits are shown but NOT pre-selected (user can opt-in)
      const highMediumSubs = data.subreddits?.filter(
        (s: SubredditCoverage) => s.relevanceScore === 'high' || s.relevanceScore === 'medium'
      ) || []
      const names: string[] = highMediumSubs.map((s: SubredditCoverage) => s.name)
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

  // Reset and re-check coverage
  const resetCheck = () => {
    setChecked(false)
    setCoverage(null)
    setError(null)
    setSelectedSubreddits(new Set())
    setCustomSubreddits([])
    setShowAddInput(false)
    setNewSubreddit('')
    // Re-trigger coverage check after state clears
    setTimeout(() => {
      checkCoverage()
    }, 0)
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
      targetGeography: targetGeography,
      mscTarget: mscTarget,
      targetPrice: targetPrice,
      selectedDataSources: Array.from(selectedDataSources),
    }
  }

  // Toggle a data source
  const toggleDataSource = (source: string) => {
    // Reddit is always required
    if (source === 'Reddit') return
    setSelectedDataSources(prev => {
      const next = new Set(prev)
      if (next.has(source)) {
        next.delete(source)
      } else {
        next.add(source)
      }
      return next
    })
  }

  // Geography scope display helpers
  const geographyIcons: Record<GeographyScope, typeof Globe> = {
    local: MapPin,
    national: Building2,
    global: Globe,
  }

  const geographyLabels: Record<GeographyScope, string> = {
    local: 'Local (City/Region)',
    national: 'National (Country)',
    global: 'Global (Online business)',
  }

  const setGeographyScope = (scope: GeographyScope) => {
    if (scope === 'global') {
      setTargetGeography({ scope: 'global' })
    } else {
      setTargetGeography(prev => ({
        scope,
        location: prev?.location || customLocation || '',
      }))
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

      {/* Domain-first discovery warning banner */}
      {coverage.discoveryWarning && (
        <div className={cn(
          'mb-4 p-3 rounded-lg flex items-start gap-3',
          coverage.discoveryRecommendation === 'reconsider'
            ? 'bg-red-500/10 border border-red-500/20'
            : 'bg-yellow-500/10 border border-yellow-500/20'
        )}>
          <AlertTriangle className={cn(
            'w-5 h-5 mt-0.5 flex-shrink-0',
            coverage.discoveryRecommendation === 'reconsider' ? 'text-red-500' : 'text-yellow-500'
          )} />
          <div className="flex-1">
            <p className={cn(
              'text-sm font-medium',
              coverage.discoveryRecommendation === 'reconsider' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'
            )}>
              {coverage.discoveryRecommendation === 'reconsider' ? 'Consider Refining' : 'Limited Coverage'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">{coverage.discoveryWarning}</p>
            {coverage.domain && (
              <p className="text-xs text-muted-foreground mt-2">
                Detected domain: <span className="font-medium">{coverage.domain.primaryDomain}</span>
                {coverage.domain.secondaryDomains.length > 0 && (
                  <span> + {coverage.domain.secondaryDomains.join(', ')}</span>
                )}
              </p>
            )}
          </div>
        </div>
      )}

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

      {/* Data Sources Selection */}
      <div className="mb-4 p-3 rounded-lg bg-background/50 border border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <Database className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Data Sources
          </p>
        </div>

        <div className="space-y-2">
          {/* Reddit - always selected */}
          <div className="flex items-center justify-between p-2 rounded bg-muted/30">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={true}
                disabled={true}
                className="h-4 w-4 rounded"
              />
              <span className="text-sm font-medium">Reddit</span>
              <span className="text-xs text-muted-foreground">
                ({(coverage.totalEstimatedPosts - (coverage.hackerNews?.estimatedPosts || 0) - (coverage.googlePlay?.estimatedPosts || 0) - (coverage.appStore?.estimatedPosts || 0)).toLocaleString()} posts)
              </span>
            </div>
            <span className="text-xs text-muted-foreground">Required</span>
          </div>

          {/* Hacker News - optional, shown with recommendation if available */}
          {coverage.hackerNews?.included && (
            <div
              className={cn(
                'flex items-center justify-between p-2 rounded cursor-pointer transition-colors',
                selectedDataSources.has('Hacker News')
                  ? 'bg-orange-500/10 border border-orange-500/30'
                  : 'bg-muted/30 hover:bg-muted/50'
              )}
              onClick={() => toggleDataSource('Hacker News')}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedDataSources.has('Hacker News')}
                  onChange={() => toggleDataSource('Hacker News')}
                  onClick={(e) => e.stopPropagation()}
                  className="h-4 w-4 rounded"
                />
                <span className="text-sm font-medium">Hacker News</span>
                <span className="text-xs text-muted-foreground">
                  ({coverage.hackerNews.estimatedPosts} posts)
                </span>
              </div>
              <span className="text-xs text-orange-600 dark:text-orange-400">Tech/Startup</span>
            </div>
          )}

          {/* Recommendation banner if HN is available but not selected */}
          {coverage.hackerNews?.included && !selectedDataSources.has('Hacker News') && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <Sparkles className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-orange-700 dark:text-orange-300">
                  <strong>Recommended:</strong> Your hypothesis mentions tech/startup keywords.
                  Adding Hacker News can provide valuable insights from the developer community.
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedDataSources(prev => new Set([...prev, 'Hacker News']))}
                  className="text-xs text-orange-600 dark:text-orange-400 font-medium mt-1 hover:underline"
                >
                  + Add Hacker News
                </button>
              </div>
            </div>
          )}

          {/* HN Sample Posts when selected */}
          {coverage.hackerNews?.included && selectedDataSources.has('Hacker News') && coverage.hackerNews.samplePosts.length > 0 && (
            <div className="ml-6 mt-2 space-y-1">
              <p className="text-xs text-muted-foreground">Sample HN posts:</p>
              {coverage.hackerNews.samplePosts.slice(0, 2).map((post, i) => (
                <a
                  key={i}
                  href={post.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 text-xs p-1.5 rounded hover:bg-muted/50 transition-colors group"
                >
                  <span className="text-muted-foreground flex-shrink-0">•</span>
                  <span className="text-foreground line-clamp-1">{post.title}</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0" />
                </a>
              ))}
            </div>
          )}

          {/* Google Play - optional, shown for mobile app hypotheses */}
          {coverage.googlePlay?.included && (
            <div
              className={cn(
                'flex items-center justify-between p-2 rounded cursor-pointer transition-colors',
                selectedDataSources.has('Google Play')
                  ? 'bg-green-500/10 border border-green-500/30'
                  : 'bg-muted/30 hover:bg-muted/50'
              )}
              onClick={() => toggleDataSource('Google Play')}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedDataSources.has('Google Play')}
                  onChange={() => toggleDataSource('Google Play')}
                  onClick={(e) => e.stopPropagation()}
                  className="h-4 w-4 rounded"
                />
                <span className="text-sm font-medium">Google Play</span>
                <span className="text-xs text-muted-foreground">
                  ({coverage.googlePlay.estimatedPosts.toLocaleString()} reviews)
                </span>
              </div>
              <span className="text-xs text-green-600 dark:text-green-400">Android</span>
            </div>
          )}

          {/* Google Play Sample Reviews when selected */}
          {coverage.googlePlay?.included && selectedDataSources.has('Google Play') && coverage.googlePlay.samplePosts.length > 0 && (
            <div className="ml-6 mt-2 space-y-1">
              <p className="text-xs text-muted-foreground">Sample reviews:</p>
              {coverage.googlePlay.samplePosts.slice(0, 2).map((post, i) => (
                <a
                  key={i}
                  href={post.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 text-xs p-1.5 rounded hover:bg-muted/50 transition-colors group"
                >
                  <span className="text-muted-foreground flex-shrink-0">•</span>
                  <span className="text-foreground line-clamp-1">{post.title}</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0" />
                </a>
              ))}
            </div>
          )}

          {/* App Store - optional, shown for mobile app hypotheses */}
          {coverage.appStore?.included && (
            <div
              className={cn(
                'flex items-center justify-between p-2 rounded cursor-pointer transition-colors',
                selectedDataSources.has('App Store')
                  ? 'bg-blue-500/10 border border-blue-500/30'
                  : 'bg-muted/30 hover:bg-muted/50'
              )}
              onClick={() => toggleDataSource('App Store')}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedDataSources.has('App Store')}
                  onChange={() => toggleDataSource('App Store')}
                  onClick={(e) => e.stopPropagation()}
                  className="h-4 w-4 rounded"
                />
                <span className="text-sm font-medium">App Store</span>
                <span className="text-xs text-muted-foreground">
                  ({coverage.appStore.estimatedPosts.toLocaleString()} reviews)
                </span>
              </div>
              <span className="text-xs text-blue-600 dark:text-blue-400">iOS</span>
            </div>
          )}

          {/* App Store Sample Reviews when selected */}
          {coverage.appStore?.included && selectedDataSources.has('App Store') && coverage.appStore.samplePosts.length > 0 && (
            <div className="ml-6 mt-2 space-y-1">
              <p className="text-xs text-muted-foreground">Sample reviews:</p>
              {coverage.appStore.samplePosts.slice(0, 2).map((post, i) => (
                <a
                  key={i}
                  href={post.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 text-xs p-1.5 rounded hover:bg-muted/50 transition-colors group"
                >
                  <span className="text-muted-foreground flex-shrink-0">•</span>
                  <span className="text-foreground line-clamp-1">{post.title}</span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0" />
                </a>
              ))}
            </div>
          )}

          {/* Recommendation banner if app stores are available but not selected */}
          {(coverage.googlePlay?.included || coverage.appStore?.included) &&
           !selectedDataSources.has('Google Play') && !selectedDataSources.has('App Store') && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
              <Sparkles className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-green-700 dark:text-green-300">
                  <strong>Recommended:</strong> Your hypothesis mentions mobile app keywords.
                  Adding app store reviews can reveal real user pain points.
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedDataSources(prev => {
                    const next = new Set(prev)
                    if (coverage.googlePlay?.included) next.add('Google Play')
                    if (coverage.appStore?.included) next.add('App Store')
                    return next
                  })}
                  className="text-xs text-green-600 dark:text-green-400 font-medium mt-1 hover:underline"
                >
                  + Add App Store Reviews
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sample Posts Preview - show actual posts before spending credit */}
      {coverage.samplePosts && coverage.samplePosts.length > 0 && (() => {
        // Filter out removed/deleted posts - they provide no value in preview
        const validPosts = coverage.samplePosts.filter(post => {
          const title = post.title.toLowerCase()
          // Skip posts with removed/deleted markers
          if (title.includes('[removed]') || title.includes('[deleted]')) return false
          // Skip posts where title is mostly removal text
          if (title.includes('removed by moderator')) return false
          if (title.includes('deleted by user')) return false
          // Skip very short titles (likely garbage)
          if (post.title.trim().length < 20) return false
          return true
        })

        if (validPosts.length === 0) return null

        return (
        <div className="mb-4 p-3 rounded-lg bg-background/50 border border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Example posts we&apos;ll analyze
            </p>
          </div>
          <div className="space-y-2">
            {validPosts.map((post, i) => (
              <a
                key={i}
                href={`https://reddit.com${post.permalink}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 text-sm p-2 rounded hover:bg-muted/50 transition-colors group"
              >
                <span className="text-xs text-muted-foreground font-mono flex-shrink-0 mt-0.5">
                  r/{post.subreddit}
                </span>
                <span className="text-foreground flex-1 line-clamp-2">
                  &ldquo;{post.title}&rdquo;
                </span>
                <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
              </a>
            ))}
          </div>
        </div>
        )
      })()}

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

      {/* Geography selector for market sizing */}
      <div className="mb-4 p-3 rounded-lg bg-background/50 border border-border/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Target Market (for market sizing)
            </p>
          </div>
          {!showGeographyEditor && (
            <button
              type="button"
              onClick={() => setShowGeographyEditor(true)}
              className="text-xs text-primary hover:text-primary/80"
            >
              Change
            </button>
          )}
        </div>

        {showGeographyEditor ? (
          <div className="space-y-3">
            {/* Scope selection */}
            <div className="flex flex-wrap gap-2">
              {(['local', 'national', 'global'] as GeographyScope[]).map((scope) => {
                const Icon = geographyIcons[scope]
                return (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => setGeographyScope(scope)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors',
                      targetGeography?.scope === scope
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary hover:bg-secondary/80'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {geographyLabels[scope]}
                  </button>
                )
              })}
            </div>

            {/* Location input for local/national */}
            {targetGeography?.scope && targetGeography.scope !== 'global' && (
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={targetGeography?.location || customLocation}
                  onChange={(e) => {
                    setCustomLocation(e.target.value)
                    setTargetGeography(prev => ({
                      scope: prev?.scope || 'local',
                      location: e.target.value,
                    }))
                  }}
                  placeholder={targetGeography?.scope === 'local' ? 'e.g., London, UK' : 'e.g., United States'}
                  className="h-8 text-sm flex-1"
                />
              </div>
            )}

            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowGeographyEditor(false)}
                className="text-xs"
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {targetGeography ? (
              <>
                {(() => {
                  const Icon = geographyIcons[targetGeography.scope]
                  return <Icon className="h-4 w-4 text-primary" />
                })()}
                <span className="text-sm font-medium">
                  {targetGeography.scope === 'global'
                    ? 'Global (no geographic limit)'
                    : targetGeography.location || geographyLabels[targetGeography.scope]}
                </span>
                {targetGeography.detectedFrom && (
                  <span className="text-xs text-muted-foreground">
                    (detected from {targetGeography.detectedFrom})
                  </span>
                )}
              </>
            ) : (
              <>
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Global (click Change to set target market)
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Revenue Goal and Pricing for market sizing */}
      <div className="mb-4 p-3 rounded-lg bg-background/50 border border-border/50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Revenue Goal & Pricing (for market sizing)
            </p>
          </div>
          {!showPricingEditor && (
            <button
              type="button"
              onClick={() => setShowPricingEditor(true)}
              className="text-xs text-primary hover:text-primary/80"
            >
              Change
            </button>
          )}
        </div>

        {showPricingEditor ? (
          <div className="space-y-4">
            {/* Revenue Goal selection */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">3-Year Revenue Goal (MSC):</p>
              <div className="flex flex-wrap gap-2">
                {mscPresets.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => setMscTarget(preset.value)}
                    className={cn(
                      'flex flex-col items-center px-3 py-2 rounded-md text-xs transition-colors',
                      mscTarget === preset.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary hover:bg-secondary/80'
                    )}
                  >
                    <span className="font-medium">{preset.label}</span>
                    <span className="text-[10px] opacity-70">{preset.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Pricing input */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Monthly Price per Customer:</p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  value={targetPrice || ''}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '') {
                      setTargetPrice(0)
                    } else {
                      const num = Number(val)
                      if (!isNaN(num) && num >= 0) {
                        setTargetPrice(num)
                      }
                    }
                  }}
                  onBlur={(e) => {
                    if (!e.target.value || Number(e.target.value) <= 0) {
                      setTargetPrice(29)
                    }
                  }}
                  placeholder="29"
                  className="h-8 text-sm w-24"
                  min={1}
                />
                <span className="text-sm text-muted-foreground">/month</span>
                <span className="text-xs text-muted-foreground ml-2">
                  = ${(targetPrice * 12).toLocaleString()}/year per customer
                </span>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowPricingEditor(false)}
                className="text-xs"
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Target className="h-4 w-4 text-primary" />
              <span className="font-medium">
                {mscPresets.find(p => p.value === mscTarget)?.label || `$${(mscTarget / 1000000).toFixed(1)}M`}
              </span>
              <span className="text-muted-foreground">goal</span>
            </div>
            <span className="text-muted-foreground">•</span>
            <div className="flex items-center gap-1">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="font-medium">${targetPrice}/mo</span>
              <span className="text-muted-foreground">(${(targetPrice * 12).toLocaleString()}/yr)</span>
            </div>
          </div>
        )}
      </div>

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
