import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { packId } = await request.json()

    if (!packId) {
      return NextResponse.json(
        { error: 'Missing packId' },
        { status: 400 }
      )
    }

    // Get credit pack details
    const { data: pack, error: packError } = await supabase
      .from('credit_packs')
      .select('*')
      .eq('id', packId)
      .eq('is_active', true)
      .single()

    if (packError || !pack) {
      return NextResponse.json(
        { error: 'Invalid credit pack' },
        { status: 400 }
      )
    }

    // Get user email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single()

    const userEmail = profile?.email || user.email

    // Build LemonSqueezy checkout URL
    // LemonSqueezy uses variant IDs to identify products
    const variantId = pack.lemonsqueezy_variant_id

    if (!variantId || variantId === 'VARIANT_ID_STARTER' || variantId === 'VARIANT_ID_BUILDER' || variantId === 'VARIANT_ID_FOUNDER') {
      return NextResponse.json(
        { error: 'Credit pack not configured. Please contact support.' },
        { status: 500 }
      )
    }

    // LemonSqueezy checkout URL format
    // https://YOUR_STORE.lemonsqueezy.com/checkout/buy/VARIANT_ID
    const storeUrl = process.env.LEMONSQUEEZY_STORE_URL

    if (!storeUrl) {
      console.error('LEMONSQUEEZY_STORE_URL is not configured')
      return NextResponse.json(
        { error: 'Payment provider not configured' },
        { status: 500 }
      )
    }

    // Build checkout URL with parameters
    const checkoutUrl = new URL(`${storeUrl}/checkout/buy/${variantId}`)

    // Add custom data for webhook processing
    checkoutUrl.searchParams.set('checkout[custom][user_id]', user.id)
    checkoutUrl.searchParams.set('checkout[custom][pack_id]', pack.id)
    checkoutUrl.searchParams.set('checkout[custom][credits]', pack.credits.toString())

    // Pre-fill email if available
    if (userEmail) {
      checkoutUrl.searchParams.set('checkout[email]', userEmail)
    }

    // Add success and cancel redirects
    const origin = request.nextUrl.origin
    checkoutUrl.searchParams.set('checkout[success_url]', `${origin}/account/billing?success=true`)
    checkoutUrl.searchParams.set('checkout[cancel_url]', `${origin}/account/billing?canceled=true`)

    return NextResponse.json({ url: checkoutUrl.toString() })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
