/**
 * PVRE Viability Calculator
 *
 * Combines multiple research dimensions into a single Viability Verdict score.
 *
 * Full Formula:
 *   VIABILITY SCORE = (Pain × 0.35) + (Market × 0.25) + (Competition × 0.25) + (Timing × 0.15)
 *
 * MVP Formula (Pain + Competition only):
 *   VIABILITY SCORE = (Pain × 0.58) + (Competition × 0.42)
 *   Rationale: 35/(35+25) = 0.58, 25/(35+25) = 0.42
 */

// =============================================================================
// TYPES
// =============================================================================

export type VerdictLevel = 'strong' | 'mixed' | 'weak' | 'none'

export interface DimensionScore {
  name: string
  score: number // 0-10 scale
  weight: number // Percentage weight (0-1)
  status: 'strong' | 'adequate' | 'needs_work' | 'critical'
  confidence: 'low' | 'medium' | 'high'
  summary?: string
}

export interface ViabilityVerdict {
  overallScore: number // 0-10 scale
  verdict: VerdictLevel
  verdictLabel: string
  verdictDescription: string
  dimensions: DimensionScore[]
  weakestDimension: DimensionScore | null
  dealbreakers: string[] // Any dimension < 3/10
  recommendations: string[]
  confidence: 'low' | 'medium' | 'high'
  isComplete: boolean // true if all dimensions have data
  availableDimensions: number
  totalDimensions: number
}

export interface PainScoreInput {
  overallScore: number // 0-10 from pain-detector
  confidence: 'very_low' | 'low' | 'medium' | 'high'
  totalSignals: number
  willingnessToPayCount: number
}

export interface CompetitionScoreInput {
  score: number // 0-10 from competitor-intelligence
  confidence: 'low' | 'medium' | 'high'
  competitorCount: number
  threats: string[]
}

export interface MarketScoreInput {
  score: number // 0-10 from market-sizing
  confidence: 'low' | 'medium' | 'high'
  scenario: 'conservative' | 'moderate' | 'optimistic'
}

