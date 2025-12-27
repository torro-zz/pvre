export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      account_deletion_requests: {
        Row: {
          confirmation_token: string | null
          confirmed_at: string | null
          created_at: string | null
          id: string
          reason: string | null
          scheduled_deletion_at: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          scheduled_deletion_at?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          confirmation_token?: string | null
          confirmed_at?: string | null
          created_at?: string | null
          id?: string
          reason?: string | null
          scheduled_deletion_at?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_deletion_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          id: string
          message: string
          metadata: Json | null
          notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      api_costs: {
        Row: {
          action_type: string
          cost_usd: number
          created_at: string | null
          endpoint: string | null
          id: string
          input_tokens: number
          job_id: string | null
          metadata: Json | null
          model: string
          output_tokens: number
          user_id: string | null
        }
        Insert: {
          action_type: string
          cost_usd: number
          created_at?: string | null
          endpoint?: string | null
          id?: string
          input_tokens: number
          job_id?: string | null
          metadata?: Json | null
          model: string
          output_tokens: number
          user_id?: string | null
        }
        Update: {
          action_type?: string
          cost_usd?: number
          created_at?: string | null
          endpoint?: string | null
          id?: string
          input_tokens?: number
          job_id?: string | null
          metadata?: Json | null
          model?: string
          output_tokens?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_costs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "research_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_discovery_events: {
        Row: {
          app_category: string | null
          app_id: string
          app_name: string
          app_rating: number | null
          app_review_count: number | null
          app_store: string
          core_signal_count: number | null
          created_at: string | null
          discovery_method: string | null
          hypothesis_audience: string | null
          hypothesis_domain: string | null
          id: string
          job_id: string | null
          llm_relevance_reason: string | null
          llm_relevance_score: number | null
          related_signal_count: number | null
          research_completed: boolean | null
          search_query: string | null
          signals_from_app: number | null
          updated_at: string | null
          user_id: string
          user_kept_selected: boolean | null
          user_manually_added: boolean | null
          was_auto_selected: boolean | null
        }
        Insert: {
          app_category?: string | null
          app_id: string
          app_name: string
          app_rating?: number | null
          app_review_count?: number | null
          app_store: string
          core_signal_count?: number | null
          created_at?: string | null
          discovery_method?: string | null
          hypothesis_audience?: string | null
          hypothesis_domain?: string | null
          id?: string
          job_id?: string | null
          llm_relevance_reason?: string | null
          llm_relevance_score?: number | null
          related_signal_count?: number | null
          research_completed?: boolean | null
          search_query?: string | null
          signals_from_app?: number | null
          updated_at?: string | null
          user_id: string
          user_kept_selected?: boolean | null
          user_manually_added?: boolean | null
          was_auto_selected?: boolean | null
        }
        Update: {
          app_category?: string | null
          app_id?: string
          app_name?: string
          app_rating?: number | null
          app_review_count?: number | null
          app_store?: string
          core_signal_count?: number | null
          created_at?: string | null
          discovery_method?: string | null
          hypothesis_audience?: string | null
          hypothesis_domain?: string | null
          id?: string
          job_id?: string | null
          llm_relevance_reason?: string | null
          llm_relevance_score?: number | null
          related_signal_count?: number | null
          research_completed?: boolean | null
          search_query?: string | null
          signals_from_app?: number | null
          updated_at?: string | null
          user_id?: string
          user_kept_selected?: boolean | null
          user_manually_added?: boolean | null
          was_auto_selected?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "app_discovery_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "research_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_discovery_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_packs: {
        Row: {
          badge_text: string | null
          created_at: string | null
          credits: number
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          lemonsqueezy_variant_id: string
          name: string
          price_cents: number
          updated_at: string | null
        }
        Insert: {
          badge_text?: string | null
          created_at?: string | null
          credits: number
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          lemonsqueezy_variant_id: string
          name: string
          price_cents: number
          updated_at?: string | null
        }
        Update: {
          badge_text?: string | null
          created_at?: string | null
          credits?: number
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          lemonsqueezy_variant_id?: string
          name?: string
          price_cents?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          balance_after: number | null
          created_at: string | null
          description: string | null
          id: string
          job_id: string | null
          reason: string | null
          reference_id: string | null
          transaction_type: string
          user_id: string | null
        }
        Insert: {
          amount: number
          balance_after?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          job_id?: string | null
          reason?: string | null
          reference_id?: string | null
          transaction_type: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          balance_after?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          job_id?: string | null
          reason?: string | null
          reference_id?: string | null
          transaction_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "research_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      data_export_requests: {
        Row: {
          completed_at: string | null
          created_at: string | null
          download_url: string | null
          error_message: string | null
          expires_at: string | null
          file_size_bytes: number | null
          id: string
          status: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          download_url?: string | null
          error_message?: string | null
          expires_at?: string | null
          file_size_bytes?: number | null
          id?: string
          status?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          download_url?: string | null
          error_message?: string | null
          expires_at?: string | null
          file_size_bytes?: number | null
          id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_export_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_reports: {
        Row: {
          created_at: string | null
          details: string | null
          id: string
          job_id: string | null
          problem_type: string
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          details?: string | null
          id?: string
          job_id?: string | null
          problem_type: string
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          details?: string | null
          id?: string
          job_id?: string | null
          problem_type?: string
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_reports_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "research_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string | null
          email_low_credits: boolean | null
          email_product_updates: boolean | null
          email_research_complete: boolean | null
          email_tips_and_tutorials: boolean | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_low_credits?: boolean | null
          email_product_updates?: boolean | null
          email_research_complete?: boolean | null
          email_tips_and_tutorials?: boolean | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_low_credits?: boolean | null
          email_product_updates?: boolean | null
          email_research_complete?: boolean | null
          email_tips_and_tutorials?: boolean | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      presearch_attempts: {
        Row: {
          converted_to_job_id: string | null
          created_at: string | null
          hypothesis: string
          id: string
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          converted_to_job_id?: string | null
          created_at?: string | null
          hypothesis: string
          id?: string
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          converted_to_job_id?: string | null
          created_at?: string | null
          hypothesis?: string
          id?: string
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "presearch_attempts_converted_to_job_id_fkey"
            columns: ["converted_to_job_id"]
            isOneToOne: false
            referencedRelation: "research_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cookie_consent_at: string | null
          created_at: string | null
          credits_balance: number | null
          email: string | null
          full_name: string | null
          id: string
          lemonsqueezy_customer_id: string | null
          privacy_policy_accepted_at: string | null
          total_credits_purchased: number | null
          total_research_runs: number | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          cookie_consent_at?: string | null
          created_at?: string | null
          credits_balance?: number | null
          email?: string | null
          full_name?: string | null
          id: string
          lemonsqueezy_customer_id?: string | null
          privacy_policy_accepted_at?: string | null
          total_credits_purchased?: number | null
          total_research_runs?: number | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          cookie_consent_at?: string | null
          created_at?: string | null
          credits_balance?: number | null
          email?: string | null
          full_name?: string | null
          id?: string
          lemonsqueezy_customer_id?: string | null
          privacy_policy_accepted_at?: string | null
          total_credits_purchased?: number | null
          total_research_runs?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount_cents: number
          completed_at: string | null
          created_at: string | null
          credit_pack_id: string | null
          credits_purchased: number
          id: string
          lemonsqueezy_customer_id: string | null
          lemonsqueezy_order_id: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          amount_cents: number
          completed_at?: string | null
          created_at?: string | null
          credit_pack_id?: string | null
          credits_purchased: number
          id?: string
          lemonsqueezy_customer_id?: string | null
          lemonsqueezy_order_id?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          completed_at?: string | null
          created_at?: string | null
          credit_pack_id?: string | null
          credits_purchased?: number
          id?: string
          lemonsqueezy_customer_id?: string | null
          lemonsqueezy_order_id?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_credit_pack_id_fkey"
            columns: ["credit_pack_id"]
            isOneToOne: false
            referencedRelation: "credit_packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reddit_cache: {
        Row: {
          cache_key: string | null
          comments: Json | null
          expires_at: string | null
          fetched_at: string | null
          id: string
          posts: Json
          search_query: string
          subreddit: string
        }
        Insert: {
          cache_key?: string | null
          comments?: Json | null
          expires_at?: string | null
          fetched_at?: string | null
          id?: string
          posts: Json
          search_query: string
          subreddit: string
        }
        Update: {
          cache_key?: string | null
          comments?: Json | null
          expires_at?: string | null
          fetched_at?: string | null
          id?: string
          posts?: Json
          search_query?: string
          subreddit?: string
        }
        Relationships: []
      }
      relevance_decisions: {
        Row: {
          batch_index: number
          body_preview: string | null
          content_type: string
          created_at: string | null
          decision: string
          id: string
          job_id: string
          reddit_id: string
          subreddit: string | null
          title: string | null
        }
        Insert: {
          batch_index: number
          body_preview?: string | null
          content_type: string
          created_at?: string | null
          decision: string
          id?: string
          job_id: string
          reddit_id: string
          subreddit?: string | null
          title?: string | null
        }
        Update: {
          batch_index?: number
          body_preview?: string | null
          content_type?: string
          created_at?: string | null
          decision?: string
          id?: string
          job_id?: string
          reddit_id?: string
          subreddit?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "relevance_decisions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "research_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      research_folders: {
        Row: {
          id: string
          user_id: string
          name: string
          color: string | null
          icon: string | null
          order_index: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          color?: string | null
          icon?: string | null
          order_index?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          color?: string | null
          icon?: string | null
          order_index?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "research_folders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      research_jobs: {
        Row: {
          chat_count: number | null
          competitors: Json | null
          coverage_data: Json | null
          created_at: string | null
          error_message: string | null
          error_source: string | null
          folder_id: string | null
          hypothesis: string
          id: string
          idempotency_key: string | null
          interview_guide: Json | null
          module_status: Json | null
          pain_signals: Json | null
          refunded_at: string | null
          status: string | null
          step_status: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          chat_count?: number | null
          competitors?: Json | null
          coverage_data?: Json | null
          created_at?: string | null
          error_message?: string | null
          error_source?: string | null
          folder_id?: string | null
          hypothesis: string
          id?: string
          idempotency_key?: string | null
          interview_guide?: Json | null
          module_status?: Json | null
          pain_signals?: Json | null
          refunded_at?: string | null
          status?: string | null
          step_status?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          chat_count?: number | null
          competitors?: Json | null
          coverage_data?: Json | null
          created_at?: string | null
          error_message?: string | null
          error_source?: string | null
          folder_id?: string | null
          hypothesis?: string
          id?: string
          idempotency_key?: string | null
          interview_guide?: Json | null
          module_status?: Json | null
          pain_signals?: Json | null
          refunded_at?: string | null
          status?: string | null
          step_status?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_jobs_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "research_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      research_results: {
        Row: {
          created_at: string | null
          data: Json
          id: string
          job_id: string | null
          module_name: string
        }
        Insert: {
          created_at?: string | null
          data: Json
          id?: string
          job_id?: string | null
          module_name: string
        }
        Update: {
          created_at?: string | null
          data?: Json
          id?: string
          job_id?: string | null
          module_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_results_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "research_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_credits: {
        Row: {
          created_at: string | null
          credits_remaining: number | null
          id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          credits_remaining?: number | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          credits_remaining?: number | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_bonus_credits: {
        Args: { p_credits: number; p_description: string; p_user_id: string }
        Returns: number
      }
      add_credits:
        | { Args: { p_credits: number; p_user_id: string }; Returns: undefined }
        | {
            Args: {
              p_credits: number
              p_purchase_id: string
              p_user_id: string
            }
            Returns: number
          }
      check_presearch_limit: {
        Args: { p_session_id: string; p_user_id: string }
        Returns: {
          attempt_count: number
          can_continue: boolean
        }[]
      }
      cleanup_expired_cache: { Args: never; Returns: number }
      cleanup_expired_reddit_cache: { Args: never; Returns: undefined }
      deduct_credit: {
        Args: { p_job_id: string; p_user_id: string }
        Returns: boolean
      }
      increment_chat_count: { Args: { p_job_id: string }; Returns: number }
      refund_credit: {
        Args: { p_job_id: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
