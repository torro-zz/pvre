import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { discoverSubreddits } from '@/lib/reddit/subreddit-discovery'
import {
  searchPosts,
  searchComments,
  fetchPostsFromSubreddits,
  fetchCommentsFromSubreddits,
} from '@/lib/arctic-shift/client'
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
    const posts = await fetchPostsFromSubreddits(subredditsToSearch, {
      limit: 50,
    })

    console.log(`Fetched ${posts.length} posts`)

    // Step 3: Fetch comments from discovered subreddits
    console.log('Step 3: Fetching comments from subreddits')
    const comments = await fetchCommentsFromSubreddits(subredditsToSearch, {
      limit: 30,
    })

    console.log(`Fetched ${comments.length} comments`)

    // Step 4: Analyze posts and comments for pain signals
    console.log('Step 4: Analyzing pain signals')
    const postSignals = analyzePosts(posts)
    const commentSignals = analyzeComments(comments)
    const allPainSignals = combinePainSignals(postSignals, commentSignals)

    console.log(`Found ${allPainSignals.length} pain signals`)

    // Step 5: Get pain summary statistics
    const painSummary = getPainSummary(allPainSignals)

    // Step 6: Extract themes using Claude
    console.log('Step 5: Extracting themes with Claude')
    const themeAnalysis = await extractThemes(allPainSignals, hypothesis)

    // Step 7: Generate interview questions
    console.log('Step 6: Generating interview questions')
    const interviewQuestions = await generateInterviewQuestions(themeAnalysis, hypothesis)

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
