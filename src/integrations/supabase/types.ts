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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          target: string | null
          tenant_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target?: string | null
          tenant_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cv_logs: {
        Row: {
          accent_color: string | null
          analysis: Json | null
          created_at: string
          id: string
          input: Json
          output: Json
          pdf_storage_path: string | null
          template: string
          tenant_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          accent_color?: string | null
          analysis?: Json | null
          created_at?: string
          id?: string
          input: Json
          output: Json
          pdf_storage_path?: string | null
          template?: string
          tenant_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          accent_color?: string | null
          analysis?: Json | null
          created_at?: string
          id?: string
          input?: Json
          output?: Json
          pdf_storage_path?: string | null
          template?: string
          tenant_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cv_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      job_listings: {
        Row: {
          company: string
          company_logo: string | null
          country: string | null
          created_at: string
          description: string | null
          employment_type: string | null
          external_url: string | null
          id: string
          industry: string | null
          location: string | null
          posted_at: string | null
          seniority: string | null
          skills: string[] | null
          source: string | null
          title: string
        }
        Insert: {
          company: string
          company_logo?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          employment_type?: string | null
          external_url?: string | null
          id?: string
          industry?: string | null
          location?: string | null
          posted_at?: string | null
          seniority?: string | null
          skills?: string[] | null
          source?: string | null
          title: string
        }
        Update: {
          company?: string
          company_logo?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          employment_type?: string | null
          external_url?: string | null
          id?: string
          industry?: string | null
          location?: string | null
          posted_at?: string | null
          seniority?: string | null
          skills?: string[] | null
          source?: string | null
          title?: string
        }
        Relationships: []
      }
      job_matches: {
        Row: {
          created_at: string
          id: string
          job_id: string
          reasoning: string | null
          score: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          reasoning?: string | null
          score: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          reasoning?: string | null
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_matches_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          metadata: Json
          read_at: string | null
          tenant_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json
          read_at?: string | null
          tenant_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json
          read_at?: string | null
          tenant_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          account_name: string | null
          account_number: string
          bank_name: string | null
          created_at: string
          id: string
          instructions: string | null
          is_active: boolean
          label: string
          sort_order: number
          tenant_id: string
          type: string
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          account_number: string
          bank_name?: string | null
          created_at?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          label: string
          sort_order?: number
          tenant_id: string
          type: string
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          account_number?: string
          bank_name?: string | null
          created_at?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          label?: string
          sort_order?: number
          tenant_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          credits: number
          email: string
          full_name: string | null
          id: string
          is_blocked: boolean
          locale: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          credits?: number
          email: string
          full_name?: string | null
          id: string
          is_blocked?: boolean
          locale?: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          credits?: number
          email?: string
          full_name?: string | null
          id?: string
          is_blocked?: boolean
          locale?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan: Database["public"]["Enums"]["plan_tier"]
          status: Database["public"]["Enums"]["sub_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          status?: Database["public"]["Enums"]["sub_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          status?: Database["public"]["Enums"]["sub_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          currency: string
          cv_credit_cost: number
          id: string
          industry: string | null
          logo_url: string | null
          match_credit_cost: number
          name: string
          plan_price_business: number
          plan_price_free: number
          plan_price_pro: number
          primary_color: string | null
          scrape_credit_cost: number
          slug: string
        }
        Insert: {
          created_at?: string
          currency?: string
          cv_credit_cost?: number
          id?: string
          industry?: string | null
          logo_url?: string | null
          match_credit_cost?: number
          name: string
          plan_price_business?: number
          plan_price_free?: number
          plan_price_pro?: number
          primary_color?: string | null
          scrape_credit_cost?: number
          slug: string
        }
        Update: {
          created_at?: string
          currency?: string
          cv_credit_cost?: number
          id?: string
          industry?: string | null
          logo_url?: string | null
          match_credit_cost?: number
          name?: string
          plan_price_business?: number
          plan_price_free?: number
          plan_price_pro?: number
          primary_color?: string | null
          scrape_credit_cost?: number
          slug?: string
        }
        Relationships: []
      }
      topup_requests: {
        Row: {
          admin_note: string | null
          amount_egp: number
          created_at: string
          credits_requested: number
          id: string
          payment_method_id: string | null
          reference_number: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          screenshot_path: string
          status: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount_egp: number
          created_at?: string
          credits_requested: number
          id?: string
          payment_method_id?: string | null
          reference_number?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          screenshot_path: string
          status?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount_egp?: number
          created_at?: string
          credits_requested?: number
          id?: string
          payment_method_id?: string | null
          reference_number?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          screenshot_path?: string
          status?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topup_requests_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topup_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_events: {
        Row: {
          action_type: string
          created_at: string
          id: string
          metadata: Json | null
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          metadata?: Json | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_quotas: {
        Row: {
          cv_generations_used: number
          id: string
          period_month: string
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cv_generations_used?: number
          id?: string
          period_month: string
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cv_generations_used?: number
          id?: string
          period_month?: string
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_quotas_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_settings: {
        Row: {
          credits_per_egp: number
          instructions: string | null
          tenant_id: string
          updated_at: string
          vodafone_number: string | null
        }
        Insert: {
          credits_per_egp?: number
          instructions?: string | null
          tenant_id: string
          updated_at?: string
          vodafone_number?: string | null
        }
        Update: {
          credits_per_egp?: number
          instructions?: string | null
          tenant_id?: string
          updated_at?: string
          vodafone_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_review_topup: {
        Args: { _approve: boolean; _note?: string; _request_id: string }
        Returns: undefined
      }
      admin_update_pricing:
        | {
            Args: {
              _cv_cost?: number
              _match_cost?: number
              _scrape_cost?: number
            }
            Returns: undefined
          }
        | {
            Args: {
              _currency?: string
              _cv_cost?: number
              _match_cost?: number
              _plan_business?: number
              _plan_free?: number
              _plan_pro?: number
              _scrape_cost?: number
            }
            Returns: undefined
          }
      admin_update_user: {
        Args: {
          _credits?: number
          _grant_admin?: boolean
          _is_blocked?: boolean
          _target_user: string
        }
        Returns: undefined
      }
      get_user_tenant: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_superadmin: { Args: { _user_id: string }; Returns: boolean }
      is_tenant_admin: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      push_notification: {
        Args: {
          _body?: string
          _link?: string
          _metadata?: Json
          _title: string
          _type: string
          _user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "superadmin" | "company_admin" | "user"
      plan_tier: "free" | "pro" | "business"
      sub_status: "active" | "trialing" | "past_due" | "canceled" | "incomplete"
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
    Enums: {
      app_role: ["superadmin", "company_admin", "user"],
      plan_tier: ["free", "pro", "business"],
      sub_status: ["active", "trialing", "past_due", "canceled", "incomplete"],
    },
  },
} as const
