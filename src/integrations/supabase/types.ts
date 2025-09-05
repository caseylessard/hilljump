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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      crypto_alerts: {
        Row: {
          atr_pct: number | null
          change_24h_pct: number | null
          entry_price: number | null
          id: string
          likelihood_of_win: number | null
          news_recent_count: number | null
          pick_date: string
          picked_at: string
          price: number | null
          rank_order: number
          rel_vol: number | null
          source: string | null
          stop_price: number | null
          symbol: string
          target_growth_pct: number | null
          tp1_price: number | null
          tp2_price: number | null
          yday_high: number | null
          yday_low: number | null
        }
        Insert: {
          atr_pct?: number | null
          change_24h_pct?: number | null
          entry_price?: number | null
          id?: string
          likelihood_of_win?: number | null
          news_recent_count?: number | null
          pick_date?: string
          picked_at?: string
          price?: number | null
          rank_order: number
          rel_vol?: number | null
          source?: string | null
          stop_price?: number | null
          symbol: string
          target_growth_pct?: number | null
          tp1_price?: number | null
          tp2_price?: number | null
          yday_high?: number | null
          yday_low?: number | null
        }
        Update: {
          atr_pct?: number | null
          change_24h_pct?: number | null
          entry_price?: number | null
          id?: string
          likelihood_of_win?: number | null
          news_recent_count?: number | null
          pick_date?: string
          picked_at?: string
          price?: number | null
          rank_order?: number
          rel_vol?: number | null
          source?: string | null
          stop_price?: number | null
          symbol?: string
          target_growth_pct?: number | null
          tp1_price?: number | null
          tp2_price?: number | null
          yday_high?: number | null
          yday_low?: number | null
        }
        Relationships: []
      }
      crypto_universe: {
        Row: {
          atr_pct: number | null
          change_24h_pct: number | null
          created_at: string
          filter_date: string
          filtered_at: string
          id: string
          momentum_score: number | null
          price: number | null
          rank_order: number
          symbol: string
          volume_usd: number | null
        }
        Insert: {
          atr_pct?: number | null
          change_24h_pct?: number | null
          created_at?: string
          filter_date?: string
          filtered_at?: string
          id?: string
          momentum_score?: number | null
          price?: number | null
          rank_order: number
          symbol: string
          volume_usd?: number | null
        }
        Update: {
          atr_pct?: number | null
          change_24h_pct?: number | null
          created_at?: string
          filter_date?: string
          filtered_at?: string
          id?: string
          momentum_score?: number | null
          price?: number | null
          rank_order?: number
          symbol?: string
          volume_usd?: number | null
        }
        Relationships: []
      }
      daily_update_logs: {
        Row: {
          created_at: string | null
          end_time: string | null
          error_message: string | null
          id: string
          run_date: string | null
          start_time: string | null
          status: string | null
          total_etfs: number | null
          updated_etfs: number | null
        }
        Insert: {
          created_at?: string | null
          end_time?: string | null
          error_message?: string | null
          id?: string
          run_date?: string | null
          start_time?: string | null
          status?: string | null
          total_etfs?: number | null
          updated_etfs?: number | null
        }
        Update: {
          created_at?: string | null
          end_time?: string | null
          error_message?: string | null
          id?: string
          run_date?: string | null
          start_time?: string | null
          status?: string | null
          total_etfs?: number | null
          updated_etfs?: number | null
        }
        Relationships: []
      }
      dividend_update_logs: {
        Row: {
          created_at: string
          end_time: string | null
          error_message: string | null
          id: string
          inserted_events: number | null
          start_time: string
          status: string
          total_etfs: number | null
          updated_etfs: number | null
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          error_message?: string | null
          id?: string
          inserted_events?: number | null
          start_time?: string
          status?: string
          total_etfs?: number | null
          updated_etfs?: number | null
        }
        Update: {
          created_at?: string
          end_time?: string | null
          error_message?: string | null
          id?: string
          inserted_events?: number | null
          start_time?: string
          status?: string
          total_etfs?: number | null
          updated_etfs?: number | null
        }
        Relationships: []
      }
      dividends: {
        Row: {
          amount: number
          cadence: string | null
          cash_currency: string
          created_at: string
          etf_id: string | null
          ex_date: string
          id: string
          pay_date: string | null
          ticker: string
        }
        Insert: {
          amount: number
          cadence?: string | null
          cash_currency?: string
          created_at?: string
          etf_id?: string | null
          ex_date: string
          id?: string
          pay_date?: string | null
          ticker: string
        }
        Update: {
          amount?: number
          cadence?: string | null
          cash_currency?: string
          created_at?: string
          etf_id?: string | null
          ex_date?: string
          id?: string
          pay_date?: string | null
          ticker?: string
        }
        Relationships: [
          {
            foreignKeyName: "dividends_etf_id_fkey"
            columns: ["etf_id"]
            isOneToOne: false
            referencedRelation: "etfs"
            referencedColumns: ["id"]
          },
        ]
      }
      drip_cache_ca: {
        Row: {
          created_at: string
          id: string
          period_13w: Json | null
          period_26w: Json | null
          period_4w: Json | null
          period_52w: Json | null
          ticker: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          period_13w?: Json | null
          period_26w?: Json | null
          period_4w?: Json | null
          period_52w?: Json | null
          ticker: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          period_13w?: Json | null
          period_26w?: Json | null
          period_4w?: Json | null
          period_52w?: Json | null
          ticker?: string
          updated_at?: string
        }
        Relationships: []
      }
      drip_cache_us: {
        Row: {
          created_at: string
          id: string
          period_13w: Json | null
          period_26w: Json | null
          period_4w: Json | null
          period_52w: Json | null
          ticker: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          period_13w?: Json | null
          period_26w?: Json | null
          period_4w?: Json | null
          period_52w?: Json | null
          ticker: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          period_13w?: Json | null
          period_26w?: Json | null
          period_4w?: Json | null
          period_52w?: Json | null
          ticker?: string
          updated_at?: string
        }
        Relationships: []
      }
      equity_alerts: {
        Row: {
          atr_pct: number | null
          entry_price: number | null
          exchange: string | null
          float_shares: number | null
          id: string
          likelihood_of_win: number | null
          news_recent_count: number | null
          pick_date: string
          picked_at: string
          premarket_change_pct: number | null
          price: number | null
          rank_order: number
          rel_vol: number | null
          source: string | null
          stop_price: number | null
          target_growth_pct: number | null
          ticker: string
          tp1_price: number | null
          tp2_price: number | null
          yday_high: number | null
          yday_low: number | null
        }
        Insert: {
          atr_pct?: number | null
          entry_price?: number | null
          exchange?: string | null
          float_shares?: number | null
          id?: string
          likelihood_of_win?: number | null
          news_recent_count?: number | null
          pick_date?: string
          picked_at?: string
          premarket_change_pct?: number | null
          price?: number | null
          rank_order: number
          rel_vol?: number | null
          source?: string | null
          stop_price?: number | null
          target_growth_pct?: number | null
          ticker: string
          tp1_price?: number | null
          tp2_price?: number | null
          yday_high?: number | null
          yday_low?: number | null
        }
        Update: {
          atr_pct?: number | null
          entry_price?: number | null
          exchange?: string | null
          float_shares?: number | null
          id?: string
          likelihood_of_win?: number | null
          news_recent_count?: number | null
          pick_date?: string
          picked_at?: string
          premarket_change_pct?: number | null
          price?: number | null
          rank_order?: number
          rel_vol?: number | null
          source?: string | null
          stop_price?: number | null
          target_growth_pct?: number | null
          ticker?: string
          tp1_price?: number | null
          tp2_price?: number | null
          yday_high?: number | null
          yday_low?: number | null
        }
        Relationships: []
      }
      equity_universe: {
        Row: {
          avg_dollar_volume: number | null
          created_at: string
          exchange: string | null
          filter_date: string
          filtered_at: string
          float_shares: number | null
          id: string
          market_cap: number | null
          price: number | null
          rank_order: number
          ticker: string
        }
        Insert: {
          avg_dollar_volume?: number | null
          created_at?: string
          exchange?: string | null
          filter_date?: string
          filtered_at?: string
          float_shares?: number | null
          id?: string
          market_cap?: number | null
          price?: number | null
          rank_order: number
          ticker: string
        }
        Update: {
          avg_dollar_volume?: number | null
          created_at?: string
          exchange?: string | null
          filter_date?: string
          filtered_at?: string
          float_shares?: number | null
          id?: string
          market_cap?: number | null
          price?: number | null
          rank_order?: number
          ticker?: string
        }
        Relationships: []
      }
      etf_rankings: {
        Row: {
          composite_score: number
          created_at: string
          id: string
          rank_position: number
          ticker: string
          updated_at: string
          week_date: string
        }
        Insert: {
          composite_score: number
          created_at?: string
          id?: string
          rank_position: number
          ticker: string
          updated_at?: string
          week_date?: string
        }
        Update: {
          composite_score?: number
          created_at?: string
          id?: string
          rank_position?: number
          ticker?: string
          updated_at?: string
          week_date?: string
        }
        Relationships: []
      }
      etf_scores: {
        Row: {
          composite_score: number | null
          country: string | null
          created_at: string
          id: string
          return_score: number | null
          risk_score: number | null
          ticker: string
          updated_at: string
          weights: Json | null
          yield_score: number | null
        }
        Insert: {
          composite_score?: number | null
          country?: string | null
          created_at?: string
          id?: string
          return_score?: number | null
          risk_score?: number | null
          ticker: string
          updated_at?: string
          weights?: Json | null
          yield_score?: number | null
        }
        Update: {
          composite_score?: number | null
          country?: string | null
          created_at?: string
          id?: string
          return_score?: number | null
          risk_score?: number | null
          ticker?: string
          updated_at?: string
          weights?: Json | null
          yield_score?: number | null
        }
        Relationships: []
      }
      etfs: {
        Row: {
          active: boolean | null
          aum: number | null
          avg_volume: number | null
          category: string | null
          country: string | null
          currency: string | null
          current_price: number | null
          data_source: string | null
          distribution_frequency: string | null
          eodhd_symbol: string | null
          exchange: string
          expense_ratio: number
          fund: string | null
          id: string
          industry: string | null
          logo_key: string | null
          manager: string | null
          max_drawdown_1y: number
          name: string
          polygon_supported: boolean | null
          price_updated_at: string | null
          provider_group: string | null
          strategy: string | null
          strategy_label: string | null
          summary: string | null
          ticker: string
          total_return_1y: number | null
          twelve_symbol: string | null
          underlying: string | null
          updated_at: string | null
          volatility_1y: number
          yield_ttm: number | null
        }
        Insert: {
          active?: boolean | null
          aum?: number | null
          avg_volume?: number | null
          category?: string | null
          country?: string | null
          currency?: string | null
          current_price?: number | null
          data_source?: string | null
          distribution_frequency?: string | null
          eodhd_symbol?: string | null
          exchange: string
          expense_ratio: number
          fund?: string | null
          id?: string
          industry?: string | null
          logo_key?: string | null
          manager?: string | null
          max_drawdown_1y: number
          name: string
          polygon_supported?: boolean | null
          price_updated_at?: string | null
          provider_group?: string | null
          strategy?: string | null
          strategy_label?: string | null
          summary?: string | null
          ticker: string
          total_return_1y?: number | null
          twelve_symbol?: string | null
          underlying?: string | null
          updated_at?: string | null
          volatility_1y: number
          yield_ttm?: number | null
        }
        Update: {
          active?: boolean | null
          aum?: number | null
          avg_volume?: number | null
          category?: string | null
          country?: string | null
          currency?: string | null
          current_price?: number | null
          data_source?: string | null
          distribution_frequency?: string | null
          eodhd_symbol?: string | null
          exchange?: string
          expense_ratio?: number
          fund?: string | null
          id?: string
          industry?: string | null
          logo_key?: string | null
          manager?: string | null
          max_drawdown_1y?: number
          name?: string
          polygon_supported?: boolean | null
          price_updated_at?: string | null
          provider_group?: string | null
          strategy?: string | null
          strategy_label?: string | null
          summary?: string | null
          ticker?: string
          total_return_1y?: number | null
          twelve_symbol?: string | null
          underlying?: string | null
          updated_at?: string | null
          volatility_1y?: number
          yield_ttm?: number | null
        }
        Relationships: []
      }
      historical_prices: {
        Row: {
          adjusted_close: number | null
          close_price: number
          created_at: string
          date: string
          high_price: number | null
          id: string
          low_price: number | null
          open_price: number | null
          ticker: string
          updated_at: string
          volume: number | null
        }
        Insert: {
          adjusted_close?: number | null
          close_price: number
          created_at?: string
          date: string
          high_price?: number | null
          id?: string
          low_price?: number | null
          open_price?: number | null
          ticker: string
          updated_at?: string
          volume?: number | null
        }
        Update: {
          adjusted_close?: number | null
          close_price?: number
          created_at?: string
          date?: string
          high_price?: number | null
          id?: string
          low_price?: number | null
          open_price?: number | null
          ticker?: string
          updated_at?: string
          volume?: number | null
        }
        Relationships: []
      }
      portfolio_positions: {
        Row: {
          created_at: string
          id: string
          shares: number
          ticker: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          shares: number
          ticker: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          shares?: number
          ticker?: string
          user_id?: string
        }
        Relationships: []
      }
      price_cache: {
        Row: {
          created_at: string
          id: string
          price: number
          source: string
          ticker: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          price: number
          source: string
          ticker: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          price?: number
          source?: string
          ticker?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved: boolean
          country: string
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          approved?: boolean
          country?: string
          created_at?: string
          first_name?: string | null
          id: string
          last_name?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          approved?: boolean
          country?: string
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      security_recommendations: {
        Row: {
          created_at: string | null
          id: string
          recommendation: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          recommendation: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          recommendation?: string
          status?: string | null
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          stripe_customer_id: string | null
          subscribed: boolean
          subscription_end: string | null
          subscription_tier: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          stripe_customer_id?: string | null
          subscribed?: boolean
          subscription_end?: string | null
          subscription_tier?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string
          dividend_stability: number
          home_country_bias: number
          period_4w_weight: number
          period_52w_weight: number
          return_weight: number
          risk_weight: number
          tax_country: string
          tax_enabled: boolean
          tax_rate: number
          updated_at: string
          user_id: string
          yield_weight: number
        }
        Insert: {
          created_at?: string
          dividend_stability?: number
          home_country_bias?: number
          period_4w_weight?: number
          period_52w_weight?: number
          return_weight?: number
          risk_weight?: number
          tax_country?: string
          tax_enabled?: boolean
          tax_rate?: number
          updated_at?: string
          user_id: string
          yield_weight?: number
        }
        Update: {
          created_at?: string
          dividend_stability?: number
          home_country_bias?: number
          period_4w_weight?: number
          period_52w_weight?: number
          return_weight?: number
          risk_weight?: number
          tax_country?: string
          tax_enabled?: boolean
          tax_rate?: number
          updated_at?: string
          user_id?: string
          yield_weight?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_security_event: {
        Args: { details?: Json; event_type: string; user_id?: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "premium" | "subscriber" | "user"
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
      app_role: ["admin", "premium", "subscriber", "user"],
    },
  },
} as const
