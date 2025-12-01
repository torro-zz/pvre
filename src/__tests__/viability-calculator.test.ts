import { describe, it, expect } from 'vitest'
import {
  calculateViability,
  calculateMVPViability,
  FULL_WEIGHTS,
  VERDICT_THRESHOLDS,
  DEALBREAKER_THRESHOLD,
  type PainScoreInput,
  type CompetitionScoreInput,
  type MarketScoreInput,
  type TimingScoreInput,
} from '@/lib/analysis/viability-calculator'

// Test data fixtures
const strongPainScore: PainScoreInput = {
  overallScore: 8.5,
  confidence: 'high',
  totalSignals: 150,
  willingnessToPayCount: 25,
}

const mediumPainScore: PainScoreInput = {
  overallScore: 6.0,
  confidence: 'medium',
  totalSignals: 80,
  willingnessToPayCount: 10,
}

const weakPainScore: PainScoreInput = {
  overallScore: 2.5,
  confidence: 'low',
  totalSignals: 20,
  willingnessToPayCount: 0,
}

const strongCompetitionScore: CompetitionScoreInput = {
  score: 8.0,
  confidence: 'high',
  competitorCount: 5,
  threats: [],
}

const mediumCompetitionScore: CompetitionScoreInput = {
  score: 5.5,
  confidence: 'medium',
  competitorCount: 10,
  threats: ['Established players with funding'],
}

const weakCompetitionScore: CompetitionScoreInput = {
  score: 2.0,
  confidence: 'low',
  competitorCount: 20,
  threats: ['Market leader dominance', 'High switching costs'],
}

const strongMarketScore: MarketScoreInput = {
  score: 9.0,
  confidence: 'high',
  penetrationRequired: 0.1,
  achievability: 'highly_achievable',
}

const mediumMarketScore: MarketScoreInput = {
  score: 6.0,
  confidence: 'medium',
  penetrationRequired: 2.5,
  achievability: 'achievable',
}

const weakMarketScore: MarketScoreInput = {
  score: 2.5,
  confidence: 'low',
  penetrationRequired: 15,
  achievability: 'unlikely',
}

const strongTimingScore: TimingScoreInput = {
  score: 8.0,
  confidence: 'high',
  trend: 'rising',
  tailwindsCount: 5,
  headwindsCount: 1,
  timingWindow: '12-18 months',
}

const mediumTimingScore: TimingScoreInput = {
  score: 5.5,
  confidence: 'medium',
  trend: 'stable',
  tailwindsCount: 3,
  headwindsCount: 3,
  timingWindow: '6-12 months',
}

const weakTimingScore: TimingScoreInput = {
  score: 2.5,
  confidence: 'low',
  trend: 'falling',
  tailwindsCount: 1,
  headwindsCount: 5,
  timingWindow: '3-6 months',
}

