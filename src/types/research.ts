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
}

/**
 * Convert structured hypothesis to display string
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

export interface PainSignal {
  text: string
  source_url: string
  subreddit: string
  intensity: 'low' | 'medium' | 'high'
  category: string
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
