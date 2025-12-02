import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'

// LemonSqueezy webhook event types
interface LemonSqueezyWebhookEvent {
  meta: {
    event_name: string
    custom_data?: {
      user_id?: string
      pack_id?: string
      credits?: string
    }
  }
  data: {
    id: string
    type: string
    attributes: {
      store_id: number
      customer_id: number
      order_id?: number
      identifier?: string
      order_number?: number
      user_name?: string
      user_email?: string
      currency: string
      currency_rate?: string
      subtotal?: number
      discount_total?: number
      tax?: number
      total?: number
      subtotal_usd?: number
      discount_total_usd?: number
      tax_usd?: number
      total_usd?: number
      status?: string
      status_formatted?: string
      refunded?: boolean
      refunded_at?: string
      created_at: string
      updated_at: string
    }
  }
}

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret)
  const digest = hmac.update(payload).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processOrderPayment(
  supabase: ReturnType<typeof createAdminClient>,
  event: LemonSqueezyWebhookEvent,
  customData: { user_id?: string; pack_id?: string; credits?: string }
) {
  const orderId = event.data.attributes.identifier || event.data.id
  const customerId = event.data.attributes.customer_id?.toString() || ''
  const userId = customData.user_id
  const packId = customData.pack_id
  const credits = parseInt(customData.credits || '0', 10)
  const amountCents = event.data.attributes.total || 0

  if (!userId || !credits) {
    console.error('Missing custom data in webhook:', customData)
    return
  }

  // Check if we already processed this order
  const { data: existingPurchase } = await supabase
    .from('purchases')
    .select('id')
    .eq('lemonsqueezy_order_id', orderId)
    .single()

  if (existingPurchase) {
    console.log('Order already processed:', orderId)
    return
  }

  // Create purchase record
  const { data: purchase, error: purchaseError } = await supabase
    .from('purchases')
    .insert({
      user_id: userId,
      credit_pack_id: packId || null,
      lemonsqueezy_order_id: orderId,
      lemonsqueezy_customer_id: customerId,
      credits_purchased: credits,
      amount_cents: amountCents,
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (purchaseError) {
    console.error('Failed to create purchase:', purchaseError)
    return
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

  // Update user's LemonSqueezy customer ID if not already set
  if (customerId) {
    await supabase
      .from('profiles')
      .update({ lemonsqueezy_customer_id: customerId })
      .eq('id', userId)
      .is('lemonsqueezy_customer_id', null)
  }

  console.log(`Added ${credits} credits to user ${userId} (order: ${orderId})`)
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('x-signature')
  const webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET || ''

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing x-signature header' },
      { status: 400 }
    )
  }

  // Verify webhook signature
  if (webhookSecret) {
    try {
      const isValid = verifyWebhookSignature(body, signature, webhookSecret)
      if (!isValid) {
        console.error('Webhook signature verification failed')
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 400 }
        )
      }
    } catch (err) {
      console.error('Webhook signature verification error:', err)
      return NextResponse.json(
        { error: 'Signature verification failed' },
        { status: 400 }
      )
    }
  }

  let event: LemonSqueezyWebhookEvent
  try {
    event = JSON.parse(body)
  } catch (err) {
    console.error('Failed to parse webhook body:', err)
    return NextResponse.json(
      { error: 'Invalid JSON' },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()
  const eventName = event.meta.event_name
  const customData = event.meta.custom_data || {}

  console.log(`LemonSqueezy webhook received: ${eventName}`)

  switch (eventName) {
    case 'order_created': {
      // Check if order is already paid (status = 'paid')
      // LemonSqueezy can send order_created with status=paid for immediate payments
      if (event.data.attributes.status === 'paid') {
        await processOrderPayment(supabase, event, customData)
      } else {
        console.log('Order created (pending payment):', event.data.id)
      }
      break
    }

    case 'order_paid': {
      // Order has been paid - add credits
      await processOrderPayment(supabase, event, customData)
      break
    }

    case 'order_refunded': {
      // Handle refund
      const orderId = event.data.attributes.identifier || event.data.id

      // Find the purchase
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

      // Deduct credits
      const { data: profile } = await supabase
        .from('profiles')
        .select('credits_balance')
        .eq('id', purchase.user_id)
        .single()

      if (profile) {
        const newBalance = Math.max(0, (profile.credits_balance || 0) - purchase.credits_purchased)

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

    case 'subscription_created':
    case 'subscription_updated':
    case 'subscription_cancelled':
    case 'subscription_resumed':
    case 'subscription_expired':
    case 'subscription_paused':
    case 'subscription_unpaused':
      // Subscription events - not used for one-time credit packs
      console.log(`Subscription event ${eventName}:`, event.data.id)
      break

    default:
      console.log(`Unhandled event type: ${eventName}`)
  }

  return NextResponse.json({ received: true })
}
