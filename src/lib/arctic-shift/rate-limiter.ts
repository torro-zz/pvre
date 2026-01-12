// Arctic Shift API Rate Limiter v2
// Implements dual-queue architecture with priority, fairness, and request coalescing
// Designed for 20+ concurrent users with coverage check and research workloads

import Bottleneck from 'bottleneck'

// =============================================================================
// TYPES
// =============================================================================

export type RequestPriority = 'coverage' | 'research'

export interface QueueTelemetry {
  coverageQueueSize: number
  researchQueueSize: number
  coverageRunning: number
  researchRunning: number
  rateLimitRemaining: number
  rateLimitResetTime: number
  estimatedWaitMs: {
    coverage: number
    research: number
  }
}

export interface RateLimitedFetchOptions {
  priority?: RequestPriority
  jobId?: string // For per-job fairness in research mode
}

// =============================================================================
// DUAL-QUEUE RATE LIMITERS
// =============================================================================

// Coverage limiter: HIGH priority, guaranteed 40% capacity (8/sec)
// For coverage checks - must complete quickly for good UX
export const coverageLimiter = new Bottleneck({
  maxConcurrent: 6,           // Max 6 concurrent coverage requests
  minTime: 125,               // 125ms between requests (~8/sec)
  reservoir: 40,              // Burst capacity
  reservoirRefreshAmount: 40,
  reservoirRefreshInterval: 5000, // Refill every 5 seconds
})

// Research limiter: NORMAL priority, uses remaining 60% capacity (12/sec)
// For research data fetching - can tolerate longer waits
export const researchLimiter = new Bottleneck({
  maxConcurrent: 14,          // Max 14 concurrent research requests
  minTime: 83,                // 83ms between requests (~12/sec)
  reservoir: 60,              // Burst capacity
  reservoirRefreshAmount: 60,
  reservoirRefreshInterval: 5000, // Refill every 5 seconds
})

// Per-job limiters for research fairness (prevents one job from hogging all slots)
// Each research job (user session) is limited to 2 concurrent requests
const jobLimiters = new Map<string, Bottleneck>()
const JOB_LIMITER_TTL = 5 * 60 * 1000 // Clean up after 5 minutes of inactivity

function getJobLimiter(jobId: string): Bottleneck {
  let limiter = jobLimiters.get(jobId)
  if (!limiter) {
    limiter = new Bottleneck({
      maxConcurrent: 2, // Max 2 concurrent requests per job
      minTime: 0,       // No additional delay (handled by research limiter)
    })
    jobLimiters.set(jobId, limiter)

    // Schedule cleanup
    setTimeout(() => {
      const existing = jobLimiters.get(jobId)
      if (existing === limiter) {
        jobLimiters.delete(jobId)
      }
    }, JOB_LIMITER_TTL)
  }
  return limiter
}

// =============================================================================
// REQUEST COALESCING
// =============================================================================

// Track in-flight requests by URL to share results
const inFlightRequests = new Map<string, Promise<Response>>()

/**
 * Coalesce identical in-flight requests
 * If the same URL is already being fetched, return the same Promise
 */
async function coalescedFetch(url: string, fetchFn: () => Promise<Response>): Promise<Response> {
  // Check if this exact request is already in flight
  const existing = inFlightRequests.get(url)
  if (existing) {
    console.log('[Coalesce] Sharing in-flight request:', url.slice(0, 80))
    // Clone the response since Response body can only be consumed once
    const response = await existing
    return response.clone()
  }

  // Make the request and track it
  const promise = fetchFn()
  inFlightRequests.set(url, promise)

  try {
    const response = await promise
    // Store a clone so we can return the original
    inFlightRequests.set(url, Promise.resolve(response.clone()))

    // Clean up after a short delay (allow for near-simultaneous requests)
    setTimeout(() => {
      inFlightRequests.delete(url)
    }, 100)

    return response
  } catch (error) {
    // Clean up on error
    inFlightRequests.delete(url)
    throw error
  }
}

// =============================================================================
// RATE LIMIT HEADER TRACKING (Elastic Rate Adjustment)
// =============================================================================

let rateLimitRemaining = Infinity
let rateLimitResetTime = 0
let currentElasticBoost = 0 // Additional capacity when API has headroom

/**
 * Update rate limit state from API response headers
 * Implements elastic rate adjustment based on API feedback
 */
