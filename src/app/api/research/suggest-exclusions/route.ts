import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'

export interface ExclusionSuggestion {
  term: string
  reason: string
}

export interface SuggestExclusionsResult {
  suggestions: ExclusionSuggestion[]
  ambiguousTerms: string[]
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { audience, problem, problemLanguage } = body as {
      audience: string
      problem: string
      problemLanguage?: string
    }

    // Validate required fields
    if (!audience || audience.trim().length < 3) {
      return NextResponse.json(
        { error: 'Audience must be at least 3 characters' },
        { status: 400 }
      )
    }

    if (!problem || problem.trim().length < 10) {
      return NextResponse.json(
        { error: 'Problem must be at least 10 characters' },
        { status: 400 }
      )
    }

    // Combine all text for analysis
    const combinedText = [
      audience.trim(),
      problem.trim(),
      problemLanguage?.trim(),
    ].filter(Boolean).join(' | ')

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 512,
      system: `You analyze search queries to identify ambiguous terms that could return irrelevant results on Reddit.

Your task: Identify words/phrases in the user's hypothesis that have multiple meanings, where some meanings are clearly NOT what they're looking for.

Examples:
- "training" → ambiguous (fitness training, corporate training, dog training, ML training)
- "expat" + "lonely" → "dating" should be excluded if they want friend-making, not romance
- "freelancer" + "invoicing" → "medical billing" should be excluded
- "visa" + "issues" → exclude "credit card" (Visa the card brand)

Be conservative - only suggest exclusions that would genuinely pollute results.
Output 3-6 suggestions maximum. If the query is unambiguous, return empty suggestions array.`,
      messages: [
        {
          role: 'user',
          content: `Analyze this hypothesis for ambiguous terms that could return irrelevant Reddit results:

Audience: ${audience}
Problem: ${problem}
${problemLanguage ? `How they describe it: ${problemLanguage}` : ''}

Return JSON:
{
  "ambiguousTerms": ["list", "of", "ambiguous", "terms", "found"],
  "suggestions": [
    {
      "term": "topic to exclude",
      "reason": "why this would pollute results"
    }
  ]
}

Only suggest exclusions for genuinely ambiguous terms. If nothing is ambiguous, return empty arrays.`,
        },
      ],
    })

    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json({
        suggestions: [],
        ambiguousTerms: [],
      })
    }

    // Parse JSON from response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({
        suggestions: [],
        ambiguousTerms: [],
      })
    }

    const parsed = JSON.parse(jsonMatch[0]) as SuggestExclusionsResult

    return NextResponse.json({
      suggestions: parsed.suggestions || [],
      ambiguousTerms: parsed.ambiguousTerms || [],
    })
  } catch (error) {
    console.error('Exclusion suggestion failed:', error)
    return NextResponse.json(
      { error: 'Failed to generate exclusion suggestions' },
      { status: 500 }
    )
  }
}
