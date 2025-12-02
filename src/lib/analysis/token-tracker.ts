// Token Usage Tracking for Claude API
// Tracks token consumption and calculates costs for margin analysis

// Claude API pricing (as of Dec 2024)
// https://www.anthropic.com/pricing
export const CLAUDE_PRICING = {
  'claude-3-5-haiku-latest': {
    inputPer1M: 0.80,   // $0.80 per 1M input tokens
    outputPer1M: 4.00,  // $4.00 per 1M output tokens
  },
  'claude-3-5-sonnet-latest': {
    inputPer1M: 3.00,   // $3.00 per 1M input tokens
    outputPer1M: 15.00, // $15.00 per 1M output tokens
  },
  'claude-sonnet-4-20250514': {
    inputPer1M: 3.00,
    outputPer1M: 15.00,
  },
} as const

export type ClaudeModel = keyof typeof CLAUDE_PRICING

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  model: string
}

export interface TokenTracker {
  calls: TokenUsage[]
  totalInputTokens: number
  totalOutputTokens: number
  totalCostUsd: number
}

/**
 * Create a new token tracker instance
 */
export function createTokenTracker(): TokenTracker {
  return {
    calls: [],
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUsd: 0,
  }
}

/**
 * Calculate cost for a single API call
 */
export function calculateCallCost(
  inputTokens: number,
  outputTokens: number,
  model: string
): number {
  const pricing = CLAUDE_PRICING[model as ClaudeModel]
  if (!pricing) {
    // Default to Haiku pricing for unknown models
    console.warn(`Unknown model ${model}, using Haiku pricing`)
    return (inputTokens / 1_000_000) * 0.80 + (outputTokens / 1_000_000) * 4.00
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M
  return inputCost + outputCost
}

/**
 * Track a Claude API call's token usage
 */
export function trackUsage(
  tracker: TokenTracker,
  usage: { input_tokens: number; output_tokens: number },
  model: string
): void {
  const call: TokenUsage = {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    model,
  }

  tracker.calls.push(call)
  tracker.totalInputTokens += usage.input_tokens
  tracker.totalOutputTokens += usage.output_tokens
  tracker.totalCostUsd += calculateCallCost(usage.input_tokens, usage.output_tokens, model)
}

/**
 * Get summary of token usage
 */
export function getUsageSummary(tracker: TokenTracker): {
  totalCalls: number
  totalInputTokens: number
  totalOutputTokens: number
  totalTokens: number
  totalCostUsd: number
  costBreakdown: { model: string; calls: number; cost: number }[]
} {
  // Group by model
  const modelStats: Record<string, { calls: number; inputTokens: number; outputTokens: number }> = {}

  for (const call of tracker.calls) {
    if (!modelStats[call.model]) {
      modelStats[call.model] = { calls: 0, inputTokens: 0, outputTokens: 0 }
    }
    modelStats[call.model].calls++
    modelStats[call.model].inputTokens += call.inputTokens
    modelStats[call.model].outputTokens += call.outputTokens
  }

  const costBreakdown = Object.entries(modelStats).map(([model, stats]) => ({
    model,
    calls: stats.calls,
    cost: calculateCallCost(stats.inputTokens, stats.outputTokens, model),
  }))

  return {
    totalCalls: tracker.calls.length,
    totalInputTokens: tracker.totalInputTokens,
    totalOutputTokens: tracker.totalOutputTokens,
    totalTokens: tracker.totalInputTokens + tracker.totalOutputTokens,
    totalCostUsd: Math.round(tracker.totalCostUsd * 10000) / 10000, // Round to 4 decimal places
    costBreakdown,
  }
}

/**
 * Credit pricing for comparison
 * Assuming 1 credit = $X value to the user
 */
export const CREDIT_PRICING = {
  // Based on credit pack prices
  // Starter Pack: $5 for 5 credits = $1/credit
  // Growth Pack: $15 for 20 credits = $0.75/credit
  // Pro Pack: $30 for 50 credits = $0.60/credit
  // Average value per credit (weighted toward growth pack)
  averageValuePerCredit: 0.75,
}

/**
 * Calculate margin for a research run
 */
export function calculateMargin(
  apiCostUsd: number,
  creditsCharged: number
): {
  creditValueUsd: number
  apiCostUsd: number
  marginUsd: number
  marginPercent: number
} {
  const creditValueUsd = creditsCharged * CREDIT_PRICING.averageValuePerCredit
  const marginUsd = creditValueUsd - apiCostUsd
  const marginPercent = creditValueUsd > 0 ? (marginUsd / creditValueUsd) * 100 : 0

  return {
    creditValueUsd: Math.round(creditValueUsd * 100) / 100,
    apiCostUsd: Math.round(apiCostUsd * 10000) / 10000,
    marginUsd: Math.round(marginUsd * 100) / 100,
    marginPercent: Math.round(marginPercent * 10) / 10,
  }
}
