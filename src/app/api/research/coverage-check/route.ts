// Coverage Check API Endpoint
// FREE endpoint (no credit charge) to preview data availability before running research

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { discoverSubreddits } from '@/lib/reddit/subreddit-discovery'
import { checkCoverage, extractKeywords } from '@/lib/data-sources'

export interface CoverageCheckRequest {
  hypothesis: string
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
    const { hypothesis } = body as CoverageCheckRequest

    if (!hypothesis || hypothesis.trim().length < 10) {
      return NextResponse.json(
        { error: 'Hypothesis must be at least 10 characters' },
        { status: 400 }
      )
    }

    // Step 1: Discover relevant subreddits using Claude
    const discovery = await discoverSubreddits(hypothesis)
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
    } as CoverageCheckResponse)
  } catch (error) {
    console.error('Coverage check failed:', error)
    return NextResponse.json(
      { error: 'Coverage check failed. Please try again.' },
      { status: 500 }
    )
  }
}
