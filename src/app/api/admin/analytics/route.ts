import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/admin'
import { NextResponse } from 'next/server'

export async function GET() {
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

  try {
    // Fetch all required data in parallel
    const [
      usersResult,
      transactionsResult,
      jobsResult,
      purchasesResult,
    ] = await Promise.all([
      // All users with credits
      supabase
        .from('profiles')
        .select('id, email, credits_balance, total_credits_purchased, total_research_runs, created_at'),

      // Credit transactions
      supabase
        .from('credit_transactions')
        .select('*')
        .order('created_at', { ascending: false }),

      // Research jobs
      supabase
        .from('research_jobs')
        .select('id, user_id, status, created_at, updated_at')
        .order('created_at', { ascending: false }),

      // Purchases
      supabase
        .from('purchases')
        .select('*')
        .eq('status', 'completed')
        .order('created_at', { ascending: false }),
    ])

    const users = usersResult.data || []
    const transactions = transactionsResult.data || []
    const jobs = jobsResult.data || []
    const purchases = purchasesResult.data || []

    // Calculate metrics
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Revenue metrics
    const totalRevenue = purchases.reduce((sum, p) => sum + (p.amount_usd || 0), 0)
    const revenueThisMonth = purchases
      .filter((p) => new Date(p.created_at) >= thirtyDaysAgo)
      .reduce((sum, p) => sum + (p.amount_usd || 0), 0)

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
        .filter((j) => new Date(j.created_at) >= thirtyDaysAgo)
        .map((j) => j.user_id)
    )
    const activeUsers30d = activeUserIds.size

    // Active users this week
    const activeUsersWeekIds = new Set(
      jobs
        .filter((j) => new Date(j.created_at) >= sevenDaysAgo)
        .map((j) => j.user_id)
    )
    const activeUsers7d = activeUsersWeekIds.size

    // Jobs by status
    const jobsByStatus = jobs.reduce(
      (acc, j) => {
        acc[j.status] = (acc[j.status] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    // Research per day (last 30 days)
    const researchByDay: Record<string, number> = {}
    jobs
      .filter((j) => new Date(j.created_at) >= thirtyDaysAgo)
      .forEach((j) => {
        const day = new Date(j.created_at).toISOString().split('T')[0]
        researchByDay[day] = (researchByDay[day] || 0) + 1
      })

    // Average credits per user
    const avgCreditsPerUser = users.length > 0
      ? users.reduce((sum, u) => sum + (u.total_credits_purchased || 0), 0) / users.length
      : 0

    // Average runs per active user
    const avgRunsPerUser = users.filter(u => u.total_research_runs > 0).length > 0
      ? totalResearchRuns / users.filter(u => u.total_research_runs > 0).length
      : 0

    // New users this month
    const newUsersThisMonth = users.filter(
      (u) => new Date(u.created_at) >= thirtyDaysAgo
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
      .filter((t) => new Date(t.created_at) >= thirtyDaysAgo)
      .forEach((t) => {
        const day = new Date(t.created_at).toISOString().split('T')[0]
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

      // Last updated
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}
