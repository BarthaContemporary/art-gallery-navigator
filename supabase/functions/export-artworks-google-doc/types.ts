
export interface ArtworkImage {
  id: string;
  artwork_id: string;
  image_url: string;
  is_primary: boolean;
  display_order: number;
  processed?: boolean;
  thumbnail_url?: string | null;
  medium_url?: string | null;
}

export interface Artwork {
  id: string;
  title: string;
  artist_name?: string;
  year: number | null;
  medium_type: string;
  materials: string | null;
  dimensions: string | null;
  price: number | null;
  currency: string;
  status: string | null;
  location_id: string | null;
  artwork_images?: ArtworkImage[];
}

export interface RequestBody {
  artworks: Artwork[];
  title?: string;
}
