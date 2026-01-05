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
  SearchResult,
} from '@/lib/data-sources'
import {
  analyzePosts,
  analyzeComments,
  combinePainSignals,
  getPainSummary,
  filterPraiseSignals,
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
  getCurrentTracker,
} from '@/lib/anthropic'
import { recordApiCostsBatch, RecordCostParams } from '@/lib/api-costs'
import { saveResearchResult } from '@/lib/research/save-result'
import {
  filterRelevantPosts,
  filterRelevantComments,
  RelevanceDecision,
} from '@/lib/research/relevance-filter'
import {
  filterSignals,
  USE_TWO_STAGE_FILTER,
  USE_TIERED_FILTER,
  filterSignalsTiered,
  getSignalsForAnalysis,
  type PipelineResult,
  type TieredSignals,
} from '@/lib/filter'
import {
  bridgeRedditPostsToNormalized,
  mapVerifiedToRedditPosts,
} from '@/lib/adapters'
import {
  clusterSignals,
  formatClustersForPrompt,
  type SignalCluster,
  type ClusteringResult,
} from '@/lib/embeddings'
import { StructuredHypothesis, TargetGeography } from '@/types/research'
import { AppDetails } from '@/lib/data-sources/types'
import { googlePlayAdapter } from '@/lib/data-sources/adapters/google-play-adapter'
import { appStoreAdapter } from '@/lib/data-sources/adapters/app-store-adapter'
import { analyzeCompetitors, type CompetitorIntelligenceResult } from '@/lib/research/competitor-analyzer'
import { findKnownCompetitors, hasKnownCompetitors } from '@/lib/research/known-competitors'

// Calculate data quality level based on filter rates
function calculateQualityLevel(postFilterRate: number, commentFilterRate: number): 'high' | 'medium' | 'low' {
  const avgFilterRate = (postFilterRate + commentFilterRate) / 2
  if (avgFilterRate < 30) return 'high'
  if (avgFilterRate < 60) return 'medium'
  return 'low'
}

// Expansion attempt for adaptive fetching
export interface ExpansionAttempt {
  type: 'time_range' | 'fetch_limit' | 'communities'
  value: string
  success: boolean
  signalsGained: number
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
  // Pre-filter ranking (first-person language + engagement)
  preFilterSkipped?: number  // Low-quality posts skipped before AI processing
  // P0 FIX: Stage 2 (problem-specific) filter metrics
  stage2FilterRate?: number  // % of Stage 1 passes that failed Stage 2
  narrowProblemWarning?: boolean  // True if >50% of Stage 1 passes failed Stage 2
  // Adaptive fetching diagnostics
  expansionAttempts?: ExpansionAttempt[]  // What we tried to get more data
  timeRangeMonths?: number               // Final time range used
  communitiesSearched?: string[]         // All communities searched
  // Two-stage filter metrics (when enabled)
  twoStageMetrics?: {
    stage1Candidates: number    // After embedding filter
    stage2Candidates: number    // After cap (always ≤50)
    stage3Verified: number      // After Haiku verification
    verificationRate: number    // stage3 / stage2
    processingTimeMs: number
  }
  // Tiered filter metrics (when enabled)
  tieredMetrics?: {
    core: number       // Score >= 0.45
    strong: number     // Score >= 0.35
    related: number    // Score >= 0.25
    adjacent: number   // Score >= 0.15
    total: number      // Total signals
    processingTimeMs: number
  }
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
  // Clustered signals for App Gap mode (Jan 2026)
  clusters?: SignalCluster[]
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

// Adaptive fetching thresholds
const MIN_CORE_SIGNALS = 15  // Minimum core signals for reliable analysis
const MIN_TOTAL_SIGNALS = 30 // Minimum total signals (core + related)

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
    let selectedApps: AppDetails[] | undefined
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

      // Check for selected apps from coverage preview (user-selected apps for analysis)
      selectedApps = coverageData?.selectedApps as AppDetails[] | undefined
      if (selectedApps && selectedApps.length > 0) {
        console.log('Using selected apps:', selectedApps.map(a => `${a.name} (${a.store})`))
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

      // Validation: If mode is 'app-analysis' but appData is missing, return error
      // This catches edge cases where job was created with inconsistent state
      const searchMode = coverageData?.mode as 'hypothesis' | 'app-analysis' | undefined
      if (searchMode === 'app-analysis' && (!appData || !appData.appId)) {
        console.error('[CommunityVoice] App analysis mode but missing appData:', { searchMode, appData })
        return NextResponse.json(
          { error: 'App data missing. The app may have been removed from the store.' },
          { status: 400 }
        )
      }

      // Log the search mode for debugging
      console.log(`[CommunityVoice] Search mode: ${searchMode || 'hypothesis (inferred)'}`)

    }

    // Extract sample size and subreddit velocities from coverage data for adaptive fetching
    // Default to 300 (doubled from 150) for better recall after embedding filter added
    // Dec 2025: Increased default to cast wider net; embedding filter handles cost control
    let sampleSizePerSource = 300
    let subredditVelocities: Map<string, number> | undefined

