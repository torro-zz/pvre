/**
 * Rate Limiting Module
 *
 * Uses Vercel KV in production for distributed rate limiting across serverless instances.
 * Falls back to in-memory rate limiting in development (when KV is not configured).
 *
 * Usage:
 *   const { allowed, remaining } = await checkRateLimit('user:123', 100, 3600)
 *   if (!allowed) {
 *     throw new Error('Rate limit exceeded')
 *   }
 */

import { kv } from '@vercel/kv'

// =============================================================================
// TYPES
// =============================================================================

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number // Unix timestamp
  source: 'vercel_kv' | 'memory'
}

export interface RateLimitConfig {
  limit: number
  windowSeconds: number
}

// =============================================================================
// CONFIGURATION
// =============================================================================

// Pre-defined rate limits
export const RATE_LIMITS = {
  // AI Trend queries - generous for normal use
  AI_TREND: { limit: 100, windowSeconds: 3600 } as RateLimitConfig,

  // Arctic Shift API - respect their limits
  ARCTIC_SHIFT: { limit: 1000, windowSeconds: 3600 } as RateLimitConfig,

  // Per-research session
  RESEARCH_SESSION: { limit: 10, windowSeconds: 60 } as RateLimitConfig,
} as const

// =============================================================================
// IN-MEMORY FALLBACK (for local development)
// =============================================================================

interface MemoryRateLimitEntry {
  count: number
  windowStart: number
}

const memoryStore = new Map<string, MemoryRateLimitEntry>()

/**
 * In-memory rate limiting for local development
 * Note: This doesn't persist across serverless invocations,
 * but works fine for local dev servers
 */
function checkMemoryRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  const now = Math.floor(Date.now() / 1000)
  const windowKey = `${key}:${Math.floor(now / windowSeconds)}`

  let entry = memoryStore.get(windowKey)

  if (!entry || entry.windowStart !== Math.floor(now / windowSeconds)) {
    // New window
    entry = { count: 0, windowStart: Math.floor(now / windowSeconds) }
  }

  entry.count++
  memoryStore.set(windowKey, entry)

  // Clean up old entries periodically
  if (memoryStore.size > 1000) {
    const cutoff = now - windowSeconds * 2
    for (const [k, v] of memoryStore) {
      if (v.windowStart * windowSeconds < cutoff) {
        memoryStore.delete(k)
      }
    }
  }

  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: (entry.windowStart + 1) * windowSeconds,
    source: 'memory',
  }
}

// =============================================================================
// VERCEL KV RATE LIMITING
// =============================================================================

/**
 * Check if Vercel KV is configured
 */
function isKVConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

/**
 * Rate limiting using Vercel KV
 */
async function checkKVRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000)
  const windowKey = `ratelimit:${key}:${Math.floor(now / windowSeconds)}`

  try {
    // Increment counter atomically
    const count = await kv.incr(windowKey)

    // Set expiry on first increment
    if (count === 1) {
      await kv.expire(windowKey, windowSeconds)
    }

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      resetAt: (Math.floor(now / windowSeconds) + 1) * windowSeconds,
      source: 'vercel_kv',
    }
  } catch (error) {
    console.warn('[RateLimit] Vercel KV error, falling back to memory:', error)
    // Fall back to memory on KV errors
    return checkMemoryRateLimit(key, limit, windowSeconds)
  }
}

// =============================================================================
// MAIN EXPORT
// =============================================================================

/**
 * Check rate limit for a given key
 *
 * @param key - Unique identifier (e.g., 'user:123', 'ip:192.168.1.1')
 * @param limit - Maximum requests allowed in window
 * @param windowSeconds - Time window in seconds
 * @returns Rate limit result with allowed status and remaining quota
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  if (isKVConfigured()) {
    return checkKVRateLimit(key, limit, windowSeconds)
  }

  // Local development fallback
  return checkMemoryRateLimit(key, limit, windowSeconds)
}

/**
 * Convenience function using pre-defined limits
 */
export async function checkRateLimitWithConfig(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  return checkRateLimit(key, config.limit, config.windowSeconds)
}

/**
 * Check if we're in a rate-limited state without incrementing
 * (for informational purposes)
 */
export async function getRateLimitStatus(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ count: number; limit: number; remaining: number }> {
  const now = Math.floor(Date.now() / 1000)
  const bucket = Math.floor(now / windowSeconds)

  if (isKVConfigured()) {
    const kvKey = `ratelimit:${key}:${bucket}`
    try {
      const count = (await kv.get<number>(kvKey)) || 0
      return { count, limit, remaining: Math.max(0, limit - count) }
    } catch {
      // Ignore errors for status check
    }
  }

  // Memory fallback - uses different key format (no 'ratelimit:' prefix)
  const memoryKey = `${key}:${bucket}`
  const entry = memoryStore.get(memoryKey)
  const count = entry?.count || 0
  return { count, limit, remaining: Math.max(0, limit - count) }
}
