/**
 * Competitor Analyzer - Core analysis logic extracted for reuse
 *
 * Used by:
 * - /api/research/competitor-intelligence (API route)
 * - /api/research/community-voice (auto-competitor analysis)
 */

import Anthropic from '@anthropic-ai/sdk'
import { formatClustersForPrompt, type SignalCluster } from '@/lib/embeddings'

const anthropic = new Anthropic()

// =============================================================================
// TYPES
// =============================================================================

export interface Competitor {
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
  threatLevel: 'low' | 'medium' | 'high'
  userSatisfaction: number
  fundingLevel: 'bootstrapped' | 'seed' | 'series-a' | 'series-b-plus' | 'public' | 'unknown'
  marketShareEstimate: 'dominant' | 'significant' | 'moderate' | 'small' | 'emerging'
}

export interface CompetitorGap {
  gap: string
  description: string
  opportunity: string
  difficulty: 'low' | 'medium' | 'high'
  opportunityScore: number
  validationSignals: string[]
  evidenceCount?: number
  sourceBreakdown?: {
    appStore?: number
    googlePlay?: number
    reddit?: number
  }
  clusterIds?: string[]
}

export interface PositioningRecommendation {
  strategy: string
  description: string
  targetNiche: string
  keyDifferentiators: string[]
  messagingAngles: string[]
}

export interface CompetitionScoreBreakdown {
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
}

export interface CompetitorIntelligenceResult {
  hypothesis: string
  marketOverview: {
    marketSize: string
    growthTrend: string
    maturityLevel: 'emerging' | 'growing' | 'mature' | 'declining'
    competitionIntensity: 'low' | 'medium' | 'high'
    summary: string
  }
  competitors: Competitor[]
  competitorMatrix: {
    categories: string[]
    comparison: {
      competitorName: string
      scores: { category: string; score: number; notes: string }[]
    }[]
  }
  gaps: CompetitorGap[]
  positioningRecommendations: PositioningRecommendation[]
  competitionScore: CompetitionScoreBreakdown
  metadata: {
    competitorsAnalyzed: number
    processingTimeMs: number
    timestamp: string
    autoDetected?: boolean
  }
}

export interface GeographyInfo {
  location?: string
  scope?: 'local' | 'national' | 'global'
}

export interface AnalyzeCompetitorsOptions {
  hypothesis: string
  knownCompetitors?: string[]
  geography?: GeographyInfo
  clusters?: SignalCluster[]
  maxCompetitors?: number
  analyzedAppName?: string | null
}

function getSelfNames(analyzedAppName?: string | null): string[] {
  if (!analyzedAppName) return []
  return analyzedAppName
    .toLowerCase()
    .split('|')
    .map((name) => name.trim())
    .filter(Boolean)
}

function isSelfNameMatch(candidate: string, selfNames: string[]): boolean {
  const normalized = candidate.toLowerCase().trim()
  if (!normalized) return false
  return selfNames.some((selfName) =>
    normalized === selfName ||
    normalized.includes(selfName) ||
    selfName.includes(normalized)
  )
}

function filterSelfCompetitors(competitors: Competitor[], selfNames: string[]): Competitor[] {
  if (selfNames.length === 0) return competitors
  return competitors.filter((competitor) => !isSelfNameMatch(competitor.name, selfNames))
}

function filterSelfCompetitorMatrix(
  matrix: CompetitorIntelligenceResult['competitorMatrix'],
  selfNames: string[]
): CompetitorIntelligenceResult['competitorMatrix'] {
  if (selfNames.length === 0) return matrix
  // Defensive: Claude may return incomplete competitorMatrix without comparison array
  const comparison = Array.isArray(matrix?.comparison) ? matrix.comparison : []
  return {
    categories: matrix?.categories || [],
    comparison: comparison.filter((comp) =>
      !isSelfNameMatch(comp.competitorName, selfNames)
    ),
  }
}

// =============================================================================
// COMPETITION SCORE CALCULATION
// =============================================================================

