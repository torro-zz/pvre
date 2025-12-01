import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkUserCredits, deductCredit } from '@/lib/credits'
import { discoverSubreddits } from '@/lib/reddit/subreddit-discovery'
import {
  searchPosts,
  searchComments,
  fetchPostsFromSubreddits,
  fetchCommentsFromSubreddits,
} from '@/lib/arctic-shift/client'
import { RedditPost, RedditComment } from '@/lib/arctic-shift/types'
import {
  analyzePosts,
  analyzeComments,
  combinePainSignals,
  getPainSummary,
  PainSignal,
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
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

// Filter posts by relevance to hypothesis using Claude Haiku
async function filterRelevantPosts(
  posts: RedditPost[],
  hypothesis: string
): Promise<RedditPost[]> {
  if (posts.length === 0) return []

  // Batch posts into groups of 20 for efficiency
  const batchSize = 20
  const relevantPosts: RedditPost[] = []

  for (let i = 0; i < posts.length; i += batchSize) {
    const batch = posts.slice(i, i + batchSize)

    // Create summary of each post for rating
    const postSummaries = batch.map((post, idx) => ({
      idx,
      title: post.title.slice(0, 200),
      text: (post.selftext || '').slice(0, 300),
    }))

    const prompt = `You are filtering Reddit posts for relevance to a business hypothesis.

HYPOTHESIS: "${hypothesis}"

Rate each post 1-5 for relevance:
5 = Directly discusses the problem/solution space
4 = Related to target audience's pain points
3 = Tangentially related, might contain useful signals
2 = Mostly unrelated but same general topic area
1 = Completely irrelevant (wrong topic, spam, off-topic)

POSTS TO RATE:
${postSummaries.map(p => `[${p.idx}] Title: ${p.title}\nText: ${p.text}`).join('\n\n')}

Return ONLY a JSON array of objects with idx and score, like:
[{"idx": 0, "score": 4}, {"idx": 1, "score": 2}, ...]

Be strict - only score 3+ for posts that would genuinely help validate this specific hypothesis.`

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-latest',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      })

      const content = response.content[0]
      if (content.type === 'text') {
        // Parse JSON from response
        const jsonMatch = content.text.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          const ratings: Array<{ idx: number; score: number }> = JSON.parse(jsonMatch[0])
          // Keep posts rated 3 or higher
          for (const rating of ratings) {
            if (rating.score >= 3 && batch[rating.idx]) {
              relevantPosts.push(batch[rating.idx])
            }
          }
        }
      }
    } catch (error) {
      console.error('Post filtering batch failed, keeping all posts in batch:', error)
      // On error, include all posts from this batch to avoid data loss
      relevantPosts.push(...batch)
    }
  }

  return relevantPosts
}

// Filter comments by relevance to hypothesis using Claude Haiku
async function filterRelevantComments(
  comments: RedditComment[],
  hypothesis: string
): Promise<RedditComment[]> {
  if (comments.length === 0) return []

  // Batch comments into groups of 25 (comments are shorter)
  const batchSize = 25
  const relevantComments: RedditComment[] = []

  for (let i = 0; i < comments.length; i += batchSize) {
    const batch = comments.slice(i, i + batchSize)

    const commentSummaries = batch.map((comment, idx) => ({
      idx,
      text: comment.body.slice(0, 400),
    }))

    const prompt = `You are filtering Reddit comments for relevance to a business hypothesis.

HYPOTHESIS: "${hypothesis}"

Rate each comment 1-5 for relevance:
5 = Directly discusses the problem, expresses pain points, or mentions solutions
4 = Related frustrations or needs from target audience
3 = Tangentially related, might contain useful signals
2 = Mostly unrelated
1 = Completely irrelevant (off-topic, jokes, spam)

COMMENTS TO RATE:
${commentSummaries.map(c => `[${c.idx}] ${c.text}`).join('\n\n')}

Return ONLY a JSON array of objects with idx and score, like:
[{"idx": 0, "score": 4}, {"idx": 1, "score": 2}, ...]

Be strict - only score 3+ for comments that would genuinely help validate this specific hypothesis.`

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-haiku-latest',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      })

      const content = response.content[0]
      if (content.type === 'text') {
        const jsonMatch = content.text.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          const ratings: Array<{ idx: number; score: number }> = JSON.parse(jsonMatch[0])
          for (const rating of ratings) {
            if (rating.score >= 3 && batch[rating.idx]) {
              relevantComments.push(batch[rating.idx])
            }
          }
        }
      }
    } catch (error) {
      console.error('Comment filtering batch failed, keeping all comments in batch:', error)
      relevantComments.push(...batch)
    }
  }

  return relevantComments
}

export interface CommunityVoiceResult {
  hypothesis: string
  subreddits: {
    discovered: string[]
    analyzed: string[]
  }
  painSignals: PainSignal[]
  painSummary: {
    totalSignals: number
    averageScore: number
    highIntensityCount: number
    mediumIntensityCount: number
    lowIntensityCount: number
    solutionSeekingCount: number
    willingnessToPayCount: number
    topSubreddits: { name: string; count: number }[]
  }
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
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

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

    // Parse request body
    const body = await request.json()
    const { hypothesis, jobId } = body

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

    // Step 1: Discover relevant subreddits using Claude
    console.log('Step 1: Discovering subreddits for:', hypothesis)
    const discoveryResult = await discoverSubreddits(hypothesis)
    const subredditsToSearch = discoveryResult.subreddits.slice(0, 6) // Limit to 6 subreddits

    if (subredditsToSearch.length === 0) {
      return NextResponse.json(
        { error: 'Could not identify relevant subreddits for this hypothesis' },
        { status: 400 }
      )
    }

    console.log('Discovered subreddits:', subredditsToSearch)

    // Step 2: Fetch posts from discovered subreddits
    console.log('Step 2: Fetching posts from subreddits')
    const rawPosts = await fetchPostsFromSubreddits(subredditsToSearch, {
      limit: 50,
    })

    console.log(`Fetched ${rawPosts.length} posts`)

    // Step 3: Fetch comments from discovered subreddits
    console.log('Step 3: Fetching comments from subreddits')
    const rawComments = await fetchCommentsFromSubreddits(subredditsToSearch, {
      limit: 30,
    })

    console.log(`Fetched ${rawComments.length} comments`)

    // Step 4: Filter posts and comments for relevance using Claude
    console.log('Step 4: Filtering for relevance to hypothesis')
    const [posts, comments] = await Promise.all([
      filterRelevantPosts(rawPosts, hypothesis),
      filterRelevantComments(rawComments, hypothesis),
    ])

    console.log(`Filtered to ${posts.length} relevant posts (from ${rawPosts.length})`)
    console.log(`Filtered to ${comments.length} relevant comments (from ${rawComments.length})`)

    // Step 5: Analyze posts and comments for pain signals
    console.log('Step 5: Analyzing pain signals')
    const postSignals = analyzePosts(posts)
    const commentSignals = analyzeComments(comments)
    const allPainSignals = combinePainSignals(postSignals, commentSignals)

    console.log(`Found ${allPainSignals.length} pain signals`)

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
      },
    }

    // If jobId is provided, save results to database
    if (jobId) {
      try {
        await supabase
          .from('research_results')
          .insert({
            job_id: jobId,
            module_name: 'community_voice',
            data: result,
          })
      } catch (dbError) {
        console.error('Failed to save results to database:', dbError)
        // Continue - we still want to return the results
      }
    }

    console.log(`Research completed in ${processingTimeMs}ms`)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Community voice research failed:', error)
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
