import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Fetch research results for a job
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const jobId = searchParams.get('jobId')
    const moduleType = searchParams.get('moduleType')

    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId is required' },
        { status: 400 }
      )
    }

    // First verify user owns this job
    const { data: job, error: jobError } = await supabase
      .from('research_jobs')
      .select('id')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single()

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Build query for results
    let query = supabase
      .from('research_results')
      .select('*')
      .eq('job_id', jobId)

    if (moduleType) {
      query = query.eq('module_name', moduleType)
    }

    const { data: results, error: resultsError } = await query

    if (resultsError) {
      console.error('Failed to fetch results:', resultsError)
      return NextResponse.json(
        { error: 'Failed to fetch results' },
        { status: 500 }
      )
    }

    // If moduleType specified, return single result
    if (moduleType) {
      const result = results?.[0]
      if (!result) {
        return NextResponse.json(
          { error: 'Results not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(result)
    }

    // Return all results for job
    return NextResponse.json(results || [])
  } catch (error) {
    console.error('Research results GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
