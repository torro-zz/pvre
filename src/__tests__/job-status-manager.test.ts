import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { RedditPost, RedditComment } from '@/lib/data-sources/types'

const mockCheckUserCredits = vi.fn()
const mockDeductCredit = vi.fn()
const mockFilterRelevantPosts = vi.fn()
const mockFilterRelevantComments = vi.fn()
const mockExecuteStep = vi.fn()
const mockSaveResearchResult = vi.fn()
const mockAnalyzeCompetitors = vi.fn()
const mockStartTokenTracking = vi.fn()
const mockEndTokenTracking = vi.fn()
const mockGetCurrentTracker = vi.fn()
const mockFetchMultiSourceData = vi.fn()

const updateCalls: Array<{ table: string; data: Record<string, unknown> }> = []
const adminChain = {
  update: vi.fn((data: Record<string, unknown>) => {
    updateCalls.push({ table: adminChain.table, data })
    return adminChain
  }),
  eq: vi.fn(() => adminChain),
  select: vi.fn(() => adminChain),
  single: vi.fn(),
  table: '',
}

vi.mock('@/lib/credits', () => ({
  checkUserCredits: mockCheckUserCredits,
  deductCredit: mockDeductCredit,
}))

vi.mock('@/lib/research/relevance-filter', () => ({
  filterRelevantPosts: mockFilterRelevantPosts,
  filterRelevantComments: mockFilterRelevantComments,
  RelevanceDecision: {},
}))

vi.mock('@/lib/data-sources', () => ({
  fetchMultiSourceData: mockFetchMultiSourceData,
  extractKeywords: vi.fn((hypothesis: string) => hypothesis.split(' ')),
}))

vi.mock('@/lib/reddit/keyword-extractor', () => ({
  preFilterByExcludeKeywords: vi.fn((items: RedditPost[] | RedditComment[]) => items),
}))

vi.mock('@/lib/analysis/subreddit-weights', () => ({
  getSubredditWeights: vi.fn().mockResolvedValue(new Map()),
}))

vi.mock('@/lib/filter', () => ({
  USE_TWO_STAGE_FILTER: false,
  USE_TIERED_FILTER: false,
  filterSignalsTiered: vi.fn(),
  getSignalsForAnalysis: vi.fn(),
  filterSignals: vi.fn(),
}))

vi.mock('@/lib/adapters', () => ({
  bridgeRedditPostsToNormalized: vi.fn((posts: RedditPost[]) => posts),
  mapVerifiedToRedditPosts: vi.fn(),
}))

vi.mock('@/lib/anthropic', () => ({
  startTokenTracking: mockStartTokenTracking,
  endTokenTracking: mockEndTokenTracking,
  getCurrentTracker: mockGetCurrentTracker,
}))

vi.mock('@/lib/api-costs', () => ({
  recordApiCostsBatch: vi.fn(),
}))

vi.mock('@/lib/research/save-result', () => ({
  saveResearchResult: mockSaveResearchResult,
}))

vi.mock('@/lib/research/competitor-analyzer', () => ({
  analyzeCompetitors: mockAnalyzeCompetitors,
}))

vi.mock('@/lib/research/pipeline', async () => {
  const actual = await vi.importActual<typeof import('@/lib/research/pipeline')>(
    '@/lib/research/pipeline'
  )
  return {
    ...actual,
    executeStep: mockExecuteStep,
  }
})

vi.mock('@/lib/research/steps', () => ({
  keywordExtractorStep: { name: 'Keyword Extractor' },
  subredditDiscoveryStep: { name: 'Subreddit Discovery' },
  dataFetcherStep: { name: 'Data Fetcher' },
  painAnalyzerStep: { name: 'Pain Analyzer' },
  themeAnalyzerStep: { name: 'Theme Analyzer' },
  marketAnalyzerStep: { name: 'Market Analyzer' },
  competitorDetectorStep: { name: 'Competitor Detector' },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-456' } },
        error: null,
      }),
    },
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      adminChain.table = table
      return adminChain
    }),
  })),
}))

function createMockPost(id: string): RedditPost {
  return {
    id,
    title: `Title ${id}`,
    body: `Body for ${id} with enough content to pass filters.`,
    author: 'author',
    subreddit: 'testsub',
    score: 1,
    numComments: 0,
    createdUtc: Date.now() / 1000,
    permalink: `/r/testsub/${id}`,
    url: `https://example.com/${id}`,
  }
}

function createMockComment(id: string): RedditComment {
  return {
    id,
    body: `Comment ${id} with enough content to pass filters.`,
    author: 'author',
    subreddit: 'testsub',
    score: 1,
    createdUtc: Date.now() / 1000,
    parentId: 'parent',
    postId: 'post',
    permalink: `/r/testsub/${id}`,
  }
}