function calculateCompetitionScore(
  competitors: Competitor[],
  gaps: CompetitorGap[],
  marketOverview: CompetitorIntelligenceResult['marketOverview']
): CompetitionScoreBreakdown {
  let score = 5
  const factors: CompetitionScoreBreakdown['factors'] = {
    competitorCount: { value: 0, impact: 0 },
    fundingLevels: { description: '', impact: 0 },
    userSatisfaction: { average: 0, impact: 0 },
    marketGaps: { count: 0, impact: 0 },
    priceHeadroom: { exists: false, impact: 0 },
  }
  const threats: string[] = []

  const directCompetitorCount = competitors.length
  factors.competitorCount.value = directCompetitorCount

  if (directCompetitorCount === 0) {
    score += 2
    factors.competitorCount.impact = 2
  } else if (directCompetitorCount <= 3) {
    score += 1
    factors.competitorCount.impact = 1
  } else if (directCompetitorCount <= 7) {
    factors.competitorCount.impact = 0
  } else {
    score -= 1.5
    factors.competitorCount.impact = -1.5
  }

  const wellFunded = competitors.filter(
    (c) => c.fundingLevel === 'series-b-plus' || c.fundingLevel === 'public'
  ).length
  const seedFunded = competitors.filter(
    (c) => c.fundingLevel === 'seed' || c.fundingLevel === 'series-a'
  ).length

  if (wellFunded >= 3) {
    score -= 1.5
    factors.fundingLevels.impact = -1.5
    factors.fundingLevels.description = `${wellFunded} well-funded competitors`
    threats.push('Multiple well-funded competitors in market')
  } else if (wellFunded >= 1) {
    score -= 0.5
    factors.fundingLevels.impact = -0.5
    factors.fundingLevels.description = `${wellFunded} well-funded, ${seedFunded} early-stage`
  } else {
    factors.fundingLevels.description = 'Mostly bootstrapped or early-stage competitors'
    factors.fundingLevels.impact = 0.5
    score += 0.5
  }

  const satisfactionScores = competitors
    .map((c) => c.userSatisfaction)
    .filter((s) => s > 0)

  if (satisfactionScores.length > 0) {
    const avgSatisfaction = satisfactionScores.reduce((a, b) => a + b, 0) / satisfactionScores.length
    factors.userSatisfaction.average = Math.round(avgSatisfaction * 10) / 10

    if (avgSatisfaction < 3) {
      score += 2
      factors.userSatisfaction.impact = 2
    } else if (avgSatisfaction < 4) {
      score += 1
      factors.userSatisfaction.impact = 1
    } else if (avgSatisfaction >= 4.5) {
      score -= 1
      factors.userSatisfaction.impact = -1
      threats.push('Incumbent competitors have high user satisfaction')
    }
  }

  const highOpportunityGaps = gaps.filter((g) => g.opportunityScore >= 7)
  factors.marketGaps.count = gaps.length

  if (highOpportunityGaps.length >= 2) {
    score += 1
    factors.marketGaps.impact = 1
  } else if (gaps.length >= 3) {
    score += 0.5
    factors.marketGaps.impact = 0.5
  }

  const hasPremiumPricing = competitors.some((c) => {
    if (!c.pricingRange) return false
    const priceMatch = c.pricingRange.match(/\$(\d+)/)
    return priceMatch && parseInt(priceMatch[1]) >= 50
  })

  factors.priceHeadroom.exists = hasPremiumPricing
  if (hasPremiumPricing) {
    score += 0.5
    factors.priceHeadroom.impact = 0.5
  }

  if (marketOverview.competitionIntensity === 'high') {
    score -= 0.5
    threats.push('High overall market competition intensity')
  } else if (marketOverview.competitionIntensity === 'low') {
    score += 0.5
  }

  const highThreatCompetitors = competitors.filter((c) => c.threatLevel === 'high')
  for (const competitor of highThreatCompetitors.slice(0, 2)) {
    threats.push(`${competitor.name} poses high competitive threat`)
  }

  const reasoningParts: string[] = []
  if (factors.competitorCount.impact > 0) {
    reasoningParts.push(`Light competition (${directCompetitorCount} competitors)`)
  } else if (factors.competitorCount.impact < 0) {
    reasoningParts.push(`Crowded market (${directCompetitorCount} competitors)`)
  }

  if (factors.userSatisfaction.impact > 0) {
    reasoningParts.push(`Users dissatisfied with current options (avg ${factors.userSatisfaction.average}/5)`)
  }

  if (factors.marketGaps.impact > 0) {
    reasoningParts.push(`${gaps.length} market gaps identified`)
  }

  const finalScore = Math.min(10, Math.max(0, score))

  return {
    score: Math.round(finalScore * 10) / 10,
    confidence: competitors.length >= 5 ? 'high' : competitors.length >= 3 ? 'medium' : 'low',
    reasoning: reasoningParts.join('. ') || 'Moderate competitive landscape.',
    factors,
    threats: threats.slice(0, 5),
  }
}

