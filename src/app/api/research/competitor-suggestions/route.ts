import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { anthropic } from '@/lib/anthropic'
import { CompetitorInsight } from '@/lib/analysis/theme-extractor'

export interface CompetitorSuggestion {
  name: string
  type: 'direct_competitor' | 'adjacent_solution' | 'workaround'
  confidence: 'high' | 'medium' | 'low'
  sentiment: 'positive' | 'negative' | 'mixed' | 'neutral'
  context: string
  isActualProduct: boolean
  whySuggested: string
}

export interface CompetitorSuggestionsResult {
  suggestions: CompetitorSuggestion[]
  rawMentions: string[]
  metadata: {
    hypothesis: string
    basedOnSignals: number
    processingTimeMs: number
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  const searchParams = request.nextUrl.searchParams
  const jobId = searchParams.get('jobId')

  if (!jobId) {
    return NextResponse.json(
      { error: 'jobId parameter is required' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  // Get auth user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch the job and verify ownership
  const { data: job, error: jobError } = await supabase
    .from('research_jobs')
    .select('*')
    .eq('id', jobId)
    .single()

  if (jobError || !job || job.user_id !== user.id) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  // Fetch pain analysis results
  // Try 'pain_analysis' first (new step-based flow), then fall back to 'community_voice' (old flow)
  let { data: painAnalysisResult, error: resultsError } = await supabase
    .from('research_results')
    .select('*')
    .eq('job_id', jobId)
    .eq('module_name', 'pain_analysis')
    .single()

  // If not found, try 'community_voice' (main production flow)
  if (resultsError || !painAnalysisResult) {
    const { data: communityVoiceResult, error: cvError } = await supabase
      .from('research_results')
      .select('*')
      .eq('job_id', jobId)
      .eq('module_name', 'community_voice')
      .single()

    if (!cvError && communityVoiceResult) {
      painAnalysisResult = communityVoiceResult
      resultsError = null
    }
  }

  if (resultsError || !painAnalysisResult) {
    return NextResponse.json(
      { error: 'No pain analysis results found. Complete Community Voice analysis first.' },
      { status: 404 }
    )
  }

  const painData = painAnalysisResult.data as {
    themeAnalysis?: {
      alternativesMentioned?: string[]
      competitorInsights?: CompetitorInsight[]
      themes?: Array<{
        name: string
        description: string
        sampleQuotes: string[]
      }>
    }
    painSignals?: Array<{
      text: string
      title?: string
      signals: string[]
    }>
    redditData?: {
      posts: Array<{
        title: string
        text: string
        subreddit: string
      }>
    }
    hypothesis?: string
    painScore?: {
      score: number
      signals: string[]
    }
  }

  // If we already have enhanced competitor insights, return them
  if (painData.themeAnalysis?.competitorInsights?.length) {
    const insights = painData.themeAnalysis.competitorInsights
    return NextResponse.json({
      suggestions: insights
        .filter(i => i.isActualProduct)
        .map(i => ({
          name: i.name,
          type: i.type,
          confidence: i.confidence,
          sentiment: i.sentiment,
          context: i.context,
          isActualProduct: i.isActualProduct,
          whySuggested: `Mentioned ${i.mentionCount} times in community discussions`,
        })),
      rawMentions: painData.themeAnalysis.alternativesMentioned || [],
      metadata: {
        hypothesis: job.hypothesis,
        basedOnSignals: painData.painSignals?.length || 0,
        processingTimeMs: Date.now() - startTime,
      },
    })
  }

  // Otherwise, run Claude analysis on the raw mentions and pain signals
  const rawMentions = painData.themeAnalysis?.alternativesMentioned || []
  const painSignals = painData.painSignals || []
  const redditPosts = painData.redditData?.posts || []
  const themes = painData.themeAnalysis?.themes || []

  if (rawMentions.length === 0 && painSignals.length === 0 && redditPosts.length === 0) {
    return NextResponse.json({
      suggestions: [],
      rawMentions: [],
      metadata: {
        hypothesis: job.hypothesis,
        basedOnSignals: 0,
        processingTimeMs: Date.now() - startTime,
      },
    })
  }

  // Extract text samples from pain signals and Reddit posts for richer context
  const painTexts = painSignals
    .slice(0, 15)
    .map(s => `${s.title || ''} ${s.text}`.slice(0, 300))
    .join('\n---\n')

  const redditTexts = redditPosts
    .slice(0, 10)
    .map(p => `[r/${p.subreddit}] ${p.title}: ${p.text?.slice(0, 200) || ''}`)
    .join('\n---\n')

  const themeContext = themes.length > 0
    ? `\nKey themes identified:\n${themes.map(t => `- ${t.name}: ${t.description}`).join('\n')}`
    : ''

  const relevantTexts = painTexts + (redditTexts ? '\n---\n' + redditTexts : '')

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      system: `You are a competitive intelligence analyst. Your task is to identify products/services that DIRECTLY compete with the hypothesis being tested.

CRITICAL: Only suggest competitors that address the SPECIFIC PROBLEM in the hypothesis.
- If the hypothesis is about "remote workers feeling isolated", competitors must be solutions for isolation/loneliness (like virtual coffee tools, team bonding apps, etc.)
- Do NOT suggest unrelated products that the audience might use (like job management tools, banking apps, productivity software)

Be VERY strict about relevance. If a product doesn't directly solve the problem stated in the hypothesis, exclude it.`,
      messages: [
        {
          role: 'user',
          content: `Hypothesis: "${job.hypothesis}"
${themeContext}
Raw mentions from community discussions: ${JSON.stringify(rawMentions)}

Sample discussion texts:
${relevantTexts}

Based on the hypothesis, identify products/services that DIRECTLY address the problem. Return JSON:
{
  "suggestions": [
    {
      "name": "Product/Company Name",
      "type": "direct_competitor" | "adjacent_solution" | "workaround",
      "confidence": "high" | "medium" | "low",
      "sentiment": "positive" | "negative" | "mixed" | "neutral",
      "context": "Brief explanation of what this is and why users mention it",
      "isActualProduct": true/false,
      "whySuggested": "How this product addresses the PROBLEM in the hypothesis"
    }
  ]
}

STRICT RULES:
- ONLY include products that directly address the problem in the hypothesis
- Exclude products that are just "used by" the target audience but don't solve the stated problem
- For "isolation" problems: include social/community/connection tools, exclude productivity/job/finance tools
- Return 0 suggestions if none of the mentions are actually relevant
- Return 5-10 suggestions maximum if relevant ones exist
- Be conservative - when in doubt, exclude`,
        },
      ],
    })

    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from response')
    }

    const parsed = JSON.parse(jsonMatch[0]) as { suggestions: CompetitorSuggestion[] }

    return NextResponse.json({
      suggestions: parsed.suggestions || [],
      rawMentions,
      metadata: {
        hypothesis: job.hypothesis,
        basedOnSignals: painSignals.length,
        processingTimeMs: Date.now() - startTime,
      },
    } satisfies CompetitorSuggestionsResult)
  } catch (error) {
    console.error('Competitor suggestion analysis failed:', error)

    // Return raw mentions as fallback
    return NextResponse.json({
      suggestions: rawMentions.slice(0, 10).map(name => ({
        name,
        type: 'direct_competitor' as const,
        confidence: 'low' as const,
        sentiment: 'neutral' as const,
        context: 'Mentioned in community discussions',
        isActualProduct: false,
        whySuggested: 'Mentioned by users discussing this problem',
      })),
      rawMentions,
      metadata: {
        hypothesis: job.hypothesis,
        basedOnSignals: painSignals.length,
        processingTimeMs: Date.now() - startTime,
      },
    } satisfies CompetitorSuggestionsResult)
  }
}
