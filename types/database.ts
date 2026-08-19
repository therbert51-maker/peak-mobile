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

export type ExpenseReceiptStatus =
  | 'manual'
  | 'uploaded'
  | 'processing'
  | 'needs_review'
  | 'ready'
  | 'failed';

export type ExpenseShareType = 'equal' | 'quantity' | 'percentage' | 'fixed';

export type SettlementStatus = 'pending' | 'paid' | 'cancelled';

export type ReceiptProcessingJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

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
          first_name: string | null;
          last_name: string | null;
          display_name: string | null;
          avatar_url: string | null;
          preferred_currency: string;
        };
        Insert: {
          id: string;
          created_at?: string;
          updated_at?: string | null;
          email?: string | null;
          full_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          preferred_currency?: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string | null;
          email?: string | null;
          full_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          preferred_currency?: string;
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
          normalized_url: string | null;
          preview_title: string | null;
          preview_description: string | null;
          preview_image_url: string | null;
          preview_source: string | null;
          preview_kind: 'video' | 'image' | 'article' | 'website' | null;
          preview_status: 'pending' | 'processing' | 'ready' | 'failed' | 'skipped';
          preview_fetched_at: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          title: string;
          url?: string | null;
          notes?: string | null;
          space_id: string;
          created_by: string;
          normalized_url?: string | null;
          preview_title?: string | null;
          preview_description?: string | null;
          preview_image_url?: string | null;
          preview_source?: string | null;
          preview_kind?: 'video' | 'image' | 'article' | 'website' | null;
          preview_status?: 'pending' | 'processing' | 'ready' | 'failed' | 'skipped';
          preview_fetched_at?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          title?: string;
          url?: string | null;
          notes?: string | null;
          space_id?: string;
          created_by?: string | null;
          normalized_url?: string | null;
          preview_title?: string | null;
          preview_description?: string | null;
          preview_image_url?: string | null;
          preview_source?: string | null;
          preview_kind?: 'video' | 'image' | 'article' | 'website' | null;
          preview_status?: 'pending' | 'processing' | 'ready' | 'failed' | 'skipped';
          preview_fetched_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'inspiration_space_id_fkey';
            columns: ['space_id'];
            isOneToOne: false;
            referencedRelation: 'spaces';
            referencedColumns: ['id'];
          },
        ];
      };
      itinerary_items: {
        Row: {
          id: string;
          space_id: string;
          created_by: string;
          title: string;
          description: string | null;
          location: string | null;
          event_date: string;
          start_time: string | null;
          end_time: string | null;
          category: string;
          status: string;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          created_by: string;
          title: string;
          description?: string | null;
          location?: string | null;
          event_date: string;
          start_time?: string | null;
          end_time?: string | null;
          category?: string;
          status?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          space_id?: string;
          created_by?: string;
          title?: string;
          description?: string | null;
          location?: string | null;
          event_date?: string;
          start_time?: string | null;
          end_time?: string | null;
          category?: string;
          status?: string;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'itinerary_items_space_id_fkey';
            columns: ['space_id'];
            isOneToOne: false;
            referencedRelation: 'spaces';
            referencedColumns: ['id'];
          },
        ];
      };
      expenses: {
        Row: {
          id: string;
          space_id: string;
          created_by: string;
          paid_by: string | null;
          merchant_name: string | null;
          expense_title: string;
          expense_date: string | null;
          original_currency: string;
          display_currency: string | null;
          subtotal: number | null;
          tax: number;
          tip: number;
          fees: number;
          discount: number;
          total: number;
          exchange_rate: number | null;
          exchange_rate_date: string | null;
          receipt_image_path: string | null;
          receipt_status: ExpenseReceiptStatus;
          processing_error: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          created_by: string;
          paid_by?: string | null;
          merchant_name?: string | null;
          expense_title: string;
          expense_date?: string | null;
          original_currency?: string;
          display_currency?: string | null;
          subtotal?: number | null;
          tax?: number;
          tip?: number;
          fees?: number;
          discount?: number;
          total: number;
          exchange_rate?: number | null;
          exchange_rate_date?: string | null;
          receipt_image_path?: string | null;
          receipt_status?: ExpenseReceiptStatus;
          processing_error?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          space_id?: string;
          created_by?: string;
          paid_by?: string | null;
          merchant_name?: string | null;
          expense_title?: string;
          expense_date?: string | null;
          original_currency?: string;
          display_currency?: string | null;
          subtotal?: number | null;
          tax?: number;
          tip?: number;
          fees?: number;
          discount?: number;
          total?: number;
          exchange_rate?: number | null;
          exchange_rate_date?: string | null;
          receipt_image_path?: string | null;
          receipt_status?: ExpenseReceiptStatus;
          processing_error?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expenses_space_id_fkey';
            columns: ['space_id'];
            isOneToOne: false;
            referencedRelation: 'spaces';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_items: {
        Row: {
          id: string;
          expense_id: string;
          name: string;
          quantity: number;
          unit_price: number | null;
          line_total: number;
          category: string | null;
          sort_order: number;
          source_text: string | null;
          confidence: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          expense_id: string;
          name: string;
          quantity?: number;
          unit_price?: number | null;
          line_total: number;
          category?: string | null;
          sort_order?: number;
          source_text?: string | null;
          confidence?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          expense_id?: string;
          name?: string;
          quantity?: number;
          unit_price?: number | null;
          line_total?: number;
          category?: string | null;
          sort_order?: number;
          source_text?: string | null;
          confidence?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_items_expense_id_fkey';
            columns: ['expense_id'];
            isOneToOne: false;
            referencedRelation: 'expenses';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_item_assignments: {
        Row: {
          id: string;
          expense_item_id: string;
          user_id: string;
          share_type: ExpenseShareType;
          share_value: number;
          assigned_amount: number | null;
          claimed_by_user: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          expense_item_id: string;
          user_id: string;
          share_type?: ExpenseShareType;
          share_value?: number;
          assigned_amount?: number | null;
          claimed_by_user?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          expense_item_id?: string;
          user_id?: string;
          share_type?: ExpenseShareType;
          share_value?: number;
          assigned_amount?: number | null;
          claimed_by_user?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_item_assignments_expense_item_id_fkey';
            columns: ['expense_item_id'];
            isOneToOne: false;
            referencedRelation: 'expense_items';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_participants: {
        Row: {
          id: string;
          expense_id: string;
          user_id: string;
          tax_share: number;
          tip_share: number;
          fee_share: number;
          discount_share: number;
          total_owed: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          expense_id: string;
          user_id: string;
          tax_share?: number;
          tip_share?: number;
          fee_share?: number;
          discount_share?: number;
          total_owed?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          expense_id?: string;
          user_id?: string;
          tax_share?: number;
          tip_share?: number;
          fee_share?: number;
          discount_share?: number;
          total_owed?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_participants_expense_id_fkey';
            columns: ['expense_id'];
            isOneToOne: false;
            referencedRelation: 'expenses';
            referencedColumns: ['id'];
          },
        ];
      };
      settlements: {
        Row: {
          id: string;
          space_id: string;
          from_user_id: string;
          to_user_id: string;
          amount: number;
          currency: string;
          status: SettlementStatus;
          payment_method: string | null;
          external_reference: string | null;
          note: string | null;
          created_by: string;
          settled_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          from_user_id: string;
          to_user_id: string;
          amount: number;
          currency: string;
          status?: SettlementStatus;
          payment_method?: string | null;
          external_reference?: string | null;
          note?: string | null;
          created_by: string;
          settled_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          space_id?: string;
          from_user_id?: string;
          to_user_id?: string;
          amount?: number;
          currency?: string;
          status?: SettlementStatus;
          payment_method?: string | null;
          external_reference?: string | null;
          note?: string | null;
          created_by?: string;
          settled_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'settlements_space_id_fkey';
            columns: ['space_id'];
            isOneToOne: false;
            referencedRelation: 'spaces';
            referencedColumns: ['id'];
          },
        ];
      };
      receipt_processing_jobs: {
        Row: {
          id: string;
          expense_id: string;
          requested_by: string;
          status: ReceiptProcessingJobStatus;
          provider: string | null;
          model: string | null;
          attempt_count: number;
          extracted_payload: Json | null;
          error_message: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          expense_id: string;
          requested_by: string;
          status?: ReceiptProcessingJobStatus;
          provider?: string | null;
          model?: string | null;
          attempt_count?: number;
          extracted_payload?: Json | null;
          error_message?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          expense_id?: string;
          requested_by?: string;
          status?: ReceiptProcessingJobStatus;
          provider?: string | null;
          model?: string | null;
          attempt_count?: number;
          extracted_payload?: Json | null;
          error_message?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'receipt_processing_jobs_expense_id_fkey';
            columns: ['expense_id'];
            isOneToOne: true;
            referencedRelation: 'expenses';
            referencedColumns: ['id'];
          },
        ];
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
    Functions: {
      save_expense_split: {
        Args: {
          p_expense_id: string;
          p_assignments: Json;
          p_participants: Json;
        };
        Returns: undefined;
      };
    };
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
export type ItineraryItem = Database['public']['Tables']['itinerary_items']['Row'];
export type ItineraryItemInsert = Database['public']['Tables']['itinerary_items']['Insert'];
export type ItineraryItemUpdate = Database['public']['Tables']['itinerary_items']['Update'];
export type Expense = Database['public']['Tables']['expenses']['Row'];
export type ExpenseInsert = Database['public']['Tables']['expenses']['Insert'];
export type ExpenseUpdate = Database['public']['Tables']['expenses']['Update'];
export type ExpenseItem = Database['public']['Tables']['expense_items']['Row'];
export type ExpenseItemInsert = Database['public']['Tables']['expense_items']['Insert'];
export type ExpenseItemUpdate = Database['public']['Tables']['expense_items']['Update'];
export type ExpenseItemAssignment =
  Database['public']['Tables']['expense_item_assignments']['Row'];
export type ExpenseItemAssignmentInsert =
  Database['public']['Tables']['expense_item_assignments']['Insert'];
export type ExpenseItemAssignmentUpdate =
  Database['public']['Tables']['expense_item_assignments']['Update'];
export type ExpenseParticipant = Database['public']['Tables']['expense_participants']['Row'];
export type ExpenseParticipantInsert =
  Database['public']['Tables']['expense_participants']['Insert'];
export type ExpenseParticipantUpdate =
  Database['public']['Tables']['expense_participants']['Update'];
export type Settlement = Database['public']['Tables']['settlements']['Row'];
export type SettlementInsert = Database['public']['Tables']['settlements']['Insert'];
export type SettlementUpdate = Database['public']['Tables']['settlements']['Update'];
export type ReceiptProcessingJob =
  Database['public']['Tables']['receipt_processing_jobs']['Row'];
export type ReceiptProcessingJobInsert =
  Database['public']['Tables']['receipt_processing_jobs']['Insert'];
export type ReceiptProcessingJobUpdate =
  Database['public']['Tables']['receipt_processing_jobs']['Update'];
export type Place = Database['public']['Tables']['places']['Row'];
export type SavedPlace = Database['public']['Tables']['saved_places']['Row'];
