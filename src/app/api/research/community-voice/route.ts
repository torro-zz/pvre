import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkUserCredits, deductCredit } from '@/lib/credits'
import { discoverSubreddits } from '@/lib/reddit/subreddit-discovery'
import {
  fetchRedditData,
  extractKeywords,
  RedditPost,
  RedditComment,
} from '@/lib/data-sources'
import {
  analyzePosts,
  analyzeComments,
  combinePainSignals,
  getPainSummary,
  PainSignal,
  PainSummary,
} from '@/lib/analysis/pain-detector'
import {
  extractThemes,
  generateInterviewQuestions,
  ThemeAnalysis,
} from '@/lib/analysis/theme-extractor'
import {
  calculateMarketSize,
  MarketSizingResult,
} from '@/lib/analysis/market-sizing'
import {
  analyzeTiming,
  TimingResult,
} from '@/lib/analysis/timing-analyzer'
import {
  extractSearchKeywords,
  preFilterByExcludeKeywords,
  ExtractedKeywords,
} from '@/lib/reddit/keyword-extractor'
import {
  getSubredditWeights,
  applySubredditWeights,
} from '@/lib/analysis/subreddit-weights'
import Anthropic from '@anthropic-ai/sdk'
import {
  startTokenTracking,
  endTokenTracking,
  getCurrentTracker,
} from '@/lib/anthropic'
import { trackUsage } from '@/lib/analysis/token-tracker'
import { saveResearchResult } from '@/lib/research/save-result'
import { StructuredHypothesis } from '@/types/research'

const anthropic = new Anthropic()

// Filter result with metrics for transparency
interface FilterResult<T> {
  items: T[]
  metrics: {
    before: number
    after: number
    filteredOut: number
    filterRate: number // percentage
  }
}

