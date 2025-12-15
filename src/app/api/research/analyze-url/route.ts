import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { HypothesisInterpretation, RefinementSuggestion, InterpretHypothesisResponse } from '../interpret-hypothesis/route'

const anthropic = new Anthropic()

export type UrlType = 'reddit' | 'twitter' | 'producthunt' | 'hackernews' | 'indiehackers' | 'linkedin' | 'website'

interface AnalyzeUrlRequest {
  url: string
  urlType: UrlType
}

// Simple HTML to text extraction
function extractTextFromHtml(html: string): string {
  // Remove script and style tags with their content
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')

  // Remove HTML tags but keep the content
  text = text.replace(/<[^>]+>/g, ' ')

  // Decode HTML entities
  text = text.replace(/&nbsp;/gi, ' ')
  text = text.replace(/&amp;/gi, '&')
  text = text.replace(/&lt;/gi, '<')
  text = text.replace(/&gt;/gi, '>')
  text = text.replace(/&quot;/gi, '"')
  text = text.replace(/&#39;/gi, "'")

  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim()

  // Limit text length for Claude (to avoid token limits)
  const maxLength = 15000
  if (text.length > maxLength) {
    text = text.substring(0, maxLength) + '...'
  }

  return text
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as AnalyzeUrlRequest
    const { url, urlType } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'url is required' }, { status: 400 })
    }

    // Validate URL
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url.trim())
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol')
      }
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }

    // Fetch the URL content
    let pageContent: string
    try {
      const response = await fetch(parsedUrl.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`)
      }

      const html = await response.text()
      pageContent = extractTextFromHtml(html)

      if (pageContent.length < 100) {
        return NextResponse.json({
          error: 'Could not extract enough content from this page. Try a different URL.'
        }, { status: 400 })
      }
    } catch (err) {
      console.error('Fetch error:', err)
      return NextResponse.json({
        error: 'Could not fetch the URL. The page may be blocked or unavailable.'
      }, { status: 400 })
    }

    // Use Claude to analyze the page content
    const sourceLabel = getSourceLabel(urlType)
    const prompt = `You are an expert at understanding products, pain points, and market research.

I've fetched content from a ${sourceLabel} page. Analyze this content to understand what problem/pain point this product or discussion addresses.

URL: ${url}

Page content (extracted text):
"""
${pageContent}
"""

Your task is to interpret this page and extract:
1. **Audience**: Who would be experiencing the problem this product/discussion addresses? Be specific.
2. **Problem**: What is the core pain point this product solves or people are discussing? Focus on the frustration.
3. **Search Phrases**: 3-5 phrases these people would actually type into Reddit when seeking help or venting about this problem. Use casual, natural language.
4. **Confidence**: How confident are you in this interpretation? (low/medium/high)
5. **Ambiguities**: Any unclear aspects or limitations of this analysis.

Also provide 2-3 refinement suggestions for narrowing down the research.

Respond in this exact JSON format:
{
  "interpretation": {
    "audience": "string - specific description of who",
    "problem": "string - the core pain point",
    "searchPhrases": ["phrase 1", "phrase 2", "phrase 3"],
    "confidence": "low" | "medium" | "high",
    "ambiguities": ["unclear aspect 1"],
    "isTransitionHypothesis": false
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
- Focus on the PROBLEM people have, not the solution being offered
- Search phrases should be what people actually TYPE when frustrated, not marketing speak
- If this is a product page, identify the pain point the product addresses
- If this is a discussion/review, identify what people are complaining about or seeking help with
- Keep the audience specific but not overly narrow`

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
      let jsonStr = content.text
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        jsonStr = jsonMatch[1]
      }
      parsed = JSON.parse(jsonStr.trim())
    } catch {
      console.error('Failed to parse Claude response:', content.text)
      throw new Error('Failed to parse analysis')
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
    console.error('Analyze URL error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to analyze URL' },
      { status: 500 }
    )
  }
}

function getSourceLabel(urlType: UrlType): string {
  const labels: Record<UrlType, string> = {
    reddit: 'Reddit',
    twitter: 'Twitter/X',
    producthunt: 'Product Hunt',
    hackernews: 'Hacker News',
    indiehackers: 'Indie Hackers',
    linkedin: 'LinkedIn',
    website: 'website',
  }
  return labels[urlType] || 'website'
}
