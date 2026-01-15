/**
 * Competitor Analyzer - Core analysis logic extracted for reuse
 *
 * Used by:
 * - /api/research/competitor-intelligence (API route)
 * - /api/research/community-voice (auto-competitor analysis)
 */

import Anthropic from '@anthropic-ai/sdk'
import { formatClustersForPrompt, type SignalCluster } from '@/lib/embeddings'
import { AppStoreAdapter } from '@/lib/data-sources/adapters/app-store-adapter'
import { GooglePlayAdapter } from '@/lib/data-sources/adapters/google-play-adapter'

const anthropic = new Anthropic()
const appStoreAdapter = new AppStoreAdapter()
const googlePlayAdapter = new GooglePlayAdapter()

interface AppStoreData {
  rating: number
  reviewCount: number
  store: 'app_store' | 'google_play'
  appId: string
  appUrl: string
}

/**
 * Timeout wrapper with graceful error handling
 *
 * For app store lookups, we want ANY failure (timeout, network error, API error)
 * to return the fallback value. This is intentional - missing rating data is
 * acceptable, but crashes/hangs are not.
 *
 * Behavior:
 * - Returns result if promise resolves before timeout
 * - Returns fallback if promise rejects (any error)
 * - Returns fallback if timeout fires first
 * - Clears timer on resolve/reject to avoid leaks
 */
async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timeoutId: NodeJS.Timeout

  const timeout = new Promise<T>((resolve) => {
    timeoutId = setTimeout(() => resolve(fallback), ms)
  })

  const wrapped = promise
    .then((result) => {
      clearTimeout(timeoutId)
      return result
    })
    .catch(() => {
      clearTimeout(timeoutId)
      return fallback
    })

  return Promise.race([wrapped, timeout])
}

// Short/common names that are too ambiguous for confident matching
const AMBIGUOUS_NAMES = new Set([
  'flow', 'bolt', 'do', 'go', 'now', 'one', 'pro', 'plus', 'app', 'hub',
  'dash', 'sync', 'link', 'note', 'task', 'list', 'time', 'work', 'team'
])

/**
 * Check if app name is a confident match for competitor name
 * More strict than simple prefix matching to avoid false positives
 */
function isConfidentMatch(appName: string, competitorName: string): boolean {
  const appLower = appName.toLowerCase().trim()
  const compLower = competitorName.toLowerCase().trim()

  // Skip ambiguous short names - too many false positives
  if (compLower.length < 4 || AMBIGUOUS_NAMES.has(compLower)) {
    // For short names, require EXACT match only
    return appLower === compLower
  }

  // Exact match
  if (appLower === compLower) return true

  // App name starts with competitor name followed by word boundary
  // e.g., "Notion" matches "Notion - Notes & Tasks" but not "Notional Banking App"
  if (appLower.startsWith(compLower)) {
    const nextChar = appLower[compLower.length]
    if (!nextChar || [' ', '-', ':', '–', '—', '.'].includes(nextChar)) {
      return true
    }
  }

  return false
}

/**
 * Try to find competitor in app stores and get real rating
 * Returns null if not found or no confident match
 *
 * Safeguards:
 * - 5s timeout per store lookup
 * - Strict name matching to avoid false positives
 * - Prefers higher review count for ambiguous matches
 */
