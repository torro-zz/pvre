'use client'

import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle, AlertTriangle, Loader2, MessageCircle, Plus, X, Globe, MapPin, Building2, DollarSign, Target, FileText, ExternalLink, Sparkles, Database, Smartphone, SlidersHorizontal, Info, Search, Users } from 'lucide-react'
import { DataSourceBadge } from '@/components/ui/data-source-badge'
import { QualityPreviewModal, QualityPreviewData, shouldShowQualityWarning } from './quality-preview-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { StructuredHypothesis, TargetGeography, GeographyScope, detectGeographyFromAudience } from '@/types/research'
import type { AppDetails } from '@/lib/data-sources/types'
import type { ScoredApp } from '@/lib/data-sources'

export interface SubredditCoverage {
  name: string
  estimatedPosts: number
  relevanceScore: 'high' | 'medium' | 'low'
  postsPerDay?: number  // Posting velocity for adaptive time-stratified fetching
  subscribers?: number  // Subreddit subscriber count (verified from Reddit)
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
  totalSubscribers?: number  // Sum of subscriber counts across all subreddits (verified)
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
    apps?: ScoredApp[]  // Apps with relevance scores
  }
  appStore?: {
    included: boolean
    estimatedPosts: number
    samplePosts: SamplePost[]
    apps?: ScoredApp[]  // Apps with relevance scores
  }
  // Selected apps for research
  selectedApps?: AppDetails[]
  selectedDataSources?: string[] // User-selected sources to use
  // Sample size per source (how many reviews/posts to analyze)
  sampleSizePerSource?: number
  // App-centric analysis mode
  mode?: 'hypothesis' | 'app-analysis'
  appData?: AppDetails | null
  // Display fields (for dashboard recognition)
  originalInput?: string   // What the user originally typed
  shortTitle?: string      // AI-cleaned short title for display
  // Quality preview (pre-research relevance prediction)
  qualityPreview?: QualityPreviewData
  // Sample posts used for quality preview (for caching during refinement)
  qualitySamplePosts?: SamplePost[]
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
  // Display fields (for dashboard recognition)
  originalInput?: string
  shortTitle?: string
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

// Helper to format large numbers compactly
function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return n.toString()
}