// Filter posts by relevance to hypothesis using Claude Haiku (strict Y/N filtering)
async function filterRelevantPosts(
  posts: RedditPost[],
  hypothesis: string
): Promise<FilterResult<RedditPost>> {
  const metrics = {
    before: posts.length,
    after: 0,
    filteredOut: 0,
    filterRate: 0,
  }

  if (posts.length === 0) {
    return { items: [], metrics }
  }

  // Batch posts into groups of 20 for efficiency
  const batchSize = 20
  const relevantPosts: RedditPost[] = []

  for (let i = 0; i < posts.length; i += batchSize) {
    const batch = posts.slice(i, i + batchSize)

    // Create summary of each post for rating
    const postSummaries = batch.map((post, idx) => {
      const body = (post.body || '').slice(0, 150)
      return `[${idx + 1}] ${post.title}${body ? '\n' + body : ''}`
    }).join('\n\n')

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
- The post is from the target audience but discussing unrelated issues

POSTS TO EVALUATE:
${postSummaries}

RESPOND WITH EXACTLY ${batch.length} CHARACTERS, ONE PER POST:
- Y = relevant
- N = not relevant

Example response for 5 posts: YNNYY

Your response (${batch.length} letters):`

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-latest',
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }],
      })

      // Track token usage
      const tracker = getCurrentTracker()
      if (tracker && response.usage) {
        trackUsage(tracker, response.usage, 'claude-3-5-haiku-latest')
      }

      const content = response.content[0]
      if (content.type === 'text') {
        // Extract only Y/N characters
        const decisions = content.text.trim().toUpperCase().replace(/[^YN]/g, '')

        batch.forEach((post, idx) => {
          if (decisions[idx] === 'Y') {
            relevantPosts.push(post)
          }
        })
      }
    } catch (error) {
      console.error('Post filtering batch failed, keeping all posts in batch:', error)
      // On error, include all posts from this batch to avoid data loss
      relevantPosts.push(...batch)
    }
  }

  metrics.after = relevantPosts.length
  metrics.filteredOut = metrics.before - metrics.after
  metrics.filterRate = metrics.before > 0 ? (metrics.filteredOut / metrics.before) * 100 : 0

  return { items: relevantPosts, metrics }
}

// Filter comments by relevance to hypothesis using Claude Haiku (strict Y/N filtering)
async function filterRelevantComments(
  comments: RedditComment[],
  hypothesis: string
): Promise<FilterResult<RedditComment>> {
  const metrics = {
    before: comments.length,
    after: 0,
    filteredOut: 0,
    filterRate: 0,
  }

  if (comments.length === 0) {
    return { items: [], metrics }
  }

  // Batch comments into groups of 25 (comments are shorter)
  const batchSize = 25
  const relevantComments: RedditComment[] = []

  for (let i = 0; i < comments.length; i += batchSize) {
    const batch = comments.slice(i, i + batchSize)

    const commentSummaries = batch.map((comment, idx) =>
      `[${idx + 1}] ${comment.body.slice(0, 300)}`
    ).join('\n\n')

    const prompt = `You are evaluating whether Reddit comments are relevant to a specific business hypothesis.

HYPOTHESIS: "${hypothesis}"

TASK: For each comment below, decide if it discusses problems, needs, or experiences DIRECTLY related to the hypothesis.

RELEVANT (Y) means:
- The comment discusses the actual problem the hypothesis solves
- The comment expresses frustration/pain about the specific topic
- The comment mentions the domain/activity the hypothesis addresses

NOT RELEVANT (N) means:
- The comment is about unrelated topics
- The comment contains pain language but about different problems
- The comment is off-topic, jokes, or generic advice

COMMENTS TO EVALUATE:
${commentSummaries}

RESPOND WITH EXACTLY ${batch.length} CHARACTERS, ONE PER COMMENT:
- Y = relevant
- N = not relevant

Example response for 5 comments: YNNYY

Your response (${batch.length} letters):`

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-latest',
        max_tokens: 100,
        messages: [{ role: 'user', content: prompt }],
      })

      // Track token usage
      const tracker = getCurrentTracker()
      if (tracker && response.usage) {
        trackUsage(tracker, response.usage, 'claude-3-5-haiku-latest')
      }

      const content = response.content[0]
      if (content.type === 'text') {
        // Extract only Y/N characters
        const decisions = content.text.trim().toUpperCase().replace(/[^YN]/g, '')

        batch.forEach((comment, idx) => {
          if (decisions[idx] === 'Y') {
            relevantComments.push(comment)
          }
        })
      }
    } catch (error) {
      console.error('Comment filtering batch failed, keeping all comments in batch:', error)
      relevantComments.push(...batch)
    }
  }

  metrics.after = relevantComments.length
  metrics.filteredOut = metrics.before - metrics.after
  metrics.filterRate = metrics.before > 0 ? (metrics.filteredOut / metrics.before) * 100 : 0

  return { items: relevantComments, metrics }
}

// Calculate data quality level based on filter rates
function calculateQualityLevel(postFilterRate: number, commentFilterRate: number): 'high' | 'medium' | 'low' {
  const avgFilterRate = (postFilterRate + commentFilterRate) / 2
  if (avgFilterRate < 30) return 'high'
  if (avgFilterRate < 60) return 'medium'
  return 'low'
}

// Filtering metrics for transparency
export interface FilteringMetrics {
  postsFound: number
  postsAnalyzed: number
  postsFiltered: number
  postFilterRate: number
  commentsFound: number
  commentsAnalyzed: number
  commentsFiltered: number
  commentFilterRate: number
  qualityLevel: 'high' | 'medium' | 'low'
}

export interface CommunityVoiceResult {
  hypothesis: string
  subreddits: {
    discovered: string[]
    analyzed: string[]
  }
  painSignals: PainSignal[]
  painSummary: PainSummary
  themeAnalysis: ThemeAnalysis
  interviewQuestions: {
    contextQuestions: string[]
    problemQuestions: string[]
    solutionQuestions: string[]
  }
  marketSizing?: MarketSizingResult
  timing?: TimingResult
  metadata: {
    postsAnalyzed: number
    commentsAnalyzed: number
    processingTimeMs: number
    timestamp: string
    // Filtering metrics for data quality transparency
    filteringMetrics?: FilteringMetrics
    // Token usage tracking for cost analysis
    tokenUsage?: {
      totalCalls: number
      totalInputTokens: number
      totalOutputTokens: number
      totalTokens: number
      totalCostUsd: number
      costBreakdown: { model: string; calls: number; cost: number }[]
    }
  }
}

// Error sources for tracking failures
type ErrorSource = 'anthropic' | 'arctic_shift' | 'database' | 'timeout' | 'unknown'

// Helper to mark job as failed with error source and auto-refund
async function markJobFailed(
  jobId: string | undefined,
  errorSource: ErrorSource,
  errorMessage: string,
  userId?: string
) {
  if (!jobId) return
  const adminClient = createAdminClient()

  try {
    // Mark job as failed
    await adminClient
      .from('research_jobs')
      .update({
        status: 'failed',
        error_source: errorSource,
        error_message: errorMessage,
      })
      .eq('id', jobId)

    // Auto-refund credit if userId is provided
    if (userId) {
      try {
        const { data: refundSuccess, error: refundError } = await adminClient.rpc('refund_credit', {
          p_user_id: userId,
          p_job_id: jobId,
        })

        if (refundError) {
          console.error('[Research] Failed to auto-refund credit:', refundError)
        } else if (refundSuccess) {
          console.log('[Research] Auto-refunded credit for failed job:', jobId)
        }
      } catch (refundErr) {
        console.error('[Research] Error during refund attempt:', refundErr)
      }
    }
  } catch (err) {
    console.error('Failed to mark job as failed:', err)
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  // Start token tracking for this request
  startTokenTracking()

  // Track jobId and userId outside try block so we can update status in catch
  let currentJobId: string | undefined
  let currentUserId: string | undefined
  let lastErrorSource: ErrorSource = 'unknown'

  try {
    // Verify authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Store userId for refund in case of error
    currentUserId = user.id

    // Parse request body
    const body = await request.json()
    const { hypothesis, jobId } = body
    currentJobId = jobId

    if (!hypothesis || typeof hypothesis !== 'string') {
      return NextResponse.json(
        { error: 'Hypothesis is required' },
        { status: 400 }
      )
    }

    // Check credits before running research
    const creditCheck = await checkUserCredits(user.id)
    if (!creditCheck.hasCredits) {
      return NextResponse.json(
        {
          error: 'insufficient_credits',
          message: 'You need at least 1 credit to run research. Please purchase a credit pack.',
          balance: creditCheck.balance
        },
        { status: 402 }
      )
    }

    // Generate job ID if not provided (for credit deduction tracking)
    const researchJobId = jobId || crypto.randomUUID()

    // Deduct credit atomically before running research
    const creditDeducted = await deductCredit(user.id, researchJobId)
    if (!creditDeducted) {
      return NextResponse.json(
        {
          error: 'credit_deduction_failed',
          message: 'Failed to deduct credit. Please try again.',
        },
        { status: 500 }
      )
    }

    // Fetch structured hypothesis from job's coverage_data if available
    let structuredHypothesis: StructuredHypothesis | undefined
    if (jobId) {
      const adminClient = createAdminClient()
      // Update status and fetch job data in one query
      // Use raw query since coverage_data may not be in generated types
      const { data: jobData } = await adminClient
        .from('research_jobs')
        .update({ status: 'processing' })
        .eq('id', jobId)
        .select('*')
        .single()

      // coverage_data is a JSON column that may contain structuredHypothesis
      const coverageData = (jobData as Record<string, unknown>)?.coverage_data as Record<string, unknown> | undefined
      if (coverageData?.structuredHypothesis) {
        structuredHypothesis = coverageData.structuredHypothesis as StructuredHypothesis
        console.log('Using structured hypothesis:', {
          audience: structuredHypothesis.audience?.slice(0, 30),
          problem: structuredHypothesis.problem?.slice(0, 30),
          hasProblemLanguage: !!structuredHypothesis.problemLanguage,
        })
      }
    }

    // Step 1: Extract hypothesis-specific keywords for better search precision
    // If structured hypothesis available, use it for better keyword extraction
    console.log('Step 1: Extracting hypothesis-specific keywords')
    lastErrorSource = 'anthropic' // Claude API

    // Build enhanced search context if structured input is available
    const searchContext = structuredHypothesis
      ? `${structuredHypothesis.audience} who ${structuredHypothesis.problem}${structuredHypothesis.problemLanguage ? ` (searches for: ${structuredHypothesis.problemLanguage})` : ''}`
      : hypothesis

    const extractedKeywords = await extractSearchKeywords(searchContext)

    // If user provided problem language, add those as primary keywords
    if (structuredHypothesis?.problemLanguage) {
      const userPhrases = structuredHypothesis.problemLanguage
        .split(/[,"]/)
        .map(p => p.trim())
        .filter(p => p.length > 3 && p.length < 50)
      extractedKeywords.primary.unshift(...userPhrases.slice(0, 3))
      console.log('Added user problem language to keywords:', userPhrases.slice(0, 3))
    }

    console.log('Extracted keywords:', {
      primary: extractedKeywords.primary,
      exclude: extractedKeywords.exclude,
    })

    // Step 2: Discover relevant subreddits using Claude
    // Use searchContext for better targeting if structured input is available
    console.log('Step 2: Discovering subreddits for:', searchContext.slice(0, 50))
    const discoveryResult = await discoverSubreddits(searchContext)
    const subredditsToSearch = discoveryResult.subreddits.slice(0, 6) // Limit to 6 subreddits

    if (subredditsToSearch.length === 0) {
      return NextResponse.json(
        { error: 'Could not identify relevant subreddits for this hypothesis' },
        { status: 400 }
      )
    }

    console.log('Discovered subreddits:', subredditsToSearch)

    // Step 2.5: Get subreddit relevance weights
    console.log('Step 2.5: Calculating subreddit relevance weights')
    const subredditWeights = await getSubredditWeights(hypothesis, subredditsToSearch)
    console.log('Subreddit weights:', Object.fromEntries(subredditWeights))

    // Step 3: Fetch posts and comments from discovered subreddits
    // Uses data-sources layer with automatic caching and fallback to backup sources
    // Use extracted primary keywords for better search precision
    console.log('Step 3: Fetching Reddit data (with caching + fallback)')
    lastErrorSource = 'arctic_shift' // Reddit data API
    const searchKeywords = extractedKeywords.primary.length > 0
      ? extractedKeywords.primary
      : extractKeywords(hypothesis) // Fallback to basic extraction
    const redditData = await fetchRedditData({
      subreddits: subredditsToSearch,
      keywords: searchKeywords,
      limit: 100,
      timeRange: {
        after: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000), // Last 2 years
      },
    })

    let rawPosts = redditData.posts
    let rawComments = redditData.comments

    console.log(`Fetched ${rawPosts.length} posts and ${rawComments.length} comments from ${redditData.metadata.source}`)

    // Check for data source warnings
    if (redditData.metadata.warning) {
      console.warn('Data source warning:', redditData.metadata.warning)
    }

    // Step 3.5: Pre-filter posts using exclude keywords (cheap local operation)
    if (extractedKeywords.exclude.length > 0) {
      const originalPostCount = rawPosts.length
      const originalCommentCount = rawComments.length
      rawPosts = preFilterByExcludeKeywords(rawPosts, extractedKeywords.exclude)
      rawComments = preFilterByExcludeKeywords(rawComments, extractedKeywords.exclude)
      console.log(`Pre-filtered: ${originalPostCount - rawPosts.length} posts, ${originalCommentCount - rawComments.length} comments removed by exclude keywords`)
    }

    // Step 4: Filter posts and comments for relevance using Claude (strict Y/N filtering)
    console.log('Step 4: Filtering for relevance to hypothesis (strict Y/N)')
    lastErrorSource = 'anthropic' // Claude API for filtering
    const [postFilterResult, commentFilterResult] = await Promise.all([
      filterRelevantPosts(rawPosts, hypothesis),
      filterRelevantComments(rawComments, hypothesis),
    ])

    const posts = postFilterResult.items
    const comments = commentFilterResult.items

    console.log(`Filtered to ${posts.length} relevant posts (from ${rawPosts.length}, ${postFilterResult.metrics.filterRate.toFixed(1)}% filtered)`)
    console.log(`Filtered to ${comments.length} relevant comments (from ${rawComments.length}, ${commentFilterResult.metrics.filterRate.toFixed(1)}% filtered)`)

    // Build filtering metrics for transparency
    const filteringMetrics: FilteringMetrics = {
      postsFound: postFilterResult.metrics.before,
      postsAnalyzed: postFilterResult.metrics.after,
      postsFiltered: postFilterResult.metrics.filteredOut,
      postFilterRate: postFilterResult.metrics.filterRate,
      commentsFound: commentFilterResult.metrics.before,
      commentsAnalyzed: commentFilterResult.metrics.after,
      commentsFiltered: commentFilterResult.metrics.filteredOut,
      commentFilterRate: commentFilterResult.metrics.filterRate,
      qualityLevel: calculateQualityLevel(postFilterResult.metrics.filterRate, commentFilterResult.metrics.filterRate),
    }

    console.log(`Data quality level: ${filteringMetrics.qualityLevel}`)

    // Step 5: Analyze posts and comments for pain signals
    console.log('Step 5: Analyzing pain signals')
    const postSignals = analyzePosts(posts)
    const commentSignals = analyzeComments(comments)
    const allPainSignals = combinePainSignals(postSignals, commentSignals)

    console.log(`Found ${allPainSignals.length} pain signals`)

    // Step 5.5: Apply subreddit weights to pain scores
    applySubredditWeights(allPainSignals, subredditWeights)
    console.log('Applied subreddit weights to pain signals')

    // Step 6: Get pain summary statistics
    const painSummary = getPainSummary(allPainSignals)

    // Step 7: Extract themes using Claude
    console.log('Step 7: Extracting themes with Claude')
    const themeAnalysis = await extractThemes(allPainSignals, hypothesis)

    // Step 8: Generate interview questions
    console.log('Step 8: Generating interview questions')
    const interviewQuestions = await generateInterviewQuestions(themeAnalysis, hypothesis)

    // Step 9: Run market sizing analysis
    console.log('Step 9: Running market sizing analysis')
    let marketSizing: MarketSizingResult | undefined
    try {
      marketSizing = await calculateMarketSize({
        hypothesis,
        // Use defaults for geography and pricing - can be customized later
      })
      console.log(`Market sizing complete - Score: ${marketSizing.score}/10`)
    } catch (marketError) {
      console.error('Market sizing failed (non-blocking):', marketError)
      // Continue without market sizing - it's optional
    }

    // Step 10: Run timing analysis
    console.log('Step 10: Running timing analysis')
    let timing: TimingResult | undefined
    try {
      timing = await analyzeTiming({
        hypothesis,
      })
      console.log(`Timing analysis complete - Score: ${timing.score}/10`)
    } catch (timingError) {
      console.error('Timing analysis failed (non-blocking):', timingError)
      // Continue without timing - it's optional
    }

    const processingTimeMs = Date.now() - startTime

    // End token tracking and get usage summary
    const tokenUsage = endTokenTracking()

    // Build result
    const result: CommunityVoiceResult = {
      hypothesis,
      subreddits: {
        discovered: discoveryResult.subreddits,
        analyzed: subredditsToSearch,
      },
      painSignals: allPainSignals.slice(0, 50), // Return top 50 signals
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
        filteringMetrics,
        tokenUsage: tokenUsage || undefined,
      },
    }

    // If jobId is provided, save results to database and update job status
    if (jobId) {
      const adminClient = createAdminClient()
      lastErrorSource = 'database' // Supabase save
      try {
        // Save results using shared utility
        await saveResearchResult(jobId, 'community_voice', result)

        // Mark job as completed and update step_status for all completed modules
        // This allows competitor-intelligence to see that timing_analysis is complete
        await adminClient
          .from('research_jobs')
          .update({
            status: 'completed',
            step_status: {
              pain_analysis: 'completed',
              market_sizing: 'completed',
              timing_analysis: 'completed',
              competitor_analysis: 'pending'
            }
          })
          .eq('id', jobId)
      } catch (dbError) {
        console.error('Failed to save results to database:', dbError)
        // Mark job as failed if we can't save results
        await adminClient
          .from('research_jobs')
          .update({
            status: 'failed',
            error_source: 'database',
            error_message: 'Failed to save results'
          })
          .eq('id', jobId)
      }
    }

    console.log(`Research completed in ${processingTimeMs}ms`)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Community voice research failed:', error)
    console.error('Error source:', lastErrorSource)

    // Mark job as failed in backend with error source and auto-refund credit
    await markJobFailed(
      currentJobId,
      lastErrorSource,
      error instanceof Error ? error.message : 'Research failed',
      currentUserId  // Pass userId for auto-refund
    )

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Research failed' },
      { status: 500 }
    )
  }
}

// GET endpoint to check status or fetch cached results
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const jobId = searchParams.get('jobId')

    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId is required' },
        { status: 400 }
      )
    }

    // Fetch results from database
    const { data: results, error: fetchError } = await supabase
      .from('research_results')
      .select('*')
      .eq('job_id', jobId)
      .eq('module_name', 'community_voice')
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Results not found' },
          { status: 404 }
        )
      }
      throw fetchError
    }

    return NextResponse.json(results.data)
  } catch (error) {
    console.error('Failed to fetch results:', error)
    return NextResponse.json(
      { error: 'Failed to fetch results' },
      { status: 500 }
    )
  }
}