describe('Job Status Manager (characterization)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateCalls.length = 0
    adminChain.single.mockResolvedValue({ data: { coverage_data: {} } })
    mockCheckUserCredits.mockResolvedValue({ hasCredits: true, balance: 1 })
    mockDeductCredit.mockResolvedValue(true)
    mockExecuteStep.mockImplementation(async (step) => {
      if (step.name === 'Keyword Extractor') {
        return {
          data: {
            primary: ['async'],
            secondary: [],
            exclude: [],
            searchContext: 'async collaboration',
          },
          skipped: false,
          durationMs: 1,
        }
      }
      if (step.name === 'Subreddit Discovery') {
        return {
          data: { subreddits: ['testsub'], subredditWeights: new Map() },
          skipped: false,
          durationMs: 1,
        }
      }
      if (step.name === 'Data Fetcher') {
        return {
          data: {
            posts: Array.from({ length: 30 }, (_, i) => createMockPost(`post-${i}`)),
            comments: [createMockComment('comment-1')],
            sources: ['Reddit'],
          },
          skipped: false,
          durationMs: 1,
        }
      }
      if (step.name === 'Competitor Detector') {
        return {
          data: { competitors: [] },
          skipped: false,
          durationMs: 1,
        }
      }
      return { data: null, skipped: false, durationMs: 1 }
    })
    mockFilterRelevantPosts.mockResolvedValue({
      items: Array.from({ length: 30 }, (_, i) => createMockPost(`filtered-${i}`)),
      coreItems: Array.from({ length: 15 }, (_, i) => createMockPost(`core-${i}`)),
      relatedItems: Array.from({ length: 15 }, (_, i) => createMockPost(`related-${i}`)),
      metrics: {
        before: 30,
        after: 30,
        filteredOut: 0,
        filterRate: 0,
        coreSignals: 15,
        relatedSignals: 15,
        titleOnlyPosts: 0,
        preFilterSkipped: 0,
        stage2FilterRate: 0,
        narrowProblemWarning: false,
        stage3Filtered: 0,
        embeddingFiltered: 0,
        embeddingHighSimilarity: 0,
        embeddingMediumSimilarity: 0,
        stage1Filtered: 0,
        stage2Filtered: 0,
      },
      decisions: [],
    })
    mockFilterRelevantComments.mockResolvedValue({
      items: [createMockComment('comment-1')],
      metrics: {
        before: 1,
        after: 1,
        filteredOut: 0,
        filterRate: 0,
        stage3Filtered: 0,
        preFilterSkipped: 0,
        embeddingFiltered: 0,
        embeddingHighSimilarity: 0,
        embeddingMediumSimilarity: 0,
        stage2Filtered: 0,
      },
      decisions: [],
    })
    mockSaveResearchResult.mockResolvedValue(undefined)
    mockAnalyzeCompetitors.mockResolvedValue({
      hypothesis: 'async teams need better handoffs',
      marketOverview: {
        marketSize: 'n/a',
        growthTrend: 'n/a',
        maturityLevel: 'emerging',
        competitionIntensity: 'low',
        summary: 'n/a',
      },
      competitors: [],
      competitorMatrix: { categories: [], comparison: [] },
      gaps: [],
      positioningRecommendations: [],
      competitionScore: {
        score: 1,
        confidence: 'low',
        reasoning: 'n/a',
        factors: {
          competitorCount: { value: 0, impact: 0 },
          fundingLevels: { description: 'n/a', impact: 0 },
          userSatisfaction: { average: 0, impact: 0 },
          marketGaps: { count: 0, impact: 0 },
          priceHeadroom: { exists: false, impact: 0 },
        },
        threats: [],
      },
      metadata: {
        competitorsAnalyzed: 0,
        processingTimeMs: 1,
        timestamp: new Date().toISOString(),
      },
    })
    mockStartTokenTracking.mockImplementation(() => undefined)
    mockEndTokenTracking.mockReturnValue(null)
    mockGetCurrentTracker.mockReturnValue({ calls: [] })
  })

  it('updates step_status through competitor analysis completion', async () => {
    const { POST } = await import('@/app/api/research/community-voice/route')
    const request = new NextRequest('http://localhost/api/research/community-voice', {
      method: 'POST',
      body: JSON.stringify({
        hypothesis: 'async teams need better handoffs',
        jobId: 'job-123',
      }),
      headers: { 'content-type': 'application/json' },
    })

    const response = await POST(request)
    expect(response.status).toBe(200)

    const stepStatusUpdates = updateCalls
      .filter((call) => call.table === 'research_jobs' && call.data.step_status)
      .map((call) => call.data)

    expect(stepStatusUpdates).toEqual([
      {
        status: 'processing',
        step_status: {
          pain_analysis: 'completed',
          market_sizing: 'completed',
          timing_analysis: 'completed',
          competitor_analysis: 'in_progress',
        },
      },
      {
        status: 'completed',
        step_status: {
          pain_analysis: 'completed',
          market_sizing: 'completed',
          timing_analysis: 'completed',
          competitor_analysis: 'completed',
        },
      },
    ])

    expect(mockSaveResearchResult).toHaveBeenCalledWith(
      'job-123',
      'community_voice',
      expect.any(Object)
    )
    expect(mockSaveResearchResult).toHaveBeenCalledWith(
      'job-123',
      'competitor_intelligence',
      expect.any(Object)
    )
  })
})
