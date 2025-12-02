import { createAdminClient } from '@/lib/supabase/admin'

export interface CreditCheckResult {
  hasCredits: boolean
  balance: number
}

export async function checkUserCredits(userId: string): Promise<CreditCheckResult> {
  const supabase = createAdminClient()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('credits_balance')
    .eq('id', userId)
    .single()

  if (error || !profile) {
    console.error('Failed to check credits:', error)
    return { hasCredits: false, balance: 0 }
  }

  return {
    hasCredits: (profile.credits_balance || 0) >= 1,
    balance: profile.credits_balance || 0,
  }
}

export async function deductCredit(
  userId: string,
  jobId: string
): Promise<boolean> {
  const supabase = createAdminClient()

  // Use RPC for atomic credit deduction + transaction logging
  // The RPC handles: balance check, deduction, and transaction log in one transaction
  const { data: success, error } = await supabase.rpc('deduct_credit', {
    p_user_id: userId,
    p_job_id: jobId,
  })

  if (error) {
    console.error('Credit deduction failed:', error.message, { userId, jobId })
    return false
  }

  if (success !== true) {
    console.warn('Insufficient credits for user:', userId)
    return false
  }

  return true
}
