import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { RedditPost, RedditComment } from '@/lib/data-sources/types'

const mockCheckUserCredits = vi.fn()
const mockDeductCredit = vi.fn()
const mockDiscoverSubreddits = vi.fn()
const mockFetchMultiSourceData = vi.fn()
const mockFilterRelevantPosts = vi.fn()
const mockFilterRelevantComments = vi.fn()
const mockExecuteStep = vi.fn()
const mockStartTokenTracking = vi.fn()
const mockEndTokenTracking = vi.fn()
const mockGetCurrentTracker = vi.fn()

vi.mock('@/lib/credits', () => ({
  checkUserCredits: mockCheckUserCredits,
  deductCredit: mockDeductCredit,
}))

vi.mock('@/lib/reddit/subreddit-discovery', () => ({
  discoverSubreddits: mockDiscoverSubreddits,
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

vi.mock('@/lib/anthropic', () => ({
  startTokenTracking: mockStartTokenTracking,
  endTokenTracking: mockEndTokenTracking,
  getCurrentTracker: mockGetCurrentTracker,
}))

vi.mock('@/lib/api-costs', () => ({
  recordApiCostsBatch: vi.fn(),
}))

vi.mock('@/lib/research/save-result', () => ({
  saveResearchResult: vi.fn(),
}))

vi.mock('@/lib/research/relevance-filter', () => ({
  filterRelevantPosts: mockFilterRelevantPosts,
  filterRelevantComments: mockFilterRelevantComments,
  RelevanceDecision: {},
}))

vi.mock('@/lib/filter', () => ({
  USE_TWO_STAGE_FILTER: false,
  USE_TIERED_FILTER: true,
  filterSignalsTiered: vi.fn().mockResolvedValue({
    core: [],
    strong: [],
    related: [],
    adjacent: [],
    stats: { total: 0, processingTimeMs: 1 },
  }),
  getSignalsForAnalysis: vi.fn().mockReturnValue([]),
  filterSignals: vi.fn(),
}))

vi.mock('@/lib/adapters', () => ({
  bridgeRedditPostsToNormalized: vi.fn((posts: RedditPost[]) => posts),
  mapVerifiedToRedditPosts: vi.fn(),
}))

vi.mock('@/lib/embeddings', () => ({
  clusterSignals: vi.fn(),
}))

vi.mock('@/lib/research/competitor-analyzer', () => ({
  analyzeCompetitors: vi.fn(),
}))

vi.mock('@/lib/research/gates/app-name-gate', () => ({
  applyAppNameGate: vi.fn((items: RedditPost[]) => ({
    passed: items,
    stats: { removed: 0 },
  })),
  extractCoreAppName: vi.fn(),
  buildAppNameRegex: vi.fn(),
  logAppNameGateResult: vi.fn(),
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
        data: { user: { id: 'user-123' } },
        error: null,
      }),
    },
  }),
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

describe('Adaptive Fetcher (characterization)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckUserCredits.mockResolvedValue({ hasCredits: true, balance: 1 })
    mockDeductCredit.mockResolvedValue(true)
    mockDiscoverSubreddits.mockResolvedValue({ subreddits: ['extrasub'] })
    mockFetchMultiSourceData.mockResolvedValue({
      posts: [createMockPost('extra-post')],
      comments: [createMockComment('extra-comment')],
      sources: ['Reddit'],
    })
    mockFilterRelevantPosts.mockResolvedValue({
      items: [createMockPost('extra-post')],
      coreItems: [createMockPost('extra-post')],
      relatedItems: [],
      metrics: { coreSignals: 1, relatedSignals: 0, after: 1 },
      decisions: [],
    })
    mockFilterRelevantComments.mockImplementation(async (comments: RedditComment[]) => ({
      items: comments,
      metrics: {
        before: comments.length,
        after: comments.length,
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
    }))
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
            posts: [createMockPost('seed-post')],
            comments: [],
            sources: ['Reddit'],
          },
          skipped: false,
          durationMs: 1,
        }
      }
      return { data: null, skipped: false, durationMs: 1 }
    })
    mockStartTokenTracking.mockImplementation(() => undefined)
    mockEndTokenTracking.mockReturnValue(null)
    mockGetCurrentTracker.mockReturnValue(null)
  })

  it('uses legacy filters for adaptive expansion when tiered is active', async () => {
    const { POST } = await import('@/app/api/research/community-voice/route')
    const request = new NextRequest('http://localhost/api/research/community-voice', {
      method: 'POST',
      body: JSON.stringify({ hypothesis: 'async teams need better handoffs' }),
      headers: { 'content-type': 'application/json' },
    })

    const response = await POST(request)
    const data = await response.json()

    expect(mockDiscoverSubreddits).toHaveBeenCalledTimes(1)
    expect(mockFetchMultiSourceData).toHaveBeenCalledTimes(1)
    expect(mockFilterRelevantPosts).toHaveBeenCalledTimes(1)
    expect(mockFilterRelevantComments).toHaveBeenCalledTimes(2)

    const attempts = data?.metadata?.filteringMetrics?.expansionAttempts || []
    expect(attempts).toHaveLength(1)
    expect(attempts[0]).toMatchObject({
      type: 'communities',
      value: 'extrasub',
      success: true,
      signalsGained: 2,
    })
  })
})
