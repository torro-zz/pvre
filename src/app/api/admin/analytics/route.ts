import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/admin'
import { NextRequest, NextResponse } from 'next/server'
import { getCostSummaryByAction, getAverageCostPerUser, type CostSummary } from '@/lib/api-costs'

export async function GET(request: NextRequest) {
  // Get optional resetAt timestamp for filtering API costs
  const searchParams = request.nextUrl.searchParams
  const apiCostResetAt = searchParams.get('apiCostResetAt')
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Admin check
  if (!isAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Use admin client for data queries to bypass RLS and see all users' data
  const adminClient = createAdminClient()

  try {
    // Fetch all required data in parallel
    const [
      usersResult,
      transactionsResult,
      jobsResult,
      purchasesResult,
      researchResultsResult,
    ] = await Promise.all([
      // All users with credits
      adminClient
        .from('profiles')
        .select('id, email, credits_balance, total_credits_purchased, total_research_runs, created_at'),

      // Credit transactions
      adminClient
        .from('credit_transactions')
        .select('*')
        .order('created_at', { ascending: false }),

      // Research jobs
      adminClient
        .from('research_jobs')
        .select('id, user_id, status, created_at, updated_at')
        .order('created_at', { ascending: false }),

      // Purchases
      adminClient
        .from('purchases')
        .select('*')
        .eq('status', 'completed')
        .order('created_at', { ascending: false }),

      // Research results (for token usage/API costs) - filtered by reset timestamp if provided
      (async () => {
        let query = adminClient
          .from('research_results')
          .select('id, job_id, module_name, data, created_at')
        if (apiCostResetAt) {
          query = query.gte('created_at', apiCostResetAt)
        }
        return query.order('created_at', { ascending: false })
      })(),
    ])

    const users = usersResult.data || []
    const transactions = transactionsResult.data || []
    const jobs = jobsResult.data || []
    const purchases = purchasesResult.data || []
    const researchResults = researchResultsResult.data || []

    // Calculate metrics
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Revenue metrics (amount_cents -> dollars)
    const totalRevenue = purchases.reduce((sum, p) => sum + (p.amount_cents || 0) / 100, 0)
    const revenueThisMonth = purchases
      .filter((p) => p.created_at && new Date(p.created_at) >= thirtyDaysAgo)
      .reduce((sum, p) => sum + (p.amount_cents || 0) / 100, 0)

    // Credit purchase breakdown
    const creditsByType = transactions
      .filter((t) => t.transaction_type === 'purchase')
      .reduce(
        (acc, t) => {
          const amount = Math.abs(t.amount)
          if (amount === 3) acc.starter += 1
          else if (amount === 10) acc.builder += 1
          else if (amount === 30) acc.founder += 1
          else acc.other += 1
          return acc
        },
        { starter: 0, builder: 0, founder: 0, other: 0 }
      )

    // Usage metrics
    const totalResearchRuns = users.reduce((sum, u) => sum + (u.total_research_runs || 0), 0)
    const usersWithMultipleRuns = users.filter((u) => (u.total_research_runs || 0) > 1).length
    const returnRate = users.length > 0 ? (usersWithMultipleRuns / users.length) * 100 : 0

    // Active users (researched in last 30 days)
    const activeUserIds = new Set(
      jobs
        .filter((j) => j.created_at && new Date(j.created_at) >= thirtyDaysAgo)
        .map((j) => j.user_id)
    )
    const activeUsers30d = activeUserIds.size

    // Active users this week
    const activeUsersWeekIds = new Set(
      jobs
        .filter((j) => j.created_at && new Date(j.created_at) >= sevenDaysAgo)
        .map((j) => j.user_id)
    )
    const activeUsers7d = activeUsersWeekIds.size

    // Jobs by status
    const jobsByStatus = jobs.reduce(
      (acc, j) => {
        const status = j.status || 'unknown'
        acc[status] = (acc[status] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    // Research per day (last 30 days)
    const researchByDay: Record<string, number> = {}
    jobs
      .filter((j) => j.created_at && new Date(j.created_at) >= thirtyDaysAgo)
      .forEach((j) => {
        const day = new Date(j.created_at!).toISOString().split('T')[0]
        researchByDay[day] = (researchByDay[day] || 0) + 1
      })

    // Average credits per user
    const avgCreditsPerUser = users.length > 0
      ? users.reduce((sum, u) => sum + (u.total_credits_purchased || 0), 0) / users.length
      : 0

    // Average runs per active user
    const avgRunsPerUser = users.filter(u => (u.total_research_runs || 0) > 0).length > 0
      ? totalResearchRuns / users.filter(u => (u.total_research_runs || 0) > 0).length
      : 0

    // New users this month
    const newUsersThisMonth = users.filter(
      (u) => u.created_at && new Date(u.created_at) >= thirtyDaysAgo
    ).length

    // Credit usage vs purchases
    const totalCreditsUsed = transactions
      .filter((t) => t.transaction_type === 'usage')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)

    const totalCreditsPurchased = transactions
      .filter((t) => t.transaction_type === 'purchase')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)

    // Top users by research runs
    const topUsersByRuns = [...users]
      .sort((a, b) => (b.total_research_runs || 0) - (a.total_research_runs || 0))
      .slice(0, 10)
      .map((u) => ({
        email: u.email,
        runs: u.total_research_runs || 0,
        credits: u.credits_balance || 0,
        purchased: u.total_credits_purchased || 0,
      }))

    // Transactions timeline (last 30 days by day)
    const transactionsByDay: Record<string, { purchases: number; usage: number; bonuses: number }> = {}
    transactions
      .filter((t) => t.created_at && new Date(t.created_at) >= thirtyDaysAgo)
      .forEach((t) => {
        const day = new Date(t.created_at!).toISOString().split('T')[0]
        if (!transactionsByDay[day]) {
          transactionsByDay[day] = { purchases: 0, usage: 0, bonuses: 0 }
        }
        if (t.transaction_type === 'purchase') {
          transactionsByDay[day].purchases += Math.abs(t.amount)
        } else if (t.transaction_type === 'usage') {
          transactionsByDay[day].usage += Math.abs(t.amount)
        } else if (t.transaction_type === 'bonus') {
          transactionsByDay[day].bonuses += Math.abs(t.amount)
        }
      })

    // Claude API Cost Analysis
    interface TokenUsage {
      totalCalls: number
      totalInputTokens: number
      totalOutputTokens: number
      totalTokens: number
      totalCostUsd: number
      costBreakdown?: { model: string; calls: number; cost: number }[]
    }

    // Extract token usage from research results
    let totalApiCost = 0
    let totalApiCalls = 0
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let researchWithCostTracking = 0
    const costByModel: Record<string, { calls: number; cost: number; inputTokens: number; outputTokens: number }> = {}

    for (const result of researchResults) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = result.data as any
      const tokenUsage: TokenUsage | undefined = data?.metadata?.tokenUsage

      if (tokenUsage && tokenUsage.totalCostUsd > 0) {
        researchWithCostTracking++
        totalApiCost += tokenUsage.totalCostUsd
        totalApiCalls += tokenUsage.totalCalls
        totalInputTokens += tokenUsage.totalInputTokens
        totalOutputTokens += tokenUsage.totalOutputTokens

        // Aggregate by model
        if (tokenUsage.costBreakdown) {
          for (const breakdown of tokenUsage.costBreakdown) {
            if (!costByModel[breakdown.model]) {
              costByModel[breakdown.model] = { calls: 0, cost: 0, inputTokens: 0, outputTokens: 0 }
            }
            costByModel[breakdown.model].calls += breakdown.calls
            costByModel[breakdown.model].cost += breakdown.cost
          }
        }
      }
    }

    // Calculate margins
    // Credit pricing: Starter ($4.99/3), Builder ($14.99/10), Founder ($39.99/30)
    // Average price per credit: ~$1.50 (varies by pack)
    const avgRevenuePerCredit = totalCreditsUsed > 0 ? totalRevenue / totalCreditsUsed : 0
    const avgCostPerCredit = researchWithCostTracking > 0 ? totalApiCost / researchWithCostTracking : 0
    const grossMargin = avgRevenuePerCredit > 0 ? ((avgRevenuePerCredit - avgCostPerCredit) / avgRevenuePerCredit) * 100 : 0

    // Estimated total API cost (extrapolate for research without tracking)
    const estimatedTotalApiCost = researchWithCostTracking > 0
      ? (totalApiCost / researchWithCostTracking) * totalResearchRuns
      : 0

    // Fetch granular API costs from the new api_costs table (last 30 days)
    const costByActionType = await getCostSummaryByAction(thirtyDaysAgo).catch(() => [] as CostSummary[])

    // Calculate chat and presearch cost summaries
    const freeChat = costByActionType.find(c => c.actionType === 'free_chat')
    const paidChat = costByActionType.find(c => c.actionType === 'paid_chat')
    const freePresearch = costByActionType.find(c => c.actionType === 'free_presearch')

    const chatCosts = {
      totalFreeChats: freeChat?.callCount || 0,
      totalPaidChats: paidChat?.callCount || 0,
      freeChatCostUsd: freeChat?.totalCostUsd || 0,
      paidChatCostUsd: paidChat?.totalCostUsd || 0,
    }

    const presearchCosts = {
      totalPresearches: freePresearch?.callCount || 0,
      totalCostUsd: freePresearch?.totalCostUsd || 0,
      avgCostPerPresearch: freePresearch && freePresearch.callCount > 0
        ? freePresearch.totalCostUsd / freePresearch.callCount
        : 0,
    }

    return NextResponse.json({
      // Overview
      overview: {
        totalUsers: users.length,
        newUsersThisMonth,
        totalResearchRuns,
        activeUsers30d,
        activeUsers7d,
        returnRate: Math.round(returnRate * 10) / 10,
      },

      // Revenue
      revenue: {
        totalRevenue,
        revenueThisMonth,
        avgCreditsPerUser: Math.round(avgCreditsPerUser * 10) / 10,
        creditsByType,
      },

      // Usage
      usage: {
        totalCreditsUsed,
        totalCreditsPurchased,
        avgRunsPerUser: Math.round(avgRunsPerUser * 10) / 10,
        jobsByStatus,
      },

      // Time series
      timeSeries: {
        researchByDay,
        transactionsByDay,
      },

      // Top users
      topUsers: topUsersByRuns,

      // Claude API Costs
      apiCosts: {
        totalApiCost: Math.round(totalApiCost * 1000) / 1000,
        estimatedTotalApiCost: Math.round(estimatedTotalApiCost * 1000) / 1000,
        totalApiCalls,
        totalInputTokens,
        totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
        researchWithCostTracking,
        researchWithoutCostTracking: totalResearchRuns - researchWithCostTracking,
        avgCostPerResearch: researchWithCostTracking > 0
          ? Math.round((totalApiCost / researchWithCostTracking) * 1000) / 1000
          : 0,
        costByModel: Object.entries(costByModel).map(([model, data]) => ({
          model,
          calls: data.calls,
          cost: Math.round(data.cost * 1000) / 1000,
        })),
        // Margin analysis
        margins: {
          avgRevenuePerCredit: Math.round(avgRevenuePerCredit * 100) / 100,
          avgCostPerCredit: Math.round(avgCostPerCredit * 1000) / 1000,
          grossMarginPercent: Math.round(grossMargin * 10) / 10,
          netProfitPerCredit: Math.round((avgRevenuePerCredit - avgCostPerCredit) * 100) / 100,
        },
        // Granular tracking from api_costs table (last 30 days)
        byActionType: costByActionType.map(c => ({
          actionType: c.actionType,
          callCount: c.callCount,
          totalInputTokens: c.totalInputTokens,
          totalOutputTokens: c.totalOutputTokens,
          totalCostUsd: Math.round(c.totalCostUsd * 1000) / 1000,
        })),
        chatCosts: {
          totalFreeChats: chatCosts.totalFreeChats,
          totalPaidChats: chatCosts.totalPaidChats,
          freeChatCostUsd: Math.round(chatCosts.freeChatCostUsd * 1000) / 1000,
          paidChatCostUsd: Math.round(chatCosts.paidChatCostUsd * 1000) / 1000,
        },
        presearchCosts: {
          totalPresearches: presearchCosts.totalPresearches,
          totalCostUsd: Math.round(presearchCosts.totalCostUsd * 1000) / 1000,
          avgCostPerPresearch: Math.round(presearchCosts.avgCostPerPresearch * 10000) / 10000,
        },
      },

      // Last updated
      generatedAt: new Date().toISOString(),

      // Reset timestamp (if filtering is active)
      apiCostResetAt: apiCostResetAt || null,
    })
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}
