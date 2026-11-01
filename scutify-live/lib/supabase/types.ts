/**
 * Types de la base, au format `supabase gen types typescript`.
 * À régénérer si le schéma change :
 *   npx supabase gen types typescript --project-id <ref> --schema public > lib/supabase/types.ts
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          pseudo: string;
          email: string | null;
          role: "viewer" | "admin";
          muted_until: string | null;
          banned: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          pseudo: string;
          email?: string | null;
          role?: "viewer" | "admin";
          muted_until?: string | null;
          banned?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          pseudo?: string;
          email?: string | null;
          role?: "viewer" | "admin";
          muted_until?: string | null;
          banned?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          user_id: string;
          pseudo: string;
          content: string;
          status: "visible" | "shadow" | "deleted";
          is_team: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          pseudo: string;
          content: string;
          status?: "visible" | "shadow" | "deleted";
          is_team?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          pseudo?: string;
          content?: string;
          status?: "visible" | "shadow" | "deleted";
          is_team?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_settings: {
        Row: {
          id: number;
          chat_enabled: boolean;
          slow_mode_seconds: number;
          links_allowed: boolean;
          pinned_message: string | null;
          pinned_url: string | null;
          pinned_label: string | null;
          broadcast_interval_seconds: number;
          custom_html: string | null;
          custom_html_updated_at: string | null;
          ip_message_limit: number;
          ip_profile_limit: number;
          quick_replies: string[] | null;
          quick_replies_until: string | null;
          updated_at: string;
        };
        Insert: {
          id?: number;
          chat_enabled?: boolean;
          slow_mode_seconds?: number;
          links_allowed?: boolean;
          pinned_message?: string | null;
          pinned_url?: string | null;
          pinned_label?: string | null;
          broadcast_interval_seconds?: number;
          custom_html?: string | null;
          custom_html_updated_at?: string | null;
          ip_message_limit?: number;
          ip_profile_limit?: number;
          quick_replies?: string[] | null;
          quick_replies_until?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: number;
          chat_enabled?: boolean;
          slow_mode_seconds?: number;
          links_allowed?: boolean;
          pinned_message?: string | null;
          pinned_url?: string | null;
          pinned_label?: string | null;
          broadcast_interval_seconds?: number;
          custom_html?: string | null;
          custom_html_updated_at?: string | null;
          ip_message_limit?: number;
          ip_profile_limit?: number;
          quick_replies?: string[] | null;
          quick_replies_until?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      blocked_keywords: {
        Row: { id: number; keyword: string; created_at: string };
        Insert: { id?: never; keyword: string; created_at?: string };
        Update: { id?: never; keyword?: string; created_at?: string };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      set_profile: { Args: { pseudo: string; email?: string | null }; Returns: Json };
      send_message: { Args: { content: string }; Returns: Json };
      admin_set_message_status: { Args: { message_id: string; status: string }; Returns: undefined };
      admin_mute_user: { Args: { user_id: string; minutes: number | null }; Returns: string | null };
      admin_ban_user: { Args: { user_id: string; banned: boolean }; Returns: undefined };
      admin_clear_chat: { Args: Record<PropertyKey, never>; Returns: number };
      admin_set_quick_replies: { Args: { replies: string[]; seconds: number }; Returns: string | null };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
