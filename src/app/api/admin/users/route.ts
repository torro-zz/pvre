import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/admin'

/**
 * GET /api/admin/users - List all users with their credits and stats
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin access
    if (!isAdmin(user.email)) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Use admin client to bypass RLS
    const adminClient = createAdminClient()

    // Get search query
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Build query
    let query = adminClient
      .from('profiles')
      .select('*, research_jobs(count)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (search) {
      query = query.ilike('email', `%${search}%`)
    }

    const { data: users, error, count } = await query

    if (error) {
      console.error('Failed to fetch users:', error)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    // Fetch purchase stats for all users in this batch
    const userIds = users?.map(u => u.id) || []
    const { data: purchases } = await adminClient
      .from('purchases')
      .select('user_id, credits_purchased, amount_cents')
      .in('user_id', userIds)
      .eq('status', 'completed')

    // Calculate avg spend per credit for each user
    const purchaseStats: Record<string, { totalSpentCents: number; totalCreditsPurchased: number }> = {}
    purchases?.forEach(p => {
      if (!purchaseStats[p.user_id]) {
        purchaseStats[p.user_id] = { totalSpentCents: 0, totalCreditsPurchased: 0 }
      }
      purchaseStats[p.user_id].totalSpentCents += p.amount_cents
      purchaseStats[p.user_id].totalCreditsPurchased += p.credits_purchased
    })

    // Merge purchase stats into user data
    const usersWithStats = users?.map(user => ({
      ...user,
      total_spent_cents: purchaseStats[user.id]?.totalSpentCents || 0,
      avg_spend_per_credit: purchaseStats[user.id]?.totalCreditsPurchased > 0
        ? (purchaseStats[user.id].totalSpentCents / purchaseStats[user.id].totalCreditsPurchased / 100).toFixed(2)
        : null
    }))

    return NextResponse.json({
      users: usersWithStats,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error) {
    console.error('Admin users API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
