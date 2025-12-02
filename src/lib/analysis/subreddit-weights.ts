// Subreddit Weighting Module
// Weights pain scores by subreddit relevance to the hypothesis

import Anthropic from '@anthropic-ai/sdk'
import { getCurrentTracker } from '@/lib/anthropic'
import { trackUsage } from './token-tracker'

const anthropic = new Anthropic()

export interface SubredditWeight {
  subreddit: string
  weight: number // 0.5 to 1.5
  relevanceLevel: 'highly_specific' | 'directly_related' | 'somewhat_related' | 'tangentially_related' | 'too_broad'
}

/**
 * Gets relevance weights for subreddits based on the hypothesis.
 * Higher weights (>1.0) boost pain signals from highly relevant subreddits.
 * Lower weights (<1.0) reduce influence from broad/tangential subreddits.
 *
 * @param hypothesis - The business hypothesis
 * @param subreddits - List of subreddit names to weight
 * @returns Map of subreddit name to weight
 */
export async function getSubredditWeights(
  hypothesis: string,
  subreddits: string[]
): Promise<Map<string, number>> {
  if (subreddits.length === 0) {
    return new Map()
  }

  const prompt = `Rate how relevant each subreddit is to this business hypothesis.

HYPOTHESIS: "${hypothesis}"

SUBREDDITS: ${subreddits.join(', ')}

For each subreddit, assign a relevance weight:
- 1.5 = Highly specific to the hypothesis domain (e.g., r/coworking for a coworking finder app)
- 1.2 = Directly related to the target audience's needs
- 1.0 = Somewhat related, useful but not core
- 0.7 = Tangentially related, mostly different topics
- 0.5 = Too broad, will have mostly irrelevant posts

Be strict with weighting. Only give 1.5 to subreddits that are DIRECTLY about the hypothesis topic.
Most general subreddits like r/entrepreneur, r/business should be 0.7-1.0 at best.

Respond with JSON only:
{
  "weights": {
    "subredditname": 1.2,
    "anothersubreddit": 0.7
  }
}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-haiku-latest',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })

    // Track token usage
    const tracker = getCurrentTracker()
    if (tracker && response.usage) {
      trackUsage(tracker, response.usage, 'claude-3-5-haiku-latest')
    }

    const content = response.content[0]
    if (content.type !== 'text') {
      return getDefaultWeights(subreddits)
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return getDefaultWeights(subreddits)
    }

    const data = JSON.parse(jsonMatch[0])
    const weights = new Map<string, number>()

    if (data.weights && typeof data.weights === 'object') {
      for (const [sub, weight] of Object.entries(data.weights)) {
        // Normalize subreddit name and clamp weight to valid range
        const normalizedSub = sub.toLowerCase().replace(/^r\//, '')
        const clampedWeight = Math.max(0.5, Math.min(1.5, Number(weight) || 1.0))
        weights.set(normalizedSub, clampedWeight)
      }
    }

    // Add default weights for any missing subreddits
    for (const sub of subreddits) {
      const normalizedSub = sub.toLowerCase().replace(/^r\//, '')
      if (!weights.has(normalizedSub)) {
        weights.set(normalizedSub, 1.0)
      }
    }

    return weights
  } catch (error) {
    console.error('Subreddit weighting failed:', error)
    return getDefaultWeights(subreddits)
  }
}

/**
 * Returns default weights (1.0 for all subreddits)
 */
function getDefaultWeights(subreddits: string[]): Map<string, number> {
  const weights = new Map<string, number>()
  for (const sub of subreddits) {
    weights.set(sub.toLowerCase().replace(/^r\//, ''), 1.0)
  }
  return weights
}

/**
 * Applies subreddit weights to pain scores.
 * Modifies pain signals in place by multiplying their score by the subreddit weight.
 * Supports both flat structure ({ subreddit, score }) and nested structure ({ source: { subreddit }, score }).
 *
 * @param painSignals - Array of pain signals
 * @param weights - Map of subreddit name to weight
 */
export function applySubredditWeights<T extends { score: number; subreddit?: string; source?: { subreddit: string } }>(
  painSignals: T[],
  weights: Map<string, number>
): void {
  for (const signal of painSignals) {
    // Support both flat and nested subreddit structures
    const subreddit = signal.subreddit || signal.source?.subreddit
    if (!subreddit) continue

    const normalizedSub = subreddit.toLowerCase().replace(/^r\//, '')
    const weight = weights.get(normalizedSub) || 1.0
    // Apply weight and clamp to 0-10 range
    signal.score = Math.min(10, Math.max(0, signal.score * weight))
  }
}
