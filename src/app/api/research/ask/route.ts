import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { CommunityVoiceResult } from '../community-voice/route'
import { CompetitorIntelligenceResult } from '../competitor-intelligence/route'
import { checkChatLimit, recordApiCost } from '@/lib/api-costs'

const anthropic = new Anthropic()

const CHAT_MODEL = 'claude-sonnet-4-20250514'

export interface AskResearchRequest {
  jobId: string
  question: string
}

export interface ChatStatus {
  chatNumber: number
  remainingFree: number
  isFree: boolean
}

export interface AskResearchResponse {
  answer: string
  sources?: {
    type: 'quote' | 'theme' | 'competitor' | 'statistic'
    text: string
    attribution?: string
  }[]
  chatStatus?: ChatStatus
}

// Build context from community voice results
function buildCommunityVoiceContext(data: CommunityVoiceResult): string {
  const parts: string[] = []

  parts.push(`## Hypothesis: ${data.hypothesis}`)
  parts.push('')

  // Pain summary
  parts.push('## Pain Signal Summary')
  parts.push(`- Total signals found: ${data.painSummary.totalSignals}`)
  parts.push(`- Average pain score: ${data.painSummary.averageScore.toFixed(1)}/10`)
  parts.push(`- High intensity signals: ${data.painSummary.highIntensityCount}`)
  parts.push(`- Medium intensity signals: ${data.painSummary.mediumIntensityCount}`)
  parts.push(`- Low intensity signals: ${data.painSummary.lowIntensityCount}`)
  parts.push(`- Solution-seeking signals: ${data.painSummary.solutionSeekingCount}`)
  parts.push(`- Willingness to pay signals: ${data.painSummary.willingnessToPayCount}`)
  parts.push('')

  // Subreddits
  parts.push('## Subreddits Analyzed')
  parts.push(`Analyzed: ${data.subreddits.analyzed.join(', ')}`)
  if (data.painSummary.topSubreddits?.length) {
    parts.push(`Top by signal count: ${data.painSummary.topSubreddits.map(s => `${s.name} (${s.count})`).join(', ')}`)
  }
  parts.push('')

  // Themes
  if (data.themeAnalysis?.themes?.length) {
    parts.push('## Key Themes')
    data.themeAnalysis.themes.forEach((theme, i) => {
      parts.push(`${i + 1}. **${theme.name}** (${theme.frequency} mentions, intensity: ${theme.intensity})`)
      parts.push(`   ${theme.description}`)
      if (theme.examples?.length) {
        parts.push(`   Examples:`)
        theme.examples.slice(0, 3).forEach(ex => {
          parts.push(`   - "${ex}"`)
        })
      }
      parts.push('')
    })

    // Add key quotes from theme analysis
    if (data.themeAnalysis.keyQuotes?.length) {
      parts.push('## Key Quotes')
      data.themeAnalysis.keyQuotes.slice(0, 10).forEach(q => {
        parts.push(`- "${q.quote}" — ${q.source} (pain score: ${q.painScore}/10)`)
      })
      parts.push('')
    }
  }

  // WTP Quotes
  if (data.painSummary.wtpQuotes?.length) {
    parts.push('## Willingness to Pay Quotes')
    data.painSummary.wtpQuotes.forEach(q => {
      // Truncate for prompt to control costs
      const truncatedText = q.text.length > 250
        ? q.text.slice(0, 250) + '...'
        : q.text
      parts.push(`- "${truncatedText}" — r/${q.subreddit}`)
    })
    parts.push('')
  }

  // Strongest signals
  if (data.painSummary.strongestSignals?.length) {
    parts.push('## Strongest Pain Signals')
    data.painSummary.strongestSignals.forEach(s => {
      parts.push(`- ${s}`)
    })
    parts.push('')
  }

  // All pain signals (abbreviated for context)
  if (data.painSignals?.length) {
    parts.push('## Individual Pain Signals')
    data.painSignals.slice(0, 30).forEach((signal, i) => {
      const text = signal.text?.length > 200
        ? signal.text.substring(0, 200) + '...'
        : signal.text
      const subreddit = signal.source?.subreddit || 'unknown'
      parts.push(`${i + 1}. [${signal.intensity}] "${text}" — r/${subreddit} (score: ${signal.score})`)
    })
    if (data.painSignals.length > 30) {
      parts.push(`... and ${data.painSignals.length - 30} more signals`)
    }
    parts.push('')
  }

  // Market sizing
  if (data.marketSizing) {
    parts.push('## Market Sizing')
    parts.push(`- TAM: ${data.marketSizing.tam.value.toLocaleString()} users — ${data.marketSizing.tam.description}`)
    parts.push(`- SAM: ${data.marketSizing.sam.value.toLocaleString()} users — ${data.marketSizing.sam.description}`)
    parts.push(`- SOM: ${data.marketSizing.som.value.toLocaleString()} users — ${data.marketSizing.som.description}`)
    parts.push(`- Market Score: ${data.marketSizing.score}/10`)
    parts.push(`- Penetration required: ${data.marketSizing.mscAnalysis.penetrationRequired.toFixed(1)}%`)
    parts.push('')
  }

  // Timing
  if (data.timing) {
    parts.push('## Market Timing')
    parts.push(`- Timing Score: ${data.timing.score}/10`)
    parts.push(`- Trend: ${data.timing.trend}`)
    parts.push(`- Window: ${data.timing.timingWindow}`)
    if (data.timing.tailwinds?.length) {
      parts.push('Tailwinds:')
      data.timing.tailwinds.forEach(t => {
        parts.push(`  - ${t.signal} (${t.impact} impact): ${t.description}`)
      })
    }
    if (data.timing.headwinds?.length) {
      parts.push('Headwinds:')
      data.timing.headwinds.forEach(h => {
        parts.push(`  - ${h.signal} (${h.impact} impact): ${h.description}`)
      })
    }
    parts.push('')
  }

  return parts.join('\n')
}

