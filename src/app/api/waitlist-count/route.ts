import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BASE_OFFSET = 21

/**
 * GET /api/waitlist-count - Get total waitlist count
 * Public endpoint - no auth required
 * Cached for 60 seconds
 */
export async function GET() {
  try {
    const adminClient = createAdminClient()

    // Count waitlist entries
    const { count, error } = await adminClient
      .from('waitlist' as 'profiles')
      .select('*', { count: 'exact', head: true })

    if (error) {
      console.error('Failed to count waitlist:', error)
      return NextResponse.json({ count: BASE_OFFSET }, { status: 200 })
    }

    const totalCount = (count || 0) + BASE_OFFSET

    return NextResponse.json(
      { count: totalCount },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      }
    )
  } catch (error) {
    console.error('Waitlist count API error:', error)
    return NextResponse.json({ count: BASE_OFFSET }, { status: 200 })
  }
}
