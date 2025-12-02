import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAdmin } from '@/lib/admin'

/**
 * POST /api/admin/credits - Add bonus credits to a user
 */
export async function POST(request: NextRequest) {
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

    const { userId, credits, description } = await request.json()

    if (!userId || typeof credits !== 'number') {
      return NextResponse.json(
        { error: 'userId and credits are required' },
        { status: 400 }
      )
    }

    if (credits === 0) {
      return NextResponse.json(
        { error: 'Credits cannot be zero' },
        { status: 400 }
      )
    }

    // Use admin client to bypass RLS
    const adminClient = createAdminClient()

    if (credits > 0) {
      // Add bonus credits - bypass RPC due to schema mismatch
      // First get current balance
      const { data: profile, error: fetchError } = await adminClient
        .from('profiles')
        .select('credits_balance')
        .eq('id', userId)
        .single()

      if (fetchError || !profile) {
        console.error('Failed to fetch user:', fetchError)
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      const newBalance = (profile.credits_balance || 0) + credits

      // Update balance
      const { error: updateError } = await adminClient
        .from('profiles')
        .update({
          credits_balance: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) {
        console.error('Failed to add credits:', updateError)
        return NextResponse.json({ error: 'Failed to add credits' }, { status: 500 })
      }

      // Try to log transaction (ignore errors - balance_after column may not exist)
      try {
        await adminClient
          .from('credit_transactions')
          .insert({
            user_id: userId,
            amount: credits,
            transaction_type: 'bonus',
            description: description || 'Admin bonus credits'
          })
      } catch {
        // Silently ignore if transaction logging fails
      }

      return NextResponse.json({
        success: true,
        newBalance,
        message: `Added ${credits} credits`
      })
    } else {
      // Deduct credits (negative number)
      const absCredits = Math.abs(credits)

      // Get current balance first
      const { data: profile, error: fetchError } = await adminClient
        .from('profiles')
        .select('credits_balance')
        .eq('id', userId)
        .single()

      if (fetchError || !profile) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      const newBalance = Math.max(0, (profile.credits_balance || 0) - absCredits)

      // Update balance
      const { error: updateError } = await adminClient
        .from('profiles')
        .update({ credits_balance: newBalance })
        .eq('id', userId)

      if (updateError) {
        console.error('Failed to deduct credits:', updateError)
        return NextResponse.json({ error: 'Failed to deduct credits' }, { status: 500 })
      }

      // Try to log transaction (ignore errors - balance_after column may not exist)
      try {
        await adminClient
          .from('credit_transactions')
          .insert({
            user_id: userId,
            amount: -absCredits,
            transaction_type: 'adjustment',
            description: description || 'Admin adjustment'
          })
      } catch {
        // Silently ignore if transaction logging fails
      }

      return NextResponse.json({
        success: true,
        newBalance,
        message: `Deducted ${absCredits} credits`
      })
    }
  } catch (error) {
    console.error('Admin credits API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/admin/credits - Get credit transactions for a user
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

    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    const { data: transactions, error } = await adminClient
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Failed to fetch transactions:', error)
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
    }

    return NextResponse.json({ transactions })
  } catch (error) {
    console.error('Admin credits GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
