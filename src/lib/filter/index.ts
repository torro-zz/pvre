/**
 * Filter Index
 *
 * Two-stage filtering pipeline with cost cap:
 * 1. Embedding filter (loose, threshold 0.28) → ~150-300 candidates
 * 2. Rank by score, cap at 50 → cost control
 * 3. Haiku AI verification → ~25-35 verified signals
 *
 * Cost model: ~$0.06 per search (embeddings + 50 Haiku calls)
 */

import { filterByEmbedding, type FilterConfig as EmbeddingFilterConfig } from './universal-filter'
import { verifyWithHaiku, type VerifiedSignal } from './ai-verifier'
import { FILTER_CONFIG } from './config'
import { NormalizedPost, ScoredSignal } from '@/lib/adapters/types'

// Re-export core functions for direct use
export {
  filterByEmbedding,
  filterWithEmbedding,
  scorePost,
  getDefaultThreshold,
} from './universal-filter'

// Re-export AI verifier
export { verifyWithHaiku, type VerifiedSignal } from './ai-verifier'

// Re-export config
export { FILTER_CONFIG } from './config'

// Re-export types
export type { FilterConfig as EmbeddingFilterConfig } from './universal-filter'
export type {
  NormalizedPost,
  ScoredSignal,
  FilterResult,
  FilterMetrics,
} from '@/lib/adapters/types'

/**
 * Pipeline result with all stages
 */
export interface PipelineResult {
  /** Final verified signals */
  verified: VerifiedSignal[]

  /** Stage 1 candidates (before cap) */
  stage1Candidates: number

  /** Stage 2 candidates (after cap, before AI) */
  stage2Candidates: number

  /** Stage 3 verified count */
  stage3Verified: number

  /** Verification rate (stage3 / stage2) */
  verificationRate: number

  /** Processing time in ms */
  processingTimeMs: number
}

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
  /** Embedding threshold (default: 0.28) */
  embeddingThreshold?: number

  /** Max posts to send to AI (default: 50) */
  aiCap?: number

  /** Progress callback */
  onProgress?: (message: string) => void
}

/**
 * Full two-stage filtering pipeline
 *
 * Stage 1: Embedding filter (loose threshold 0.28)
 * Stage 2: Rank by score, cap at 50
 * Stage 3: Haiku AI verification (YES/NO)
 *
 * @param posts - Normalized posts from any adapter
 * @param hypothesis - Business hypothesis to filter against
 * @param config - Optional pipeline configuration
 * @returns PipelineResult with verified signals and metrics
 */
export async function filterSignals(
  posts: NormalizedPost[],
  hypothesis: string,
  config?: PipelineConfig
): Promise<PipelineResult> {
  const startTime = Date.now()
  const embeddingThreshold = config?.embeddingThreshold ?? FILTER_CONFIG.EMBEDDING_THRESHOLD
  const aiCap = config?.aiCap ?? FILTER_CONFIG.AI_VERIFICATION_CAP
  const onProgress = config?.onProgress

  // ==========================================================================
  // Stage 1: Embedding Filter (loose)
  // ==========================================================================
  onProgress?.(`[Stage 1] Embedding filter (threshold ${embeddingThreshold})...`)

  const embeddingResult = await filterByEmbedding(posts, hypothesis, {
    threshold: embeddingThreshold,
    onProgress,
  })

  const stage1Candidates = embeddingResult.signals.length
  onProgress?.(`[Stage 1] Complete: ${stage1Candidates} candidates`)

  // ==========================================================================
  // Stage 2: Rank and Cap
  // ==========================================================================
  onProgress?.(`[Stage 2] Ranking and capping at ${aiCap}...`)

  // Sort by embedding score (descending)
  const sorted = [...embeddingResult.signals].sort(
    (a, b) => b.embeddingScore - a.embeddingScore
  )

  // Take top N (cost cap)
  const top50 = sorted.slice(0, aiCap)
  const stage2Candidates = top50.length

  onProgress?.(`[Stage 2] Complete: ${stage2Candidates} posts going to AI verification`)

  // ==========================================================================
  // Stage 3: AI Verification
  // ==========================================================================
  const verified = await verifyWithHaiku(top50, hypothesis, onProgress)
  const stage3Verified = verified.length

  const verificationRate = stage2Candidates > 0
    ? stage3Verified / stage2Candidates
    : 0

  onProgress?.(`[Pipeline Complete] ${stage3Verified} verified signals (${Math.round(verificationRate * 100)}% verification rate)`)

  return {
    verified,
    stage1Candidates,
    stage2Candidates,
    stage3Verified,
    verificationRate,
    processingTimeMs: Date.now() - startTime,
  }
}

/**
 * Quick filter without AI verification
 * Uses embedding-only at 0.34 threshold (original calibrated threshold)
 *
 * @param posts - Normalized posts
 * @param hypothesis - Business hypothesis
 * @returns Scored signals (no AI verification)
 */
export async function quickFilter(
  posts: NormalizedPost[],
  hypothesis: string,
  onProgress?: (message: string) => void
): Promise<ScoredSignal[]> {
  const result = await filterByEmbedding(posts, hypothesis, {
    threshold: 0.34, // Original calibrated threshold
    onProgress,
  })
  return result.signals
}