export function updateRateLimitState(headers: Headers): void {
  const remaining = headers.get('X-RateLimit-Remaining')
  const reset = headers.get('X-RateLimit-Reset')
  const limit = headers.get('X-RateLimit-Limit')
  const parsedReset = reset !== null ? parseInt(reset, 10) * 1000 : NaN

  if (!Number.isNaN(parsedReset) && parsedReset > rateLimitResetTime) {
    rateLimitResetTime = parsedReset
    if (remaining !== null) {
      const parsedRemaining = parseInt(remaining, 10)
      rateLimitRemaining = Number.isNaN(parsedRemaining) ? Infinity : parsedRemaining
    }
  }

  // Elastic rate adjustment based on remaining capacity
  const totalLimit = limit ? parseInt(limit, 10) : 2000
  if (rateLimitRemaining !== Infinity && totalLimit > 0) {
    const utilizationRatio = rateLimitRemaining / totalLimit

    if (utilizationRatio > 0.6) {
      // Lots of headroom - boost rate slightly
      if (currentElasticBoost < 5) {
        currentElasticBoost += 1
        // Reduce minTime to increase throughput
        researchLimiter.updateSettings({ minTime: Math.max(70, 83 - currentElasticBoost * 2) })
        console.log(`[RateLimiter] Elastic boost: +${currentElasticBoost} (${Math.round(utilizationRatio * 100)}% remaining)`)
      }
    } else if (utilizationRatio < 0.3) {
      // Getting low - reduce rate
      if (currentElasticBoost > -5) {
        currentElasticBoost -= 1
        researchLimiter.updateSettings({ minTime: Math.min(120, 83 - currentElasticBoost * 2) })
        console.log(`[RateLimiter] Elastic slowdown: ${currentElasticBoost} (${Math.round(utilizationRatio * 100)}% remaining)`)
      }
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
// QUEUE TELEMETRY
// =============================================================================

/**
 * Get current queue statistics for monitoring and ETA display
 */
export function getQueueTelemetry(): QueueTelemetry {
  const coverageCounts = coverageLimiter.counts()
  const researchCounts = researchLimiter.counts()

  // Estimate wait time based on queue depth and throughput
  // Coverage: 8/sec, Research: 12/sec
  const coverageWaitMs = coverageCounts.QUEUED * 125 // 125ms per request
  const researchWaitMs = researchCounts.QUEUED * 83   // 83ms per request

  return {
    coverageQueueSize: coverageCounts.QUEUED,
    researchQueueSize: researchCounts.QUEUED,
    coverageRunning: coverageCounts.RUNNING,
    researchRunning: researchCounts.RUNNING,
    rateLimitRemaining,
    rateLimitResetTime,
    estimatedWaitMs: {
      coverage: coverageWaitMs,
      research: researchWaitMs,
    },
  }
}

/**
 * Format ETA for user display
 */
export function formatQueueETA(priority: RequestPriority): string {
  const telemetry = getQueueTelemetry()
  const waitMs = priority === 'coverage'
    ? telemetry.estimatedWaitMs.coverage
    : telemetry.estimatedWaitMs.research

  if (waitMs < 1000) return 'immediate'
  if (waitMs < 5000) return '~1-5 seconds'
  if (waitMs < 15000) return '~5-15 seconds'
  if (waitMs < 30000) return '~15-30 seconds'
  return '~30+ seconds'
}

// =============================================================================
// MAIN API
// =============================================================================

/**
 * Rate-limited fetch with priority and fairness
 *
 * @param fetchFn - The fetch function to execute
 * @param url - URL for request coalescing (optional)
 * @param options - Priority and job ID for fairness
 */
export async function rateLimitedFetch<T>(
  fetchFn: () => Promise<T>,
  url?: string,
  options: RateLimitedFetchOptions = {}
): Promise<T> {
  const { priority = 'research', jobId } = options
  const limiter = priority === 'coverage' ? coverageLimiter : researchLimiter

  // If URL provided and it's a fetch that returns Response, use coalescing
  if (url && typeof fetchFn === 'function') {
    // Wrap in job limiter if jobId provided (for research fairness)
    if (priority === 'research' && jobId) {
      const jobLimiter = getJobLimiter(jobId)
      return jobLimiter.schedule(() =>
        limiter.schedule(() => fetchFn())
      )
    }

    return limiter.schedule(() => fetchFn())
  }

  // Wrap in job limiter if jobId provided (for research fairness)
  if (priority === 'research' && jobId) {
    const jobLimiter = getJobLimiter(jobId)
    return jobLimiter.schedule(() =>
      limiter.schedule(() => fetchFn())
    )
  }

  return limiter.schedule(() => fetchFn())
}

/**
 * Rate-limited fetch specifically for Response objects with coalescing
 * Use this for actual HTTP requests to Arctic Shift
 */
export async function rateLimitedHttpFetch(
  url: string,
  fetchFn: () => Promise<Response>,
  options: RateLimitedFetchOptions = {}
): Promise<Response> {
  const { priority = 'research', jobId } = options
  const limiter = priority === 'coverage' ? coverageLimiter : researchLimiter

  // Create the coalesced fetch function
  const coalescedFetchFn = () => coalescedFetch(url, fetchFn)

  // Wrap in job limiter if jobId provided (for research fairness)
  if (priority === 'research' && jobId) {
    const jobLimiter = getJobLimiter(jobId)
    return jobLimiter.schedule(() =>
      limiter.schedule(coalescedFetchFn)
    )
  }

  return limiter.schedule(coalescedFetchFn)
}

// =============================================================================
// DEBUG LOGGING
// =============================================================================

if (process.env.NODE_ENV === 'development') {
  coverageLimiter.on('failed', (error, jobInfo) => {
    console.warn('[RateLimiter:Coverage] Job failed:', error.message, 'Retries:', jobInfo.retryCount)
  })

  coverageLimiter.on('depleted', () => {
    console.log('[RateLimiter:Coverage] Queue depleted - requests are being queued')
  })

  researchLimiter.on('failed', (error, jobInfo) => {
    console.warn('[RateLimiter:Research] Job failed:', error.message, 'Retries:', jobInfo.retryCount)
  })

  researchLimiter.on('depleted', () => {
    console.log('[RateLimiter:Research] Queue depleted - requests are being queued')
  })
}

// =============================================================================
// BACKWARD COMPATIBILITY
// =============================================================================

// Keep the old global limiter for any code that hasn't been updated yet
// This will be deprecated once all code is migrated to the new API
export const arcticShiftLimiter = researchLimiter
