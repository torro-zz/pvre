export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
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
          pain_signals?: Json
          competitors?: Json
          interview_guide?: Json | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
