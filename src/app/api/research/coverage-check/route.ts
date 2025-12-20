// Coverage Check API Endpoint
// FREE endpoint (no credit charge) to preview data availability before running research

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { discoverSubreddits } from '@/lib/reddit/subreddit-discovery'
import {
  checkCoverage,
  shouldIncludeHN,
  checkHNCoverage,
  shouldIncludeGooglePlay,
  checkGooglePlayCoverage,
  checkAppStoreCoverage,
  AppDiscoveryContext,
  ScoredApp,
} from '@/lib/data-sources'
import { AppDetails } from '@/lib/data-sources/types'
import { extractSearchKeywords } from '@/lib/reddit/keyword-extractor'
import { StructuredHypothesis } from '@/types/research'
import { sampleQualityCheck, QualitySampleResult } from '@/lib/research/relevance-filter'
import { redditAdapter } from '@/lib/data-sources'

export interface CoverageCheckRequest {
  hypothesis: string
  structuredHypothesis?: StructuredHypothesis // New: structured input
}

export interface SubredditCoverage {
  name: string
  estimatedPosts: number
  relevanceScore: 'high' | 'medium' | 'low'
  postsPerDay?: number  // Posting velocity for adaptive time-stratified fetching
}

export interface SamplePost {
  title: string
  subreddit: string
  score: number
  permalink: string
}

export interface CoverageCheckResponse {
  subreddits: SubredditCoverage[]
  totalEstimatedPosts: number
  dataConfidence: 'high' | 'medium' | 'low' | 'very_low'
  recommendation: 'proceed' | 'caution' | 'refine'
  refinementSuggestions?: string[]
  keywords: string[]
  problemPhrases?: string[] // New: phrases we'll search for
  samplePosts?: SamplePost[] // Live preview of actual posts
  // 3-stage discovery results
  discoveryWarning?: string | null
  discoveryRecommendation?: 'proceed' | 'proceed_with_caution' | 'reconsider'
  domain?: {
    primaryDomain: string
    secondaryDomains: string[]
    audienceDescriptor: string
  }
  // Hacker News data (for tech/startup hypotheses)
  hackerNews?: {
    included: boolean
    estimatedPosts: number
    samplePosts: SamplePost[]
  }
  // Google Play data (for mobile app hypotheses)
  googlePlay?: {
    included: boolean
    estimatedPosts: number
    samplePosts: SamplePost[]
    apps: ScoredApp[]  // List of discovered apps with relevance scores
  }
  // App Store data (for mobile app hypotheses)
  appStore?: {
    included: boolean
    estimatedPosts: number
    samplePosts: SamplePost[]
    apps: ScoredApp[]  // List of discovered apps with relevance scores
  }
  // Data sources that will be used
  dataSources?: string[]
  // Quality preview (pre-research relevance prediction)
  qualityPreview?: QualitySampleResult
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

