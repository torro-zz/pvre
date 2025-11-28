import { createClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase client with service role key
 * This bypasses RLS and should ONLY be used for:
 * - Development/testing
 * - Server-side admin operations
 *
 * NEVER expose this to the client
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase URL or Service Role Key')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
