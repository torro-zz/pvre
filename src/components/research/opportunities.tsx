'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Target, TrendingUp, AlertTriangle, Lightbulb, Shield, DollarSign, Users, Sparkles } from 'lucide-react'
import type { PainSignal, PainSummary } from '@/lib/analysis/pain-detector'
import type { AppDetails } from '@/lib/data-sources/types'

interface OpportunitiesProps {
  appData?: AppDetails | null
  painSignals: PainSignal[]
  painSummary?: PainSummary | null
  wtpQuotes?: { text: string; subreddit: string }[]
}

// Calculate opportunity score based on pain signals and market data
function calculateOpportunityScore(
  painSignals: PainSignal[],
  painSummary: PainSummary | null | undefined,
  appData: AppDetails | null | undefined
): { score: number; confidence: string; verdict: string } {
  let score = 5 // Base score

  // Factor 1: Pain intensity (high pain = high opportunity)
  const highIntensityCount = painSignals.filter(s => s.intensity === 'high').length
  const totalSignals = painSignals.length
  if (totalSignals > 0) {
    const painRatio = highIntensityCount / totalSignals
    score += painRatio * 2 // Up to +2 points
  }

  // Factor 2: Willingness to pay signals
  const wtpCount = painSummary?.willingnessToPayCount || painSignals.filter(s => s.willingnessToPaySignal).length
  if (wtpCount >= 5) score += 2
  else if (wtpCount >= 2) score += 1

  // Factor 3: Feature requests (unmet needs)
  const featureRequests = painSignals.filter(s => s.solutionSeeking).length
  if (featureRequests >= 10) score += 1.5
  else if (featureRequests >= 5) score += 1

  // Factor 4: App rating (lower rating = more opportunity)
  if (appData?.rating) {
    if (appData.rating < 3.5) score += 1.5
    else if (appData.rating < 4.0) score += 0.5
    else if (appData.rating > 4.5) score -= 0.5
  }

  // Cap the score
  score = Math.max(1, Math.min(10, score))

  // Determine confidence
  let confidence = 'Low'
  if (totalSignals >= 50) confidence = 'High'
  else if (totalSignals >= 20) confidence = 'Medium'

  // Verdict
  let verdict = ''
  if (score >= 8) verdict = 'Strong opportunity - significant gaps in the current solution'
  else if (score >= 6) verdict = 'Moderate opportunity - clear gaps but strong incumbent'
  else if (score >= 4) verdict = 'Limited opportunity - market needs are mostly satisfied'
  else verdict = 'Low opportunity - incumbent appears to solve the problem well'

  return { score, confidence, verdict }
}

// Extract key unmet needs from signals
function extractUnmetNeeds(painSignals: PainSignal[]): {
  high: { need: string; mentions: number; quote: string }[]
  medium: { need: string; mentions: number; quote: string }[]
} {
  // Group by signal keywords
  const needGroups = new Map<string, { signals: PainSignal[]; intensity: 'high' | 'medium' | 'low' }[]>()

  for (const signal of painSignals) {
    const keyword = signal.signals[0] || 'General'
    const existing = needGroups.get(keyword) || []
    existing.push({ signals: [signal], intensity: signal.intensity })
    needGroups.set(keyword, existing)
  }

  // Sort and categorize
  const high: { need: string; mentions: number; quote: string }[] = []
  const medium: { need: string; mentions: number; quote: string }[] = []

  needGroups.forEach((items, need) => {
    const mentions = items.length
    const highIntensityCount = items.filter(i => i.intensity === 'high').length
    const quote = items[0]?.signals[0]?.text || ''

    if (highIntensityCount >= 2 || mentions >= 5) {
      high.push({ need, mentions, quote: quote.slice(0, 100) })
    } else if (mentions >= 2) {
      medium.push({ need, mentions, quote: quote.slice(0, 100) })
    }
  })

  return {
    high: high.sort((a, b) => b.mentions - a.mentions).slice(0, 5),
    medium: medium.sort((a, b) => b.mentions - a.mentions).slice(0, 5),
  }
}

// Generate strategic recommendations
function generateRecommendations(
  painSignals: PainSignal[],
  appData: AppDetails | null | undefined
): { title: string; description: string; type: 'differentiate' | 'avoid' | 'target' }[] {
  const recommendations: { title: string; description: string; type: 'differentiate' | 'avoid' | 'target' }[] = []

  // Pricing opportunity
  const priceComplaints = painSignals.filter(s =>
    s.text.toLowerCase().includes('expensive') ||
    s.text.toLowerCase().includes('price') ||
    s.text.toLowerCase().includes('subscription')
  ).length

  if (priceComplaints >= 3) {
    recommendations.push({
      title: 'Differentiate on Price',
      description: `${priceComplaints} users mentioned pricing concerns. Consider a more competitive pricing model or generous free tier.`,
      type: 'differentiate',
    })
  }

  // Feature gaps
  const featureRequests = painSignals.filter(s => s.solutionSeeking).length
  if (featureRequests >= 5) {
    recommendations.push({
      title: 'Address Unmet Features',
      description: `${featureRequests} users are actively seeking features the current solution doesn't provide.`,
      type: 'differentiate',
    })
  }

  // UX/Technical issues
  const technicalIssues = painSignals.filter(s =>
    s.text.toLowerCase().includes('crash') ||
    s.text.toLowerCase().includes('bug') ||
    s.text.toLowerCase().includes('slow')
  ).length

  if (technicalIssues >= 3) {
    recommendations.push({
      title: 'Build for Reliability',
      description: `${technicalIssues} users complained about technical issues. A stable, performant alternative could win users.`,
      type: 'differentiate',
    })
  }

  // What to avoid
  if (appData?.rating && appData.rating > 4.5) {
    recommendations.push({
      title: 'Avoid Direct Feature Competition',
      description: `With a ${appData.rating.toFixed(1)} rating, users are generally satisfied. Focus on underserved niches instead.`,
      type: 'avoid',
    })
  }

  // Target segment
  const niche = detectNicheOpportunity(painSignals)
  if (niche) {
    recommendations.push({
      title: `Target ${niche.segment}`,
      description: niche.reason,
      type: 'target',
    })
  }

  return recommendations
}

