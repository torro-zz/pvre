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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Sparkles,
  TrendingDown,
  CircleDot,
  Tag,
} from 'lucide-react'
import { CompetitorIntelligenceResult } from '@/app/api/research/competitor-intelligence/route'
import { extractCompetitorPricing, type PricingSuggestion } from '@/lib/analysis/pricing-utils'

interface CompetitorResultsProps {
  results: CompetitorIntelligenceResult
}

export function CompetitorResults({ results }: CompetitorResultsProps) {
  const [expandedCompetitor, setExpandedCompetitor] = useState<string | null>(null)

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
        return 'bg-red-100 text-red-800 border-red-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low':
        return 'bg-green-100 text-green-800 border-green-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getMaturityColor = (maturity: string) => {
    switch (maturity) {
      case 'emerging':
        return 'bg-purple-100 text-purple-800'
      case 'growing':
        return 'bg-green-100 text-green-800'
      case 'mature':
        return 'bg-blue-100 text-blue-800'
      case 'declining':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getDifficultyBadge = (difficulty: string) => {
    switch (difficulty) {
      case 'low':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Low Effort</Badge>
      case 'medium':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Medium Effort</Badge>
      case 'high':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">High Effort</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 7.5) return 'text-green-600'
    if (score >= 5) return 'text-yellow-600'
    if (score >= 2.5) return 'text-orange-600'
    return 'text-red-600'
  }

  const getScoreBgColor = (score: number) => {
    if (score >= 7.5) return 'bg-green-500'
    if (score >= 5) return 'bg-yellow-500'
    if (score >= 2.5) return 'bg-orange-500'
    return 'bg-red-500'
  }

  const getImpactColor = (impact: number) => {
    if (impact > 0) return 'text-green-600'
    if (impact < 0) return 'text-red-600'
    return 'text-gray-500'
  }

  const getImpactIcon = (impact: number) => {
    if (impact > 0) return <TrendingUp className="h-3 w-3" />
    if (impact < 0) return <TrendingDown className="h-3 w-3" />
    return <CircleDot className="h-3 w-3" />
  }

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

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Competitors</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {results.metadata.competitorsAnalyzed}
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
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Processing Time</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {(results.metadata.processingTimeMs / 1000).toFixed(1)}s
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Competitor Pricing Intelligence */}
      {pricingSuggestion.competitorsWithPricing > 0 && (
        <Card className="border-green-200 bg-green-50/30">
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
                    ? 'border-green-500 text-green-700 bg-green-50'
                    : pricingSuggestion.confidence === 'medium'
                    ? 'border-yellow-500 text-yellow-700 bg-yellow-50'
                    : 'border-gray-400 text-gray-600'
                }
              >
                {pricingSuggestion.confidence} confidence
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              {/* Suggested Price */}
              <div className="p-4 rounded-lg bg-white border border-green-200">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  Suggested Price
                </div>
                <p className="text-3xl font-bold text-green-700">
                  ${pricingSuggestion.suggestedPrice}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Median competitor price
                </p>
              </div>

              {/* Price Range */}
              {pricingSuggestion.priceRange && (
                <div className="p-4 rounded-lg bg-white border">
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
              <div className="p-4 rounded-lg bg-white border">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Sparkles className="h-4 w-4" />
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
            <div className="mt-3 p-2 rounded bg-blue-50 border border-blue-100 flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
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
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
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
                <h4 className="text-sm font-medium flex items-center gap-2 text-orange-600">
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
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-blue-50 rounded p-2">
              <Info className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <span>
                Higher scores indicate easier market entry. This score factors into your overall Viability Verdict
                (25% weight). Positive impacts improve your score, negative impacts indicate challenges.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Market Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Market Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
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
      </Card>

      {/* Tabbed Content */}
      <Tabs defaultValue="competitors" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="competitors">Competitors</TabsTrigger>
          <TabsTrigger value="matrix">Comparison</TabsTrigger>
          <TabsTrigger value="gaps">Opportunities</TabsTrigger>
          <TabsTrigger value="positioning">Positioning</TabsTrigger>
        </TabsList>

        {/* Competitors Tab */}
        <TabsContent value="competitors" className="space-y-4">
          {results.competitors.map((competitor) => (
            <Card key={competitor.name} className="overflow-hidden">
              <CardHeader
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleCompetitor(competitor.name)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {competitor.name}
                      {competitor.website && (
                        <a
                          href={competitor.website.startsWith('http') ? competitor.website : `https://${competitor.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-muted-foreground hover:text-primary"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {competitor.positioning}
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="sm">
                    {expandedCompetitor === competitor.name ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardHeader>

              {expandedCompetitor === competitor.name && (
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
                        {competitor.strengths.map((strength, i) => (
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
                        {competitor.weaknesses.map((weakness, i) => (
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
                          <Badge key={i} variant="secondary">{diff}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </TabsContent>

        {/* Matrix Tab */}
        <TabsContent value="matrix" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Competitor Comparison Matrix</CardTitle>
              <CardDescription>
                How competitors score across key dimensions (1-10 scale). Hover over scores for details.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left py-3 px-4 font-semibold border-b-2 border-border sticky left-0 bg-muted/50 min-w-[140px]">
                        Competitor
                      </th>
                      {results.competitorMatrix.categories.map((category) => (
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
                    {results.competitorMatrix.comparison.map((comp, rowIndex) => {
                      // Calculate average score for this competitor
                      const scores = results.competitorMatrix.categories.map(cat => {
                        const scoreData = comp.scores.find(s => s.category === cat)
                        return scoreData?.score || 0
                      })
                      const avgScore = scores.length > 0
                        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
                        : 0

                      return (
                        <tr
                          key={comp.competitorName}
                          className={`${rowIndex % 2 === 0 ? 'bg-white' : 'bg-muted/20'} hover:bg-muted/40 transition-colors`}
                        >
                          <td className={`py-3 px-4 font-medium border-b sticky left-0 ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-muted/20'}`}>
                            {comp.competitorName}
                          </td>
                          {results.competitorMatrix.categories.map((category) => {
                            const scoreData = comp.scores.find(s => s.category === category)
                            const score = scoreData?.score || 0
                            // Color coding based on score
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
                                  avgScore >= 7 ? 'border-green-500 text-green-700 bg-green-50' :
                                  avgScore >= 5 ? 'border-yellow-500 text-yellow-700 bg-yellow-50' :
                                  'border-red-500 text-red-700 bg-red-50'
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
          </Card>
        </TabsContent>

        {/* Gaps Tab */}
        <TabsContent value="gaps" className="space-y-4">
          <div className="grid gap-4">
            {results.gaps.map((gap, index) => (
              <Card key={index}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-5 w-5 text-yellow-500" />
                      <h4 className="font-semibold">{gap.gap}</h4>
                    </div>
                    {getDifficultyBadge(gap.difficulty)}
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{gap.description}</p>
                  <div className="bg-green-50 border border-green-200 rounded-md p-3">
                    <div className="text-sm font-medium text-green-800 mb-1">Opportunity</div>
                    <p className="text-sm text-green-700">{gap.opportunity}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Positioning Tab */}
        <TabsContent value="positioning" className="space-y-4">
          {results.positioningRecommendations.map((rec, index) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary">{index + 1}</Badge>
                  <CardTitle className="text-lg">{rec.strategy}</CardTitle>
                </div>
                <CardDescription>{rec.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Target Niche
                  </div>
                  <p className="text-sm text-muted-foreground">{rec.targetNiche}</p>
                </div>

                <div>
                  <div className="text-sm font-medium mb-2">Key Differentiators</div>
                  <div className="flex flex-wrap gap-2">
                    {rec.keyDifferentiators.map((diff, i) => (
                      <Badge key={i} variant="outline">{diff}</Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium mb-2">Messaging Angles</div>
                  <ul className="space-y-2">
                    {rec.messagingAngles.map((angle, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <span className="text-primary mt-0.5">→</span>
                        <span className="text-muted-foreground">{angle}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}
