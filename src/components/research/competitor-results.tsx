'use client'

import { useState, useMemo } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Building2,
  Target,
  TrendingUp,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  BarChart3,
  DollarSign,
  Users,
  Zap,
  AlertTriangle,
  Shield,
  Info,
  TrendingDown,
  CircleDot,
  Tag,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react'
import { CompetitorIntelligenceResult } from '@/app/api/research/competitor-intelligence/route'
import type { ComparativeMentionsResult } from '@/lib/analysis/comparative-mentions'
import { extractCompetitorPricing, type PricingSuggestion } from '@/lib/analysis/pricing-utils'

interface CompetitorResultsProps {
  results: CompetitorIntelligenceResult
}

export function CompetitorResults({ results }: CompetitorResultsProps) {
  const [expandedCompetitor, setExpandedCompetitor] = useState<string | null>(null)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(['marketOverview', 'platformsCommunities', 'comparisonMatrix', 'comparativeMentions', 'adjacentTools'])) // Secondary sections collapsed by default
  const [showAllPlatforms, setShowAllPlatforms] = useState(false)
  const [showAllAdjacent, setShowAllAdjacent] = useState(false)
  const INITIAL_DISPLAY_COUNT = 3

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  // Calculate pricing suggestion from competitors
  const pricingSuggestion = useMemo<PricingSuggestion>(() => {
    return extractCompetitorPricing(results.competitors)
  }, [results.competitors])

  const toggleCompetitor = (name: string) => {
    setExpandedCompetitor(expandedCompetitor === name ? null : name)
  }

  const getIntensityColor = (intensity: string) => {
    switch (intensity) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800'
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800'
      default:
        return 'bg-muted text-muted-foreground border-border'
    }
  }

  const getMaturityColor = (maturity: string) => {
    switch (maturity) {
      case 'emerging':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-400'
      case 'growing':
        return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400'
      case 'mature':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400'
      case 'declining':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-400'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const getDifficultyBadge = (difficulty: string) => {
    switch (difficulty) {
      case 'low':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800">Low Effort</Badge>
      case 'medium':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800">Medium Effort</Badge>
      case 'high':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800">High Effort</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 7.5) return 'text-green-600 dark:text-green-400'
    if (score >= 5) return 'text-yellow-600 dark:text-yellow-400'
    if (score >= 2.5) return 'text-orange-600 dark:text-orange-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getScoreBgColor = (score: number) => {
    if (score >= 7.5) return 'bg-green-500'
    if (score >= 5) return 'bg-yellow-500'
    if (score >= 2.5) return 'bg-orange-500'
    return 'bg-red-500'
  }

  const getImpactColor = (impact: number) => {
    if (impact > 0) return 'text-green-600 dark:text-green-400'
    if (impact < 0) return 'text-red-600 dark:text-red-400'
    return 'text-muted-foreground'
  }

  const getImpactIcon = (impact: number) => {
    if (impact > 0) return <TrendingUp className="h-3 w-3" />
    if (impact < 0) return <TrendingDown className="h-3 w-3" />
    return <CircleDot className="h-3 w-3" />
  }

  // Categorize competitors as Direct, Platform, or Adjacent
  type CompetitorCategory = 'direct' | 'platform' | 'adjacent'

  const categorizeCompetitor = (competitor: typeof results.competitors[0]): CompetitorCategory => {
    // FIRST: Check threat level and market share - real competitors should be "direct"
    // regardless of keywords in their description (e.g., "communication platform")
    // Only truly minor players (low threat + small share) might be platforms or adjacent
    if (competitor.threatLevel === 'high' ||
        competitor.threatLevel === 'medium' ||
        competitor.marketShareEstimate === 'dominant' ||
        competitor.marketShareEstimate === 'significant' ||
        competitor.marketShareEstimate === 'moderate') {
      return 'direct'
    }

    const positioningLower = competitor.positioning?.toLowerCase() || ''
    const descriptionLower = competitor.description?.toLowerCase() || ''
    const nameLower = competitor.name.toLowerCase()
    const text = `${positioningLower} ${descriptionLower} ${nameLower}`

    // Platform indicators - community, launch platform, forum
    // Only checked for non-high-threat competitors
    const platformKeywords = [
      'platform', 'community', 'forum', 'launch', 'directory',
      'marketplace', 'product hunt', 'indie hackers', 'betalist',
      'hacker news', 'reddit', 'listing', 'social network',
      'accelerator', 'incubator', 'network'
    ]

    // Adjacent tool indicators - tools that do something else
    const adjacentKeywords = [
      'email', 'survey', 'form', 'analytics', 'marketing automation',
      'crm', 'acquisition', 'newsletter', 'landing page', 'payments',
      'invoicing', 'accounting', 'project management', 'mailchimp',
      'typeform', 'google forms', 'hubspot', 'stripe'
    ]

    // Check for platform indicators (only for low/medium threat)
    for (const keyword of platformKeywords) {
      if (text.includes(keyword)) {
        return 'platform'
      }
    }

    // Check for adjacent tool indicators
    for (const keyword of adjacentKeywords) {
      if (text.includes(keyword)) {
        return 'adjacent'
      }
    }

    // Default: assume direct competitor (better to be cautious)
    return 'direct'
  }

  // Group competitors by category, filtering out the analyzed app itself
  const categorizedCompetitors = useMemo(() => {
    const grouped: Record<CompetitorCategory, typeof results.competitors> = {
      direct: [],
      platform: [],
      adjacent: []
    }

    // Use the explicit analyzedAppName from result (App Gap mode only)
    // Format: "appname" or "appname|developer" (e.g., "chatgpt|openai")
    // Hypothesis mode: analyzedAppName is null, so no self-filtering
    const selfFilter = results.analyzedAppName?.toLowerCase().trim() || null
    // Parse out app name and developer name for filtering
    const selfNames = selfFilter?.split('|').filter(Boolean) || []

    results.competitors
      .filter((competitor) => {
        // Only filter in App Gap mode (when selfFilter is set)
        if (selfNames.length === 0) return true
        const competitorNameLower = competitor.name.toLowerCase().trim()
        // Exclude if competitor matches ANY of the self names (app name or developer)
        return !selfNames.some(selfName =>
          competitorNameLower === selfName ||
          competitorNameLower.includes(selfName) ||
          selfName.includes(competitorNameLower)
        )
      })
      .forEach((competitor) => {
        const category = categorizeCompetitor(competitor)
        grouped[category].push(competitor)
      })

    return grouped
  }, [results.competitors, results.analyzedAppName])

  // Normalize and filter competitor matrix
  // Handles both old format { name, scores: number[] } and new format { competitorName, scores: { category, score, notes }[] }
  const filteredCompetitorMatrix = useMemo(() => {
    if (!results.competitorMatrix?.comparison || !results.competitorMatrix?.categories) {
      return { categories: [], comparison: [] }
    }

    const categories = results.competitorMatrix.categories
    // Use the explicit analyzedAppName from result (App Gap mode only)
    // Format: "appname" or "appname|developer" (e.g., "chatgpt|openai")
    const selfFilter = results.analyzedAppName?.toLowerCase().trim() || null
    const selfNames = selfFilter?.split('|').filter(Boolean) || []

    // Get competitor names from competitors array for cross-referencing
    const competitorNamesFromArray = results.competitors?.map(c => c.name) || []

    // Normalize comparison entries to expected format
    const normalizedComparison = results.competitorMatrix.comparison
      .map((comp, index) => {
        // Handle both 'competitorName' and 'name' field names
        let competitorName = comp.competitorName || (comp as { name?: string }).name || 'Unknown'

        // Cross-reference: if still "Unknown", try to map by index to competitors array
        if (competitorName === 'Unknown' && competitorNamesFromArray[index]) {
          competitorName = competitorNamesFromArray[index]
        }

        // Handle both array of objects and array of numbers for scores
        let scores: { category: string; score: number; notes?: string }[]
        if (Array.isArray(comp.scores) && comp.scores.length > 0) {
          if (typeof comp.scores[0] === 'number') {
            // Scores is number[] - convert to { category, score, notes }[]
            scores = (comp.scores as unknown as number[]).map((score, index) => ({
              category: categories[index] || `Category ${index + 1}`,
              score: typeof score === 'number' ? score : 0,
              notes: ''
            }))
          } else {
            // Already in expected format
            scores = comp.scores as { category: string; score: number; notes?: string }[]
          }
        } else {
          scores = []
        }

        return { competitorName, scores }
      })
      // Filter out analyzed app from its own competitor list (App Gap mode only)
      .filter((comp) => {
        if (selfNames.length === 0) return true
        const compNameLower = comp.competitorName.toLowerCase().trim()
        // Exclude if competitor matches ANY of the self names (app name or developer)
        return !selfNames.some(selfName =>
          compNameLower === selfName ||
          compNameLower.includes(selfName) ||
          selfName.includes(compNameLower)
        )
      })

    return { categories, comparison: normalizedComparison }
  }, [results.competitorMatrix, results.analyzedAppName])

  const hasDirectCompetitors = categorizedCompetitors.direct.length > 0
  const hasPlatformCompetitors = categorizedCompetitors.platform.length > 0
  const hasAdjacentCompetitors = categorizedCompetitors.adjacent.length > 0

  // Type-safe access to competition score
  const competitionScore = (results as { competitionScore?: {
    score: number
    confidence: 'low' | 'medium' | 'high'
    reasoning: string
    factors: {
      competitorCount: { value: number; impact: number }
      fundingLevels: { description: string; impact: number }
      userSatisfaction: { average: number; impact: number }
      marketGaps: { count: number; impact: number }
      priceHeadroom: { exists: boolean; impact: number }
    }
    threats: string[]
  }}).competitionScore

  // Type-safe access to comparative mentions (real user data)
  const comparativeMentions = (results as { comparativeMentions?: ComparativeMentionsResult }).comparativeMentions

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Related Products</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {results.metadata.competitorsAnalyzed}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {categorizedCompetitors.direct.length} direct, {categorizedCompetitors.platform.length + categorizedCompetitors.adjacent.length} adjacent
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Market Gaps</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {results.gaps.length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Competition</span>
            </div>
            <p className="text-2xl font-bold mt-1 capitalize">
              {results.marketOverview.competitionIntensity}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Entry Difficulty</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {competitionScore?.score?.toFixed(1) || '—'}/10
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {(competitionScore?.score ?? 0) >= 7 ? 'High barrier to entry' :
               (competitionScore?.score ?? 0) >= 5 ? 'Moderate barrier' :
               (competitionScore?.score ?? 0) >= 3 ? 'Low barrier' : 'Open market'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Competitor Pricing Intelligence */}
      {pricingSuggestion.competitorsWithPricing > 0 && (
        <Card className="border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/30">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Tag className="h-5 w-5 text-green-600" />
                  Competitor Pricing Intelligence
                </CardTitle>
                <CardDescription className="mt-1">
                  Based on {pricingSuggestion.competitorsWithPricing} of {pricingSuggestion.totalCompetitors} competitors with pricing data
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className={
                  pricingSuggestion.confidence === 'high'
                    ? 'border-green-500 text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-950'
                    : pricingSuggestion.confidence === 'medium'
                    ? 'border-yellow-500 text-yellow-700 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-950'
                    : 'border-muted-foreground text-muted-foreground'
                }
              >
                {pricingSuggestion.confidence} confidence
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              {/* Suggested Price */}
              <div className="p-4 rounded-lg bg-card border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
                  Suggested Price
                </div>
                <p className="text-3xl font-bold text-green-700 dark:text-green-400">
                  ${pricingSuggestion.suggestedPrice}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Median competitor price
                </p>
              </div>

              {/* Price Range */}
              {pricingSuggestion.priceRange && (
                <div className="p-4 rounded-lg bg-card border">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <BarChart3 className="h-4 w-4" />
                    Market Price Range
                  </div>
                  <p className="text-2xl font-semibold">
                    ${pricingSuggestion.priceRange.min} - ${pricingSuggestion.priceRange.max}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Avg: ${pricingSuggestion.averagePrice}/mo
                  </p>
                </div>
              )}

              {/* Pricing Models */}
              <div className="p-4 rounded-lg bg-card border">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Tag className="h-4 w-4" />
                  Common Models
                </div>
                <div className="flex flex-wrap gap-1">
                  {pricingSuggestion.pricingModels.slice(0, 4).map((model, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {model}
                    </Badge>
                  ))}
                  {pricingSuggestion.pricingModels.length === 0 && (
                    <span className="text-xs text-muted-foreground">Not specified</span>
                  )}
                </div>
              </div>
            </div>

            {/* Pricing Insight */}
            <div className="mt-3 p-2 rounded bg-blue-50 dark:bg-blue-950 border border-blue-100 dark:border-blue-800 flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Use this pricing as a starting point for your market sizing calculations.
                {pricingSuggestion.priceRange && pricingSuggestion.priceRange.max > pricingSuggestion.priceRange.min * 3 && (
                  <span className="block mt-1">
                    Wide price range suggests opportunity for both budget and premium positioning.
                  </span>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Competition Score Analysis - NEW for Viability Verdict */}
      {competitionScore && (
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Competition Score Analysis
                </CardTitle>
                <CardDescription>
                  Competitive landscape assessment for market entry viability
                </CardDescription>
              </div>
              <div className="text-right">
                <div className={`text-3xl font-bold ${getScoreColor(competitionScore.score)}`}>
                  {competitionScore.score}/10
                </div>
                <div className="text-xs text-muted-foreground mt-1" title="How reliable is this analysis based on available data">
                  Data quality:{' '}
                  <span className={
                    competitionScore.confidence === 'high'
                      ? 'text-green-600 font-medium'
                      : competitionScore.confidence === 'medium'
                      ? 'text-yellow-600 font-medium'
                      : 'text-gray-500 font-medium'
                  }>
                    {competitionScore.confidence}
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Score Progress Bar */}
            <div className="space-y-1">
              <Progress
                value={competitionScore.score * 10}
                className="h-3"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Difficult Entry</span>
                <span>Easy Entry</span>
              </div>
            </div>

            {/* Reasoning */}
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm text-muted-foreground">{competitionScore.reasoning}</p>
            </div>

            {/* Factor Breakdown */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Score Factors
              </h4>
              <div className="grid gap-2">
                {/* Competitor Count */}
                <div className="flex items-center justify-between py-2 border-b">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Competitor Count</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{competitionScore.factors.competitorCount.value} competitors</span>
                    <span className={`flex items-center gap-1 text-xs ${getImpactColor(competitionScore.factors.competitorCount.impact)}`}>
                      {getImpactIcon(competitionScore.factors.competitorCount.impact)}
                      {competitionScore.factors.competitorCount.impact > 0 ? '+' : ''}{competitionScore.factors.competitorCount.impact}
                    </span>
                  </div>
                </div>

                {/* Funding Levels */}
                <div className="flex items-center justify-between py-2 border-b">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Funding Levels</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{competitionScore.factors.fundingLevels.description || 'Unknown'}</span>
                    <span className={`flex items-center gap-1 text-xs ${getImpactColor(competitionScore.factors.fundingLevels.impact)}`}>
                      {getImpactIcon(competitionScore.factors.fundingLevels.impact)}
                      {competitionScore.factors.fundingLevels.impact > 0 ? '+' : ''}{competitionScore.factors.fundingLevels.impact}
                    </span>
                  </div>
                </div>

                {/* User Satisfaction */}
                <div className="flex items-center justify-between py-2 border-b">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">User Satisfaction</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {competitionScore.factors.userSatisfaction.average > 0
                        ? `${competitionScore.factors.userSatisfaction.average}/5 avg`
                        : 'Unknown'}
                    </span>
                    <span className={`flex items-center gap-1 text-xs ${getImpactColor(competitionScore.factors.userSatisfaction.impact)}`}>
                      {getImpactIcon(competitionScore.factors.userSatisfaction.impact)}
                      {competitionScore.factors.userSatisfaction.impact > 0 ? '+' : ''}{competitionScore.factors.userSatisfaction.impact}
                    </span>
                  </div>
                </div>

                {/* Market Gaps */}
                <div className="flex items-center justify-between py-2 border-b">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Market Gaps</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{competitionScore.factors.marketGaps.count} identified</span>
                    <span className={`flex items-center gap-1 text-xs ${getImpactColor(competitionScore.factors.marketGaps.impact)}`}>
                      {getImpactIcon(competitionScore.factors.marketGaps.impact)}
                      {competitionScore.factors.marketGaps.impact > 0 ? '+' : ''}{competitionScore.factors.marketGaps.impact}
                    </span>
                  </div>
                </div>

                {/* Price Headroom */}
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Price Headroom</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {competitionScore.factors.priceHeadroom.exists ? 'Yes' : 'Limited'}
                    </span>
                    <span className={`flex items-center gap-1 text-xs ${getImpactColor(competitionScore.factors.priceHeadroom.impact)}`}>
                      {getImpactIcon(competitionScore.factors.priceHeadroom.impact)}
                      {competitionScore.factors.priceHeadroom.impact > 0 ? '+' : ''}{competitionScore.factors.priceHeadroom.impact}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Threats */}
            {competitionScore.threats.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2 text-orange-600 dark:text-orange-400">
                  <AlertTriangle className="h-4 w-4" />
                  Threats to Watch
                </h4>
                <ul className="space-y-1">
                  {competitionScore.threats.map((threat, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-orange-500 mt-0.5">!</span>
                      <span className="text-muted-foreground">{threat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Info */}
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950 rounded p-2">
              <Info className="h-4 w-4 text-blue-500 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <span>
                Higher scores indicate easier market entry. This score factors into your overall Viability Verdict
                (25% weight). Positive impacts improve your score, negative impacts indicate challenges.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Market Overview - Collapsible */}
      <Card>
        <CardHeader className="pb-3">
          <button
            onClick={() => toggleSection('marketOverview')}
            className="flex items-center justify-between w-full text-left"
          >
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Market Overview
            </CardTitle>
            <div className="flex items-center gap-2">
              {collapsedSections.has('marketOverview') && (
                <span className="text-sm text-muted-foreground">
                  {results.marketOverview.competitionIntensity} competition
                </span>
              )}
              <ChevronDown className={`h-5 w-5 transition-transform ${!collapsedSections.has('marketOverview') ? 'rotate-180' : ''}`} />
            </div>
          </button>
        </CardHeader>
        {!collapsedSections.has('marketOverview') && (
          <CardContent className="pt-0">
            <p className="text-muted-foreground mb-4">{results.marketOverview.summary}</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">Market Size</span>
                <p className="font-medium">{results.marketOverview.marketSize}</p>
              </div>
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">Growth Trend</span>
                <p className="font-medium">{results.marketOverview.growthTrend}</p>
              </div>
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">Maturity</span>
                <Badge className={getMaturityColor(results.marketOverview.maturityLevel)}>
                  {results.marketOverview.maturityLevel}
                </Badge>
              </div>
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">Competition</span>
                <Badge className={getIntensityColor(results.marketOverview.competitionIntensity)}>
                  {results.marketOverview.competitionIntensity}
                </Badge>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Competitor Analysis - Single Scrollable Page */}
      <div className="space-y-6">
        {/* Blue Ocean Notice - if no direct competitors */}
        {!hasDirectCompetitors && (hasPlatformCompetitors || hasAdjacentCompetitors) && (
          <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
                  <Target className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-emerald-800 dark:text-emerald-300">No Direct Competitors Identified</h3>
                  <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-1">
                    This appears to be a <strong>blue ocean opportunity</strong>. While we found related alternatives, no existing products directly address this exact problem in the same way.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Direct Competitors */}
        {hasDirectCompetitors && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-red-600" />
              <h3 className="text-lg font-semibold">Direct Competitors ({categorizedCompetitors.direct.length})</h3>
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800">
                Watch closely
              </Badge>
            </div>
            <div className="space-y-3">
              {categorizedCompetitors.direct.map((competitor) => (
                <CompetitorCard
                  key={competitor.name}
                  competitor={competitor}
                  expanded={expandedCompetitor === competitor.name}
                  onToggle={() => toggleCompetitor(competitor.name)}
                  categoryBadge={<Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800 text-xs">Direct</Badge>}
                />
              ))}
            </div>
          </div>
        )}

        {/* Comparison Matrix - Collapsible, only shown if direct competitors exist */}
        {hasDirectCompetitors && filteredCompetitorMatrix?.comparison?.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <button
                onClick={() => toggleSection('comparisonMatrix')}
                className="flex items-center justify-between w-full text-left"
              >
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Comparison Matrix
                </CardTitle>
                <div className="flex items-center gap-2">
                  {collapsedSections.has('comparisonMatrix') && (
                    <span className="text-sm text-muted-foreground">
                      Compare across {filteredCompetitorMatrix?.categories?.length || 0} dimensions
                    </span>
                  )}
                  <ChevronDown className={`h-5 w-5 transition-transform ${!collapsedSections.has('comparisonMatrix') ? 'rotate-180' : ''}`} />
                </div>
              </button>
            </CardHeader>
            {!collapsedSections.has('comparisonMatrix') && (
              <CardContent className="pt-0">
                <CardDescription className="mb-4">
                  How competitors score across key dimensions (1-10 scale). Hover over scores for details.
                </CardDescription>

                {/* Methodology Note */}
                <div className="mb-4 p-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Scores are AI estimates based on public information. Verify before making strategic decisions.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left py-3 px-4 font-semibold border-b-2 border-border sticky left-0 bg-muted/50 min-w-[140px]">
                          Competitor
                        </th>
                        {filteredCompetitorMatrix?.categories?.map((category) => (
                          <th key={category} className="text-center py-3 px-3 font-semibold border-b-2 border-border min-w-[90px]">
                            <span className="text-xs">{category}</span>
                          </th>
                        ))}
                        <th className="text-center py-3 px-3 font-semibold border-b-2 border-border min-w-[70px] bg-primary/5">
                          <span className="text-xs">Avg</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCompetitorMatrix?.comparison?.map((comp, rowIndex) => {
                        const scores = (filteredCompetitorMatrix?.categories || []).map(cat => {
                          const scoreData = comp.scores.find(s => s.category === cat)
                          return scoreData?.score || 0
                        })
                        const avgScore = scores.length > 0
                          ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
                          : 0

                        return (
                          <tr
                            key={comp.competitorName}
                            className={`${rowIndex % 2 === 0 ? 'bg-card' : 'bg-muted/20'} hover:bg-muted/40 transition-colors`}
                          >
                            <td className={`py-3 px-4 font-medium border-b sticky left-0 text-foreground ${rowIndex % 2 === 0 ? 'bg-card' : 'bg-muted/20'}`}>
                              {comp.competitorName}
                            </td>
                            {(filteredCompetitorMatrix?.categories || []).map((category) => {
                              const scoreData = comp.scores.find(s => s.category === category)
                              const score = scoreData?.score || 0
                              const scoreColorClass = score >= 8
                                ? 'bg-green-500 text-white'
                                : score >= 6
                                ? 'bg-green-400 text-white'
                                : score >= 4
                                ? 'bg-yellow-400 text-gray-900'
                                : score >= 2
                                ? 'bg-orange-400 text-white'
                                : 'bg-red-400 text-white'

                              return (
                                <td key={category} className="py-3 px-3 border-b">
                                  <div className="flex justify-center">
                                    <div
                                      className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${scoreColorClass} cursor-help shadow-sm`}
                                      title={scoreData?.notes || `${category}: ${score}/10`}
                                    >
                                      {score}
                                    </div>
                                  </div>
                                </td>
                              )
                            })}
                            <td className="py-3 px-3 border-b bg-primary/5">
                              <div className="flex justify-center">
                                <div
                                  className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm border-2 ${
                                    avgScore >= 7 ? 'border-green-500 text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-950' :
                                    avgScore >= 5 ? 'border-yellow-500 text-yellow-700 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-950' :
                                    'border-red-500 text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-950'
                                  }`}
                                  title={`Average score: ${avgScore}/10`}
                                >
                                  {avgScore}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Legend */}
                <div className="mt-4 pt-4 border-t flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <span className="font-medium">Score Legend:</span>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded bg-green-500"></div>
                    <span>8-10 Excellent</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded bg-green-400"></div>
                    <span>6-7 Good</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded bg-yellow-400"></div>
                    <span>4-5 Average</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded bg-orange-400"></div>
                    <span>2-3 Below Avg</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded bg-red-400"></div>
                    <span>0-1 Poor</span>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Comparative Mentions - REAL USER DATA - Collapsible */}
        {comparativeMentions && comparativeMentions.totalMentions > 0 && (
          <Card className="border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20">
            <CardHeader className="pb-3">
              <button
                onClick={() => toggleSection('comparativeMentions')}
                className="flex items-center justify-between w-full text-left"
              >
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-emerald-600" />
                  User Comparisons
                  <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900 dark:text-emerald-300 dark:border-emerald-700 text-xs">
                    Real Data
                  </Badge>
                </CardTitle>
                <div className="flex items-center gap-2">
                  {collapsedSections.has('comparativeMentions') && (
                    <span className="text-sm text-muted-foreground">
                      {comparativeMentions.totalMentions} mentions from {comparativeMentions.metadata.signalsAnalyzed} reviews
                    </span>
                  )}
                  <ChevronDown className={`h-5 w-5 transition-transform ${!collapsedSections.has('comparativeMentions') ? 'rotate-180' : ''}`} />
                </div>
              </button>
            </CardHeader>
            {!collapsedSections.has('comparativeMentions') && (
              <CardContent className="pt-0">
                <CardDescription className="mb-4">
                  What real users say when comparing {comparativeMentions.analyzedApp} to competitors.
                  Extracted from {comparativeMentions.metadata.signalsAnalyzed} reviews.
                </CardDescription>

                {/* Summary Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left py-3 px-4 font-semibold border-b-2 border-border">Competitor</th>
                        <th className="text-center py-3 px-3 font-semibold border-b-2 border-border">
                          <span className="flex items-center justify-center gap-1 text-green-600 dark:text-green-400">
                            <ThumbsUp className="h-3.5 w-3.5" /> Positive
                          </span>
                        </th>
                        <th className="text-center py-3 px-3 font-semibold border-b-2 border-border">
                          <span className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400">
                            <ThumbsDown className="h-3.5 w-3.5" /> Negative
                          </span>
                        </th>
                        <th className="text-center py-3 px-3 font-semibold border-b-2 border-border">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparativeMentions.competitorsSummary.map((comp, idx) => {
                        const netColor = comp.netSentiment > 0
                          ? 'text-green-600 dark:text-green-400'
                          : comp.netSentiment < 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-muted-foreground'
                        return (
                          <tr key={comp.competitor} className={idx % 2 === 0 ? 'bg-card' : 'bg-muted/20'}>
                            <td className="py-3 px-4 font-medium border-b">{comp.competitor}</td>
                            <td className="py-3 px-3 text-center border-b">
                              <span className="text-green-600 dark:text-green-400 font-semibold">
                                {comp.positiveMentions}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center border-b">
                              <span className="text-red-600 dark:text-red-400 font-semibold">
                                {comp.negativeMentions}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center border-b">
                              <span className={`font-bold ${netColor}`}>
                                {comp.netSentiment > 0 ? '+' : ''}{comp.netSentiment}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Sample Quotes */}
                {comparativeMentions.competitorsSummary.some(c =>
                  c.sampleQuotes.positive.length > 0 || c.sampleQuotes.negative.length > 0
                ) && (
                  <div className="mt-4 space-y-3">
                    <h4 className="text-sm font-medium">Sample User Quotes</h4>
                    {comparativeMentions.competitorsSummary.slice(0, 3).map(comp => {
                      const hasQuotes = comp.sampleQuotes.positive.length > 0 || comp.sampleQuotes.negative.length > 0
                      if (!hasQuotes) return null
                      return (
                        <div key={comp.competitor} className="p-3 rounded-lg bg-muted/50">
                          <div className="font-medium text-sm mb-2">{comp.competitor}</div>
                          {comp.sampleQuotes.positive.slice(0, 1).map((quote, i) => (
                            <div key={`pos-${i}`} className="flex items-start gap-2 text-xs mb-1">
                              <ThumbsUp className="h-3 w-3 text-green-500 flex-shrink-0 mt-0.5" />
                              <span className="text-muted-foreground italic">"{quote.slice(0, 150)}..."</span>
                            </div>
                          ))}
                          {comp.sampleQuotes.negative.slice(0, 1).map((quote, i) => (
                            <div key={`neg-${i}`} className="flex items-start gap-2 text-xs">
                              <ThumbsDown className="h-3 w-3 text-red-500 flex-shrink-0 mt-0.5" />
                              <span className="text-muted-foreground italic">"{quote.slice(0, 150)}..."</span>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Info box */}
                <div className="mt-4 p-2 rounded bg-emerald-100 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 flex items-start gap-2">
                  <Info className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    <strong>Real user data.</strong> These comparisons are extracted directly from user reviews,
                    not AI estimates. Positive = users prefer the competitor, Negative = users criticize the competitor.
                  </p>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Platform Competitors - Collapsible */}
        {hasPlatformCompetitors && (
          <div className="space-y-3">
            <button
              className="flex items-center gap-2 w-full text-left hover:opacity-80 transition-opacity"
              onClick={() => toggleSection('platformsCommunities')}
            >
              <Building2 className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold">Platforms & Communities ({categorizedCompetitors.platform.length})</h3>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800">
                Launch channels
              </Badge>
              {collapsedSections.has('platformsCommunities') && (
                <span className="text-sm text-muted-foreground ml-2">Click to expand</span>
              )}
              <ChevronDown className={`h-5 w-5 ml-auto transition-transform ${!collapsedSections.has('platformsCommunities') ? 'rotate-180' : ''}`} />
            </button>
            {!collapsedSections.has('platformsCommunities') && (
              <>
                <p className="text-sm text-muted-foreground">
                  Places where founders launch, discuss, and discover products. Potential marketing channels.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(showAllPlatforms ? categorizedCompetitors.platform : categorizedCompetitors.platform.slice(0, INITIAL_DISPLAY_COUNT)).map((competitor) => (
                    <CompetitorCardCompact
                      key={competitor.name}
                      competitor={competitor}
                      onClick={() => toggleCompetitor(competitor.name)}
                    />
                  ))}
                </div>
                {categorizedCompetitors.platform.length > INITIAL_DISPLAY_COUNT && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllPlatforms(!showAllPlatforms)}
                    className="mt-2 text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    {showAllPlatforms
                      ? 'Show less'
                      : `Show ${categorizedCompetitors.platform.length - INITIAL_DISPLAY_COUNT} more`}
                    <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${showAllPlatforms ? 'rotate-180' : ''}`} />
                  </Button>
                )}
              </>
            )}
          </div>
        )}

        {/* Adjacent Tools - Collapsible */}
        {hasAdjacentCompetitors && (
          <div className="space-y-3">
            <button
              className="flex items-center gap-2 w-full text-left hover:opacity-80 transition-opacity"
              onClick={() => toggleSection('adjacentTools')}
            >
              <Tag className="h-5 w-5 text-amber-600" />
              <h3 className="text-lg font-semibold">Adjacent Tools ({categorizedCompetitors.adjacent.length})</h3>
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800">
                Partial overlap
              </Badge>
              {collapsedSections.has('adjacentTools') && (
                <span className="text-sm text-muted-foreground ml-2">Click to expand</span>
              )}
              <ChevronDown className={`h-5 w-5 ml-auto transition-transform ${!collapsedSections.has('adjacentTools') ? 'rotate-180' : ''}`} />
            </button>
            {!collapsedSections.has('adjacentTools') && (
              <>
                <p className="text-sm text-muted-foreground">
                  Tools that solve related problems or could be integrated/replaced.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(showAllAdjacent ? categorizedCompetitors.adjacent : categorizedCompetitors.adjacent.slice(0, INITIAL_DISPLAY_COUNT)).map((competitor) => (
                    <CompetitorCardCompact
                      key={competitor.name}
                      competitor={competitor}
                      onClick={() => toggleCompetitor(competitor.name)}
                    />
                  ))}
                </div>
                {categorizedCompetitors.adjacent.length > INITIAL_DISPLAY_COUNT && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllAdjacent(!showAllAdjacent)}
                    className="mt-2 text-amber-600 hover:text-amber-700 dark:text-amber-400"
                  >
                    {showAllAdjacent
                      ? 'Show less'
                      : `Show ${categorizedCompetitors.adjacent.length - INITIAL_DISPLAY_COUNT} more`}
                    <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${showAllAdjacent ? 'rotate-180' : ''}`} />
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// Competitor Card Components
// =============================================================================

interface CompetitorCardProps {
  competitor: {
    name: string
    website: string | null
    description: string
    positioning: string
    targetAudience: string
    pricingModel: string | null
    pricingRange: string | null
    strengths: string[]
    weaknesses: string[]
    differentiators: string[]
  }
  expanded: boolean
  onToggle: () => void
  categoryBadge?: React.ReactNode
}

function CompetitorCard({ competitor, expanded, onToggle, categoryBadge }: CompetitorCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader
        className="cursor-pointer hover:bg-muted/50 transition-colors py-3"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                {competitor.name}
                {competitor.website && (
                  <a
                    href={competitor.website.startsWith('http') ? competitor.website : `https://${competitor.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-muted-foreground hover:text-primary"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </CardTitle>
              {categoryBadge}
            </div>
            <CardDescription className="mt-1 text-sm line-clamp-1">
              {competitor.positioning}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="border-t pt-4 space-y-4">
          <p className="text-sm text-muted-foreground">{competitor.description}</p>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4" />
                Target Audience
              </div>
              <p className="text-sm text-muted-foreground">{competitor.targetAudience}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <DollarSign className="h-4 w-4" />
                Pricing
              </div>
              <p className="text-sm text-muted-foreground">
                {competitor.pricingModel && competitor.pricingRange
                  ? `${competitor.pricingModel} - ${competitor.pricingRange}`
                  : competitor.pricingModel || competitor.pricingRange || 'Not available'}
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                <Zap className="h-4 w-4" />
                Strengths
              </div>
              <ul className="text-sm space-y-1">
                {competitor.strengths.slice(0, 3).map((strength, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">+</span>
                    <span className="text-muted-foreground">{strength}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-red-600">
                <AlertTriangle className="h-4 w-4" />
                Weaknesses
              </div>
              <ul className="text-sm space-y-1">
                {competitor.weaknesses.slice(0, 3).map((weakness, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">-</span>
                    <span className="text-muted-foreground">{weakness}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {competitor.differentiators.length > 0 && (
            <div className="pt-2">
              <div className="text-sm font-medium mb-2">Key Differentiators</div>
              <div className="flex flex-wrap gap-2">
                {competitor.differentiators.map((diff, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">{diff}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

interface CompetitorCardCompactProps {
  competitor: {
    name: string
    website: string | null
    positioning: string
    pricingModel: string | null
    pricingRange: string | null
  }
  onClick: () => void
}

function CompetitorCardCompact({ competitor, onClick }: CompetitorCardCompactProps) {
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={onClick}>
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-sm truncate">{competitor.name}</h4>
              {competitor.website && (
                <a
                  href={competitor.website.startsWith('http') ? competitor.website : `https://${competitor.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-muted-foreground hover:text-primary flex-shrink-0"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
              {competitor.positioning}
            </p>
          </div>
        </div>
        {(competitor.pricingModel || competitor.pricingRange) && (
          <div className="mt-2 pt-2 border-t">
            <span className="text-xs text-muted-foreground">
              {competitor.pricingModel || competitor.pricingRange}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
