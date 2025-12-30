// Streaming Community Voice Research API
// Provides real-time progress updates via Server-Sent Events (SSE)

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { deductCredit } from '@/lib/credits'
import { StructuredHypothesis, TargetGeography } from '@/types/research'
import { discoverSubreddits } from '@/lib/reddit/subreddit-discovery'
import { fetchMultiSourceData, shouldIncludeHN, RedditPost, RedditComment } from '@/lib/data-sources'
import {
  analyzePosts,
  analyzeComments,
  combinePainSignals,
  getPainSummary,
} from '@/lib/analysis/pain-detector'
import {
  extractThemes,
  generateInterviewQuestions,
  calculateThemeResonance,
} from '@/lib/analysis/theme-extractor'
import { calculateMarketSize, MarketSizingResult } from '@/lib/analysis/market-sizing'
import { analyzeTiming, TimingResult } from '@/lib/analysis/timing-analyzer'
import {
  startTokenTracking,
  endTokenTracking,
} from '@/lib/anthropic'
import { extractSearchKeywords, preFilterByExcludeKeywords } from '@/lib/reddit/keyword-extractor'
import {
  getSubredditWeights,
  applySubredditWeights,
} from '@/lib/analysis/subreddit-weights'
import { saveResearchResult } from '@/lib/research/save-result'
import {
  filterRelevantPosts,
  filterRelevantComments,
} from '@/lib/research/relevance-filter'

/**
 * Robust JSON array extraction from Claude responses
 * Handles: pure JSON, code blocks, preamble text, and malformed responses
 */
function extractJSONArray(text: string): string[] | null {
  const trimmed = text.trim()

  // Try 1: Direct parse (ideal case)
  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) return parsed
  } catch {
    // Continue to other methods
  }

  // Try 2: Extract from markdown code block
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim())
      if (Array.isArray(parsed)) return parsed
    } catch {
      // Continue
    }
  }

  // Try 3: Find JSON array - use lastIndexOf for ] to handle nested/multiple arrays
  const arrayStart = trimmed.indexOf('[')
  const arrayEnd = trimmed.lastIndexOf(']')
  if (arrayStart !== -1 && arrayEnd > arrayStart) {
    try {
      const parsed = JSON.parse(trimmed.slice(arrayStart, arrayEnd + 1))
      if (Array.isArray(parsed)) return parsed
    } catch {
      // Continue
    }
  }

  // Try 4: Handle common malformed responses like [Y, N, Y] (unquoted)
  const unquotedMatch = trimmed.match(/\[\s*([YN](?:\s*,\s*[YN])*)\s*\]/i)
  if (unquotedMatch) {
    const values = unquotedMatch[1].split(',').map(v => v.trim().toUpperCase())
    return values
  }

  console.warn('[extractJSONArray] Failed to parse:', trimmed.slice(0, 200))
  return null
}

// Progress event types
interface ProgressEvent {
  type: 'progress' | 'complete' | 'error'
  step: string
  message: string
  data?: Record<string, unknown>
}

