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
    hasCredits: profile.credits_balance >= 1,
    balance: profile.credits_balance,
  }
}

export async function deductCredit(
  userId: string,
  jobId: string
): Promise<boolean> {
  const supabase = createAdminClient()

  const { data: success, error } = await supabase.rpc('deduct_credit', {
    p_user_id: userId,
    p_job_id: jobId,
  })

  if (error) {
    console.error('Failed to deduct credit:', error)
    return false
  }

  return success === true
}
