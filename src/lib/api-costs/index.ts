/**
 * API Cost Tracking
 *
 * Tracks all Claude API calls to understand costs and margins.
 * - paid_search: Main research (user pays credits)
 * - free_presearch: Hypothesis validation (free to user)
 * - free_chat: Chat within 2-message limit (free to user)
 * - paid_chat: Chat beyond limit (uses credits - future)
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { calculateCallCost } from '@/lib/analysis/token-tracker'
import type { Json } from '@/types/supabase'

export type ActionType = 'paid_search' | 'free_presearch' | 'free_chat' | 'paid_chat'

export interface RecordCostParams {
  userId: string
  jobId?: string | null
  actionType: ActionType
  model: string
  inputTokens: number
  outputTokens: number
  endpoint: string
  metadata?: Record<string, unknown>
}

/**
 * Record an API cost to the database
 */
export async function recordApiCost(params: RecordCostParams): Promise<void> {
  const supabase = createAdminClient()
  const costUsd = calculateCallCost(params.inputTokens, params.outputTokens, params.model)

  const { error } = await supabase.from('api_costs').insert({
    user_id: params.userId,
    job_id: params.jobId || null,
    action_type: params.actionType,
    model: params.model,
    input_tokens: params.inputTokens,
    output_tokens: params.outputTokens,
    cost_usd: costUsd,
    endpoint: params.endpoint,
    metadata: (params.metadata || null) as Json,
  })

  if (error) {
    console.error('Failed to record API cost:', error)
    // Don't throw - cost tracking shouldn't break the request
  }
}

/**
 * Record multiple API costs in batch (for research flows with multiple calls)
 */
export async function recordApiCostsBatch(
  costs: RecordCostParams[]
): Promise<void> {
  if (costs.length === 0) return

  const supabase = createAdminClient()
  const records = costs.map((params) => ({
    user_id: params.userId,
    job_id: params.jobId || null,
    action_type: params.actionType,
    model: params.model,
    input_tokens: params.inputTokens,
    output_tokens: params.outputTokens,
    cost_usd: calculateCallCost(params.inputTokens, params.outputTokens, params.model),
    endpoint: params.endpoint,
    metadata: (params.metadata || null) as Json,
  }))

  const { error } = await supabase.from('api_costs').insert(records)

  if (error) {
    console.error('Failed to record API costs batch:', error)
  }
}

export interface ChatLimitResult {
  chatNumber: number
  isFree: boolean
  requiresCredits: boolean
}

const FREE_CHAT_LIMIT = 2

/**
 * Check and increment chat count for a job
 * Returns { chatNumber, isFree } where isFree is true for first 2 chats
 */
export async function checkChatLimit(jobId: string): Promise<ChatLimitResult> {
  const supabase = createAdminClient()
  const { data: newCount, error } = await supabase.rpc('increment_chat_count', {
    p_job_id: jobId,
  })

  if (error) {
    console.error('Failed to increment chat count:', error)
    // Default to allowing (don't block user on tracking error)
    return { chatNumber: 1, isFree: true, requiresCredits: false }
  }

  const chatNumber = newCount || 1
  const isFree = chatNumber <= FREE_CHAT_LIMIT

  return {
    chatNumber,
    isFree,
    requiresCredits: !isFree,
  }
}

/**
 * Get current chat count without incrementing (for UI display)
 */
export async function getChatCount(jobId: string): Promise<number> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('research_jobs')
    .select('chat_count')
    .eq('id', jobId)
    .single()

  if (error || !data) {
    return 0
  }

  return data.chat_count || 0
}

export interface PresearchLimitResult {
  attemptCount: number
  canContinue: boolean
  mustProceed: boolean
  remainingAttempts: number
}

const PRESEARCH_LIMIT = 6

/**
 * Check pre-search limit for a session
 */
export async function checkPresearchLimit(
  userId: string,
  sessionId: string
): Promise<PresearchLimitResult> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('check_presearch_limit', {
    p_user_id: userId,
    p_session_id: sessionId,
  })

  if (error || !data || data.length === 0) {
    console.error('Failed to check presearch limit:', error)
    return {
      attemptCount: 0,
      canContinue: true,
      mustProceed: false,
      remainingAttempts: PRESEARCH_LIMIT,
    }
  }

  const attemptCount = data[0].attempt_count
  const canContinue = data[0].can_continue

  return {
    attemptCount,
    canContinue,
    mustProceed: !canContinue,
    remainingAttempts: Math.max(0, PRESEARCH_LIMIT - attemptCount),
  }
}

