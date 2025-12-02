import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/admin'

interface OrphanedJob {
  id: string
  user_id: string
  user_email: string
  hypothesis: string
  status: string | null
  created_at: string | null
  issue: string
}

interface CreditAuditData {
  orphanedJobs: OrphanedJob[]
  staleJobs: OrphanedJob[]
  summary: {
    totalOrphaned: number
    totalStale: number
    creditsAtRisk: number
  }
  generatedAt: string
}

export async function GET() {
  try {
    // Verify user is authenticated and is admin
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    if (!isAdmin(user.email || '')) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    // Find orphaned jobs: status='completed' but no results in research_results
    const { data: completedJobs, error: completedError } = await adminClient
      .from('research_jobs')
      .select(`
        id,
        user_id,
        hypothesis,
        status,
        created_at,
        profiles!inner(email)
      `)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(100)

    if (completedError) {
      console.error('Failed to fetch completed jobs:', completedError)
      throw new Error('Failed to fetch completed jobs')
    }

    // Check which completed jobs have results
    const orphanedJobs: OrphanedJob[] = []
    for (const job of completedJobs || []) {
      const { count, error: resultError } = await adminClient
        .from('research_results')
        .select('*', { count: 'exact', head: true })
        .eq('job_id', job.id)

      if (resultError) {
        console.error('Error checking results for job:', job.id, resultError)
        continue
      }

      if (count === 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const profiles = job.profiles as any
        const email = profiles?.email || 'Unknown'
        orphanedJobs.push({
          id: job.id,
          user_id: job.user_id,
          user_email: email,
          hypothesis: job.hypothesis.slice(0, 100) + (job.hypothesis.length > 100 ? '...' : ''),
          status: job.status,
          created_at: job.created_at,
          issue: 'Marked completed but no results saved',
        })
      }
    }

    // Find stale jobs: pending/processing for more than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: staleJobsData, error: staleError } = await adminClient
      .from('research_jobs')
      .select(`
        id,
        user_id,
        hypothesis,
        status,
        created_at,
        profiles!inner(email)
      `)
      .in('status', ['pending', 'processing'])
      .lt('created_at', oneHourAgo)
      .order('created_at', { ascending: false })
      .limit(50)

    if (staleError) {
      console.error('Failed to fetch stale jobs:', staleError)
      throw new Error('Failed to fetch stale jobs')
    }

    const staleJobs: OrphanedJob[] = (staleJobsData || []).map((job) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const profiles = job.profiles as any
      const email = profiles?.email || 'Unknown'
      return {
        id: job.id,
        user_id: job.user_id,
        user_email: email,
        hypothesis: job.hypothesis.slice(0, 100) + (job.hypothesis.length > 100 ? '...' : ''),
        status: job.status,
        created_at: job.created_at,
        issue: `Stuck in ${job.status} for >1 hour`,
      }
    })

    const auditData: CreditAuditData = {
      orphanedJobs,
      staleJobs,
      summary: {
        totalOrphaned: orphanedJobs.length,
        totalStale: staleJobs.length,
        creditsAtRisk: orphanedJobs.length, // Each orphaned job likely consumed a credit
      },
      generatedAt: new Date().toISOString(),
    }

    return NextResponse.json(auditData)
  } catch (error) {
    console.error('Credit audit error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Audit failed' },
      { status: 500 }
    )
  }
}
