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

export type SampleSizeLabel = 'high_confidence' | 'moderate_confidence' | 'low_confidence' | 'very_limited'

export interface RedFlag {
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  title: string
  message: string
}

export interface ViabilityVerdict {
  overallScore: number // 0-10 scale (calibrated)
  rawScore: number // 0-10 scale (before calibration)
  verdict: VerdictLevel
  verdictLabel: string
  verdictDescription: string
  // v4: Calibrated verdict label accounts for sample size (shows "PROMISING — LIMITED DATA" instead of "STRONG SIGNAL" when sample is small)
  calibratedVerdictLabel: string
  scoreRange?: { min: number; max: number } // Confidence interval when data is limited
  dimensions: DimensionScore[]
  weakestDimension: DimensionScore | null
  dealbreakers: string[] // Any dimension < 3/10
  recommendations: string[]
  confidence: 'low' | 'medium' | 'high'
  isComplete: boolean // true if all dimensions have data
  availableDimensions: number
  totalDimensions: number
  // v2: Data sufficiency indicator
  dataSufficiency: DataSufficiency
  dataSufficiencyReason: string
  // v3: Sample size indicator (posts analyzed)
  sampleSize?: {
    postsAnalyzed: number
    signalsFound: number
    label: SampleSizeLabel
    description: string
  }
  // v5: Red flags for critical issues (shown prominently before score)
  redFlags?: RedFlag[]
  // v6: Two-axis verdict system (Phase 0.5 Report Redesign)
  hypothesisConfidence?: HypothesisConfidence
  marketOpportunity?: MarketOpportunity
}

// =============================================================================
// TWO-AXIS VERDICT SYSTEM (v6 - Report Redesign)
// =============================================================================

export type HypothesisConfidenceLevel = 'high' | 'partial' | 'low'
export type MarketOpportunityLevel = 'strong' | 'moderate' | 'weak'

/**
 * Hypothesis Confidence Score
 * Measures: "Did we find YOUR specific hypothesis?"
 *
 * Components (weighted):
 * - Direct signal % (CORE signals / total) - 50%
 * - Signal volume - 25%
 * - Multi-source confirmation - 25%
 */
export interface HypothesisConfidence {
  score: number                        // 0-10
  level: HypothesisConfidenceLevel     // high (>6), partial (3-6), low (<3)
  directSignalPercent: number          // % of signals that are CORE tier
  signalVolume: number                 // Total signals found
  multiSourceConfirmation: boolean     // Multiple data sources confirm
  factors: {
    directSignalScore: number          // 0-10 contribution
    volumeScore: number                // 0-10 contribution
    multiSourceScore: number           // 0-10 contribution
  }
}

/**
 * Market Opportunity Score
 * Measures: "Is there a viable market here?"
 *
 * Components (weighted):
 * - Market size viability - 30%
 * - Timing score - 25%
 * - Discussion activity level - 25%
 * - Competitor presence (validated market) - 20%
 */
export interface MarketOpportunity {
  score: number                        // 0-10
  level: MarketOpportunityLevel        // strong (>7), moderate (5-7), weak (<5)
  marketSizeScore: number              // From market-sizing analysis
  timingScore: number                  // From timing analysis
  activityScore: number                // Based on posts found and engagement
  competitorPresence: boolean          // Competitors exist = validated market
  factors: {
    marketSizeContribution: number     // 0-10 contribution
    timingContribution: number         // 0-10 contribution
    activityContribution: number       // 0-10 contribution
    competitorContribution: number     // 0-10 contribution
  }
}

export interface PainScoreInput {
  overallScore: number // 0-10 from pain-detector
  confidence: 'very_low' | 'low' | 'medium' | 'high'
  totalSignals: number
  willingnessToPayCount: number
  postsAnalyzed?: number // Number of posts that passed relevance filtering
  averageIntensity?: number // 0-1 scale: average intensity of pain signals (high=1, medium=0.6, low=0.3)
}

