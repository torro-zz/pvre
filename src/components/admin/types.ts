// Admin Dashboard Types

export interface User {
  id: string
  email: string
  full_name: string | null
  credits_balance: number
  total_credits_purchased: number
  total_research_runs: number
  created_at: string
  research_jobs: { count: number }[]
  total_spent_cents: number
  avg_spend_per_credit: string | null
}

export interface WaitlistEntry {
  id: string
  email: string
  created_at: string
}

export interface AnalyticsData {
  overview: {
    totalUsers: number
    newUsersThisMonth: number
    totalResearchRuns: number
    activeUsers30d: number
    activeUsers7d: number
    returnRate: number
  }
  revenue: {
    totalRevenue: number
    revenueThisMonth: number
    avgCreditsPerUser: number
    creditsByType: { starter: number; builder: number; founder: number; other: number }
  }
  usage: {
    totalCreditsUsed: number
    totalCreditsPurchased: number
    avgRunsPerUser: number
    jobsByStatus: Record<string, number>
  }
  apiCosts: {
    totalApiCost: number
    estimatedTotalApiCost: number
    totalApiCalls: number
    totalInputTokens: number
    totalOutputTokens: number
    totalTokens: number
    researchWithCostTracking: number
    researchWithoutCostTracking: number
    avgCostPerResearch: number
    costByModel: { model: string; calls: number; cost: number }[]
    margins: {
      avgRevenuePerCredit: number
      avgCostPerCredit: number
      grossMarginPercent: number
      netProfitPerCredit: number
    }
  }
  topUsers: { email: string; runs: number; credits: number; purchased: number }[]
  generatedAt: string
  apiCostResetAt: string | null
}

export interface OrphanedJob {
  id: string
  user_id: string
  user_email: string
  hypothesis: string
  status: string
  created_at: string
  issue: string
}

export interface CreditAuditData {
  orphanedJobs: OrphanedJob[]
  staleJobs: OrphanedJob[]
  summary: {
    totalOrphaned: number
    totalStale: number
    creditsAtRisk: number
  }
  generatedAt: string
}

export interface APIHealthData {
  pendingRefunds: number
  failedWithoutSource: number
  stuckProcessing: number
  errorSourceBreakdown: Record<string, number>
  staleThresholdMinutes: number
  apiHealthResetAt: string | null
}
