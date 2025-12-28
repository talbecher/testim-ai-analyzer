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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      analysis_reports: {
        Row: {
          accuracy_percentage: number | null
          common_mistakes: Json | null
          correct_count: number
          created_at: string
          id: string
          mode: string
          notes: string | null
          run_date: string
          run_name: string
          total_analyzed: number
          updated_at: string | null
        }
        Insert: {
          accuracy_percentage?: number | null
          common_mistakes?: Json | null
          correct_count?: number
          created_at?: string
          id?: string
          mode?: string
          notes?: string | null
          run_date: string
          run_name: string
          total_analyzed?: number
          updated_at?: string | null
        }
        Update: {
          accuracy_percentage?: number | null
          common_mistakes?: Json | null
          correct_count?: number
          created_at?: string
          id?: string
          mode?: string
          notes?: string | null
          run_date?: string
          run_name?: string
          total_analyzed?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      analysis_results: {
        Row: {
          ai_action: string | null
          ai_classification: string
          ai_confidence: number
          ai_priority: string
          bug_category: string | null
          bug_link: string | null
          created_at: string
          error_message: string | null
          error_pattern: string | null
          flaky_kb_matched: boolean | null
          id: string
          is_in_flaky_kb: boolean | null
          passed_locally: boolean | null
          passed_locally_notes: string | null
          passed_locally_reason: string | null
          report_id: string
          test_name: string
          test_name_normalized: string
          user_action: string | null
          user_classification: string | null
          user_notes: string | null
          user_priority: string | null
          was_correct: boolean | null
        }
        Insert: {
          ai_action?: string | null
          ai_classification: string
          ai_confidence: number
          ai_priority: string
          bug_category?: string | null
          bug_link?: string | null
          created_at?: string
          error_message?: string | null
          error_pattern?: string | null
          flaky_kb_matched?: boolean | null
          id?: string
          is_in_flaky_kb?: boolean | null
          passed_locally?: boolean | null
          passed_locally_notes?: string | null
          passed_locally_reason?: string | null
          report_id: string
          test_name: string
          test_name_normalized: string
          user_action?: string | null
          user_classification?: string | null
          user_notes?: string | null
          user_priority?: string | null
          was_correct?: boolean | null
        }
        Update: {
          ai_action?: string | null
          ai_classification?: string
          ai_confidence?: number
          ai_priority?: string
          bug_category?: string | null
          bug_link?: string | null
          created_at?: string
          error_message?: string | null
          error_pattern?: string | null
          flaky_kb_matched?: boolean | null
          id?: string
          is_in_flaky_kb?: boolean | null
          passed_locally?: boolean | null
          passed_locally_notes?: string | null
          passed_locally_reason?: string | null
          report_id?: string
          test_name?: string
          test_name_normalized?: string
          user_action?: string | null
          user_classification?: string | null
          user_notes?: string | null
          user_priority?: string | null
          was_correct?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "analysis_results_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "analysis_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      bug_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
