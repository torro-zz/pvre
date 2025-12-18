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
  // App-centric analysis mode
  mode?: 'hypothesis' | 'app-analysis'
  appData?: AppDetails | null
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
    color: 'text-emerald-500',
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    label: 'Good coverage',
  },
  medium: {
    icon: CheckCircle,
    color: 'text-blue-500',
    badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    label: 'Moderate coverage',
  },
  low: {
    icon: AlertTriangle,
    color: 'text-amber-500',
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    label: 'Limited data',
  },
  very_low: {
    icon: AlertCircle,
    color: 'text-red-500',
    badge: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    label: 'Very limited',
  },
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
        // Map of category keywords to default prices (more flexible matching)
        const categoryPrices: Array<{ keywords: string[]; price: number }> = [
          { keywords: ['health', 'fitness', 'wellness'], price: 10 },
          { keywords: ['medical', 'medicine', 'healthcare'], price: 15 },
          { keywords: ['productivity', 'utilities'], price: 10 },
          { keywords: ['business', 'enterprise'], price: 15 },
          { keywords: ['finance', 'fintech', 'banking', 'money'], price: 12 },
          { keywords: ['education', 'learning', 'books'], price: 12 },
          { keywords: ['entertainment', 'games', 'gaming'], price: 10 },
          { keywords: ['music', 'audio'], price: 10 },
          { keywords: ['lifestyle', 'social'], price: 10 },
          { keywords: ['food', 'drink', 'recipe'], price: 8 },
          { keywords: ['photo', 'video', 'camera'], price: 8 },
          { keywords: ['travel', 'navigation'], price: 10 },
          { keywords: ['news', 'magazine', 'weather'], price: 8 },
        ]

        // Normalize category for matching (handle formats like "HEALTH_AND_FITNESS", "Health & Fitness", etc.)
        const normalizedCategory = appData.category.toLowerCase().replace(/[_&]/g, ' ').replace(/\s+/g, ' ')

        // Find matching category by keyword
        const match = categoryPrices.find(cat =>
          cat.keywords.some(kw => normalizedCategory.includes(kw))
        )
        const defaultPrice = match?.price || 10
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
      // App-centric analysis mode
      mode: mode,
      appData: appData,
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
    <div className="space-y-4">
      {/* Header with coverage status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-lg font-semibold">Configure Research</div>
          <span className={cn('inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border', config.badge)}>
            <Icon className="h-3 w-3" />
            {config.label}
          </span>
        </div>
        <span className="text-sm text-muted-foreground">
          {(() => {
            const redditCount = Math.min(selectedSubreddits.size * sampleSize, coverage.totalEstimatedPosts - (coverage.hackerNews?.estimatedPosts || 0) - (coverage.googlePlay?.estimatedPosts || 0) - (coverage.appStore?.estimatedPosts || 0))
            const hnCount = selectedDataSources.has('Hacker News') && coverage.hackerNews?.included ? Math.min(sampleSize, coverage.hackerNews.estimatedPosts) : 0
            const gpCount = selectedDataSources.has('Google Play') && coverage.googlePlay?.included ? Math.min(sampleSize, coverage.googlePlay.estimatedPosts) : 0
            const asCount = selectedDataSources.has('App Store') && coverage.appStore?.included ? Math.min(sampleSize, coverage.appStore.estimatedPosts) : 0
            const totalToAnalyze = redditCount + hnCount + gpCount + asCount
            return `~${totalToAnalyze.toLocaleString()} posts`
          })()}
        </span>
      </div>

      {/* Warning banner - only if serious */}
      {coverage.discoveryWarning && coverage.discoveryRecommendation === 'reconsider' && (
        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-foreground">{coverage.discoveryWarning}</p>
          </div>
        </div>
      )}

      {/* Communities Section */}
      {coverage.subreddits.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Communities
            </div>
            <span className="text-xs text-muted-foreground">
              {selectedSubreddits.size} selected
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {coverage.subreddits.slice(0, 8).map((sub) => {
              const isSelected = selectedSubreddits.has(sub.name)
              return (
                <button
                  key={sub.name}
                  type="button"
                  onClick={() => toggleSubreddit(sub.name)}
                  className={cn(
                    'inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border transition-all',
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                  )}
                >
                  <span className="font-mono text-xs">r/{sub.name}</span>
                  <span className={cn('text-xs', isSelected ? 'opacity-80' : 'opacity-50')}>{sub.estimatedPosts}</span>
                </button>
              )
            })}

            {customSubreddits.map((name) => (
              <div
                key={`custom-${name}`}
                className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground border border-primary shadow-sm"
              >
                <span className="font-mono text-xs">r/{name}</span>
                <button
                  type="button"
                  onClick={() => removeCustomSubreddit(name)}
                  className="opacity-70 hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}

            {showAddInput ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-dashed border-primary/50 bg-background">
                <span className="text-xs text-muted-foreground font-mono">r/</span>
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
                  className="h-6 text-sm font-mono w-28 border-0 p-0 focus-visible:ring-0"
                  autoFocus
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddInput(true)}
                className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            )}
          </div>
        </div>
      )}

      {/* Data Sources - Clean horizontal layout */}
      <div className="space-y-3">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Data Sources
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Reddit - always included */}
          <div className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground border border-primary shadow-sm">
            <span>Reddit</span>
            <span className="text-xs opacity-80">
              {formatSourceCount(
                coverage.totalEstimatedPosts - (coverage.hackerNews?.estimatedPosts || 0) - (coverage.googlePlay?.estimatedPosts || 0) - (coverage.appStore?.estimatedPosts || 0),
                selectedSubreddits.size * FETCH_LIMITS.redditPerSub
              )}
            </span>
          </div>

          {coverage.hackerNews?.included && (
            <button
              type="button"
              onClick={() => toggleDataSource('Hacker News')}
              className={cn(
                'inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border transition-all',
                selectedDataSources.has('Hacker News')
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
              )}
            >
              <span>Hacker News</span>
              <span className={cn('text-xs', selectedDataSources.has('Hacker News') ? 'opacity-80' : 'opacity-50')}>
                {formatSourceCount(coverage.hackerNews.estimatedPosts, FETCH_LIMITS.hackerNews)}
              </span>
            </button>
          )}

          {coverage.googlePlay?.included && (
            <button
              type="button"
              onClick={() => toggleDataSource('Google Play')}
              className={cn(
                'inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border transition-all',
                selectedDataSources.has('Google Play')
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
              )}
            >
              <span>Google Play</span>
              <span className={cn('text-xs', selectedDataSources.has('Google Play') ? 'opacity-80' : 'opacity-50')}>
                {formatSourceCount(coverage.googlePlay.estimatedPosts, FETCH_LIMITS.googlePlay)}
              </span>
            </button>
          )}

          {coverage.appStore?.included && (
            <button
              type="button"
              onClick={() => toggleDataSource('App Store')}
              className={cn(
                'inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border transition-all',
                selectedDataSources.has('App Store')
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
              )}
            >
              <span>App Store</span>
              <span className={cn('text-xs', selectedDataSources.has('App Store') ? 'opacity-80' : 'opacity-50')}>
                {formatSourceCount(coverage.appStore.estimatedPosts, FETCH_LIMITS.appStore)}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Analysis Depth - Compact */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Analysis Depth
          </div>
          <span className="text-xs text-muted-foreground">
            {sampleSizePresets.find(p => p.value === sampleSize)?.description}
          </span>
        </div>
        <div className="flex gap-2">
          {sampleSizePresets.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => setSampleSize(preset.value)}
              className={cn(
                'flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all',
                sampleSize === preset.value
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sample Posts Preview */}
      {coverage.samplePosts && coverage.samplePosts.length > 0 && (() => {
        const validPosts = coverage.samplePosts.filter(post => {
          const title = post.title.toLowerCase()
          if (title.includes('[removed]') || title.includes('[deleted]')) return false
          if (title.includes('removed by moderator')) return false
          if (title.includes('deleted by user')) return false
          if (post.title.trim().length < 20) return false
          return true
        })

        if (validPosts.length === 0) return null

        return (
        <div className="space-y-3">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Example Posts
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {validPosts.slice(0, 4).map((post, i) => (
              <a
                key={i}
                href={`https://reddit.com${post.permalink}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-3 rounded-xl border bg-card hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs text-muted-foreground font-mono">r/{post.subreddit}</span>
                  {post.score > 0 && <span className="text-xs text-muted-foreground">• {post.score}↑</span>}
                </div>
                <span className="text-sm text-foreground line-clamp-2">{post.title}</span>
              </a>
            ))}
          </div>
        </div>
        )
      })()}

      {/* Settings Row - Geography & Pricing inline */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3 border-t border-b text-sm">
        {/* Geography */}
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          {showGeographyEditor ? (
            <div className="flex items-center gap-2">
              {(['local', 'national', 'global'] as GeographyScope[]).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => {
                    setGeographyScope(scope)
                    if (scope === 'global') setShowGeographyEditor(false)
                  }}
                  className={cn(
                    'px-2 py-1 rounded text-xs transition-colors',
                    targetGeography?.scope === scope
                      ? 'bg-primary/10 text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {scope === 'local' ? 'Local' : scope === 'national' ? 'National' : 'Global'}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowGeographyEditor(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Done
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowGeographyEditor(true)}
              className="text-foreground hover:text-primary transition-colors"
            >
              {targetGeography?.scope === 'global' || !targetGeography
                ? 'Global'
                : targetGeography.location || (targetGeography.scope === 'local' ? 'Local' : 'National')}
            </button>
          )}
        </div>

        <span className="text-muted-foreground/30">|</span>

        {/* Revenue Goal */}
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          {showPricingEditor ? (
            <div className="flex items-center gap-2">
              {mscPresets.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setMscTarget(preset.value)}
                  className={cn(
                    'px-2 py-1 rounded text-xs transition-colors',
                    mscTarget === preset.value
                      ? 'bg-primary/10 text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowPricingEditor(true)}
              className="text-foreground hover:text-primary transition-colors"
            >
              {mscPresets.find(p => p.value === mscTarget)?.label || `$${(mscTarget / 1000000).toFixed(1)}M`} goal
            </button>
          )}
        </div>

        <span className="text-muted-foreground/30">|</span>

        {/* Pricing */}
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          {showPricingEditor ? (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={targetPrice || ''}
                onChange={(e) => {
                  const val = e.target.value
                  if (val === '') setTargetPrice(0)
                  else {
                    const num = Number(val)
                    if (!isNaN(num) && num >= 0) setTargetPrice(num)
                  }
                }}
                onBlur={(e) => {
                  if (!e.target.value || Number(e.target.value) <= 0) setTargetPrice(29)
                }}
                placeholder="29"
                className="h-6 text-xs w-14 px-1"
                min={1}
              />
              <span className="text-xs text-muted-foreground">/mo</span>
              <button
                type="button"
                onClick={() => setShowPricingEditor(false)}
                className="text-xs text-muted-foreground hover:text-foreground ml-1"
              >
                Done
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowPricingEditor(true)}
              className="text-foreground hover:text-primary transition-colors"
            >
              ${targetPrice}/mo
            </button>
          )}
        </div>
      </div>

      {/* Validation warning */}
      {selectedSubreddits.size === 0 && (
        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Select at least one community to analyze
          </p>
        </div>
      )}

      {/* Action button */}
      <Button
        type="button"
        onClick={() => onProceed(getFinalCoverageData())}
        disabled={disabled || selectedSubreddits.size === 0}
        size="lg"
        className="w-full h-12 text-base"
      >
        {disabled ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Analyzing...
          </>
        ) : (
          <>
            Start Research
            <Sparkles className="ml-2 h-5 w-5" />
          </>
        )}
      </Button>
    </div>
  )
}
