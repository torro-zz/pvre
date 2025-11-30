import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch all jobs for the user
    const { data: jobs, error: jobsError } = await supabase
      .from('research_jobs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (jobsError) {
      console.error('Failed to fetch jobs:', jobsError)
      return NextResponse.json(
        { error: 'Failed to fetch jobs' },
        { status: 500 }
      )
    }

    // Fetch all results for these jobs
    const jobIds = jobs?.map((j) => j.id) || []

    let results: { id: string; job_id: string; module_name: string; data: unknown; created_at: string }[] = []

    if (jobIds.length > 0) {
      const { data: resultsData, error: resultsError } = await supabase
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
    const jobsWithResults = jobs?.map((job) => ({
      ...job,
      results: results.filter((r) => r.job_id === job.id),
    })) || []

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

    return NextResponse.json({
      jobs: jobsWithResults,
      stats,
    })
  } catch (error) {
    console.error('Admin debug API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
