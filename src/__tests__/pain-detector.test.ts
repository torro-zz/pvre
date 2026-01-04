import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  calculatePainScore,
  getPainSummary,
  calculateOverallPainScore,
  analyzePosts,
  isPraiseByEmbedding,
  getPraiseFilter,
  filterPraiseSignals,
  resetPraiseFilter,
  type PainSignal,
  type EmotionsBreakdown,
  type PraiseFilterResult,
} from '@/lib/analysis/pain-detector'
import type { RedditPost } from '@/lib/data-sources/types'
import * as embeddingService from '@/lib/embeddings/embedding-service'

// Mock the embedding service for unit tests (no API calls)
vi.mock('@/lib/embeddings/embedding-service', () => ({
  generateEmbedding: vi.fn(),
  generateEmbeddings: vi.fn(),
  cosineSimilarity: vi.fn((a: number[], b: number[]) => {
    // Simple mock: if both arrays have same first element, they're "similar"
    if (!a || !b || a.length === 0 || b.length === 0) return 0
    // Calculate actual cosine similarity for mock vectors
    let dotProduct = 0
    let normA = 0
    let normB = 0
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB)
    return denominator === 0 ? 0 : dotProduct / denominator
  }),
}))

// Get mocked functions for use in tests
const mockedEmbeddingService = vi.mocked(embeddingService)

// Default values for PainSummary fields added in v3.0 and v4.0
const defaultSummaryFields = {
  temporalDistribution: {
    last30Days: 0,
    last90Days: 0,
    last180Days: 0,
    older: 0,
  },
  recencyScore: 0.5,
  emotionsBreakdown: {
    frustration: 0,
    anxiety: 0,
    disappointment: 0,
    confusion: 0,
    hope: 0,
    neutral: 0,
  } as EmotionsBreakdown,
}

