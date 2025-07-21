
export interface ArtworkFormData {
  title: string;
  artist_id: string;
  year: number;
  medium_type: 'Painting' | 'Sculpture' | 'Photography' | 'Work on Paper' | 'Installation' | 'Video' | 'Textile Arts' | 'Book';
  materials: string;
  classification: 'Unique' | 'Limited Edition' | 'Open Edition' | 'Unknown Edition';
  edition_size?: number;
  dimensions: string;
  price: number;
  currency: 'GBP' | 'EUR' | 'USD' | 'CHF';
  inventory_quantity?: number;
  available_works?: string; // Changed from number to string
  artist_proofs?: number;
  height?: number;
  width?: number;
  depth?: number;
  // New Framing/Crate fields
  is_framed: boolean;
  frame_height?: number;
  frame_width?: number;
  frame_depth?: number;
  weight?: number;
  has_crate: boolean;
  crate_height?: number;
  crate_width?: number;
  crate_depth?: number;
  // ...
  location_id: string;
  status: string;
  image_url: string;
  condition: string;
  signature_type: 'not signed' | 'hand-signed by artist' | 'signed on plate' | "stamped by artist's estate" | 'sticker label' | 'other';
  signature_details?: string;
  provenance?: string;
  story?: string;
  exhibition_history?: string;
  ai_description?: string;
  additional_keywords?: string;
}