// Build context from competitor results
function buildCompetitorContext(data: CompetitorIntelligenceResult): string {
  const parts: string[] = []

  parts.push('## Competitor Analysis')
  parts.push(`- Competitors analyzed: ${data.metadata.competitorsAnalyzed}`)
  parts.push(`- Competition Score: ${data.competitionScore.score}/10 (${data.competitionScore.confidence} confidence)`)
  parts.push('')

  if (data.marketOverview) {
    parts.push('### Market Overview')
    parts.push(`- Market Size: ${data.marketOverview.marketSize}`)
    parts.push(`- Growth Trend: ${data.marketOverview.growthTrend}`)
    parts.push(`- Maturity: ${data.marketOverview.maturityLevel}`)
    parts.push(`- Competition Intensity: ${data.marketOverview.competitionIntensity}`)
    parts.push(`- Summary: ${data.marketOverview.summary}`)
    parts.push('')
  }

  if (data.competitors?.length) {
    parts.push('### Competitors')
    data.competitors.forEach((comp, i) => {
      parts.push(`${i + 1}. **${comp.name}**`)
      if (comp.positioning) parts.push(`   Positioning: ${comp.positioning}`)
      if (comp.pricingModel) parts.push(`   Pricing: ${comp.pricingModel} (${comp.pricingRange || 'unknown range'})`)
      if (comp.strengths?.length) parts.push(`   Strengths: ${comp.strengths.join(', ')}`)
      if (comp.weaknesses?.length) parts.push(`   Weaknesses: ${comp.weaknesses.join(', ')}`)
      parts.push('')
    })
  }

  // Market gaps as opportunities
  if (data.gaps?.length) {
    parts.push('### Market Gaps / Opportunities')
    data.gaps.forEach((gap, i) => {
      parts.push(`${i + 1}. ${gap.gap}`)
      if (gap.opportunity) parts.push(`   Opportunity: ${gap.opportunity}`)
    })
    parts.push('')
  }

  if (data.competitionScore.threats?.length) {
    parts.push('### Competitive Threats')
    data.competitionScore.threats.forEach(t => parts.push(`- ${t}`))
    parts.push('')
  }

  // Positioning recommendations
  if (data.positioningRecommendations?.length) {
    parts.push('### Positioning Recommendations')
    data.positioningRecommendations.forEach((rec, i) => {
      parts.push(`${i + 1}. **${rec.strategy}**: ${rec.description}`)
      parts.push(`   Target: ${rec.targetNiche}`)
      if (rec.keyDifferentiators?.length) {
        parts.push(`   Differentiators: ${rec.keyDifferentiators.join(', ')}`)
      }
    })
    parts.push('')
  }

  return parts.join('\n')
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: AskResearchRequest = await request.json()
    const { jobId, question } = body

    if (!jobId || !question) {
      return NextResponse.json(
        { error: 'Missing jobId or question' },
        { status: 400 }
      )
    }

    // Verify user owns this job
    const { data: job, error: jobError } = await supabase
      .from('research_jobs')
      .select('id, user_id, hypothesis')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (job.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Check and increment chat count
    const chatStatus = await checkChatLimit(jobId)

    // For now, we allow chats beyond the limit but track them differently
    // Future: Could require credits for paid_chat
    if (chatStatus.requiresCredits) {
      // TODO: Implement credit check for paid chats
      // For now, still allow but flag for tracking
      console.log(`User ${user.id} using paid chat #${chatStatus.chatNumber} on job ${jobId}`)
    }

    // Fetch all research results
    const { data: results, error: resultsError } = await supabase
      .from('research_results')
      .select('module_name, data')
      .eq('job_id', jobId)

    if (resultsError) {
      console.error('Error fetching results:', resultsError)
      return NextResponse.json(
        { error: 'Failed to fetch research data' },
        { status: 500 }
      )
    }

    if (!results || results.length === 0) {
      return NextResponse.json(
        { error: 'No research data found for this job' },
        { status: 404 }
      )
    }

    // Build context from available results
    const contextParts: string[] = []

    const communityVoice = results.find(
      r => r.module_name === 'community_voice' || r.module_name === 'pain_analysis'
    )
    if (communityVoice?.data) {
      contextParts.push(buildCommunityVoiceContext(communityVoice.data as unknown as CommunityVoiceResult))
    }

    const competitors = results.find(
      r => r.module_name === 'competitor_intel' || r.module_name === 'competitor_intelligence'
    )
    if (competitors?.data) {
      contextParts.push(buildCompetitorContext(competitors.data as unknown as CompetitorIntelligenceResult))
    }

    const fullContext = contextParts.join('\n---\n')

    // Query Claude with the research context
    const response = await anthropic.messages.create({
      model: CHAT_MODEL,
      max_tokens: 1024,
      system: `You are a research analyst assistant helping entrepreneurs understand their market validation research results.

You have access to detailed research data about a business hypothesis including:
- Pain signals from community discussions
- Theme analysis
- Market sizing estimates
- Competitor analysis
- Timing analysis

Answer the user's question based ONLY on the provided research data. Be specific and cite sources when possible (quote text, mention subreddits, reference specific competitors).

If the data doesn't contain information to answer the question, say so clearly rather than making things up.

Keep answers concise but informative. Use bullet points when listing multiple items.`,
      messages: [
        {
          role: 'user',
          content: `Here is the research data:\n\n${fullContext}\n\n---\n\nUser question: ${question}`
        }
      ]
    })

    // Extract text from response
    const textContent = response.content.find(c => c.type === 'text')
    const answer = textContent?.text || 'Unable to generate response'

    // Record API cost
    await recordApiCost({
      userId: user.id,
      jobId,
      actionType: chatStatus.isFree ? 'free_chat' : 'paid_chat',
      model: CHAT_MODEL,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      endpoint: '/api/research/ask',
      metadata: { chatNumber: chatStatus.chatNumber, question: question.substring(0, 100) },
    })

    return NextResponse.json({
      answer,
      sources: [], // TODO: Could parse response for quotes/references
      chatStatus: {
        chatNumber: chatStatus.chatNumber,
        remainingFree: Math.max(0, 2 - chatStatus.chatNumber),
        isFree: chatStatus.isFree,
      },
    } as AskResearchResponse)

  } catch (error) {
    console.error('Ask research error:', error)
    return NextResponse.json(
      { error: 'Failed to process question' },
      { status: 500 }
    )
  }
}
