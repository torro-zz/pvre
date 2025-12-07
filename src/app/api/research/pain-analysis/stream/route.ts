// Streaming Pain Analysis API (Step 1 of Research Flow)
// Provides real-time progress updates via Server-Sent Events (SSE)
// This is the first step in the research flow, focusing on community voice mining

import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { deductCredit } from '@/lib/credits'
import { StructuredHypothesis } from '@/types/research'
import { discoverSubreddits } from '@/lib/reddit/subreddit-discovery'
import { fetchRedditData, RedditPost, RedditComment } from '@/lib/data-sources'
import {
  analyzePosts,
  analyzeComments,
  combinePainSignals,
  getPainSummary,
} from '@/lib/analysis/pain-detector'
import {
  extractThemes,
  generateInterviewQuestions,
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
import Anthropic from '@anthropic-ai/sdk'
import { trackUsage } from '@/lib/analysis/token-tracker'
import { StepStatusMap } from '@/types/database'
import { saveResearchResult } from '@/lib/research/save-result'

const anthropic = new Anthropic()

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

// Relevance filter for posts (Y/N binary)
async function filterRelevantPosts(
  posts: RedditPost[],
  hypothesis: string,
  sendProgress: (msg: string, data?: Record<string, unknown>) => void
): Promise<{ items: RedditPost[]; metrics: { before: number; after: number; filteredOut: number; filterRate: number } }> {
  if (posts.length === 0) {
    return { items: [], metrics: { before: 0, after: 0, filteredOut: 0, filterRate: 0 } }
  }

  sendProgress(`Analyzing ${posts.length} posts for relevance...`)

  const batchSize = 20
  const relevantPosts: RedditPost[] = []
  let processedCount = 0

  for (let i = 0; i < posts.length; i += batchSize) {
    const batch = posts.slice(i, i + batchSize)

    const prompt = `You are evaluating whether Reddit posts are relevant to a specific business hypothesis.

HYPOTHESIS: "${hypothesis}"

TASK: For each post below, decide if it discusses problems, needs, or experiences DIRECTLY related to the hypothesis.

RELEVANT (Y) means:
- The post discusses the actual problem the hypothesis solves
- The post is about the target user's specific pain point
- The post mentions the domain/activity the hypothesis addresses

NOT RELEVANT (N) means:
- The post is about unrelated business/life topics
- The post contains pain language but about different problems
- The post is tangentially related but not about the core problem

POSTS TO EVALUATE:
${batch.map((p, idx) => `[${idx}] "${p.title}" - ${(p.body || '').slice(0, 200)}...`).join('\n')}

Respond with ONLY a JSON array of "Y" or "N" for each post in order:
["Y", "N", "Y", ...]`

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-latest',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      })

      const tracker = getCurrentTracker()
      if (tracker && response.usage) {
        trackUsage(tracker, response.usage, 'claude-3-5-haiku-latest')
      }

      const content = response.content[0]
      if (content.type === 'text') {
        const decisions = extractJSONArray(content.text)
        if (decisions) {
          batch.forEach((post, idx) => {
            if (decisions[idx]?.toString().toUpperCase() === 'Y') {
              relevantPosts.push(post)
            }
          })
        } else {
          // Fallback: include all posts if we can't parse the response
          console.warn('[filterRelevantPosts] Could not parse decisions, including all posts in batch')
          relevantPosts.push(...batch)
        }
      }
    } catch (error) {
      console.error('Relevance filter batch failed:', error)
      relevantPosts.push(...batch)
    }

    processedCount += batch.length
    const relevantCount = relevantPosts.length
    const filterRate = ((processedCount - relevantCount) / processedCount * 100).toFixed(0)
    sendProgress(`Checked ${processedCount}/${posts.length} posts (${relevantCount} relevant so far, ${filterRate}% filtered)`, {
      processed: processedCount,
      total: posts.length,
      relevant: relevantCount,
    })
  }

  const metrics = {
    before: posts.length,
    after: relevantPosts.length,
    filteredOut: posts.length - relevantPosts.length,
    filterRate: posts.length > 0 ? ((posts.length - relevantPosts.length) / posts.length) * 100 : 0,
  }

  return { items: relevantPosts, metrics }
}

