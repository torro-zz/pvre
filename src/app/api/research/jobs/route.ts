import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST - Create a new research job
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { hypothesis, coverageData, structuredHypothesis } = body
    const idempotencyKey = request.headers.get('X-Idempotency-Key')

    // Include structuredHypothesis in coverage_data for storage
    const enrichedCoverageData = coverageData || structuredHypothesis
      ? {
          ...coverageData,
          structuredHypothesis, // Store structured input for research backend
        }
      : null

    console.log('Job creation request:', { hypothesis: hypothesis?.slice(0, 30), hasCoverageData: !!coverageData, hasStructured: !!structuredHypothesis })

    if (!hypothesis || typeof hypothesis !== 'string') {
      return NextResponse.json(
        { error: 'Hypothesis is required' },
        { status: 400 }
      )
    }

    // Check for idempotency key first (most reliable dedup method)
    if (idempotencyKey) {
      const { data: existingByKey } = await supabase
        .from('research_jobs')
        .select('id, created_at, status')
        .eq('user_id', user.id)
        .eq('idempotency_key', idempotencyKey)
        .single()

      if (existingByKey) {
        console.log('Returning existing job by idempotency key:', existingByKey.id)
        return NextResponse.json(existingByKey)
      }
    }

    // Fallback: Check for duplicate job (same hypothesis within 60 seconds)
    // This prevents double-click and network retry duplicates even without idempotency key
    const sixtySecondsAgo = new Date(Date.now() - 60000).toISOString()
    const { data: existingJob } = await supabase
      .from('research_jobs')
      .select('id, created_at, status')
      .eq('user_id', user.id)
      .eq('hypothesis', hypothesis.trim())
      .gte('created_at', sixtySecondsAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (existingJob) {
      // Return existing job instead of creating duplicate
      console.log('Returning existing job to prevent duplicate:', existingJob.id)
      return NextResponse.json(existingJob)
    }

    // Create a new research job
    // Try with coverage_data first, fallback to without if column doesn't exist
    let job = null
    let insertError = null

    // First attempt: with coverage_data (includes structuredHypothesis)
    const result1 = await supabase
      .from('research_jobs')
      .insert({
        user_id: user.id,
        hypothesis: hypothesis.trim(),
        status: 'pending',
        idempotency_key: idempotencyKey || null,
        coverage_data: enrichedCoverageData,
      })
      .select()
      .single()

    if (result1.error && result1.error.message?.includes('coverage_data')) {
      // Fallback: column doesn't exist yet, try without it
      console.log('coverage_data column not found, creating job without it')
      const result2 = await supabase
        .from('research_jobs')
        .insert({
          user_id: user.id,
          hypothesis: hypothesis.trim(),
          status: 'pending',
          idempotency_key: idempotencyKey || null,
        })
        .select()
        .single()
      job = result2.data
      insertError = result2.error
    } else {
      job = result1.data
      insertError = result1.error
    }

    if (insertError) {
      console.error('Failed to create research job:', insertError)
      return NextResponse.json(
        { error: 'Failed to create research job' },
        { status: 500 }
      )
    }

    return NextResponse.json(job)
  } catch (error) {
    console.error('Research jobs POST error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET - List user's research jobs or fetch a single job by ID
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
    const jobId = searchParams.get('id')

    // If ID is provided, fetch single job
    if (jobId) {
      const { data: job, error: fetchError } = await supabase
        .from('research_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('user_id', user.id)
        .single()

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          return NextResponse.json(
            { error: 'Job not found' },
            { status: 404 }
          )
        }
        console.error('Failed to fetch research job:', fetchError)
        return NextResponse.json(
          { error: 'Failed to fetch research job' },
          { status: 500 }
        )
      }

      return NextResponse.json(job)
    }

    // Otherwise, fetch all user's research jobs ordered by creation date
    const { data: jobs, error: fetchError } = await supabase
      .from('research_jobs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (fetchError) {
      console.error('Failed to fetch research jobs:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch research jobs' },
        { status: 500 }
      )
    }

    return NextResponse.json(jobs || [])
  } catch (error) {
    console.error('Research jobs GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH - Update job status or folder
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Support both body param and query param for jobId
    const searchParams = request.nextUrl.searchParams
    const body = await request.json()
    const jobId = body.jobId || searchParams.get('id')
    const { status, folder_id } = body

    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId is required' },
        { status: 400 }
      )
    }

    // Build update object with provided fields
    const updateData: { status?: string; folder_id?: string | null } = {}

    if (status !== undefined) {
      const validStatuses = ['pending', 'processing', 'completed', 'failed']
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status' },
          { status: 400 }
        )
      }
      updateData.status = status
    }

    if (folder_id !== undefined) {
      // folder_id can be null (to remove from folder) or a valid UUID
      updateData.folder_id = folder_id
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    // Update job
    const { data: job, error: updateError } = await supabase
      .from('research_jobs')
      .update(updateData)
      .eq('id', jobId)
      .eq('user_id', user.id) // Ensure user owns this job
      .select()
      .single()

    if (updateError) {
      console.error('Failed to update research job:', updateError)
      return NextResponse.json(
        { error: 'Failed to update research job' },
        { status: 500 }
      )
    }

    return NextResponse.json(job)
  } catch (error) {
    console.error('Research jobs PATCH error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete a research job and its associated results
export async function DELETE(request: NextRequest) {
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
    const jobId = searchParams.get('id')

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      )
    }

    // First verify the user owns this job
    const { data: job, error: fetchError } = await supabase
      .from('research_jobs')
      .select('id')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !job) {
      return NextResponse.json(
        { error: 'Job not found or unauthorized' },
        { status: 404 }
      )
    }

    // Delete associated research results first (cascade delete)
    const { error: resultsDeleteError } = await supabase
      .from('research_results')
      .delete()
      .eq('job_id', jobId)

    if (resultsDeleteError) {
      console.error('Failed to delete research results:', resultsDeleteError)
      // Continue anyway - the results table might have RLS that blocks this
    }

    // Delete the job
    const { error: deleteError } = await supabase
      .from('research_jobs')
      .delete()
      .eq('id', jobId)
      .eq('user_id', user.id)

    if (deleteError) {
      console.error('Failed to delete research job:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete research job' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Research jobs DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