describe('Pain Detector', () => {
  describe('calculatePainScore', () => {
    describe('High intensity keywords', () => {
      it('should detect high intensity keywords and assign high score', () => {
        const result = calculatePainScore('This is a nightmare, I am so frustrated with this terrible experience')

        expect(result.highIntensityCount).toBeGreaterThan(0)
        expect(result.signals).toContain('nightmare')
        expect(result.signals).toContain('frustrated')
        expect(result.signals).toContain('terrible')
        expect(result.score).toBeGreaterThanOrEqual(7)
      })

      it('should detect frustration cluster keywords', () => {
        const result = calculatePainScore("I'm at my wit's end, fed up with this broken system")

        expect(result.highIntensityCount).toBeGreaterThan(0)
        expect(result.signals.some(s => s.includes('fed up') || s.includes("wit's end") || s.includes('broken'))).toBe(true)
      })

      it('should detect exhaustion/burnout keywords', () => {
        const result = calculatePainScore('This process is exhausting, I feel overwhelmed and burnt out')

        expect(result.highIntensityCount).toBeGreaterThan(0)
        expect(result.signals).toContain('exhausting')
        expect(result.signals).toContain('overwhelmed')
      })
    })

    describe('Medium intensity keywords', () => {
      it('should detect medium intensity keywords', () => {
        const result = calculatePainScore('I am struggling with this difficult problem')

        expect(result.mediumIntensityCount).toBeGreaterThan(0)
        expect(result.signals).toContain('struggling')
        expect(result.signals).toContain('difficult')
        expect(result.signals).toContain('problem')
      })

      it('should detect confusion cluster keywords', () => {
        const result = calculatePainScore('This is confusing and overwhelming, the documentation is unclear')

        expect(result.mediumIntensityCount).toBeGreaterThan(0)
        expect(result.signals).toContain('confusing')
        expect(result.signals).toContain('unclear')
      })
    })

    describe('Low intensity keywords', () => {
      it('should detect low intensity keywords', () => {
        const result = calculatePainScore('I am wondering about this, maybe it could be better')

        expect(result.lowIntensityCount).toBeGreaterThan(0)
        expect(result.signals).toContain('wondering')
        expect(result.signals).toContain('maybe')
      })

      it('should cap score for only low intensity signals', () => {
        const result = calculatePainScore('Sometimes I wonder if there could be a better way')

        // With only low intensity signals, score should be capped at 4.0
        expect(result.score).toBeLessThanOrEqual(4.0)
      })
    })

    describe('Solution-seeking keywords', () => {
      it('should detect solution-seeking keywords', () => {
        const result = calculatePainScore('Looking for recommendations, anyone know a better way to do this?')

        expect(result.solutionSeekingCount).toBeGreaterThan(0)
        expect(result.signals).toContain('looking for')
        expect(result.signals).toContain('recommendations')
        expect(result.signals).toContain('anyone know')
      })

      it('should boost score for pain + solution seeking combo', () => {
        const painOnly = calculatePainScore('This is frustrating and terrible')
        const painWithSolution = calculatePainScore('This is frustrating and terrible, looking for recommendations')

        expect(painWithSolution.score).toBeGreaterThan(painOnly.score)
      })
    })

    describe('Willingness to pay keywords', () => {
      it('should detect strong WTP intent', () => {
        const result = calculatePainScore("I would pay for this, take my money, it's worth every penny")

        expect(result.willingnessToPayCount).toBeGreaterThan(0)
        expect(result.wtpConfidence).toBe('high')
      })

      it('should detect financial discussion keywords', () => {
        const result = calculatePainScore('What is the pricing? I need to plan my budget for this subscription')

        expect(result.willingnessToPayCount).toBeGreaterThan(0)
        expect(['medium', 'high']).toContain(result.wtpConfidence)
      })

      it('should exclude WTP when exclusion patterns match', () => {
        const result = calculatePainScore('The budget was cut, pricing is ridiculous, cannot afford this')

        expect(result.hasWTPExclusion).toBe(true)
        expect(result.wtpConfidence).toBe('none')
      })

      // v7.0: Purchase regret detection
      it('should exclude WTP for refund requests', () => {
        const result = calculatePainScore('I want my money back, this is not worth the subscription cost')

        expect(result.hasWTPExclusion).toBe(true)
        expect(result.wtpConfidence).toBe('none')
      })

      it('should exclude WTP for buyer remorse', () => {
        const result = calculatePainScore('I regret buying the premium version, it was a waste of money')

        expect(result.hasWTPExclusion).toBe(true)
        expect(result.wtpConfidence).toBe('none')
      })

      it('should exclude WTP for questioning past purchase value', () => {
        // This is the exact example from KNOWN_ISSUES
        const result = calculatePainScore(
          "I just upgraded to the paid version... now I'm debating if that was worth the investment - I seriously feel like I should get my money back"
        )

        expect(result.hasWTPExclusion).toBe(true)
        expect(result.wtpConfidence).toBe('none')
      })

      it('should still detect genuine WTP intent', () => {
        const result = calculatePainScore("I'd pay for a better alternative that actually works")

        expect(result.hasWTPExclusion).toBe(false)
        expect(result.wtpConfidence).not.toBe('none')
      })
    })

    describe('Negative context filtering', () => {
      it('should detect and penalize negative context patterns', () => {
        const negativeContext = calculatePainScore('I hate the competition, they are terrible at marketing')
        const realPain = calculatePainScore('I hate this product, it is terrible to use')

        expect(negativeContext.hasNegativeContext).toBe(true)
        expect(negativeContext.score).toBeLessThan(realPain.score)
      })

      it('should detect hypothetical statements', () => {
        const result = calculatePainScore('It would be terrible if you were struggling with this')

        expect(result.hasNegativeContext).toBe(true)
      })

      it('should detect past tense resolved issues', () => {
        const result = calculatePainScore('I used to be frustrated but now everything is great')

        expect(result.hasNegativeContext).toBe(true)
      })
    })

    describe('Score calculation', () => {
      it('should return 0 for text with no pain signals', () => {
        const result = calculatePainScore('Everything is great and working perfectly')

        expect(result.score).toBe(0)
        expect(result.signals).toHaveLength(0)
      })

      it('should not exceed 10', () => {
        const result = calculatePainScore(
          'This is a nightmare, terrible, awful, horrible, frustrating disaster. ' +
          'I am exhausted, overwhelmed, fed up, sick of, tired of this. ' +
          'Would pay anything to fix this, looking for help, anyone know a solution?'
        )

        expect(result.score).toBeLessThanOrEqual(10)
      })

      it('should apply engagement multiplier with cap', () => {
        const lowEngagement = calculatePainScore('This is frustrating', 1)
        const highEngagement = calculatePainScore('This is frustrating', 10000)

        // High engagement should give a boost but not more than 1.2x
        expect(highEngagement.score).toBeGreaterThanOrEqual(lowEngagement.score)
        expect(highEngagement.score).toBeLessThanOrEqual(lowEngagement.score * 1.3)
      })
    })

    describe('Word boundary matching', () => {
      it('should match whole words only for single-word keywords', () => {
        const hardlyResult = calculatePainScore('This is hardly a problem')
        const hardResult = calculatePainScore('This is really hard to do')

        // "hardly" should not match "hard"
        expect(hardlyResult.signals.includes('hard')).toBe(false)
        expect(hardResult.signals.includes('hard')).toBe(true)
      })

      it('should match multi-word phrases with simple includes', () => {
        const result = calculatePainScore("I'm at my wit's end with this")

        expect(result.signals).toContain("at my wit's end")
      })
    })
  })

  describe('getPainSummary', () => {
    const mockSignals: PainSignal[] = [
      {
        text: 'High intensity pain',
        score: 9,
        intensity: 'high',
        signals: ['nightmare', 'terrible'],
        emotion: 'frustration',
        solutionSeeking: true,
        willingnessToPaySignal: true,
        wtpConfidence: 'high',
        source: {
          type: 'post',
          id: '1',
          subreddit: 'startups',
          author: 'user1',
          url: 'https://reddit.com/r/startups/1',
          createdUtc: Date.now() / 1000,
          engagementScore: 5,
        },
      },
      {
        text: 'Medium intensity pain',
        score: 6,
        intensity: 'medium',
        signals: ['struggling', 'difficult'],
        emotion: 'anxiety',
        solutionSeeking: false,
        willingnessToPaySignal: false,
        wtpConfidence: 'none',
        source: {
          type: 'post',
          id: '2',
          subreddit: 'entrepreneur',
          author: 'user2',
          url: 'https://reddit.com/r/entrepreneur/2',
          createdUtc: Date.now() / 1000,
          engagementScore: 3,
        },
      },
      {
        text: 'Low intensity pain',
        score: 2,
        intensity: 'low',
        signals: ['wondering'],
        emotion: 'neutral',
        solutionSeeking: false,
        willingnessToPaySignal: false,
        wtpConfidence: 'none',
        source: {
          type: 'comment',
          id: '3',
          subreddit: 'startups',
          author: 'user3',
          url: 'https://reddit.com/r/startups/1/3',
          createdUtc: Date.now() / 1000,
          engagementScore: 1,
        },
      },
    ]

    it('should calculate correct total signals', () => {
      const summary = getPainSummary(mockSignals)

      expect(summary.totalSignals).toBe(3)
    })

    it('should calculate correct average score', () => {
      const summary = getPainSummary(mockSignals)

      const expectedAverage = (9 + 6 + 2) / 3
      expect(summary.averageScore).toBeCloseTo(expectedAverage, 1)
    })

    it('should count intensity levels correctly', () => {
      const summary = getPainSummary(mockSignals)

      expect(summary.highIntensityCount).toBe(1)
      expect(summary.mediumIntensityCount).toBe(1)
      expect(summary.lowIntensityCount).toBe(1)
    })

    it('should count solution seeking signals', () => {
      const summary = getPainSummary(mockSignals)

      expect(summary.solutionSeekingCount).toBe(1)
    })

    it('should count WTP signals', () => {
      const summary = getPainSummary(mockSignals)

      expect(summary.willingnessToPayCount).toBe(1)
    })

    it('should rank subreddits by count', () => {
      const summary = getPainSummary(mockSignals)

      expect(summary.topSubreddits[0].name).toBe('startups')
      expect(summary.topSubreddits[0].count).toBe(2)
    })

    it('should collect strongest signals', () => {
      const summary = getPainSummary(mockSignals)

      expect(summary.strongestSignals.length).toBeGreaterThan(0)
    })

    it('should handle empty signals array', () => {
      const summary = getPainSummary([])

      expect(summary.totalSignals).toBe(0)
      expect(summary.averageScore).toBe(0)
      expect(summary.dataConfidence).toBe('very_low')
    })

    it('should determine data confidence based on volume', () => {
      // Create many signals to test confidence
      const manySignals = Array(200).fill(mockSignals[0])
      const summary = getPainSummary(manySignals)

      expect(summary.dataConfidence).toBe('high')
    })
  })

  describe('calculateOverallPainScore', () => {
    it('should return 0 for empty summary', () => {
      const summary = getPainSummary([])
      const result = calculateOverallPainScore(summary)

      expect(result.score).toBe(0)
      expect(result.confidence).toBe('very_low')
    })

    it('should boost score for high WTP ratio', () => {
      const highWTPSummary = {
        totalSignals: 100,
        averageScore: 5,
        highIntensityCount: 30,
        mediumIntensityCount: 40,
        lowIntensityCount: 30,
        solutionSeekingCount: 20,
        willingnessToPayCount: 10, // 10% WTP ratio > 5% threshold
        topSubreddits: [],
        dataConfidence: 'medium' as const,
        strongestSignals: ['frustrated'],
        wtpQuotes: [],
        ...defaultSummaryFields,
      }

      const result = calculateOverallPainScore(highWTPSummary)

      // Should be boosted above average score
      expect(result.score).toBeGreaterThan(highWTPSummary.averageScore)
    })

    it('should penalize low quality signals', () => {
      const lowQualitySummary = {
        totalSignals: 100,
        averageScore: 4,
        highIntensityCount: 5, // < 10%
        mediumIntensityCount: 10,
        lowIntensityCount: 85, // > 60%
        solutionSeekingCount: 10,
        willingnessToPayCount: 0,
        topSubreddits: [],
        dataConfidence: 'low' as const,
        strongestSignals: ['wondering'],
        wtpQuotes: [],
        ...defaultSummaryFields,
      }

      const result = calculateOverallPainScore(lowQualitySummary)

      // Should be penalized below average score
      expect(result.score).toBeLessThan(lowQualitySummary.averageScore)
    })

    it('should heavily penalize no high/medium intensity signals', () => {
      const noQualitySummary = {
        totalSignals: 50,
        averageScore: 3,
        highIntensityCount: 0,
        mediumIntensityCount: 0,
        lowIntensityCount: 50,
        solutionSeekingCount: 10,
        willingnessToPayCount: 0,
        topSubreddits: [],
        dataConfidence: 'low' as const,
        strongestSignals: ['wondering'],
        wtpQuotes: [],
        ...defaultSummaryFields,
      }

      const result = calculateOverallPainScore(noQualitySummary)

      // Should be heavily penalized (50% reduction)
      expect(result.score).toBeLessThanOrEqual(noQualitySummary.averageScore * 0.5)
    })

    it('should provide meaningful reasoning', () => {
      const goodSummary = {
        totalSignals: 100,
        averageScore: 7,
        highIntensityCount: 40,
        mediumIntensityCount: 40,
        lowIntensityCount: 20,
        solutionSeekingCount: 30,
        willingnessToPayCount: 10,
        topSubreddits: [],
        dataConfidence: 'high' as const,
        strongestSignals: ['frustrated', 'struggling', 'nightmare'],
        wtpQuotes: [],
        ...defaultSummaryFields,
      }

      const result = calculateOverallPainScore(goodSummary)

      expect(result.reasoning).toBeTruthy()
      expect(result.reasoning.length).toBeGreaterThan(10)
    })
  })

  // ==========================================================================
  // v8.0: Praise-Only Filter Tests
  // ==========================================================================
  describe('Praise Filter', () => {
    // Helper to create a mock post
    const createMockPost = (body: string, rating?: number): RedditPost & { rating?: number } => ({
      id: 'test-1',
      title: 'Test Review',
      body,
      author: 'testuser',
      subreddit: 'TestApp',
      score: 10,
      numComments: 5,
      createdUtc: Date.now() / 1000,
      rating,
    })

    it('should filter out pure praise reviews (no pain signals)', () => {
      const praisePost = createMockPost(
        "I'm obsessed with Loom. Game changer! Nothing bad to say about it.",
        5
      )

      const results = analyzePosts([praisePost])

      expect(results.length).toBe(0) // Should be filtered out
    })

    it('should filter out testimonials with no actionable feedback', () => {
      const testimonialPost = createMockPost(
        "No idea how I followed up with people prior to using Loom. Game changer!",
        5
      )

      const results = analyzePosts([testimonialPost])

      expect(results.length).toBe(0) // Should be filtered out
    })

    it('should KEEP mixed reviews (praise + complaint)', () => {
      const mixedPost = createMockPost(
        "I love using Loom instead of email, but the mobile app crashes frequently.",
        4
      )

      const results = analyzePosts([mixedPost])

      // Should keep this - has actionable pain ("crashes")
      expect(results.length).toBe(1)
      expect(results[0].text).toContain('crashes')
    })

    it('should KEEP low-rated reviews even with praise phrases', () => {
      const lowRatedPraise = createMockPost(
        "I used to love this app, but now it's broken and useless.",
        2
      )

      const results = analyzePosts([lowRatedPraise])

      // Low rating (2 stars) = always has pain, should keep
      expect(results.length).toBe(1)
    })

    it('should KEEP reviews with feature requests', () => {
      const featureRequest = createMockPost(
        "This app is amazing! I wish there was dark mode support, could be better for night use.",
        5
      )

      const results = analyzePosts([featureRequest])

      // Should keep - has actionable feedback ("wish there was", "could be better")
      expect(results.length).toBe(1)
    })

    it('should KEEP reviews mentioning bugs even with praise', () => {
      const bugReport = createMockPost(
        "Great app overall, highly recommend it! However there is a bug where videos don't sync.",
        5
      )

      const results = analyzePosts([bugReport])

      // Should keep - has actionable pain ("bug", "however")
      expect(results.length).toBe(1)
    })

    it('should filter out short pure endorsements', () => {
      const shortPraise = createMockPost(
        "I love it! Best app ever. Highly recommend!",
        5
      )

      const results = analyzePosts([shortPraise])

      expect(results.length).toBe(0) // Short + praise + no complaints = filter
    })

    // ==========================================================================
    // v9.0: Context-Aware Praise Detection Tests
    // ==========================================================================
    describe('Context-Aware Can\'t Detection', () => {
      it('should filter "can\'t imagine doing without" as positive', () => {
        const positiveCant = createMockPost(
          "Writing up a huge email again instead of just recording a quick loom is something I can't imagine ever doing again. Love it!",
          5
        )

        const results = analyzePosts([positiveCant])

        // "Can't imagine ever doing again" is POSITIVE, should be filtered
        expect(results.length).toBe(0)
      })

      it('should filter "nothing bad to say" reviews', () => {
        const noBadToSay = createMockPost(
          "There is nothing bad to say about Loom. This platform allows me to communicate clearly with my clients.",
          5
        )

        const results = analyzePosts([noBadToSay])

        // Explicit "nothing bad to say" = pure praise
        expect(results.length).toBe(0)
      })

      it('should KEEP "can\'t figure out" as real complaint', () => {
        const realCantComplaint = createMockPost(
          "I can't figure out how to use this app. It's not working and I'm so frustrated with the whole experience.",
          3
        )

        const results = analyzePosts([realCantComplaint])

        // This is a REAL complaint - "can't figure out", "not working", "frustrated" are pain keywords
        expect(results.length).toBe(1)
        expect(results[0].text).toContain("can't figure out")
      })

      it('should filter "can\'t recommend enough" as positive', () => {
        const recommendEnough = createMockPost(
          "I can't recommend Loom enough. It's made my workflow so much better!",
          5
        )

        const results = analyzePosts([recommendEnough])

        // "Can't recommend enough" is POSITIVE
        expect(results.length).toBe(0)
      })

      it('should KEEP reviews with both positive can\'t AND real issues', () => {
        const mixedCant = createMockPost(
          "I can't imagine going back to email, but the mobile app is frustrating and keeps failing with errors. The problems are annoying.",
          4
        )

        const results = analyzePosts([mixedCant])

        // Has real complaints ("frustrating", "failing", "problems", "annoying"), should keep despite positive can't
        expect(results.length).toBe(1)
      })
    })

    // ==========================================================================
    // v10.1 TESTS: Expanded Praise Patterns (User-Reported Failures)
    // ==========================================================================
    describe('v10.1 Expanded Praise Filter', () => {
      it('should filter "Brilliant" standalone praise', () => {
        const brilliantPost = createMockPost(
          "Brilliant. Really brilliant. I'm super nervous around new people, but I'm super glad the app exists.",
          5
        )

        const results = analyzePosts([brilliantPost])

        // Pure praise with positive "but" - should be filtered
        expect(results.length).toBe(0)
      })

      it('should filter "Excellent concept" reviews', () => {
        const excellentPost = createMockPost(
          "Excellent concept. My first event didn't have any questions to start conversation. But everyone there was really cool and we had a great time.",
          5
        )

        const results = analyzePosts([excellentPost])

        // Praise + positive outcome ("but everyone was cool") - should be filtered
        expect(results.length).toBe(0)
      })

      it('should filter "10/10 loved" reviews', () => {
        const tenOutOfTen = createMockPost(
          "10/10 loved this - was nervous since I'm not very social but had a lot of fun and made a friend!",
          5
        )

        const results = analyzePosts([tenOutOfTen])

        // Rating expression + "loved" + positive outcome - should be filtered
        expect(results.length).toBe(0)
      })

      it('should filter "Very cool concept" with user-base issue', () => {
        const coolConcept = createMockPost(
          "Very cool concept! Walked around a park for 2 hours but didn't find anyone nearby.",
          4
        )

        const results = analyzePosts([coolConcept])

        // Praise + user-base issue (not functional) - should be filtered
        expect(results.length).toBe(0)
      })

      it('should filter "OMG amazing" exclamations', () => {
        const omgAmazing = createMockPost(
          "Omg this app is amazing! The countdown to the meet up is exciting and the meet ups I've had have been super fun!",
          5
        )

        const results = analyzePosts([omgAmazing])

        // Pure excitement praise - should be filtered
        expect(results.length).toBe(0)
      })

      it('should filter "Great experience" reviews', () => {
        const greatExperience = createMockPost(
          "First time going to something like this and it was great! Hoping to go to more!",
          5
        )

        const results = analyzePosts([greatExperience])

        // "great" + enthusiasm - should be filtered
        expect(results.length).toBe(0)
      })

      it('should filter "loved it" with social nervousness', () => {
        const lovedIt = createMockPost(
          "Loved it! Was nervous but the group was really kind and welcoming. Would definitely do again.",
          5
        )

        const results = analyzePosts([lovedIt])

        // "loved" + positive outcome ("but the group was kind") - should be filtered
        expect(results.length).toBe(0)
      })

      it('should KEEP reviews with functional issues after "but"', () => {
        const functionalIssue = createMockPost(
          "Great concept but the app doesn't work on my phone. It crashes every time I try to open it.",
          3
        )

        const results = analyzePosts([functionalIssue])

        // Real functional complaint ("doesn't work", "crashes") - should be kept
        expect(results.length).toBe(1)
      })

      it('should KEEP reviews with explicit issues', () => {
        const issueReport = createMockPost(
          "Love the idea of this app! However, there's an issue where notifications fail and I'm struggling with constant problems.",
          4
        )

        const results = analyzePosts([issueReport])

        // Has real complaints (issue, fail, struggling, problems) - should be kept
        expect(results.length).toBe(1)
      })
    })
  })
})

