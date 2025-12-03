/**
 * Utility to log relevance decisions for quality audits
 *
 * Logs individual Y/N decisions from the Claude relevance filter
 * to enable post-hoc analysis of filter quality.
 *
 * Non-blocking: Failures are logged but don't crash the research pipeline.
 */

import { createAdminClient } from '@/lib/supabase/admin'

export interface RelevanceDecisionLog {
  job_id: string
  content_type: 'post' | 'comment'
  reddit_id: string
  title?: string
  body_preview?: string
  subreddit?: string
  decision: 'Y' | 'N'
  batch_index: number
}

/**
 * Log a batch of relevance decisions to the database
 *
 * @param decisions - Array of decision logs to insert
 * @returns void - Errors are caught and logged, not thrown
 */
export async function logRelevanceDecisions(
  decisions: RelevanceDecisionLog[]
): Promise<void> {
  if (decisions.length === 0) return

  try {
    const adminClient = createAdminClient()

    // Batch insert all decisions
    // Note: After running migration 013_relevance_decisions.sql, regenerate types:
    // npx supabase gen types typescript --project-id PROJECT_ID > src/types/supabase.ts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (adminClient as any)
      .from('relevance_decisions')
      .insert(decisions)

    if (error) {
      console.error('Failed to log relevance decisions:', error.message)
      // Don't throw - logging failures shouldn't crash research
    }
  } catch (error) {
    console.error('Error logging relevance decisions:', error)
    // Don't throw - logging failures shouldn't crash research
  }
}

/**
 * Helper to prepare decision logs from filter results
 */
export function preparePostDecisionLogs(
  jobId: string,
  posts: Array<{ id: string; title: string; body?: string; subreddit: string }>,
  decisions: string,
  batchStartIndex: number
): RelevanceDecisionLog[] {
  return posts.map((post, idx) => ({
    job_id: jobId,
    content_type: 'post' as const,
    reddit_id: post.id,
    title: post.title,
    body_preview: (post.body || '').slice(0, 200),
    subreddit: post.subreddit,
    decision: (decisions[idx] === 'Y' ? 'Y' : 'N') as 'Y' | 'N',
    batch_index: batchStartIndex + idx,
  }))
}

export function prepareCommentDecisionLogs(
  jobId: string,
  comments: Array<{ id: string; body: string; subreddit: string }>,
  decisions: string,
  batchStartIndex: number
): RelevanceDecisionLog[] {
  return comments.map((comment, idx) => ({
    job_id: jobId,
    content_type: 'comment' as const,
    reddit_id: comment.id,
    body_preview: comment.body.slice(0, 200),
    subreddit: comment.subreddit,
    decision: (decisions[idx] === 'Y' ? 'Y' : 'N') as 'Y' | 'N',
    batch_index: batchStartIndex + idx,
  }))
}
