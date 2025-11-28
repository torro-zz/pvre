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

export interface InterviewGuide {
  intro_questions: string[]
  pain_exploration: string[]
  solution_validation: string[]
  closing_questions: string[]
}

export interface CreateResearchJobInput {
  hypothesis: string
}
