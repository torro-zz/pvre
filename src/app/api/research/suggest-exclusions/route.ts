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

    // Extract user's core terms to protect from exclusion
    const userTerms = new Set(
      [audience, problem, problemLanguage || '']
        .join(' ')
        .toLowerCase()
        .split(/[\s,]+/)
        .map(w => w.trim())
        .filter(w => w.length > 3) // Only meaningful words
    )

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 512,
      system: `You analyze search queries to identify WRONG CONTEXTS that could pollute Reddit search results.

CRITICAL RULE: NEVER suggest excluding terms the user explicitly typed in their problem description.
If they typed "skin" or "skin elasticity" - those are the CORE TERMS they want to find.

Your task: Find OTHER topics/contexts that share words with the hypothesis but are about DIFFERENT problems.

GOOD exclusions (different contexts that share words):
- For "visa issues" → exclude "Visa credit card" (different meaning of "visa")
- For "training struggles" → exclude "dog training", "ML training" (different types of training)
- For "skin aging" → exclude "fortnite skin", "skin in the game" (different meanings of "skin")
- For "skin aging" → exclude "skin cancer", "dermatologist" (medical, not cosmetic)

BAD exclusions (NEVER suggest these):
- Any word the user typed in "What's their problem?"
- Any word the user typed in "How do THEY describe it?"
- Core domain terms (for skincare: skin, wrinkles, aging, moisturizer, etc.)
- The actual problem they want to research

The test: Would excluding this remove IRRELEVANT posts or RELEVANT posts?
If it removes relevant posts → DON'T suggest it.

Be very conservative. Output 2-4 suggestions maximum. If the query is clear, return empty arrays.`,
      messages: [
        {
          role: 'user',
          content: `Analyze this hypothesis for WRONG CONTEXTS that could pollute results:

Audience: ${audience}
Problem: ${problem}
${problemLanguage ? `How they describe it: ${problemLanguage}` : ''}

REMEMBER: The terms above are what they WANT to find. Don't suggest excluding them.
Only suggest OTHER contexts that would bring irrelevant posts.

Return JSON:
{
  "ambiguousTerms": ["terms", "that", "have", "multiple", "meanings"],
  "suggestions": [
    {
      "term": "wrong context to exclude",
      "reason": "why this context is different from their problem"
    }
  ]
}

If the hypothesis is clear and unambiguous, return empty arrays. Be conservative.`,
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

    // SAFETY FILTER: Never suggest excluding terms the user explicitly typed
    // This catches any suggestions that slip through despite the prompt instructions
    const safeSuggestions = (parsed.suggestions || []).filter(suggestion => {
      const suggestionWords = suggestion.term.toLowerCase().split(/[\s,]+/)
      // Reject if ANY word in the suggestion matches a user's core term
      const containsUserTerm = suggestionWords.some(word =>
        word.length > 3 && userTerms.has(word)
      )
      if (containsUserTerm) {
        console.log(`[ExclusionSuggester] Filtered out "${suggestion.term}" - contains user's core term`)
      }
      return !containsUserTerm
    })

    // Also filter ambiguous terms that are actually the user's core terms
    const safeAmbiguousTerms = (parsed.ambiguousTerms || []).filter(term => {
      const termWords = term.toLowerCase().split(/[\s,]+/)
      return !termWords.some(word => word.length > 3 && userTerms.has(word))
    })

    return NextResponse.json({
      suggestions: safeSuggestions,
      ambiguousTerms: safeAmbiguousTerms,
    })
  } catch (error) {
    console.error('Exclusion suggestion failed:', error)
    return NextResponse.json(
      { error: 'Failed to generate exclusion suggestions' },
      { status: 500 }
    )
  }
}
