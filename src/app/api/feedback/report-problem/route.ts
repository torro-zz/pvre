// Problem Report API Endpoint
// Handles user feedback and auto-refunds credits

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendAdminAlert, getUserRefundCount } from '@/lib/notifications/admin-alerts'

interface ReportProblemRequest {
  jobId: string
  problemType: string
  details?: string
  requestRefund?: boolean
}

export async function POST(req: Request) {
  try {
    // Authenticate user
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Parse request
    const body = await req.json()
    const { jobId, problemType, details, requestRefund } = body as ReportProblemRequest

    if (!jobId || !problemType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Use admin client for database operations that bypass RLS
    const adminSupabase = createAdminClient()

    // Verify the job belongs to this user
    const { data: job, error: jobError } = await adminSupabase
      .from('research_jobs')
      .select('id, user_id')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single()

    if (jobError || !job) {
      return NextResponse.json(
        { error: 'Research job not found' },
        { status: 404 }
      )
    }

    // Check if user already reported this job
    const { data: existingReport } = await adminSupabase
      .from('feedback_reports')
      .select('id')
      .eq('job_id', jobId)
      .eq('user_id', user.id)
      .single()

    if (existingReport) {
      return NextResponse.json(
        { error: 'You have already reported this research' },
        { status: 400 }
      )
    }

    // Log the feedback
    const { error: reportError } = await adminSupabase.from('feedback_reports').insert({
      user_id: user.id,
      job_id: jobId,
      problem_type: problemType,
      details: details || null,
      status: 'pending',
    })

    if (reportError) {
      console.error('Failed to insert feedback report:', reportError)
      // Continue anyway - don't block refund
    }

    // Auto-refund credit if requested
    if (requestRefund) {
      // Check refund count for abuse monitoring
      const previousRefunds = await getUserRefundCount(user.id)

      // On 3rd or more refund, alert admin (but still auto-approve)
      if (previousRefunds >= 2) {
        await sendAdminAlert({
          type: 'refund_pattern',
          userId: user.id,
          userEmail: user.email || undefined,
          message: `User requesting refund #${previousRefunds + 1}. Review pattern.`,
          metadata: {
            refundCount: previousRefunds + 1,
            currentJobId: jobId,
            problemType,
            details: details || null,
          },
        })
      }

      // Add credit back to user
      const { error: creditError } = await adminSupabase.rpc('add_credits', {
        p_user_id: user.id,
        p_credits: 1,
      })

      if (creditError) {
        // Try direct update on profiles table
        console.warn('RPC add_credits failed, trying direct update:', creditError)

        // First get current balance
        const { data: profile } = await adminSupabase
          .from('profiles')
          .select('credits_balance')
          .eq('id', user.id)
          .single()

        if (profile) {
          await adminSupabase
            .from('profiles')
            .update({
              credits_balance: (profile.credits_balance || 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id)
        }
      }

      // Log the credit transaction (non-blocking)
      try {
        await adminSupabase.from('credit_transactions').insert({
          user_id: user.id,
          amount: 1,
          transaction_type: 'refund',
          reason: `Problem report: ${problemType}`,
          job_id: jobId,
        })
      } catch (err) {
        // Table might not exist yet - that's ok
        console.warn('Failed to log credit transaction:', err)
      }
    }

    return NextResponse.json({
      success: true,
      message: requestRefund
        ? 'Report submitted and credit refunded'
        : 'Report submitted',
    })
  } catch (error) {
    console.error('Report problem failed:', error)
    return NextResponse.json(
      { error: 'Failed to submit report' },
      { status: 500 }
    )
  }
}
