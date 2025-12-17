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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_storage_credentials: {
        Row: {
          access_key: string
          bucket_name: string
          created_at: string
          endpoint_url: string
          id: string
          is_active: boolean
          name: string
          region: string
          secret_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_key: string
          bucket_name: string
          created_at?: string
          endpoint_url?: string
          id?: string
          is_active?: boolean
          name: string
          region?: string
          secret_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_key?: string
          bucket_name?: string
          created_at?: string
          endpoint_url?: string
          id?: string
          is_active?: boolean
          name?: string
          region?: string
          secret_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_storage_credentials_decrypted: {
        Row: {
          access_key: string
          bucket_name: string
          created_at: string
          endpoint_url: string
          id: string
          is_active: boolean
          name: string
          region: string
          secret_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_key: string
          bucket_name: string
          created_at?: string
          endpoint_url?: string
          id: string
          is_active?: boolean
          name: string
          region?: string
          secret_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_key?: string
          bucket_name?: string
          created_at?: string
          endpoint_url?: string
          id?: string
          is_active?: boolean
          name?: string
          region?: string
          secret_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_description_history: {
        Row: {
          artwork_id: string
          description: string
          generated_at: string
          generated_by: string | null
          id: string
          keywords_used: string | null
          model_used: string | null
        }
        Insert: {
          artwork_id: string
          description: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          keywords_used?: string | null
          model_used?: string | null
        }
        Update: {
          artwork_id?: string
          description?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          keywords_used?: string | null
          model_used?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_description_history_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_description_history_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_slots: {
        Row: {
          appointment_type_id: string | null
          created_at: string | null
          created_by: string | null
          date: string | null
          day_of_week: number | null
          end_time: string
          id: string
          is_available: boolean | null
          location_id: string | null
          recurrence_end_date: string | null
          recurrence_type:
            | Database["public"]["Enums"]["appointment_recurrence"]
            | null
          start_time: string
          updated_at: string | null
        }
        Insert: {
          appointment_type_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          day_of_week?: number | null
          end_time: string
          id?: string
          is_available?: boolean | null
          location_id?: string | null
          recurrence_end_date?: string | null
          recurrence_type?:
            | Database["public"]["Enums"]["appointment_recurrence"]
            | null
          start_time: string
          updated_at?: string | null
        }
        Update: {
          appointment_type_id?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string | null
          day_of_week?: number | null
          end_time?: string
          id?: string
          is_available?: boolean | null
          location_id?: string | null
          recurrence_end_date?: string | null
          recurrence_type?:
            | Database["public"]["Enums"]["appointment_recurrence"]
            | null
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_slots_appointment_type_id_fkey"
            columns: ["appointment_type_id"]
            isOneToOne: false
            referencedRelation: "appointment_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_slots_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_slots_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations_booking_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      appointment_types: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      appointments: {
        Row: {
          admin_notes: string | null
          appointment_slot_id: string | null
          appointment_type_id: string | null
          client_email: string
          client_id: string | null
          client_name: string
          client_phone: string | null
          confirmed_by: string | null
          created_at: string | null
          end_datetime: string
          id: string
          location_id: string | null
          notes: string | null
          start_datetime: string
          status: Database["public"]["Enums"]["appointment_status"] | null
          updated_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          appointment_slot_id?: string | null
          appointment_type_id?: string | null
          client_email: string
          client_id?: string | null
          client_name: string
          client_phone?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          end_datetime: string
          id?: string
          location_id?: string | null
          notes?: string | null
          start_datetime: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          updated_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          appointment_slot_id?: string | null
          appointment_type_id?: string | null
          client_email?: string
          client_id?: string | null
          client_name?: string
          client_phone?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          end_datetime?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          start_datetime?: string
          status?: Database["public"]["Enums"]["appointment_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_appointment_slot_id_fkey"
            columns: ["appointment_slot_id"]
            isOneToOne: false
            referencedRelation: "appointment_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_appointment_type_id_fkey"
            columns: ["appointment_type_id"]
            isOneToOne: false
            referencedRelation: "appointment_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations_booking_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_storage_credentials: {
        Row: {
          access_key: string
          artist_id: string
          bucket_name: string
          created_at: string
          endpoint_url: string
          id: string
          region: string
          secret_key: string
          updated_at: string
        }
        Insert: {
          access_key: string
          artist_id: string
          bucket_name: string
          created_at?: string
          endpoint_url?: string
          id?: string
          region?: string
          secret_key: string
          updated_at?: string
        }
        Update: {
          access_key?: string
          artist_id?: string
          bucket_name?: string
          created_at?: string
          endpoint_url?: string
          id?: string
          region?: string
          secret_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_storage_credentials_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: true
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artist_storage_credentials_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: true
            referencedRelation: "artists_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_storage_credentials_decrypted: {
        Row: {
          access_key: string
          artist_id: string
          bucket_name: string
          created_at: string
          endpoint_url: string
          id: string
          region: string
          secret_key: string
          updated_at: string
        }
        Insert: {
          access_key: string
          artist_id: string
          bucket_name: string
          created_at?: string
          endpoint_url?: string
          id: string
          region?: string
          secret_key: string
          updated_at?: string
        }
        Update: {
          access_key?: string
          artist_id?: string
          bucket_name?: string
          created_at?: string
          endpoint_url?: string
          id?: string
          region?: string
          secret_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      artists: {
        Row: {
          biography: string | null
          birth_year: number | null
          created_at: string | null
          death_year: number | null
          email: string | null
          full_name: string
          id: string
          image_url: string | null
          nationality: string | null
          place_of_birth: string | null
          place_of_death: string | null
          representation_status: string
          surname_first_letter: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          biography?: string | null
          birth_year?: number | null
          created_at?: string | null
          death_year?: number | null
          email?: string | null
          full_name: string
          id?: string
          image_url?: string | null
          nationality?: string | null
          place_of_birth?: string | null
          place_of_death?: string | null
          representation_status?: string
          surname_first_letter?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          biography?: string | null
          birth_year?: number | null
          created_at?: string | null
          death_year?: number | null
          email?: string | null
          full_name?: string
          id?: string
          image_url?: string | null
          nationality?: string | null
          place_of_birth?: string | null
          place_of_death?: string | null
          representation_status?: string
          surname_first_letter?: string | null
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
          large_storage_path: string | null
          medium_height: number | null
          medium_storage_path: string | null
          medium_url: string | null
          medium_width: number | null
          original_height: number | null
          original_size: number | null
          original_storage_path: string | null
          original_width: number | null
          processed: boolean | null
          processing_error: string | null
          processing_status: string | null
          thumbnail_height: number | null
          thumbnail_storage_path: string | null
          thumbnail_url: string | null
          thumbnail_width: number | null
          updated_at: string | null
        }
        Insert: {
          artwork_id?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url: string
          is_primary?: boolean | null
          large_storage_path?: string | null
          medium_height?: number | null
          medium_storage_path?: string | null
          medium_url?: string | null
          medium_width?: number | null
          original_height?: number | null
          original_size?: number | null
          original_storage_path?: string | null
          original_width?: number | null
          processed?: boolean | null
          processing_error?: string | null
          processing_status?: string | null
          thumbnail_height?: number | null
          thumbnail_storage_path?: string | null
          thumbnail_url?: string | null
          thumbnail_width?: number | null
          updated_at?: string | null
        }
        Update: {
          artwork_id?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url?: string
          is_primary?: boolean | null
          large_storage_path?: string | null
          medium_height?: number | null
          medium_storage_path?: string | null
          medium_url?: string | null
          medium_width?: number | null
          original_height?: number | null
          original_size?: number | null
          original_storage_path?: string | null
          original_width?: number | null
          processed?: boolean | null
          processing_error?: string | null
          processing_status?: string | null
          thumbnail_height?: number | null
          thumbnail_storage_path?: string | null
          thumbnail_url?: string | null
          thumbnail_width?: number | null
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
          {
            foreignKeyName: "artwork_images_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      artwork_location_history: {
        Row: {
          artwork_id: string
          changed_at: string
          changed_by: string | null
          created_at: string
          id: string
          location_id: string | null
          notes: string | null
          previous_location_id: string | null
        }
        Insert: {
          artwork_id: string
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          previous_location_id?: string | null
        }
        Update: {
          artwork_id?: string
          changed_at?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          location_id?: string | null
          notes?: string | null
          previous_location_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artwork_location_history_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artwork_location_history_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks_public_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artwork_location_history_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artwork_location_history_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations_booking_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artwork_location_history_previous_location_id_fkey"
            columns: ["previous_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artwork_location_history_previous_location_id_fkey"
            columns: ["previous_location_id"]
            isOneToOne: false
            referencedRelation: "locations_booking_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      artwork_videos: {
        Row: {
          artwork_id: string
          created_at: string | null
          display_order: number | null
          duration_seconds: number | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          is_primary: boolean | null
          thumbnail_url: string | null
          updated_at: string | null
          upload_status: string | null
          vimeo_url: string | null
          vimeo_video_id: string | null
        }
        Insert: {
          artwork_id: string
          created_at?: string | null
          display_order?: number | null
          duration_seconds?: number | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          is_primary?: boolean | null
          thumbnail_url?: string | null
          updated_at?: string | null
          upload_status?: string | null
          vimeo_url?: string | null
          vimeo_video_id?: string | null
        }
        Update: {
          artwork_id?: string
          created_at?: string | null
          display_order?: number | null
          duration_seconds?: number | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          is_primary?: boolean | null
          thumbnail_url?: string | null
          updated_at?: string | null
          upload_status?: string | null
          vimeo_url?: string | null
          vimeo_video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artwork_videos_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artwork_videos_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      artworks: {
        Row: {
          additional_keywords: string | null
          ai_description: string | null
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
          additional_keywords?: string | null
          ai_description?: string | null
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
          additional_keywords?: string | null
          ai_description?: string | null
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
          {
            foreignKeyName: "artworks_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_settings: {
        Row: {
          admin_notifications: boolean | null
          advance_booking_days: number | null
          auto_confirm: boolean | null
          booking_instructions: string | null
          buffer_time_minutes: number | null
          business_hours_end: string | null
          business_hours_start: string | null
          confirmation_emails: boolean | null
          created_at: string | null
          email_reminders: boolean | null
          id: string
          notification_email: string | null
          reminder_hours: number | null
          updated_at: string | null
          working_days: number[] | null
        }
        Insert: {
          admin_notifications?: boolean | null
          advance_booking_days?: number | null
          auto_confirm?: boolean | null
          booking_instructions?: string | null
          buffer_time_minutes?: number | null
          business_hours_end?: string | null
          business_hours_start?: string | null
          confirmation_emails?: boolean | null
          created_at?: string | null
          email_reminders?: boolean | null
          id?: string
          notification_email?: string | null
          reminder_hours?: number | null
          updated_at?: string | null
          working_days?: number[] | null
        }
        Update: {
          admin_notifications?: boolean | null
          advance_booking_days?: number | null
          auto_confirm?: boolean | null
          booking_instructions?: string | null
          buffer_time_minutes?: number | null
          business_hours_end?: string | null
          business_hours_start?: string | null
          confirmation_emails?: boolean | null
          created_at?: string | null
          email_reminders?: boolean | null
          id?: string
          notification_email?: string | null
          reminder_hours?: number | null
          updated_at?: string | null
          working_days?: number[] | null
        }
        Relationships: []
      }
      campaign_monitor_config: {
        Row: {
          api_key_encrypted: string | null
          client_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          updated_at: string | null
        }
        Insert: {
          api_key_encrypted?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Update: {
          api_key_encrypted?: string | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      campaign_monitor_lists: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          list_id: string
          name: string
          subscriber_count: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          list_id: string
          name: string
          subscriber_count?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          list_id?: string
          name?: string
          subscriber_count?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          created_at: string
          edited_at: string | null
          encrypted_content: string
          first_read_at: string | null
          id: string
          message_type: Database["public"]["Enums"]["message_type"]
          read_by: string[] | null
          room_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          edited_at?: string | null
          encrypted_content: string
          first_read_at?: string | null
          id?: string
          message_type?: Database["public"]["Enums"]["message_type"]
          read_by?: string[] | null
          room_id: string
          sender_id: string
        }
        Update: {
          created_at?: string
          edited_at?: string | null
          encrypted_content?: string
          first_read_at?: string | null
          id?: string
          message_type?: Database["public"]["Enums"]["message_type"]
          read_by?: string[] | null
          room_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rooms: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          participant_1_id: string
          participant_2_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          participant_1_id: string
          participant_2_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          participant_1_id?: string
          participant_2_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_communications: {
        Row: {
          campaign_monitor_campaign_id: string | null
          client_id: string
          completed_date: string | null
          content: string | null
          created_at: string | null
          created_by: string | null
          id: string
          scheduled_date: string | null
          subject: string | null
          type: Database["public"]["Enums"]["communication_type"]
          updated_at: string | null
        }
        Insert: {
          campaign_monitor_campaign_id?: string | null
          client_id: string
          completed_date?: string | null
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          scheduled_date?: string | null
          subject?: string | null
          type: Database["public"]["Enums"]["communication_type"]
          updated_at?: string | null
        }
        Update: {
          campaign_monitor_campaign_id?: string | null
          client_id?: string
          completed_date?: string | null
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          scheduled_date?: string | null
          subject?: string | null
          type?: Database["public"]["Enums"]["communication_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_communications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_list_members: {
        Row: {
          added_at: string | null
          client_id: string
          id: string
          list_id: string
        }
        Insert: {
          added_at?: string | null
          client_id: string
          id?: string
          list_id: string
        }
        Update: {
          added_at?: string | null
          client_id?: string
          id?: string
          list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_list_members_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_list_members_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "client_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      client_list_subscriptions: {
        Row: {
          client_id: string
          id: string
          is_active: boolean | null
          list_id: string
          subscribed_at: string | null
          unsubscribed_at: string | null
        }
        Insert: {
          client_id: string
          id?: string
          is_active?: boolean | null
          list_id: string
          subscribed_at?: string | null
          unsubscribed_at?: string | null
        }
        Update: {
          client_id?: string
          id?: string
          is_active?: boolean | null
          list_id?: string
          subscribed_at?: string | null
          unsubscribed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_list_subscriptions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_list_subscriptions_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "campaign_monitor_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      client_lists: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          birthday: string | null
          campaign_monitor_id: string | null
          client_type: string
          cm_last_sync_at: string | null
          cm_sync_error: string | null
          cm_sync_status: string | null
          company: string | null
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          instagram_handle: string | null
          interested_artists: string[] | null
          last_activity_date: string | null
          linkedin_handle: string | null
          notes: string | null
          phone: string | null
          source: string | null
          status: Database["public"]["Enums"]["client_status"] | null
          tags: string[] | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          birthday?: string | null
          campaign_monitor_id?: string | null
          client_type?: string
          cm_last_sync_at?: string | null
          cm_sync_error?: string | null
          cm_sync_status?: string | null
          company?: string | null
          created_at?: string | null
          email?: string | null
          full_name: string
          id?: string
          instagram_handle?: string | null
          interested_artists?: string[] | null
          last_activity_date?: string | null
          linkedin_handle?: string | null
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["client_status"] | null
          tags?: string[] | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          birthday?: string | null
          campaign_monitor_id?: string | null
          client_type?: string
          cm_last_sync_at?: string | null
          cm_sync_error?: string | null
          cm_sync_status?: string | null
          company?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          instagram_handle?: string | null
          interested_artists?: string[] | null
          last_activity_date?: string | null
          linkedin_handle?: string | null
          notes?: string | null
          phone?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["client_status"] | null
          tags?: string[] | null
          updated_at?: string | null
          website?: string | null
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
            foreignKeyName: "collection_artworks_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks_public_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_artworks_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_artworks_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_websites: {
        Row: {
          collection_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string | null
          password_hash: string | null
          show_prices: boolean
          slug: string
          updated_at: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string | null
          password_hash?: string | null
          show_prices?: boolean
          slug: string
          updated_at?: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string | null
          password_hash?: string | null
          show_prices?: boolean
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_websites_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_websites_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections_public_safe"
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
      crm_campaigns: {
        Row: {
          audience_snapshot: Json | null
          clicks: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          display_order: number | null
          from_email: string | null
          from_name: string | null
          id: string
          list_id: string | null
          name: string
          opens: number | null
          preview_text: string | null
          scheduled_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["crm_campaign_status"] | null
          subject: string | null
          total_recipients: number | null
          updated_at: string | null
        }
        Insert: {
          audience_snapshot?: Json | null
          clicks?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          list_id?: string | null
          name: string
          opens?: number | null
          preview_text?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["crm_campaign_status"] | null
          subject?: string | null
          total_recipients?: number | null
          updated_at?: string | null
        }
        Update: {
          audience_snapshot?: Json | null
          clicks?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          from_email?: string | null
          from_name?: string | null
          id?: string
          list_id?: string | null
          name?: string
          opens?: number | null
          preview_text?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["crm_campaign_status"] | null
          subject?: string | null
          total_recipients?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_campaigns_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "crm_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contacts: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          birthday: string | null
          city: string | null
          consent_date: string | null
          consent_source: string | null
          contact_type: Database["public"]["Enums"]["crm_contact_type"] | null
          country: string | null
          created_at: string | null
          created_by: string | null
          custom_fields: Json | null
          email: string | null
          first_name: string | null
          full_name: string
          google_contact_id: string | null
          id: string
          instagram_handle: string | null
          interested_artists: string[] | null
          job_title: string | null
          last_interaction_date: string | null
          last_name: string | null
          line_id: string | null
          linkedin_handle: string | null
          marketing_consent: boolean | null
          notes: string | null
          organization_id: string | null
          phone: string | null
          postal_code: string | null
          profile_image_url: string | null
          sanctions_checked_at: string | null
          sanctions_match_count: number | null
          sanctions_matches: Json | null
          sanctions_risk_level: string | null
          secondary_email: string | null
          secondary_phone: string | null
          source: string | null
          state: string | null
          status: string | null
          tags: string[] | null
          updated_at: string | null
          wechat_id: string | null
          whatsapp_number: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          birthday?: string | null
          city?: string | null
          consent_date?: string | null
          consent_source?: string | null
          contact_type?: Database["public"]["Enums"]["crm_contact_type"] | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_fields?: Json | null
          email?: string | null
          first_name?: string | null
          full_name: string
          google_contact_id?: string | null
          id?: string
          instagram_handle?: string | null
          interested_artists?: string[] | null
          job_title?: string | null
          last_interaction_date?: string | null
          last_name?: string | null
          line_id?: string | null
          linkedin_handle?: string | null
          marketing_consent?: boolean | null
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          postal_code?: string | null
          profile_image_url?: string | null
          sanctions_checked_at?: string | null
          sanctions_match_count?: number | null
          sanctions_matches?: Json | null
          sanctions_risk_level?: string | null
          secondary_email?: string | null
          secondary_phone?: string | null
          source?: string | null
          state?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string | null
          wechat_id?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          birthday?: string | null
          city?: string | null
          consent_date?: string | null
          consent_source?: string | null
          contact_type?: Database["public"]["Enums"]["crm_contact_type"] | null
          country?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_fields?: Json | null
          email?: string | null
          first_name?: string | null
          full_name?: string
          google_contact_id?: string | null
          id?: string
          instagram_handle?: string | null
          interested_artists?: string[] | null
          job_title?: string | null
          last_interaction_date?: string | null
          last_name?: string | null
          line_id?: string | null
          linkedin_handle?: string | null
          marketing_consent?: boolean | null
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          postal_code?: string | null
          profile_image_url?: string | null
          sanctions_checked_at?: string | null
          sanctions_match_count?: number | null
          sanctions_matches?: Json | null
          sanctions_risk_level?: string | null
          secondary_email?: string | null
          secondary_phone?: string | null
          source?: string | null
          state?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string | null
          wechat_id?: string | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deals: {
        Row: {
          contact_id: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          display_order: number | null
          expected_close_date: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string | null
          pipeline_id: string | null
          probability: number | null
          related_artworks: string[] | null
          related_exhibitions: string | null
          stage_id: string | null
          status: Database["public"]["Enums"]["crm_deal_status"] | null
          updated_at: string | null
          value: number | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          display_order?: number | null
          expected_close_date?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id?: string | null
          pipeline_id?: string | null
          probability?: number | null
          related_artworks?: string[] | null
          related_exhibitions?: string | null
          stage_id?: string | null
          status?: Database["public"]["Enums"]["crm_deal_status"] | null
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          display_order?: number | null
          expected_close_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string | null
          pipeline_id?: string | null
          probability?: number | null
          related_artworks?: string[] | null
          related_exhibitions?: string | null
          stage_id?: string | null
          status?: Database["public"]["Enums"]["crm_deal_status"] | null
          updated_at?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_export_history: {
        Row: {
          export_type: string
          exported_at: string | null
          exported_by: string | null
          google_sheet_id: string | null
          google_sheet_url: string | null
          id: string
          record_count: number | null
          source_id: string | null
          source_name: string | null
          source_type: string
        }
        Insert: {
          export_type: string
          exported_at?: string | null
          exported_by?: string | null
          google_sheet_id?: string | null
          google_sheet_url?: string | null
          id?: string
          record_count?: number | null
          source_id?: string | null
          source_name?: string | null
          source_type: string
        }
        Update: {
          export_type?: string
          exported_at?: string | null
          exported_by?: string | null
          google_sheet_id?: string | null
          google_sheet_url?: string | null
          id?: string
          record_count?: number | null
          source_id?: string | null
          source_name?: string | null
          source_type?: string
        }
        Relationships: []
      }
      crm_integration_config: {
        Row: {
          auto_log_emails: boolean | null
          auto_sync_contacts: boolean | null
          created_at: string | null
          google_access_token: string | null
          google_refresh_token: string | null
          google_scopes: string[] | null
          google_token_expiry: string | null
          id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          auto_log_emails?: boolean | null
          auto_sync_contacts?: boolean | null
          created_at?: string | null
          google_access_token?: string | null
          google_refresh_token?: string | null
          google_scopes?: string[] | null
          google_token_expiry?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          auto_log_emails?: boolean | null
          auto_sync_contacts?: boolean | null
          created_at?: string | null
          google_access_token?: string | null
          google_refresh_token?: string | null
          google_scopes?: string[] | null
          google_token_expiry?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      crm_interactions: {
        Row: {
          calendar_event_id: string | null
          contact_id: string | null
          created_at: string | null
          created_by: string | null
          direction:
            | Database["public"]["Enums"]["crm_interaction_direction"]
            | null
          duration_minutes: number | null
          gmail_message_id: string | null
          gmail_thread_id: string | null
          id: string
          interaction_date: string | null
          notes: string | null
          organization_id: string | null
          subject: string | null
          summary: string | null
          type: Database["public"]["Enums"]["crm_interaction_type"]
          updated_at: string | null
        }
        Insert: {
          calendar_event_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          direction?:
            | Database["public"]["Enums"]["crm_interaction_direction"]
            | null
          duration_minutes?: number | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          interaction_date?: string | null
          notes?: string | null
          organization_id?: string | null
          subject?: string | null
          summary?: string | null
          type?: Database["public"]["Enums"]["crm_interaction_type"]
          updated_at?: string | null
        }
        Update: {
          calendar_event_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          created_by?: string | null
          direction?:
            | Database["public"]["Enums"]["crm_interaction_direction"]
            | null
          duration_minutes?: number | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          interaction_date?: string | null
          notes?: string | null
          organization_id?: string | null
          subject?: string | null
          summary?: string | null
          type?: Database["public"]["Enums"]["crm_interaction_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_interactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_interactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_list_members: {
        Row: {
          added_at: string | null
          added_by: string | null
          contact_id: string | null
          id: string
          list_id: string | null
        }
        Insert: {
          added_at?: string | null
          added_by?: string | null
          contact_id?: string | null
          id?: string
          list_id?: string | null
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          contact_id?: string | null
          id?: string
          list_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_list_members_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_list_members_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "crm_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_lists: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          display_order: number | null
          filter_rules: Json | null
          id: string
          name: string
          type: Database["public"]["Enums"]["crm_list_type"] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          filter_rules?: Json | null
          id?: string
          name: string
          type?: Database["public"]["Enums"]["crm_list_type"] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          display_order?: number | null
          filter_rules?: Json | null
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["crm_list_type"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      crm_organizations: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          company_number: string | null
          company_verified: boolean | null
          company_verified_at: string | null
          country: string | null
          created_at: string | null
          custom_fields: Json | null
          email: string | null
          eori_number: string | null
          eori_verified: boolean | null
          eori_verified_at: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          postal_code: string | null
          state: string | null
          tags: string[] | null
          type: Database["public"]["Enums"]["crm_organization_type"] | null
          updated_at: string | null
          vat_number: string | null
          vat_verified: boolean | null
          vat_verified_at: string | null
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          company_number?: string | null
          company_verified?: boolean | null
          company_verified_at?: string | null
          country?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          email?: string | null
          eori_number?: string | null
          eori_verified?: boolean | null
          eori_verified_at?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          tags?: string[] | null
          type?: Database["public"]["Enums"]["crm_organization_type"] | null
          updated_at?: string | null
          vat_number?: string | null
          vat_verified?: boolean | null
          vat_verified_at?: string | null
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          company_number?: string | null
          company_verified?: boolean | null
          company_verified_at?: string | null
          country?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          email?: string | null
          eori_number?: string | null
          eori_verified?: boolean | null
          eori_verified_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          state?: string | null
          tags?: string[] | null
          type?: Database["public"]["Enums"]["crm_organization_type"] | null
          updated_at?: string | null
          vat_number?: string | null
          vat_verified?: boolean | null
          vat_verified_at?: string | null
          website?: string | null
        }
        Relationships: []
      }
      crm_pipeline_stages: {
        Row: {
          color: string | null
          created_at: string | null
          display_order: number | null
          id: string
          name: string
          pipeline_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          name: string
          pipeline_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          name?: string
          pipeline_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_pipeline_stages_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "crm_pipelines"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_pipelines: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          name?: string
          updated_at?: string | null
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
          deleted_at: string | null
          description: string | null
          file_name: string
          file_size: number | null
          file_url: string
          folder_id: string | null
          id: string
          is_deleted: boolean
          is_favorite: boolean
          mime_type: string | null
          type: string
          updated_at: string | null
          version_number: number
        }
        Insert: {
          artist_id?: string | null
          artwork_id?: string | null
          collection_id?: string | null
          created_at?: string | null
          date_uploaded?: string | null
          deleted_at?: string | null
          description?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          folder_id?: string | null
          id?: string
          is_deleted?: boolean
          is_favorite?: boolean
          mime_type?: string | null
          type: string
          updated_at?: string | null
          version_number?: number
        }
        Update: {
          artist_id?: string | null
          artwork_id?: string | null
          collection_id?: string | null
          created_at?: string | null
          date_uploaded?: string | null
          deleted_at?: string | null
          description?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          folder_id?: string | null
          id?: string
          is_deleted?: boolean
          is_favorite?: boolean
          mime_type?: string | null
          type?: string
          updated_at?: string | null
          version_number?: number
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
            foreignKeyName: "documents_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists_public_safe"
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
            foreignKeyName: "documents_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks_public_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections_public_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          base_currency: string
          created_at: string
          expires_at: string
          fetched_at: string
          id: string
          rate: number
          target_currency: string
          updated_at: string
        }
        Insert: {
          base_currency: string
          created_at?: string
          expires_at?: string
          fetched_at?: string
          id?: string
          rate: number
          target_currency: string
          updated_at?: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          expires_at?: string
          fetched_at?: string
          id?: string
          rate?: number
          target_currency?: string
          updated_at?: string
        }
        Relationships: []
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
            foreignKeyName: "exhibition_artworks_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks_public_safe"
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
      file_versions: {
        Row: {
          change_notes: string | null
          created_at: string
          created_by: string
          document_id: string
          file_size: number | null
          file_url: string
          id: string
          version_number: number
        }
        Insert: {
          change_notes?: string | null
          created_at?: string
          created_by: string
          document_id: string
          file_size?: number | null
          file_url: string
          id?: string
          version_number: number
        }
        Update: {
          change_notes?: string | null
          created_at?: string
          created_by?: string
          document_id?: string
          file_size?: number | null
          file_url?: string
          id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "file_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          artist_id: string | null
          assignment_method: string | null
          created_at: string
          created_by: string
          id: string
          name: string
          parent_folder_id: string | null
          path: string | null
          updated_at: string
        }
        Insert: {
          artist_id?: string | null
          assignment_method?: string | null
          created_at?: string
          created_by: string
          id?: string
          name: string
          parent_folder_id?: string | null
          path?: string | null
          updated_at?: string
        }
        Update: {
          artist_id?: string | null
          assignment_method?: string | null
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          parent_folder_id?: string | null
          path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists_public_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_parent_folder_id_fkey"
            columns: ["parent_folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      in_app_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string | null
          metadata: Json | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          metadata?: Json | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string | null
          metadata?: Json | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
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
      notification_analytics: {
        Row: {
          campaign_id: string | null
          created_at: string
          event_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_analytics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "notification_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_campaigns: {
        Row: {
          action_url: string | null
          click_count: number
          created_at: string
          created_by: string | null
          delivery_count: number
          icon_url: string | null
          id: string
          message: string
          scheduled_at: string | null
          sent_at: string | null
          status: string
          target_audience: string
          title: string
          updated_at: string
        }
        Insert: {
          action_url?: string | null
          click_count?: number
          created_at?: string
          created_by?: string | null
          delivery_count?: number
          icon_url?: string | null
          id?: string
          message: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          target_audience: string
          title: string
          updated_at?: string
        }
        Update: {
          action_url?: string | null
          click_count?: number
          created_at?: string
          created_by?: string | null
          delivery_count?: number
          icon_url?: string | null
          id?: string
          message?: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          target_audience?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          p256dh_key: string
          updated_at: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh_key: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh_key?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          email_confirmed: boolean | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          email_confirmed?: boolean | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          email_confirmed?: boolean | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_sections: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          position: number
          project_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          position?: number
          project_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          position?: number
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_sections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          project_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          project_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tags_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_task_references: {
        Row: {
          created_at: string
          id: string
          reference_id: string
          reference_type: Database["public"]["Enums"]["reference_type"]
          task_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reference_id: string
          reference_type: Database["public"]["Enums"]["reference_type"]
          task_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reference_id?: string
          reference_type?: Database["public"]["Enums"]["reference_type"]
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_task_references_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string | null
          done_date: string | null
          end_date: string
          estimated_hours: number | null
          id: string
          name: string
          position: number | null
          priority: string | null
          project_id: string
          section_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          done_date?: string | null
          end_date: string
          estimated_hours?: number | null
          id?: string
          name: string
          position?: number | null
          priority?: string | null
          project_id: string
          section_id?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          done_date?: string | null
          end_date?: string
          estimated_hours?: number | null
          id?: string
          name?: string
          position?: number | null
          priority?: string | null
          project_id?: string
          section_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "project_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      project_users: {
        Row: {
          created_at: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_users_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          end_date: string
          id: string
          location_id: string | null
          name: string
          start_date: string
          status: Database["public"]["Enums"]["project_status"]
          type: Database["public"]["Enums"]["project_type"]
          updated_at: string
          visibility: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_date: string
          id?: string
          location_id?: string | null
          name: string
          start_date: string
          status?: Database["public"]["Enums"]["project_status"]
          type: Database["public"]["Enums"]["project_type"]
          updated_at?: string
          visibility?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          end_date?: string
          id?: string
          location_id?: string | null
          name?: string
          start_date?: string
          status?: Database["public"]["Enums"]["project_status"]
          type?: Database["public"]["Enums"]["project_type"]
          updated_at?: string
          visibility?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations_booking_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string | null
          created_at: string
          endpoint: string
          id: string
          p256dh: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auth?: string | null
          created_at?: string
          endpoint: string
          id?: string
          p256dh?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string | null
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string | null
          updated_at?: string
          user_id?: string
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
            foreignKeyName: "sales_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks_public_safe"
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
      security_events: {
        Row: {
          created_at: string | null
          details: Json | null
          event_type: string
          id: string
          ip_address: unknown
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          details?: Json | null
          event_type: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          details?: Json | null
          event_type?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      shared_links: {
        Row: {
          created_at: string
          created_by: string
          download_count: number
          expires_at: string | null
          file_id: string | null
          folder_id: string | null
          id: string
          is_active: boolean
          max_downloads: number | null
          password_hash: string | null
          permissions: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          download_count?: number
          expires_at?: string | null
          file_id?: string | null
          folder_id?: string | null
          id?: string
          is_active?: boolean
          max_downloads?: number | null
          password_hash?: string | null
          permissions?: string
          token?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          download_count?: number
          expires_at?: string | null
          file_id?: string | null
          folder_id?: string | null
          id?: string
          is_active?: boolean
          max_downloads?: number | null
          password_hash?: string | null
          permissions?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_links_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_links_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_storage_credentials: {
        Row: {
          access_key: string
          bucket_name: string
          created_at: string
          endpoint_url: string
          id: string
          is_active: boolean
          name: string
          region: string
          secret_key: string
          updated_at: string
        }
        Insert: {
          access_key: string
          bucket_name: string
          created_at?: string
          endpoint_url?: string
          id?: string
          is_active?: boolean
          name: string
          region?: string
          secret_key: string
          updated_at?: string
        }
        Update: {
          access_key?: string
          bucket_name?: string
          created_at?: string
          endpoint_url?: string
          id?: string
          is_active?: boolean
          name?: string
          region?: string
          secret_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      shared_storage_credentials_decrypted: {
        Row: {
          access_key: string
          bucket_name: string
          created_at: string
          endpoint_url: string
          id: string
          is_active: boolean
          name: string
          region: string
          secret_key: string
          updated_at: string
        }
        Insert: {
          access_key: string
          bucket_name: string
          created_at?: string
          endpoint_url?: string
          id: string
          is_active?: boolean
          name: string
          region?: string
          secret_key: string
          updated_at?: string
        }
        Update: {
          access_key?: string
          bucket_name?: string
          created_at?: string
          endpoint_url?: string
          id?: string
          is_active?: boolean
          name?: string
          region?: string
          secret_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      subtasks: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          id: string
          is_completed: boolean
          name: string
          position: number
          task_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_completed?: boolean
          name: string
          position?: number
          task_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_completed?: boolean
          name?: string
          position?: number
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_activity_log: {
        Row: {
          action: string
          created_at: string
          field_name: string | null
          id: string
          metadata: Json | null
          new_value: string | null
          old_value: string | null
          task_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          field_name?: string | null
          id?: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          task_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          field_name?: string | null
          id?: string
          metadata?: Json | null
          new_value?: string | null
          old_value?: string | null
          task_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_activity_log_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignees: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          mime_type: string | null
          task_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          task_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          task_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          content: string
          created_at: string
          edited_at: string | null
          id: string
          mentions: string[] | null
          task_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          mentions?: string[] | null
          task_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          mentions?: string[] | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_tags: {
        Row: {
          tag_id: string
          task_id: string
        }
        Insert: {
          tag_id: string
          task_id: string
        }
        Update: {
          tag_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "project_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_tags_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      uploads: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          notes: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          notes?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          notes?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          is_online: boolean
          last_seen: string
          updated_at: string
          user_id: string
        }
        Insert: {
          is_online?: boolean
          last_seen?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          is_online?: boolean
          last_seen?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      viewer_artwork_images: {
        Row: {
          alt_text: string | null
          artwork_id: string
          created_at: string | null
          height: number | null
          id: string
          large_url: string | null
          medium_url: string | null
          original_url: string
          position: number | null
          small_url: string | null
          updated_at: string | null
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          artwork_id: string
          created_at?: string | null
          height?: number | null
          id?: string
          large_url?: string | null
          medium_url?: string | null
          original_url: string
          position?: number | null
          small_url?: string | null
          updated_at?: string | null
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          artwork_id?: string
          created_at?: string | null
          height?: number | null
          id?: string
          large_url?: string | null
          medium_url?: string | null
          original_url?: string
          position?: number | null
          small_url?: string | null
          updated_at?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "viewer_artwork_images_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "viewer_artworks"
            referencedColumns: ["id"]
          },
        ]
      }
      viewer_artworks: {
        Row: {
          artist_name: string
          created_at: string | null
          created_by: string | null
          id: string
          slug: string | null
          title: string
          updated_at: string | null
          year: string | null
        }
        Insert: {
          artist_name: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          slug?: string | null
          title: string
          updated_at?: string | null
          year?: string | null
        }
        Update: {
          artist_name?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          slug?: string | null
          title?: string
          updated_at?: string | null
          year?: string | null
        }
        Relationships: []
      }
      viewer_embed_domains: {
        Row: {
          created_at: string | null
          domain: string
          id: string
          is_active: boolean | null
        }
        Insert: {
          created_at?: string | null
          domain: string
          id?: string
          is_active?: boolean | null
        }
        Update: {
          created_at?: string | null
          domain?: string
          id?: string
          is_active?: boolean | null
        }
        Relationships: []
      }
      webdav_access_logs: {
        Row: {
          created_at: string
          id: string
          ip_address: unknown
          method: string
          path: string
          status_code: number | null
          token_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: unknown
          method: string
          path: string
          status_code?: number | null
          token_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: unknown
          method?: string
          path?: string
          status_code?: number | null
          token_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webdav_access_logs_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "webdav_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      webdav_tokens: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          name: string
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name: string
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          token_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      artists_public_safe: {
        Row: {
          biography: string | null
          birth_year: number | null
          created_at: string | null
          death_year: number | null
          full_name: string | null
          id: string | null
          image_url: string | null
          nationality: string | null
          place_of_birth: string | null
          place_of_death: string | null
          representation_status: string | null
          surname_first_letter: string | null
          updated_at: string | null
        }
        Insert: {
          biography?: string | null
          birth_year?: number | null
          created_at?: string | null
          death_year?: number | null
          full_name?: string | null
          id?: string | null
          image_url?: string | null
          nationality?: string | null
          place_of_birth?: string | null
          place_of_death?: string | null
          representation_status?: string | null
          surname_first_letter?: string | null
          updated_at?: string | null
        }
        Update: {
          biography?: string | null
          birth_year?: number | null
          created_at?: string | null
          death_year?: number | null
          full_name?: string | null
          id?: string | null
          image_url?: string | null
          nationality?: string | null
          place_of_birth?: string | null
          place_of_death?: string | null
          representation_status?: string | null
          surname_first_letter?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      artwork_images_public_safe: {
        Row: {
          artwork_id: string | null
          display_order: number | null
          id: string | null
          image_url: string | null
          is_primary: boolean | null
          medium_url: string | null
          thumbnail_url: string | null
        }
        Insert: {
          artwork_id?: string | null
          display_order?: number | null
          id?: string | null
          image_url?: string | null
          is_primary?: boolean | null
          medium_url?: string | null
          thumbnail_url?: string | null
        }
        Update: {
          artwork_id?: string | null
          display_order?: number | null
          id?: string | null
          image_url?: string | null
          is_primary?: boolean | null
          medium_url?: string | null
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artwork_images_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artwork_images_artwork_id_fkey"
            columns: ["artwork_id"]
            isOneToOne: false
            referencedRelation: "artworks_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      artworks_public_safe: {
        Row: {
          artist_id: string | null
          artist_proofs: number | null
          available_works: string | null
          classification: string | null
          condition: string | null
          crate_depth: number | null
          crate_height: number | null
          crate_width: number | null
          created_at: string | null
          currency: string | null
          depth: number | null
          dimensions: string | null
          edition_size: number | null
          exhibition_history: string | null
          frame_depth: number | null
          frame_height: number | null
          frame_width: number | null
          has_crate: boolean | null
          height: number | null
          id: string | null
          image_url: string | null
          is_framed: boolean | null
          location_id: string | null
          materials: string | null
          medium_type: string | null
          price: number | null
          provenance: string | null
          signature_details: string | null
          signature_type: string | null
          status: string | null
          story: string | null
          title: string | null
          updated_at: string | null
          weight: number | null
          width: number | null
          year: number | null
        }
        Insert: {
          artist_id?: string | null
          artist_proofs?: number | null
          available_works?: string | null
          classification?: string | null
          condition?: string | null
          crate_depth?: number | null
          crate_height?: number | null
          crate_width?: number | null
          created_at?: string | null
          currency?: string | null
          depth?: number | null
          dimensions?: string | null
          edition_size?: number | null
          exhibition_history?: string | null
          frame_depth?: number | null
          frame_height?: number | null
          frame_width?: number | null
          has_crate?: boolean | null
          height?: number | null
          id?: string | null
          image_url?: string | null
          is_framed?: boolean | null
          location_id?: string | null
          materials?: string | null
          medium_type?: string | null
          price?: number | null
          provenance?: string | null
          signature_details?: string | null
          signature_type?: string | null
          status?: string | null
          story?: string | null
          title?: string | null
          updated_at?: string | null
          weight?: number | null
          width?: number | null
          year?: number | null
        }
        Update: {
          artist_id?: string | null
          artist_proofs?: number | null
          available_works?: string | null
          classification?: string | null
          condition?: string | null
          crate_depth?: number | null
          crate_height?: number | null
          crate_width?: number | null
          created_at?: string | null
          currency?: string | null
          depth?: number | null
          dimensions?: string | null
          edition_size?: number | null
          exhibition_history?: string | null
          frame_depth?: number | null
          frame_height?: number | null
          frame_width?: number | null
          has_crate?: boolean | null
          height?: number | null
          id?: string | null
          image_url?: string | null
          is_framed?: boolean | null
          location_id?: string | null
          materials?: string | null
          medium_type?: string | null
          price?: number | null
          provenance?: string | null
          signature_details?: string | null
          signature_type?: string | null
          status?: string | null
          story?: string | null
          title?: string | null
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
          {
            foreignKeyName: "artworks_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_settings_public_safe: {
        Row: {
          admin_notifications: boolean | null
          advance_booking_days: number | null
          auto_confirm: boolean | null
          booking_instructions: string | null
          buffer_time_minutes: number | null
          business_hours_end: string | null
          business_hours_start: string | null
          confirmation_emails: boolean | null
          created_at: string | null
          email_reminders: boolean | null
          id: string | null
          reminder_hours: number | null
          updated_at: string | null
          working_days: number[] | null
        }
        Insert: {
          admin_notifications?: boolean | null
          advance_booking_days?: number | null
          auto_confirm?: boolean | null
          booking_instructions?: string | null
          buffer_time_minutes?: number | null
          business_hours_end?: string | null
          business_hours_start?: string | null
          confirmation_emails?: boolean | null
          created_at?: string | null
          email_reminders?: boolean | null
          id?: string | null
          reminder_hours?: number | null
          updated_at?: string | null
          working_days?: number[] | null
        }
        Update: {
          admin_notifications?: boolean | null
          advance_booking_days?: number | null
          auto_confirm?: boolean | null
          booking_instructions?: string | null
          buffer_time_minutes?: number | null
          business_hours_end?: string | null
          business_hours_start?: string | null
          confirmation_emails?: boolean | null
          created_at?: string | null
          email_reminders?: boolean | null
          id?: string | null
          reminder_hours?: number | null
          updated_at?: string | null
          working_days?: number[] | null
        }
        Relationships: []
      }
      collection_websites_public_safe: {
        Row: {
          collection_id: string | null
          created_at: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          requires_password: boolean | null
          show_prices: boolean | null
          slug: string | null
          updated_at: string | null
        }
        Insert: {
          collection_id?: string | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          requires_password?: never
          show_prices?: boolean | null
          slug?: string | null
          updated_at?: string | null
        }
        Update: {
          collection_id?: string | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          requires_password?: never
          show_prices?: boolean | null
          slug?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_websites_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_websites_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections_public_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      collections_public_safe: {
        Row: {
          created_at: string | null
          description: string | null
          id: string | null
          name: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string | null
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string | null
          name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      locations_booking_safe: {
        Row: {
          id: string | null
          name: string | null
          type: string | null
        }
        Insert: {
          id?: string | null
          name?: string | null
          type?: string | null
        }
        Update: {
          id?: string | null
          name?: string | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      auto_link_artist_to_user: { Args: never; Returns: undefined }
      bulk_merge_duplicate_contacts: {
        Args: never
        Returns: {
          contacts_deleted: number
          groups_processed: number
        }[]
      }
      check_appointment_rate_limit: {
        Args: { client_ip: unknown }
        Returns: boolean
      }
      cleanup_old_chat_messages: { Args: never; Returns: undefined }
      cleanup_old_chat_messages_weekly: { Args: never; Returns: undefined }
      debug_folder_info: {
        Args: never
        Returns: {
          artist_linked_count: number
          folder_count: number
          root_folder_count: number
          user_created_count: number
        }[]
      }
      debug_webdav_folder_access: {
        Args: never
        Returns: {
          artist_id: string
          artist_user_id: string
          created_by: string
          current_user_id: string
          folder_id: string
          folder_name: string
          is_admin: boolean
          matches_artist: boolean
          matches_creator: boolean
          parent_folder_id: string
          should_be_accessible: boolean
        }[]
      }
      decrypt_credential: { Args: { ciphertext: string }; Returns: string }
      encrypt_credential: { Args: { plaintext: string }; Returns: string }
      enhanced_log_security_event: {
        Args: {
          _details?: Json
          _event_type: string
          _ip_address?: unknown
          _severity?: string
          _user_agent?: string
        }
        Returns: string
      }
      find_duplicate_contacts: {
        Args: never
        Returns: {
          contact_ids: string[]
          contact_names: string[]
          contact_phones: string[]
          contact_types: string[]
          created_dates: string[]
          duplicate_count: number
          email: string
        }[]
      }
      find_or_create_chat_room: {
        Args: { _participant_1_id: string; _participant_2_id: string }
        Returns: string
      }
      generate_short_id: { Args: { length?: number }; Returns: string }
      get_admin_storage_credentials_decrypted: {
        Args: never
        Returns: {
          access_key: string
          bucket_name: string
          created_at: string
          endpoint_url: string
          id: string
          is_active: boolean
          name: string
          region: string
          secret_key: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "admin_storage_credentials_decrypted"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_appointments_admin_only: {
        Args: never
        Returns: {
          client_email: string
          client_name: string
          client_phone: string
          end_datetime: string
          id: string
          notes: string
          start_datetime: string
          status: string
        }[]
      }
      get_appointments_for_admin: {
        Args: never
        Returns: {
          client_email: string
          client_name: string
          client_phone: string
          created_at: string
          end_datetime: string
          id: string
          notes: string
          start_datetime: string
          status: string
        }[]
      }
      get_artist_contacts_admin_only: {
        Args: never
        Returns: {
          email: string
          full_name: string
          id: string
          user_id: string
        }[]
      }
      get_artist_folder_access: {
        Args: { folder_id: string }
        Returns: {
          artist_id: string
          can_access: boolean
        }[]
      }
      get_artist_folder_overview: {
        Args: never
        Returns: {
          artist_id: string
          artist_name: string
          assignment_method: string
          folder_created_at: string
          folder_id: string
          folder_name: string
          status: string
          user_email: string
          user_id: string
        }[]
      }
      get_artist_id_for_current_user: { Args: never; Returns: string }
      get_artist_storage_credentials_decrypted: {
        Args: { p_artist_id?: string }
        Returns: {
          access_key: string
          artist_id: string
          bucket_name: string
          created_at: string
          endpoint_url: string
          id: string
          region: string
          secret_key: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "artist_storage_credentials_decrypted"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_artists_public: {
        Args: never
        Returns: {
          biography: string
          birth_year: number
          created_at: string
          death_year: number
          full_name: string
          id: string
          image_url: string
          nationality: string
          place_of_birth: string
          place_of_death: string
          representation_status: string
          surname_first_letter: string
          updated_at: string
        }[]
      }
      get_artists_public_safe: {
        Args: never
        Returns: {
          biography: string | null
          birth_year: number | null
          created_at: string | null
          death_year: number | null
          full_name: string | null
          id: string | null
          image_url: string | null
          nationality: string | null
          place_of_birth: string | null
          place_of_death: string | null
          representation_status: string | null
          surname_first_letter: string | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "artists_public_safe"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_available_appointment_slots: {
        Args: never
        Returns: {
          appointment_type: string
          date: string
          end_time: string
          slot_id: string
          start_time: string
        }[]
      }
      get_available_currencies: { Args: never; Returns: string[] }
      get_clients_admin_only: {
        Args: never
        Returns: {
          company: string
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string
          status: string
        }[]
      }
      get_collections_for_user: {
        Args: never
        Returns: {
          created_at: string
          description: string
          external_emails: string[]
          id: string
          name: string
          updated_at: string
        }[]
      }
      get_collections_public: {
        Args: never
        Returns: {
          created_at: string | null
          description: string | null
          id: string | null
          name: string | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "collections_public_safe"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_encryption_key: { Args: never; Returns: string }
      get_folder_artist_access: {
        Args: { folder_id_param: string }
        Returns: string
      }
      get_shared_storage_credentials_decrypted: {
        Args: never
        Returns: {
          access_key: string
          bucket_name: string
          created_at: string
          endpoint_url: string
          id: string
          is_active: boolean
          name: string
          region: string
          secret_key: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "shared_storage_credentials_decrypted"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_user_accessible_documents: {
        Args: { folder_id_param?: string }
        Returns: {
          artist_id: string
          can_read: boolean
          can_write: boolean
          document_id: string
          document_name: string
          file_size: number
          file_url: string
          folder_id: string
          mime_type: string
        }[]
      }
      get_user_accessible_folders: {
        Args: never
        Returns: {
          artist_id: string
          can_read: boolean
          can_write: boolean
          folder_id: string
          folder_name: string
          folder_path: string
          parent_folder_id: string
        }[]
      }
      get_user_accessible_folders_for_user: {
        Args: { user_id_param: string }
        Returns: {
          artist_id: string
          can_read: boolean
          can_write: boolean
          folder_id: string
          folder_name: string
          folder_path: string
          parent_folder_id: string
        }[]
      }
      get_user_projects: { Args: { user_uuid: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      insert_admin_storage_credentials: {
        Args: {
          p_access_key: string
          p_bucket_name: string
          p_endpoint_url?: string
          p_is_active?: boolean
          p_name: string
          p_region?: string
          p_secret_key: string
          p_user_id: string
        }
        Returns: string
      }
      insert_artist_storage_credentials: {
        Args: {
          p_access_key: string
          p_artist_id: string
          p_bucket_name: string
          p_endpoint_url?: string
          p_region?: string
          p_secret_key: string
        }
        Returns: string
      }
      insert_shared_storage_credentials: {
        Args: {
          p_access_key: string
          p_bucket_name: string
          p_endpoint_url?: string
          p_is_active?: boolean
          p_name: string
          p_region?: string
          p_secret_key: string
        }
        Returns: string
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_artist_artwork_in_collection: {
        Args: { _artwork_id: string }
        Returns: boolean
      }
      is_artist_owner: { Args: { artist_id_param: string }; Returns: boolean }
      is_artist_user: {
        Args: { _artist_id: string; _user_id: string }
        Returns: boolean
      }
      is_artwork_owned_by_current_user: {
        Args: { _artwork_id: string }
        Returns: boolean
      }
      is_collection_accessible_by_current_artist: {
        Args: { _collection_id: string }
        Returns: boolean
      }
      is_document_accessible_by_current_artist: {
        Args: { _document_id: string }
        Returns: boolean
      }
      is_user_admin: { Args: never; Returns: boolean }
      is_workspace_member: { Args: { _workspace_id: string }; Returns: boolean }
      link_artist_to_user: {
        Args: { artist_name: string; user_email: string }
        Returns: boolean
      }
      log_security_event: {
        Args: {
          _details?: Json
          _event_type: string
          _ip_address?: unknown
          _user_agent?: string
        }
        Returns: string
      }
      log_storage_encryption_event: { Args: never; Returns: undefined }
      mark_message_as_read: {
        Args: { message_id: string; reader_id: string }
        Returns: undefined
      }
      update_admin_storage_credentials: {
        Args: {
          p_access_key?: string
          p_bucket_name?: string
          p_endpoint_url?: string
          p_id: string
          p_is_active?: boolean
          p_name?: string
          p_region?: string
          p_secret_key?: string
        }
        Returns: boolean
      }
      validate_webdav_token: {
        Args: { token_text: string }
        Returns: {
          is_valid: boolean
          token_id: string
          user_id: string
        }[]
      }
      verify_no_public_access: {
        Args: never
        Returns: {
          grantee: string
          is_secure: boolean
          privilege_type: string
          table_name: string
        }[]
      }
    }
    Enums: {
      appointment_recurrence: "none" | "weekly" | "daily"
      appointment_status: "pending" | "confirmed" | "cancelled" | "completed"
      client_status: "active" | "inactive" | "prospect" | "lead" | "customer"
      communication_type: "email" | "phone" | "meeting" | "note" | "campaign"
      crm_campaign_status:
        | "draft"
        | "scheduled"
        | "sending"
        | "sent"
        | "archived"
      crm_contact_type:
        | "collector"
        | "curator"
        | "press"
        | "institution"
        | "artist"
        | "advisor"
        | "vip"
        | "prospect"
        | "other"
      crm_deal_status: "open" | "won" | "lost"
      crm_interaction_direction: "inbound" | "outbound" | "internal"
      crm_interaction_type:
        | "email"
        | "call"
        | "meeting"
        | "instagram_dm"
        | "whatsapp"
        | "wechat"
        | "line"
        | "note"
        | "task"
        | "other"
      crm_list_type: "static" | "dynamic"
      crm_organization_type:
        | "gallery"
        | "museum"
        | "foundation"
        | "fair"
        | "press"
        | "corporation"
        | "auction_house"
        | "other"
      deletion_request_status: "pending" | "approved" | "rejected"
      message_type: "text" | "file" | "image"
      project_status: "active" | "scheduled" | "completed" | "abandoned"
      project_type: "exhibition" | "fair" | "publication" | "talk" | "other"
      reference_type: "document" | "collection" | "artwork" | "artist"
      user_role: "gallery_admin" | "artist" | "external"
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
      appointment_recurrence: ["none", "weekly", "daily"],
      appointment_status: ["pending", "confirmed", "cancelled", "completed"],
      client_status: ["active", "inactive", "prospect", "lead", "customer"],
      communication_type: ["email", "phone", "meeting", "note", "campaign"],
      crm_campaign_status: [
        "draft",
        "scheduled",
        "sending",
        "sent",
        "archived",
      ],
      crm_contact_type: [
        "collector",
        "curator",
        "press",
        "institution",
        "artist",
        "advisor",
        "vip",
        "prospect",
        "other",
      ],
      crm_deal_status: ["open", "won", "lost"],
      crm_interaction_direction: ["inbound", "outbound", "internal"],
      crm_interaction_type: [
        "email",
        "call",
        "meeting",
        "instagram_dm",
        "whatsapp",
        "wechat",
        "line",
        "note",
        "task",
        "other",
      ],
      crm_list_type: ["static", "dynamic"],
      crm_organization_type: [
        "gallery",
        "museum",
        "foundation",
        "fair",
        "press",
        "corporation",
        "auction_house",
        "other",
      ],
      deletion_request_status: ["pending", "approved", "rejected"],
      message_type: ["text", "file", "image"],
      project_status: ["active", "scheduled", "completed", "abandoned"],
      project_type: ["exhibition", "fair", "publication", "talk", "other"],
      reference_type: ["document", "collection", "artwork", "artist"],
      user_role: ["gallery_admin", "artist", "external"],
    },
  },
} as const