export interface CompetitionScoreInput {
  score: number // 0-10 from competitor-intelligence
  confidence: 'low' | 'medium' | 'high'
  competitorCount: number
  threats: string[]
  hasFreeAlternatives?: boolean // Whether free competitors exist
  marketMaturity?: 'emerging' | 'growing' | 'mature' | 'declining'
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
// P1 FIX: Updated weak threshold to 4.0, below is "do not pursue"
export const VERDICT_THRESHOLDS = {
  strong: 7.5,  // 7.5+ → STRONG SIGNAL
  mixed: 5.0,   // 5.0-7.5 → MIXED SIGNAL
  weak: 4.0,    // 4.0-5.0 → WEAK SIGNAL (was 2.5)
  // anything below 4.0 is 'none' → DO NOT PURSUE
}

// Dealbreaker threshold - any dimension below this is a red flag
export const DEALBREAKER_THRESHOLD = 3.0

// =============================================================================
// SCORE CALIBRATION
// =============================================================================

/**
 * Apply variance-widening transformation to spread mid-range scores.
 *
 * Problem: Raw scores tend to cluster around 5-7, producing "mixed" verdicts.
 * Solution: Apply a sigmoid-based transformation that:
 *   - Preserves extreme scores (< 3 or > 8)
 *   - Pushes mid-range scores away from center (5.5)
 *   - Increases discrimination between "good" and "mediocre"
 *
 * The formula uses a soft S-curve centered at 5.5:
 *   transformed = 5.5 + (score - 5.5) * amplification_factor
 *   where amplification_factor = 1.0 + 0.3 * (1 - distance_from_center/4.5)
 *
 * This means:
 *   - Score of 5.5 stays at 5.5 (center)
 *   - Score of 7.0 → ~7.4 (pushed higher)
 *   - Score of 4.0 → ~3.6 (pushed lower)
 *   - Score of 9.0 → ~9.2 (slight push, near limit)
 *   - Score of 1.0 → ~0.9 (slight push, near limit)
 */
function applyScoreCalibration(rawScore: number): number {
  // Don't calibrate if no data (score of 0)
  if (rawScore === 0) return 0

  const CENTER = 5.5
  const MAX_AMPLIFICATION = 1.4  // Maximum stretch factor for scores near center
  const MIN_AMPLIFICATION = 1.0  // No stretch for scores at extremes

  // Distance from center (0 to 4.5 for 1-10 scale)
  const distanceFromCenter = Math.abs(rawScore - CENTER)

  // Amplification decreases as we get further from center
  // At center: 1.4x, at edges (1 or 10): 1.0x
  const amplification = MAX_AMPLIFICATION - (MAX_AMPLIFICATION - MIN_AMPLIFICATION) * (distanceFromCenter / 4.5)

  // Apply transformation
  let transformed = CENTER + (rawScore - CENTER) * amplification

  // Clamp to valid range
  transformed = Math.max(0, Math.min(10, transformed))

  // Round to 1 decimal
  return Math.round(transformed * 10) / 10
}

/**
 * Calculate data sufficiency score based on available dimensions and confidence levels.
 * Returns a rating that indicates how much to trust the verdict.
 */
export type DataSufficiency = 'insufficient' | 'limited' | 'adequate' | 'strong'

function calculateDataSufficiency(
  dimensions: DimensionScore[],
  totalDimensions: number
): { sufficiency: DataSufficiency; reason: string } {
  if (dimensions.length === 0) {
    return { sufficiency: 'insufficient', reason: 'No research data available' }
  }

  if (dimensions.length === 1) {
    return { sufficiency: 'limited', reason: 'Only 1 of 4 dimensions analyzed - run more modules for reliable verdict' }
  }

  // Count low confidence dimensions
  const lowConfidenceCount = dimensions.filter(d => d.confidence === 'low').length
  const completionRatio = dimensions.length / totalDimensions

  if (dimensions.length === 2 && lowConfidenceCount >= 1) {
    return { sufficiency: 'limited', reason: '2 dimensions with low confidence data' }
  }

  if (dimensions.length >= 3 && lowConfidenceCount <= 1) {
    return { sufficiency: 'strong', reason: `${dimensions.length} dimensions analyzed with good confidence` }
  }

  if (completionRatio >= 0.75) {
    return { sufficiency: 'adequate', reason: `${dimensions.length} of ${totalDimensions} dimensions analyzed` }
  }

  return { sufficiency: 'limited', reason: `Only ${dimensions.length} dimensions - consider running more analyses` }
}

/**
 * Calculate sample size indicator based on posts analyzed.
 *
 * Thresholds based on KNOWN_ISSUES.md proposal:
 *   100+ posts = "High confidence"
 *   50-99 posts = "Moderate confidence"
 *   20-49 posts = "Low confidence — consider broader search"
 *   <20 posts = "Very limited data — interpret with caution"
 */
function calculateSampleSizeIndicator(
  postsAnalyzed: number | undefined,
  signalsFound: number
): ViabilityVerdict['sampleSize'] | undefined {
  if (postsAnalyzed === undefined) {
    return undefined
  }

  let label: SampleSizeLabel
  let description: string

  if (postsAnalyzed >= 100) {
    label = 'high_confidence'
    description = 'High confidence — substantial data sample'
  } else if (postsAnalyzed >= 50) {
    label = 'moderate_confidence'
    description = 'Moderate confidence — good data sample'
  } else if (postsAnalyzed >= 20) {
    label = 'low_confidence'
    description = 'Low confidence — consider broader search terms'
  } else {
    label = 'very_limited'
    description = 'Very limited data — interpret with caution'
  }

  return {
    postsAnalyzed,
    signalsFound,
    label,
    description,
  }
}

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
      // Phase 1 UI redesign: constructive framing
      return 'EMERGING SIGNAL'
    case 'none':
      // P1 FIX: Clear "stop" signal for bad ideas
      return 'DO NOT PURSUE'
  }
}

/**
 * Calibrate verdict label based on sample size.
 * When sample size is limited, soften confident labels to set appropriate expectations.
 *
 * "STRONG SIGNAL" on 15 posts is misleading — changes to "PROMISING — LIMITED DATA"
 */
function getCalibratedVerdictLabel(
  verdict: VerdictLevel,
  sampleSize: ViabilityVerdict['sampleSize'] | undefined
): string {
  const baseLabel = getVerdictLabel(verdict)

  // If no sample size info, return base label
  if (!sampleSize) return baseLabel

  // If sample size is adequate or high, use base label
  if (sampleSize.label === 'high_confidence' || sampleSize.label === 'moderate_confidence') {
    return baseLabel
  }

  // For limited samples, calibrate confident labels
  if (sampleSize.label === 'very_limited') {
    switch (verdict) {
      case 'strong':
        return 'PROMISING — LIMITED DATA'
      case 'mixed':
        return 'UNCERTAIN — LIMITED DATA'
      case 'weak':
        return 'WEAK — LIMITED DATA'
      case 'none':
        // P1 FIX: Even with limited data, show clear stop signal
        return 'DO NOT PURSUE'
    }
  }

  // For low confidence samples (20-49 posts), add qualifier to strong signals
  if (sampleSize.label === 'low_confidence') {
    switch (verdict) {
      case 'strong':
        return 'STRONG — NEEDS MORE DATA'
      case 'mixed':
        return 'MIXED SIGNAL'
      case 'weak':
        return 'WEAK SIGNAL'
      case 'none':
        // P1 FIX: Clear stop signal
        return 'DO NOT PURSUE'
    }
  }

  return baseLabel
}