// =============================================================================
// FALLBACK ANALYSIS
// =============================================================================

function generateFallbackAnalysis(
  hypothesis: string,
  knownCompetitors: string[] = []
): {
  marketOverview: CompetitorIntelligenceResult['marketOverview']
  competitors: Partial<Competitor>[]
  gaps: Partial<CompetitorGap>[]
  positioningRecommendations: PositioningRecommendation[]
  competitorMatrix: CompetitorIntelligenceResult['competitorMatrix']
} {
  const competitors: Partial<Competitor>[] = knownCompetitors.map(name => ({
    name,
    website: null,
    description: `${name} is a competitor in this market space.`,
    positioning: 'Unknown',
    targetAudience: 'General market',
    pricingModel: null,
    pricingRange: null,
    strengths: ['Established presence in market'],
    weaknesses: ['Requires further analysis'],
    differentiators: [],
    threatLevel: 'medium' as const,
    userSatisfaction: 3,
    fundingLevel: 'unknown' as const,
    marketShareEstimate: 'moderate' as const,
  }))

  const marketOverview: CompetitorIntelligenceResult['marketOverview'] = {
    marketSize: 'Unknown - analysis incomplete',
    growthTrend: 'Requires further research',
    maturityLevel: 'growing' as const,
    competitionIntensity: knownCompetitors.length >= 5 ? 'high' as const : 'medium' as const,
    summary: `This market has ${knownCompetitors.length} known competitors.`,
  }

  const gaps: Partial<CompetitorGap>[] = [
    {
      gap: 'Detailed competitive analysis needed',
      description: 'Manual research recommended.',
      opportunity: 'To be determined',
      difficulty: 'medium' as const,
      opportunityScore: 5,
      validationSignals: [],
    },
  ]

  const positioningRecommendations: PositioningRecommendation[] = [
    {
      strategy: 'Conduct manual competitive research',
      description: 'Research competitors to identify positioning opportunities.',
      targetNiche: 'To be determined',
      keyDifferentiators: [],
      messagingAngles: [],
    },
  ]

  return {
    marketOverview,
    competitors,
    gaps,
    positioningRecommendations,
    competitorMatrix: { categories: [], comparison: [] },
  }
}

// =============================================================================
// MAIN ANALYSIS FUNCTION
// =============================================================================

