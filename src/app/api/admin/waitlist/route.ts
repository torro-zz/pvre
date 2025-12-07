import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/admin'

/**
 * GET /api/admin/waitlist - List all waitlist entries
 */
export async function GET() {
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

    // Note: waitlist table exists but may not be in generated types
    const { data: waitlist, error } = await adminClient
      .from('waitlist' as 'profiles')
      .select('*')
      .order('created_at', { ascending: false }) as unknown as {
        data: { id: string; email: string; created_at: string }[] | null;
        error: Error | null
      }

    if (error) {
      console.error('Failed to fetch waitlist:', error)
      return NextResponse.json({ error: 'Failed to fetch waitlist' }, { status: 500 })
    }

    return NextResponse.json({ waitlist: waitlist || [] })
  } catch (error) {
    console.error('Admin waitlist API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/waitlist - Remove a waitlist entry
 */
export async function DELETE(request: NextRequest) {
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

    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    // Use admin client to bypass RLS
    const adminClient = createAdminClient()

    // Note: waitlist table exists but may not be in generated types
    const { error } = await adminClient
      .from('waitlist' as 'profiles')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Failed to delete waitlist entry:', error)
      return NextResponse.json({ error: 'Failed to delete entry' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin waitlist DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
