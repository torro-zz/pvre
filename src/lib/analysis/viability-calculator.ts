/**
 * PVRE Viability Calculator
 *
 * Combines multiple research dimensions into a single Viability Verdict score.
 *
 * Full Formula (4 dimensions):
 *   VIABILITY SCORE = (Pain × 0.35) + (Market × 0.25) + (Competition × 0.25) + (Timing × 0.15)
 *
 * Dynamic weights are normalized based on available dimensions.
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
  confidence: 'low' | 'medium' | 'high' | 'very_low'
  penetrationRequired: number // percentage
  achievability: 'highly_achievable' | 'achievable' | 'challenging' | 'difficult' | 'unlikely'
}

export interface TimingScoreInput {
  score: number // 0-10 from timing-analysis
  confidence: 'low' | 'medium' | 'high'
  trend: 'rising' | 'stable' | 'falling'
  tailwindsCount: number
  headwindsCount: number
  timingWindow: string
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
      return 'Proceed to user interviews with confidence. Strong market signals detected.'
    case 'mixed':
      return 'Conduct user interviews to validate assumptions. Mixed signals suggest talking to real users will clarify the opportunity.'
    case 'weak':
      return 'User interviews are critical before proceeding. Weak signals may indicate a pivot is needed - talk to users to understand why.'
    case 'none':
      return 'Consider a significant pivot. If you proceed, start with discovery interviews to understand if the problem space itself is viable.'
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

  // Always recommend user interviews as the key next step
  if (dimensions.length >= 2) {
    recommendations.push('Conduct 5-10 user interviews using the Interview Guide to validate these findings with real users')
  }

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
 * Dynamic viability calculation with up to 4 dimensions (Pain, Market, Competition, Timing)
 * Weights are normalized dynamically based on available dimensions.
 *
 * Full formula when all 4 are present:
 *   Pain: 35%, Market: 25%, Competition: 25%, Timing: 15%
 */
export function calculateViability(
  painScore: PainScoreInput | null,
  competitionScore: CompetitionScoreInput | null,
  marketScore: MarketScoreInput | null = null,
  timingScore: TimingScoreInput | null = null
): ViabilityVerdict {
  const dimensions: DimensionScore[] = []
  const dealbreakers: string[] = []
  const recommendations: string[] = []

  // Track which dimensions are available and their base weights
  const availableWeights: { name: string; weight: number; score: number }[] = []

  // Add Pain dimension if available
  if (painScore) {
    availableWeights.push({ name: 'pain', weight: FULL_WEIGHTS.pain, score: painScore.overallScore })
    const status = getDimensionStatus(painScore.overallScore)

    dimensions.push({
      name: 'Pain Score',
      score: painScore.overallScore,
      weight: 0, // Will be normalized below
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
    availableWeights.push({ name: 'competition', weight: FULL_WEIGHTS.competition, score: competitionScore.score })
    const status = getDimensionStatus(competitionScore.score)

    dimensions.push({
      name: 'Competition Score',
      score: competitionScore.score,
      weight: 0, // Will be normalized below
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

  // Add Market dimension if available
  if (marketScore) {
    availableWeights.push({ name: 'market', weight: FULL_WEIGHTS.market, score: marketScore.score })
    const status = getDimensionStatus(marketScore.score)

    dimensions.push({
      name: 'Market Score',
      score: marketScore.score,
      weight: 0, // Will be normalized below
      status,
      confidence: normalizeConfidence(marketScore.confidence),
      summary: `${marketScore.penetrationRequired.toFixed(1)}% penetration needed - ${marketScore.achievability.replace('_', ' ')}`,
    })

    if (marketScore.score < DEALBREAKER_THRESHOLD) {
      dealbreakers.push('Market Score is critically low - achieving your revenue goals may be unrealistic')
    }

    if (status === 'needs_work' || status === 'critical') {
      recommendations.push('Consider narrowing your target market or adjusting pricing strategy')
      if (marketScore.achievability === 'unlikely' || marketScore.achievability === 'difficult') {
        recommendations.push('Lower your Minimum Success Criteria or expand your serviceable market')
      }
    }
  }

  // Add Timing dimension if available
  if (timingScore) {
    availableWeights.push({ name: 'timing', weight: FULL_WEIGHTS.timing, score: timingScore.score })
    const status = getDimensionStatus(timingScore.score)

    const trendEmoji = timingScore.trend === 'rising' ? '↑' : timingScore.trend === 'falling' ? '↓' : '→'

    dimensions.push({
      name: 'Timing Score',
      score: timingScore.score,
      weight: 0, // Will be normalized below
      status,
      confidence: timingScore.confidence,
      summary: `${timingScore.tailwindsCount} tailwinds, ${timingScore.headwindsCount} headwinds ${trendEmoji} Window: ${timingScore.timingWindow}`,
    })

    if (timingScore.score < DEALBREAKER_THRESHOLD) {
      dealbreakers.push('Timing Score is critically low - market conditions may not be favorable')
    }

    if (status === 'needs_work' || status === 'critical') {
      if (timingScore.headwindsCount > timingScore.tailwindsCount) {
        recommendations.push('Address market headwinds or wait for better timing conditions')
      }
      if (timingScore.trend === 'falling') {
        recommendations.push('Market interest appears to be declining - consider pivoting or moving faster')
      }
    }
  }

  // Normalize weights based on available dimensions
  const totalWeight = availableWeights.reduce((sum, d) => sum + d.weight, 0)
  const normalizedWeights: Record<string, number> = {}

  for (const d of availableWeights) {
    normalizedWeights[d.name] = d.weight / totalWeight
  }

  // Update dimension weights in the array
  for (let i = 0; i < dimensions.length; i++) {
    const dimName = dimensions[i].name.toLowerCase().includes('pain') ? 'pain'
      : dimensions[i].name.toLowerCase().includes('competition') ? 'competition'
      : dimensions[i].name.toLowerCase().includes('market') ? 'market'
      : 'timing'
    dimensions[i].weight = normalizedWeights[dimName] || 0
  }

  // Calculate weighted score
  let overallScore = 0
  for (const d of availableWeights) {
    overallScore += d.score * normalizedWeights[d.name]
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
  const availableDimensions = availableWeights.length
  if (!painScore) {
    recommendations.unshift('Run Community Voice analysis to assess market pain')
  }
  if (!competitionScore) {
    recommendations.unshift('Run Competitor Intelligence to assess competitive landscape')
  }
  if (!marketScore) {
    recommendations.unshift('Run Market Sizing to validate revenue potential')
  }
  if (!timingScore) {
    recommendations.unshift('Run Timing Analysis to assess market timing')
  }

  // Determine verdict
  const verdict = getVerdict(overallScore)
  const verdictLabel = getVerdictLabel(verdict)
  const verdictDescription = getVerdictDescription(verdict)

  // Always recommend user interviews as the key next step
  if (dimensions.length >= 2) {
    recommendations.push('Conduct 5-10 user interviews using the Interview Guide to validate these findings with real users')
  }

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
    isComplete: availableDimensions === 4, // Full version requires all 4 dimensions
    availableDimensions,
    totalDimensions: 4, // Supports all 4 dimensions
  }
}

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