/**
 * Record a pre-search attempt
 */
export async function recordPresearchAttempt(
  userId: string,
  hypothesis: string,
  sessionId: string
): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('presearch_attempts').insert({
    user_id: userId,
    hypothesis,
    session_id: sessionId,
  })

  if (error) {
    console.error('Failed to record presearch attempt:', error)
  }
}

/**
 * Mark a pre-search session as converted to a paid job
 */
export async function markPresearchConverted(
  sessionId: string,
  jobId: string
): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('presearch_attempts')
    .update({ converted_to_job_id: jobId })
    .eq('session_id', sessionId)

  if (error) {
    console.error('Failed to mark presearch converted:', error)
  }
}

// ============================================
// Cost Analysis Functions (for admin dashboard)
// ============================================

export interface CostSummary {
  actionType: ActionType
  callCount: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCostUsd: number
}

/**
 * Get cost summary by action type for a date range
 */
export async function getCostSummaryByAction(
  startDate?: Date,
  endDate?: Date
): Promise<CostSummary[]> {
  const supabase = createAdminClient()

  let query = supabase
    .from('api_costs')
    .select('action_type, input_tokens, output_tokens, cost_usd')

  if (startDate) {
    query = query.gte('created_at', startDate.toISOString())
  }
  if (endDate) {
    query = query.lte('created_at', endDate.toISOString())
  }

  const { data, error } = await query

  if (error || !data) {
    console.error('Failed to get cost summary:', error)
    return []
  }

  // Aggregate by action type
  const summaryMap: Record<string, CostSummary> = {}

  for (const row of data) {
    const actionType = row.action_type as ActionType
    if (!summaryMap[actionType]) {
      summaryMap[actionType] = {
        actionType,
        callCount: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCostUsd: 0,
      }
    }
    summaryMap[actionType].callCount++
    summaryMap[actionType].totalInputTokens += row.input_tokens
    summaryMap[actionType].totalOutputTokens += row.output_tokens
    summaryMap[actionType].totalCostUsd += Number(row.cost_usd)
  }

  return Object.values(summaryMap)
}

/**
 * Get cost for a specific research job
 */
export async function getJobCost(jobId: string): Promise<{
  totalCostUsd: number
  callCount: number
  breakdown: { endpoint: string; costUsd: number; callCount: number }[]
}> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('api_costs')
    .select('endpoint, cost_usd')
    .eq('job_id', jobId)

  if (error || !data) {
    return { totalCostUsd: 0, callCount: 0, breakdown: [] }
  }

  const breakdownMap: Record<string, { costUsd: number; callCount: number }> = {}
  let totalCostUsd = 0

  for (const row of data) {
    const endpoint = row.endpoint || 'unknown'
    if (!breakdownMap[endpoint]) {
      breakdownMap[endpoint] = { costUsd: 0, callCount: 0 }
    }
    breakdownMap[endpoint].costUsd += Number(row.cost_usd)
    breakdownMap[endpoint].callCount++
    totalCostUsd += Number(row.cost_usd)
  }

  return {
    totalCostUsd,
    callCount: data.length,
    breakdown: Object.entries(breakdownMap).map(([endpoint, stats]) => ({
      endpoint,
      ...stats,
    })),
  }
}

/**
 * Get average cost per user for a date range
 */
export async function getAverageCostPerUser(
  startDate?: Date,
  endDate?: Date
): Promise<{
  uniqueUsers: number
  totalCostUsd: number
  avgCostPerUser: number
}> {
  const supabase = createAdminClient()

  let query = supabase.from('api_costs').select('user_id, cost_usd')

  if (startDate) {
    query = query.gte('created_at', startDate.toISOString())
  }
  if (endDate) {
    query = query.lte('created_at', endDate.toISOString())
  }

  const { data, error } = await query

  if (error || !data || data.length === 0) {
    return { uniqueUsers: 0, totalCostUsd: 0, avgCostPerUser: 0 }
  }

  const uniqueUsers = new Set(data.map((r) => r.user_id)).size
  const totalCostUsd = data.reduce((sum, r) => sum + Number(r.cost_usd), 0)

  return {
    uniqueUsers,
    totalCostUsd,
    avgCostPerUser: totalCostUsd / uniqueUsers,
  }
}
