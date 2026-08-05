/**
 * Supabase schema types.
 * Regenerate when the schema changes:
 * npx supabase gen types typescript --project-id <id> > types/database.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string | null;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
        };
        Insert: {
          id: string;
          created_at?: string;
          updated_at?: string | null;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string | null;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
        };
        Relationships: [];
      };
      spaces: {
        Row: {
          id: string;
          created_at: string;
          name: string;
          emoji: string;
          destination: string | null;
          color: string;
          owner_id: string | null;
          description: string | null;
          start_date: string | null;
          end_date: string | null;
          airport: string | null;
          lodging: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          name: string;
          emoji?: string;
          destination?: string | null;
          color?: string;
          owner_id: string;
          description?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          airport?: string | null;
          lodging?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          name?: string;
          emoji?: string;
          destination?: string | null;
          color?: string;
          owner_id?: string | null;
          description?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          airport?: string | null;
          lodging?: string | null;
        };
        Relationships: [];
      };
      space_members: {
        Row: {
          id: string;
          created_at: string;
          space_id: string;
          user_id: string;
          role: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          space_id: string;
          user_id: string;
          role: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          space_id?: string;
          user_id?: string;
          role?: string;
        };
        Relationships: [];
      };
      inspiration: {
        Row: {
          id: string;
          created_at: string;
          title: string;
          url: string | null;
          notes: string | null;
          space_id: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          title: string;
          url?: string | null;
          notes?: string | null;
          space_id: string;
          created_by: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          title?: string;
          url?: string | null;
          notes?: string | null;
          space_id?: string;
          created_by?: string | null;
        };
        Relationships: [];
      };
      places: {
        Row: {
          id: string;
          created_at: string;
          name: string;
          address: string | null;
          city: string | null;
          country: string | null;
          latitude: number | null;
          longitude: number | null;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          name: string;
          address?: string | null;
          city?: string | null;
          country?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          name?: string;
          address?: string | null;
          city?: string | null;
          country?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          created_by?: string | null;
        };
        Relationships: [];
      };
      saved_places: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          place_id: string;
          space_id: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          user_id: string;
          place_id: string;
          space_id?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          user_id?: string;
          place_id?: string;
          space_id?: string | null;
          notes?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Space = Database['public']['Tables']['spaces']['Row'];
export type SpaceInsert = Database['public']['Tables']['spaces']['Insert'];
export type SpaceMember = Database['public']['Tables']['space_members']['Row'];
export type SpaceMemberInsert = Database['public']['Tables']['space_members']['Insert'];
export type Inspiration = Database['public']['Tables']['inspiration']['Row'];
export type InspirationInsert = Database['public']['Tables']['inspiration']['Insert'];
export type Place = Database['public']['Tables']['places']['Row'];
export type SavedPlace = Database['public']['Tables']['saved_places']['Row'];
