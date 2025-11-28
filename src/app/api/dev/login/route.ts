import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const TEST_EMAIL = 'test-user@pvre-dev.local'
const TEST_PASSWORD = 'dev-test-password-12345'

/**
 * Dev-only login endpoint that creates/authenticates a test user
 *
 * POST /api/dev/login - Creates test user and returns session
 *
 * SECURITY: Only available in development mode
 */
export async function POST() {
  // Block in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 403 }
    )
  }

  try {
    const adminClient = createAdminClient()

    // Check if test user exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers()
    const testUser = existingUsers?.users?.find(u => u.email === TEST_EMAIL)

    if (!testUser) {
      // Create test user
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: 'Test User (Dev)',
        },
      })

      if (createError) {
        console.error('Failed to create test user:', createError)
        return NextResponse.json(
          { error: 'Failed to create test user', details: createError.message },
          { status: 500 }
        )
      }

      console.log('Created test user:', newUser?.user?.id)
    }

    // Sign in as test user using the server client (which handles cookies)
    const supabase = await createClient()
    const { data: session, error: signInError } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })

    if (signInError) {
      console.error('Failed to sign in test user:', signInError)
      return NextResponse.json(
        { error: 'Failed to sign in', details: signInError.message },
        { status: 500 }
      )
    }

    console.log('Dev login successful for user:', session.user?.id)

    return NextResponse.json({
      success: true,
      user: {
        id: session.user?.id,
        email: session.user?.email,
      },
      message: 'Dev login successful. Session cookies have been set.',
    })
  } catch (error) {
    console.error('Dev login error:', error)
    return NextResponse.json(
      { error: 'Dev login failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/dev/login - Check dev login status
 */
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 403 }
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return NextResponse.json({
    authenticated: !!user,
    user: user ? {
      id: user.id,
      email: user.email,
    } : null,
  })
}
