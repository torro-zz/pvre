import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCheckoutUrl } from '@/lib/lemonsqueezy/server'

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

    // Create Lemon Squeezy checkout URL
    const checkoutUrl = await createCheckoutUrl({
      variantId: pack.lemonsqueezy_variant_id,
      userId: user.id,
      packId: pack.id,
      credits: pack.credits,
      userEmail: profile?.email || user.email || '',
      successUrl: `${request.nextUrl.origin}/account/billing?success=true`,
      cancelUrl: `${request.nextUrl.origin}/account/billing?canceled=true`,
    })

    return NextResponse.json({ url: checkoutUrl })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
