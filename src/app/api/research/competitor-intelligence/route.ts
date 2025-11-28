import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

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
}

export interface CompetitorGap {
  gap: string
  description: string
  opportunity: string
  difficulty: 'low' | 'medium' | 'high'
}

export interface PositioningRecommendation {
  strategy: string
  description: string
  targetNiche: string
  keyDifferentiators: string[]
  messagingAngles: string[]
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
  metadata: {
    competitorsAnalyzed: number
    processingTimeMs: number
    timestamp: string
  }
}

async function analyzeCompetitors(
  hypothesis: string,
  knownCompetitors?: string[]
): Promise<CompetitorIntelligenceResult> {
  const startTime = Date.now()

  const competitorListPrompt = knownCompetitors?.length
    ? `The user has mentioned these known competitors: ${knownCompetitors.join(', ')}. Include these and identify additional competitors.`
    : 'Identify the main competitors in this space.'

  const prompt = `You are a competitive intelligence analyst. Analyze the competitive landscape for this business hypothesis:

"${hypothesis}"

${competitorListPrompt}

Provide a comprehensive competitive analysis in the following JSON format. Be specific and detailed. For pricing, use real-world estimates based on similar products if exact data isn't available.

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
      "differentiators": ["what makes them unique"]
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
      "difficulty": "low|medium|high"
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

  const processingTimeMs = Date.now() - startTime

  return {
    hypothesis,
    marketOverview: analysis.marketOverview,
    competitors: analysis.competitors || [],
    competitorMatrix: analysis.competitorMatrix || { categories: [], comparison: [] },
    gaps: analysis.gaps || [],
    positioningRecommendations: analysis.positioningRecommendations || [],
    metadata: {
      competitorsAnalyzed: (analysis.competitors || []).length,
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

    // If jobId is provided, save results to database
    if (jobId) {
      try {
        await supabase
          .from('research_results')
          .insert({
            job_id: jobId,
            module_name: 'competitor_intelligence',
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
      .eq('module_name', 'competitor_intelligence')
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