    if (jobId) {
      const adminClient = createAdminClient()
      const { data: jobData } = await adminClient
        .from('research_jobs')
        .select('*')
        .eq('id', jobId)
        .single()

      const coverageData = (jobData as Record<string, unknown>)?.coverage_data as Record<string, unknown> | undefined
      if (coverageData) {
        // Get sample size (user-selected depth: Quick=150, Standard=300, Deep=450)
        if (coverageData.sampleSizePerSource) {
          sampleSizePerSource = coverageData.sampleSizePerSource as number
          console.log('Using sample size per source:', sampleSizePerSource)
        }

        // Build subreddit velocities map for adaptive time-stratified fetching
        const subredditsWithVelocity = coverageData.subreddits as Array<{ name: string; postsPerDay?: number }> | undefined
        if (subredditsWithVelocity) {
          subredditVelocities = new Map<string, number>()
          for (const sub of subredditsWithVelocity) {
            if (sub.postsPerDay !== undefined) {
              subredditVelocities.set(sub.name, sub.postsPerDay)
            }
          }
          if (subredditVelocities.size > 0) {
            console.log('Using subreddit velocities for adaptive fetching:', Object.fromEntries(subredditVelocities))
          }
        }
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
    // Jan 2026: SKIP REDDIT entirely in App Gap mode - focus on app store reviews
    let subredditsToSearch: string[]
    let discoveryResult: { subreddits: string[] }

    if (appData && appData.appId) {
      // APP GAP MODE: Skip Reddit entirely - use only app store reviews
      console.log('Step 2: App Gap mode - skipping Reddit discovery (using app store reviews only)')
      subredditsToSearch = []
      discoveryResult = { subreddits: [] }
    } else if (userSelectedSubreddits && userSelectedSubreddits.length > 0) {
      // User has selected specific subreddits from coverage preview
      console.log('Step 2: Using user-selected subreddits:', userSelectedSubreddits)
      subredditsToSearch = userSelectedSubreddits.slice(0, 15) // Dec 2025: Increased from 12 to 15 for better recall
      discoveryResult = { subreddits: subredditsToSearch }
    } else {
      // Discover using Claude
      console.log('Step 2: Discovering subreddits for:', searchContext.slice(0, 50))
      discoveryResult = await discoverSubreddits(searchContext)
      subredditsToSearch = discoveryResult.subreddits.slice(0, 15) // Dec 2025: Increased from 10 to 15 for better recall
    }

    // Only require subreddits for Hypothesis mode (not App Gap mode)
    if (subredditsToSearch.length === 0 && !appData?.appId) {
      return NextResponse.json(
        { error: 'Could not identify relevant subreddits for this hypothesis' },
        { status: 400 }
      )
    }

    console.log('Subreddits to search:', subredditsToSearch)

    // Step 2.5: Get subreddit relevance weights (skip in App Gap mode)
    let subredditWeights = new Map<string, number>()
    if (subredditsToSearch.length > 0) {
      console.log('Step 2.5: Calculating subreddit relevance weights')
      subredditWeights = await getSubredditWeights(hypothesis, subredditsToSearch)
      console.log('Subreddit weights:', Object.fromEntries(subredditWeights))
    } else {
      console.log('Step 2.5: Skipping subreddit weights (App Gap mode)')
    }

    // Step 3: Fetch posts and comments from discovered subreddits
    // Uses data-sources layer with automatic caching and fallback to backup sources
    // Data source inclusion is controlled by user selection (if available) or auto-detection
    // Use extracted primary keywords for better search precision
    // Jan 2026: Skip Reddit entirely in App Gap mode
    let rawPosts: RedditPost[] = []
    let rawComments: RedditComment[] = []
    let multiSourceData: SearchResult & { sources: string[] } = {
      posts: [],
      comments: [],
      sources: [],
      metadata: { source: 'none', fetchedAt: new Date(), isStale: false }
    }
    // Keywords for search - used in expansion logic later
    const searchKeywords = extractedKeywords.primary.length > 0
      ? extractedKeywords.primary
      : extractKeywords(hypothesis) // Fallback to basic extraction

    if (subredditsToSearch.length > 0) {
      // HYPOTHESIS MODE: Fetch from Reddit + other sources
      const includesHN = selectedDataSources
        ? selectedDataSources.includes('Hacker News')
        : shouldIncludeHN(hypothesis) // Fallback to auto-detection if no explicit selection

      // When selectedApps is provided, we fetch directly from those apps (Step 3b)
      // so we skip the keyword-based search in fetchMultiSourceData
      const includesGooglePlay = selectedApps && selectedApps.length > 0 ? false : (selectedDataSources?.includes('Google Play') ?? false)
      const includesAppStore = selectedApps && selectedApps.length > 0 ? false : (selectedDataSources?.includes('App Store') ?? false)

      const hasSelectedApps = selectedApps && selectedApps.length > 0
      const sourcesList = [
        'Reddit',
        includesHN && 'Hacker News',
        hasSelectedApps && `${selectedApps!.length} selected apps`,
        !hasSelectedApps && includesGooglePlay && 'Google Play',
        !hasSelectedApps && includesAppStore && 'App Store'
      ].filter(Boolean).join(' + ')
      console.log(`Step 3: Fetching data from ${sourcesList}`)
      lastErrorSource = 'arctic_shift' // Reddit data API (primary source)
      multiSourceData = await fetchMultiSourceData({
        subreddits: subredditsToSearch,
        keywords: searchKeywords,
        limit: sampleSizePerSource, // User-selected depth: Quick=150, Standard=300, Deep=450
        // Note: timeRange is now handled by adaptive time windows based on subreddit velocity
        // The arctic-shift adapter will use time-stratified fetching for good coverage
        subredditVelocities, // Posting velocity per subreddit for adaptive time windows
      }, hypothesis, includesHN, includesGooglePlay, includesAppStore)

      rawPosts = multiSourceData.posts
      rawComments = multiSourceData.comments

      console.log(`Fetched ${rawPosts.length} posts and ${rawComments.length} comments from ${multiSourceData.sources.join(' + ') || multiSourceData.metadata.source}`)
    } else {
      // APP GAP MODE: Skip Reddit, only use app store reviews
      console.log('Step 3: App Gap mode - skipping Reddit fetch (app store reviews only)')
    }

    // Step 3b: Fetch reviews for selected apps (user-selected apps from coverage preview)
    if (selectedApps && selectedApps.length > 0) {
      console.log(`Step 3b: Fetching reviews for ${selectedApps.length} selected apps`)
      try {
        const reviewsPerApp = Math.ceil(100 / selectedApps.length) // Distribute limit across apps

        for (const app of selectedApps) {
          try {
            let appReviews: RedditPost[] = []

            if (app.store === 'google_play') {
              appReviews = await googlePlayAdapter.getReviewsForAppId(app.appId, { limit: reviewsPerApp })
            } else if (app.store === 'app_store') {
              appReviews = await appStoreAdapter.getReviewsForAppId(app.appId, { limit: reviewsPerApp })
            }

            if (appReviews.length > 0) {
              rawPosts = [...rawPosts, ...appReviews]
              console.log(`Added ${appReviews.length} reviews from ${app.name} (${app.store})`)
            }
          } catch (appError) {
            console.warn(`Failed to fetch reviews for ${app.name}:`, appError)
            // Continue with other apps
          }
        }
      } catch (error) {
        console.error('Failed to fetch app reviews:', error)
        // Continue without app reviews - don't fail the entire request
      }
    }
    // Step 3c: For app-centric mode, fetch reviews directly for the specific app
    else if (appData && appData.appId) {
      console.log(`Step 3c: Fetching reviews for specific app: ${appData.name} (${appData.appId})`)
      try {
        let appReviews: RedditPost[] = []

        if (appData.store === 'google_play') {
          appReviews = await googlePlayAdapter.getReviewsForAppId(appData.appId, { limit: 500 })
          if (appReviews.length > 0) {
            rawPosts = [...rawPosts, ...appReviews]
            console.log(`Added ${appReviews.length} Google Play reviews for ${appData.name}`)
          }
        } else if (appData.store === 'app_store') {
          appReviews = await appStoreAdapter.getReviewsForAppId(appData.appId, { limit: 500 })
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

      // Step 3d: Cross-store lookup - find the same app on the OTHER store
      try {
        // Extract core app name (e.g., "Tinder" from "Tinder - Dating & New Friends")
        const coreAppName = appData.name.split(/[:\-–—]/)[0].trim().toLowerCase()
        const otherStore = appData.store === 'google_play' ? 'app_store' : 'google_play'

        console.log(`Step 3d: Searching ${otherStore} for "${coreAppName}"...`)

        // Search the other store
        const otherAdapter = otherStore === 'app_store' ? appStoreAdapter : googlePlayAdapter
        const searchResults = await otherAdapter.searchAppsWithDetails(coreAppName, { maxApps: 5 })

        // Find matching app: same core name + high review count (real app, not clone)
        const matchingApp = searchResults.apps.find(app => {
          const resultCoreName = app.name.split(/[:\-–—]/)[0].trim().toLowerCase()
          return resultCoreName === coreAppName && app.reviewCount > 1000
        })

        if (matchingApp) {
          console.log(`Found matching app on ${otherStore}: ${matchingApp.name} (${matchingApp.reviewCount} reviews)`)

          // Fetch reviews from the matched app
          let crossStoreReviews: RedditPost[] = []
          if (otherStore === 'google_play') {
            crossStoreReviews = await googlePlayAdapter.getReviewsForAppId(matchingApp.appId, { limit: 500 })
          } else {
            crossStoreReviews = await appStoreAdapter.getReviewsForAppId(matchingApp.appId, { limit: 500 })
          }

          if (crossStoreReviews.length > 0) {
            rawPosts = [...rawPosts, ...crossStoreReviews]
            console.log(`Added ${crossStoreReviews.length} ${otherStore === 'google_play' ? 'Google Play' : 'App Store'} reviews from cross-store lookup`)
          }
        } else {
          console.log(`No matching app found on ${otherStore} for "${coreAppName}"`)
        }
      } catch (crossStoreError) {
        console.warn(`Cross-store lookup failed (non-blocking):`, crossStoreError)
        // Continue without cross-store reviews - don't fail the entire request
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

    // Step 4: Filter posts and comments for relevance
    console.log('Step 4: Filtering for relevance to hypothesis')
    lastErrorSource = 'anthropic' // Claude API for filtering

    // Track expansion attempts for adaptive fetching
    const expansionAttempts: ExpansionAttempt[] = []

    // Variables to hold filter results (either path)
    let posts: typeof rawPosts
    let comments: typeof rawComments
    let postCoreItems: typeof rawPosts
    let postRelatedItems: typeof rawPosts
    let filteringMetrics: FilteringMetrics
    let twoStageResult: PipelineResult | null = null
    let tieredResult: TieredSignals | null = null
    let postRelevanceDecisions: RelevanceDecision[] = []

    // Comments always use the old filter (per plan decision)
    const commentFilterResult = await filterRelevantComments(rawComments, hypothesis, structuredHypothesis)
    comments = commentFilterResult.items

    if (USE_TIERED_FILTER) {
      // =========================================================================
      // NEW: Tiered Filter Pipeline (Embeddings only, no AI gatekeeping)
      // =========================================================================
      console.log('[Tiered] Using tiered filter (embeddings only)')

      // Bridge RedditPost[] to NormalizedPost[]
      const normalizedPosts = bridgeRedditPostsToNormalized(rawPosts)
      console.log(`[Tiered] Normalized ${normalizedPosts.length} posts`)

      // Run the tiered filter
      tieredResult = await filterSignalsTiered(normalizedPosts, hypothesis, {
        onProgress: (msg) => console.log(msg),
      })

      // Get analysis signals (CORE + STRONG only)
      const analysisSignals = getSignalsForAnalysis(tieredResult)

      // Map tiered signals back to RedditPost format for compatibility
      posts = analysisSignals
        .map(signal => {
          // Find the original post by ID
          return rawPosts.find(p => p.id === signal.post.id)
        })
        .filter((p): p is typeof rawPosts[0] => p !== undefined)

      // CORE = score >= 0.45, STRONG = score >= 0.35
      postCoreItems = tieredResult.core
        .map(s => rawPosts.find(p => p.id === s.post.id))
        .filter((p): p is typeof rawPosts[0] => p !== undefined)
      postRelatedItems = tieredResult.strong
        .map(s => rawPosts.find(p => p.id === s.post.id))
        .filter((p): p is typeof rawPosts[0] => p !== undefined)

      // Log the pipeline results
      console.log(`\n=== TIERED POST FILTER PIPELINE ===`)
      console.log(`  Input: ${rawPosts.length} posts`)
      console.log(`  CORE (≥0.45): ${tieredResult.core.length}`)
      console.log(`  STRONG (≥0.35): ${tieredResult.strong.length}`)
      console.log(`  RELATED (≥0.25): ${tieredResult.related.length}`)
      console.log(`  ADJACENT (≥0.15): ${tieredResult.adjacent.length}`)
      console.log(`  Noise (filtered): ${rawPosts.length - tieredResult.stats.total}`)
      console.log(`  Processing time: ${tieredResult.stats.processingTimeMs}ms`)
      console.log(`  Output: ${posts.length} signals for analysis (CORE + STRONG)\n`)

      // Build filtering metrics
      const postFilterRate = rawPosts.length > 0
        ? ((rawPosts.length - posts.length) / rawPosts.length) * 100
        : 0

      filteringMetrics = {
        postsFound: rawPosts.length,
        postsAnalyzed: posts.length,
        postsFiltered: rawPosts.length - posts.length,
        postFilterRate,
        commentsFound: commentFilterResult.metrics.before,
        commentsAnalyzed: commentFilterResult.metrics.after,
        commentsFiltered: commentFilterResult.metrics.filteredOut,
        commentFilterRate: commentFilterResult.metrics.filterRate,
        qualityLevel: calculateQualityLevel(postFilterRate, commentFilterResult.metrics.filterRate),
        coreSignals: tieredResult.core.length,
        relatedSignals: tieredResult.strong.length, // STRONG maps to relatedSignals for UI compatibility
        titleOnlyPosts: 0, // Not tracked in tiered
        preFilterSkipped: 0, // Not applicable
        expansionAttempts,
        timeRangeMonths: 24,
        communitiesSearched: [...subredditsToSearch],
        tieredMetrics: {
          core: tieredResult.core.length,
          strong: tieredResult.strong.length,
          related: tieredResult.related.length,
          adjacent: tieredResult.adjacent.length,
          total: tieredResult.stats.total,
          processingTimeMs: tieredResult.stats.processingTimeMs,
        },
      }

      console.log(`[Tiered] Complete: ${posts.length} signals for analysis`)

      // =======================================================================
      // APP GAP MODE: Clustering with app store bypass (Jan 2026)
      // For app-centric research, include ALL app store reviews in clustering
      // (Reddit signals still respect tiered thresholds)
      //
      // FIX (Jan 2, 2026): Reddit posts must MENTION the app name to be included.
      // Without this, embedding similarity matches generic SaaS posts that don't
      // discuss the specific app at all.
      // =======================================================================
      if (appData && appData.appId) {
        // Count app store signals in each tier BEFORE combining
        const allTieredSignals = [
          ...tieredResult.core,
          ...tieredResult.strong,
          ...tieredResult.related,
          ...tieredResult.adjacent,
        ]

        const appStoreSignalsInTiers = allTieredSignals.filter(
          s => s.post.source === 'appstore' || s.post.source === 'playstore'
        )
        const redditSignalsInTiers = allTieredSignals.filter(
          s => s.post.source === 'reddit'
        )

        // Log for verification (per user request)
        const appStoreInRawPosts = rawPosts.filter(
          p => p.subreddit === 'app_store' || p.subreddit === 'google_play'
        ).length

        console.log(`\n=== APP GAP MODE: Signal Distribution ===`)
        console.log(`  App store reviews in raw input: ${appStoreInRawPosts}`)
        console.log(`  App store signals in tier buckets: ${appStoreSignalsInTiers.length}`)
        console.log(`    - CORE: ${tieredResult.core.filter(s => s.post.source === 'appstore' || s.post.source === 'playstore').length}`)
        console.log(`    - STRONG: ${tieredResult.strong.filter(s => s.post.source === 'appstore' || s.post.source === 'playstore').length}`)
        console.log(`    - RELATED: ${tieredResult.related.filter(s => s.post.source === 'appstore' || s.post.source === 'playstore').length}`)
        console.log(`    - ADJACENT: ${tieredResult.adjacent.filter(s => s.post.source === 'appstore' || s.post.source === 'playstore').length}`)
        console.log(`  Reddit signals in analysis (CORE+STRONG): ${analysisSignals.filter(s => s.post.source === 'reddit').length}`)

        // Flag if app store signals are being dropped before tiering
        if (appStoreSignalsInTiers.length < appStoreInRawPosts) {
          console.warn(`  ⚠️ WARNING: ${appStoreInRawPosts - appStoreSignalsInTiers.length} app store reviews dropped before tiering!`)
        }

        // FIX: Filter Reddit signals to only include posts that MENTION the app name
        // This prevents irrelevant SaaS posts from appearing in App Gap results
        const appName = appData.name.toLowerCase()
        // Extract core app name (e.g., "Loom" from "Loom: Screen Recorder")
        const coreAppName = appName.split(/[:\-–—]/)[0].trim()
        // Build word-boundary regex for the app name (avoids partial matches like "bloom" for "loom")
        const appNameRegex = new RegExp(`\\b${coreAppName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')

        const redditSignalsWithAppMention = analysisSignals.filter(s => {
          if (s.post.source !== 'reddit') return false
          const text = `${s.post.title} ${s.post.body}`.toLowerCase()
          return appNameRegex.test(text)
        })

        const redditSignalsWithoutMention = analysisSignals.filter(s =>
          s.post.source === 'reddit'
        ).length - redditSignalsWithAppMention.length

        console.log(`  App name filter: "${coreAppName}"`)
        console.log(`    - Reddit with app mention: ${redditSignalsWithAppMention.length}`)
        console.log(`    - Reddit without mention (excluded): ${redditSignalsWithoutMention}`)

        // Combine: Reddit (must mention app) + ALL app store (bypass both filters)
        const redditForClustering = redditSignalsWithAppMention
        const appStoreForClustering = appStoreSignalsInTiers // ALL app store signals
        const signalsForClustering = [...redditForClustering, ...appStoreForClustering]

        console.log(`  Signals for clustering: ${signalsForClustering.length} (${redditForClustering.length} Reddit + ${appStoreForClustering.length} App Store)`)

        // Run clustering
        if (signalsForClustering.length >= 3) {
          try {
            const clusterResult = await clusterSignals(signalsForClustering, {
              minClusterSize: 3,
              similarityThreshold: 0.70,
              maxClusters: 10,
            })

            // Store for later use in result
            // @ts-expect-error - appGapClusters added dynamically for this request
            tieredResult.appGapClusters = clusterResult.clusters

            console.log(`  Clustering complete:`)
            console.log(`    - Clusters formed: ${clusterResult.clusters.length}`)
            console.log(`    - Signals clustered: ${clusterResult.stats.clusteredSignals}`)
            console.log(`    - Unclustered: ${clusterResult.stats.unclusteredSignals}`)
            console.log(`    - Processing time: ${clusterResult.stats.processingTimeMs}ms`)

            // Log sample cluster
            if (clusterResult.clusters.length > 0) {
              const sample = clusterResult.clusters[0]
              console.log(`  Sample cluster: "${sample.label || sample.id}"`)
              console.log(`    - Size: ${sample.size} signals`)
              console.log(`    - Sources: ${sample.sources.appStore} App Store, ${sample.sources.googlePlay} Google Play, ${sample.sources.reddit} Reddit`)
              console.log(`    - Cohesion: ${sample.avgSimilarity.toFixed(2)}`)
            }
          } catch (clusterError) {
            console.error('  Clustering failed (non-blocking):', clusterError)
          }
        } else {
          console.log(`  Skipping clustering: not enough signals (${signalsForClustering.length} < 3)`)
        }

        // ALSO filter the `posts` variable used for pain analysis
        // Keep: Reddit posts WITH app mention + ALL app store reviews
        const postsBeforeAppFilter = posts.length
        posts = posts.filter(p => {
          // App store reviews always pass
          if (p.subreddit === 'app_store' || p.subreddit === 'google_play') return true
          // Reddit posts must mention the app name
          const text = `${p.title} ${p.body || ''}`.toLowerCase()
          return appNameRegex.test(text)
        })

        // Also update postCoreItems and postRelatedItems to match
        postCoreItems = postCoreItems.filter(p => {
          if (p.subreddit === 'app_store' || p.subreddit === 'google_play') return true
          const text = `${p.title} ${p.body || ''}`.toLowerCase()
          return appNameRegex.test(text)
        })
        postRelatedItems = postRelatedItems.filter(p => {
          if (p.subreddit === 'app_store' || p.subreddit === 'google_play') return true
          const text = `${p.title} ${p.body || ''}`.toLowerCase()
          return appNameRegex.test(text)
        })

        // Update filtering metrics to reflect the additional filter
        const postsRemovedByAppFilter = postsBeforeAppFilter - posts.length
        if (postsRemovedByAppFilter > 0) {
          console.log(`  Pain analysis: ${postsRemovedByAppFilter} Reddit posts removed (no app mention)`)
          console.log(`  Final posts for analysis: ${posts.length}`)
          filteringMetrics.postsAnalyzed = posts.length
          filteringMetrics.coreSignals = postCoreItems.length
          filteringMetrics.relatedSignals = postRelatedItems.length
        }

        console.log(`=========================================\n`)
      }

      // Convert tiered signals to RelevanceDecision format for audit trail
      postRelevanceDecisions = analysisSignals.map(signal => ({
        reddit_id: signal.post.id,
        title: signal.post.title,
        body_preview: signal.post.body.slice(0, 100),
        subreddit: signal.post.metadata?.subreddit as string || 'unknown',
        decision: 'Y',
        tier: signal.tier === 'core' ? 'CORE' : 'RELATED', // STRONG maps to RELATED for compatibility
        stage: 'problem' as const, // Tiered filtering is conceptually similar to problem-match
        reason: `Tiered filter (score: ${signal.score.toFixed(2)}, tier: ${signal.tier})`,
      } satisfies RelevanceDecision))

    } else if (USE_TWO_STAGE_FILTER) {
      // =========================================================================
      // NEW: Two-Stage Filter Pipeline (Embeddings → Cap 50 → Haiku Verify)
      // =========================================================================
      console.log('[TwoStage] Using two-stage filter with Haiku verification')

      // Bridge RedditPost[] to NormalizedPost[]
      const normalizedPosts = bridgeRedditPostsToNormalized(rawPosts)
      console.log(`[TwoStage] Normalized ${normalizedPosts.length} posts`)

      // Run the two-stage filter
      twoStageResult = await filterSignals(normalizedPosts, hypothesis, {
        onProgress: (msg) => console.log(msg),
      })

      // Map verified signals back to RedditPost format
      posts = mapVerifiedToRedditPosts(twoStageResult.verified, rawPosts)

      // All verified posts are CORE (they passed strict Haiku verification)
      postCoreItems = posts
      postRelatedItems = []

      // Log the pipeline results
      console.log(`\n=== TWO-STAGE POST FILTER PIPELINE ===`)
      console.log(`  Input: ${rawPosts.length} posts`)
      console.log(`  Stage 1 (Embedding 0.28): ${twoStageResult.stage1Candidates} candidates`)
      console.log(`  Stage 2 (Cap at 50): ${twoStageResult.stage2Candidates} sent to Haiku`)
      console.log(`  Stage 3 (Haiku YES/NO): ${twoStageResult.stage3Verified} verified`)
      console.log(`  Verification rate: ${(twoStageResult.verificationRate * 100).toFixed(1)}%`)
      console.log(`  Processing time: ${twoStageResult.processingTimeMs}ms`)
      console.log(`  Output: ${posts.length} verified posts\n`)

      // Build filtering metrics
      const postFilterRate = rawPosts.length > 0
        ? ((rawPosts.length - posts.length) / rawPosts.length) * 100
        : 0

      filteringMetrics = {
        postsFound: rawPosts.length,
        postsAnalyzed: posts.length,
        postsFiltered: rawPosts.length - posts.length,
        postFilterRate,
        commentsFound: commentFilterResult.metrics.before,
        commentsAnalyzed: commentFilterResult.metrics.after,
        commentsFiltered: commentFilterResult.metrics.filteredOut,
        commentFilterRate: commentFilterResult.metrics.filterRate,
        qualityLevel: calculateQualityLevel(postFilterRate, commentFilterResult.metrics.filterRate),
        coreSignals: posts.length, // All verified = CORE
        relatedSignals: 0, // No RELATED in two-stage filter
        titleOnlyPosts: 0, // Not tracked in two-stage
        preFilterSkipped: 0, // Not applicable
        expansionAttempts,
        timeRangeMonths: 24,
        communitiesSearched: [...subredditsToSearch],
        twoStageMetrics: {
          stage1Candidates: twoStageResult.stage1Candidates,
          stage2Candidates: twoStageResult.stage2Candidates,
          stage3Verified: twoStageResult.stage3Verified,
          verificationRate: twoStageResult.verificationRate,
          processingTimeMs: twoStageResult.processingTimeMs,
        },
      }

      console.log(`[TwoStage] Complete: ${posts.length} verified CORE signals`)

      // Convert verified signals to RelevanceDecision format for audit trail
      postRelevanceDecisions = twoStageResult.verified.map(signal => ({
        reddit_id: signal.post.id,
        title: signal.post.title,
        body_preview: signal.post.body.slice(0, 100),
        subreddit: signal.post.metadata?.subreddit as string || 'unknown',
        decision: signal.verified ? 'Y' : 'N',
        tier: signal.verified ? 'CORE' : undefined,
        stage: 'problem' as const,  // Haiku verification is the problem-match stage
        reason: signal.verified
          ? `Haiku verified (score: ${signal.embeddingScore.toFixed(2)})`
          : signal.aiResponse || 'Failed Haiku verification',
      } satisfies RelevanceDecision))

    } else {
      // =========================================================================
      // OLD: Legacy Filter Pipeline (embedding + domain gate + problem match)
      // =========================================================================
      console.log('[Legacy] Using legacy filter with SKIP_AI_GATES')

      const postFilterResult = await filterRelevantPosts(rawPosts, hypothesis, structuredHypothesis)
      posts = postFilterResult.items
      postCoreItems = postFilterResult.coreItems
      postRelatedItems = postFilterResult.relatedItems

      // Detailed filter pipeline logging for cost analysis
      console.log(`\n=== POST FILTER PIPELINE (Legacy) ===`)
      console.log(`  Input: ${postFilterResult.metrics.before} posts`)
      console.log(`  Stage 3 (Quality Gate - FREE): ${postFilterResult.metrics.stage3Filtered} filtered`)
      console.log(`  PreFilter (Rank - FREE): ${postFilterResult.metrics.preFilterSkipped} skipped (low engagement/no first-person)`)
      if (postFilterResult.metrics.embeddingFiltered > 0) {
        console.log(`  Stage 0 (Embedding - $0.01): ${postFilterResult.metrics.embeddingFiltered} filtered (${postFilterResult.metrics.embeddingHighSimilarity} HIGH + ${postFilterResult.metrics.embeddingMediumSimilarity} MEDIUM passed)`)
      }
      const postsSentToAI = postFilterResult.metrics.embeddingHighSimilarity + postFilterResult.metrics.embeddingMediumSimilarity ||
        (postFilterResult.metrics.before - postFilterResult.metrics.stage3Filtered - postFilterResult.metrics.preFilterSkipped)
      console.log(`  → Sent to AI: ${postsSentToAI}`)
      console.log(`  Stage 1 (Domain Gate - Haiku): ${postFilterResult.metrics.stage1Filtered} filtered`)
      console.log(`  Stage 2 (Problem Match - Sonnet): ${postFilterResult.metrics.stage2Filtered} filtered`)
      console.log(`  Output: ${posts.length} relevant posts (${postFilterResult.metrics.filterRate.toFixed(1)}% total filtered)`)

      // Build filtering metrics
      filteringMetrics = {
        postsFound: postFilterResult.metrics.before,
        postsAnalyzed: postFilterResult.metrics.after,
        postsFiltered: postFilterResult.metrics.filteredOut,
        postFilterRate: postFilterResult.metrics.filterRate,
        commentsFound: commentFilterResult.metrics.before,
        commentsAnalyzed: commentFilterResult.metrics.after,
        commentsFiltered: commentFilterResult.metrics.filteredOut,
        commentFilterRate: commentFilterResult.metrics.filterRate,
        qualityLevel: calculateQualityLevel(postFilterResult.metrics.filterRate, commentFilterResult.metrics.filterRate),
        coreSignals: postFilterResult.metrics.coreSignals,
        relatedSignals: postFilterResult.metrics.relatedSignals,
        titleOnlyPosts: postFilterResult.metrics.titleOnlyPosts,
        preFilterSkipped: postFilterResult.metrics.preFilterSkipped,
        stage2FilterRate: postFilterResult.metrics.stage2FilterRate,
        narrowProblemWarning: postFilterResult.metrics.narrowProblemWarning,
        expansionAttempts,
        timeRangeMonths: 24,
        communitiesSearched: [...subredditsToSearch],
      }

      if (filteringMetrics.preFilterSkipped && filteringMetrics.preFilterSkipped > 0) {
        console.log(`Pre-filter: ${filteringMetrics.preFilterSkipped} low-quality posts skipped before AI`)
      }
      if (filteringMetrics.narrowProblemWarning) {
        console.log(`⚠️ NARROW PROBLEM WARNING: ${filteringMetrics.stage2FilterRate?.toFixed(1)}% of domain-relevant posts failed problem-specific filter`)
      }
      console.log(`Signal tiers: ${postFilterResult.metrics.coreSignals} CORE, ${postFilterResult.metrics.relatedSignals} RELATED`)

      // Store decisions for audit trail
      postRelevanceDecisions = postFilterResult.decisions
    }

    // Comment filter logging (same for both paths)
    console.log(`\n=== COMMENT FILTER PIPELINE ===`)
    console.log(`  Input: ${commentFilterResult.metrics.before} comments`)
    console.log(`  Stage 3 (Quality Gate - FREE): ${commentFilterResult.metrics.stage3Filtered} filtered`)
    console.log(`  PreFilter (Rank - FREE): ${commentFilterResult.metrics.preFilterSkipped} skipped (low engagement/no first-person)`)
    if (commentFilterResult.metrics.embeddingFiltered > 0) {
      console.log(`  Stage 0 (Embedding - $0.01): ${commentFilterResult.metrics.embeddingFiltered} filtered (${commentFilterResult.metrics.embeddingHighSimilarity} HIGH + ${commentFilterResult.metrics.embeddingMediumSimilarity} MEDIUM passed)`)
    }
    const commentsSentToAI = commentFilterResult.metrics.embeddingHighSimilarity + commentFilterResult.metrics.embeddingMediumSimilarity ||
      (commentFilterResult.metrics.before - commentFilterResult.metrics.stage3Filtered - commentFilterResult.metrics.preFilterSkipped)
    console.log(`  → Sent to AI: ${commentsSentToAI}`)
    console.log(`  Stage 2 (Problem Match - Haiku): ${commentFilterResult.metrics.stage2Filtered} filtered`)
    console.log(`  Output: ${comments.length} relevant comments (${commentFilterResult.metrics.filterRate.toFixed(1)}% total filtered)\n`)

    console.log(`Data quality level: ${filteringMetrics.qualityLevel}`)
    console.log(`Signal tiers: ${filteringMetrics.coreSignals} CORE, ${filteringMetrics.relatedSignals} RELATED`)

    // Step 4.5: Adaptive fetching - try to get more data if below threshold
    let finalPosts = posts
    let finalComments = comments
    let finalCoreItems = postCoreItems
    let finalRelatedItems = postRelatedItems

    const totalSignals = filteringMetrics.coreSignals + filteringMetrics.relatedSignals
    const needsMoreData = filteringMetrics.coreSignals < MIN_CORE_SIGNALS || totalSignals < MIN_TOTAL_SIGNALS

    if (needsMoreData && !userSelectedSubreddits) {
      console.log(`Step 4.5: Below threshold (${filteringMetrics.coreSignals} core, ${totalSignals} total). Attempting adaptive fetch...`)

      try {
        // Discover additional subreddits using Claude
        lastErrorSource = 'anthropic'
        const additionalDiscovery = await discoverSubreddits(
          `Find MORE subreddits about: ${searchContext} (already searched: ${subredditsToSearch.join(', ')})`,
          subredditsToSearch // exclude already searched
        )

        const newSubreddits = additionalDiscovery.subreddits
          .filter(s => !subredditsToSearch.includes(s))
          .slice(0, 5) // Max 5 additional

        if (newSubreddits.length > 0) {
          console.log(`Found ${newSubreddits.length} additional subreddits:`, newSubreddits)

          // Fetch from new subreddits
          lastErrorSource = 'arctic_shift'
          const additionalData = await fetchMultiSourceData({
            subreddits: newSubreddits,
            keywords: searchKeywords,
            limit: 100,
            timeRange: {
              after: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000),
            },
          }, hypothesis, false, false, false) // No HN/app stores for expansion

          if (additionalData.posts.length > 0 || additionalData.comments.length > 0) {
            // Filter new posts and comments in parallel
            lastErrorSource = 'anthropic'
            const [additionalPostFilter, additionalCommentFilter] = await Promise.all([
              additionalData.posts.length > 0
                ? filterRelevantPosts(additionalData.posts, hypothesis, structuredHypothesis)
                : Promise.resolve({ items: [], coreItems: [], relatedItems: [], metrics: { coreSignals: 0, relatedSignals: 0, after: 0 }, decisions: [] }),
              additionalData.comments.length > 0
                ? filterRelevantComments(additionalData.comments, hypothesis, structuredHypothesis)
                : Promise.resolve({ items: [], metrics: { after: 0 }, decisions: [] }),
            ])

            const postSignalsGained = additionalPostFilter.metrics.coreSignals + additionalPostFilter.metrics.relatedSignals
            const commentSignalsGained = additionalCommentFilter.items.length
            const totalSignalsGained = postSignalsGained + commentSignalsGained

            expansionAttempts.push({
              type: 'communities',
              value: newSubreddits.join(', '),
              success: totalSignalsGained > 0,
              signalsGained: totalSignalsGained,
            })

            if (totalSignalsGained > 0) {
              // Merge post results
              if (postSignalsGained > 0) {
                finalPosts = [...posts, ...additionalPostFilter.items]
                finalCoreItems = [...postCoreItems, ...additionalPostFilter.coreItems]
                finalRelatedItems = [...postRelatedItems, ...additionalPostFilter.relatedItems]
                filteringMetrics.postsFound += additionalData.posts.length
                filteringMetrics.postsAnalyzed += additionalPostFilter.metrics.after
                filteringMetrics.coreSignals += additionalPostFilter.metrics.coreSignals
                filteringMetrics.relatedSignals += additionalPostFilter.metrics.relatedSignals
              }

              // Merge comment results
              if (commentSignalsGained > 0) {
                finalComments = [...comments, ...additionalCommentFilter.items]
                filteringMetrics.commentsFound += additionalData.comments.length
                filteringMetrics.commentsAnalyzed += additionalCommentFilter.metrics.after
              }

              filteringMetrics.communitiesSearched?.push(...newSubreddits)
              console.log(`Adaptive fetch added ${postSignalsGained} post signals + ${commentSignalsGained} comment signals from ${newSubreddits.length} communities`)
            }
          }
        } else {
          expansionAttempts.push({
            type: 'communities',
            value: 'No new communities found',
            success: false,
            signalsGained: 0,
          })
        }
      } catch (adaptiveError) {
        console.error('Adaptive fetching failed (non-blocking):', adaptiveError)
        expansionAttempts.push({
          type: 'communities',
          value: 'Expansion failed',
          success: false,
          signalsGained: 0,
        })
      }
    }

    // Step 4.6: FINAL App Name Gate filter (after adaptive fetch)
    // This ensures ALL Reddit posts (including those from adaptive fetch) are filtered in App Gap mode
    if (appData && appData.appId) {
      const appName = appData.name.toLowerCase()
      const coreAppName = appName.split(/[:\-–—]/)[0].trim()
      const appNameRegex = new RegExp(`\\b${coreAppName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')

      const beforeCore = finalCoreItems.length
      const beforeRelated = finalRelatedItems.length

      finalCoreItems = finalCoreItems.filter(p => {
        if (p.subreddit === 'app_store' || p.subreddit === 'google_play') return true
        const text = `${p.title} ${p.body || ''}`.toLowerCase()
        return appNameRegex.test(text)
      })

      finalRelatedItems = finalRelatedItems.filter(p => {
        if (p.subreddit === 'app_store' || p.subreddit === 'google_play') return true
        const text = `${p.title} ${p.body || ''}`.toLowerCase()
        return appNameRegex.test(text)
      })

      const removedCore = beforeCore - finalCoreItems.length
      const removedRelated = beforeRelated - finalRelatedItems.length

      if (removedCore > 0 || removedRelated > 0) {
        console.log(`[App Name Gate] FINAL filter removed ${removedCore} CORE + ${removedRelated} RELATED Reddit posts (no "${coreAppName}" mention)`)
        console.log(`[App Name Gate] Final: ${finalCoreItems.length} CORE + ${finalRelatedItems.length} RELATED items for pain analysis`)
      } else {
        console.log(`[App Name Gate] FINAL check passed: all ${finalCoreItems.length + finalRelatedItems.length} items mention "${coreAppName}" or are app reviews`)
      }

      // Also filter comments for App Name Gate
      const beforeComments = finalComments.length
      finalComments = finalComments.filter(c => {
        // App store/Google Play comments don't need filtering
        if (c.subreddit === 'app_store' || c.subreddit === 'google_play') return true
        // Check if comment body mentions the app name
        const text = (c.body || '').toLowerCase()
        return appNameRegex.test(text)
      })
      const removedComments = beforeComments - finalComments.length
      if (removedComments > 0) {
        console.log(`[App Name Gate] Removed ${removedComments} Reddit comments (no "${coreAppName}" mention)`)
        console.log(`[App Name Gate] Final: ${finalComments.length} comments for pain analysis`)
      }

      // App Gap Mode: Promote App Store reviews to CORE tier
      // App Store reviews in App Gap mode ARE about the analyzed app, so they're CORE by definition
      const appStoreInRelated = finalRelatedItems.filter(
        p => p.subreddit === 'app_store' || p.subreddit === 'google_play'
      )
      if (appStoreInRelated.length > 0) {
        console.log(`[Tier Promotion] Promoting ${appStoreInRelated.length} App Store reviews from RELATED to CORE`)
        // Move app store reviews from RELATED to CORE
        finalCoreItems = [
          ...finalCoreItems,
          ...appStoreInRelated
        ]
        finalRelatedItems = finalRelatedItems.filter(
          p => p.subreddit !== 'app_store' && p.subreddit !== 'google_play'
        )
        console.log(`[Tier Promotion] New distribution: ${finalCoreItems.length} CORE + ${finalRelatedItems.length} RELATED`)
      }
    }

    // Step 5: Analyze posts and comments for pain signals with tier awareness
    console.log('Step 5: Analyzing pain signals')
    const corePostSignals = analyzePosts(finalCoreItems).map(s => ({ ...s, tier: 'CORE' as const }))
    const relatedPostSignals = analyzePosts(finalRelatedItems).map(s => ({ ...s, tier: 'RELATED' as const }))
    const postSignals = [...corePostSignals, ...relatedPostSignals]
    const commentSignals = analyzeComments(finalComments)
    const allPainSignals = combinePainSignals(postSignals, commentSignals)

    console.log(`Found ${allPainSignals.length} pain signals`)

    // Step 5.5: Apply subreddit weights to pain scores
    applySubredditWeights(allPainSignals, subredditWeights)
    console.log('Applied subreddit weights to pain signals')

    // Step 5.55: Filter pure praise from app store reviews (embedding-based)
    // Only for App Gap mode where we have app store reviews
    let filteredPainSignals = allPainSignals
    if (appData?.appId) {
      const appStoreSignalsBeforeFilter = allPainSignals.filter(
        s => s.source.subreddit === 'google_play' || s.source.subreddit === 'app_store'
      )
      if (appStoreSignalsBeforeFilter.length > 0) {
        console.log(`Step 5.55: Filtering pure praise from ${appStoreSignalsBeforeFilter.length} app store signals`)
        try {
          const filteredAppStoreSignals = await filterPraiseSignals(appStoreSignalsBeforeFilter)
          const filteredCount = appStoreSignalsBeforeFilter.length - filteredAppStoreSignals.length
          console.log(`Praise filter removed ${filteredCount} pure praise signals from app store reviews`)

          // Keep non-app-store signals + filtered app store signals
          const nonAppStoreSignals = allPainSignals.filter(
            s => s.source.subreddit !== 'google_play' && s.source.subreddit !== 'app_store'
          )
          filteredPainSignals = [...nonAppStoreSignals, ...filteredAppStoreSignals]
        } catch (praiseFilterError) {
          console.error('Praise filter failed (non-blocking):', praiseFilterError)
          // Continue with all signals if filter fails
        }
      }
    }

    // Step 5.6: Semantic categorization for App Gap mode (Phase 3 - App Store-First Architecture)
    if (appData?.appId) {
      console.log('Step 5.6: Applying semantic categorization for App Gap mode')
      try {
        const { getSignalCategorizer } = await import('@/lib/analysis/signal-categorizer')
        const categorizer = getSignalCategorizer()

        // Only categorize app store signals (not Reddit)
        const appStoreSignals = filteredPainSignals.filter(
          s => s.source.subreddit === 'google_play' || s.source.subreddit === 'app_store'
        )

        if (appStoreSignals.length > 0) {
          console.log(`Categorizing ${appStoreSignals.length} app store signals...`)

          // Categorize in batches
          for (const signal of appStoreSignals) {
            const result = await categorizer.categorize(signal.text)
            signal.feedbackCategory = result.category
            signal.feedbackCategoryConfidence = result.confidence
          }

          console.log(`Semantic categorization complete`)
        }
      } catch (categorizationError) {
        console.error('Semantic categorization failed (non-blocking):', categorizationError)
        // Continue without semantic categories - keyword fallback will be used
      }
    }

    // Step 6: Get pain summary statistics
    const painSummary = getPainSummary(filteredPainSignals)

    // Step 7: Extract themes using Claude
    console.log('Step 7: Extracting themes with Claude')
    const themeAnalysis = await extractThemes(filteredPainSignals, hypothesis)

    // Step 7b: Calculate resonance for each theme
    themeAnalysis.themes = calculateThemeResonance(themeAnalysis.themes, filteredPainSignals)

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

    // Get current tracker before ending session (so we can record individual calls)
    const tracker = getCurrentTracker()

    // End token tracking and get usage summary
    const tokenUsage = endTokenTracking()

    // Record API costs to database if we have a jobId and tracker data
    if (jobId && tracker && tracker.calls.length > 0) {
      const costRecords: RecordCostParams[] = tracker.calls.map((call, index) => ({
        userId: user.id,
        jobId,
        actionType: 'paid_search' as const,
        model: call.model,
        inputTokens: call.inputTokens,
        outputTokens: call.outputTokens,
        endpoint: '/api/research/community-voice',
        metadata: { callIndex: index, totalCalls: tracker.calls.length },
      }))
      // Fire and forget - don't block on cost recording
      recordApiCostsBatch(costRecords).catch((err) => {
        console.error('Failed to record API costs:', err)
      })
    }

    // Build result
    const result: CommunityVoiceResult = {
      hypothesis,
      subreddits: {
        discovered: discoveryResult.subreddits,
        analyzed: filteringMetrics.communitiesSearched || subredditsToSearch,
      },
      painSignals: filteredPainSignals.slice(0, 50), // Return top 50 signals
      painSummary,
      themeAnalysis,
      interviewQuestions,
      marketSizing,
      timing,
      // Include clusters for App Gap mode (Jan 2026)
      // @ts-expect-error - appGapClusters added dynamically when appData exists
      clusters: tieredResult?.appGapClusters || undefined,
      metadata: {
        postsAnalyzed: finalPosts.length,
        commentsAnalyzed: finalComments.length,
        processingTimeMs,
        timestamp: new Date().toISOString(),
        dataSources: multiSourceData.sources.length > 0 ? multiSourceData.sources : ['Reddit'],
        filteringMetrics,
        tokenUsage: tokenUsage || undefined,
        // Include all Y/N decisions for quality audit
        relevanceDecisions: {
          posts: postRelevanceDecisions,
          comments: commentFilterResult.decisions,
        },
      },
    }

    // If jobId is provided, save results to database and run auto-competitor analysis
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

        // Update step_status to show CV complete, competitor in progress
        await adminClient
          .from('research_jobs')
          .update({
            status: 'processing',
            step_status: {
              pain_analysis: 'completed',
              market_sizing: 'completed',
              timing_analysis: 'completed',
              competitor_analysis: 'in_progress'
            }
          })
          .eq('id', jobId)

        // =========================================================================
        // AUTO-COMPETITOR ANALYSIS (Jan 2026 - Unified Flow)
        // =========================================================================
        console.log('Step 11: Running auto-competitor analysis')
        lastErrorSource = 'anthropic'

        // Step 11a: Auto-detect competitors
        const detectedCompetitors: string[] = []

        // 1. Known competitors from static mapping (App Gap mode)
        if (appData?.name) {
          const knownComps = findKnownCompetitors(appData.name)
          if (knownComps.length > 0) {
            console.log(`Auto-detected ${knownComps.length} known competitors for ${appData.name}:`, knownComps)
            detectedCompetitors.push(...knownComps)
          }
        }

        // 2. Extract competitor mentions from pain signals
        const competitorMentions = new Set<string>()
        for (const signal of filteredPainSignals.slice(0, 30)) {
          // Look for "switched to X", "moved to X", "using X instead", "X is better"
          const patterns = [
            /switched\s+to\s+(\w+)/gi,
            /moved?\s+to\s+(\w+)/gi,
            /using\s+(\w+)\s+instead/gi,
            /(\w+)\s+is\s+(?:much\s+)?better/gi,
            /prefer\s+(\w+)/gi,
            /try\s+(\w+)/gi,
          ]
          const text = `${signal.title || ''} ${signal.text || ''}`
          for (const pattern of patterns) {
            const matches = text.matchAll(pattern)
            for (const match of matches) {
              const name = match[1]
              // Filter out common non-competitor words
              if (name && name.length > 2 && !['the', 'this', 'that', 'they', 'what', 'just', 'now'].includes(name.toLowerCase())) {
                competitorMentions.add(name)
              }
            }
          }
        }

        // Add signal-based competitors (up to 5)
        const signalCompetitors = Array.from(competitorMentions).slice(0, 5)
        if (signalCompetitors.length > 0) {
          console.log(`Extracted ${signalCompetitors.length} competitor mentions from signals:`, signalCompetitors)
          detectedCompetitors.push(...signalCompetitors)
        }

        // Deduplicate and cap at 8
        const uniqueCompetitors = [...new Set(detectedCompetitors.map(c => c.toLowerCase()))]
          .map(c => detectedCompetitors.find(d => d.toLowerCase() === c)!)
          .slice(0, 8)

        console.log(`Final competitor list (${uniqueCompetitors.length}):`, uniqueCompetitors)

        // Step 11b: Run competitor analysis
        let competitorResult: CompetitorIntelligenceResult | null = null
        try {
          competitorResult = await analyzeCompetitors({
            hypothesis,
            knownCompetitors: uniqueCompetitors.length > 0 ? uniqueCompetitors : undefined,
            geography: targetGeography ? {
              location: targetGeography.location,
              scope: targetGeography.scope,
            } : undefined,
            clusters: result.clusters,
            maxCompetitors: 8,
          })

          console.log(`Competitor analysis complete: ${competitorResult.competitors.length} competitors, score ${competitorResult.competitionScore.score}/10`)

          // Save competitor results
          await saveResearchResult(jobId, 'competitor_intelligence', competitorResult)

          // Mark job as fully completed
          await adminClient
            .from('research_jobs')
            .update({
              status: 'completed',
              step_status: {
                pain_analysis: 'completed',
                market_sizing: 'completed',
                timing_analysis: 'completed',
                competitor_analysis: 'completed'
              }
            })
            .eq('id', jobId)

          console.log('Auto-competitor analysis saved successfully')
        } catch (compError) {
          console.error('Auto-competitor analysis failed (non-blocking):', compError)
          // Still mark job as completed - CV results are valid, competitor is optional
          await adminClient
            .from('research_jobs')
            .update({
              status: 'completed',
              step_status: {
                pain_analysis: 'completed',
                market_sizing: 'completed',
                timing_analysis: 'completed',
                competitor_analysis: 'failed'
              }
            })
            .eq('id', jobId)
        }

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
