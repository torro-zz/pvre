import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST - Request data export
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check for existing pending/processing request
    const { data: existingRequest } = await supabase
      .from('data_export_requests')
      .select('id, status, created_at')
      .eq('user_id', user.id)
      .in('status', ['pending', 'processing'])
      .single()

    if (existingRequest) {
      return NextResponse.json(
        { error: 'You already have a pending export request' },
        { status: 400 }
      )
    }

    // Create new export request
    const adminSupabase = createAdminClient()
    const { data: request, error } = await adminSupabase
      .from('data_export_requests')
      .insert({
        user_id: user.id,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create export request:', error)
      return NextResponse.json({ error: 'Failed to create export request' }, { status: 500 })
    }

    // In a real implementation, this would trigger a background job
    // For now, we'll just update the status and create a placeholder
    // TODO: Implement actual data export with Supabase Storage

    return NextResponse.json({
      request,
      message: 'Export request submitted. You will receive an email when your data is ready.',
    })
  } catch (error) {
    console.error('Export request error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET - Get export request status
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: requests, error } = await supabase
      .from('data_export_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch export requests' }, { status: 500 })
    }

    return NextResponse.json({ requests })
  } catch (error) {
    console.error('Export status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
