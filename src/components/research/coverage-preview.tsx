'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle, AlertTriangle, Loader2, MessageCircle, Plus, X, Globe, MapPin, Building2, DollarSign, Target, FileText, ExternalLink, Sparkles, Database, Smartphone, SlidersHorizontal, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { StructuredHypothesis, TargetGeography, GeographyScope, detectGeographyFromAudience } from '@/types/research'
import type { AppDetails } from '@/lib/data-sources/types'

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
  // Sample size per source (how many reviews/posts to analyze)
  sampleSizePerSource?: number
}

interface CoveragePreviewProps {
  hypothesis: string
  structuredHypothesis?: StructuredHypothesis // New: structured input
  onProceed: (coverageData: CoverageData) => void
  onRefine: () => void
  disabled?: boolean
  // App-centric analysis mode
  mode?: 'hypothesis' | 'app-analysis'
  appData?: AppDetails | null
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
  mode = 'hypothesis',
  appData,
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

  // Sample size state (reviews/posts per source)
  const [sampleSize, setSampleSize] = useState<number>(100) // Default 100, max 300 for now

  // MSC presets
  const mscPresets = [
    { value: 100000, label: '$100k', description: 'Lifestyle business' },
    { value: 500000, label: '$500k', description: 'Sustainable small business' },
    { value: 1000000, label: '$1M', description: 'Growth business' },
    { value: 10000000, label: '$10M+', description: 'Venture-scale' },
  ]

  // Sample size presets
  const sampleSizePresets = [
    { value: 100, label: 'Quick', description: '~400 data points' },
    { value: 200, label: 'Standard', description: '~800 data points' },
    { value: 300, label: 'Deep', description: '~1,200 data points' },
  ]

  // Fetch limits per source (based on selected sample size)
  const FETCH_LIMITS = {
    redditPerSub: sampleSize,
    hackerNews: sampleSize,
    googlePlay: sampleSize,
    appStore: sampleSize,
  }

  // Format data source count: show "X of Y" if Y > limit, otherwise just Y
  const formatSourceCount = (available: number, limit: number) => {
    if (available <= limit) {
      return available.toLocaleString()
    }
    return `${limit} of ${available.toLocaleString()}`
  }

