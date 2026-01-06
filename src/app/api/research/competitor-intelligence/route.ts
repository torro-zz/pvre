import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkUserCredits, deductCredit } from '@/lib/credits'
import Anthropic from '@anthropic-ai/sdk'
import { StepStatusMap } from '@/types/database'
import { saveResearchResult } from '@/lib/research/save-result'
import { formatClustersForPrompt, type SignalCluster } from '@/lib/embeddings'
import { extractComparativeMentions, type ComparativeMentionsResult } from '@/lib/analysis/comparative-mentions'

const anthropic = new Anthropic()

// Helper to update step status
async function updateStepStatus(
  jobId: string,
  stepName: keyof StepStatusMap,
  status: StepStatusMap[keyof StepStatusMap]
) {
  const adminClient = createAdminClient()

  // Get current step status
  const { data: job } = await adminClient
    .from('research_jobs')
    .select('step_status')
    .eq('id', jobId)
    .single()

  const currentStatus = (job?.step_status as unknown as StepStatusMap) || {
    pain_analysis: 'pending',
    market_sizing: 'locked',
    timing_analysis: 'locked',
    competitor_analysis: 'locked',
  }

  // Update the step status
  const newStatus: StepStatusMap = {
    ...currentStatus,
    [stepName]: status,
  }

  await adminClient
    .from('research_jobs')
    .update({ step_status: JSON.parse(JSON.stringify(newStatus)) })
    .eq('id', jobId)
}

// =============================================================================
// TYPES - Enhanced for PVRE Scoring Framework
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
  // Enhanced fields for scoring
  threatLevel: 'low' | 'medium' | 'high'
  userSatisfaction: number // 1-5 scale estimate
  fundingLevel: 'bootstrapped' | 'seed' | 'series-a' | 'series-b-plus' | 'public' | 'unknown'
  marketShareEstimate: 'dominant' | 'significant' | 'moderate' | 'small' | 'emerging'
}

export interface CompetitorGap {
  gap: string
  description: string
  opportunity: string
  difficulty: 'low' | 'medium' | 'high'
  // Enhanced fields
  opportunityScore: number // 1-10 scale
  validationSignals: string[] // Evidence supporting this gap
  // Evidence-grounded fields (Jan 2026 - from clustering)
  evidenceCount?: number // Total signals supporting this gap
  sourceBreakdown?: {
    appStore?: number
    googlePlay?: number
    reddit?: number
  }
  clusterIds?: string[] // Which clusters this gap is based on
}

export interface PositioningRecommendation {
  strategy: string
  description: string
  targetNiche: string
  keyDifferentiators: string[]
  messagingAngles: string[]
}

// Competition Score breakdown for transparency
export interface CompetitionScoreBreakdown {
  score: number // 0-10 overall competition score
  confidence: 'low' | 'medium' | 'high'
  reasoning: string
  factors: {
    competitorCount: { value: number; impact: number } // positive = good for new entrant
    fundingLevels: { description: string; impact: number }
    userSatisfaction: { average: number; impact: number } // low satisfaction = opportunity
    marketGaps: { count: number; impact: number }
    priceHeadroom: { exists: boolean; impact: number }
  }
  threats: string[] // Top threats to watch
}

