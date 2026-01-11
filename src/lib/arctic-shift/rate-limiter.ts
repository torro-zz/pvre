// Arctic Shift API Rate Limiter
// Handles concurrent requests across multiple users to prevent API overload
// Arctic Shift allows ~2000 req/min (~33/sec), we use 20/sec to be conservative

import Bottleneck from 'bottleneck'

// Global singleton rate limiter for all Arctic Shift API requests
// This is shared across all users and requests to the API
export const arcticShiftLimiter = new Bottleneck({
  // Maximum 20 concurrent requests at any time
  maxConcurrent: 20,

  // Minimum 50ms between request starts (20 requests/sec sustained)
  minTime: 50,

  // Reservoir settings for burst protection
  reservoir: 100,                    // Start with 100 tokens
  reservoirRefreshAmount: 100,       // Refill 100 tokens
  reservoirRefreshInterval: 5000,    // Every 5 seconds (20/sec average)
})

// =============================================================================
// RATE LIMIT HEADER TRACKING
// Tracks API-reported rate limit state from response headers
// =============================================================================

// State tracked from API response headers
let rateLimitRemaining = Infinity
let rateLimitResetTime = 0

/**
 * Update rate limit state from API response headers
 * Call this after each successful API response
 */
export function updateRateLimitState(headers: Headers): void {
  const remaining = headers.get('X-RateLimit-Remaining')
  const reset = headers.get('X-RateLimit-Reset')
  const parsedReset = reset !== null ? parseInt(reset, 10) * 1000 : NaN

  if (!Number.isNaN(parsedReset) && parsedReset > rateLimitResetTime) {
    rateLimitResetTime = parsedReset
    if (remaining !== null) {
      const parsedRemaining = parseInt(remaining, 10)
      rateLimitRemaining = Number.isNaN(parsedRemaining) ? Infinity : parsedRemaining
    }
  }

  // Log when we're getting close to the limit
  if (rateLimitRemaining < 20 && rateLimitRemaining !== Infinity) {
    console.warn(`[RateLimiter] API rate limit low: ${rateLimitRemaining} remaining, resets at ${new Date(rateLimitResetTime).toISOString()}`)
  }
}

/**
 * Check if we should pause before making another request
 * Returns delay in ms if we should wait, 0 otherwise
 */
export function getRateLimitDelay(): number {
  // If we have plenty of remaining requests, no delay needed
  if (rateLimitRemaining > 10) {
    return 0
  }

  // If we're near the limit, wait until reset
  const now = Date.now()
  if (rateLimitResetTime > now) {
    const waitTime = rateLimitResetTime - now
    console.log(`[RateLimiter] Near API limit (${rateLimitRemaining} left), should wait ${waitTime}ms for reset`)
    return waitTime
  }

  return 0
}

/**
 * Get current rate limit state for debugging
 */
export function getRateLimitState(): { remaining: number; resetTime: number } {
  return {
    remaining: rateLimitRemaining,
    resetTime: rateLimitResetTime,
  }
}

// =============================================================================

// Log rate limiter events in development for debugging
if (process.env.NODE_ENV === 'development') {
  arcticShiftLimiter.on('failed', (error, jobInfo) => {
    console.warn('[RateLimiter] Job failed:', error.message, 'Retries:', jobInfo.retryCount)
  })

  arcticShiftLimiter.on('depleted', () => {
    console.log('[RateLimiter] Queue depleted - requests are being queued')
  })
}

/**
 * Helper to wrap a fetch call through the rate limiter
 * Use this for all Arctic Shift API requests
 */
export async function rateLimitedFetch<T>(
  fetchFn: () => Promise<T>
): Promise<T> {
  return arcticShiftLimiter.schedule(fetchFn)
}
