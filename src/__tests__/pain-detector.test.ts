import { describe, it, expect } from 'vitest'
import {
  calculatePainScore,
  getPainSummary,
  calculateOverallPainScore,
  type PainSignal,
} from '@/lib/analysis/pain-detector'

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
        solutionSeeking: true,
        willingnessToPaySignal: true,
        wtpConfidence: 'high',
        source: {
          type: 'post',
          id: '1',
          subreddit: 'startups',
          author: 'user1',
          url: 'https://reddit.com/r/startups/1',
          created_utc: Date.now() / 1000,
          engagementScore: 5,
        },
      },
      {
        text: 'Medium intensity pain',
        score: 6,
        intensity: 'medium',
        signals: ['struggling', 'difficult'],
        solutionSeeking: false,
        willingnessToPaySignal: false,
        wtpConfidence: 'none',
        source: {
          type: 'post',
          id: '2',
          subreddit: 'entrepreneur',
          author: 'user2',
          url: 'https://reddit.com/r/entrepreneur/2',
          created_utc: Date.now() / 1000,
          engagementScore: 3,
        },
      },
      {
        text: 'Low intensity pain',
        score: 2,
        intensity: 'low',
        signals: ['wondering'],
        solutionSeeking: false,
        willingnessToPaySignal: false,
        wtpConfidence: 'none',
        source: {
          type: 'comment',
          id: '3',
          subreddit: 'startups',
          author: 'user3',
          url: 'https://reddit.com/r/startups/1/3',
          created_utc: Date.now() / 1000,
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
      }

      const result = calculateOverallPainScore(goodSummary)

      expect(result.reasoning).toBeTruthy()
      expect(result.reasoning.length).toBeGreaterThan(10)
    })
  })
})
