import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/research/jobs/rerun
 *
 * Re-runs a stuck research job by:
 * 1. Marking the old job as 'failed'
 * 2. Creating a new job with the same hypothesis and settings
 * 3. Returning the new job ID for redirect
 *
 * This allows users to recover from stuck "processing" jobs without
 * losing their hypothesis and configuration.
 */
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
    const { jobId } = body

    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId is required' },
        { status: 400 }
      )
    }

    // Fetch the original job
    const { data: originalJob, error: fetchError } = await supabase
      .from('research_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !originalJob) {
      return NextResponse.json(
        { error: 'Job not found or unauthorized' },
        { status: 404 }
      )
    }

    // Only allow re-run for processing or pending jobs
    if (originalJob.status === 'completed') {
      return NextResponse.json(
        { error: 'Cannot re-run a completed job' },
        { status: 400 }
      )
    }

    // Mark the old job as failed
    const { error: updateError } = await supabase
      .from('research_jobs')
      .update({
        status: 'failed',
        error_message: 'Re-run requested by user - original job was stuck',
      })
      .eq('id', jobId)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Failed to mark old job as failed:', updateError)
      // Continue anyway - we still want to create the new job
    }

    // Create new job with same hypothesis and coverage_data
    const { data: newJob, error: insertError } = await supabase
      .from('research_jobs')
      .insert({
        user_id: user.id,
        hypothesis: originalJob.hypothesis,
        status: 'pending',
        coverage_data: originalJob.coverage_data,
        folder_id: originalJob.folder_id,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to create new job:', insertError)
      return NextResponse.json(
        { error: 'Failed to create new research job' },
        { status: 500 }
      )
    }

    console.log(`[Rerun] Job ${jobId} marked as failed, new job created: ${newJob.id}`)

    return NextResponse.json({
      success: true,
      oldJobId: jobId,
      newJobId: newJob.id,
      newJob,
    })
  } catch (error) {
    console.error('Research jobs rerun error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
