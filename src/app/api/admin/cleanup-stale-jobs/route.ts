import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendAdminAlert } from '@/lib/notifications/admin-alerts'
import { isAdmin } from '@/lib/admin'

// Stale threshold: 10 minutes
const STALE_THRESHOLD_MS = 10 * 60 * 1000

interface StaleJobStats {
  failedWithSource: number
  failedWithoutSource: number
  stuckProcessing: number
  stuckProcessingAutoFailed: number
  refunded: number
  errorSourceBreakdown: Record<string, number>
}

/**
 * POST /api/admin/cleanup-stale-jobs
 *
 * Processes stale and failed jobs:
 * 1. Jobs with status='failed' AND error_source set → auto-refund + alert admin
 * 2. Jobs stuck in 'processing' > 10 minutes → auto-fail + refund + alert admin
 *
 * This endpoint can be called manually (admin auth) or via Vercel cron (CRON_SECRET).
 */
export async function POST(request: NextRequest) {
  try {
    // Check for Vercel cron secret (allows automated cron calls)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const isCronCall = cronSecret && authHeader === `Bearer ${cronSecret}`

    if (!isCronCall) {
      // Verify admin access for manual calls
      const supabase = await createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      // Check if user is admin
      if (!isAdmin(user.email)) {
        return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
      }
    }

    const adminClient = createAdminClient()
    const stats: StaleJobStats = {
      failedWithSource: 0,
      failedWithoutSource: 0,
      stuckProcessing: 0,
      stuckProcessingAutoFailed: 0,
      refunded: 0,
      errorSourceBreakdown: {},
    }

    // 1. Find failed jobs with known error source that haven't been refunded
    const { data: failedJobs, error: failedError } = await adminClient
      .from('research_jobs')
      .select('id, user_id, hypothesis, error_source, error_message, created_at')
      .eq('status', 'failed')
      .not('error_source', 'is', null)
      .is('refunded_at', null)

    if (failedError) {
      console.error('Failed to fetch failed jobs:', failedError)
    }

    // Process failed jobs with known error source → auto-refund
    if (failedJobs && failedJobs.length > 0) {
      stats.failedWithSource = failedJobs.length

      for (const job of failedJobs) {
        // Track error source breakdown
        const source = job.error_source || 'unknown'
        stats.errorSourceBreakdown[source] = (stats.errorSourceBreakdown[source] || 0) + 1

        // Auto-refund using the RPC function
        const { data: refundSuccess, error: refundError } = await adminClient.rpc('refund_credit', {
          p_user_id: job.user_id,
          p_job_id: job.id,
        })

        if (refundError) {
          console.error(`Failed to refund job ${job.id}:`, refundError)
        } else if (refundSuccess) {
          stats.refunded++

          // Alert admin about the auto-refund
          await sendAdminAlert({
            type: 'auto_refund',
            userId: job.user_id,
            message: `Auto-refunded credit for failed job`,
            metadata: {
              jobId: job.id,
              hypothesis: job.hypothesis?.substring(0, 100),
              errorSource: job.error_source,
              errorMessage: job.error_message,
              createdAt: job.created_at,
            },
          })
        }
      }
    }

    // 2. Find jobs stuck in 'processing' for too long
    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString()

    const { data: stuckJobs, error: stuckError } = await adminClient
      .from('research_jobs')
      .select('id, user_id, hypothesis, created_at')
      .eq('status', 'processing')
      .lt('created_at', staleThreshold)

    if (stuckError) {
      console.error('Failed to fetch stuck jobs:', stuckError)
    }

    // Auto-fail stuck jobs and refund credits
    if (stuckJobs && stuckJobs.length > 0) {
      stats.stuckProcessing = stuckJobs.length

      for (const job of stuckJobs) {
        // Mark job as failed with timeout error source
        const { error: updateError } = await adminClient
          .from('research_jobs')
          .update({
            status: 'failed',
            error_source: 'timeout',
            error_message: 'Research timed out after 10 minutes. Your credit has been refunded.',
          })
          .eq('id', job.id)

        if (updateError) {
          console.error(`Failed to update stuck job ${job.id}:`, updateError)
          continue
        }

        // Auto-refund using the RPC function
        const { data: refundSuccess, error: refundError } = await adminClient.rpc('refund_credit', {
          p_user_id: job.user_id,
          p_job_id: job.id,
        })

        if (refundError) {
          console.error(`Failed to refund stuck job ${job.id}:`, refundError)
        } else if (refundSuccess) {
          stats.stuckProcessingAutoFailed++
          stats.refunded++
        }
      }

      // Alert admin about the auto-failed stuck jobs
      await sendAdminAlert({
        type: 'stuck_jobs',
        message: `Auto-failed ${stats.stuckProcessingAutoFailed} stuck jobs and refunded credits`,
        metadata: {
          total: stuckJobs.length,
          autoFailed: stats.stuckProcessingAutoFailed,
          action: 'auto_failed_and_refunded',
          jobs: stuckJobs.map(j => ({
            id: j.id,
            hypothesis: j.hypothesis?.substring(0, 100),
            createdAt: j.created_at,
          })),
        },
      })
    }

    // 3. Check for API health issues based on error patterns
    if (Object.keys(stats.errorSourceBreakdown).length > 0) {
      const totalErrors = Object.values(stats.errorSourceBreakdown).reduce((a, b) => a + b, 0)

      // Alert if any single error source has >3 failures
      for (const [source, count] of Object.entries(stats.errorSourceBreakdown)) {
        if (count >= 3) {
          await sendAdminAlert({
            type: 'api_health',
            message: `High failure rate for ${source}: ${count} failures`,
            metadata: {
              errorSource: source,
              failureCount: count,
              totalFailures: totalErrors,
              breakdown: stats.errorSourceBreakdown,
            },
          })
        }
      }
    }

    // 4. Count failed jobs without error_source (shouldn't happen often)
    const { count: failedWithoutSourceCount } = await adminClient
      .from('research_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed')
      .is('error_source', null)
      .is('refunded_at', null)

    stats.failedWithoutSource = failedWithoutSourceCount || 0

    return NextResponse.json({
      success: true,
      stats,
      message: `Processed ${stats.failedWithSource} failed jobs, auto-failed ${stats.stuckProcessingAutoFailed} stuck jobs, refunded ${stats.refunded} total.`,
    })
  } catch (error) {
    console.error('Cleanup stale jobs failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Cleanup failed' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/cleanup-stale-jobs
 *
 * Returns current stale job stats without processing them.
 * Useful for dashboard display.
 */
export async function GET(request: NextRequest) {
  try {
    // Get optional resetAt timestamp for filtering stats
    const searchParams = request.nextUrl.searchParams
    const apiHealthResetAt = searchParams.get('apiHealthResetAt')

    // Verify admin access
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    if (!isAdmin(user.email)) {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const adminClient = createAdminClient()
    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString()

    // Use reset timestamp if provided, otherwise use 24h ago for error breakdown
    const errorBreakdownSince = apiHealthResetAt || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // Get counts - filter by reset timestamp if provided
    const [failedWithSource, failedWithoutSource, stuckProcessing, recentErrorSources] = await Promise.all([
      // Failed with error source (pending refund)
      (async () => {
        let query = adminClient
          .from('research_jobs')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'failed')
          .not('error_source', 'is', null)
          .is('refunded_at', null)
        if (apiHealthResetAt) {
          query = query.gte('created_at', apiHealthResetAt)
        }
        return query
      })(),

      // Failed without error source
      (async () => {
        let query = adminClient
          .from('research_jobs')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'failed')
          .is('error_source', null)
          .is('refunded_at', null)
        if (apiHealthResetAt) {
          query = query.gte('created_at', apiHealthResetAt)
        }
        return query
      })(),

      // Stuck in processing (always show current stuck jobs regardless of reset)
      adminClient
        .from('research_jobs')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'processing')
        .lt('created_at', staleThreshold),

      // Error source breakdown (since reset or last 24 hours)
      adminClient
        .from('research_jobs')
        .select('error_source')
        .eq('status', 'failed')
        .not('error_source', 'is', null)
        .gte('created_at', errorBreakdownSince),
    ])

    // Calculate error source breakdown
    const errorSourceBreakdown: Record<string, number> = {}
    if (recentErrorSources.data) {
      for (const job of recentErrorSources.data) {
        const source = job.error_source || 'unknown'
        errorSourceBreakdown[source] = (errorSourceBreakdown[source] || 0) + 1
      }
    }

    return NextResponse.json({
      pendingRefunds: failedWithSource.count || 0,
      failedWithoutSource: failedWithoutSource.count || 0,
      stuckProcessing: stuckProcessing.count || 0,
      errorSourceBreakdown,
      staleThresholdMinutes: STALE_THRESHOLD_MS / 60000,
      apiHealthResetAt: apiHealthResetAt || null,
    })
  } catch (error) {
    console.error('Get stale job stats failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get stats' },
      { status: 500 }
    )
  }
}