// =============================================================================
// EMBEDDING-BASED PRAISE FILTER TESTS (v11.0)
// =============================================================================
// These tests verify the new embedding-based praise detection.
// Uses mocked embedding service to avoid API calls in unit tests.

describe('Embedding-based Praise Filter (v11.0)', () => {
  // Convenient aliases for mock functions (mocked at top of file)
  const { generateEmbedding, generateEmbeddings } = mockedEmbeddingService

  // Reset mocks and singleton before each test
  beforeEach(() => {
    vi.clearAllMocks()
    resetPraiseFilter() // Clear cached embeddings
  })

  // Mock vectors for testing - using simple orthogonal unit vectors
  // praiseAnchor and complaintAnchor are the anchor embeddings
  // Text embeddings point toward one or the other
  const praiseAnchorEmb = [1.0, 0.0]  // Anchor for praise
  const complaintAnchorEmb = [0.0, 1.0]  // Anchor for complaint

  // Text embeddings:
  // - For praise-like text: point toward praise anchor
  // - For complaint-like text: point toward complaint anchor
  // Cosine similarity of [1,0] with [1,0] = 1.0 (identical)
  // Cosine similarity of [1,0] with [0,1] = 0.0 (orthogonal)

  describe('isPraiseByEmbedding', () => {
    it('should return isPraise=false for low ratings (1-3) regardless of content', async () => {
      // Even if embeddings would classify as praise, low rating overrides
      // Low ratings short-circuit before any embedding calls
      const result = await isPraiseByEmbedding('Great app, love it!', 2)

      expect(result.isPraise).toBe(false)
      // Should not have called embedding service for low ratings
      expect(generateEmbedding).not.toHaveBeenCalled()
    })

    it('should identify praise text that exceeds similarity threshold', async () => {
      // Setup: anchor embeddings, then text embedding IDENTICAL to praise anchor
      generateEmbedding
        .mockResolvedValueOnce(praiseAnchorEmb) // PRAISE_ANCHOR embedding
        .mockResolvedValueOnce(complaintAnchorEmb) // COMPLAINT_ANCHOR embedding
        .mockResolvedValueOnce([1.0, 0.0]) // Text identical to praise anchor

      const result = await isPraiseByEmbedding(
        'Amazing app, absolutely love it! Best thing ever!',
        5
      )

      // praiseSim = 1.0, complaintSim = 0.0
      // isPraise = praiseSim > 0.45 AND praiseSim > complaintSim + 0.10
      // isPraise = 1.0 > 0.45 AND 1.0 > 0.0 + 0.10 = true
      expect(result.praiseSim).toBe(1.0)
      expect(result.complaintSim).toBe(0.0)
      expect(result.isPraise).toBe(true)
    })

    it('should NOT classify as praise when text is similar to complaint anchor', async () => {
      generateEmbedding
        .mockResolvedValueOnce(praiseAnchorEmb) // PRAISE_ANCHOR
        .mockResolvedValueOnce(complaintAnchorEmb) // COMPLAINT_ANCHOR
        .mockResolvedValueOnce([0.0, 1.0]) // Text identical to complaint anchor

      const result = await isPraiseByEmbedding(
        'App crashes constantly, terrible experience, bugs everywhere.',
        5
      )

      // praiseSim = 0.0, complaintSim = 1.0
      // isPraise = 0.0 > 0.45 = false
      expect(result.praiseSim).toBe(0.0)
      expect(result.complaintSim).toBe(1.0)
      expect(result.isPraise).toBe(false)
    })

    it('should handle embedding failures gracefully (fail open)', async () => {
      generateEmbedding
        .mockResolvedValueOnce(praiseAnchorEmb)
        .mockResolvedValueOnce(complaintAnchorEmb)
        .mockResolvedValueOnce(null) // Embedding generation failed for text

      const result = await isPraiseByEmbedding('Some text', 5)

      // Should fail open - not classified as praise
      expect(result.isPraise).toBe(false)
      expect(result.praiseSim).toBe(0)
      expect(result.complaintSim).toBe(0)
    })

    it('should return confidence score for classified praise', async () => {
      generateEmbedding
        .mockResolvedValueOnce(praiseAnchorEmb)
        .mockResolvedValueOnce(complaintAnchorEmb)
        .mockResolvedValueOnce([1.0, 0.0]) // Praise-like text

      const result = await isPraiseByEmbedding('Perfect app!', 5)

      // praiseSim = 1.0, complaintSim = 0.0, isPraise = true
      expect(result.isPraise).toBe(true)
      // Confidence = praiseSim - complaintSim = 1.0
      expect(result.confidence).toBe(1.0)
    })
  })

  describe('filterPraiseSignals', () => {
    // Helper to create mock PainSignal
    const createMockSignal = (text: string, rating?: number): PainSignal => ({
      text,
      score: 5,
      intensity: 'medium',
      signals: ['test'],
      solutionSeeking: false,
      willingnessToPaySignal: false,
      wtpConfidence: 'none',
      emotion: 'neutral',
      source: {
        type: 'post',
        id: 'test-id',
        subreddit: 'App_Store',
        author: 'testuser',
        url: 'https://test.com',
        createdUtc: Date.now() / 1000,
        engagementScore: 1,
        rating,
      },
    })

    it('should filter out praise-only signals from batch', async () => {
      // Setup: anchor embeddings
      generateEmbedding
        .mockResolvedValueOnce(praiseAnchorEmb) // PRAISE_ANCHOR
        .mockResolvedValueOnce(complaintAnchorEmb) // COMPLAINT_ANCHOR

      // Batch embeddings for signals
      generateEmbeddings.mockResolvedValueOnce([
        { text: 'Amazing!', embedding: [1.0, 0.0], cached: false }, // Praise-like
        { text: 'Crashes!', embedding: [0.0, 1.0], cached: false }, // Complaint-like
      ])

      const signals = [
        createMockSignal('Amazing! Love this app!', 5),
        createMockSignal('Crashes constantly, needs fix!', 5),
      ]

      const filtered = await filterPraiseSignals(signals)

      // First signal (praise) should be filtered, second (complaint) kept
      expect(filtered.length).toBe(1)
      expect(filtered[0].text).toBe('Crashes constantly, needs fix!')
    })

    it('should keep signals with low ratings regardless of content', async () => {
      generateEmbedding
        .mockResolvedValueOnce(praiseAnchorEmb)
        .mockResolvedValueOnce(complaintAnchorEmb)

      generateEmbeddings.mockResolvedValueOnce([
        { text: 'Love it!', embedding: [1.0, 0.0], cached: false }, // Praise-like
      ])

      const signals = [createMockSignal('Love this app!', 2)] // Low rating

      const filtered = await filterPraiseSignals(signals)

      // Low rating signals should always be kept
      expect(filtered.length).toBe(1)
    })

    it('should handle empty signal array', async () => {
      const filtered = await filterPraiseSignals([])
      expect(filtered).toEqual([])
    })

    it('should fail open when embeddings are unavailable', async () => {
      // Anchor embeddings fail
      generateEmbedding.mockResolvedValue(null)
      // Batch embeddings also fail
      generateEmbeddings.mockResolvedValue([])

      const signals = [
        createMockSignal('Some text', 5),
        createMockSignal('More text', 5),
      ]

      const filtered = await filterPraiseSignals(signals)

      // Should return all signals when embeddings fail (fail open)
      expect(filtered.length).toBe(signals.length)
    })
  })

  describe('PraiseFilter singleton', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = getPraiseFilter()
      const instance2 = getPraiseFilter()
      expect(instance1).toBe(instance2)
    })
  })
})