export interface TimingScoreInput {
  score: number // 0-10 from timing-analysis
  confidence: 'low' | 'medium' | 'high'
  trend: 'rising' | 'stable' | 'falling'
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Full weights (when all 4 dimensions implemented)
export const FULL_WEIGHTS = {
  pain: 0.35,
  market: 0.25,
  competition: 0.25,
  timing: 0.15,
}

// MVP weights (normalized for Pain + Competition only)
// 35/(35+25) = 0.58, 25/(35+25) = 0.42
export const MVP_WEIGHTS = {
  pain: 0.58,
  competition: 0.42,
}

// Verdict thresholds
export const VERDICT_THRESHOLDS = {
  strong: 7.5,
  mixed: 5.0,
  weak: 2.5,
  // anything below 2.5 is 'none'
}

// Dealbreaker threshold - any dimension below this is a red flag
export const DEALBREAKER_THRESHOLD = 3.0

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getVerdict(score: number): VerdictLevel {
  if (score >= VERDICT_THRESHOLDS.strong) return 'strong'
  if (score >= VERDICT_THRESHOLDS.mixed) return 'mixed'
  if (score >= VERDICT_THRESHOLDS.weak) return 'weak'
  return 'none'
}

function getVerdictLabel(verdict: VerdictLevel): string {
  switch (verdict) {
    case 'strong':
      return 'STRONG SIGNAL'
    case 'mixed':
      return 'MIXED SIGNAL'
    case 'weak':
      return 'WEAK SIGNAL'
    case 'none':
      return 'NO SIGNAL'
  }
}

function getVerdictDescription(verdict: VerdictLevel): string {
  switch (verdict) {
    case 'strong':
      return 'Proceed to interviews with confidence. Strong market signals detected.'
    case 'mixed':
      return 'Refine hypothesis and investigate weak areas before proceeding.'
    case 'weak':
      return 'Major concerns detected. Consider pivoting or significantly refining approach.'
    case 'none':
      return 'Likely not viable as defined. Pivot or abandon this hypothesis.'
  }
}

function getDimensionStatus(score: number): 'strong' | 'adequate' | 'needs_work' | 'critical' {
  if (score >= 7.5) return 'strong'
  if (score >= 5.0) return 'adequate'
  if (score >= 3.0) return 'needs_work'
  return 'critical'
}

function normalizeConfidence(
  confidence: 'very_low' | 'low' | 'medium' | 'high'
): 'low' | 'medium' | 'high' {
  return confidence === 'very_low' ? 'low' : confidence
}

function combineConfidences(
  confidences: ('low' | 'medium' | 'high')[]
): 'low' | 'medium' | 'high' {
  if (confidences.length === 0) return 'low'

  const scores = confidences.map((c) => {
    switch (c) {
      case 'high': return 3
      case 'medium': return 2
      case 'low': return 1
    }
  })

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length

  if (avg >= 2.5) return 'high'
  if (avg >= 1.5) return 'medium'
  return 'low'
}

// =============================================================================
// MAIN CALCULATOR
// =============================================================================

export function calculateMVPViability(
  painScore: PainScoreInput | null,
  competitionScore: CompetitionScoreInput | null
): ViabilityVerdict {
  const dimensions: DimensionScore[] = []
  const dealbreakers: string[] = []
  const recommendations: string[] = []
  let availableDimensions = 0

  // Add Pain dimension if available
  if (painScore) {
    availableDimensions++
    const status = getDimensionStatus(painScore.overallScore)

    dimensions.push({
      name: 'Pain Score',
      score: painScore.overallScore,
      weight: MVP_WEIGHTS.pain,
      status,
      confidence: normalizeConfidence(painScore.confidence),
      summary: `${painScore.totalSignals} signals detected, ${painScore.willingnessToPayCount} WTP indicators`,
    })

    if (painScore.overallScore < DEALBREAKER_THRESHOLD) {
      dealbreakers.push('Pain Score is critically low - users may not have strong enough pain points')
    }

    if (status === 'needs_work' || status === 'critical') {
      if (painScore.willingnessToPayCount === 0) {
        recommendations.push('Find evidence of willingness-to-pay - look for pricing discussions and purchase intent')
      }
      recommendations.push('Gather more community data or refine search terms to find stronger pain signals')
    }
  }

  // Add Competition dimension if available
  if (competitionScore) {
    availableDimensions++
    const status = getDimensionStatus(competitionScore.score)

    dimensions.push({
      name: 'Competition Score',
      score: competitionScore.score,
      weight: MVP_WEIGHTS.competition,
      status,
      confidence: competitionScore.confidence,
      summary: `${competitionScore.competitorCount} competitors analyzed`,
    })

    if (competitionScore.score < DEALBREAKER_THRESHOLD) {
      dealbreakers.push('Competition Score is critically low - market may be too crowded or dominated')
    }

    if (status === 'needs_work' || status === 'critical') {
      if (competitionScore.threats.length > 0) {
        recommendations.push(`Address competitive threats: ${competitionScore.threats[0]}`)
      }
      recommendations.push('Identify unique positioning angles or underserved niches')
    }
  }

  // Calculate weighted score
  let overallScore = 0

  if (availableDimensions === 2) {
    // Both dimensions available - use MVP weights
    overallScore =
      (painScore!.overallScore * MVP_WEIGHTS.pain) +
      (competitionScore!.score * MVP_WEIGHTS.competition)
  } else if (painScore) {
    // Only pain available
    overallScore = painScore.overallScore
  } else if (competitionScore) {
    // Only competition available
    overallScore = competitionScore.score
  }

  // Round to 1 decimal place
  overallScore = Math.round(overallScore * 10) / 10

  // Find weakest dimension
  const weakestDimension = dimensions.length > 0
    ? dimensions.reduce((weakest, current) =>
        current.score < weakest.score ? current : weakest
      )
    : null

  // Add recommendations for incomplete data
  if (availableDimensions < 2) {
    if (!painScore) {
      recommendations.unshift('Run Community Voice analysis to assess market pain')
    }
    if (!competitionScore) {
      recommendations.unshift('Run Competitor Intelligence to assess competitive landscape')
    }
  }

  // Determine verdict
  const verdict = getVerdict(overallScore)
  const verdictLabel = getVerdictLabel(verdict)
  const verdictDescription = getVerdictDescription(verdict)

  // Combine confidence levels
  const confidences = dimensions.map((d) => d.confidence)
  const overallConfidence = combineConfidences(confidences)

  return {
    overallScore,
    verdict,
    verdictLabel,
    verdictDescription,
    dimensions,
    weakestDimension,
    dealbreakers,
    recommendations: recommendations.slice(0, 5), // Limit to top 5
    confidence: overallConfidence,
    isComplete: availableDimensions === 2, // MVP requires 2 dimensions
    availableDimensions,
    totalDimensions: 2, // MVP has 2 dimensions
  }
}

/**
 * Future: Full viability calculation with all 4 dimensions
 *
 * export function calculateFullViability(
 *   painScore: PainScoreInput | null,
 *   marketScore: MarketScoreInput | null,
 *   competitionScore: CompetitionScoreInput | null,
 *   timingScore: TimingScoreInput | null
 * ): ViabilityVerdict {
 *   // Implementation for when Market and Timing modules are added
 * }
 */

// =============================================================================
// UTILITY EXPORTS
// =============================================================================

export const VerdictColors = {
  strong: {
    bg: 'bg-green-500',
    text: 'text-green-600',
    bgLight: 'bg-green-50',
    border: 'border-green-200',
  },
  mixed: {
    bg: 'bg-yellow-500',
    text: 'text-yellow-600',
    bgLight: 'bg-yellow-50',
    border: 'border-yellow-200',
  },
  weak: {
    bg: 'bg-orange-500',
    text: 'text-orange-600',
    bgLight: 'bg-orange-50',
    border: 'border-orange-200',
  },
  none: {
    bg: 'bg-red-500',
    text: 'text-red-600',
    bgLight: 'bg-red-50',
    border: 'border-red-200',
  },
}

export const StatusColors = {
  strong: 'text-green-600',
  adequate: 'text-yellow-600',
  needs_work: 'text-orange-600',
  critical: 'text-red-600',
}

export const StatusLabels = {
  strong: 'Strong',
  adequate: 'Adequate',
  needs_work: 'Needs Work',
  critical: 'Critical',
}
