/**
 * Competitor intelligence types - Single source of truth
 *
 * CONSOLIDATES:
 * - Competitor from: types/research.ts, competitor-analyzer.ts, competitor-intelligence/route.ts
 * - CompetitorGap from: types/research.ts, competitor-analyzer.ts, competitor-intelligence/route.ts
 * - CompetitorIntelligenceResult from: types/research.ts, competitor-analyzer.ts, competitor-intelligence/route.ts
 */

// =============================================================================
// ENUMS & SIMPLE TYPES
// =============================================================================

export type ThreatLevel = 'low' | 'medium' | 'high'

export type FundingLevel =
  | 'bootstrapped'
  | 'seed'
  | 'series-a'
  | 'series-b-plus'
  | 'public'
  | 'unknown'

export type MarketShareEstimate =
  | 'dominant'
  | 'significant'
  | 'moderate'
  | 'small'
  | 'emerging'

export type MarketMaturityLevel = 'emerging' | 'growing' | 'mature' | 'declining'

export type CompetitionIntensity = 'low' | 'medium' | 'high'

export type GapDifficulty = 'low' | 'medium' | 'high'

// =============================================================================
// COMPETITOR (Canonical - from competitor-analyzer.ts)
// =============================================================================

/**
 * Detailed competitor information.
 *
 * This is the CANONICAL version combining fields from:
 * - types/research.ts Competitor (simple: name, url, description, strengths, weaknesses)
 * - types/research.ts CompetitorDetailed (adds positioning, pricing, target audience)
 * - competitor-analyzer.ts Competitor (adds threat level, satisfaction, funding, market share)
 */
// App store data for verified ratings
export interface AppStoreData {
  rating: number           // 1-5 stars (real)
  reviewCount: number      // Number of reviews
  store: 'app_store' | 'google_play'
  appId: string
  appUrl: string           // Link to app store page
}

export interface Competitor {
  // Core identity
  name: string
  description: string

  // Positioning
  positioning: string
  targetAudience: string

  // Pricing
  pricingModel: string | null
  pricingRange: string | null

  // Analysis
  strengths: string[]
  weaknesses: string[]
  differentiators: string[]

  // Competitive assessment
  threatLevel: ThreatLevel
  userSatisfaction: number // 0-10 scale (AI estimate)
  fundingLevel: FundingLevel
  marketShareEstimate: MarketShareEstimate

  // Real app store data (when available)
  appStoreData?: AppStoreData
}

/**
 * Legacy simple competitor type for backwards compatibility.
 * Use Competitor for new code.
 * @deprecated Use Competitor instead
 */
export interface CompetitorSimple {
  name: string
  url: string
  description: string
  strengths: string[]
  weaknesses: string[]
}

// =============================================================================
// COMPETITOR GAP (Canonical)
// =============================================================================

export interface GapSourceBreakdown {
  appStore?: number
  googlePlay?: number
  reddit?: number
}

/**
 * Market gap identified from competitor analysis.
 *
 * Consolidated from types/research.ts and competitor-analyzer.ts.
 */
export interface CompetitorGap {
  // Core gap info
  gap: string
  description: string
  opportunity: string
  difficulty: GapDifficulty

  // Scoring
  opportunityScore: number // 1-10 scale

  // Evidence
  validationSignals: string[]
  evidenceCount?: number
  sourceBreakdown?: GapSourceBreakdown
  clusterIds?: string[] // Signal clusters this gap is based on
}

// =============================================================================
// POSITIONING RECOMMENDATION
// =============================================================================

export interface PositioningRecommendation {
  strategy: string
  description: string
  targetNiche: string
  keyDifferentiators: string[]
  messagingAngles: string[]
}

// =============================================================================
// COMPETITION SCORE
// =============================================================================

export interface CompetitionScoreFactors {
  competitorCount: { value: number; impact: number }
  fundingLevels: { description: string; impact: number }
  userSatisfaction: { average: number; impact: number }
  marketGaps: { count: number; impact: number }
  priceHeadroom: { exists: boolean; impact: number }
}

export interface CompetitionScoreBreakdown {
  score: number
  confidence: 'low' | 'medium' | 'high'
  reasoning: string
  factors: CompetitionScoreFactors
  threats: string[]
}

// =============================================================================
// COMPETITOR MATRIX
// =============================================================================

export interface CompetitorMatrixScore {
  category: string
  score: number
  notes: string
}

export interface CompetitorMatrixEntry {
  competitorName: string
  scores: CompetitorMatrixScore[]
}

export interface CompetitorMatrix {
  categories: string[]
  comparison: CompetitorMatrixEntry[]
}

// =============================================================================
// MARKET OVERVIEW
// =============================================================================

export interface MarketOverview {
  marketSize: string
  growthTrend: string
  maturityLevel: MarketMaturityLevel
  competitionIntensity: CompetitionIntensity
  summary: string
}

// =============================================================================
// COMPETITOR INTELLIGENCE RESULT (Canonical)
// =============================================================================

export interface CompetitorIntelligenceMetadata {
  competitorsAnalyzed: number
  processingTimeMs: number
  timestamp: string
  autoDetected?: boolean
}

/**
 * Full competitor intelligence analysis result.
 *
 * Consolidated from types/research.ts and competitor-analyzer.ts.
 */
export interface CompetitorIntelligenceResult {
  hypothesis: string
  marketOverview: MarketOverview
  competitors: Competitor[]
  competitorMatrix: CompetitorMatrix
  gaps: CompetitorGap[]
  positioningRecommendations: PositioningRecommendation[]
  competitionScore: CompetitionScoreBreakdown
  metadata: CompetitorIntelligenceMetadata
}

// =============================================================================
// ANALYZE OPTIONS
// =============================================================================

export interface GeographyInfo {
  location?: string
  scope?: 'local' | 'national' | 'global'
}

export interface AnalyzeCompetitorsOptions {
  hypothesis: string
  knownCompetitors?: string[]
  geography?: GeographyInfo
  clusters?: unknown[] // SignalCluster[] - using unknown to avoid circular dep
  maxCompetitors?: number
}
