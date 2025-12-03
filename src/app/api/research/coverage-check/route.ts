// Coverage Check API Endpoint
// FREE endpoint (no credit charge) to preview data availability before running research

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { discoverSubreddits } from '@/lib/reddit/subreddit-discovery'
import { checkCoverage, extractKeywords } from '@/lib/data-sources'
import { StructuredHypothesis } from '@/types/research'

export interface CoverageCheckRequest {
  hypothesis: string
  structuredHypothesis?: StructuredHypothesis // New: structured input
}

export interface SubredditCoverage {
  name: string
  estimatedPosts: number
  relevanceScore: 'high' | 'medium' | 'low'
}

export interface CoverageCheckResponse {
  subreddits: SubredditCoverage[]
  totalEstimatedPosts: number
  dataConfidence: 'high' | 'medium' | 'low' | 'very_low'
  recommendation: 'proceed' | 'caution' | 'refine'
  refinementSuggestions?: string[]
  keywords: string[]
  problemPhrases?: string[] // New: phrases we'll search for
}

/**
 * Extract problem phrases from structured hypothesis for search
 * This is the key innovation - using customer language directly
 */
function extractProblemPhrases(structured: StructuredHypothesis): string[] {
  const phrases: string[] = []

  // If user provided problem language, parse it (comma or quote separated)
  if (structured.problemLanguage) {
    // Try to extract quoted phrases first
    const quotedMatches = structured.problemLanguage.match(/"([^"]+)"|'([^']+)'/g)
    if (quotedMatches && quotedMatches.length > 0) {
      quotedMatches.forEach(match => {
        const cleaned = match.replace(/["']/g, '').trim()
        if (cleaned) phrases.push(cleaned)
      })
    } else {
      // Fall back to comma separation
      structured.problemLanguage.split(',').forEach(phrase => {
        const cleaned = phrase.trim()
        if (cleaned && cleaned.length > 3) phrases.push(cleaned)
      })
    }
  }

  // Always add problem-derived phrases if we have few user phrases
  if (phrases.length < 3 && structured.problem) {
    // Extract key phrases from the problem description
    const problemPhrases = structured.problem
      .toLowerCase()
      .split(/[,.]/)
      .map(p => p.trim())
      .filter(p => p.length > 5 && p.length < 50)
      .slice(0, 3 - phrases.length)
    phrases.push(...problemPhrases)
  }

  return phrases.slice(0, 5) // Max 5 phrases
}

export async function POST(req: Request) {
  try {
    // Check authentication (but don't charge credits)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await req.json()
    const { hypothesis, structuredHypothesis } = body as CoverageCheckRequest

    // Validate based on input type
    if (structuredHypothesis) {
      if (!structuredHypothesis.audience || !structuredHypothesis.problem) {
        return NextResponse.json(
          { error: 'Audience and problem are required fields' },
          { status: 400 }
        )
      }
    } else if (!hypothesis || hypothesis.trim().length < 10) {
      return NextResponse.json(
        { error: 'Hypothesis must be at least 10 characters' },
        { status: 400 }
      )
    }

    // Extract problem phrases if structured input available
    const problemPhrases = structuredHypothesis
      ? extractProblemPhrases(structuredHypothesis)
      : undefined

    // Build search context for subreddit discovery
    // Prefer structured input for better targeting
    const searchContext = structuredHypothesis
      ? `${structuredHypothesis.audience} experiencing: ${structuredHypothesis.problem}`
      : hypothesis

    // Step 1: Discover relevant subreddits using Claude
    const discovery = await discoverSubreddits(searchContext)
    const subreddits = discovery.subreddits.slice(0, 8) // Limit to 8 for coverage check

    if (subreddits.length === 0) {
      return NextResponse.json({
        subreddits: [],
        totalEstimatedPosts: 0,
        dataConfidence: 'very_low',
        recommendation: 'refine',
        refinementSuggestions: [
          'Could not identify relevant Reddit communities',
          'Try rephrasing your hypothesis with more specific terms',
          'Consider what communities your target customers participate in',
        ],
        keywords: [],
      } as CoverageCheckResponse)
    }

    // Step 2: Extract keywords from hypothesis
    const keywords = extractKeywords(hypothesis)

    // Step 3: Check coverage for each subreddit
    const coverageResult = await checkCoverage(subreddits, keywords)

    // Merge discovery relevance with coverage data
    const subredditCoverage: SubredditCoverage[] = coverageResult.subreddits.map(cov => {
      const suggestion = discovery.suggestions.find(
        s => s.name.toLowerCase() === cov.name.toLowerCase()
      )
      return {
        name: cov.name,
        estimatedPosts: cov.estimatedPosts,
        relevanceScore: suggestion?.relevance || cov.relevanceScore || 'medium',
      }
    })

    // Sort by estimated posts (highest first)
    subredditCoverage.sort((a, b) => b.estimatedPosts - a.estimatedPosts)

    return NextResponse.json({
      subreddits: subredditCoverage,
      totalEstimatedPosts: coverageResult.totalEstimatedPosts,
      dataConfidence: coverageResult.dataConfidence,
      recommendation: coverageResult.recommendation,
      refinementSuggestions: coverageResult.refinementSuggestions,
      keywords,
      problemPhrases, // New: phrases we'll search for
    } as CoverageCheckResponse)
  } catch (error) {
    console.error('Coverage check failed:', error)
    return NextResponse.json(
      { error: 'Coverage check failed. Please try again.' },
      { status: 500 }
    )
  }
}