// Relevance filter for comments (Y/N binary)
async function filterRelevantComments(
  comments: RedditComment[],
  hypothesis: string,
  sendProgress: (msg: string, data?: Record<string, unknown>) => void
): Promise<{ items: RedditComment[]; metrics: { before: number; after: number; filteredOut: number; filterRate: number } }> {
  if (comments.length === 0) {
    return { items: [], metrics: { before: 0, after: 0, filteredOut: 0, filterRate: 0 } }
  }

  sendProgress(`Analyzing ${comments.length} comments for relevance...`)

  const batchSize = 25
  const relevantComments: RedditComment[] = []

  for (let i = 0; i < comments.length; i += batchSize) {
    const batch = comments.slice(i, i + batchSize)

    const prompt = `You are evaluating whether Reddit comments are relevant to a specific business hypothesis.

HYPOTHESIS: "${hypothesis}"

For each comment, respond Y if it discusses problems DIRECTLY related to the hypothesis, N otherwise.

COMMENTS:
${batch.map((c, idx) => `[${idx}] "${(c.body || '').slice(0, 150)}..."`).join('\n')}

Respond with ONLY a JSON array: ["Y", "N", ...]`

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-latest',
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }],
      })

      const tracker = getCurrentTracker()
      if (tracker && response.usage) {
        trackUsage(tracker, response.usage, 'claude-3-5-haiku-latest')
      }

      const content = response.content[0]
      if (content.type === 'text') {
        const decisions = extractJSONArray(content.text)
        if (decisions) {
          batch.forEach((comment, idx) => {
            if (decisions[idx]?.toString().toUpperCase() === 'Y') {
              relevantComments.push(comment)
            }
          })
        } else {
          // Fallback: include all comments if we can't parse the response
          console.warn('[filterRelevantComments] Could not parse decisions, including all comments in batch')
          relevantComments.push(...batch)
        }
      }
    } catch (error) {
      console.error('Comment relevance filter batch failed:', error)
      relevantComments.push(...batch)
    }
  }

  const metrics = {
    before: comments.length,
    after: relevantComments.length,
    filteredOut: comments.length - relevantComments.length,
    filterRate: comments.length > 0 ? ((comments.length - relevantComments.length) / comments.length) * 100 : 0,
  }

  return { items: relevantComments, metrics }
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

        // Step 3: Fetch Reddit data
        send('fetching', `Searching ${subredditsToSearch.length} subreddits for discussions...`)
        const redditData = await fetchRedditData({
          subreddits: subredditsToSearch,
          keywords: keywords.primary,
          limit: 100,
          timeRange: {
            after: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000), // Last 2 years
          },
        })
        const rawPosts = redditData.posts
        const rawComments = redditData.comments
        send('fetching', `Found ${rawPosts.length} posts and ${rawComments.length} comments`, {
          postsFound: rawPosts.length,
          commentsFound: rawComments.length,
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
        send('filtering', `Filtering ${preFilteredPosts.length} posts for relevance to your hypothesis...`)
        const postFilterResult = await filterRelevantPosts(preFilteredPosts, hypothesis, (msg, data) => {
          send('filtering', msg, data)
        })
        const posts = postFilterResult.items

        const commentFilterResult = await filterRelevantComments(preFilteredComments, hypothesis, (msg, data) => {
          send('filtering', msg, data)
        })
        const comments = commentFilterResult.items

        const qualityLevel = calculateQualityLevel(postFilterResult.metrics.filterRate, commentFilterResult.metrics.filterRate)
        send('filtering', `Found ${posts.length} relevant posts (${postFilterResult.metrics.filterRate.toFixed(0)}% filtered for quality)`, {
          relevantPosts: posts.length,
          relevantComments: comments.length,
          qualityLevel,
          filterRate: postFilterResult.metrics.filterRate,
        })

        // Step 5: Analyze pain signals
        send('analyzing', 'Analyzing pain signals in relevant content...')
        const postSignals = analyzePosts(posts)
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
