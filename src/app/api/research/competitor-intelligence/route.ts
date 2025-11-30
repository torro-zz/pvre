import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

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
// COMPETITOR ANALYSIS
// =============================================================================

async function analyzeCompetitors(
  hypothesis: string,
  knownCompetitors?: string[]
): Promise<CompetitorIntelligenceResult> {
  const startTime = Date.now()

  const competitorListPrompt = knownCompetitors?.length
    ? `The user has mentioned these known competitors: ${knownCompetitors.join(', ')}. Include these and identify additional competitors.`
    : 'Identify the main competitors in this space.'

  const prompt = `You are a competitive intelligence analyst specializing in startup market analysis. Analyze the competitive landscape for this business hypothesis:

"${hypothesis}"

${competitorListPrompt}

Provide a comprehensive competitive analysis in the following JSON format. Be specific and detailed. For pricing, use real-world estimates based on similar products if exact data isn't available.

IMPORTANT: For each competitor, assess:
- threatLevel: How threatening are they to a new entrant? (low/medium/high)
- userSatisfaction: Estimated user satisfaction 1-5 based on market perception, reviews, complaints
- fundingLevel: bootstrapped/seed/series-a/series-b-plus/public/unknown
- marketShareEstimate: dominant/significant/moderate/small/emerging

For gaps, include:
- opportunityScore: 1-10 rating of how attractive this opportunity is
- validationSignals: Evidence supporting this gap exists (user complaints, missing features, etc.)

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
      "validationSignals": ["User complaint about X", "No competitor offers Y"]
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
    console.error('Failed to parse Claude response:', content.text)
    throw new Error('Failed to parse competitive analysis')
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
  }))

  // Calculate competition score
  const competitionScore = calculateCompetitionScore(
    competitors,
    gaps,
    analysis.marketOverview
  )

  const processingTimeMs = Date.now() - startTime

  return {
    hypothesis,
    marketOverview: analysis.marketOverview,
    competitors,
    competitorMatrix: analysis.competitorMatrix || { categories: [], comparison: [] },
    gaps,
    positioningRecommendations: analysis.positioningRecommendations || [],
    competitionScore,
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

    console.log('Starting competitor analysis for:', hypothesis)
    if (knownCompetitors?.length) {
      console.log('Known competitors:', knownCompetitors)
    }

    // Run the competitor analysis
    const result = await analyzeCompetitors(hypothesis, knownCompetitors)

    console.log(`Found ${result.competitors.length} competitors`)
    console.log(`Identified ${result.gaps.length} market gaps`)
    console.log(`Competition score: ${result.competitionScore.score}/10`)

    // If jobId is provided, save results to database
    if (jobId) {
      try {
        await supabase
          .from('research_results')
          .insert({
            job_id: jobId,
            module_name: 'competitor_intel',
            data: result,
          })
        console.log('Saved competitor intelligence results to database')
      } catch (dbError) {
        console.error('Failed to save results to database:', dbError)
        // Continue - we still want to return the results
      }
    }

    console.log(`Competitor analysis completed in ${result.metadata.processingTimeMs}ms`)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Competitor intelligence research failed:', error)
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
