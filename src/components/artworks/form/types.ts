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
  location_id: string;
  status: string;
  image_url: string;
  currency: 'GBP' | 'EUR' | 'USD' | 'CHF';
  inventory_quantity?: number;
  available_works?: number;
  artist_proofs?: number;
  height?: number;
  width?: number;
  depth?: number;
  condition: string;
  signature_type: 'not signed' | 'hand-signed by artist' | 'signed on plate' | 'stamped by artist\'s estate' | 'sticker label' | 'other';
  signature_details?: string;
  provenance?: string;
  story?: string;
  exhibition_history?: string;
}