    // Step 1: Discover relevant subreddits using Claude's 3-stage domain-first pipeline
    // Pass structured hypothesis when available for better domain extraction
    const discoveryInput = structuredHypothesis || hypothesis
    const discovery = await discoverSubreddits(discoveryInput)
    const subreddits = discovery.subreddits.slice(0, 12) // Increased from 8 to 12 for broader coverage

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
        discoveryWarning: discovery.warning,
        discoveryRecommendation: discovery.recommendation,
        domain: discovery.domain,
      } as CoverageCheckResponse)
    }

    // Step 2: Extract keywords from hypothesis (exclude solution field)
    const extractedKeywords = await extractSearchKeywords(hypothesis, structuredHypothesis)
    // Use primary keywords for coverage check - these are the most distinctive terms
    const keywords = extractedKeywords.primary

    // Step 3: Check coverage for each subreddit
    // For sample posts, prefer problemPhrases (user's search terms) over generic keywords
    const sampleKeywords = problemPhrases && problemPhrases.length > 0
      ? problemPhrases
      : keywords
    const coverageResult = await checkCoverage(subreddits, sampleKeywords)

    // Merge discovery relevance with coverage data
    const subredditCoverage: SubredditCoverage[] = coverageResult.subreddits.map(cov => {
      const suggestion = discovery.suggestions.find(
        s => s.name.toLowerCase() === cov.name.toLowerCase()
      )
      return {
        name: cov.name,
        estimatedPosts: cov.estimatedPosts,
        relevanceScore: suggestion?.relevance || cov.relevanceScore || 'medium',
        postsPerDay: cov.postsPerDay, // Pass through velocity for adaptive fetching
      }
    })

    // Sort by estimated posts (highest first)
    subredditCoverage.sort((a, b) => b.estimatedPosts - a.estimatedPosts)

    // Check if HN should be included (tech/startup hypotheses)
    const includeHN = shouldIncludeHN(hypothesis)
    let hnCoverage = null
    const dataSources: string[] = ['Reddit']

    if (includeHN) {
      // Pass hypothesis directly for natural language search (much better results than individual keywords)
      const hnData = await checkHNCoverage(hypothesis)
      if (hnData.available) {
        hnCoverage = {
          included: true,
          estimatedPosts: hnData.estimatedPosts,
          samplePosts: hnData.samplePosts,
        }
        dataSources.push('Hacker News')
      }
    }

    // Always check app stores - users can toggle them on/off in the UI
    // (Previously we only checked when mobile keywords were detected)
    let googlePlayCoverage = null
    let appStoreCoverage = null

    // Build app discovery context from structured hypothesis (if available)
    // This enables smart LLM-based relevance scoring for apps
    const appDiscoveryContext: AppDiscoveryContext | undefined = structuredHypothesis ? {
      hypothesis,
      audience: structuredHypothesis.audience,
      problem: structuredHypothesis.problem,
      // Extract domain keywords from the hypothesis interpretation
      domainKeywords: keywords.slice(0, 5),
      // These would come from interpret-hypothesis in the full flow
      expectedCategories: undefined,
      antiCategories: undefined,
      competitorApps: undefined,
    } : {
      // Fallback: just pass hypothesis for basic scoring
      hypothesis,
      domainKeywords: keywords.slice(0, 5),
    }

    // Fetch both app stores in parallel - always include if data is available
    const [gplayData, appStoreData] = await Promise.all([
      checkGooglePlayCoverage(hypothesis, appDiscoveryContext),
      checkAppStoreCoverage(hypothesis, appDiscoveryContext),
    ])

    if (gplayData.available && gplayData.estimatedPosts > 0) {
      googlePlayCoverage = {
        included: true,
        estimatedPosts: gplayData.estimatedPosts,
        samplePosts: gplayData.samplePosts,
        apps: gplayData.apps,
      }
      dataSources.push('Google Play')
    }

    if (appStoreData.available && appStoreData.estimatedPosts > 0) {
      appStoreCoverage = {
        included: true,
        estimatedPosts: appStoreData.estimatedPosts,
        samplePosts: appStoreData.samplePosts,
        apps: appStoreData.apps,
      }
      dataSources.push('App Store')
    }

    // Calculate total estimated posts from all sources
    const totalEstimatedPosts = coverageResult.totalEstimatedPosts +
      (hnCoverage?.estimatedPosts || 0) +
      (googlePlayCoverage?.estimatedPosts || 0) +
      (appStoreCoverage?.estimatedPosts || 0)

    // Step 4: Quality sampling - fetch actual posts and run relevance prediction
    // This helps users understand expected quality BEFORE they pay
    let qualityPreview: QualitySampleResult | undefined

    try {
      // Fetch 40 sample posts from top subreddits for quality analysis
      const topSubreddits = subredditCoverage
        .filter(s => s.estimatedPosts > 0)
        .slice(0, 4)  // Top 4 subreddits
        .map(s => s.name)

      if (topSubreddits.length > 0) {
        // Fetch 10 posts from each subreddit (up to 40 total)
        const samplePostPromises = topSubreddits.map(sub =>
          redditAdapter.getSamplePostsWithKeywords(sub, 10, sampleKeywords)
        )
        const samplePostResults = await Promise.all(samplePostPromises)
        const allSamplePosts = samplePostResults.flat()

        if (allSamplePosts.length >= 10) {
          // Convert SamplePost[] to RedditPost[] format for quality check
          const postsForSampling = allSamplePosts.map(p => ({
            id: p.permalink.split('/').slice(-2)[0] || Math.random().toString(),
            title: p.title,
            body: '', // Sample posts don't have body, but title is enough for domain gate
            subreddit: p.subreddit,
            author: '',
            score: p.score,
            createdUtc: Date.now() / 1000,
            permalink: p.permalink,
            url: p.permalink,
            numComments: 0,
          }))

          qualityPreview = await sampleQualityCheck(
            postsForSampling,
            hypothesis,
            structuredHypothesis
          )

          console.log(`[QualityPreview] Predicted relevance: ${qualityPreview.predictedRelevance}%, Warning: ${qualityPreview.qualityWarning}`)
          console.log(`[QualityPreview] Sample relevant: ${qualityPreview.sampleRelevant?.length || 0}, filtered: ${qualityPreview.sampleFiltered?.length || 0}`)
        } else {
          console.log(`[QualityPreview] Skipped - only ${allSamplePosts.length} sample posts (need ≥10)`)
        }
      } else {
        console.log(`[QualityPreview] Skipped - no subreddits with posts`)
      }
    } catch (error) {
      console.warn('[QualityPreview] Failed to run quality sampling:', error)
      // Non-blocking - continue without quality preview
    }

    console.log(`[CoverageCheck] qualityPreview is ${qualityPreview ? 'set' : 'undefined'}`)

    return NextResponse.json({
      subreddits: subredditCoverage,
      totalEstimatedPosts,
      dataConfidence: coverageResult.dataConfidence,
      recommendation: coverageResult.recommendation,
      refinementSuggestions: coverageResult.refinementSuggestions,
      keywords,
      problemPhrases, // New: phrases we'll search for
      samplePosts: coverageResult.samplePosts, // Live preview of actual posts
      // 3-stage discovery results
      discoveryWarning: discovery.warning,
      discoveryRecommendation: discovery.recommendation,
      domain: discovery.domain,
      // HN coverage (if applicable)
      hackerNews: hnCoverage || undefined,
      // App store coverage (if applicable)
      googlePlay: googlePlayCoverage || undefined,
      appStore: appStoreCoverage || undefined,
      dataSources,
      // Quality preview (pre-research relevance prediction)
      qualityPreview,
    } as CoverageCheckResponse)
  } catch (error) {
    console.error('Coverage check failed:', error)
    return NextResponse.json(
      { error: 'Coverage check failed. Please try again.' },
      { status: 500 }
    )
  }
}