export async function analyzeCompetitors(
  options: AnalyzeCompetitorsOptions
): Promise<CompetitorIntelligenceResult> {
  const {
    hypothesis,
    knownCompetitors,
    geography,
    clusters,
    maxCompetitors = 8,
    analyzedAppName,
  } = options

  console.log('[CompetitorAnalyzer] Starting analysis')
  console.log('[CompetitorAnalyzer] analyzedAppName:', analyzedAppName)
  console.log('[CompetitorAnalyzer] knownCompetitors:', knownCompetitors?.length ?? 0)

  const startTime = Date.now()
  const selfNames = getSelfNames(analyzedAppName)
  console.log('[CompetitorAnalyzer] selfNames:', selfNames)

  // Cap competitors
  const cappedCompetitors = knownCompetitors?.slice(0, maxCompetitors)
  const filteredKnownCompetitors = cappedCompetitors?.filter(
    (name) => !isSelfNameMatch(name, selfNames)
  )

  const competitorListPrompt = filteredKnownCompetitors?.length
    ? `The user has mentioned these known competitors: ${filteredKnownCompetitors.join(', ')}. Include these and identify additional competitors.`
    : 'Identify the main competitors in this space.'

  let geographyPrompt = ''
  if (geography?.location && geography.scope !== 'global') {
    geographyPrompt = `
CRITICAL GEOGRAPHIC FOCUS:
The founder is targeting ${geography.location} specifically (${geography.scope} scope).
- PRIORITIZE competitors that operate in or target ${geography.location}
- Include local/regional competitors specific to ${geography.location}
`
  }

  let evidencePrompt = ''
  if (clusters && clusters.length > 0) {
    const totalSignals = clusters.reduce((sum, c) => sum + c.size, 0)
    const formattedClusters = formatClustersForPrompt(clusters)
    evidencePrompt = `

=== REAL USER FEEDBACK (${totalSignals} signals, pre-clustered) ===

${formattedClusters}

CRITICAL: Ground gaps in the user feedback clusters above. Reference specific clusters.
`
  }

  const prompt = `You are a competitive intelligence analyst. Analyze the competitive landscape for:

"${hypothesis}"

${competitorListPrompt}
${geographyPrompt}
${evidencePrompt}

Provide analysis in JSON format. For each competitor, assess:
- threatLevel: low/medium/high
- userSatisfaction: 1-5
- fundingLevel: bootstrapped/seed/series-a/series-b-plus/public/unknown
- marketShareEstimate: dominant/significant/moderate/small/emerging

{
  "marketOverview": {
    "marketSize": "Estimated market size",
    "growthTrend": "Growth trend",
    "maturityLevel": "emerging|growing|mature|declining",
    "competitionIntensity": "low|medium|high",
    "summary": "2-3 sentence overview"
  },
  "competitors": [
    {
      "name": "Name",
      "website": "URL or null",
      "description": "What they do",
      "positioning": "How positioned",
      "targetAudience": "Who they target",
      "pricingModel": "Model or null",
      "pricingRange": "$X-$Y/month or null",
      "strengths": ["strength1"],
      "weaknesses": ["weakness1"],
      "differentiators": ["unique thing"],
      "threatLevel": "low|medium|high",
      "userSatisfaction": 3.5,
      "fundingLevel": "unknown",
      "marketShareEstimate": "moderate"
    }
  ],
  "competitorMatrix": {
    "categories": ["Feature Set", "Pricing", "UX"],
    "comparison": []
  },
  "gaps": [
    {
      "gap": "Gap name",
      "description": "Description",
      "opportunity": "How to capitalize",
      "difficulty": "low|medium|high",
      "opportunityScore": 8,
      "validationSignals": ["signal1"]
    }
  ],
  "positioningRecommendations": [
    {
      "strategy": "Strategy name",
      "description": "How to execute",
      "targetNiche": "Target audience",
      "keyDifferentiators": ["diff1"],
      "messagingAngles": ["message1"]
    }
  ]
}

Identify 4-8 competitors. Return ONLY valid JSON.`

  const fallbackAnalysis = generateFallbackAnalysis(hypothesis, filteredKnownCompetitors || [])
  let analysis = fallbackAnalysis

  console.log('[CompetitorAnalyzer] Calling Claude API...')
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    })
    console.log('[CompetitorAnalyzer] Claude API call succeeded')

    const content = response.content[0]

    if (!content || content.type !== 'text') {
      console.error('[CompetitorAnalyzer] Unexpected response type from Claude, using fallback')
    } else {
      try {
        let jsonText = content.text.trim()
        if (jsonText.startsWith('```json')) jsonText = jsonText.slice(7)
        if (jsonText.startsWith('```')) jsonText = jsonText.slice(3)
        if (jsonText.endsWith('```')) jsonText = jsonText.slice(0, -3)
        analysis = JSON.parse(jsonText.trim())
        console.log('[CompetitorAnalyzer] Successfully parsed Claude response')
      } catch {
        console.error('[CompetitorAnalyzer] Failed to parse Claude response, using fallback')
      }
    }
  } catch (apiError) {
    console.error('[CompetitorAnalyzer] Claude API call failed, using fallback:', apiError)
    // Keep fallbackAnalysis as the analysis
  }
  console.log('[CompetitorAnalyzer] Analysis complete, returning result')

  // Normalize competitorMatrix to ensure it has both categories and comparison arrays
  const rawMatrix = analysis.competitorMatrix
  const normalizedMatrix = (rawMatrix && typeof rawMatrix === 'object')
    ? {
        categories: Array.isArray(rawMatrix.categories) ? rawMatrix.categories : [],
        comparison: Array.isArray(rawMatrix.comparison) ? rawMatrix.comparison : [],
      }
    : fallbackAnalysis.competitorMatrix

  const normalizedAnalysis = {
    marketOverview: analysis.marketOverview ?? fallbackAnalysis.marketOverview,
    competitors: Array.isArray(analysis.competitors) ? analysis.competitors : fallbackAnalysis.competitors,
    gaps: Array.isArray(analysis.gaps) ? analysis.gaps : fallbackAnalysis.gaps,
    positioningRecommendations: Array.isArray(analysis.positioningRecommendations)
      ? analysis.positioningRecommendations
      : fallbackAnalysis.positioningRecommendations,
    competitorMatrix: normalizedMatrix,
  }

  const competitors: Competitor[] = (normalizedAnalysis.competitors || []).map((c: Partial<Competitor>) => ({
    name: c.name || 'Unknown',
    website: c.website || null,
    description: c.description || '',
    positioning: c.positioning || '',
    targetAudience: c.targetAudience || '',
    pricingModel: c.pricingModel || null,
    pricingRange: c.pricingRange || null,
    strengths: c.strengths || [],
    weaknesses: c.weaknesses || [],
    differentiators: c.differentiators || [],
    threatLevel: c.threatLevel || 'medium',
    userSatisfaction: c.userSatisfaction || 3,
    fundingLevel: c.fundingLevel || 'unknown',
    marketShareEstimate: c.marketShareEstimate || 'moderate',
  }))

  const filteredCompetitors = filterSelfCompetitors(competitors, selfNames)

  const gaps: CompetitorGap[] = (normalizedAnalysis.gaps || []).map((g: Partial<CompetitorGap>) => ({
    gap: g.gap || '',
    description: g.description || '',
    opportunity: g.opportunity || '',
    difficulty: g.difficulty || 'medium',
    opportunityScore: g.opportunityScore || 5,
    validationSignals: g.validationSignals || [],
    evidenceCount: g.evidenceCount,
    sourceBreakdown: g.sourceBreakdown,
    clusterIds: g.clusterIds,
  }))

  const competitionScore = calculateCompetitionScore(
    filteredCompetitors,
    gaps,
    normalizedAnalysis.marketOverview
  )

  const processingTimeMs = Date.now() - startTime

  return {
    hypothesis,
    marketOverview: normalizedAnalysis.marketOverview,
    competitors: filteredCompetitors,
    competitorMatrix: filterSelfCompetitorMatrix(
      normalizedAnalysis.competitorMatrix || { categories: [], comparison: [] },
      selfNames
    ),
    gaps,
    positioningRecommendations: normalizedAnalysis.positioningRecommendations || [],
    competitionScore,
    metadata: {
      competitorsAnalyzed: filteredCompetitors.length,
      processingTimeMs,
      timestamp: new Date().toISOString(),
      autoDetected: !knownCompetitors?.length,
    },
  }
}
