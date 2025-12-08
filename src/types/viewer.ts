/**
 * Image Viewer Module Types
 */

export interface ViewerArtwork {
  id: string;
  artist_name: string;
  title: string;
  year: string | null;
  slug: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  images?: ViewerArtworkImage[];
}

export interface ViewerArtworkImage {
  id: string;
  artwork_id: string;
  original_url: string;
  alt_text: string | null;
  width: number | null;
  height: number | null;
  file_size: number | null;
  small_url: string | null;
  medium_url: string | null;
  large_url: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface ViewerEmbedDomain {
  id: string;
  domain: string;
  is_active: boolean;
  created_at: string;
}

export interface ViewerSettings {
  initialMode: 'fit' | 'fill';
  dark: boolean;
  metadata: boolean;
}
