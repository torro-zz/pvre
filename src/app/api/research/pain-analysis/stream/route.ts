// Streaming Pain Analysis API (Step 1 of Research Flow)
// Provides real-time progress updates via Server-Sent Events (SSE)
// This is the first step in the research flow, focusing on community voice mining

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { deductCredit } from '@/lib/credits'
import { StructuredHypothesis } from '@/types/research'
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
import {
  startTokenTracking,
  endTokenTracking,
  getCurrentTracker,
} from '@/lib/anthropic'
import { extractSearchKeywords, preFilterByExcludeKeywords } from '@/lib/reddit/keyword-extractor'
import {
  getSubredditWeights,
  applySubredditWeights,
} from '@/lib/analysis/subreddit-weights'
import { trackUsage } from '@/lib/analysis/token-tracker'
import { StepStatusMap } from '@/types/database'
import { saveResearchResult } from '@/lib/research/save-result'
import {
  filterRelevantPosts,
  filterRelevantComments,
} from '@/lib/research/relevance-filter'

// Robust JSON array extraction with multiple fallback strategies
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

// Helper to update step status
async function updateStepStatus(
  jobId: string,
  stepName: keyof StepStatusMap,
  status: StepStatusMap[keyof StepStatusMap],
  unlockNext?: keyof StepStatusMap
) {
  const adminClient = createAdminClient()

  // Get current step status
  const { data: job } = await adminClient
    .from('research_jobs')
    .select('step_status')
    .eq('id', jobId)
    .single()

  const currentStatus = (job?.step_status as unknown as StepStatusMap) || {
    pain_analysis: 'pending',
    market_sizing: 'locked',
    timing_analysis: 'locked',
    competitor_analysis: 'locked',
  }

  // Update the step status
  const newStatus: StepStatusMap = {
    ...currentStatus,
    [stepName]: status,
  }

  // Unlock next step if specified
  if (unlockNext && status === 'completed') {
    newStatus[unlockNext] = 'pending'
  }

  await adminClient
    .from('research_jobs')
    .update({ step_status: JSON.parse(JSON.stringify(newStatus)) })
    .eq('id', jobId)
}

export async function POST(request: NextRequest) {
  const stream = new ReadableStream({
    async start(controller) {
      const send = (step: string, message: string, data?: Record<string, unknown>) => {
        sendEvent(controller, { type: 'progress', step, message, data })
      }

      let jobId: string | null = null

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
        const { hypothesis, jobId: requestJobId } = body
        jobId = requestJobId

        if (!hypothesis || typeof hypothesis !== 'string') {
          sendEvent(controller, { type: 'error', step: 'validation', message: 'Hypothesis is required' })
          controller.close()
          return
        }

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

        // coverage_data is a JSON column that may contain structuredHypothesis
        const coverageData = (jobData as Record<string, unknown>)?.coverage_data as Record<string, unknown> | undefined
        if (coverageData?.structuredHypothesis) {
          structuredHypothesis = coverageData.structuredHypothesis as StructuredHypothesis
        }

        // Update step status to in_progress
        await updateStepStatus(jobId, 'pain_analysis', 'in_progress')

        // Deduct credit
        const creditDeducted = await deductCredit(user.id, jobId)
        if (!creditDeducted) {
          await updateStepStatus(jobId, 'pain_analysis', 'failed')
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
        const subredditsToSearch = discoveredSubreddits.slice(0, 6)
        send('subreddits', `Found ${subredditsToSearch.length} relevant subreddits: ${subredditsToSearch.join(', ')}`, {
          subreddits: subredditsToSearch,
        })

        // Step 2.5: Get subreddit weights
        send('weights', 'Calculating subreddit relevance weights...')
        const subredditWeights = await getSubredditWeights(hypothesis, subredditsToSearch)
        send('weights', 'Subreddit weights calculated', { weights: Object.fromEntries(subredditWeights) })

        // Step 3: Fetch data from multiple sources (Reddit + HN for tech hypotheses)
        const includesHN = shouldIncludeHN(hypothesis)
        send('fetching', `Searching ${subredditsToSearch.length} subreddits${includesHN ? ' + Hacker News' : ''} for discussions...`)
        const multiSourceData = await fetchMultiSourceData({
          subreddits: subredditsToSearch,
          keywords: keywords.primary,
          limit: 100,
          timeRange: {
            after: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000), // Last 2 years
          },
        }, hypothesis)
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

        // Step 4: 3-Stage Relevance Filter (Quality Gate → Domain Gate → Problem Match)
        send('filtering', `Running 3-stage relevance filter on ${preFilteredPosts.length} posts...`)
        const postFilterResult = await filterRelevantPosts(
          preFilteredPosts,
          hypothesis,
          structuredHypothesis,
          (msg, data) => send('filtering', msg, data)
        )
        const posts = postFilterResult.items

        const commentFilterResult = await filterRelevantComments(
          preFilteredComments,
          hypothesis,
          structuredHypothesis,
          (msg) => send('filtering', msg)
        )
        const comments = commentFilterResult.items

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

        const processingTimeMs = Date.now() - startTime
        const tokenUsage = endTokenTracking()

        // Build final result (pain analysis only - no market sizing or timing)
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
              // 3-stage breakdown for posts
              postStage3Filtered: postFilterResult.metrics.stage3Filtered, // Quality gate
              postStage1Filtered: postFilterResult.metrics.stage1Filtered, // Domain gate
              postStage2Filtered: postFilterResult.metrics.stage2Filtered, // Problem match
              commentsFound: commentFilterResult.metrics.before,
              commentsAnalyzed: commentFilterResult.metrics.after,
              commentsFiltered: commentFilterResult.metrics.filteredOut,
              commentFilterRate: commentFilterResult.metrics.filterRate,
              qualityLevel,
            },
            tokenUsage: tokenUsage || undefined,
          },
        }

        // Save results using shared utility
        await saveResearchResult(jobId, 'pain_analysis', result)

        // Update step status to completed and unlock market_sizing
        await updateStepStatus(jobId, 'pain_analysis', 'completed', 'market_sizing')

        // Update job status to processing (not completed, as there are more steps)
        await adminClient
          .from('research_jobs')
          .update({ status: 'processing' })
          .eq('id', jobId)

        // Send completion
        sendEvent(controller, {
          type: 'complete',
          step: 'done',
          message: 'Pain analysis complete! Market sizing is now available.',
          data: { result },
        })

        controller.close()
      } catch (error) {
        console.error('Pain analysis stream error:', error)

        // Update step status to failed
        if (jobId) {
          await updateStepStatus(jobId, 'pain_analysis', 'failed')
        }

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
