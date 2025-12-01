import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'

// POST - Request account deletion
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { reason } = body

    // Check for existing pending request
    const { data: existingRequest } = await supabase
      .from('account_deletion_requests')
      .select('id, status')
      .eq('user_id', user.id)
      .in('status', ['pending', 'confirmed'])
      .single()

    if (existingRequest) {
      return NextResponse.json(
        { error: 'You already have a pending deletion request' },
        { status: 400 }
      )
    }

    // Create deletion request with 7-day grace period
    const confirmationToken = crypto.randomBytes(32).toString('hex')
    const scheduledDeletion = new Date()
    scheduledDeletion.setDate(scheduledDeletion.getDate() + 7)

    const adminSupabase = createAdminClient()
    const { data: deletionRequest, error } = await adminSupabase
      .from('account_deletion_requests')
      .insert({
        user_id: user.id,
        reason: reason || null,
        status: 'pending',
        confirmation_token: confirmationToken,
        scheduled_deletion_at: scheduledDeletion.toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create deletion request:', error)
      return NextResponse.json({ error: 'Failed to create deletion request' }, { status: 500 })
    }

    // In a real implementation, send confirmation email here
    // TODO: Send email with confirmation link

    return NextResponse.json({
      request: {
        id: deletionRequest.id,
        status: deletionRequest.status,
        scheduled_deletion_at: deletionRequest.scheduled_deletion_at,
      },
      message: 'Deletion request submitted. Please check your email to confirm.',
    })
  } catch (error) {
    console.error('Deletion request error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Cancel deletion request
export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Cancel any pending deletion requests
    const { error } = await supabase
      .from('account_deletion_requests')
      .update({ status: 'cancelled' })
      .eq('user_id', user.id)
      .in('status', ['pending', 'confirmed'])

    if (error) {
      return NextResponse.json({ error: 'Failed to cancel deletion request' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Deletion request cancelled' })
  } catch (error) {
    console.error('Cancel deletion error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET - Get deletion request status
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: request, error } = await supabase
      .from('account_deletion_requests')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['pending', 'confirmed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: 'Failed to fetch deletion status' }, { status: 500 })
    }

    return NextResponse.json({ request: request || null })
  } catch (error) {
    console.error('Deletion status error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