export function CoveragePreview({
  hypothesis,
  structuredHypothesis,
  onProceed,
  onRefine,
  disabled = false,
  mode = 'hypothesis',
  appData,
  originalInput,
  shortTitle,
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

  // Quality preview modal state
  const [showQualityModal, setShowQualityModal] = useState(false)

  // Cached sample posts for consistent quality scoring during refinement
  const [cachedQualitySamplePosts, setCachedQualitySamplePosts] = useState<SamplePost[] | null>(null)

  // Data sources state
  const [selectedDataSources, setSelectedDataSources] = useState<Set<string>>(new Set(['Reddit']))

  // App selection state (for Google Play and App Store)
  const [selectedGooglePlayApps, setSelectedGooglePlayApps] = useState<Set<string>>(new Set())
  const [selectedAppStoreApps, setSelectedAppStoreApps] = useState<Set<string>>(new Set())

  // Sample size state (reviews/posts per source)
  const [sampleSize, setSampleSize] = useState<number>(150) // Default Quick (150), uses adaptive time windows

  // Beta: Relevance check toggle (persisted in localStorage)
  const [showRelevanceCheck, setShowRelevanceCheck] = useState<boolean>(true)

  // Load and persist relevance check preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('pvre-show-relevance-check')
    if (saved === 'false') {
      setShowRelevanceCheck(false)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('pvre-show-relevance-check', String(showRelevanceCheck))
  }, [showRelevanceCheck])

  // MSC presets
  const mscPresets = [
    { value: 100000, label: '$100k', description: 'Lifestyle business' },
    { value: 500000, label: '$500k', description: 'Sustainable small business' },
    { value: 1000000, label: '$1M', description: 'Growth business' },
    { value: 10000000, label: '$10M+', description: 'Venture-scale' },
  ]

  // Sample size presets (posts/comments per subreddit)
  // Adaptive time-stratified fetching ensures good coverage across time periods
  const sampleSizePresets = [
    { value: 150, label: 'Quick', description: '2+ months coverage' },
    { value: 300, label: 'Standard', description: '6+ months coverage' },
    { value: 450, label: 'Deep', description: 'Full year coverage' },
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
          // Pass cached sample posts for consistent quality scoring during refinement
          cachedSamplePosts: cachedQualitySamplePosts || undefined,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Coverage check failed')
      }

      const data = await res.json()
      setCoverage(data)

      // Cache sample posts for consistent quality scoring during refinement
      // Only cache on first successful check (when we don't have cached posts yet)
      if (!cachedQualitySamplePosts && data.qualitySamplePosts?.length > 0) {
        setCachedQualitySamplePosts(data.qualitySamplePosts)
      }

      // Only auto-select high and medium relevance subreddits
      // Low-relevance subreddits are shown but NOT pre-selected (user can opt-in)
      const highMediumSubs = data.subreddits?.filter(
        (s: SubredditCoverage) => s.relevanceScore === 'high' || s.relevanceScore === 'medium'
      ) || []
      const names: string[] = highMediumSubs.map((s: SubredditCoverage) => s.name)
      setSelectedSubreddits(new Set(names))
      setCustomSubreddits([])

      // Auto-select all discovered apps by default (only those that passed relevance filter)
      if (data.googlePlay?.apps) {
        setSelectedGooglePlayApps(new Set(data.googlePlay.apps.map((a: ScoredApp) => a.appId)))
      }
      if (data.appStore?.apps) {
        setSelectedAppStoreApps(new Set(data.appStore.apps.map((a: ScoredApp) => a.appId)))
      }

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

    // Collect selected apps from both stores
    const selectedApps: AppDetails[] = [
      ...(coverage.googlePlay?.apps?.filter(a => selectedGooglePlayApps.has(a.appId)) || []),
      ...(coverage.appStore?.apps?.filter(a => selectedAppStoreApps.has(a.appId)) || []),
    ]

    return {
      ...coverage,
      userSelectedSubreddits: Array.from(selectedSubreddits),
      userAddedSubreddits: customSubreddits,
      targetGeography: targetGeography,
      mscTarget: mscTarget,
      targetPrice: targetPrice,
      selectedDataSources: Array.from(selectedDataSources),
      sampleSizePerSource: sampleSize,
      selectedApps: selectedApps,
      // App-centric analysis mode
      mode: mode,
      appData: appData,
      // Display fields (for dashboard recognition)
      originalInput: originalInput,
      shortTitle: shortTitle,
    }
  }

  // Handle start research - only show modal for STRONG warnings
  const handleStartResearch = () => {
    if (!coverage) return

    // Only block with modal for strong_warning (very low relevance < 8%)
    // Caution and none now show inline and don't require a modal
    if (coverage.qualityPreview?.qualityWarning === 'strong_warning') {
      setShowQualityModal(true)
      return
    }

    // Caution or no warning - proceed directly (user saw inline preview)
    onProceed(getFinalCoverageData())
  }

  // Called when user confirms in the quality modal
  const handleQualityConfirm = () => {
    onProceed(getFinalCoverageData())
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

  // Toggle Google Play app selection
  const toggleGooglePlayApp = (appId: string) => {
    setSelectedGooglePlayApps(prev => {
      const next = new Set(prev)
      if (next.has(appId)) {
        next.delete(appId)
      } else {
        next.add(appId)
      }
      return next
    })
  }

  // Toggle App Store app selection
  const toggleAppStoreApp = (appId: string) => {
    setSelectedAppStoreApps(prev => {
      const next = new Set(prev)
      if (next.has(appId)) {
        next.delete(appId)
      } else {
        next.add(appId)
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
              {mode === 'app-analysis'
                ? 'Preparing app store review analysis'
                : 'Scanning Reddit for relevant discussions'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!coverage) return null

  const config = confidenceConfig[coverage.dataConfidence]
  const Icon = config.icon

  // ============================================================
  // APP GAP MODE - Simplified UI showing app stores as primary
  // ============================================================
  if (mode === 'app-analysis' && appData) {
    return (
      <div className="space-y-4">
        {/* App Being Analyzed */}
        <div className="p-4 rounded-xl border bg-card">
          <div className="flex items-start gap-4">
            {appData.iconUrl && (
              <img
                src={appData.iconUrl}
                alt={appData.name}
                className="w-16 h-16 rounded-xl shadow-sm"
              />
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate">{appData.name}</h3>
              <p className="text-sm text-muted-foreground truncate">{appData.developer}</p>
              <div className="flex items-center gap-3 mt-1 text-sm">
                <span className="flex items-center gap-1">
                  <span className="text-amber-500">★</span>
                  {appData.rating?.toFixed(1) || 'N/A'}
                </span>
                <span className="text-muted-foreground">
                  {appData.reviewCount?.toLocaleString() || '0'} reviews
                </span>
                <span className="text-muted-foreground">
                  {appData.category}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Review Sources - App Stores */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Review Sources
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* App Store - show if available or if source is iOS */}
            <div className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-primary text-primary-foreground border border-primary shadow-sm">
              <span>📱</span>
              <span>App Store</span>
              <span className="text-xs opacity-80">
                {sampleSize} reviews
              </span>
            </div>
            {/* Google Play - show if cross-store lookup available */}
            <div className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-primary text-primary-foreground border border-primary shadow-sm">
              <span>🤖</span>
              <span>Google Play</span>
              <span className="text-xs opacity-80">
                {sampleSize} reviews
              </span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            We'll analyze up to {sampleSize * 2} reviews to find pain points and opportunities
          </p>
        </div>

        {/* Analysis Depth - Same as hypothesis mode */}
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

        {/* Settings Row - Geography & Pricing */}
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

        {/* Action button */}
        <Button
          type="button"
          onClick={() => onProceed(getFinalCoverageData())}
          disabled={disabled}
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
              Analyze App
              <Sparkles className="ml-2 h-5 w-5" />
            </>
          )}
        </Button>
      </div>
    )
  }

  // ============================================================
  // HYPOTHESIS MODE - Full Reddit-centric UI
  // ============================================================
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
            // Sum actual estimatedPosts from selected discovered subreddits (capped by sampleSize each)
            let redditCount = 0
            for (const sub of coverage.subreddits) {
              if (selectedSubreddits.has(sub.name)) {
                // If subreddit has fewer posts than API limit (100), use actual count. Otherwise use sampleSize.
                redditCount += sub.estimatedPosts < 100 ? sub.estimatedPosts : sampleSize
              }
            }
            // Add estimated count for custom subreddits (assume sampleSize per custom sub)
            redditCount += customSubreddits.length * sampleSize

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
          {/* Total Community Members - Verified Data */}
          {coverage.totalSubscribers && coverage.totalSubscribers > 0 && (
            <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total community members</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{formatNumber(coverage.totalSubscribers)}</span>
                <DataSourceBadge type="verified" showLabel={false} />
              </div>
            </div>
          )}
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
                  <span className={cn('text-xs', isSelected ? 'opacity-80' : 'opacity-50')}>
                    {/* If subreddit has fewer posts than API limit (100), show actual count. Otherwise show sampleSize (what we'll fetch) */}
                    {sub.estimatedPosts < 100 ? sub.estimatedPosts : sampleSize}
                  </span>
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

      {/* Discussion Sources - Reddit and Hacker News */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Discussion Sources
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* Reddit - always included */}
          <div className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground border border-primary shadow-sm">
            <span>Reddit</span>
            <span className="text-xs opacity-80">
              {(() => {
                // Calculate what we'll actually fetch (matches individual subreddit badge logic)
                let toAnalyze = 0
                for (const sub of coverage.subreddits) {
                  if (selectedSubreddits.has(sub.name)) {
                    // If subreddit has fewer posts than API limit (100), use actual count. Otherwise use sampleSize.
                    toAnalyze += sub.estimatedPosts < 100 ? sub.estimatedPosts : sampleSize
                  }
                }
                // Add custom subreddits (estimate sampleSize each)
                toAnalyze += customSubreddits.length * sampleSize

                return toAnalyze.toLocaleString()
              })()}
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
        </div>
      </div>

      {/* App Reviews - Google Play and App Store with toggle-all */}
      {((coverage.googlePlay?.included && coverage.googlePlay.apps && coverage.googlePlay.apps.length > 0) ||
        (coverage.appStore?.included && coverage.appStore.apps && coverage.appStore.apps.length > 0)) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                App Reviews (optional)
              </div>
            </div>
            {/* Toggle All button */}
            <button
              type="button"
              onClick={() => {
                const hasAnySelected = selectedGooglePlayApps.size > 0 || selectedAppStoreApps.size > 0
                if (hasAnySelected) {
                  // Deselect all
                  setSelectedGooglePlayApps(new Set())
                  setSelectedAppStoreApps(new Set())
                } else {
                  // Select all
                  setSelectedGooglePlayApps(new Set(coverage.googlePlay?.apps?.map(a => a.appId) || []))
                  setSelectedAppStoreApps(new Set(coverage.appStore?.apps?.map(a => a.appId) || []))
                }
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {(selectedGooglePlayApps.size > 0 || selectedAppStoreApps.size > 0) ? 'Disable all' : 'Enable all'}
            </button>
          </div>

          {/* Google Play Apps */}
          {coverage.googlePlay?.included && coverage.googlePlay.apps && coverage.googlePlay.apps.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 pl-1">
                <span className="text-xs text-muted-foreground">
                  Google Play · {selectedGooglePlayApps.size} of {coverage.googlePlay.apps.length} apps
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {coverage.googlePlay.apps.map((app) => {
                  const isSelected = selectedGooglePlayApps.has(app.appId)
                  // Get relevance score badge color
                  const scoreColor = app.relevanceScore >= 8 ? 'text-emerald-500' :
                                     app.relevanceScore >= 6 ? 'text-blue-500' :
                                     app.relevanceScore >= 4 ? 'text-amber-500' : 'text-red-500'
                  return (
                    <button
                      key={app.appId}
                      type="button"
                      onClick={() => toggleGooglePlayApp(app.appId)}
                      title={app.relevanceReason || 'Relevance score not available'}
                      className={cn(
                        'inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition-all',
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                      )}
                    >
                      {app.iconUrl && (
                        <img
                          src={app.iconUrl}
                          alt=""
                          className="w-5 h-5 rounded"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      )}
                      <div className="text-left">
                        <div className="font-medium text-xs leading-tight truncate max-w-[120px]">{app.name}</div>
                        <div className={cn('text-[10px] leading-tight flex items-center gap-1', isSelected ? 'opacity-70' : 'opacity-50')}>
                          <span>⭐{app.rating.toFixed(1)}</span>
                          <span>·</span>
                          <span>{app.reviewCount.toLocaleString()} reviews</span>
                          {app.relevanceScore !== undefined && (
                            <>
                              <span>·</span>
                              <span className={cn('font-medium', isSelected ? '' : scoreColor)}>
                                {app.relevanceScore}/10
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* App Store Apps */}
          {coverage.appStore?.included && coverage.appStore.apps && coverage.appStore.apps.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 pl-1">
                <span className="text-xs text-muted-foreground">
                  App Store · {selectedAppStoreApps.size} of {coverage.appStore.apps.length} apps
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {coverage.appStore.apps.map((app) => {
                  const isSelected = selectedAppStoreApps.has(app.appId)
                  // Get relevance score badge color
                  const scoreColor = app.relevanceScore >= 8 ? 'text-emerald-500' :
                                     app.relevanceScore >= 6 ? 'text-blue-500' :
                                     app.relevanceScore >= 4 ? 'text-amber-500' : 'text-red-500'
                  return (
                    <button
                      key={app.appId}
                      type="button"
                      onClick={() => toggleAppStoreApp(app.appId)}
                      title={app.relevanceReason || 'Relevance score not available'}
                      className={cn(
                        'inline-flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition-all',
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                      )}
                    >
                      {app.iconUrl && (
                        <img
                          src={app.iconUrl}
                          alt=""
                          className="w-5 h-5 rounded"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      )}
                      <div className="text-left">
                        <div className="font-medium text-xs leading-tight truncate max-w-[120px]">{app.name}</div>
                        <div className={cn('text-[10px] leading-tight flex items-center gap-1', isSelected ? 'opacity-70' : 'opacity-50')}>
                          <span>⭐{app.rating.toFixed(1)}</span>
                          <span>·</span>
                          <span>{app.reviewCount.toLocaleString()} reviews</span>
                          {app.relevanceScore !== undefined && (
                            <>
                              <span>·</span>
                              <span className={cn('font-medium', isSelected ? '' : scoreColor)}>
                                {app.relevanceScore}/10
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

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

      {/* Beta: Relevance Check - Simple binary feedback with toggle */}
      {coverage?.qualityPreview && (
        <div className="rounded-xl border border-border/60 overflow-hidden">
          {/* Header with Beta badge and toggle */}
          <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border/40">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Relevance Check</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-600 dark:text-violet-400 font-medium uppercase tracking-wide">Beta</span>
            </div>
            <button
              type="button"
              onClick={() => setShowRelevanceCheck(!showRelevanceCheck)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {showRelevanceCheck ? 'Hide' : 'Show'}
            </button>
          </div>

          {/* Content - only shown when toggled on */}
          {showRelevanceCheck && (
            <div className={cn(
              "p-4",
              coverage.qualityPreview.qualityWarning === 'none'
                ? "bg-emerald-50/50 dark:bg-emerald-950/20"
                : "bg-amber-50/50 dark:bg-amber-950/20"
            )}>
              <div className="flex items-start gap-3">
                {coverage.qualityPreview.qualityWarning === 'none' ? (
                  <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                )}
                <div className="space-y-1">
                  {/* Simple binary message - no percentages */}
                  <p className={cn(
                    "text-sm font-medium",
                    coverage.qualityPreview.qualityWarning === 'none'
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-amber-700 dark:text-amber-400"
                  )}>
                    {coverage.qualityPreview.qualityWarning === 'none'
                      ? "Good match — Your search aligns well with these communities"
                      : "Broad search — AI will filter to find relevant discussions"
                    }
                  </p>
                  {/* Clear explanation of how we know this */}
                  <p className="text-xs text-muted-foreground">
                    Tested {coverage.qualityPreview.sampleSize || 40} sample posts from selected communities
                  </p>
                  {/* Suggestion if available and not a good match */}
                  {coverage.qualityPreview.suggestion && coverage.qualityPreview.qualityWarning !== 'none' && (
                    <p className="text-xs text-muted-foreground mt-2">
                      <span className="font-medium">Tip:</span> {coverage.qualityPreview.suggestion}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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
        onClick={handleStartResearch}
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

      {/* Quality Preview Modal */}
      {coverage?.qualityPreview && (
        <QualityPreviewModal
          open={showQualityModal}
          onOpenChange={setShowQualityModal}
          qualityData={coverage.qualityPreview}
          onProceed={handleQualityConfirm}
          onRefine={onRefine}
        />
      )}
    </div>
  )
}