async function lookupAppStoreRating(competitorName: string): Promise<AppStoreData | null> {
  const TIMEOUT_MS = 5000

  try {
    // Try App Store first (usually has cleaner data)
    const appStoreResult = await withTimeout(
      appStoreAdapter.searchAppsWithDetails(competitorName, { maxApps: 5 }),
      TIMEOUT_MS,
      null
    )

    // Find confident match with highest review count
    const appStoreMatches = (appStoreResult?.apps || [])
      .filter(app => isConfidentMatch(app.name, competitorName) && app.rating > 0)
      .sort((a, b) => b.reviewCount - a.reviewCount)

    if (appStoreMatches.length > 0) {
      const best = appStoreMatches[0]
      return {
        rating: best.rating,
        reviewCount: best.reviewCount,
        store: 'app_store',
        appId: best.appId,
        appUrl: best.url,
      }
    }

    // Fallback to Google Play
    const playResult = await withTimeout(
      googlePlayAdapter.searchAppsWithDetails(competitorName, { maxApps: 5 }),
      TIMEOUT_MS,
      null
    )

    const playMatches = (playResult?.apps || [])
      .filter(app => isConfidentMatch(app.name, competitorName) && app.rating > 0)
      .sort((a, b) => b.reviewCount - a.reviewCount)

    if (playMatches.length > 0) {
      const best = playMatches[0]
      return {
        rating: best.rating,
        reviewCount: best.reviewCount,
        store: 'google_play',
        appId: best.appId,
        appUrl: best.url,
      }
    }

    return null
  } catch (error) {
    console.warn(`[CompetitorAnalyzer] App store lookup failed for "${competitorName}":`, error)
    return null
  }
}

// =============================================================================
// TYPES
// =============================================================================

