import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'
import { createClient } from '@/lib/supabase/server'
import { recordApiCost } from '@/lib/api-costs'

const PRESEARCH_MODEL = 'claude-3-haiku-20240307'

export interface GenerateProblemLanguageResult {
  phrases: string[]
  combined: string
}

export async function POST(request: NextRequest) {
  try {
    // Optional auth - track if logged in, allow if not
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const body = await request.json()
    const { audience, problem } = body as {
      audience: string
      problem: string
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

    const response = await anthropic.messages.create({
      model: PRESEARCH_MODEL,
      max_tokens: 256,
      system: `You generate authentic Reddit search phrases based on a target audience and their problem.

Your task: Write 3-5 short phrases that this specific audience would ACTUALLY type when venting about this problem on Reddit.

CRITICAL RULES:
- Use casual, first-person language ("I can't", "so frustrated", "hate when")
- Match the emotional tone someone would use when venting
- Be specific to the audience - a solo athlete talks differently than a busy parent
- Each phrase should be 3-8 words
- No formal business language
- No solution-seeking language - focus on expressing the PROBLEM

Examples:
- Audience: "Solo athletes preparing for Hyrox" + Problem: "training alone kills motivation"
  → "no one to train with", "hate training alone", "can't push myself"

- Audience: "Busy parents" + Problem: "kids reject everything I cook"
  → "picky eater driving me crazy", "dinner is a nightmare", "kids won't eat anything"

- Audience: "Remote designers" + Problem: "feel disconnected from team"
  → "feel so isolated", "miss the office energy", "async is killing creativity"`,
      messages: [
        {
          role: 'user',
          content: `Generate Reddit search phrases for:

Audience: ${audience.trim()}
Problem: ${problem.trim()}

Return JSON only:
{
  "phrases": ["phrase 1", "phrase 2", "phrase 3"]
}`,
        },
      ],
    })

    // Record API cost if user is logged in
    if (user) {
      await recordApiCost({
        userId: user.id,
        actionType: 'free_presearch',
        model: PRESEARCH_MODEL,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        endpoint: '/api/research/generate-problem-language',
      })
    }

    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json({
        phrases: [],
        combined: '',
      })
    }

    // Parse JSON from response
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({
        phrases: [],
        combined: '',
      })
    }

    const parsed = JSON.parse(jsonMatch[0]) as { phrases: string[] }
    const phrases = parsed.phrases || []

    // Combine phrases into comma-separated string for the form field
    const combined = phrases.join(', ')

    return NextResponse.json({
      phrases,
      combined,
    })
  } catch (error) {
    console.error('Problem language generation failed:', error)
    return NextResponse.json(
      { error: 'Failed to generate problem language' },
      { status: 500 }
    )
  }
}
