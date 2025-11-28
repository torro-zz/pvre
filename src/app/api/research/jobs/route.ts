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
    const { hypothesis } = body

    if (!hypothesis || typeof hypothesis !== 'string') {
      return NextResponse.json(
        { error: 'Hypothesis is required' },
        { status: 400 }
      )
    }

    // Create a new research job
    const { data: job, error: insertError } = await supabase
      .from('research_jobs')
      .insert({
        user_id: user.id,
        hypothesis: hypothesis.trim(),
        status: 'pending',
      })
      .select()
      .single()

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

// GET - List user's research jobs
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch user's research jobs ordered by creation date
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

// PATCH - Update job status
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

    const body = await request.json()
    const { jobId, status } = body

    if (!jobId || !status) {
      return NextResponse.json(
        { error: 'jobId and status are required' },
        { status: 400 }
      )
    }

    const validStatuses = ['pending', 'processing', 'completed', 'failed']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      )
    }

    // Update job status
    const { data: job, error: updateError } = await supabase
      .from('research_jobs')
      .update({ status })
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
