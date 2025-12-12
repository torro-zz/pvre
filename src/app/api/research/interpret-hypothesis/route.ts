import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export interface HypothesisInterpretation {
  audience: string
  problem: string
  searchPhrases: string[]
  confidence: 'low' | 'medium' | 'high'
  ambiguities: string[]
  isTransitionHypothesis: boolean
}

export interface RefinementSuggestion {
  type: 'audience' | 'problem' | 'angle'
  suggestion: string
  rationale: string
}

export interface InterpretHypothesisResponse {
  interpretation: HypothesisInterpretation
  refinementSuggestions: RefinementSuggestion[]
  formattedHypothesis: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { rawInput } = body

    if (!rawInput || typeof rawInput !== 'string') {
      return NextResponse.json({ error: 'rawInput is required' }, { status: 400 })
    }

    const trimmedInput = rawInput.trim()
    if (trimmedInput.length < 10) {
      return NextResponse.json({ error: 'Input too short. Please describe your idea in more detail.' }, { status: 400 })
    }

    // Use Claude to interpret the hypothesis
    const prompt = `You are an expert at understanding business hypotheses and market research queries.

The user has entered this free-form text describing a business idea or problem they want to validate:

"${trimmedInput}"

Your task is to interpret this and extract:
1. **Audience**: Who is experiencing this problem? Be specific about demographics, roles, or situations.
2. **Problem**: What is the core pain point or struggle? Focus on the frustration, not the solution.
3. **Search Phrases**: 3-5 phrases these people would actually type into Reddit when seeking help or venting. Use casual, natural language - how real people talk, not marketing speak.
4. **Confidence**: How confident are you in this interpretation? (low/medium/high)
5. **Ambiguities**: Any unclear aspects that could lead to irrelevant results.
6. **Is Transition Hypothesis**: Is this about people transitioning FROM one state TO another (e.g., employees wanting to become freelancers)?

Also provide 2-3 refinement suggestions if the input is vague or could be more specific.

Respond in this exact JSON format:
{
  "interpretation": {
    "audience": "string - specific description of who",
    "problem": "string - the core pain point",
    "searchPhrases": ["phrase 1", "phrase 2", "phrase 3"],
    "confidence": "low" | "medium" | "high",
    "ambiguities": ["unclear aspect 1", "unclear aspect 2"],
    "isTransitionHypothesis": true | false
  },
  "refinementSuggestions": [
    {
      "type": "audience" | "problem" | "angle",
      "suggestion": "more specific version",
      "rationale": "why this is better"
    }
  ],
  "formattedHypothesis": "A clean, formatted version combining audience and problem"
}

Important guidelines:
- Search phrases should be what people actually TYPE, not formal descriptions
- Include emotional language people use when frustrated ("hate", "struggle", "can't figure out", "driving me crazy")
- If the input mentions a solution, focus on the underlying problem, not the solution itself
- For transition hypotheses, emphasize the "stuck" feeling and desire for change
- Keep audience specific but not overly narrow
- Mark confidence as "low" if very vague, "high" if very clear and specific`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        { role: 'user', content: prompt }
      ],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude')
    }

    // Parse the JSON response
    let parsed: InterpretHypothesisResponse
    try {
      // Extract JSON from the response (handle potential markdown code blocks)
      let jsonStr = content.text
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        jsonStr = jsonMatch[1]
      }
      parsed = JSON.parse(jsonStr.trim())
    } catch {
      console.error('Failed to parse Claude response:', content.text)
      throw new Error('Failed to parse interpretation')
    }

    // Validate the response structure
    if (!parsed.interpretation || !parsed.interpretation.audience || !parsed.interpretation.problem) {
      throw new Error('Invalid interpretation structure')
    }

    // Ensure arrays exist
    parsed.interpretation.searchPhrases = parsed.interpretation.searchPhrases || []
    parsed.interpretation.ambiguities = parsed.interpretation.ambiguities || []
    parsed.refinementSuggestions = parsed.refinementSuggestions || []

    return NextResponse.json(parsed)

  } catch (error) {
    console.error('Interpret hypothesis error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to interpret hypothesis' },
      { status: 500 }
    )
  }
}