describe('Viability Calculator', () => {
  describe('calculateViability - 4 dimension scoring', () => {
    describe('Verdict levels', () => {
      it('should return STRONG verdict for high scores (>=7.5)', () => {
        const result = calculateViability(
          strongPainScore,
          strongCompetitionScore,
          strongMarketScore,
          strongTimingScore
        )

        expect(result.verdict).toBe('strong')
        expect(result.verdictLabel).toBe('STRONG SIGNAL')
        expect(result.overallScore).toBeGreaterThanOrEqual(VERDICT_THRESHOLDS.strong)
      })

      it('should return MIXED verdict for medium scores (5.0-7.5)', () => {
        const result = calculateViability(
          mediumPainScore,
          mediumCompetitionScore,
          mediumMarketScore,
          mediumTimingScore
        )

        expect(result.verdict).toBe('mixed')
        expect(result.verdictLabel).toBe('MIXED SIGNAL')
        expect(result.overallScore).toBeGreaterThanOrEqual(VERDICT_THRESHOLDS.mixed)
        expect(result.overallScore).toBeLessThan(VERDICT_THRESHOLDS.strong)
      })

      it('should return WEAK verdict for low scores (2.5-5.0)', () => {
        const result = calculateViability(
          { ...weakPainScore, overallScore: 4.0 },
          { ...weakCompetitionScore, score: 3.5 },
          { ...weakMarketScore, score: 3.5 },
          { ...weakTimingScore, score: 4.0 }
        )

        expect(result.verdict).toBe('weak')
        expect(result.verdictLabel).toBe('WEAK SIGNAL')
      })

      it('should return NONE verdict for very low scores (<2.5)', () => {
        const result = calculateViability(
          { ...weakPainScore, overallScore: 1.5 },
          { ...weakCompetitionScore, score: 2.0 },
          { ...weakMarketScore, score: 1.5 },
          { ...weakTimingScore, score: 2.0 }
        )

        expect(result.verdict).toBe('none')
        expect(result.verdictLabel).toBe('NO SIGNAL')
        expect(result.overallScore).toBeLessThan(VERDICT_THRESHOLDS.weak)
      })
    })

    describe('Weight normalization', () => {
      it('should use full weights when all 4 dimensions are present', () => {
        const result = calculateViability(
          strongPainScore,
          strongCompetitionScore,
          strongMarketScore,
          strongTimingScore
        )

        expect(result.dimensions).toHaveLength(4)
        expect(result.isComplete).toBe(true)
        expect(result.availableDimensions).toBe(4)
        expect(result.totalDimensions).toBe(4)

        // Check weights sum to 1
        const totalWeight = result.dimensions.reduce((sum, d) => sum + d.weight, 0)
        expect(totalWeight).toBeCloseTo(1.0, 2)

        // Check individual weights match FULL_WEIGHTS
        const painDim = result.dimensions.find(d => d.name === 'Pain Score')
        const competitionDim = result.dimensions.find(d => d.name === 'Competition Score')
        const marketDim = result.dimensions.find(d => d.name === 'Market Score')
        const timingDim = result.dimensions.find(d => d.name === 'Timing Score')

        expect(painDim?.weight).toBeCloseTo(FULL_WEIGHTS.pain, 2)
        expect(competitionDim?.weight).toBeCloseTo(FULL_WEIGHTS.competition, 2)
        expect(marketDim?.weight).toBeCloseTo(FULL_WEIGHTS.market, 2)
        expect(timingDim?.weight).toBeCloseTo(FULL_WEIGHTS.timing, 2)
      })

      it('should normalize weights when only 3 dimensions are present', () => {
        const result = calculateViability(
          strongPainScore,
          strongCompetitionScore,
          strongMarketScore,
          null // No timing
        )

        expect(result.dimensions).toHaveLength(3)
        expect(result.isComplete).toBe(false)
        expect(result.availableDimensions).toBe(3)

        // Weights should still sum to 1
        const totalWeight = result.dimensions.reduce((sum, d) => sum + d.weight, 0)
        expect(totalWeight).toBeCloseTo(1.0, 2)
      })

      it('should normalize weights when only 2 dimensions are present', () => {
        const result = calculateViability(
          strongPainScore,
          strongCompetitionScore,
          null,
          null
        )

        expect(result.dimensions).toHaveLength(2)
        expect(result.availableDimensions).toBe(2)

        const totalWeight = result.dimensions.reduce((sum, d) => sum + d.weight, 0)
        expect(totalWeight).toBeCloseTo(1.0, 2)
      })

      it('should handle single dimension correctly', () => {
        const result = calculateViability(
          strongPainScore,
          null,
          null,
          null
        )

        expect(result.dimensions).toHaveLength(1)
        expect(result.availableDimensions).toBe(1)
        expect(result.dimensions[0].weight).toBe(1.0)
        expect(result.overallScore).toBe(strongPainScore.overallScore)
      })
    })

    describe('Dealbreaker detection', () => {
      it('should detect dealbreaker when Pain Score < 3.0', () => {
        const result = calculateViability(
          { ...weakPainScore, overallScore: 2.5 },
          strongCompetitionScore,
          strongMarketScore,
          strongTimingScore
        )

        expect(result.dealbreakers).toContain('Pain Score is critically low - users may not have strong enough pain points')
      })

      it('should detect dealbreaker when Competition Score < 3.0', () => {
        const result = calculateViability(
          strongPainScore,
          { ...weakCompetitionScore, score: 2.0 },
          strongMarketScore,
          strongTimingScore
        )

        expect(result.dealbreakers).toContain('Competition Score is critically low - market may be too crowded or dominated')
      })

      it('should detect dealbreaker when Market Score < 3.0', () => {
        const result = calculateViability(
          strongPainScore,
          strongCompetitionScore,
          { ...weakMarketScore, score: 2.5 },
          strongTimingScore
        )

        expect(result.dealbreakers).toContain('Market Score is critically low - achieving your revenue goals may be unrealistic')
      })

      it('should detect dealbreaker when Timing Score < 3.0', () => {
        const result = calculateViability(
          strongPainScore,
          strongCompetitionScore,
          strongMarketScore,
          { ...weakTimingScore, score: 2.0 }
        )

        expect(result.dealbreakers).toContain('Timing Score is critically low - market conditions may not be favorable')
      })

      it('should detect multiple dealbreakers', () => {
        const result = calculateViability(
          { ...weakPainScore, overallScore: 1.5 },
          { ...weakCompetitionScore, score: 2.0 },
          strongMarketScore,
          strongTimingScore
        )

        expect(result.dealbreakers.length).toBeGreaterThanOrEqual(2)
      })

      it('should have no dealbreakers when all scores are above threshold', () => {
        const result = calculateViability(
          strongPainScore,
          strongCompetitionScore,
          strongMarketScore,
          strongTimingScore
        )

        expect(result.dealbreakers).toHaveLength(0)
      })
    })

    describe('Recommendations', () => {
      it('should recommend running missing analyses', () => {
        const result = calculateViability(
          strongPainScore,
          null,
          null,
          null
        )

        expect(result.recommendations).toContain('Run Competitor Intelligence to assess competitive landscape')
        expect(result.recommendations).toContain('Run Market Sizing to validate revenue potential')
        expect(result.recommendations).toContain('Run Timing Analysis to assess market timing')
      })

      it('should recommend finding WTP evidence when missing', () => {
        const result = calculateViability(
          { ...mediumPainScore, willingnessToPayCount: 0, overallScore: 4.0 },
          strongCompetitionScore,
          strongMarketScore,
          strongTimingScore
        )

        expect(result.recommendations.some(r => r.includes('willingness-to-pay'))).toBe(true)
      })

      it('should limit recommendations to 5', () => {
        const result = calculateViability(
          weakPainScore,
          weakCompetitionScore,
          weakMarketScore,
          weakTimingScore
        )

        expect(result.recommendations.length).toBeLessThanOrEqual(5)
      })
    })

    describe('Confidence calculation', () => {
      it('should return high confidence when all dimensions have high confidence', () => {
        const result = calculateViability(
          { ...strongPainScore, confidence: 'high' },
          { ...strongCompetitionScore, confidence: 'high' },
          { ...strongMarketScore, confidence: 'high' },
          { ...strongTimingScore, confidence: 'high' }
        )

        expect(result.confidence).toBe('high')
      })

      it('should return medium confidence for mixed confidence levels', () => {
        const result = calculateViability(
          { ...strongPainScore, confidence: 'high' },
          { ...strongCompetitionScore, confidence: 'medium' },
          { ...strongMarketScore, confidence: 'medium' },
          { ...strongTimingScore, confidence: 'low' }
        )

        expect(result.confidence).toBe('medium')
      })

      it('should return low confidence when all dimensions have low confidence', () => {
        const result = calculateViability(
          { ...weakPainScore, confidence: 'low' },
          { ...weakCompetitionScore, confidence: 'low' },
          { ...weakMarketScore, confidence: 'low' },
          { ...weakTimingScore, confidence: 'low' }
        )

        expect(result.confidence).toBe('low')
      })
    })

    describe('Weakest dimension identification', () => {
      it('should identify the weakest dimension correctly', () => {
        const result = calculateViability(
          strongPainScore,
          { ...mediumCompetitionScore, score: 4.0 }, // Weakest
          strongMarketScore,
          strongTimingScore
        )

        expect(result.weakestDimension?.name).toBe('Competition Score')
        expect(result.weakestDimension?.score).toBe(4.0)
      })

      it('should return null when no dimensions are available', () => {
        const result = calculateViability(null, null, null, null)

        expect(result.weakestDimension).toBeNull()
        expect(result.dimensions).toHaveLength(0)
      })
    })

    describe('Score calculation accuracy', () => {
      it('should calculate correct weighted score with all dimensions', () => {
        const pain = 8.0
        const competition = 6.0
        const market = 7.0
        const timing = 5.0

        const result = calculateViability(
          { ...strongPainScore, overallScore: pain },
          { ...mediumCompetitionScore, score: competition },
          { ...strongMarketScore, score: market },
          { ...mediumTimingScore, score: timing }
        )

        const expectedScore =
          (pain * FULL_WEIGHTS.pain) +
          (competition * FULL_WEIGHTS.competition) +
          (market * FULL_WEIGHTS.market) +
          (timing * FULL_WEIGHTS.timing)

        expect(result.overallScore).toBeCloseTo(expectedScore, 1)
      })
    })
  })

  describe('calculateMVPViability - 2 dimension scoring', () => {
    it('should calculate MVP score with both dimensions', () => {
      const result = calculateMVPViability(strongPainScore, strongCompetitionScore)

      expect(result.dimensions).toHaveLength(2)
      expect(result.totalDimensions).toBe(2)
      expect(result.isComplete).toBe(true)
    })

    it('should work with only pain score', () => {
      const result = calculateMVPViability(strongPainScore, null)

      expect(result.dimensions).toHaveLength(1)
      expect(result.isComplete).toBe(false)
      expect(result.overallScore).toBe(strongPainScore.overallScore)
    })

    it('should work with only competition score', () => {
      const result = calculateMVPViability(null, strongCompetitionScore)

      expect(result.dimensions).toHaveLength(1)
      expect(result.isComplete).toBe(false)
      expect(result.overallScore).toBe(strongCompetitionScore.score)
    })
  })

  describe('Edge cases', () => {
    it('should handle all null inputs gracefully', () => {
      const result = calculateViability(null, null, null, null)

      expect(result.dimensions).toHaveLength(0)
      expect(result.overallScore).toBe(0)
      expect(result.verdict).toBe('none')
      expect(result.isComplete).toBe(false)
      expect(result.availableDimensions).toBe(0)
    })

    it('should handle scores at exact thresholds', () => {
      // Exactly at strong threshold
      const strongResult = calculateViability(
        { ...strongPainScore, overallScore: 7.5 },
        { ...strongCompetitionScore, score: 7.5 },
        { ...strongMarketScore, score: 7.5 },
        { ...strongTimingScore, score: 7.5 }
      )
      expect(strongResult.verdict).toBe('strong')

      // Just below strong threshold
      const mixedResult = calculateViability(
        { ...strongPainScore, overallScore: 7.4 },
        { ...strongCompetitionScore, score: 7.4 },
        { ...strongMarketScore, score: 7.4 },
        { ...strongTimingScore, score: 7.4 }
      )
      expect(mixedResult.verdict).toBe('mixed')
    })

    it('should round scores to 1 decimal place', () => {
      const result = calculateViability(
        { ...strongPainScore, overallScore: 7.777 },
        { ...strongCompetitionScore, score: 6.333 },
        { ...strongMarketScore, score: 8.111 },
        { ...strongTimingScore, score: 5.555 }
      )

      // Score should be rounded to 1 decimal place
      expect(result.overallScore.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(1)
    })

    it('should normalize very_low confidence to low', () => {
      const result = calculateViability(
        { ...weakPainScore, confidence: 'very_low' },
        strongCompetitionScore,
        strongMarketScore,
        strongTimingScore
      )

      const painDim = result.dimensions.find(d => d.name === 'Pain Score')
      expect(painDim?.confidence).toBe('low')
    })
  })
})
