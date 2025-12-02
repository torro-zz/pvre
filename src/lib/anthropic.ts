import Anthropic from '@anthropic-ai/sdk'
import {
  createTokenTracker,
  trackUsage,
  getUsageSummary,
  TokenTracker,
} from './analysis/token-tracker'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Global token tracker for the current request context
// In a real app, this should be request-scoped, but for simplicity we use a module-level tracker
let currentTracker: TokenTracker | null = null

/**
 * Start a new tracking session (call at the beginning of a request)
 */
export function startTokenTracking(): TokenTracker {
  currentTracker = createTokenTracker()
  return currentTracker
}

/**
 * Get the current tracker
 */
export function getCurrentTracker(): TokenTracker | null {
  return currentTracker
}

/**
 * End tracking session and get summary
 */
export function endTokenTracking() {
  if (!currentTracker) {
    return null
  }
  const summary = getUsageSummary(currentTracker)
  currentTracker = null
  return summary
}

/**
 * Create a message with automatic token tracking
 * Note: Only non-streaming calls are tracked automatically
 */
export async function createTrackedMessage(
  params: Omit<Parameters<typeof anthropic.messages.create>[0], 'stream'>
) {
  const response = await anthropic.messages.create({
    ...params,
    stream: false, // Ensure non-streaming for token tracking
  })

  // Track usage if we have an active tracker
  if (currentTracker && 'usage' in response && response.usage) {
    trackUsage(currentTracker, response.usage, params.model)
  }

  return response
}