function detectNicheOpportunity(painSignals: PainSignal[]): { segment: string; reason: string } | null {
  // Simple heuristic: look for segment-specific complaints
  const segments = ['beginner', 'professional', 'family', 'enterprise', 'senior', 'student']

  for (const segment of segments) {
    const mentions = painSignals.filter(s =>
      s.text.toLowerCase().includes(segment)
    ).length

    if (mentions >= 2) {
      return {
        segment: segment.charAt(0).toUpperCase() + segment.slice(1) + 's',
        reason: `${mentions} signals mention ${segment}s specifically - may be an underserved segment.`,
      }
    }
  }

  return null
}

export function Opportunities({ appData, painSignals, painSummary, wtpQuotes }: OpportunitiesProps) {
  const { score, confidence, verdict } = calculateOpportunityScore(painSignals, painSummary, appData)
  const unmetNeeds = extractUnmetNeeds(painSignals)
  const recommendations = generateRecommendations(painSignals, appData)

  const scoreColor =
    score >= 7 ? 'text-emerald-600 dark:text-emerald-400' :
    score >= 5 ? 'text-blue-600 dark:text-blue-400' :
    score >= 3 ? 'text-amber-600 dark:text-amber-400' :
    'text-red-600 dark:text-red-400'

  const scoreBg =
    score >= 7 ? 'bg-emerald-500' :
    score >= 5 ? 'bg-blue-500' :
    score >= 3 ? 'bg-amber-500' :
    'bg-red-500'

  return (
    <div className="space-y-6">
      {/* Opportunity Score Card */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-emerald-500/10 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Market Opportunity</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {appData ? `Competitive gaps for ${appData.name}` : 'Gap analysis based on pain signals'}
              </p>
            </div>
            <div className="text-right">
              <div className={`text-4xl font-bold ${scoreColor}`}>
                {score.toFixed(1)}
                <span className="text-xl text-muted-foreground">/10</span>
              </div>
              <Badge variant="secondary">{confidence} Confidence</Badge>
            </div>
          </div>
        </div>

        <CardContent className="pt-6">
          <div className={`p-4 rounded-xl ${scoreBg}/10 border ${scoreBg}/20`}>
            <p className="text-sm">{verdict}</p>
          </div>
        </CardContent>
      </Card>

      {/* Unmet Needs */}
      {(unmetNeeds.high.length > 0 || unmetNeeds.medium.length > 0) && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Unmet Needs
            </h3>

            {/* High Opportunity */}
            {unmetNeeds.high.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  High Opportunity
                </h4>
                <div className="space-y-3">
                  {unmetNeeds.high.map((need, i) => (
                    <div key={i} className="p-3 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-200 dark:border-red-500/20">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{need.need}</span>
                        <Badge variant="outline" className="text-xs">{need.mentions}x</Badge>
                      </div>
                      {need.quote && (
                        <p className="text-xs text-muted-foreground italic">"{need.quote}..."</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Medium Opportunity */}
            {unmetNeeds.medium.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  Medium Opportunity
                </h4>
                <div className="space-y-3">
                  {unmetNeeds.medium.map((need, i) => (
                    <div key={i} className="p-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/20">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{need.need}</span>
                        <Badge variant="outline" className="text-xs">{need.mentions}x</Badge>
                      </div>
                      {need.quote && (
                        <p className="text-xs text-muted-foreground italic">"{need.quote}..."</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Willingness to Pay Signals */}
      {wtpQuotes && wtpQuotes.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-600" />
              Willingness to Pay Signals
            </h3>
            <div className="space-y-3">
              {wtpQuotes.slice(0, 5).map((quote, i) => (
                <div key={i} className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20">
                  <blockquote className="text-sm italic">"{quote.text}"</blockquote>
                  <p className="text-xs text-muted-foreground mt-1">— {quote.subreddit}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Strategic Recommendations */}
      {recommendations.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              If Building a Competitor
            </h3>
            <div className="space-y-4">
              {recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg flex-shrink-0 ${
                    rec.type === 'differentiate' ? 'bg-emerald-100 dark:bg-emerald-500/20' :
                    rec.type === 'avoid' ? 'bg-red-100 dark:bg-red-500/20' :
                    'bg-blue-100 dark:bg-blue-500/20'
                  }`}>
                    {rec.type === 'differentiate' && <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
                    {rec.type === 'avoid' && <Shield className="h-4 w-4 text-red-600 dark:text-red-400" />}
                    {rec.type === 'target' && <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                  </div>
                  <div>
                    <h4 className="font-medium">{rec.title}</h4>
                    <p className="text-sm text-muted-foreground">{rec.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Data Message */}
      {painSignals.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Run the research analysis first to see market opportunities and competitive gaps.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
