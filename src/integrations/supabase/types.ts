export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      artists: {
        Row: {
          biography: string | null
          birth_year: number | null
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          image_url: string | null
          nationality: string | null
          representation_status: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          biography?: string | null
          birth_year?: number | null
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          image_url?: string | null
          nationality?: string | null
          representation_status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          biography?: string | null
          birth_year?: number | null
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          image_url?: string | null
          nationality?: string | null
          representation_status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      artwork_images: {
        Row: {
          artwork_id: string | null
          created_at: string | null
          display_order: number | null
          id: string
          image_url: string
          is_primary: boolean | null
          updated_at: string | null
        }
        Insert: {
          artwork_id?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url: string
          is_primary?: boolean | null
          updated_at?: string | null
        }
        Update: {
          artwork_id?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url?: string
          is_primary?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artwork_images_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
        ]
      }
      artworks: {
        Row: {
          artist_id: string | null
          artist_proofs: number | null
          available_works: string | null
          classification: string
          condition: string | null
          crate_depth: number | null
          crate_height: number | null
          crate_width: number | null
          created_at: string | null
          currency: string
          depth: number | null
          dimensions: string | null
          edition_size: number | null
          exhibition_history: string | null
          frame_depth: number | null
          frame_height: number | null
          frame_width: number | null
          has_crate: boolean | null
          height: number | null
          id: string
          image_url: string | null
          inventory_quantity: number | null
          is_framed: boolean | null
          location_id: string | null
          material: string | null
          materials: string | null
          medium_type: string
          price: number | null
          provenance: string | null
          signature_details: string | null
          signature_type: string | null
          status: string | null
          story: string | null
          title: string
          updated_at: string | null
          weight: number | null
          width: number | null
          year: number | null
        }
        Insert: {
          artist_id?: string | null
          artist_proofs?: number | null
          available_works?: string | null
          classification: string
          condition?: string | null
          crate_depth?: number | null
          crate_height?: number | null
          crate_width?: number | null
          created_at?: string | null
          currency: string
          depth?: number | null
          dimensions?: string | null
          edition_size?: number | null
          exhibition_history?: string | null
          frame_depth?: number | null
          frame_height?: number | null
          frame_width?: number | null
          has_crate?: boolean | null
          height?: number | null
          id?: string
          image_url?: string | null
          inventory_quantity?: number | null
          is_framed?: boolean | null
          location_id?: string | null
          material?: string | null
          materials?: string | null
          medium_type: string
          price?: number | null
          provenance?: string | null
          signature_details?: string | null
          signature_type?: string | null
          status?: string | null
          story?: string | null
          title: string
          updated_at?: string | null
          weight?: number | null
          width?: number | null
          year?: number | null
        }
        Update: {
          artist_id?: string | null
          artist_proofs?: number | null
          available_works?: string | null
          classification?: string
          condition?: string | null
          crate_depth?: number | null
          crate_height?: number | null
          crate_width?: number | null
          created_at?: string | null
          currency?: string
          depth?: number | null
          dimensions?: string | null
          edition_size?: number | null
          exhibition_history?: string | null
          frame_depth?: number | null
          frame_height?: number | null
          frame_width?: number | null
          has_crate?: boolean | null
          height?: number | null
          id?: string
          image_url?: string | null
          inventory_quantity?: number | null
          is_framed?: boolean | null
          location_id?: string | null
          material?: string | null
          materials?: string | null
          medium_type?: string
          price?: number | null
          provenance?: string | null
          signature_details?: string | null
          signature_type?: string | null
          status?: string | null
          story?: string | null
          title?: string
          updated_at?: string | null
          weight?: number | null
          width?: number | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "artworks_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          client_type: string
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          notes: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          client_type?: string
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          client_type?: string
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      collection_artworks: {
        Row: {
          artwork_id: string
          collection_id: string
        }
        Insert: {
          artwork_id: string
          collection_id: string
        }
        Update: {
          artwork_id?: string
          collection_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_artworks_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_artworks_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          description: string | null
          external_emails: string[] | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          external_emails?: string[] | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          external_emails?: string[] | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      deletion_requests: {
        Row: {
          created_at: string | null
          id: string
          item_details: Json
          item_id: string
          item_type: string
          status: Database["public"]["Enums"]["deletion_request_status"] | null
          updated_at: string | null
          updated_by: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_details: Json
          item_id: string
          item_type: string
          status?: Database["public"]["Enums"]["deletion_request_status"] | null
          updated_at?: string | null
          updated_by?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          item_details?: Json
          item_id?: string
          item_type?: string
          status?: Database["public"]["Enums"]["deletion_request_status"] | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          artist_id: string | null
          artwork_id: string | null
          collection_id: string | null
          created_at: string | null
          date_uploaded: string | null
          description: string | null
          file_name: string
          file_url: string
          id: string
          type: string
          updated_at: string | null
        }
        Insert: {
          artist_id?: string | null
          artwork_id?: string | null
          collection_id?: string | null
          created_at?: string | null
          date_uploaded?: string | null
          description?: string | null
          file_name: string
          file_url: string
          id?: string
          type: string
          updated_at?: string | null
        }
        Update: {
          artist_id?: string | null
          artwork_id?: string | null
          collection_id?: string | null
          created_at?: string | null
          date_uploaded?: string | null
          description?: string | null
          file_name?: string
          file_url?: string
          id?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      exhibition_artworks: {
        Row: {
          artwork_id: string
          exhibition_id: string
        }
        Insert: {
          artwork_id: string
          exhibition_id: string
        }
        Update: {
          artwork_id?: string
          exhibition_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exhibition_artworks_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exhibition_artworks_exhibition_id_fkey"
            columns: ["exhibition_id"]
            isOneToOne: false
            referencedRelation: "exhibitions"
            referencedColumns: ["id"]
          },
        ]
      }
      exhibitions: {
        Row: {
          created_at: string | null
          description: string | null
          end_date: string
          id: string
          image_url: string | null
          location_id: string | null
          start_date: string
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          end_date: string
          id?: string
          image_url?: string | null
          location_id?: string | null
          start_date: string
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          end_date?: string
          id?: string
          image_url?: string | null
          location_id?: string | null
          start_date?: string
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      locations: {
        Row: {
          address: string | null
          created_at: string | null
          id: string
          name: string
          notes: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string
          name: string
          notes?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email_confirmed: boolean | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email_confirmed?: boolean | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email_confirmed?: boolean | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          artwork_id: string | null
          client_id: string | null
          created_at: string | null
          id: string
          notes: string | null
          payment_status: string | null
          sale_date: string
          sale_price: number
          updated_at: string | null
        }
        Insert: {
          artwork_id?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          payment_status?: string | null
          sale_date: string
          sale_price: number
          updated_at?: string | null
        }
        Update: {
          artwork_id?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          payment_status?: string | null
          sale_date?: string
          sale_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
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
          _user_id: string
          _role: Database["public"]["Enums"]["user_role"]
        }
        Returns: boolean
      }
      is_artist_user: {
        Args: { _user_id: string; _artist_id: string }
        Returns: boolean
      }
    }
    Enums: {
      deletion_request_status: "pending" | "approved" | "rejected"
      user_role: "gallery_admin" | "artist"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      deletion_request_status: ["pending", "approved", "rejected"],
      user_role: ["gallery_admin", "artist"],
    },
  },
} as const