export interface CompetitorIntelligenceResult {
  hypothesis: string
  // App Gap mode: normalized app name for self-filtering (e.g., "loom" from "Loom: Screen Recorder")
  // Hypothesis mode: null (no self-filtering needed)
  analyzedAppName?: string | null
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
  // NEW: Competition score for Viability Verdict
  competitionScore: CompetitionScoreBreakdown
  // NEW: Real user comparative mentions (Jan 2026)
  comparativeMentions?: ComparativeMentionsResult
  metadata: {
    competitorsAnalyzed: number
    processingTimeMs: number
    timestamp: string
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
  let score = 5 // Start neutral
  const factors: CompetitionScoreBreakdown['factors'] = {
    competitorCount: { value: 0, impact: 0 },
    fundingLevels: { description: '', impact: 0 },
    userSatisfaction: { average: 0, impact: 0 },
    marketGaps: { count: 0, impact: 0 },
    priceHeadroom: { exists: false, impact: 0 },
  }
  const threats: string[] = []

  // Factor 1: Number of direct competitors
  const directCompetitorCount = competitors.length
  factors.competitorCount.value = directCompetitorCount

  if (directCompetitorCount === 0) {
    score += 2 // Greenfield - but validate demand exists!
    factors.competitorCount.impact = 2
  } else if (directCompetitorCount <= 3) {
    score += 1 // Light competition
    factors.competitorCount.impact = 1
  } else if (directCompetitorCount <= 7) {
    // Normal competition - no change
    factors.competitorCount.impact = 0
  } else {
    score -= 1.5 // Crowded market
    factors.competitorCount.impact = -1.5
  }

  // Factor 2: Competitor strength (funding)
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

  // Factor 3: User satisfaction gaps
  const satisfactionScores = competitors
    .map((c) => c.userSatisfaction)
    .filter((s) => s > 0)

  if (satisfactionScores.length > 0) {
    const avgSatisfaction = satisfactionScores.reduce((a, b) => a + b, 0) / satisfactionScores.length
    factors.userSatisfaction.average = Math.round(avgSatisfaction * 10) / 10

    if (avgSatisfaction < 3) {
      score += 2 // Users unhappy - big opportunity!
      factors.userSatisfaction.impact = 2
    } else if (avgSatisfaction < 4) {
      score += 1 // Room for improvement
      factors.userSatisfaction.impact = 1
    } else if (avgSatisfaction >= 4.5) {
      score -= 1 // Users happy - hard to displace
      factors.userSatisfaction.impact = -1
      threats.push('Incumbent competitors have high user satisfaction')
    }
  }

  // Factor 4: Clear positioning gaps exist
  const highOpportunityGaps = gaps.filter((g) => g.opportunityScore >= 7)
  factors.marketGaps.count = gaps.length

  if (highOpportunityGaps.length >= 2) {
    score += 1
    factors.marketGaps.impact = 1
  } else if (gaps.length >= 3) {
    score += 0.5
    factors.marketGaps.impact = 0.5
  }

  // Factor 5: Price headroom
  const hasPremiumPricing = competitors.some((c) => {
    if (!c.pricingRange) return false
    // Check if any competitor charges $50+/month
    const priceMatch = c.pricingRange.match(/\$(\d+)/)
    return priceMatch && parseInt(priceMatch[1]) >= 50
  })

  factors.priceHeadroom.exists = hasPremiumPricing
  if (hasPremiumPricing) {
    score += 0.5
    factors.priceHeadroom.impact = 0.5
  }

  // Factor 6: Market intensity adjustment
  if (marketOverview.competitionIntensity === 'high') {
    score -= 0.5
    threats.push('High overall market competition intensity')
  } else if (marketOverview.competitionIntensity === 'low') {
    score += 0.5
  }

  // High-threat competitors
  const highThreatCompetitors = competitors.filter((c) => c.threatLevel === 'high')
  for (const competitor of highThreatCompetitors.slice(0, 2)) {
    threats.push(`${competitor.name} poses high competitive threat`)
  }

  // Generate reasoning
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

  // Clamp score to 0-10
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
// NORMALIZE COMPETITOR MATRIX (handle Claude response format variations)
// =============================================================================

/**
 * Claude sometimes returns competitorMatrix in different formats:
 * - Expected: { competitorName: string, scores: { category, score, notes }[] }
 * - Received: { name: string, scores: number[] }
 *
 * This function normalizes to the expected format.
 */
function normalizeCompetitorMatrix(
  matrix: {
    categories?: string[]
    comparison?: Array<{
      competitorName?: string
      name?: string
      scores: Array<{ category: string; score: number; notes?: string }> | number[]
    }>
  } | null | undefined
): { categories: string[]; comparison: { competitorName: string; scores: { category: string; score: number; notes: string }[] }[] } {
  if (!matrix || !matrix.categories || !matrix.comparison) {
    return { categories: [], comparison: [] }
  }

  const categories = matrix.categories
  const normalizedComparison = matrix.comparison.map(comp => {
    // Handle both 'competitorName' and 'name' field names
    const competitorName = comp.competitorName || comp.name || 'Unknown'

    // Handle both array of objects and array of numbers for scores
    let scores: { category: string; score: number; notes: string }[]

    if (Array.isArray(comp.scores) && comp.scores.length > 0) {
      if (typeof comp.scores[0] === 'number') {
        // Scores is number[] - convert to { category, score, notes }[]
        scores = (comp.scores as number[]).map((score, index) => ({
          category: categories[index] || `Category ${index + 1}`,
          score: typeof score === 'number' ? score : 0,
          notes: ''
        }))
      } else {
        // Scores is already { category, score, notes }[] - normalize notes field
        scores = (comp.scores as Array<{ category: string; score: number; notes?: string }>).map(s => ({
          category: s.category,
          score: s.score,
          notes: s.notes || ''
        }))
      }
    } else {
      scores = []
    }

    return { competitorName, scores }
  })

  return { categories, comparison: normalizedComparison }
}

// =============================================================================
// FALLBACK ANALYSIS (when Claude parsing fails)
// =============================================================================

function generateFallbackAnalysis(
  hypothesis: string,
  knownCompetitors: string[] = []
): {
  marketOverview: CompetitorIntelligenceResult['marketOverview']
  competitors: Partial<Competitor>[]
  gaps: Partial<CompetitorGap>[]
  positioningRecommendations: PositioningRecommendation[]
  competitorMatrix: { categories: string[]; comparison: { competitorName: string; scores: { category: string; score: number; notes: string }[] }[] }
} {
  // Generate basic competitor profiles from names
  const competitors: Partial<Competitor>[] = knownCompetitors.map(name => ({
    name,
    website: null,
    description: `${name} is a competitor in this market space. Analysis details unavailable due to processing error.`,
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

  // Generate basic market overview
  const marketOverview: CompetitorIntelligenceResult['marketOverview'] = {
    marketSize: 'Unknown - analysis incomplete',
    growthTrend: 'Requires further research',
    maturityLevel: 'growing' as const,
    competitionIntensity: knownCompetitors.length >= 5 ? 'high' as const : 'medium' as const,
    summary: `This market has ${knownCompetitors.length} known competitors. Full analysis was not available due to a processing error. Consider re-running the analysis or conducting manual research.`,
  }

  // Generate placeholder gaps
  const gaps: Partial<CompetitorGap>[] = [
    {
      gap: 'Detailed competitive analysis needed',
      description: 'The automated analysis encountered an issue. Manual research recommended.',
      opportunity: 'To be determined',
      difficulty: 'medium' as const,
      opportunityScore: 5,
      validationSignals: [],
    },
  ]

  // Generic positioning recommendations
  const positioningRecommendations: PositioningRecommendation[] = [
    {
      strategy: 'Conduct manual competitive research',
      description: 'Re-run the analysis or manually research competitors to identify positioning opportunities.',
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
// COMPETITOR ANALYSIS
// =============================================================================

interface GeographyInfo {
  location?: string
  scope?: 'local' | 'national' | 'global'
}

async function analyzeCompetitors(
  hypothesis: string,
  knownCompetitors?: string[],
  geography?: GeographyInfo,
  clusters?: SignalCluster[], // Pre-clustered user feedback for evidence-grounded gaps
  analyzedAppName?: string | null // App Gap mode: normalized app name for self-filtering
): Promise<CompetitorIntelligenceResult> {
  const startTime = Date.now()

  const competitorListPrompt = knownCompetitors?.length
    ? `The user has mentioned these known competitors: ${knownCompetitors.join(', ')}. Include these and identify additional competitors.`
    : 'Identify the main competitors in this space.'

  // Build geography-specific instructions
  let geographyPrompt = ''
  if (geography?.location && geography.scope !== 'global') {
    geographyPrompt = `
CRITICAL GEOGRAPHIC FOCUS:
The founder is targeting ${geography.location} specifically (${geography.scope} scope).
- PRIORITIZE competitors that operate in or target ${geography.location}
- Include local/regional competitors specific to ${geography.location}
- For global competitors, note whether they have presence/localization in ${geography.location}
- Consider local market dynamics, regulations, and cultural factors specific to ${geography.location}
- If a global competitor doesn't have good ${geography.location} presence, note this as a weakness
`
  } else if (geography?.location) {
    geographyPrompt = `
The founder is building a global/online business but is based in ${geography.location}. Include both global competitors and any regional players that may be relevant.
`
  }

  // Build evidence section from clusters (if available)
  let evidencePrompt = ''
  if (clusters && clusters.length > 0) {
    const totalSignals = clusters.reduce((sum, c) => sum + c.size, 0)
    const formattedClusters = formatClustersForPrompt(clusters)
    evidencePrompt = `

=== REAL USER FEEDBACK (${totalSignals} signals, pre-clustered by semantic similarity) ===

${formattedClusters}

CRITICAL INSTRUCTIONS FOR GAP IDENTIFICATION:
1. Each gap you identify MUST be grounded in the user feedback clusters above
2. Reference specific clusters when identifying gaps (e.g., "Based on Cluster 1 with 24 signals...")
3. For each gap, include:
   - evidenceCount: Total number of signals supporting this gap
   - Which clusters support it (by number/label)
   - Source breakdown (how many from App Store vs Reddit)
4. DO NOT identify gaps that are not supported by the user feedback
5. Prioritize gaps with the highest evidence counts
`
  }

  const prompt = `You are a competitive intelligence analyst specializing in startup market analysis. Analyze the competitive landscape for this business hypothesis:

"${hypothesis}"

${competitorListPrompt}
${geographyPrompt}
${evidencePrompt}
Provide a comprehensive competitive analysis in the following JSON format. Be specific and detailed. For pricing, use real-world estimates based on similar products if exact data isn't available.

IMPORTANT: For each competitor, assess:
- threatLevel: How threatening are they to a new entrant? (low/medium/high)
- userSatisfaction: Estimated user satisfaction 1-5 based on market perception, reviews, complaints
- fundingLevel: bootstrapped/seed/series-a/series-b-plus/public/unknown
- marketShareEstimate: dominant/significant/moderate/small/emerging

For gaps, include:
- opportunityScore: 1-10 rating of how attractive this opportunity is
- validationSignals: Evidence supporting this gap exists (user complaints, missing features, etc.)
${clusters && clusters.length > 0 ? `- evidenceCount: Number of signals supporting this gap (from clusters above)
- sourceBreakdown: { "appStore": X, "reddit": Y } - where evidence came from
- clusterIds: ["cluster_0", "cluster_1"] - which clusters support this gap` : ''}

{
  "marketOverview": {
    "marketSize": "Estimated market size (e.g., '$2B globally', 'Growing niche market')",
    "growthTrend": "Market growth trend description",
    "maturityLevel": "emerging|growing|mature|declining",
    "competitionIntensity": "low|medium|high",
    "summary": "2-3 sentence market overview"
  },
  "competitors": [
    {
      "name": "Competitor name",
      "website": "website URL or null",
      "description": "What they do",
      "positioning": "How they position themselves",
      "targetAudience": "Who they target",
      "pricingModel": "Subscription/One-time/Freemium/etc or null",
      "pricingRange": "$X-$Y/month or null",
      "strengths": ["strength1", "strength2"],
      "weaknesses": ["weakness1", "weakness2"],
      "differentiators": ["what makes them unique"],
      "threatLevel": "low|medium|high",
      "userSatisfaction": 3.5,
      "fundingLevel": "bootstrapped|seed|series-a|series-b-plus|public|unknown",
      "marketShareEstimate": "dominant|significant|moderate|small|emerging"
    }
  ],
  "competitorMatrix": {
    "categories": ["Feature Set", "Pricing", "User Experience", "Brand Recognition", "Customer Support"],
    "comparison": [
      {
        "competitorName": "Competitor 1",
        "scores": [
          {"category": "Feature Set", "score": 8, "notes": "Comprehensive but complex"},
          {"category": "Pricing", "score": 6, "notes": "Premium pricing"}
        ]
      }
    ]
  },
  "gaps": [
    {
      "gap": "Underserved segment or missing feature",
      "description": "Detailed description of the gap",
      "opportunity": "How a new entrant could capitalize",
      "difficulty": "low|medium|high",
      "opportunityScore": 8,
      "validationSignals": ["User complaint about X", "No competitor offers Y"],
      "evidenceCount": 24,
      "sourceBreakdown": {"appStore": 18, "reddit": 6},
      "clusterIds": ["cluster_0"]
    }
  ],
  "positioningRecommendations": [
    {
      "strategy": "Strategy name (e.g., 'Niche Focus', 'Price Leader', 'Innovation Leader')",
      "description": "How to execute this strategy",
      "targetNiche": "Specific audience to target",
      "keyDifferentiators": ["differentiator1", "differentiator2"],
      "messagingAngles": ["Key message 1", "Key message 2"]
    }
  ]
}

Identify 4-8 competitors. Include at least 3 gaps and 2 positioning recommendations. Return ONLY valid JSON, no markdown formatting.`

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude')
  }

  // Parse the JSON response
  let analysis
  try {
    // Clean up the response - remove any markdown code blocks if present
    let jsonText = content.text.trim()
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7)
    }
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3)
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3)
    }
    analysis = JSON.parse(jsonText.trim())
  } catch (parseError) {
    console.error('Failed to parse Claude response, using fallback:', parseError)
    // Generate fallback analysis from input competitors
    analysis = generateFallbackAnalysis(hypothesis, knownCompetitors || [])
  }

  // Ensure all competitors have the enhanced fields with defaults
  const competitors: Competitor[] = (analysis.competitors || []).map((c: Partial<Competitor>) => ({
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

  // Ensure all gaps have enhanced fields
  const gaps: CompetitorGap[] = (analysis.gaps || []).map((g: Partial<CompetitorGap>) => ({
    gap: g.gap || '',
    description: g.description || '',
    opportunity: g.opportunity || '',
    difficulty: g.difficulty || 'medium',
    opportunityScore: g.opportunityScore || 5,
    validationSignals: g.validationSignals || [],
    // Evidence-grounded fields (from clustering)
    evidenceCount: g.evidenceCount,
    sourceBreakdown: g.sourceBreakdown,
    clusterIds: g.clusterIds,
  }))

  // Calculate competition score
  const competitionScore = calculateCompetitionScore(
    competitors,
    gaps,
    analysis.marketOverview
  )

  const processingTimeMs = Date.now() - startTime

  // Normalize competitorMatrix to match expected UI format
  // Claude sometimes returns { name, scores: number[] } instead of { competitorName, scores: { category, score, notes }[] }
  const normalizedMatrix = normalizeCompetitorMatrix(analysis.competitorMatrix)

  // Extract comparative mentions from clusters (real user data!)
  let comparativeMentions: ComparativeMentionsResult | undefined
  if (clusters && clusters.length > 0) {
    // Extract signal texts from clusters
    const signalTexts: Array<{ text: string; source: string }> = []
    for (const cluster of clusters) {
      for (const signal of cluster.signals) {
        const text = signal.post.body || signal.post.title || ''
        if (text.length > 20) {
          signalTexts.push({
            text,
            source: signal.post.source === 'appstore' ? 'app_store'
              : signal.post.source === 'playstore' ? 'google_play'
              : 'reddit'
          })
        }
      }
    }

    // Use provided analyzedAppName for self-exclusion (App Gap mode)
    // This is properly extracted from coverage_data.appData.name
    if (signalTexts.length > 0 && analyzedAppName) {
      comparativeMentions = extractComparativeMentions(
        signalTexts as Array<{ text: string; source: 'app_store' | 'google_play' | 'reddit' }>,
        analyzedAppName
      )
      console.log(`Extracted ${comparativeMentions.totalMentions} comparative mentions from ${signalTexts.length} signals (excluding: ${analyzedAppName})`)
    }
  }

  return {
    hypothesis,
    analyzedAppName, // For UI self-filtering (App Gap mode only)
    marketOverview: analysis.marketOverview,
    competitors,
    competitorMatrix: normalizedMatrix,
    gaps,
    positioningRecommendations: analysis.positioningRecommendations || [],
    competitionScore,
    comparativeMentions,
    metadata: {
      competitorsAnalyzed: competitors.length,
      processingTimeMs,
      timestamp: new Date().toISOString(),
    },
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { hypothesis, knownCompetitors, jobId } = body

    if (!hypothesis || typeof hypothesis !== 'string') {
      return NextResponse.json(
        { error: 'Hypothesis is required' },
        { status: 400 }
      )
    }

    // Check credits before running research
    const creditCheck = await checkUserCredits(user.id)
    if (!creditCheck.hasCredits) {
      return NextResponse.json(
        {
          error: 'insufficient_credits',
          message: 'You need at least 1 credit to run research. Please purchase a credit pack.',
          balance: creditCheck.balance
        },
        { status: 402 }
      )
    }

    // Generate job ID if not provided (for credit deduction tracking)
    const researchJobId = jobId || crypto.randomUUID()

    // Geography info for localization
    let geography: GeographyInfo | undefined

    // Clusters for evidence-grounded gaps (fetched from community_voice if available)
    let clusters: SignalCluster[] | undefined

    // Normalized app name for self-filtering (App Gap mode only)
    let analyzedAppName: string | null = null

    // If jobId provided, check step guard and fetch geography + clusters
    if (jobId) {
      const adminClient = createAdminClient()
      const { data: job } = await adminClient
        .from('research_jobs')
        .select('step_status, coverage_data')
        .eq('id', jobId)
        .single()

      const stepStatus = job?.step_status as unknown as StepStatusMap | null

      // Extract geography from coverage_data for localized competitor analysis
      const coverageData = (job as Record<string, unknown>)?.coverage_data as Record<string, unknown> | undefined
      if (coverageData?.targetGeography) {
        const targetGeo = coverageData.targetGeography as { location?: string; scope?: string }
        geography = {
          location: targetGeo.location,
          scope: targetGeo.scope as 'local' | 'national' | 'global',
        }
        console.log('Using target geography for competitor analysis:', geography)
      }

      // Extract app name AND developer for self-filtering (App Gap mode only)
      if (coverageData?.mode === 'app-analysis') {
        const appData = coverageData?.appData as { name?: string; developer?: string } | undefined
        if (appData?.name) {
          // Normalize: "Tinder Dating App: Chat & Date" → "tinder"
          // "Loom: Screen Recorder" → "loom"
          analyzedAppName = appData.name.split(/[:\-–—]/)[0].trim().toLowerCase()
          // Also include developer name for self-filtering (e.g., "OpenAI" for ChatGPT)
          if (appData.developer) {
            // Combine app name and developer: "chatgpt|openai"
            analyzedAppName = `${analyzedAppName}|${appData.developer.toLowerCase().trim()}`
          }
          console.log(`App Gap mode: using app filter "${analyzedAppName}" for self-filtering`)
        }
      }

      // Fetch clusters from community_voice results (Jan 2026 - evidence-grounded gaps)
      try {
        const { data: cvResult } = await adminClient
          .from('research_results')
          .select('result_data')
          .eq('job_id', jobId)
          .eq('module_name', 'community_voice')
          .single()

        // Cast to access JSONB field (result_data is Json type in Supabase)
        const resultData = (cvResult as Record<string, unknown> | null)?.result_data as Record<string, unknown> | undefined
        if (resultData?.clusters && Array.isArray(resultData.clusters)) {
          clusters = resultData.clusters as SignalCluster[]
          const totalSignals = clusters.reduce((sum, c) => sum + c.size, 0)
          console.log(`Fetched ${clusters.length} clusters (${totalSignals} total signals) for evidence-grounded gap analysis`)
        }
      } catch (fetchError) {
        console.log('No clusters available from community_voice (may not be App Gap mode):', fetchError)
      }

      // Check if timing_analysis is completed (required before competitor_analysis)
      if (stepStatus && stepStatus.timing_analysis !== 'completed') {
        return NextResponse.json(
          { error: 'Timing analysis must be completed before competitor analysis' },
          { status: 400 }
        )
      }

      // Check if competitor_analysis is locked
      if (stepStatus && stepStatus.competitor_analysis === 'locked') {
        return NextResponse.json(
          { error: 'Competitor analysis is locked. Complete previous steps first.' },
          { status: 400 }
        )
      }

      // Update step status to in_progress
      await updateStepStatus(jobId, 'competitor_analysis', 'in_progress')
      console.log('Skipping credit deduction - running on existing job:', jobId)
    } else {
      // Skip credit deduction if running on an existing research job
      // The credit was already paid when the initial research was created
      // Only charge credits for standalone competitor analysis (no jobId)
      const creditDeducted = await deductCredit(user.id, researchJobId)
      if (!creditDeducted) {
        return NextResponse.json(
          {
            error: 'credit_deduction_failed',
            message: 'Failed to deduct credit. Please try again.',
          },
          { status: 500 }
        )
      }
    }

    console.log('Starting competitor analysis for:', hypothesis)
    if (knownCompetitors?.length) {
      console.log('Known competitors:', knownCompetitors)
    }
    if (geography) {
      console.log('Target geography:', geography.location, `(${geography.scope})`)
    }

    // Run the competitor analysis with geography context, clusters (if available), and app name (App Gap mode)
    const result = await analyzeCompetitors(hypothesis, knownCompetitors, geography, clusters, analyzedAppName)

    console.log(`Found ${result.competitors.length} competitors`)
    console.log(`Identified ${result.gaps.length} market gaps`)
    console.log(`Competition score: ${result.competitionScore.score}/10`)

    // If jobId is provided, save results to database and update step status
    if (jobId) {
      try {
        // Save results using shared utility
        await saveResearchResult(jobId, 'competitor_intelligence', result)

        // Update step status to completed
        await updateStepStatus(jobId, 'competitor_analysis', 'completed')

        // Mark overall job as completed (this is the final step)
        const adminClient = createAdminClient()
        await adminClient
          .from('research_jobs')
          .update({ status: 'completed' })
          .eq('id', jobId)

        console.log('Saved competitor intelligence results and marked job as completed')
      } catch (dbError) {
        console.error('Failed to save results to database:', dbError)
        // Update step status to failed
        await updateStepStatus(jobId, 'competitor_analysis', 'failed')
      }
    }

    console.log(`Competitor analysis completed in ${result.metadata.processingTimeMs}ms`)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Competitor intelligence research failed:', error)

    // Update step status to failed if jobId provided
    const body = await request.clone().json().catch(() => ({}))
    if (body.jobId) {
      await updateStepStatus(body.jobId, 'competitor_analysis', 'failed')
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Research failed' },
      { status: 500 }
    )
  }
}

// GET endpoint to fetch cached results
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const jobId = searchParams.get('jobId')

    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId is required' },
        { status: 400 }
      )
    }

    // Fetch results from database
    const { data: results, error: fetchError } = await supabase
      .from('research_results')
      .select('*')
      .eq('job_id', jobId)
      .eq('module_name', 'competitor_intel')
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Results not found' },
          { status: 404 }
        )
      }
      throw fetchError
    }

    return NextResponse.json(results.data)
  } catch (error) {
    console.error('Failed to fetch results:', error)
    return NextResponse.json(
      { error: 'Failed to fetch results' },
      { status: 500 }
    )
  }
}
