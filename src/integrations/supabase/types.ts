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
        ]
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
          medium_height: number | null
          medium_url: string | null
          medium_width: number | null
          original_height: number | null
          original_size: number | null
          original_width: number | null
          processed: boolean | null
          thumbnail_height: number | null
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
          medium_height?: number | null
          medium_url?: string | null
          medium_width?: number | null
          original_height?: number | null
          original_size?: number | null
          original_width?: number | null
          processed?: boolean | null
          thumbnail_height?: number | null
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
          medium_height?: number | null
          medium_url?: string | null
          medium_width?: number | null
          original_height?: number | null
          original_size?: number | null
          original_width?: number | null
          processed?: boolean | null
          thumbnail_height?: number | null
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
            foreignKeyName: "artwork_location_history_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artwork_location_history_previous_location_id_fkey"
            columns: ["previous_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
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
            foreignKeyName: "collection_artworks_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
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
          end_date: string
          id: string
          name: string
          project_id: string
          start_date: string
          status: Database["public"]["Enums"]["project_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          end_date: string
          id?: string
          name: string
          project_id: string
          start_date: string
          status?: Database["public"]["Enums"]["project_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          end_date?: string
          id?: string
          name?: string
          project_id?: string
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
        }
        Relationships: [
          {
            foreignKeyName: "projects_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
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
            foreignKeyName: "sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_old_chat_messages: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_old_chat_messages_weekly: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      find_or_create_chat_room: {
        Args: { _participant_1_id: string; _participant_2_id: string }
        Returns: string
      }
      get_artist_id_for_current_user: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_user_projects: {
        Args: { user_uuid: string }
        Returns: string[]
      }
      has_role: {
        Args: {
          _user_id: string
          _role: Database["public"]["Enums"]["user_role"]
        }
        Returns: boolean
      }
      is_admin: {
        Args: { _user_id: string }
        Returns: boolean
      }
      is_artist_user: {
        Args: { _user_id: string; _artist_id: string }
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
      mark_message_as_read: {
        Args: { message_id: string; reader_id: string }
        Returns: undefined
      }
    }
    Enums: {
      appointment_recurrence: "none" | "weekly" | "daily"
      appointment_status: "pending" | "confirmed" | "cancelled" | "completed"
      client_status: "active" | "inactive" | "prospect" | "lead" | "customer"
      communication_type: "email" | "phone" | "meeting" | "note" | "campaign"
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
      appointment_recurrence: ["none", "weekly", "daily"],
      appointment_status: ["pending", "confirmed", "cancelled", "completed"],
      client_status: ["active", "inactive", "prospect", "lead", "customer"],
      communication_type: ["email", "phone", "meeting", "note", "campaign"],
      deletion_request_status: ["pending", "approved", "rejected"],
      message_type: ["text", "file", "image"],
      project_status: ["active", "scheduled", "completed", "abandoned"],
      project_type: ["exhibition", "fair", "publication", "talk", "other"],
      reference_type: ["document", "collection", "artwork", "artist"],
      user_role: ["gallery_admin", "artist", "external"],
    },
  },
} as const
