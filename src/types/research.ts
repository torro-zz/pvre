/**
 * Target geography type for market sizing scoping
 */
export type GeographyScope = 'local' | 'national' | 'global'

export interface TargetGeography {
  scope: GeographyScope
  location?: string       // City/region for local, country for national
  detectedFrom?: string   // Where we inferred this from (e.g., "audience field")
}

/**
 * Structured hypothesis input - addresses the 64% relevance problem
 * by separating audience, problem, and customer language
 */
export interface StructuredHypothesis {
  audience: string        // "Who's struggling?" (required)
  problem: string         // "What's their problem?" (required)
  problemLanguage?: string // "How do THEY describe it?" (optional)
  solution?: string       // "Your solution idea" (optional)
  excludeTopics?: string  // "Exclude posts about:" (optional) - filters out irrelevant noise
  targetGeography?: TargetGeography // Where will you launch? (for market sizing)
}

/**
 * Common location patterns for geography detection
 */
const LOCATION_PATTERNS: { pattern: RegExp; location: string; scope: GeographyScope }[] = [
  // Cities
  { pattern: /\b(london|uk|british)\b/i, location: 'London, UK', scope: 'local' },
  { pattern: /\b(new york|nyc|manhattan)\b/i, location: 'New York, USA', scope: 'local' },
  { pattern: /\b(los angeles|la|socal)\b/i, location: 'Los Angeles, USA', scope: 'local' },
  { pattern: /\b(san francisco|sf|bay area)\b/i, location: 'San Francisco, USA', scope: 'local' },
  { pattern: /\b(chicago)\b/i, location: 'Chicago, USA', scope: 'local' },
  { pattern: /\b(toronto)\b/i, location: 'Toronto, Canada', scope: 'local' },
  { pattern: /\b(vancouver)\b/i, location: 'Vancouver, Canada', scope: 'local' },
  { pattern: /\b(sydney)\b/i, location: 'Sydney, Australia', scope: 'local' },
  { pattern: /\b(melbourne)\b/i, location: 'Melbourne, Australia', scope: 'local' },
  { pattern: /\b(berlin)\b/i, location: 'Berlin, Germany', scope: 'local' },
  { pattern: /\b(paris)\b/i, location: 'Paris, France', scope: 'local' },
  { pattern: /\b(amsterdam)\b/i, location: 'Amsterdam, Netherlands', scope: 'local' },
  // Countries
  { pattern: /\b(american|united states|usa|u\.s\.)\b/i, location: 'United States', scope: 'national' },
  { pattern: /\b(canadian|canada)\b/i, location: 'Canada', scope: 'national' },
  { pattern: /\b(australian|australia)\b/i, location: 'Australia', scope: 'national' },
  { pattern: /\b(german|germany)\b/i, location: 'Germany', scope: 'national' },
  { pattern: /\b(french|france)\b/i, location: 'France', scope: 'national' },
  { pattern: /\b(indian|india)\b/i, location: 'India', scope: 'national' },
]

/**
 * Detect geography from audience text
 * Returns undefined if no geography detected (defaults to global)
 */
export function detectGeographyFromAudience(audience: string): TargetGeography | undefined {
  for (const { pattern, location, scope } of LOCATION_PATTERNS) {
    if (pattern.test(audience)) {
      return {
        scope,
        location,
        detectedFrom: 'audience field',
      }
    }
  }
  return undefined
}

/**
 * Convert structured hypothesis to display string (includes solution for UI display)
 */
export function formatHypothesis(input: StructuredHypothesis | string): string {
  if (typeof input === 'string') return input
  const parts = [input.audience, 'who', input.problem]
  if (input.solution) {
    parts.push('— solution:', input.solution)
  }
  return parts.join(' ')
}

/**
 * Convert structured hypothesis to search-optimized string
 * CRITICAL: Excludes solution field to prevent polluting search results
 * Solution terms like "community dinners" would find irrelevant posts
 */
export function formatHypothesisForSearch(input: StructuredHypothesis | string): string {
  if (typeof input === 'string') return input
  const parts = [input.audience, 'who', input.problem]
  if (input.problemLanguage) {
    parts.push(`(describing it as: ${input.problemLanguage})`)
  }
  // NEVER include solution field - it pollutes search results
  return parts.join(' ')
}

/**
 * Check if input is structured format
 */
export function isStructuredHypothesis(input: unknown): input is StructuredHypothesis {
  return (
    typeof input === 'object' &&
    input !== null &&
    'audience' in input &&
    'problem' in input &&
    typeof (input as StructuredHypothesis).audience === 'string' &&
    typeof (input as StructuredHypothesis).problem === 'string'
  )
}

export interface ResearchJob {
  id: string
  user_id: string
  hypothesis: string
  structured_hypothesis?: StructuredHypothesis // New: structured input if available
  status: 'pending' | 'processing' | 'completed' | 'failed'
  pain_signals: PainSignal[]
  competitors: Competitor[]
  interview_guide: InterviewGuide | null
  error_message?: string
  created_at: string
  updated_at: string
}

export type EmotionType = 'frustration' | 'anxiety' | 'disappointment' | 'confusion' | 'hope' | 'neutral'

export interface PainSignal {
  text: string
  source_url: string
  subreddit: string
  intensity: 'low' | 'medium' | 'high'
  category: string
  emotion?: EmotionType  // Primary emotion detected in the signal
}

export interface Competitor {
  name: string
  url: string
  description: string
  strengths: string[]
  weaknesses: string[]
}

// Extended competitor types for Competitor Intelligence module
export interface CompetitorDetailed {
  name: string
  website: string | null
  description: string
  positioning: string
  targetAudience: string
  pricingModel: string | null
  pricingRange: string | null
  strengths: string[]
  weaknesses: string[]
  differentiators: string[]
}

export interface CompetitorGap {
  gap: string
  description: string
  opportunity: string
  difficulty: 'low' | 'medium' | 'high'
  // Enhanced fields
  opportunityScore?: number // 1-10 scale
  validationSignals?: string[] // Evidence supporting this gap
  evidenceCount?: number // Total signals supporting this gap
  sourceBreakdown?: {
    appStore?: number
    googlePlay?: number
    reddit?: number
  }
  clusterIds?: string[] // Which clusters this gap is based on
}

export interface PositioningRecommendation {
  strategy: string
  description: string
  targetNiche: string
  keyDifferentiators: string[]
  messagingAngles: string[]
}

export interface CompetitorIntelligenceResult {
  hypothesis: string
  marketOverview: {
    marketSize: string
    growthTrend: string
    maturityLevel: 'emerging' | 'growing' | 'mature' | 'declining'
    competitionIntensity: 'low' | 'medium' | 'high'
    summary: string
  }
  competitors: CompetitorDetailed[]
  competitorMatrix: {
    categories: string[]
    comparison: {
      competitorName: string
      scores: { category: string; score: number; notes: string }[]
    }[]
  }
  gaps: CompetitorGap[]
  positioningRecommendations: PositioningRecommendation[]
  metadata: {
    competitorsAnalyzed: number
    processingTimeMs: number
    timestamp: string
  }
}

export interface InterviewGuide {
  intro_questions: string[]
  pain_exploration: string[]
  solution_validation: string[]
  closing_questions: string[]
}

export interface CreateResearchJobInput {
  hypothesis: string
  structuredHypothesis?: StructuredHypothesis // New: structured input (optional for backwards compat)
}
