import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MAILERLITE_API_KEY = process.env.MAILERLITE_API_KEY
const MAILERLITE_GROUP_PVRE = process.env.MAILERLITE_GROUP_PVRE

// Simple in-memory rate limiting (resets on deploy)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_MAX = 5 // max requests per window
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour in ms

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return false
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return true
  }

  record.count++
  return false
}

/**
 * POST /api/subscribe - Subscribe to the waitlist
 * Public endpoint - no auth required
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting by IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') ||
               'unknown'

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { name, email } = body

    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Validate name
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const trimmedName = name.trim()
    const trimmedEmail = email.trim().toLowerCase()

    // Save to Supabase waitlist table (backup + counter source)
    const adminClient = createAdminClient()

    // Check for duplicate email
    const { data: existing } = await adminClient
      .from('waitlist' as 'profiles')
      .select('id')
      .eq('email', trimmedEmail)
      .single() as unknown as { data: { id: string } | null }

    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    // Insert into waitlist
    const { error: insertError } = await adminClient
      .from('waitlist' as 'profiles')
      .insert({ email: trimmedEmail, name: trimmedName } as never)

    if (insertError) {
      console.error('Failed to save to waitlist:', insertError)
      return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
    }

    // Send to MailerLite (non-blocking, don't fail if MailerLite fails)
    if (MAILERLITE_API_KEY) {
      try {
        const mailerliteBody: Record<string, unknown> = {
          email: trimmedEmail,
          fields: { name: trimmedName },
        }

        if (MAILERLITE_GROUP_PVRE) {
          mailerliteBody.groups = [MAILERLITE_GROUP_PVRE]
        }

        const response = await fetch('https://connect.mailerlite.com/api/subscribers', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${MAILERLITE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(mailerliteBody),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          console.error('MailerLite error:', response.status, errorData)
        }
      } catch (mailerliteError) {
        console.error('MailerLite request failed:', mailerliteError)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Subscribe API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
