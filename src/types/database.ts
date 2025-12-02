export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Step-based research tracking
export type StepStatus = 'locked' | 'pending' | 'in_progress' | 'completed' | 'failed'

export interface StepStatusMap {
  pain_analysis: StepStatus
  market_sizing: StepStatus
  timing_analysis: StepStatus
  competitor_analysis: StepStatus
}

export const DEFAULT_STEP_STATUS: StepStatusMap = {
  pain_analysis: 'pending',
  market_sizing: 'locked',
  timing_analysis: 'locked',
  competitor_analysis: 'locked',
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          avatar_url: string | null
          lemonsqueezy_customer_id: string | null
          credits_balance: number
          total_credits_purchased: number
          total_research_runs: number
          cookie_consent_at: string | null
          privacy_policy_accepted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          lemonsqueezy_customer_id?: string | null
          credits_balance?: number
          total_credits_purchased?: number
          total_research_runs?: number
          cookie_consent_at?: string | null
          privacy_policy_accepted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          lemonsqueezy_customer_id?: string | null
          credits_balance?: number
          total_credits_purchased?: number
          total_research_runs?: number
          cookie_consent_at?: string | null
          privacy_policy_accepted_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      research_jobs: {
        Row: {
          id: string
          user_id: string
          hypothesis: string
          status: 'pending' | 'processing' | 'completed' | 'failed'
          step_status: StepStatusMap | null
          pain_signals: Json
          competitors: Json
          interview_guide: Json | null
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          hypothesis: string
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          step_status?: StepStatusMap | null
          pain_signals?: Json
          competitors?: Json
          interview_guide?: Json | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          hypothesis?: string
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          step_status?: StepStatusMap | null
          pain_signals?: Json
          competitors?: Json
          interview_guide?: Json | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      credit_packs: {
        Row: {
          id: string
          name: string
          description: string | null
          lemonsqueezy_variant_id: string
          credits: number
          price_cents: number
          display_order: number
          is_active: boolean
          badge_text: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          lemonsqueezy_variant_id: string
          credits: number
          price_cents: number
          display_order?: number
          is_active?: boolean
          badge_text?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          lemonsqueezy_variant_id?: string
          credits?: number
          price_cents?: number
          display_order?: number
          is_active?: boolean
          badge_text?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      purchases: {
        Row: {
          id: string
          user_id: string
          credit_pack_id: string | null
          lemonsqueezy_order_id: string | null
          lemonsqueezy_customer_id: string | null
          credits_purchased: number
          amount_cents: number
          status: 'pending' | 'completed' | 'failed' | 'refunded'
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          credit_pack_id?: string | null
          lemonsqueezy_order_id?: string | null
          lemonsqueezy_customer_id?: string | null
          credits_purchased: number
          amount_cents: number
          status?: 'pending' | 'completed' | 'failed' | 'refunded'
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          credit_pack_id?: string | null
          lemonsqueezy_order_id?: string | null
          lemonsqueezy_customer_id?: string | null
          credits_purchased?: number
          amount_cents?: number
          status?: 'pending' | 'completed' | 'failed' | 'refunded'
          created_at?: string
          completed_at?: string | null
        }
      }
      credit_transactions: {
        Row: {
          id: string
          user_id: string
          amount: number
          balance_after: number
          transaction_type: 'purchase' | 'usage' | 'refund' | 'adjustment' | 'bonus'
          reference_id: string | null
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          balance_after: number
          transaction_type: 'purchase' | 'usage' | 'refund' | 'adjustment' | 'bonus'
          reference_id?: string | null
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          balance_after?: number
          transaction_type?: 'purchase' | 'usage' | 'refund' | 'adjustment' | 'bonus'
          reference_id?: string | null
          description?: string | null
          created_at?: string
        }
      }
      api_keys: {
        Row: {
          id: string
          user_id: string
          name: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          expires_at: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          expires_at?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          expires_at?: string | null
          is_active?: boolean
          created_at?: string
        }
      }
      notification_preferences: {
        Row: {
          id: string
          user_id: string
          email_research_complete: boolean
          email_low_credits: boolean
          email_product_updates: boolean
          email_tips_and_tutorials: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          email_research_complete?: boolean
          email_low_credits?: boolean
          email_product_updates?: boolean
          email_tips_and_tutorials?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          email_research_complete?: boolean
          email_low_credits?: boolean
          email_product_updates?: boolean
          email_tips_and_tutorials?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      data_export_requests: {
        Row: {
          id: string
          user_id: string
          status: 'pending' | 'processing' | 'completed' | 'failed'
          download_url: string | null
          file_size_bytes: number | null
          expires_at: string | null
          error_message: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          download_url?: string | null
          file_size_bytes?: number | null
          expires_at?: string | null
          error_message?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          download_url?: string | null
          file_size_bytes?: number | null
          expires_at?: string | null
          error_message?: string | null
          created_at?: string
          completed_at?: string | null
        }
      }
      account_deletion_requests: {
        Row: {
          id: string
          user_id: string
          reason: string | null
          status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
          confirmation_token: string | null
          confirmed_at: string | null
          scheduled_deletion_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          reason?: string | null
          status?: 'pending' | 'confirmed' | 'completed' | 'cancelled'
          confirmation_token?: string | null
          confirmed_at?: string | null
          scheduled_deletion_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          reason?: string | null
          status?: 'pending' | 'confirmed' | 'completed' | 'cancelled'
          confirmation_token?: string | null
          confirmed_at?: string | null
          scheduled_deletion_at?: string | null
          created_at?: string
        }
      }
      waitlist: {
        Row: {
          id: string
          email: string
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          created_at?: string
        }
      }
    }
    Functions: {
      deduct_credit: {
        Args: { p_user_id: string; p_job_id: string }
        Returns: boolean
      }
      add_credits: {
        Args: { p_user_id: string; p_purchase_id: string; p_credits: number }
        Returns: number
      }
      add_bonus_credits: {
        Args: { p_user_id: string; p_credits: number; p_description: string }
        Returns: number
      }
    }
  }
}

// Convenience type aliases
export type Profile = Database['public']['Tables']['profiles']['Row']
export type ResearchJob = Database['public']['Tables']['research_jobs']['Row']
export type CreditPack = Database['public']['Tables']['credit_packs']['Row']
export type Purchase = Database['public']['Tables']['purchases']['Row']
export type CreditTransaction = Database['public']['Tables']['credit_transactions']['Row']
export type ApiKey = Database['public']['Tables']['api_keys']['Row']
export type NotificationPreferences = Database['public']['Tables']['notification_preferences']['Row']
export type DataExportRequest = Database['public']['Tables']['data_export_requests']['Row']
export type AccountDeletionRequest = Database['public']['Tables']['account_deletion_requests']['Row']
export type Waitlist = Database['public']['Tables']['waitlist']['Row']
