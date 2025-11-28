export interface ResearchJob {
  id: string
  user_id: string
  hypothesis: string
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
}
