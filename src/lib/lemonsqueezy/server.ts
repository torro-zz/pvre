import {
  lemonSqueezySetup,
  createCheckout,
  type NewCheckout,
} from '@lemonsqueezy/lemonsqueezy.js'
import crypto from 'crypto'

// Initialize Lemon Squeezy client
let initialized = false

function ensureInitialized() {
  if (!initialized) {
    const apiKey = process.env.LEMONSQUEEZY_API_KEY
    if (!apiKey) {
      throw new Error('Missing LEMONSQUEEZY_API_KEY environment variable')
    }
    lemonSqueezySetup({ apiKey })
    initialized = true
  }
}

export async function createCheckoutUrl(params: {
  variantId: string
  userId: string
  packId: string
  credits: number
  userEmail: string
  successUrl: string
  cancelUrl: string
}): Promise<string> {
  ensureInitialized()

  const storeId = process.env.LEMONSQUEEZY_STORE_ID
  if (!storeId) {
    throw new Error('Missing LEMONSQUEEZY_STORE_ID environment variable')
  }

  const checkoutData: NewCheckout = {
    checkoutData: {
      email: params.userEmail,
      custom: {
        user_id: params.userId,
        pack_id: params.packId,
        credits: params.credits.toString(),
      },
    },
    checkoutOptions: {
      embed: false,
      media: false,
      buttonColor: '#000000',
    },
    productOptions: {
      redirectUrl: params.successUrl,
    },
  }

  const response = await createCheckout(storeId, params.variantId, checkoutData)

  if (!response.data?.data?.attributes?.url) {
    throw new Error('Failed to create checkout URL')
  }

  return response.data.data.attributes.url
}

export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET
  if (!secret) {
    console.error('Missing LEMONSQUEEZY_WEBHOOK_SECRET')
    return false
  }

  const hmac = crypto.createHmac('sha256', secret)
  const digest = hmac.update(payload).digest('hex')

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(digest)
    )
  } catch {
    return false
  }
}

// Lemon Squeezy webhook event types
export interface LemonSqueezyWebhookEvent {
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
      order_number: number
      status: string
      total: number
      total_formatted: string
      currency: string
      refunded: boolean
      refunded_at: string | null
      created_at: string
      updated_at: string
    }
  }
}
