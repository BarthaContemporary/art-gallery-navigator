
import { Artwork } from "@/hooks/use-artworks";

export type ArtworkKeys = keyof Artwork;

export interface CSVRowObject {
  [key: string]: string;
}

export interface CSVPreviewData {
  headers: string[];
  rows: CSVRowObject[];
  sampleData: CSVRowObject[]; // A few rows for preview
}

export type FieldMappings = Record<string, ArtworkKeys | 'artist_name' | null | ''>; 

// This type ensures that after parsing and defaulting, these fields are definitely present.
export type ProcessedArtworkForImport = Partial<Artwork> & 
  Pick<Artwork, 'title' | 'classification' | 'medium_type' | 'currency'>;

// New type to include validation information alongside the parsed artwork
export interface ValidatedProcessedArtwork {
  artwork: ProcessedArtworkForImport;
  originalRowIndex: number; // To help user identify the row in their CSV
  warnings: string[];
  errors: string[];
  isValid: boolean; // True if errors array is empty
  isSelectedForImport: boolean; // New flag for row exclusion
}

// Define the list of available artwork fields for mapping
export const ARTWORK_FIELDS_FOR_MAPPING: Array<{ value: ArtworkKeys | 'artist_name'; label: string }> = [
  { value: "title", label: "Title" },
  { value: "artist_id", label: "Artist ID (Direct)" },
  { value: "artist_name", label: "Artist Name (Lookup/Create)" },
  { value: "year", label: "Year" },
  { value: "medium_type", label: "Medium Type" },
  { value: "materials", label: "Materials" },
  { value: "classification", label: "Classification" },
  { value: "edition_size", label: "Edition Size" },
  { value: "dimensions", label: "Dimensions (Combined)" },
  { value: "price", label: "Price" },
  { value: "currency", label: "Currency" },
  { value: "status", label: "Status" },
  { value: "image_url", label: "Primary Image URL" },
  { value: "location_id", label: "Location ID" },
  { value: "inventory_quantity", label: "Inventory Quantity" },
  { value: "available_works", label: "Available Works" },
  { value: "artist_proofs", label: "Artist Proofs" },
  { value: "signature_type", label: "Signature Type" },
  { value: "condition", label: "Condition" },
  { value: "signature_details", label: "Signature Details" },
  { value: "provenance", label: "Provenance" },
  { value: "story", label: "Story" },
  { value: "exhibition_history", label: "Exhibition History" },
  { value: "height", label: "Height (cm)" },
  { value: "width", label: "Width (cm)" },
  { value: "depth", label: "Depth (cm)" },
  { value: "is_framed", label: "Is Framed?" },
  { value: "frame_height", label: "Frame Height (cm)" },
  { value: "frame_width", label: "Frame Width (cm)" },
  { value: "frame_depth", label: "Frame Depth (cm)" },
  { value: "weight", label: "Weight (kg)" },
  { value: "has_crate", label: "Has Crate?" },
  { value: "crate_height", label: "Crate Height (cm)" },
  { value: "crate_width", label: "Crate Width (cm)" },
  { value: "crate_depth", label: "Crate Depth (cm)" },
];
