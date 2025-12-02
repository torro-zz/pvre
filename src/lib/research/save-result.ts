/**
 * Utility to save research results to the database
 *
 * This provides a single source of truth for saving research results,
 * ensuring the correct column name (module_name) is always used.
 */

import { createAdminClient } from '@/lib/supabase/admin'

export type ModuleName =
  | 'community_voice'
  | 'pain_analysis'
  | 'market_sizing'
  | 'timing_analysis'
  | 'competitor_intelligence'

/**
 * Save a research result to the database
 *
 * Uses upsert with onConflict to handle idempotent saves.
 * The result data is JSON-serialized to ensure type compatibility.
 *
 * @param jobId - The research job ID
 * @param moduleName - The module that produced this result
 * @param data - The result data (will be JSON serialized)
 * @returns The saved result or throws on error
 */
export async function saveResearchResult(
  jobId: string,
  moduleName: ModuleName,
  data: unknown
): Promise<void> {
  const adminClient = createAdminClient()

  // JSON serialize to ensure type compatibility with Supabase Json type
  const serializedData = JSON.parse(JSON.stringify(data))

  const { error } = await adminClient
    .from('research_results')
    .upsert(
      {
        job_id: jobId,
        module_name: moduleName,
        data: serializedData,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'job_id,module_name' }
    )

  if (error) {
    console.error(`Failed to save ${moduleName} result for job ${jobId}:`, error)
    throw new Error(`Failed to save research result: ${error.message}`)
  }
}

/**
 * Update research job status
 *
 * @param jobId - The research job ID
 * @param status - The new status
 * @param errorSource - Optional error source if status is 'failed'
 * @param errorMessage - Optional error message if status is 'failed'
 */
export async function updateJobStatus(
  jobId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  errorSource?: string | null,
  errorMessage?: string | null
): Promise<void> {
  const adminClient = createAdminClient()

  const updateData: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (status === 'failed') {
    if (errorSource) updateData.error_source = errorSource
    if (errorMessage) updateData.error_message = errorMessage
  }

  const { error } = await adminClient
    .from('research_jobs')
    .update(updateData)
    .eq('id', jobId)

  if (error) {
    console.error(`Failed to update job ${jobId} status to ${status}:`, error)
    throw new Error(`Failed to update job status: ${error.message}`)
  }
}
