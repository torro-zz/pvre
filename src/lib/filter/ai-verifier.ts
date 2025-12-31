/**
 * AI Verifier
 *
 * Stage 3 of the filtering pipeline.
 * Uses Haiku for fast YES/NO verification of candidate signals.
 *
 * Cost: ~$0.001 per call, capped at 50 calls = ~$0.05 max
 */

import Anthropic from '@anthropic-ai/sdk'
import { FILTER_CONFIG } from './config'
import { ScoredSignal } from '@/lib/adapters/types'

// Lazy-initialized Anthropic client
let anthropicClient: Anthropic | null = null

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic()
  }
  return anthropicClient
}

/**
 * Verified signal with AI verification result
 */
export interface VerifiedSignal extends ScoredSignal {
  /** AI verification passed */
  verified: boolean

  /** Raw AI response (for debugging) */
  aiResponse?: string
}

/**
 * Verification result for a single signal
 */
interface VerificationResult {
  signalId: string
  verified: boolean
  response: string
}

/**
 * Build the verification prompt for a single post
 */
function buildVerificationPrompt(hypothesis: string, title: string, body: string): string {
  // Truncate body to avoid token limits
  const truncatedBody = body.length > 500 ? body.slice(0, 500) + '...' : body

  return `Hypothesis: "${hypothesis}"

Post:
Title: "${title}"
Body: "${truncatedBody}"

Is this post SPECIFICALLY about the problem described in the hypothesis?

Answer ONLY "YES" or "NO".

- YES = Post describes someone experiencing this exact problem
- NO = Post is off-topic, tangentially related, or about a different problem

Be strict. "Finding clients" is NOT the same as "getting paid by clients".`
}

/**
 * Verify a single signal with Haiku
 */
async function verifySingle(
  signal: ScoredSignal,
  hypothesis: string
): Promise<VerificationResult> {
  const client = getAnthropicClient()

  const prompt = buildVerificationPrompt(
    hypothesis,
    signal.post.title,
    signal.post.body
  )

  try {
    const response = await client.messages.create({
      model: FILTER_CONFIG.AI_MODEL,
      max_tokens: FILTER_CONFIG.AI_MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      return { signalId: signal.post.id, verified: false, response: 'non-text response' }
    }

    const answer = content.text.trim().toUpperCase()
    const verified = FILTER_CONFIG.AI_STRICT
      ? answer === 'YES'
      : answer === 'YES' || answer === 'MAYBE'

    return { signalId: signal.post.id, verified, response: answer }
  } catch (error) {
    console.error(`[AIVerifier] Error verifying ${signal.post.id}:`, error)
    // On error, fail closed (don't verify)
    return { signalId: signal.post.id, verified: false, response: 'error' }
  }
}

/**
 * Verify signals in batches for parallelism
 */
async function verifyBatch(
  signals: ScoredSignal[],
  hypothesis: string
): Promise<VerificationResult[]> {
  const promises = signals.map(signal => verifySingle(signal, hypothesis))
  return Promise.all(promises)
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Verify multiple signals with Haiku AI
 *
 * Takes the top N signals (already sorted by embedding score) and
 * verifies each with a YES/NO prompt. Only "YES" signals pass.
 *
 * @param signals - Sorted signals to verify (should be <= AI_VERIFICATION_CAP)
 * @param hypothesis - The hypothesis to verify against
 * @param onProgress - Optional progress callback
 * @returns Signals that passed verification
 */
export async function verifyWithHaiku(
  signals: ScoredSignal[],
  hypothesis: string,
  onProgress?: (message: string) => void
): Promise<VerifiedSignal[]> {
  if (signals.length === 0) {
    return []
  }

  // Enforce cap (should already be capped, but be safe)
  const toVerify = signals.slice(0, FILTER_CONFIG.AI_VERIFICATION_CAP)

  onProgress?.(`[Stage 3] Verifying ${toVerify.length} candidates with Haiku...`)

  const results: VerifiedSignal[] = []
  const batchSize = FILTER_CONFIG.AI_BATCH_SIZE

  // Process in batches with rate limiting
  // Anthropic limit: 50 requests/minute = ~1.2 seconds between batches of 10
  const RATE_LIMIT_DELAY_MS = 1500 // 1.5 seconds between batches to stay under limit

  for (let i = 0; i < toVerify.length; i += batchSize) {
    const batch = toVerify.slice(i, i + batchSize)
    const batchNum = Math.floor(i / batchSize) + 1
    const totalBatches = Math.ceil(toVerify.length / batchSize)

    // Add delay between batches to avoid rate limits (except first batch)
    if (i > 0) {
      await sleep(RATE_LIMIT_DELAY_MS)
    }

    onProgress?.(`[Stage 3] Batch ${batchNum}/${totalBatches}...`)

    const batchResults = await verifyBatch(batch, hypothesis)

    // Map results back to signals
    for (let j = 0; j < batch.length; j++) {
      const signal = batch[j]
      const result = batchResults[j]

      results.push({
        ...signal,
        verified: result.verified,
        aiResponse: result.response,
      })
    }
  }

  const verified = results.filter(r => r.verified)
  const rejected = results.length - verified.length

  onProgress?.(`[Stage 3] Complete: ${verified.length} verified, ${rejected} rejected`)

  return verified
}

/**
 * Get verification statistics
 */
export function getVerificationStats(results: VerifiedSignal[]): {
  total: number
  verified: number
  rejected: number
  verificationRate: number
} {
  const verified = results.filter(r => r.verified).length
  const rejected = results.length - verified

  return {
    total: results.length,
    verified,
    rejected,
    verificationRate: results.length > 0 ? verified / results.length : 0,
  }
}
