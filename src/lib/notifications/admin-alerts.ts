// Admin Alerts - Notification system for admin-level events
// Currently logs to database; can be extended to email/Slack/WhatsApp

import { createAdminClient } from '@/lib/supabase/admin'

export interface AdminAlert {
  type: 'refund_pattern' | 'high_volume' | 'system_error' | 'security'
  userId?: string
  userEmail?: string
  message: string
  metadata?: Record<string, unknown>
}

/**
 * Send an admin alert for review
 * Currently logs to admin_alerts table; can be extended to email/Slack
 */
export async function sendAdminAlert(alert: AdminAlert): Promise<void> {
  const adminSupabase = createAdminClient()

  try {
    // Log to admin_alerts table
    const { error } = await adminSupabase.from('admin_alerts').insert({
      alert_type: alert.type,
      user_id: alert.userId || null,
      user_email: alert.userEmail || null,
      message: alert.message,
      metadata: alert.metadata || {},
      status: 'unread',
      created_at: new Date().toISOString(),
    })

    if (error) {
      // Table might not exist - log to console as fallback
      console.warn('[ADMIN ALERT] Failed to save to database:', error)
      console.warn('[ADMIN ALERT]', JSON.stringify(alert, null, 2))
    }

    // Also log to console for visibility
    console.log(`[ADMIN ALERT] ${alert.type}: ${alert.message}`)
    if (alert.metadata) {
      console.log('[ADMIN ALERT] Metadata:', JSON.stringify(alert.metadata))
    }

    // Future: Add email/Slack/WhatsApp notification here
    // if (process.env.ADMIN_SLACK_WEBHOOK) {
    //   await sendSlackNotification(alert)
    // }
  } catch (err) {
    // Never throw - alerts should not break main flow
    console.error('[ADMIN ALERT] Critical failure:', err)
    console.error('[ADMIN ALERT] Original alert:', JSON.stringify(alert))
  }
}

/**
 * Check if a user has a pattern of frequent refunds
 * Returns the count of previous refunds
 */
export async function getUserRefundCount(userId: string): Promise<number> {
  const adminSupabase = createAdminClient()

  try {
    const { count, error } = await adminSupabase
      .from('feedback_reports')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('job_id', 'is', null) // Only count job-related reports (actual refunds)

    if (error) {
      console.warn('Failed to get refund count:', error)
      return 0
    }

    return count || 0
  } catch (err) {
    console.error('Error getting refund count:', err)
    return 0
  }
}
