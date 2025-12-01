import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  verifyWebhookSignature,
  type LemonSqueezyWebhookEvent,
} from '@/lib/lemonsqueezy/server'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('x-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing x-signature header' },
      { status: 400 }
    )
  }

  // Verify webhook signature
  if (!verifyWebhookSignature(body, signature)) {
    console.error('Webhook signature verification failed')
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }

  let event: LemonSqueezyWebhookEvent

  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  const eventName = event.meta.event_name

  switch (eventName) {
    case 'order_created': {
      const customData = event.meta.custom_data
      const userId = customData?.user_id
      const packId = customData?.pack_id
      const credits = parseInt(customData?.credits || '0', 10)

      if (!userId || !credits) {
        console.error('Missing custom data in webhook:', event.meta)
        break
      }

      const orderId = event.data.id
      const orderAttributes = event.data.attributes

      // Check if we already processed this order
      const { data: existingPurchase } = await supabase
        .from('purchases')
        .select('id')
        .eq('lemonsqueezy_order_id', orderId)
        .single()

      if (existingPurchase) {
        console.log('Order already processed:', orderId)
        break
      }

      // Create purchase record
      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .insert({
          user_id: userId,
          credit_pack_id: packId || null,
          lemonsqueezy_order_id: orderId,
          lemonsqueezy_customer_id: orderAttributes.customer_id.toString(),
          credits_purchased: credits,
          amount_cents: orderAttributes.total,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (purchaseError) {
        console.error('Failed to create purchase:', purchaseError)
        break
      }

      // Add credits to user using database function
      const { error: creditError } = await supabase.rpc('add_credits', {
        p_user_id: userId,
        p_purchase_id: purchase.id,
        p_credits: credits,
      })

      if (creditError) {
        console.error('Failed to add credits:', creditError)
      }

      // Update user's Lemon Squeezy customer ID if not set
      await supabase
        .from('profiles')
        .update({ lemonsqueezy_customer_id: orderAttributes.customer_id.toString() })
        .eq('id', userId)
        .is('lemonsqueezy_customer_id', null)

      console.log(`Added ${credits} credits to user ${userId} (order: ${orderId})`)
      break
    }

    case 'order_refunded': {
      const orderId = event.data.id

      // Find the purchase and update status
      const { data: purchase, error: findError } = await supabase
        .from('purchases')
        .select('id, user_id, credits_purchased')
        .eq('lemonsqueezy_order_id', orderId)
        .single()

      if (findError || !purchase) {
        console.error('Purchase not found for refund:', orderId)
        break
      }

      // Update purchase status
      await supabase
        .from('purchases')
        .update({ status: 'refunded' })
        .eq('id', purchase.id)

      // Deduct credits (negative amount)
      const { data: profile } = await supabase
        .from('profiles')
        .select('credits_balance')
        .eq('id', purchase.user_id)
        .single()

      if (profile) {
        const newBalance = Math.max(0, profile.credits_balance - purchase.credits_purchased)

        await supabase
          .from('profiles')
          .update({ credits_balance: newBalance })
          .eq('id', purchase.user_id)

        // Log the refund transaction
        await supabase
          .from('credit_transactions')
          .insert({
            user_id: purchase.user_id,
            amount: -purchase.credits_purchased,
            balance_after: newBalance,
            transaction_type: 'refund',
            reference_id: purchase.id,
            description: 'Order refunded',
          })
      }

      console.log(`Refunded order ${orderId}`)
      break
    }

    default:
      console.log(`Unhandled event type: ${eventName}`)
  }

  return NextResponse.json({ received: true })
}