export interface Competitor {
  name: string
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
  appStoreData?: AppStoreData
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

function isSelfNameMatch(candidate: string | null | undefined, selfNames: string[]): boolean {
  // Guard against undefined/null candidates (Claude may return malformed data)
  if (!candidate || typeof candidate !== 'string') return false
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

// =============================================================================
// NORMALIZE COMPETITOR MATRIX (handle Claude response format variations)
// =============================================================================

/**
 * Claude sometimes returns competitorMatrix in different formats:
 * - Expected: { competitorName: string, scores: { category, score, notes }[] }
 * - Received: { name: string, scores: number[] } or malformed entries
 *
 * This function normalizes to the expected format.
 */
function normalizeCompetitorMatrix(
  matrix: {
    categories?: string[]
    comparison?: unknown[]
  } | null | undefined
): { categories: string[]; comparison: { competitorName: string; scores: { category: string; score: number; notes: string }[] }[] } {
  if (!matrix || !matrix.categories || !matrix.comparison) {
    return { categories: [], comparison: [] }
  }

  const categories = matrix.categories
  const normalizedComparison = matrix.comparison
    .filter((comp): comp is Record<string, unknown> =>
      comp !== null && typeof comp === 'object'
    )
    .map(comp => {
      // Handle both 'competitorName' and 'name' field names
      const competitorName =
        (typeof comp.competitorName === 'string' && comp.competitorName) ||
        (typeof comp.name === 'string' && comp.name) ||
        'Unknown'

      // Handle both array of objects and array of numbers for scores
      let scores: { category: string; score: number; notes: string }[]
      const rawScores = comp.scores

      if (Array.isArray(rawScores) && rawScores.length > 0) {
        if (typeof rawScores[0] === 'number') {
          // Scores is number[] - convert to { category, score, notes }[]
          scores = rawScores.map((score, index) => ({
            category: categories[index] || `Category ${index + 1}`,
            score: typeof score === 'number' ? score : 0,
            notes: ''
          }))
        } else {
          // Scores is already objects - normalize notes field
          scores = rawScores
            .filter((s): s is Record<string, unknown> => s !== null && typeof s === 'object')
            .map(s => ({
              category: typeof s.category === 'string' ? s.category : '',
              score: typeof s.score === 'number' ? s.score : 0,
              notes: typeof s.notes === 'string' ? s.notes : ''
            }))
        }
      } else {
        scores = []
      }

      return { competitorName, scores }
    })

  return { categories, comparison: normalizedComparison }
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

/**
 * Create a complete fallback competitor result when analysis fails.
 * This ensures the UI always has something to display.
 */
export function createFallbackCompetitorResult(
  hypothesis: string,
  knownCompetitors: string[] = [],
  errorReason?: string
): CompetitorIntelligenceResult {
  const fallback = generateFallbackAnalysis(hypothesis, knownCompetitors)

  // Build complete competitor objects from partial
  const competitors: Competitor[] = fallback.competitors.map(c => ({
    name: c.name || 'Unknown',
    description: c.description || '',
    positioning: c.positioning || 'Unknown',
    targetAudience: c.targetAudience || 'General market',
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

  // Build complete gap objects from partial
  const gaps: CompetitorGap[] = fallback.gaps.map(g => ({
    gap: g.gap || '',
    description: g.description || '',
    opportunity: g.opportunity || '',
    difficulty: g.difficulty || 'medium',
    opportunityScore: g.opportunityScore || 5,
    validationSignals: g.validationSignals || [],
  }))

  // Calculate a basic competition score
  const competitionScore: CompetitionScoreBreakdown = {
    score: 5, // Neutral default
    confidence: 'low',
    reasoning: errorReason
      ? `Analysis incomplete: ${errorReason}. Manual research recommended.`
      : 'Analysis incomplete. Manual research recommended.',
    factors: {
      competitorCount: { value: knownCompetitors.length, impact: 0 },
      fundingLevels: { description: 'Unknown', impact: 0 },
      userSatisfaction: { average: 0, impact: 0 },
      marketGaps: { count: 1, impact: 0 },
      priceHeadroom: { exists: false, impact: 0 },
    },
    threats: [],
  }

  return {
    hypothesis,
    marketOverview: fallback.marketOverview,
    competitors,
    competitorMatrix: fallback.competitorMatrix,
    gaps,
    positioningRecommendations: fallback.positioningRecommendations,
    competitionScore,
    metadata: {
      competitorsAnalyzed: competitors.length,
      processingTimeMs: 0,
      timestamp: new Date().toISOString(),
      autoDetected: true,
      // @ts-expect-error - Adding fallback flag for UI to detect
      isFallback: true,
      fallbackReason: errorReason,
    },
  }
}

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

  // Cap competitors and filter invalid entries (ensure array)
  const safeCompetitors = Array.isArray(knownCompetitors) ? knownCompetitors : []
  const cappedCompetitors = safeCompetitors.slice(0, maxCompetitors)
  const filteredKnownCompetitors = cappedCompetitors.filter(
    (name) => typeof name === 'string' && name.trim() && !isSelfNameMatch(name, selfNames)
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
  // Defensive: Ensure clusters is an array before processing
  if (Array.isArray(clusters) && clusters.length > 0) {
    // Filter out invalid cluster entries (null, undefined, non-objects)
    const validClusters = clusters.filter(
      (c): c is SignalCluster => c != null && typeof c === 'object'
    )

    if (validClusters.length > 0) {
      try {
        // Safe reducer with numeric coercion for missing/invalid size
        const totalSignals = validClusters.reduce((sum, c) => sum + (Number(c.size) || 0), 0)
        const formattedClusters = formatClustersForPrompt(validClusters)
        evidencePrompt = `

=== REAL USER FEEDBACK (${totalSignals} signals, pre-clustered) ===

${formattedClusters}

CRITICAL: Ground gaps in the user feedback clusters above. Reference specific clusters.
`
      } catch (clusterError) {
        // Log but don't fail - competitor analysis can proceed without cluster evidence
        console.warn('[CompetitorAnalyzer] Failed to format clusters for prompt:', clusterError)
      }
    }
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
    "categories": ["Feature Set", "Pricing", "User Experience", "Brand Recognition", "Customer Support"],
    "comparison": [
      {
        "competitorName": "Competitor 1 Name",
        "scores": [
          {"category": "Feature Set", "score": 8, "notes": "Comprehensive features"},
          {"category": "Pricing", "score": 6, "notes": "Premium pricing"},
          {"category": "User Experience", "score": 7, "notes": "Clean interface"},
          {"category": "Brand Recognition", "score": 5, "notes": "Moderate awareness"},
          {"category": "Customer Support", "score": 6, "notes": "Email only"}
        ]
      }
    ]
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

IMPORTANT: The competitorMatrix.comparison array MUST include an entry for EACH competitor with their actual name in the "competitorName" field. Do not leave comparison empty.

COMPETITOR TYPES TO INCLUDE:
Include a diverse mix of alternatives that solve the same problem:
1. **Digital/App solutions** - Software, apps, online services
2. **Physical products** - Hardware, equipment, tangible goods
3. **Service-based alternatives** - Venues, lounges, rentals, professional services
4. **DIY/Behavioral workarounds** - Common solutions people already use (e.g., "people currently just use X")

Don't limit competitors to just tech products. Users choose between ALL alternatives that solve their problem.

Identify 4-8 competitors across these categories. Return ONLY valid JSON.`

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

  // Normalize competitorMatrix to ensure proper format (handles Claude response variations)
  const rawMatrix = analysis.competitorMatrix
  const processedMatrix = normalizeCompetitorMatrix(rawMatrix)

  // Get competitor names from the competitors array for cross-referencing
  const competitorNames = Array.isArray(analysis.competitors)
    ? analysis.competitors.map((c: { name?: string }) => c.name || 'Unknown')
    : []

  // Cross-reference: if matrix entries have "Unknown" names, try to map by index
  const crossReferencedMatrix = {
    categories: processedMatrix.categories,
    comparison: processedMatrix.comparison.map((entry, index) => {
      if (entry.competitorName === 'Unknown' && competitorNames[index]) {
        return { ...entry, competitorName: competitorNames[index] }
      }
      return entry
    })
  }

  const normalizedMatrix = crossReferencedMatrix.comparison.length > 0
    ? crossReferencedMatrix
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

  /**
   * Process array with limited concurrency to avoid rate limiting
   * Uses a simple semaphore pattern
   */
  async function processWithConcurrency<T, R>(
    items: T[],
    fn: (item: T) => Promise<R>,
    concurrency: number
  ): Promise<R[]> {
    const results: R[] = new Array(items.length)
    let currentIndex = 0

    async function worker() {
      while (currentIndex < items.length) {
        const index = currentIndex++
        results[index] = await fn(items[index])
      }
    }

    // Spawn `concurrency` workers
    const workers = Array(Math.min(concurrency, items.length))
      .fill(null)
      .map(() => worker())

    await Promise.all(workers)
    return results
  }

  // Enrich competitors with real app store ratings
  // Global time budget: 15s max for all lookups to avoid excessive latency
  const LOOKUP_TIME_BUDGET_MS = 15000
  const lookupStartTime = Date.now()
  let lookupTimedOut = false

  const enrichedCompetitors = await processWithConcurrency(
    filteredCompetitors,
    async (competitor) => {
      // Check global time budget before each lookup
      if (lookupTimedOut || (Date.now() - lookupStartTime) > LOOKUP_TIME_BUDGET_MS) {
        lookupTimedOut = true
        return competitor // Skip lookup, return as-is
      }
      const appStoreData = await lookupAppStoreRating(competitor.name)
      return appStoreData ? { ...competitor, appStoreData } : competitor
    },
    2 // Max 2 concurrent lookups
  )

  if (lookupTimedOut) {
    console.log('[CompetitorAnalyzer] App store lookups timed out (15s budget exceeded)')
  }

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
    enrichedCompetitors,
    gaps,
    normalizedAnalysis.marketOverview
  )

  const processingTimeMs = Date.now() - startTime

  return {
    hypothesis,
    marketOverview: normalizedAnalysis.marketOverview,
    competitors: enrichedCompetitors,
    competitorMatrix: filterSelfCompetitorMatrix(
      normalizedAnalysis.competitorMatrix || { categories: [], comparison: [] },
      selfNames
    ),
    gaps,
    positioningRecommendations: normalizedAnalysis.positioningRecommendations || [],
    competitionScore,
    metadata: {
      competitorsAnalyzed: enrichedCompetitors.length,
      processingTimeMs,
      timestamp: new Date().toISOString(),
      autoDetected: !knownCompetitors?.length,
    },
  }
}
