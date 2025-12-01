import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'

// Generate a secure API key
function generateApiKey(): string {
  const prefix = 'pvre_sk_'
  const randomPart = crypto.randomBytes(24).toString('base64url')
  return `${prefix}${randomPart}`
}

// Hash API key for storage
function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

// GET - List user's API keys
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: keys, error } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, last_used_at, expires_at, is_active, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 })
    }

    return NextResponse.json({ keys })
  } catch (error) {
    console.error('API keys fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create new API key
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Check max keys limit (e.g., 5 per user)
    const { data: existingKeys } = await supabase
      .from('api_keys')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (existingKeys && existingKeys.length >= 5) {
      return NextResponse.json(
        { error: 'Maximum number of API keys reached (5)' },
        { status: 400 }
      )
    }

    // Generate new API key
    const plainKey = generateApiKey()
    const keyHash = hashApiKey(plainKey)
    const keyPrefix = plainKey.substring(0, 12) // Show first 12 chars for identification

    // Insert key using admin client (to bypass RLS for insert)
    const adminSupabase = createAdminClient()
    const { data: newKey, error: insertError } = await adminSupabase
      .from('api_keys')
      .insert({
        user_id: user.id,
        name,
        key_hash: keyHash,
        key_prefix: keyPrefix,
      })
      .select('id, name, key_prefix, created_at')
      .single()

    if (insertError) {
      console.error('Failed to create API key:', insertError)
      return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 })
    }

    // Return the plain key ONLY ONCE - it will never be shown again
    return NextResponse.json({
      key: {
        ...newKey,
        plainKey, // This is the only time the plain key is returned
      },
    })
  } catch (error) {
    console.error('API key creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Revoke an API key
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const keyId = searchParams.get('id')

    if (!keyId) {
      return NextResponse.json({ error: 'Key ID is required' }, { status: 400 })
    }

    // Delete the key (RLS ensures user can only delete their own)
    const { error: deleteError } = await supabase
      .from('api_keys')
      .delete()
      .eq('id', keyId)
      .eq('user_id', user.id)

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to delete API key' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('API key deletion error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
