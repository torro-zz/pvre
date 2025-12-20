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
