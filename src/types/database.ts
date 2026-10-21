export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string;
          description_en: string | null;
          description_sr: string | null;
          id: string;
          is_active: boolean;
          name_en: string;
          name_sr: string;
          slug: string;
          sort_order: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description_en?: string | null;
          description_sr?: string | null;
          id?: string;
          is_active?: boolean;
          name_en: string;
          name_sr: string;
          slug: string;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          description_en?: string | null;
          description_sr?: string | null;
          id?: string;
          is_active?: boolean;
          name_en?: string;
          name_sr?: string;
          slug?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          actor_id: string | null;
          created_at: string;
          id: string;
          is_read: boolean;
          recipient_id: string;
          ticket_id: string | null;
          type: Database["public"]["Enums"]["notification_type"];
        };
        ComputedFields: never;
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          recipient_id: string;
          ticket_id?: string | null;
          type: Database["public"]["Enums"]["notification_type"];
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          recipient_id?: string;
          ticket_id?: string | null;
          type?: Database["public"]["Enums"]["notification_type"];
        };
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profile_summaries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profile_summaries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          is_active: boolean;
          locale: string;
          role: Database["public"]["Enums"]["user_role"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email: string;
          full_name: string;
          id: string;
          is_active?: boolean;
          locale?: string;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          locale?: string;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Relationships: [];
      };
      ticket_comments: {
        Row: {
          author_id: string;
          body: string;
          created_at: string;
          id: string;
          is_internal: boolean;
          ticket_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          author_id: string;
          body: string;
          created_at?: string;
          id?: string;
          is_internal?: boolean;
          ticket_id: string;
          updated_at?: string;
        };
        Update: {
          author_id?: string;
          body?: string;
          created_at?: string;
          id?: string;
          is_internal?: boolean;
          ticket_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticket_comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profile_summaries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticket_comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticket_comments_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      ticket_history: {
        Row: {
          action: Database["public"]["Enums"]["history_action"];
          actor_id: string | null;
          created_at: string;
          id: string;
          new_value: Json | null;
          old_value: Json | null;
          ticket_id: string;
        };
        ComputedFields: never;
        Insert: {
          action: Database["public"]["Enums"]["history_action"];
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          new_value?: Json | null;
          old_value?: Json | null;
          ticket_id: string;
        };
        Update: {
          action?: Database["public"]["Enums"]["history_action"];
          actor_id?: string | null;
          created_at?: string;
          id?: string;
          new_value?: Json | null;
          old_value?: Json | null;
          ticket_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticket_history_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profile_summaries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticket_history_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticket_history_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      ticket_ratings: {
        Row: {
          comment: string | null;
          created_at: string;
          id: string;
          rated_by: string;
          score: number;
          ticket_id: string;
        };
        ComputedFields: never;
        Insert: {
          comment?: string | null;
          created_at?: string;
          id?: string;
          rated_by: string;
          score: number;
          ticket_id: string;
        };
        Update: {
          comment?: string | null;
          created_at?: string;
          id?: string;
          rated_by?: string;
          score?: number;
          ticket_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ticket_ratings_rated_by_fkey";
            columns: ["rated_by"];
            isOneToOne: false;
            referencedRelation: "profile_summaries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticket_ratings_rated_by_fkey";
            columns: ["rated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ticket_ratings_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: true;
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      tickets: {
        Row: {
          assigned_to: string | null;
          category_id: string;
          closed_at: string | null;
          created_at: string;
          created_by: string;
          description: string;
          first_response_at: string | null;
          id: string;
          number: number;
          priority: Database["public"]["Enums"]["ticket_priority"];
          resolved_at: string | null;
          search_vector: unknown;
          status: Database["public"]["Enums"]["ticket_status"];
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          assigned_to?: string | null;
          category_id: string;
          closed_at?: string | null;
          created_at?: string;
          created_by: string;
          description: string;
          first_response_at?: string | null;
          id?: string;
          number?: never;
          priority?: Database["public"]["Enums"]["ticket_priority"];
          resolved_at?: string | null;
          search_vector?: never;
          status?: Database["public"]["Enums"]["ticket_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          assigned_to?: string | null;
          category_id?: string;
          closed_at?: string | null;
          created_at?: string;
          created_by?: string;
          description?: string;
          first_response_at?: string | null;
          id?: string;
          number?: never;
          priority?: Database["public"]["Enums"]["ticket_priority"];
          resolved_at?: string | null;
          search_vector?: never;
          status?: Database["public"]["Enums"]["ticket_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tickets_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "profile_summaries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tickets_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tickets_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tickets_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profile_summaries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tickets_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      profile_summaries: {
        Row: {
          avatar_url: string | null;
          full_name: string | null;
          id: string | null;
          role: Database["public"]["Enums"]["user_role"] | null;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          full_name?: string | null;
          id?: string | null;
          role?: Database["public"]["Enums"]["user_role"] | null;
        };
        Update: {
          avatar_url?: string | null;
          full_name?: string | null;
          id?: string | null;
          role?: Database["public"]["Enums"]["user_role"] | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      add_comment: {
        Args: { p_body: string; p_is_internal?: boolean; p_ticket_id: string };
        Returns: {
          author_id: string;
          body: string;
          created_at: string;
          id: string;
          is_internal: boolean;
          ticket_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "ticket_comments";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      admin_update_user: {
        Args: {
          p_is_active?: boolean;
          p_role?: Database["public"]["Enums"]["user_role"];
          p_user_id: string;
        };
        Returns: {
          avatar_url: string | null;
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          is_active: boolean;
          locale: string;
          role: Database["public"]["Enums"]["user_role"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "profiles";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      agent_dashboard_stats: {
        Args: Record<PropertyKey, never>;
        Returns: {
          avg_rating: number;
          rating_count: number;
          resolved_count: number;
        }[];
      };
      assign_ticket: {
        Args: { p_assignee_id?: string; p_ticket_id: string };
        Returns: {
          assigned_to: string | null;
          category_id: string;
          closed_at: string | null;
          created_at: string;
          created_by: string;
          description: string;
          first_response_at: string | null;
          id: string;
          number: number;
          priority: Database["public"]["Enums"]["ticket_priority"];
          resolved_at: string | null;
          search_vector: unknown;
          status: Database["public"]["Enums"]["ticket_status"];
          title: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "tickets";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      can_access_realtime_topic: { Args: { p_topic: string }; Returns: boolean };
      can_view_ticket: { Args: { p_ticket_id: string }; Returns: boolean };
      change_ticket_status: {
        Args: { p_new_status: Database["public"]["Enums"]["ticket_status"]; p_ticket_id: string };
        Returns: {
          assigned_to: string | null;
          category_id: string;
          closed_at: string | null;
          created_at: string;
          created_by: string;
          description: string;
          first_response_at: string | null;
          id: string;
          number: number;
          priority: Database["public"]["Enums"]["ticket_priority"];
          resolved_at: string | null;
          search_vector: unknown;
          status: Database["public"]["Enums"]["ticket_status"];
          title: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "tickets";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_ticket: {
        Args: {
          p_category_id: string;
          p_description: string;
          p_priority?: Database["public"]["Enums"]["ticket_priority"];
          p_title: string;
        };
        Returns: {
          assigned_to: string | null;
          category_id: string;
          closed_at: string | null;
          created_at: string;
          created_by: string;
          description: string;
          first_response_at: string | null;
          id: string;
          number: number;
          priority: Database["public"]["Enums"]["ticket_priority"];
          resolved_at: string | null;
          search_vector: unknown;
          status: Database["public"]["Enums"]["ticket_status"];
          title: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "tickets";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      current_user_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["user_role"];
      };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_staff: { Args: Record<PropertyKey, never>; Returns: boolean };
      rate_ticket: {
        Args: { p_comment?: string; p_score: number; p_ticket_id: string };
        Returns: {
          comment: string | null;
          created_at: string;
          id: string;
          rated_by: string;
          score: number;
          ticket_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "ticket_ratings";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      ticket_counts: {
        Args: Record<PropertyKey, never>;
        Returns: {
          assignment: string;
          priority: Database["public"]["Enums"]["ticket_priority"];
          status: Database["public"]["Enums"]["ticket_status"];
          total: number;
        }[];
      };
      update_ticket: {
        Args: {
          p_category_id?: string;
          p_description?: string;
          p_priority?: Database["public"]["Enums"]["ticket_priority"];
          p_ticket_id: string;
          p_title?: string;
        };
        Returns: {
          assigned_to: string | null;
          category_id: string;
          closed_at: string | null;
          created_at: string;
          created_by: string;
          description: string;
          first_response_at: string | null;
          id: string;
          number: number;
          priority: Database["public"]["Enums"]["ticket_priority"];
          resolved_at: string | null;
          search_vector: unknown;
          status: Database["public"]["Enums"]["ticket_status"];
          title: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "tickets";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      history_action:
        | "created"
        | "status_changed"
        | "assigned"
        | "unassigned"
        | "priority_changed"
        | "category_changed"
        | "updated"
        | "rated";
      notification_type:
        | "ticket_created"
        | "ticket_assigned"
        | "status_changed"
        | "comment_added"
        | "internal_comment_added"
        | "ticket_rated";
      ticket_priority: "low" | "medium" | "high" | "urgent";
      ticket_status: "open" | "in_progress" | "waiting_on_customer" | "resolved" | "closed";
      user_role: "customer" | "agent" | "admin";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      history_action: [
        "created",
        "status_changed",
        "assigned",
        "unassigned",
        "priority_changed",
        "category_changed",
        "updated",
        "rated",
      ],
      notification_type: [
        "ticket_created",
        "ticket_assigned",
        "status_changed",
        "comment_added",
        "internal_comment_added",
        "ticket_rated",
      ],
      ticket_priority: ["low", "medium", "high", "urgent"],
      ticket_status: ["open", "in_progress", "waiting_on_customer", "resolved", "closed"],
      user_role: ["customer", "agent", "admin"],
    },
  },
} as const;
