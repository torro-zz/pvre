import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkUserCredits, deductCredit } from '@/lib/credits'
import { discoverSubreddits } from '@/lib/reddit/subreddit-discovery'
import {
  fetchMultiSourceData,
  extractKeywords,
  shouldIncludeHN,
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
  calculateThemeResonance,
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
import {
  startTokenTracking,
  endTokenTracking,
} from '@/lib/anthropic'
import { saveResearchResult } from '@/lib/research/save-result'
import {
  filterRelevantPosts,
  filterRelevantComments,
  RelevanceDecision,
} from '@/lib/research/relevance-filter'
import { StructuredHypothesis, TargetGeography } from '@/types/research'
import { AppDetails } from '@/lib/data-sources/types'
import { googlePlayAdapter } from '@/lib/data-sources/adapters/google-play-adapter'
import { appStoreAdapter } from '@/lib/data-sources/adapters/app-store-adapter'

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
  // Signal tiering for multi-domain hypotheses
  coreSignals: number       // CORE: intersection match (problem + context)
  relatedSignals: number    // RELATED: single-domain match (broader context)
  // Title-only posts (recovered from [removed] content)
  titleOnlyPosts: number    // Posts analyzed by title only (body was removed)
  // P0 FIX: Stage 2 (problem-specific) filter metrics
  stage2FilterRate?: number  // % of Stage 1 passes that failed Stage 2
  narrowProblemWarning?: boolean  // True if >50% of Stage 1 passes failed Stage 2
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
    // Data sources used (e.g., ['Reddit', 'Hacker News'])
    dataSources?: string[]
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
    // Individual Y/N decisions for quality audit
    relevanceDecisions?: {
      posts: RelevanceDecision[]
      comments: RelevanceDecision[]
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

    // Fetch structured hypothesis, user-selected subreddits, geography, and data sources from job's coverage_data if available
    let structuredHypothesis: StructuredHypothesis | undefined
    let userSelectedSubreddits: string[] | undefined
    let targetGeography: TargetGeography | undefined
    let mscTarget: number | undefined
    let targetPrice: number | undefined
    let selectedDataSources: string[] | undefined
    let appData: AppDetails | undefined
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

      // coverage_data is a JSON column that may contain structuredHypothesis and user subreddit selections
      const coverageData = (jobData as Record<string, unknown>)?.coverage_data as Record<string, unknown> | undefined
      if (coverageData?.structuredHypothesis) {
        structuredHypothesis = coverageData.structuredHypothesis as StructuredHypothesis
        console.log('Using structured hypothesis:', {
          audience: structuredHypothesis.audience?.slice(0, 30),
          problem: structuredHypothesis.problem?.slice(0, 30),
          hasProblemLanguage: !!structuredHypothesis.problemLanguage,
        })
      }

      // Check for user-selected subreddits from coverage preview
      userSelectedSubreddits = coverageData?.userSelectedSubreddits as string[] | undefined
      if (userSelectedSubreddits && userSelectedSubreddits.length > 0) {
        console.log('Using user-selected subreddits:', userSelectedSubreddits)
      }

      // Check for target geography from coverage preview (for market sizing scoping)
      targetGeography = coverageData?.targetGeography as TargetGeography | undefined
      if (targetGeography) {
        console.log('Using target geography:', targetGeography)
      }

      // Check for MSC target and target price from coverage preview (for market sizing)
      mscTarget = coverageData?.mscTarget as number | undefined
      targetPrice = coverageData?.targetPrice as number | undefined
      if (mscTarget || targetPrice) {
        console.log('Using market sizing inputs:', { mscTarget, targetPrice })
      }

      // Check for selected data sources from coverage preview
      selectedDataSources = coverageData?.selectedDataSources as string[] | undefined
      if (selectedDataSources && selectedDataSources.length > 0) {
        console.log('Using selected data sources:', selectedDataSources)
      }

      // Check for app data from app-centric analysis mode
      appData = coverageData?.appData as AppDetails | undefined
      if (appData) {
        console.log('App-centric mode detected:', {
          appId: appData.appId,
          store: appData.store,
          name: appData.name,
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

    // If user provided exclude topics, add those to exclude keywords
    if (structuredHypothesis?.excludeTopics) {
      const userExcludes = structuredHypothesis.excludeTopics
        .split(',')
        .map(p => p.trim().toLowerCase())
        .filter(p => p.length > 2 && p.length < 50)
      extractedKeywords.exclude.push(...userExcludes)
      console.log('Added user exclude topics:', userExcludes)
    }

    console.log('Extracted keywords:', {
      primary: extractedKeywords.primary,
      exclude: extractedKeywords.exclude,
    })

    // Step 2: Discover relevant subreddits using Claude
    // Use user-selected subreddits if available (from coverage preview), otherwise discover
    let subredditsToSearch: string[]
    let discoveryResult: { subreddits: string[] }

    if (userSelectedSubreddits && userSelectedSubreddits.length > 0) {
      // User has selected specific subreddits from coverage preview
      console.log('Step 2: Using user-selected subreddits:', userSelectedSubreddits)
      subredditsToSearch = userSelectedSubreddits.slice(0, 12) // Increased to 12 subreddits for more data
      discoveryResult = { subreddits: subredditsToSearch }
    } else {
      // Discover using Claude
      console.log('Step 2: Discovering subreddits for:', searchContext.slice(0, 50))
      discoveryResult = await discoverSubreddits(searchContext)
      subredditsToSearch = discoveryResult.subreddits.slice(0, 10) // Increased to 10 subreddits for more data
    }

    if (subredditsToSearch.length === 0) {
      return NextResponse.json(
        { error: 'Could not identify relevant subreddits for this hypothesis' },
        { status: 400 }
      )
    }

    console.log('Subreddits to search:', subredditsToSearch)

    // Step 2.5: Get subreddit relevance weights
    console.log('Step 2.5: Calculating subreddit relevance weights')
    const subredditWeights = await getSubredditWeights(hypothesis, subredditsToSearch)
    console.log('Subreddit weights:', Object.fromEntries(subredditWeights))

    // Step 3: Fetch posts and comments from discovered subreddits
    // Uses data-sources layer with automatic caching and fallback to backup sources
    // Data source inclusion is controlled by user selection (if available) or auto-detection
    // Use extracted primary keywords for better search precision
    const includesHN = selectedDataSources
      ? selectedDataSources.includes('Hacker News')
      : shouldIncludeHN(hypothesis) // Fallback to auto-detection if no explicit selection
    const includesGooglePlay = selectedDataSources?.includes('Google Play') ?? false
    const includesAppStore = selectedDataSources?.includes('App Store') ?? false

    const sourcesList = ['Reddit', includesHN && 'Hacker News', includesGooglePlay && 'Google Play', includesAppStore && 'App Store'].filter(Boolean).join(' + ')
    console.log(`Step 3: Fetching data from ${sourcesList}`)
    lastErrorSource = 'arctic_shift' // Reddit data API (primary source)
    const searchKeywords = extractedKeywords.primary.length > 0
      ? extractedKeywords.primary
      : extractKeywords(hypothesis) // Fallback to basic extraction
    const multiSourceData = await fetchMultiSourceData({
      subreddits: subredditsToSearch,
      keywords: searchKeywords,
      limit: 100, // 100/subreddit × 10-12 subreddits = 1000-1200 posts max (API caps at 100/request)
      timeRange: {
        after: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000), // Last 2 years
      },
    }, hypothesis, includesHN, includesGooglePlay, includesAppStore)

    let rawPosts = multiSourceData.posts
    let rawComments = multiSourceData.comments

    console.log(`Fetched ${rawPosts.length} posts and ${rawComments.length} comments from ${multiSourceData.sources.join(' + ') || multiSourceData.metadata.source}`)

    // Step 3b: For app-centric mode, fetch reviews directly for the specific app
    if (appData && appData.appId) {
      console.log(`Step 3b: Fetching reviews for specific app: ${appData.name} (${appData.appId})`)
      try {
        let appReviews: RedditPost[] = []

        if (appData.store === 'google_play') {
          appReviews = await googlePlayAdapter.getReviewsForAppId(appData.appId, { limit: 100 })
          if (appReviews.length > 0) {
            rawPosts = [...rawPosts, ...appReviews]
            console.log(`Added ${appReviews.length} Google Play reviews for ${appData.name}`)
          }
        } else if (appData.store === 'app_store') {
          appReviews = await appStoreAdapter.getReviewsForAppId(appData.appId, { limit: 100 })
          if (appReviews.length > 0) {
            rawPosts = [...rawPosts, ...appReviews]
            console.log(`Added ${appReviews.length} App Store reviews for ${appData.name}`)
          }
        }

        if (appReviews.length === 0) {
          console.warn(`No reviews found for app ${appData.name} (${appData.appId})`)
        }
      } catch (appReviewError) {
        console.error(`Failed to fetch app reviews for ${appData.name}:`, appReviewError)
        // Continue without app reviews - don't fail the entire request
      }
    }

    // Check for data source warnings
    if (multiSourceData.metadata.warning) {
      console.warn('Data source warning:', multiSourceData.metadata.warning)
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
      filterRelevantPosts(rawPosts, hypothesis, structuredHypothesis),
      filterRelevantComments(rawComments, hypothesis, structuredHypothesis),
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
      // Signal tiering for multi-domain hypotheses
      coreSignals: postFilterResult.metrics.coreSignals,
      relatedSignals: postFilterResult.metrics.relatedSignals,
      // Title-only posts (recovered from [removed] content)
      titleOnlyPosts: postFilterResult.metrics.titleOnlyPosts,
      // P0 FIX: Include Stage 2 filter metrics
      stage2FilterRate: postFilterResult.metrics.stage2FilterRate,
      narrowProblemWarning: postFilterResult.metrics.narrowProblemWarning,
    }

    console.log(`Data quality level: ${filteringMetrics.qualityLevel}`)
    if (filteringMetrics.narrowProblemWarning) {
      console.log(`⚠️ NARROW PROBLEM WARNING: ${filteringMetrics.stage2FilterRate?.toFixed(1)}% of domain-relevant posts failed problem-specific filter`)
    }
    console.log(`Signal tiers: ${postFilterResult.metrics.coreSignals} CORE, ${postFilterResult.metrics.relatedSignals} RELATED`)

    // Step 5: Analyze posts and comments for pain signals with tier awareness
    console.log('Step 5: Analyzing pain signals')
    const corePostSignals = analyzePosts(postFilterResult.coreItems).map(s => ({ ...s, tier: 'CORE' as const }))
    const relatedPostSignals = analyzePosts(postFilterResult.relatedItems).map(s => ({ ...s, tier: 'RELATED' as const }))
    const postSignals = [...corePostSignals, ...relatedPostSignals]
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

    // Step 7b: Calculate resonance for each theme
    themeAnalysis.themes = calculateThemeResonance(themeAnalysis.themes, allPainSignals)

    // Step 8: Generate interview questions
    console.log('Step 8: Generating interview questions')
    const interviewQuestions = await generateInterviewQuestions(themeAnalysis, hypothesis)

    // Step 9: Run market sizing analysis
    console.log('Step 9: Running market sizing analysis')
    let marketSizing: MarketSizingResult | undefined
    try {
      marketSizing = await calculateMarketSize({
        hypothesis,
        geography: targetGeography?.location || 'Global',
        geographyScope: targetGeography?.scope || 'global',
        mscTarget,
        targetPrice,
      })
      console.log(`Market sizing complete - Score: ${marketSizing.score}/10, Geography: ${targetGeography?.location || 'Global'}, MSC: $${mscTarget || 1000000}, Price: $${targetPrice || 29}/mo`)
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
        dataSources: multiSourceData.sources.length > 0 ? multiSourceData.sources : ['Reddit'],
        filteringMetrics,
        tokenUsage: tokenUsage || undefined,
        // Include all Y/N decisions for quality audit
        relevanceDecisions: {
          posts: postFilterResult.decisions,
          comments: commentFilterResult.decisions,
        },
      },
    }

    // If jobId is provided, save results to database and update job status
    if (jobId) {
      const adminClient = createAdminClient()
      lastErrorSource = 'database' // Supabase save
      try {
        // Create a trimmed version for database save - limit relevanceDecisions to avoid JSON size issues
        // Full decisions are still available in the immediate response
        const resultForDb = {
          ...result,
          metadata: {
            ...result.metadata,
            relevanceDecisions: {
              posts: result.metadata.relevanceDecisions?.posts?.slice(0, 100) || [],
              comments: result.metadata.relevanceDecisions?.comments?.slice(0, 100) || [],
              _note: 'Limited to 100 per type for DB storage. Full data available in immediate response.',
            },
          },
        }
        // Save trimmed results using shared utility
        await saveResearchResult(jobId, 'community_voice', resultForDb)

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
