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
      spaces: {
        Row: {
          id: string;
          created_at: string;
          name: string;
          emoji: string;
          destination: string | null;
          color: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          name: string;
          emoji?: string;
          destination?: string | null;
          color?: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          name?: string;
          emoji?: string;
          destination?: string | null;
          color?: string;
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
        };
        Insert: {
          id?: string;
          created_at?: string;
          title: string;
          url?: string | null;
          notes?: string | null;
          space_id: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          title?: string;
          url?: string | null;
          notes?: string | null;
          space_id?: string;
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

export type Space = Database['public']['Tables']['spaces']['Row'];
export type SpaceInsert = Database['public']['Tables']['spaces']['Insert'];
export type Inspiration = Database['public']['Tables']['inspiration']['Row'];
export type InspirationInsert = Database['public']['Tables']['inspiration']['Insert'];