// Helper to send SSE events
function sendEvent(controller: ReadableStreamDefaultController, event: ProgressEvent) {
  const data = JSON.stringify(event)
  controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`))
}

function calculateQualityLevel(postFilterRate: number, commentFilterRate: number): 'high' | 'medium' | 'low' {
  const avgFilterRate = (postFilterRate + commentFilterRate) / 2
  if (avgFilterRate <= 40) return 'high'
  if (avgFilterRate <= 70) return 'medium'
  return 'low'
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (step: string, message: string, data?: Record<string, unknown>) => {
        sendEvent(controller, { type: 'progress', step, message, data })
      }

      try {
        // Auth check
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) {
          sendEvent(controller, { type: 'error', step: 'auth', message: 'Authentication required' })
          controller.close()
          return
        }

        const body = await request.json()
        const { hypothesis, jobId } = body

        if (!hypothesis || typeof hypothesis !== 'string') {
          sendEvent(controller, { type: 'error', step: 'validation', message: 'Hypothesis is required' })
          controller.close()
          return
        }

        // Deduct credit (requires jobId from request body)
        if (!jobId) {
          sendEvent(controller, { type: 'error', step: 'validation', message: 'Job ID is required' })
          controller.close()
          return
        }

        // Fetch structured hypothesis from job's coverage_data (excludes solution field)
        let structuredHypothesis: StructuredHypothesis | undefined
        const adminClient = createAdminClient()
        const { data: jobData } = await adminClient
          .from('research_jobs')
          .select('coverage_data')
          .eq('id', jobId)
          .single()

        // coverage_data is a JSON column that may contain structuredHypothesis, targetGeography, and sampleSizePerSource
        const coverageData = (jobData as Record<string, unknown>)?.coverage_data as Record<string, unknown> | undefined
        if (coverageData?.structuredHypothesis) {
          structuredHypothesis = coverageData.structuredHypothesis as StructuredHypothesis
        }

        // Get sample size from coverage data (default 300, max 1000)
        // Dec 2025: Increased defaults to improve recall; embedding filter handles cost control
        const sampleSizePerSource = Math.min(
          (coverageData?.sampleSizePerSource as number) || 300,
          1000 // Raised cap since embedding filter makes larger fetches cost-effective
        )

        // Extract target geography for market sizing scoping
        let targetGeography: TargetGeography | undefined
        if (coverageData?.targetGeography) {
          targetGeography = coverageData.targetGeography as TargetGeography
        }

        // Extract MSC target and target price for market sizing
        const mscTarget = coverageData?.mscTarget as number | undefined
        const targetPrice = coverageData?.targetPrice as number | undefined

        // Extract selected data sources
        const selectedDataSources = coverageData?.selectedDataSources as string[] | undefined

        const creditDeducted = await deductCredit(user.id, jobId)
        if (!creditDeducted) {
          sendEvent(controller, { type: 'error', step: 'credits', message: 'Insufficient credits' })
          controller.close()
          return
        }

        startTokenTracking()
        const startTime = Date.now()

        // Step 1: Extract keywords
        // CRITICAL: Pass structured hypothesis to exclude solution field from keywords
        send('keywords', 'Extracting search keywords from your hypothesis...')
        const keywords = await extractSearchKeywords(hypothesis, structuredHypothesis)
        send('keywords', `Found ${keywords.primary.length} primary keywords`, { keywords })

        // Step 2: Discover subreddits
        send('subreddits', 'Discovering relevant communities...')
        const { subreddits: discoveredSubreddits } = await discoverSubreddits(hypothesis)
        const subredditsToSearch = discoveredSubreddits.slice(0, 15) // Dec 2025: Increased from 10 to 15 for better recall
        send('subreddits', `Found ${subredditsToSearch.length} relevant subreddits: ${subredditsToSearch.join(', ')}`, {
          subreddits: subredditsToSearch,
        })

        // Step 2.5: Get subreddit weights
        send('weights', 'Calculating subreddit relevance weights...')
        const subredditWeights = await getSubredditWeights(hypothesis, subredditsToSearch)
        send('weights', 'Subreddit weights calculated', { weights: Object.fromEntries(subredditWeights) })

        // Step 3: Fetch data from multiple sources (Reddit + HN/AppStores if user selected)
        const includesHN = selectedDataSources
          ? selectedDataSources.includes('Hacker News')
          : shouldIncludeHN(hypothesis) // Fallback to auto-detection
        const includesGooglePlay = selectedDataSources?.includes('Google Play') ?? false
        const includesAppStore = selectedDataSources?.includes('App Store') ?? false
        const includesTrustpilot = selectedDataSources?.includes('Trustpilot') ?? undefined // undefined = auto-detect

        const sourceDescription = [
          `${subredditsToSearch.length} subreddits`,
          includesHN ? 'Hacker News' : null,
          includesGooglePlay ? 'Google Play' : null,
          includesAppStore ? 'App Store' : null,
          includesTrustpilot === true ? 'Trustpilot' : null,
        ].filter(Boolean).join(' + ')
        send('fetching', `Searching ${sourceDescription} for discussions...`)

        const multiSourceData = await fetchMultiSourceData({
          subreddits: subredditsToSearch,
          keywords: keywords.primary,
          limit: sampleSizePerSource, // User-configurable: 100-300 per source
          timeRange: {
            after: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // Last 12 months (prioritize recent)
          },
        }, hypothesis, includesHN, includesGooglePlay, includesAppStore, includesTrustpilot)
        const rawPosts = multiSourceData.posts
        const rawComments = multiSourceData.comments
        send('fetching', `Found ${rawPosts.length} posts and ${rawComments.length} comments from ${multiSourceData.sources.join(' + ') || 'Reddit'}`, {
          postsFound: rawPosts.length,
          commentsFound: rawComments.length,
          sources: multiSourceData.sources,
        })

        // Step 3.5: Pre-filter with exclude keywords
        const preFilteredPosts = preFilterByExcludeKeywords(rawPosts, keywords.exclude)
        const preFilteredComments = preFilterByExcludeKeywords(rawComments, keywords.exclude)
        const preFilteredPostCount = rawPosts.length - preFilteredPosts.length
        const preFilteredCommentCount = rawComments.length - preFilteredComments.length

        if (preFilteredPostCount > 0 || preFilteredCommentCount > 0) {
          send('prefilter', `Removed ${preFilteredPostCount} posts and ${preFilteredCommentCount} comments with off-topic keywords`)
        }

        // Step 4: Filter for relevance (with streaming progress)
        // CRITICAL: Pass structured hypothesis for domain-aware filtering (not just audience matching)
        send('filtering', `Filtering ${preFilteredPosts.length} posts for relevance to your hypothesis...`)
        const postFilterResult = await filterRelevantPosts(preFilteredPosts, hypothesis, structuredHypothesis, (msg, data) => {
          send('filtering', msg, data)
        })
        let posts = postFilterResult.items

        const commentFilterResult = await filterRelevantComments(preFilteredComments, hypothesis, structuredHypothesis, (msg) => {
          send('filtering', msg)
        })
        let comments = commentFilterResult.items

        const qualityLevel = calculateQualityLevel(postFilterResult.metrics.filterRate, commentFilterResult.metrics.filterRate)
        const coreCount = postFilterResult.metrics.coreSignals
        const relatedCount = postFilterResult.metrics.relatedSignals
        send('filtering', `Found ${posts.length} relevant posts (${coreCount} CORE, ${relatedCount} RELATED)`, {
          relevantPosts: posts.length,
          relevantComments: comments.length,
          coreSignals: coreCount,
          relatedSignals: relatedCount,
          qualityLevel,
          filterRate: postFilterResult.metrics.filterRate,
        })

        // Step 5: Analyze pain signals with tier awareness
        // Analyze CORE and RELATED separately to preserve tier info
        send('analyzing', 'Analyzing pain signals in relevant content...')
        const corePostSignals = analyzePosts(postFilterResult.coreItems).map(s => ({ ...s, tier: 'CORE' as const }))
        const relatedPostSignals = analyzePosts(postFilterResult.relatedItems).map(s => ({ ...s, tier: 'RELATED' as const }))
        const postSignals = [...corePostSignals, ...relatedPostSignals]
        const commentSignals = analyzeComments(comments)
        const allPainSignals = combinePainSignals(postSignals, commentSignals)

        // Apply subreddit weights
        applySubredditWeights(allPainSignals, subredditWeights)
        send('analyzing', `Found ${allPainSignals.length} pain signals`, { painSignalCount: allPainSignals.length })

        // Step 6: Get pain summary
        const painSummary = getPainSummary(allPainSignals)

        // Step 7: Extract themes
        send('themes', 'Extracting key themes with AI...')
        const themeAnalysis = await extractThemes(allPainSignals, hypothesis)

        // Step 7b: Calculate resonance for each theme
        themeAnalysis.themes = calculateThemeResonance(themeAnalysis.themes, allPainSignals)
        send('themes', `Identified ${themeAnalysis.themes.length} themes`, { themeCount: themeAnalysis.themes.length })

        // Step 8: Generate interview questions
        send('interview', 'Generating interview questions...')
        const interviewQuestions = await generateInterviewQuestions(themeAnalysis, hypothesis)
        send('interview', 'Interview guide ready')

        // Step 9: Market sizing (with geographic scoping and user's revenue/pricing targets)
        send('market', `Analyzing market size${targetGeography?.location ? ` for ${targetGeography.location}` : ''}...`)
        let marketSizing: MarketSizingResult | undefined
        try {
          marketSizing = await calculateMarketSize({
            hypothesis,
            geography: targetGeography?.location || 'Global',
            geographyScope: targetGeography?.scope || 'global',
            mscTarget,
            targetPrice,
          })
          send('market', `Market sizing complete - Score: ${marketSizing.score}/10`)
        } catch (error) {
          console.error('Market sizing failed:', error)
          send('market', 'Market sizing skipped')
        }

        // Step 10: Timing analysis
        send('timing', 'Analyzing market timing...')
        let timing: TimingResult | undefined
        try {
          timing = await analyzeTiming({ hypothesis })
          send('timing', `Timing analysis complete - Score: ${timing.score}/10`)
        } catch (error) {
          console.error('Timing analysis failed:', error)
          send('timing', 'Timing analysis skipped')
        }

        const processingTimeMs = Date.now() - startTime
        const tokenUsage = endTokenTracking()

        // Build final result
        const result = {
          hypothesis,
          subreddits: {
            discovered: discoveredSubreddits,
            analyzed: subredditsToSearch,
          },
          painSignals: allPainSignals.slice(0, 50),
          painSummary,
          themeAnalysis,
          interviewQuestions,
          marketSizing,
          timing,
          metadata: {
            postsAnalyzed: posts.length,
            commentsAnalyzed: comments.length,
            processingTimeMs,
            timestamp: new Date().toISOString(),
            filteringMetrics: {
              postsFound: postFilterResult.metrics.before,
              postsAnalyzed: postFilterResult.metrics.after,
              postsFiltered: postFilterResult.metrics.filteredOut,
              postFilterRate: postFilterResult.metrics.filterRate,
              coreSignals: postFilterResult.metrics.coreSignals,
              relatedSignals: postFilterResult.metrics.relatedSignals,
              titleOnlyPosts: postFilterResult.metrics.titleOnlyPosts,
              commentsFound: commentFilterResult.metrics.before,
              commentsAnalyzed: commentFilterResult.metrics.after,
              commentsFiltered: commentFilterResult.metrics.filteredOut,
              commentFilterRate: commentFilterResult.metrics.filterRate,
              qualityLevel,
              // P0 FIX: Stage 2 filter metrics
              stage2FilterRate: postFilterResult.metrics.stage2FilterRate,
              narrowProblemWarning: postFilterResult.metrics.narrowProblemWarning,
            },
            tokenUsage: tokenUsage || undefined,
          },
        }

        // Save results if jobId provided
        if (jobId) {
          try {
            await saveResearchResult(jobId, 'community_voice', result)
          } catch (saveError) {
            console.error('Failed to save results:', saveError)
          }
        }

        // Send completion
        sendEvent(controller, {
          type: 'complete',
          step: 'done',
          message: 'Research complete!',
          data: { result },
        })

        controller.close()
      } catch (error) {
        console.error('Stream error:', error)
        sendEvent(controller, {
          type: 'error',
          step: 'unknown',
          message: error instanceof Error ? error.message : 'An error occurred',
        })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