/**
 * Calculate score confidence range based on sample size.
 * Smaller samples = wider confidence intervals.
 */
function getScoreRange(
  score: number,
  sampleSize: ViabilityVerdict['sampleSize'] | undefined
): { min: number; max: number } | undefined {
  if (!sampleSize) return undefined

  // Only show range for limited data
  if (sampleSize.label === 'high_confidence' || sampleSize.label === 'moderate_confidence') {
    return undefined
  }

  // Calculate margin based on sample size
  // Very limited (<20): ±2.0 points
  // Low confidence (20-49): ±1.5 points
  const margin = sampleSize.label === 'very_limited' ? 2.0 : 1.5

  return {
    min: Math.max(0, Math.round((score - margin) * 10) / 10),
    max: Math.min(10, Math.round((score + margin) * 10) / 10),
  }
}

function getVerdictDescription(verdict: VerdictLevel): string {
  switch (verdict) {
    case 'strong':
      return 'Proceed to user interviews with confidence. Strong market signals detected.'
    case 'mixed':
      return 'Conduct user interviews to validate assumptions. Mixed signals suggest talking to real users will clarify the opportunity.'
    case 'weak':
      // P1 FIX: Clearer "validate first" message
      return 'Significant concerns detected. Validate core assumptions with user interviews before building anything.'
    case 'none':
      // P1 FIX: Clear "stop" message
      return 'No viable business signal detected. Pivot to a different problem or target audience.'
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
// SCORE ADJUSTMENT FUNCTIONS (P0 FIXES)
// =============================================================================

/**
 * Fix 2: Adjust Market Score based on WTP evidence, problem severity, and free alternatives.
 *
 * Raw market score is inflated by TAM alone. This function applies reality checks:
 * - WTP Factor: No purchase intent = 0.3x, some = 0.6x, strong = 1.0x
 * - Severity Factor: Trivial problems can't support premium pricing
 * - Free Alternatives Factor: Free competitors halve the addressable market
 *
 * Example: Water reminder app had 9.0/10 market score → adjusted to ~1.0/10
 */
function calculateAdjustedMarketScore(
  rawMarketScore: number,
  painScore: PainScoreInput | null,
  competitionScore: CompetitionScoreInput | null
): { adjustedScore: number; adjustmentFactors: { wtp: number; severity: number; freeAlt: number } } {
  let adjustedScore = rawMarketScore

  // Factor 1: WTP Evidence (most important)
  const wtpCount = painScore?.willingnessToPayCount ?? 0
  let wtpFactor = 1.0
  if (wtpCount === 0) {
    wtpFactor = 0.3 // Severe penalty - no evidence anyone would pay
  } else if (wtpCount <= 3) {
    wtpFactor = 0.6 // Moderate penalty - weak WTP evidence
  }
  adjustedScore *= wtpFactor

  // Factor 2: Problem Severity (based on average intensity)
  const avgIntensity = painScore?.averageIntensity ?? 0.5
  let severityFactor = 1.0
  if (avgIntensity < 0.4) {
    severityFactor = 0.5 // Trivial/convenience problem
  } else if (avgIntensity < 0.7) {
    severityFactor = 0.8 // Moderate frustration
  }
  adjustedScore *= severityFactor

  // Factor 3: Free Alternatives
  const hasFreeAlternatives = competitionScore?.hasFreeAlternatives ?? false
  let freeAltFactor = 1.0
  if (hasFreeAlternatives) {
    freeAltFactor = 0.5 // Half the market opportunity if free solutions exist
  }
  adjustedScore *= freeAltFactor

  // Floor at 1.0 (can't go below)
  adjustedScore = Math.max(adjustedScore, 1.0)

  return {
    adjustedScore: Math.round(adjustedScore * 10) / 10,
    adjustmentFactors: { wtp: wtpFactor, severity: severityFactor, freeAlt: freeAltFactor },
  }
}

/**
 * Fix 1: Apply WTP Kill Switch.
 *
 * If zero WTP signals and small sample, cap the score and override verdict.
 * This is a "circuit breaker" that prevents obviously bad ideas from getting passing scores.
 *
 * Returns the adjusted score, verdict, and any red flags to display.
 */
function applyWtpKillSwitch(
  score: number,
  verdict: VerdictLevel,
  verdictLabel: string,
  verdictDescription: string,
  painScore: PainScoreInput | null,
  existingRedFlags: RedFlag[]
): {
  score: number
  verdict: VerdictLevel
  verdictLabel: string
  verdictDescription: string
  redFlags: RedFlag[]
} {
  const redFlags = [...existingRedFlags]
  let adjustedScore = score
  let adjustedVerdict = verdict
  let adjustedLabel = verdictLabel
  let adjustedDescription = verdictDescription

  const wtpCount = painScore?.willingnessToPayCount ?? 0
  const totalSignals = painScore?.totalSignals ?? 0

  // Kill switch: Zero WTP with small sample = cap at 5.0
  if (wtpCount === 0 && totalSignals < 20 && totalSignals > 0) {
    // Cap the score
    if (adjustedScore > 5.0) {
      adjustedScore = 5.0
    }

    // Override verdict to WEAK
    adjustedVerdict = 'weak'
    adjustedLabel = 'WEAK SIGNAL'
    adjustedDescription = 'No purchase intent detected. Validate willingness-to-pay before proceeding.'

    // Add prominent red flag
    redFlags.push({
      severity: 'HIGH',
      title: 'No Purchase Intent',
      message: 'Zero willingness-to-pay signals found in community data',
    })
  }

  // Also flag zero WTP even with larger sample (but don't cap as hard)
  if (wtpCount === 0 && totalSignals >= 20) {
    redFlags.push({
      severity: 'HIGH',
      title: 'No Purchase Intent',
      message: `Zero WTP signals found across ${totalSignals} pain signals. Users may not pay for this solution.`,
    })

    // Soft cap at 6.0 for larger samples with zero WTP
    if (adjustedScore > 6.0) {
      adjustedScore = 6.0
    }
  }

  return {
    score: Math.round(adjustedScore * 10) / 10,
    verdict: adjustedVerdict,
    verdictLabel: adjustedLabel,
    verdictDescription: adjustedDescription,
    redFlags,
  }
}

/**
 * Fix 5: Apply Competition Saturation Cap.
 *
 * Saturated markets with dominant free competitors should cap overall viability.
 * Real pain + huge TAM means nothing if 10 free alternatives exist.
 */
function applyCompetitionCap(
  score: number,
  competitionScore: CompetitionScoreInput | null,
  existingRedFlags: RedFlag[]
): { score: number; redFlags: RedFlag[] } {
  const redFlags = [...existingRedFlags]
  let adjustedScore = score

  if (!competitionScore) return { score, redFlags }

  const hasFreeAlts = competitionScore.hasFreeAlternatives ?? false
  const saturated = competitionScore.marketMaturity === 'mature' ||
                   competitionScore.competitorCount >= 5

  // Hard cap: dominated + saturated
  if (hasFreeAlts && saturated) {
    if (adjustedScore > 5.0) {
      adjustedScore = 5.0
    }
    redFlags.push({
      severity: 'HIGH',
      title: 'Saturated Market',
      message: 'Multiple free alternatives exist in a mature market',
    })
  }
  // Soft cap: just saturated
  else if (saturated) {
    if (adjustedScore > 6.5) {
      adjustedScore = 6.5
    }
    redFlags.push({
      severity: 'MEDIUM',
      title: 'Competitive Market',
      message: `${competitionScore.competitorCount} competitors in a ${competitionScore.marketMaturity || 'competitive'} market`,
    })
  }

  return {
    score: Math.round(adjustedScore * 10) / 10,
    redFlags,
  }
}

/**
 * Apply Market Reality Warnings.
 *
 * Checks market sizing results for unrealistic expectations:
 * - Penetration > 25%: Challenging market dynamics
 * - Penetration > 50%: Unrealistic market expectations
 * - All market data is AI-estimated (no external validation)
 */
function applyMarketRealityWarnings(
  marketScore: MarketScoreInput | null,
  existingRedFlags: RedFlag[]
): RedFlag[] {
  const redFlags = [...existingRedFlags]

  if (!marketScore) return redFlags

  // Check penetration requirements
  const penetration = marketScore.penetrationRequired
  if (penetration > 50) {
    redFlags.push({
      severity: 'HIGH',
      title: 'Unrealistic Market Expectations',
      message: `Requires ${penetration.toFixed(0)}% market penetration — rarely achievable. Consider higher pricing or narrower niche.`,
    })
  } else if (penetration > 25) {
    redFlags.push({
      severity: 'MEDIUM',
      title: 'Challenging Market Dynamics',
      message: `Requires ${penetration.toFixed(0)}% penetration — ambitious target. Validate with customer discovery.`,
    })
  }

  // Check achievability rating
  if (marketScore.achievability === 'unlikely') {
    redFlags.push({
      severity: 'HIGH',
      title: 'Unlikely to Achieve Goals',
      message: 'Market math suggests revenue goals may be unrealistic at current pricing.',
    })
  } else if (marketScore.achievability === 'difficult') {
    // Only add if we haven't already flagged high penetration
    const hasPenetrationWarning = redFlags.some(f => f.title.includes('Market'))
    if (!hasPenetrationWarning) {
      redFlags.push({
        severity: 'MEDIUM',
        title: 'Difficult Market Path',
        message: 'Achieving revenue goals will require exceptional execution.',
      })
    }
  }

  return redFlags
}

/**
 * Market Warning Type for export to UI
 */
export interface MarketWarning {
  type: 'ai_estimate' | 'high_penetration' | 'saturated_market' | 'no_wtp' | 'declining_trend'
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  message: string
}

/**
 * Generate market-specific warnings for UI display.
 * Returns structured warnings that components can render appropriately.
 */
export function generateMarketWarnings(
  marketScore: MarketScoreInput | null,
  timingScore: TimingScoreInput | null,
  painScore: PainScoreInput | null,
  competitionScore: CompetitionScoreInput | null
): MarketWarning[] {
  const warnings: MarketWarning[] = []

  // AI Estimate warning (always show - all TAM/SAM/SOM is AI-estimated)
  if (marketScore) {
    warnings.push({
      type: 'ai_estimate',
      severity: 'LOW',
      message: 'Market size estimates are AI-generated. Actual markets may vary 2-10x from estimates.',
    })
  }

  // High penetration warning
  if (marketScore && marketScore.penetrationRequired > 25) {
    const severity = marketScore.penetrationRequired > 50 ? 'HIGH' : 'MEDIUM'
    warnings.push({
      type: 'high_penetration',
      severity,
      message: `${marketScore.penetrationRequired.toFixed(0)}% penetration required — ${severity === 'HIGH' ? 'rarely achievable' : 'ambitious target'}.`,
    })
  }

  // Market saturation warning
  if (competitionScore) {
    const hasFreeAlts = competitionScore.hasFreeAlternatives ?? false
    const saturated = competitionScore.marketMaturity === 'mature' || competitionScore.competitorCount >= 5
    if (hasFreeAlts && saturated) {
      warnings.push({
        type: 'saturated_market',
        severity: 'HIGH',
        message: 'Multiple free alternatives exist in a mature market.',
      })
    } else if (saturated) {
      warnings.push({
        type: 'saturated_market',
        severity: 'MEDIUM',
        message: `${competitionScore.competitorCount} competitors in a ${competitionScore.marketMaturity || 'competitive'} market.`,
      })
    }
  }

  // No WTP warning
  if (painScore && painScore.willingnessToPayCount === 0 && painScore.totalSignals > 0) {
    warnings.push({
      type: 'no_wtp',
      severity: 'HIGH',
      message: 'No purchase intent signals found. Users may not pay for this solution.',
    })
  }

  // Declining trend warning
  if (timingScore && timingScore.trend === 'falling') {
    warnings.push({
      type: 'declining_trend',
      severity: 'MEDIUM',
      message: 'Market interest appears to be declining based on search trends.',
    })
  }

  return warnings
}

// =============================================================================
// TWO-AXIS VERDICT CALCULATORS (v6 - Report Redesign)
// =============================================================================

/**
 * Input for hypothesis confidence calculation
 * Contains filtering metrics from relevance-filter.ts
 */
export interface HypothesisConfidenceInput {
  coreSignals: number        // CORE tier signals (direct hypothesis match)
  relatedSignals: number     // RELATED tier signals (adjacent/broader)
  totalSignals: number       // Total signals detected
  postsAnalyzed: number      // Posts that passed filtering
  sources: string[]          // Data sources used (e.g., ['reddit', 'google_play'])
}

/**
 * Calculate Hypothesis Confidence Score
 *
 * Measures: "Did we find YOUR specific hypothesis?"
 *
 * Scoring:
 * - Direct signal % (CORE / total) - 50% weight
 * - Signal volume - 25% weight
 * - Multi-source confirmation - 25% weight
 */
export function calculateHypothesisConfidence(
  input: HypothesisConfidenceInput | null
): HypothesisConfidence | null {
  if (!input) return null

  const { coreSignals, totalSignals, sources } = input

  // Direct signal % (50% weight)
  // CORE signals are direct hypothesis matches
  // Cap at 100% to prevent edge cases where coreSignals exceeds totalSignals
  const directSignalPercent = totalSignals > 0
    ? Math.min(100, (coreSignals / totalSignals) * 100)
    : 0
  // Scale: 100% CORE = 10, 0% CORE = 0
  const directSignalScore = Math.min(10, directSignalPercent / 10)

  // Signal volume (25% weight)
  // More signals = higher confidence, caps at 100 signals = 10
  const volumeScore = Math.min(10, totalSignals / 10)

  // Multi-source confirmation (25% weight)
  // Multiple sources confirming = higher confidence
  const uniqueSources = new Set(sources)
  const multiSourceScore = uniqueSources.size >= 3 ? 10
    : uniqueSources.size === 2 ? 7
    : uniqueSources.size === 1 ? 4
    : 0

  // Weighted sum
  const score = (directSignalScore * 0.5) + (volumeScore * 0.25) + (multiSourceScore * 0.25)

  // Determine level based on score
  const level: HypothesisConfidenceLevel = score >= 6 ? 'high'
    : score >= 3 ? 'partial'
    : 'low'

  return {
    score: Math.round(score * 10) / 10,
    level,
    directSignalPercent: Math.round(directSignalPercent * 10) / 10,
    signalVolume: totalSignals,
    multiSourceConfirmation: uniqueSources.size >= 2,
    factors: {
      directSignalScore: Math.round(directSignalScore * 10) / 10,
      volumeScore: Math.round(volumeScore * 10) / 10,
      multiSourceScore: Math.round(multiSourceScore * 10) / 10,
    }
  }
}

/**
 * Calculate Market Opportunity Score
 *
 * Measures: "Is there a viable market here?"
 *
 * Scoring:
 * - Market size viability - 30% weight
 * - Timing score - 25% weight
 * - Discussion activity level - 25% weight
 * - Competitor presence (validated market) - 20% weight
 */
export function calculateMarketOpportunity(
  marketScore: { score: number } | null,
  timingScore: { score: number } | null,
  activityMetrics: { postsAnalyzed: number; totalSignals: number } | null,
  competitorCount: number
): MarketOpportunity {
  // Market size (30% weight) - default to 5 if not available
  const marketSizeScore = marketScore?.score ?? 5
  const marketSizeContribution = marketSizeScore * 0.3

  // Timing (25% weight) - default to 5 if not available
  const timingScoreValue = timingScore?.score ?? 5
  const timingContribution = timingScoreValue * 0.25

  // Activity level (25% weight)
  // Based on posts analyzed and signals found
  // 50+ posts analyzed = 10, scaled down from there
  const postsAnalyzed = activityMetrics?.postsAnalyzed ?? 0
  const totalSignals = activityMetrics?.totalSignals ?? 0
  const activityRaw = Math.min(10, (postsAnalyzed / 50) * 10)
  // Bonus for high signal count
  const signalBonus = totalSignals > 50 ? 2 : totalSignals > 20 ? 1 : 0
  const activityScore = Math.min(10, activityRaw + signalBonus)
  const activityContribution = activityScore * 0.25

  // Competitor presence (20% weight)
  // Competitors existing = validated market (good sign)
  // 5+ competitors = 10, 3-4 = 8, 1-2 = 6, 0 = 3
  const competitorScore = competitorCount >= 5 ? 10
    : competitorCount >= 3 ? 8
    : competitorCount >= 1 ? 6
    : 3  // No competitors = unvalidated but not necessarily bad
  const competitorContribution = competitorScore * 0.2

  // Total score
  const score = marketSizeContribution + timingContribution + activityContribution + competitorContribution

  // Determine level
  const level: MarketOpportunityLevel = score >= 7 ? 'strong'
    : score >= 5 ? 'moderate'
    : 'weak'

  return {
    score: Math.round(score * 10) / 10,
    level,
    marketSizeScore,
    timingScore: timingScoreValue,
    activityScore: Math.round(activityScore * 10) / 10,
    competitorPresence: competitorCount > 0,
    factors: {
      marketSizeContribution: Math.round(marketSizeContribution * 10) / 10,
      timingContribution: Math.round(timingContribution * 10) / 10,
      activityContribution: Math.round(activityContribution * 10) / 10,
      competitorContribution: Math.round(competitorContribution * 10) / 10,
    }
  }
}

// =============================================================================
// MAIN CALCULATOR
// =============================================================================

/**
 * Optional input for two-axis verdict system (Report Redesign v6)
 * Pass filteringMetrics to enable HypothesisConfidence and MarketOpportunity scores
 */
export interface TwoAxisInput {
  filteringMetrics?: {
    coreSignals: number
    relatedSignals: number
    postsAnalyzed: number
    sources?: string[]  // e.g., ['reddit', 'google_play']
  }
  // For market opportunity calculation
  marketScore?: number | null
  timingScore?: number | null
  competitorCount?: number
}

export function calculateMVPViability(
  painScore: PainScoreInput | null,
  competitionScore: CompetitionScoreInput | null,
  twoAxisInput?: TwoAxisInput
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

  // Calculate weighted raw score
  let rawScore = 0

  if (availableDimensions === 2) {
    // Both dimensions available - use MVP weights
    rawScore =
      (painScore!.overallScore * MVP_WEIGHTS.pain) +
      (competitionScore!.score * MVP_WEIGHTS.competition)
  } else if (painScore) {
    // Only pain available
    rawScore = painScore.overallScore
  } else if (competitionScore) {
    // Only competition available
    rawScore = competitionScore.score
  }

  // Round to 1 decimal place
  rawScore = Math.round(rawScore * 10) / 10

  // Apply calibration to spread mid-range scores
  const calibratedScore = applyScoreCalibration(rawScore)

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

  // Determine verdict (using calibrated score)
  const verdict = getVerdict(calibratedScore)
  const verdictLabel = getVerdictLabel(verdict)
  const verdictDescription = getVerdictDescription(verdict)

  // Always recommend user interviews as the key next step
  if (dimensions.length >= 2) {
    recommendations.push('Conduct 5-10 user interviews using the Interview Guide to validate these findings with real users')
  }

  // Combine confidence levels
  const confidences = dimensions.map((d) => d.confidence)
  const overallConfidence = combineConfidences(confidences)

  // Calculate data sufficiency
  const { sufficiency: dataSufficiency, reason: dataSufficiencyReason } = calculateDataSufficiency(dimensions, 2)

  // Calculate sample size indicator if we have pain score data
  const sampleSize = painScore
    ? calculateSampleSizeIndicator(painScore.postsAnalyzed, painScore.totalSignals)
    : undefined

  // Calculate calibrated verdict label that accounts for sample size
  const calibratedVerdictLabel = getCalibratedVerdictLabel(verdict, sampleSize)
  const scoreRange = getScoreRange(calibratedScore, sampleSize)

  // Calculate two-axis scores if filtering metrics are provided (v6 Report Redesign)
  let hypothesisConfidence: HypothesisConfidence | null = null
  let marketOpportunity: MarketOpportunity | null = null

  if (twoAxisInput?.filteringMetrics) {
    const { filteringMetrics } = twoAxisInput
    const totalSignals = painScore?.totalSignals || 0

    hypothesisConfidence = calculateHypothesisConfidence({
      coreSignals: filteringMetrics.coreSignals,
      relatedSignals: filteringMetrics.relatedSignals,
      totalSignals,
      postsAnalyzed: filteringMetrics.postsAnalyzed,
      sources: filteringMetrics.sources || ['reddit'],  // Default to Reddit
    })

    marketOpportunity = calculateMarketOpportunity(
      twoAxisInput.marketScore != null ? { score: twoAxisInput.marketScore } : null,
      twoAxisInput.timingScore != null ? { score: twoAxisInput.timingScore } : null,
      { postsAnalyzed: filteringMetrics.postsAnalyzed, totalSignals },
      twoAxisInput.competitorCount || competitionScore?.competitorCount || 0
    )
  }

  return {
    overallScore: calibratedScore,
    rawScore,
    verdict,
    verdictLabel,
    verdictDescription,
    calibratedVerdictLabel,
    scoreRange,
    dimensions,
    weakestDimension,
    dealbreakers,
    recommendations: recommendations.slice(0, 5), // Limit to top 5
    confidence: overallConfidence,
    isComplete: availableDimensions === 2, // MVP requires 2 dimensions
    availableDimensions,
    totalDimensions: 2, // MVP has 2 dimensions
    dataSufficiency,
    dataSufficiencyReason,
    sampleSize,
    // v6: Two-axis verdict system (optional, for backward compatibility)
    hypothesisConfidence: hypothesisConfidence || undefined,
    marketOpportunity: marketOpportunity || undefined,
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
  timingScore: TimingScoreInput | null = null,
  twoAxisInput?: TwoAxisInput
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

  // Add Market dimension if available (with P0 Fix 2: adjusted for WTP, severity, free alternatives)
  if (marketScore) {
    // Apply market score adjustments based on WTP evidence, severity, and free alternatives
    const { adjustedScore: adjustedMarketScore } = calculateAdjustedMarketScore(
      marketScore.score,
      painScore,
      competitionScore
    )

    availableWeights.push({ name: 'market', weight: FULL_WEIGHTS.market, score: adjustedMarketScore })
    const status = getDimensionStatus(adjustedMarketScore)

    // Show both raw and adjusted in summary if they differ significantly
    const marketSummary = adjustedMarketScore < marketScore.score - 1
      ? `${marketScore.penetrationRequired.toFixed(1)}% penetration needed - ${marketScore.achievability.replace('_', ' ')} (adjusted from ${marketScore.score.toFixed(1)} for WTP/competition)`
      : `${marketScore.penetrationRequired.toFixed(1)}% penetration needed - ${marketScore.achievability.replace('_', ' ')}`

    dimensions.push({
      name: 'Market Score',
      score: adjustedMarketScore,
      weight: 0, // Will be normalized below
      status,
      confidence: normalizeConfidence(marketScore.confidence),
      summary: marketSummary,
    })

    if (adjustedMarketScore < DEALBREAKER_THRESHOLD) {
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

  // Calculate weighted raw score
  let rawScore = 0
  for (const d of availableWeights) {
    rawScore += d.score * normalizedWeights[d.name]
  }

  // Round to 1 decimal place
  rawScore = Math.round(rawScore * 10) / 10

  // Apply calibration to spread mid-range scores
  let calibratedScore = applyScoreCalibration(rawScore)

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

  // Determine initial verdict (using calibrated score)
  let verdict = getVerdict(calibratedScore)
  let verdictLabel = getVerdictLabel(verdict)
  let verdictDescription = getVerdictDescription(verdict)

  // P0 Fix 1: Apply WTP Kill Switch (caps score at 5.0 if 0 WTP signals with small sample)
  let redFlags: RedFlag[] = []
  const wtpResult = applyWtpKillSwitch(
    calibratedScore,
    verdict,
    verdictLabel,
    verdictDescription,
    painScore,
    redFlags
  )
  calibratedScore = wtpResult.score
  verdict = wtpResult.verdict
  verdictLabel = wtpResult.verdictLabel
  verdictDescription = wtpResult.verdictDescription
  redFlags = wtpResult.redFlags

  // P1 Fix 5: Apply Competition Saturation Cap
  const competitionCapResult = applyCompetitionCap(calibratedScore, competitionScore, redFlags)
  calibratedScore = competitionCapResult.score
  redFlags = competitionCapResult.redFlags

  // Apply Market Reality Warnings (penetration thresholds, achievability)
  redFlags = applyMarketRealityWarnings(marketScore, redFlags)

  // Always recommend user interviews as the key next step
  if (dimensions.length >= 2) {
    recommendations.push('Conduct 5-10 user interviews using the Interview Guide to validate these findings with real users')
  }

  // Combine confidence levels
  const confidences = dimensions.map((d) => d.confidence)
  const overallConfidence = combineConfidences(confidences)

  // Calculate data sufficiency
  const { sufficiency: dataSufficiency, reason: dataSufficiencyReason } = calculateDataSufficiency(dimensions, 4)

  // Calculate sample size indicator if we have pain score data
  const sampleSize = painScore
    ? calculateSampleSizeIndicator(painScore.postsAnalyzed, painScore.totalSignals)
    : undefined

  // Calculate calibrated verdict label that accounts for sample size
  const calibratedVerdictLabel = getCalibratedVerdictLabel(verdict, sampleSize)
  const scoreRange = getScoreRange(calibratedScore, sampleSize)

  // Calculate two-axis scores if filtering metrics are provided (v6 Report Redesign)
  let hypothesisConfidence: HypothesisConfidence | null = null
  let marketOpportunity: MarketOpportunity | null = null

  if (twoAxisInput?.filteringMetrics) {
    const { filteringMetrics } = twoAxisInput
    const totalSignals = painScore?.totalSignals || 0

    hypothesisConfidence = calculateHypothesisConfidence({
      coreSignals: filteringMetrics.coreSignals,
      relatedSignals: filteringMetrics.relatedSignals,
      totalSignals,
      postsAnalyzed: filteringMetrics.postsAnalyzed,
      sources: filteringMetrics.sources || ['reddit'],  // Default to Reddit
    })

    // For full version, use actual market/timing scores from dimensions
    const actualMarketScore = marketScore?.score ?? twoAxisInput.marketScore ?? null
    const actualTimingScore = timingScore?.score ?? twoAxisInput.timingScore ?? null

    marketOpportunity = calculateMarketOpportunity(
      actualMarketScore != null ? { score: actualMarketScore } : null,
      actualTimingScore != null ? { score: actualTimingScore } : null,
      { postsAnalyzed: filteringMetrics.postsAnalyzed, totalSignals },
      twoAxisInput.competitorCount || competitionScore?.competitorCount || 0
    )
  }

  return {
    overallScore: calibratedScore,
    rawScore,
    verdict,
    verdictLabel,
    verdictDescription,
    calibratedVerdictLabel,
    scoreRange,
    dimensions,
    weakestDimension,
    dealbreakers,
    recommendations: recommendations.slice(0, 5), // Limit to top 5
    confidence: overallConfidence,
    isComplete: availableDimensions === 4, // Full version requires all 4 dimensions
    availableDimensions,
    totalDimensions: 4, // Supports all 4 dimensions
    dataSufficiency,
    dataSufficiencyReason,
    sampleSize,
    redFlags: redFlags.length > 0 ? redFlags : undefined,
    // v6: Two-axis verdict system (optional, for backward compatibility)
    hypothesisConfidence: hypothesisConfidence || undefined,
    marketOpportunity: marketOpportunity || undefined,
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

// =============================================================================
// TIERED FILTER INTEGRATION (Phase 2)
// =============================================================================

import { TieredSignals, TieredScoredSignal } from '@/lib/adapters/types'

/**
 * Extract filtering metrics from TieredSignals for two-axis calculation.
 *
 * Converts tiered signal stats into the format needed by calculateViability().
 *
 * @param tieredSignals - Output from filterSignalsTiered()
 * @returns TwoAxisInput.filteringMetrics object
 */
export function extractFilteringMetrics(
  tieredSignals: TieredSignals
): TwoAxisInput['filteringMetrics'] {
  // Core signals = CORE tier
  const coreSignals = tieredSignals.stats.byTier.core

  // Related signals = STRONG + RELATED tiers (broader relevance)
  const relatedSignals = tieredSignals.stats.byTier.strong + tieredSignals.stats.byTier.related

  // Posts analyzed = total signals processed
  const postsAnalyzed = tieredSignals.stats.total

  // Extract unique sources from stats
  const sources = Object.keys(tieredSignals.stats.bySource)

  return {
    coreSignals,
    relatedSignals,
    postsAnalyzed,
    sources,
  }
}

/**
 * Calculate pain score input from TieredSignals.
 *
 * Converts tiered signal data into PainScoreInput format for viability calculation.
 *
 * @param tieredSignals - Output from filterSignalsTiered()
 * @param themeAnalysis - Optional theme analysis with WTP and intensity data
 * @returns PainScoreInput for calculateViability()
 */
export function extractPainScoreFromTiered(
  tieredSignals: TieredSignals,
  themeAnalysis?: { overallPainScore: number; willingnessToPaySignals: unknown[] }
): PainScoreInput {
  const totalSignals = tieredSignals.stats.total
  const coreCount = tieredSignals.stats.byTier.core
  const strongCount = tieredSignals.stats.byTier.strong

  // Calculate confidence based on signal volume and tier distribution
  let confidence: 'very_low' | 'low' | 'medium' | 'high' = 'low'
  if (totalSignals >= 100 && coreCount >= 20) {
    confidence = 'high'
  } else if (totalSignals >= 50 && coreCount >= 10) {
    confidence = 'medium'
  } else if (totalSignals >= 20) {
    confidence = 'low'
  } else {
    confidence = 'very_low'
  }

  // Count WTP signals from CORE + STRONG
  const allRelevantSignals = [...tieredSignals.core, ...tieredSignals.strong]
  const wtpKeywords = ['would pay', 'willing to pay', 'take my money', 'worth paying', 'paid for', 'subscription']
  const wtpCount = allRelevantSignals.filter(s => {
    const text = `${s.post.title} ${s.post.body}`.toLowerCase()
    return wtpKeywords.some(kw => text.includes(kw))
  }).length

  // Calculate average intensity from theme analysis or estimate from tier distribution
  let averageIntensity = 0.5 // Default moderate
  if (themeAnalysis?.overallPainScore) {
    averageIntensity = themeAnalysis.overallPainScore / 10
  } else if (coreCount > 0) {
    // Estimate: more CORE signals = higher intensity
    const coreRatio = coreCount / Math.max(1, coreCount + strongCount)
    averageIntensity = 0.4 + (coreRatio * 0.4) // Range 0.4-0.8
  }

  // Calculate overall score from tier distribution
  // CORE signals contribute more than STRONG
  const weightedSignalScore = (coreCount * 1.0 + strongCount * 0.7) / Math.max(1, totalSignals)
  const overallScore = themeAnalysis?.overallPainScore ??
    Math.min(10, 3 + (weightedSignalScore * 4) + (totalSignals / 50) * 2)

  return {
    overallScore: Math.round(overallScore * 10) / 10,
    confidence,
    totalSignals,
    willingnessToPayCount: themeAnalysis?.willingnessToPaySignals?.length ?? wtpCount,
    postsAnalyzed: totalSignals,
    averageIntensity,
  }
}

/**
 * Full viability calculation from TieredSignals.
 *
 * Convenience wrapper that:
 * 1. Extracts filtering metrics from tiered signals
 * 2. Calculates pain score from tiered data
 * 3. Runs full viability calculation
 *
 * @param tieredSignals - Output from filterSignalsTiered()
 * @param themeAnalysis - Optional theme analysis
 * @param competitionScore - Optional competition score input
 * @param marketScore - Optional market score input
 * @param timingScore - Optional timing score input
 * @returns ViabilityVerdict with all metrics
 */
export function calculateViabilityFromTiered(
  tieredSignals: TieredSignals,
  themeAnalysis?: { overallPainScore: number; willingnessToPaySignals: unknown[] },
  competitionScore: CompetitionScoreInput | null = null,
  marketScore: MarketScoreInput | null = null,
  timingScore: TimingScoreInput | null = null
): ViabilityVerdict {
  // Extract pain score from tiered signals
  const painScore = extractPainScoreFromTiered(tieredSignals, themeAnalysis)

  // Extract filtering metrics for two-axis system
  const filteringMetrics = extractFilteringMetrics(tieredSignals)

  // Run full calculation with two-axis input
  return calculateViability(
    painScore,
    competitionScore,
    marketScore,
    timingScore,
    {
      filteringMetrics,
      competitorCount: competitionScore?.competitorCount,
    }
  )
}