  // Set pricing defaults based on app data for app-centric mode
  useEffect(() => {
    if (mode === 'app-analysis' && appData) {
      // Try to parse actual price if it's a paid app
      if (appData.price && appData.price !== 'Free') {
        const priceMatch = appData.price.match(/[\d.]+/)
        if (priceMatch) {
          const parsedPrice = parseFloat(priceMatch[0])
          if (!isNaN(parsedPrice) && parsedPrice > 0) {
            setTargetPrice(Math.round(parsedPrice))
          }
        }
      } else if (appData.hasIAP) {
        // Freemium app - use category-based subscription defaults
        const categoryDefaults: Record<string, number> = {
          'health & fitness': 10,
          'medical': 15,
          'productivity': 10,
          'business': 15,
          'finance': 12,
          'education': 12,
          'entertainment': 10,
          'music': 10,
          'lifestyle': 10,
        }
        const category = appData.category.toLowerCase()
        const defaultPrice = categoryDefaults[category] || 10
        setTargetPrice(defaultPrice)
      }
    }
  }, [mode, appData])

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
      sampleSizePerSource: sampleSize,
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
      {/* Context header - different for hypothesis vs app-analysis mode */}
      {mode === 'app-analysis' && appData ? (
        <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <div className="flex items-center gap-3">
            {appData.iconUrl ? (
              <img
                src={appData.iconUrl}
                alt={appData.name}
                className="w-10 h-10 rounded-lg"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-blue-500" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <Smartphone className="h-3.5 w-3.5 text-blue-500" />
                <p className="text-xs text-blue-600 dark:text-blue-400 uppercase tracking-wide font-medium">
                  Market Opportunity
                </p>
              </div>
              <h3 className="font-semibold text-foreground truncate">{appData.name}</h3>
              <p className="text-sm text-muted-foreground">
                Finding white space around this competitor
              </p>
            </div>
          </div>
        </div>
      ) : structuredHypothesis ? (
        <div className="mb-4 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-violet-500" />
            <p className="text-xs text-violet-600 dark:text-violet-400 uppercase tracking-wide font-medium">
              Hypothesis Being Tested
            </p>
          </div>
          <p className="text-sm font-medium text-foreground">
            <span className="text-muted-foreground">Audience:</span> {structuredHypothesis.audience}
          </p>
          <p className="text-sm font-medium text-foreground mt-1">
            <span className="text-muted-foreground">Problem:</span> {structuredHypothesis.problem}
          </p>
        </div>
      ) : null}

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

      {/* Subreddit breakdown - Compact Pill Layout */}
      {coverage.subreddits.length > 0 && (
        <div className="mb-4 p-3 rounded-lg bg-background/50 border border-border/50">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Communities to analyze
            </p>
            <span className="text-xs text-muted-foreground">
              {selectedSubreddits.size} selected
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {/* AI-suggested subreddits as pills */}
            {coverage.subreddits.slice(0, 8).map((sub) => (
              <button
                key={sub.name}
                type="button"
                onClick={() => toggleSubreddit(sub.name)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all',
                  selectedSubreddits.has(sub.name)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                )}
              >
                <span className="font-mono">r/{sub.name}</span>
                <span className={cn(
                  'text-[10px] px-1 py-0.5 rounded',
                  selectedSubreddits.has(sub.name)
                    ? 'bg-primary-foreground/20'
                    : sub.relevanceScore === 'high' ? 'bg-green-500/30' :
                      sub.relevanceScore === 'medium' ? 'bg-blue-500/30' : 'bg-zinc-500/30'
                )}>
                  {sub.estimatedPosts}
                </span>
              </button>
            ))}

            {/* User-added custom subreddits */}
            {customSubreddits.map((name) => (
              <div
                key={`custom-${name}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-xs"
              >
                <span className="font-mono">r/{name}</span>
                <button
                  type="button"
                  onClick={() => removeCustomSubreddit(name)}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}

            {/* Add custom subreddit */}
            {showAddInput ? (
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-dashed border-primary/50 bg-background">
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
                  placeholder="name"
                  className="h-5 text-xs font-mono w-24 border-0 p-0 focus-visible:ring-0"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={addCustomSubreddit}
                  className="text-primary hover:text-primary/80"
                  disabled={!newSubreddit.trim()}
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddInput(false)
                    setNewSubreddit('')
                  }}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddInput(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs text-primary border border-dashed border-primary/50 hover:bg-primary/5"
              >
                <Plus className="h-3 w-3" />
                Add
              </button>
            )}
          </div>
        </div>
      )}

      {/* Data Sources Selection - Horizontal Toggle Buttons */}
      <div className="mb-4 p-3 rounded-lg bg-background/50 border border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <Database className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            Data Sources
          </p>
        </div>

        {/* Horizontal toggle row */}
        <div className="flex flex-wrap gap-2">
          {/* Reddit - always required */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 border border-border">
            <span className="text-sm font-medium">Reddit</span>
            <span className="text-xs text-muted-foreground">
              ({formatSourceCount(
                coverage.totalEstimatedPosts - (coverage.hackerNews?.estimatedPosts || 0) - (coverage.googlePlay?.estimatedPosts || 0) - (coverage.appStore?.estimatedPosts || 0),
                selectedSubreddits.size * FETCH_LIMITS.redditPerSub
              )})
            </span>
            <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded">Required</span>
          </div>

          {/* Hacker News - toggleable */}
          {coverage.hackerNews?.included && (
            <button
              type="button"
              onClick={() => toggleDataSource('Hacker News')}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors',
                selectedDataSources.has('Hacker News')
                  ? 'bg-orange-500/10 border-orange-500/50 text-orange-700 dark:text-orange-400'
                  : 'bg-muted/30 border-border hover:bg-muted/50'
              )}
            >
              <span className="text-sm font-medium">Hacker News</span>
              <span className="text-xs opacity-70">({formatSourceCount(coverage.hackerNews.estimatedPosts, FETCH_LIMITS.hackerNews)})</span>
              {selectedDataSources.has('Hacker News') && (
                <CheckCircle className="h-3.5 w-3.5" />
              )}
            </button>
          )}

          {/* Google Play - toggleable */}
          {coverage.googlePlay?.included && (
            <button
              type="button"
              onClick={() => toggleDataSource('Google Play')}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors',
                selectedDataSources.has('Google Play')
                  ? 'bg-green-500/10 border-green-500/50 text-green-700 dark:text-green-400'
                  : 'bg-muted/30 border-border hover:bg-muted/50'
              )}
            >
              <span className="text-sm font-medium">Google Play</span>
              <span className="text-xs opacity-70">({formatSourceCount(coverage.googlePlay.estimatedPosts, FETCH_LIMITS.googlePlay)})</span>
              {selectedDataSources.has('Google Play') && (
                <CheckCircle className="h-3.5 w-3.5" />
              )}
            </button>
          )}

          {/* App Store - toggleable */}
          {coverage.appStore?.included && (
            <button
              type="button"
              onClick={() => toggleDataSource('App Store')}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors',
                selectedDataSources.has('App Store')
                  ? 'bg-blue-500/10 border-blue-500/50 text-blue-700 dark:text-blue-400'
                  : 'bg-muted/30 border-border hover:bg-muted/50'
              )}
            >
              <span className="text-sm font-medium">App Store</span>
              <span className="text-xs opacity-70">({formatSourceCount(coverage.appStore.estimatedPosts, FETCH_LIMITS.appStore)})</span>
              {selectedDataSources.has('App Store') && (
                <CheckCircle className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Analysis Depth Selector */}
      <div className="mb-4 p-3 rounded-lg bg-background/50 border border-border/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Analysis Depth
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Info className="h-3 w-3" />
            <span>per source, prioritizing 2-3★ reviews</span>
          </div>
        </div>
        <div className="flex gap-2">
          {sampleSizePresets.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => setSampleSize(preset.value)}
              className={cn(
                'flex-1 flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg border transition-colors',
                sampleSize === preset.value
                  ? 'bg-primary/10 border-primary/50 text-primary'
                  : 'bg-muted/30 border-border hover:bg-muted/50'
              )}
            >
              <span className="text-sm font-medium">{preset.label}</span>
              <span className="text-xs opacity-70">{preset.value}/source</span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground text-center">
          {sampleSizePresets.find(p => p.value === sampleSize)?.description} • Last 12 months • Constructive reviews prioritized
        </p>
      </div>

      {/* Sample Posts Preview - 2-Column Grid Layout */}
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
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Example posts we&apos;ll analyze
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {validPosts.map((post, i) => (
              <a
                key={i}
                href={`https://reddit.com${post.permalink}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col p-3 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors group"
              >
                <span className="text-xs text-muted-foreground font-mono mb-1">
                  r/{post.subreddit}
                </span>
                <span className="text-sm text-foreground line-clamp-2 flex-1">
                  &ldquo;{post.title}&rdquo;
                </span>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">
                    {post.score > 0 && `${post.score} upvotes`}
                  </span>
                  <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
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

      {/* Geography & Pricing - Two Column Layout on Desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Geography selector for market sizing */}
        <div className="p-3 rounded-lg bg-background/50 border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Target Market
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
              <div className="flex flex-wrap gap-1.5">
                {(['local', 'national', 'global'] as GeographyScope[]).map((scope) => {
                  const Icon = geographyIcons[scope]
                  return (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => setGeographyScope(scope)}
                      className={cn(
                        'flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors',
                        targetGeography?.scope === scope
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary hover:bg-secondary/80'
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {scope === 'local' ? 'Local' : scope === 'national' ? 'National' : 'Global'}
                    </button>
                  )
                })}
              </div>

              {/* Location input for local/national */}
              {targetGeography?.scope && targetGeography.scope !== 'global' && (
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
                  className="h-7 text-xs"
                />
              )}

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowGeographyEditor(false)}
                  className="text-xs h-6 px-2"
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
                  <span className="text-sm font-medium truncate">
                    {targetGeography.scope === 'global'
                      ? 'Global'
                      : targetGeography.location || geographyLabels[targetGeography.scope]}
                  </span>
                </>
              ) : (
                <>
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Global</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Revenue Goal and Pricing for market sizing */}
        <div className="p-3 rounded-lg bg-background/50 border border-border/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Revenue & Pricing
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
            <div className="space-y-3">
              {/* Revenue Goal selection */}
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Revenue Goal:</p>
                <div className="flex flex-wrap gap-1.5">
                  {mscPresets.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setMscTarget(preset.value)}
                      className={cn(
                        'px-2 py-1 rounded-md text-xs transition-colors',
                        mscTarget === preset.value
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary hover:bg-secondary/80'
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pricing input */}
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Price/month:</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">$</span>
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
                    className="h-7 text-xs w-16"
                    min={1}
                  />
                  <span className="text-xs text-muted-foreground">
                    (${(targetPrice * 12).toLocaleString()}/yr)
                  </span>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPricingEditor(false)}
                  className="text-xs h-6 px-2"
                >
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-1">
                <Target className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium">
                  {mscPresets.find(p => p.value === mscTarget)?.label || `$${(mscTarget / 1000000).toFixed(1)}M`}
                </span>
              </div>
              <span className="text-muted-foreground">•</span>
              <div className="flex items-center gap-1">
                <span className="font-medium">${targetPrice}/mo</span>
              </div>
            </div>
          )}
        </div>
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
