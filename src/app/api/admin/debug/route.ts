import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCostSummaryByAction, getAverageCostPerUser } from '@/lib/api-costs'

// GET - Fetch all research jobs with their results for debugging
export async function GET() {
  // Only allow in development mode
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development mode' },
      { status: 403 }
    )
  }

  try {
    // Use regular client for auth check
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Use admin client to bypass RLS and fetch ALL users' jobs
    const adminClient = createAdminClient()

    // Fetch ALL jobs from ALL users (admin view)
    const { data: jobs, error: jobsError } = await adminClient
      .from('research_jobs')
      .select('*, profiles:user_id(email, full_name)')
      .order('created_at', { ascending: false })
      .limit(200)

    if (jobsError) {
      console.error('Failed to fetch jobs:', jobsError)
      return NextResponse.json(
        { error: 'Failed to fetch jobs' },
        { status: 500 }
      )
    }

    // Fetch all results for these jobs
    const jobIds = jobs?.map((j) => j.id) || []

    let results: { id: string; job_id: string | null; module_name: string; data: unknown; created_at: string | null }[] = []

    if (jobIds.length > 0) {
      const { data: resultsData, error: resultsError } = await adminClient
        .from('research_results')
        .select('*')
        .in('job_id', jobIds)

      if (resultsError) {
        console.error('Failed to fetch results:', resultsError)
      } else {
        results = resultsData || []
      }
    }

    // Combine jobs with their results
    // Strip large coverage_data to prevent huge payloads
    const jobsWithResults = jobs?.map((job) => {
      // Remove coverage_data if too large (it can contain full app descriptions)
      const cleanedJob = { ...job }
      if (cleanedJob.coverage_data) {
        const coverageData = cleanedJob.coverage_data as Record<string, unknown>
        // Keep only essential fields, drop the full app descriptions
        if (coverageData.appStore && typeof coverageData.appStore === 'object') {
          const appStore = coverageData.appStore as { apps?: Array<Record<string, unknown>> }
          if (appStore.apps) {
            appStore.apps = appStore.apps.map(app => ({
              name: app.name,
              appId: app.appId,
              rating: app.rating,
              reviewCount: app.reviewCount,
              category: app.category,
              developer: app.developer,
              // Strip description to first 200 chars
              description: typeof app.description === 'string' ? app.description.slice(0, 200) + '...' : undefined,
            }))
          }
        }
        if (coverageData.appData && typeof coverageData.appData === 'object') {
          const appData = coverageData.appData as Record<string, unknown>
          if (typeof appData.description === 'string') {
            appData.description = appData.description.slice(0, 200) + '...'
          }
        }
      }
      return {
        ...cleanedJob,
        results: results.filter((r) => r.job_id === job.id),
      }
    }) || []

    // Calculate aggregate stats
    const stats = {
      totalJobs: jobs?.length || 0,
      totalSignals: 0,
      totalWtpSignals: 0,
      highIntensityCount: 0,
      mediumIntensityCount: 0,
      lowIntensityCount: 0,
      averageScore: 0,
    }

    let totalScore = 0
    let scoreCount = 0

    results.forEach((result) => {
      if (result.module_name === 'community_voice') {
        const data = result.data as { painSignals?: { intensity: string; score: number; willingnessToPaySignal: boolean }[] }
        const signals = data?.painSignals || []
        stats.totalSignals += signals.length

        signals.forEach((signal) => {
          if (signal.willingnessToPaySignal) stats.totalWtpSignals++
          if (signal.intensity === 'high') stats.highIntensityCount++
          if (signal.intensity === 'medium') stats.mediumIntensityCount++
          if (signal.intensity === 'low') stats.lowIntensityCount++
          if (typeof signal.score === 'number') {
            totalScore += signal.score
            scoreCount++
          }
        })
      }
    })

    stats.averageScore = scoreCount > 0 ? totalScore / scoreCount : 0

    // Fetch API cost analytics (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [costByAction, avgCostPerUser] = await Promise.all([
      getCostSummaryByAction(thirtyDaysAgo).catch(() => []),
      getAverageCostPerUser(thirtyDaysAgo).catch(() => ({
        uniqueUsers: 0,
        totalCostUsd: 0,
        avgCostPerUser: 0,
      })),
    ])

    // Calculate cost analytics
    const costAnalytics = {
      last30Days: {
        byAction: costByAction,
        totalCostUsd: costByAction.reduce((sum, c) => sum + c.totalCostUsd, 0),
        totalCalls: costByAction.reduce((sum, c) => sum + c.callCount, 0),
        uniqueUsers: avgCostPerUser.uniqueUsers,
        avgCostPerUser: avgCostPerUser.avgCostPerUser,
      },
      breakdown: {
        paidSearch: costByAction.find((c) => c.actionType === 'paid_search') || null,
        freePresearch: costByAction.find((c) => c.actionType === 'free_presearch') || null,
        freeChat: costByAction.find((c) => c.actionType === 'free_chat') || null,
        paidChat: costByAction.find((c) => c.actionType === 'paid_chat') || null,
      },
    }

    return NextResponse.json({
      jobs: jobsWithResults,
      stats,
      costAnalytics,
    })
  } catch (error) {
    console.error('Admin debug API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
