import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkUserCredits, deductCredit } from '@/lib/credits'
import { discoverSubreddits } from '@/lib/reddit/subreddit-discovery'
import {
  fetchMultiSourceData,
  extractKeywords,
} from '@/lib/data-sources'
import {
  getPainSummary,
  type PainSignal,
  type PainSummary,
} from '@/lib/analysis/pain-detector'
import { getEmptyAnalysis, type ThemeAnalysis } from '@/lib/analysis/theme-extractor'
import type { MarketSizingResult } from '@/lib/analysis/market-sizing'
import type { TimingResult } from '@/lib/analysis/timing-analyzer'
import { preFilterByExcludeKeywords } from '@/lib/reddit/keyword-extractor'
import { getSubredditWeights } from '@/lib/analysis/subreddit-weights'
import {
  startTokenTracking,
  endTokenTracking,
  getCurrentTracker,
} from '@/lib/anthropic'
import { recordApiCostsBatch, type RecordCostParams } from '@/lib/api-costs'
import { saveResearchResult } from '@/lib/research/save-result'
import {
  filterRelevantPosts,
  filterRelevantComments,
  type RelevanceDecision,
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
  type SignalCluster,
} from '@/lib/embeddings'
import type { StructuredHypothesis, TargetGeography } from '@/types/research'
import type { AppDetails } from '@/lib/data-sources/types'
import { analyzeCompetitors, type CompetitorIntelligenceResult } from '@/lib/research/competitor-analyzer'
import {
  applyAppNameGate,
  extractCoreAppName,
  buildAppNameRegex,
  logAppNameGateResult,
} from '@/lib/research/gates/app-name-gate'
// Pipeline infrastructure (Phase 4)
import {
  createContext,
  isAppGapMode,
  executeStep,
} from '@/lib/research/pipeline'
import {
  keywordExtractorStep,
  subredditDiscoveryStep,
  dataFetcherStep,
  painAnalyzerStep,
  themeAnalyzerStep,
  marketAnalyzerStep,
  competitorDetectorStep,
} from '@/lib/research/steps'

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
    // Cross-store app data (e.g., Play Store app when user submitted App Store URL)
    crossStoreAppData?: AppDetails
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
    let crossStoreAppData: AppDetails | undefined  // App found via cross-store lookup (e.g., Play Store when user submitted App Store URL)
    let coverageData: Record<string, unknown> | undefined
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
      coverageData = (jobData as Record<string, unknown>)?.coverage_data as Record<string, unknown> | undefined
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

    // =========================================================================
    // CREATE RESEARCH CONTEXT (Phase 4 - Pipeline Infrastructure)
    // =========================================================================
    const ctx = createContext(
      researchJobId,
      user.id,
      hypothesis,
      appData,
      structuredHypothesis
    )
    console.log(`[Pipeline] Created context: mode=${ctx.mode}, jobId=${ctx.jobId.slice(0, 8)}...`)

    // Step 1: Extract hypothesis-specific keywords using pipeline step
    console.log('Step 1: Extracting hypothesis-specific keywords')
    lastErrorSource = 'anthropic' // Claude API

    const keywordResult = await executeStep(keywordExtractorStep, {
      hypothesis,
      structuredHypothesis,
    }, ctx)

    const extractedKeywords = keywordResult.data || { primary: [], secondary: [], exclude: [], searchContext: hypothesis }
    const searchContext = extractedKeywords.searchContext

    console.log('Extracted keywords:', {
      primary: extractedKeywords.primary.slice(0, 5),
      exclude: extractedKeywords.exclude,
    })

    // Step 2: Discover relevant subreddits using pipeline step
    // The step handles: App Gap skip, user-selected subreddits, Claude discovery
    let subredditsToSearch: string[]
    let subredditWeights: Map<string, number> = new Map()
    let discoveryResult: { subreddits: string[] }

    if (userSelectedSubreddits && userSelectedSubreddits.length > 0) {
      // User has selected specific subreddits - bypass discovery step
      console.log('[Subreddit Discovery] Using user-selected:', userSelectedSubreddits.length)
      subredditsToSearch = userSelectedSubreddits.slice(0, 15)
      discoveryResult = { subreddits: subredditsToSearch }
      // Calculate weights for user-selected subreddits
      if (subredditsToSearch.length > 0) {
        subredditWeights = await getSubredditWeights(hypothesis, subredditsToSearch)
      }
    } else {
      // Use pipeline step for discovery (handles App Gap skip automatically)
      const subredditResult = await executeStep(subredditDiscoveryStep, {
        searchContext,
        hypothesis,
      }, ctx)

      if (subredditResult.skipped) {
        // App Gap mode - step was skipped
        subredditsToSearch = []
        subredditWeights = new Map()
        discoveryResult = { subreddits: [] }
      } else {
        subredditsToSearch = subredditResult.data?.subreddits || []
        subredditWeights = subredditResult.data?.subredditWeights || new Map()
        discoveryResult = { subreddits: subredditsToSearch }
      }
    }

    // Only require subreddits for Hypothesis mode (not App Gap mode)
    if (subredditsToSearch.length === 0 && !isAppGapMode(ctx)) {
      return NextResponse.json(
        { error: 'Could not identify relevant subreddits for this hypothesis' },
        { status: 400 }
      )
    }

    console.log('Subreddits to search:', subredditsToSearch)
    if (subredditWeights.size > 0) {
      console.log('Subreddit weights:', Object.fromEntries(subredditWeights))
    }

    // Step 3: Fetch posts and comments using pipeline step
    // Handles: Reddit + HN (Hypothesis mode), App Store reviews (App Gap mode),
    // selected apps, and cross-store lookup
    console.log('Step 3: Fetching data using pipeline step')
    lastErrorSource = 'arctic_shift' // Reddit/App Store data APIs

    const dataFetchResult = await executeStep(dataFetcherStep, {
      subreddits: subredditsToSearch,
      keywords: extractedKeywords,
      hypothesis,
      selectedDataSources,
      selectedApps,
      sampleSizePerSource,
      subredditVelocities,
    }, ctx)

    let rawPosts = dataFetchResult.data?.posts || []
    let rawComments = dataFetchResult.data?.comments || []
    const fetchedSources = dataFetchResult.data?.sources || []
    crossStoreAppData = dataFetchResult.data?.crossStoreAppData

    // Keywords for search - used in expansion logic later
    const searchKeywords = extractedKeywords.primary.length > 0
      ? extractedKeywords.primary
      : extractKeywords(hypothesis) // Fallback to basic extraction

    console.log(`Fetched ${rawPosts.length} posts, ${rawComments.length} comments from ${fetchedSources.join(' + ') || 'sources'}`)

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
        const coreAppName = extractCoreAppName(appData.name)
        const appNameRegex = buildAppNameRegex(coreAppName)

        // Filter signals for clustering (signals have nested post structure)
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
        const postsGateResult = applyAppNameGate(posts, appData)
        posts = postsGateResult.passed

        // Also update postCoreItems and postRelatedItems to match
        const coreGateResult = applyAppNameGate(postCoreItems, appData)
        postCoreItems = coreGateResult.passed

        const relatedGateResult = applyAppNameGate(postRelatedItems, appData)
        postRelatedItems = relatedGateResult.passed

        // Update filtering metrics to reflect the additional filter
        if (postsGateResult.stats.removed > 0) {
          console.log(`  Pain analysis: ${postsGateResult.stats.removed} Reddit posts removed (no app mention)`)
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
      // Filter CORE items
      const coreResult = applyAppNameGate(finalCoreItems, appData)
      finalCoreItems = coreResult.passed
      logAppNameGateResult(coreResult, 'App Name Gate - CORE')

      // Filter RELATED items
      const relatedResult = applyAppNameGate(finalRelatedItems, appData)
      finalRelatedItems = relatedResult.passed
      logAppNameGateResult(relatedResult, 'App Name Gate - RELATED')

      // Filter comments
      const commentsResult = applyAppNameGate(finalComments, appData)
      finalComments = commentsResult.passed
      if (commentsResult.stats.removed > 0) {
        logAppNameGateResult(commentsResult, 'App Name Gate - Comments')
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

    // =========================================================================
    // Step 5: Pain Analysis (using pipeline step)
    // =========================================================================
    console.log('Step 5: Analyzing pain signals')
    const painResult = await executeStep(painAnalyzerStep, {
      corePosts: finalCoreItems,
      relatedPosts: finalRelatedItems,
      comments: finalComments,
      subredditWeights,
    }, ctx)

    // Get pain signals and summary from step
    // (includes praise filtering AND semantic categorization for App Gap mode)
    const filteredPainSignals = painResult.data?.painSignals || []
    const painSummary = painResult.data?.painSummary || getPainSummary([])

    // =========================================================================
    // Step 7-8: Theme Analysis + Interview Questions (using pipeline step)
    // =========================================================================
    console.log('Step 7-8: Theme analysis and interview questions')
    const themeResult = await executeStep(themeAnalyzerStep, {
      painSignals: filteredPainSignals,
      hypothesis,
    }, ctx)

    const themeAnalysis = themeResult.data?.themeAnalysis || getEmptyAnalysis()
    const interviewQuestions = themeResult.data?.interviewQuestions || {
      contextQuestions: [],
      problemQuestions: [],
      solutionQuestions: [],
    }

    // =========================================================================
    // Step 9-10: Market Sizing + Timing Analysis (using pipeline step)
    // =========================================================================
    console.log('Step 9-10: Market sizing and timing analysis')
    const marketResult = await executeStep(marketAnalyzerStep, {
      hypothesis,
      targetGeography,
      mscTarget,
      targetPrice,
    }, ctx)

    const marketSizing = marketResult.data?.marketSizing
    const timing = marketResult.data?.timing

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
        dataSources: fetchedSources.length > 0 ? fetchedSources : ['Reddit'],
        filteringMetrics,
        tokenUsage: tokenUsage || undefined,
        // Include all Y/N decisions for quality audit
        relevanceDecisions: {
          posts: postRelevanceDecisions,
          comments: commentFilterResult.decisions,
        },
        // Cross-store app data (e.g., Play Store app when user submitted App Store URL)
        crossStoreAppData: crossStoreAppData || undefined,
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

        // Step 11a: Auto-detect competitors (using pipeline step)
        const competitorDetectionResult = await executeStep(competitorDetectorStep, {
          painSignals: filteredPainSignals,
          maxCompetitors: 8,
        }, ctx)

        const uniqueCompetitors = competitorDetectionResult.data?.competitors || []
        console.log(`Final competitor list (${uniqueCompetitors.length}):`, uniqueCompetitors)

        // Step 11b: Run competitor analysis
        let competitorResult: CompetitorIntelligenceResult | null = null
        try {
          let analyzedAppName: string | null = null
          if (appData?.name) {
            const coreAppName = extractCoreAppName(appData.name)
            if (appData.developer) {
              analyzedAppName = `${coreAppName}|${appData.developer.toLowerCase().trim()}`
            } else {
              analyzedAppName = coreAppName
            }
          }

          competitorResult = await analyzeCompetitors({
            hypothesis,
            knownCompetitors: uniqueCompetitors.length > 0 ? uniqueCompetitors : undefined,
            geography: targetGeography ? {
              location: targetGeography.location,
              scope: targetGeography.scope,
            } : undefined,
            clusters: result.clusters,
            maxCompetitors: 8,
            analyzedAppName,
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
