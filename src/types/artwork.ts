/**
 * Clean Artwork Type Definitions
 * Core types for the rebuilt artwork management system
 */

export interface Artwork {
  id: string;
  title: string;
  artist_id: string;
  year?: number;
  medium_type: string;
  materials?: string;
  classification: string;
  edition_size?: number;
  inventory_quantity?: number;
  available_works?: string;
  artist_proofs?: number;
  price?: number;
  currency: string;
  status: string;
  image_url?: string;
  dimensions?: string;
  width?: number;
  height?: number;
  depth?: number;
  condition?: string;
  story?: string;
  exhibition_history?: string;
  provenance?: string;
  location_id?: string;
  signature_type?: string;
  signature_details?: string;
  is_framed?: boolean;
  frame_height?: number;
  frame_width?: number;
  frame_depth?: number;
  weight?: number;
  has_crate?: boolean;
  crate_height?: number;
  crate_width?: number;
  crate_depth?: number;
  created_at: string;
  updated_at: string;
  ai_description?: string;
  additional_keywords?: string;
  
  // Relations
  artist_name?: string;
  artists?: {
    full_name: string;
    surname_first_letter?: string;
  };
  locations?: {
    name: string;
  } | null;
  artwork_images?: ArtworkImage[];
}

export interface ArtworkImage {
  id: string;
  artwork_id: string;
  image_url: string;
  is_primary: boolean;
  display_order: number;
  thumbnail_url?: string;
  medium_url?: string;
  thumbnail_storage_path?: string;
  medium_storage_path?: string;
  original_storage_path?: string;
  large_storage_path?: string;
  processed: boolean;
  processing_status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Artist {
  id: string;
  full_name: string;
  surname_first_letter?: string;
  user_id?: string;
  representation_status: string;
  email?: string;
  biography?: string;
  birth_year?: number;
  death_year?: number;
  nationality?: string;
  place_of_birth?: string;
  place_of_death?: string;
  image_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ArtworkFilters {
  search: string;
  artist: string | null;
  status: string | null;
  mediumType: string | null;
  yearRange: [number, number] | null;
  priceRange: [number, number] | null;
}

export type ImageTier = 'thumbnail' | 'medium' | 'large' | 'original';

export interface ResolvedImage {
  url: string;
  source: 'supabase' | 'cloudinary' | 'fallback' | 'placeholder';
  tier: ImageTier;
  width?: number;
  height?: number;
}