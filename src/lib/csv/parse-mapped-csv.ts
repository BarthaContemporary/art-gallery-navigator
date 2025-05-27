
import type { FieldMappings, ProcessedArtworkForImport, CSVRowObject, ArtworkKeys } from "@/components/artworks/ArtworkFieldMapping.types";

// Modified parseCSVtoArtworks to use mappings and return a more specific type
export const parseMappedCSVToArtworks = (
  csvRows: CSVRowObject[],
  mappings: FieldMappings
): ProcessedArtworkForImport[] => {
  const artworks: ProcessedArtworkForImport[] = [];

  for (const rawRow of csvRows) {
    const artwork: Record<string, any> = {}; // Start with a less specific type internally
    let hasMappedData = false;

    for (const csvHeader in mappings) {
      const artworkFieldKey = mappings[csvHeader]; // This can be ArtworkKeys | 'artist_name' | null
      if (artworkFieldKey && rawRow.hasOwnProperty(csvHeader)) {
        const value = rawRow[csvHeader];
        hasMappedData = true;
        const artworkField = artworkFieldKey as ArtworkKeys | 'artist_name'; // Cast for use

        // Type conversion based on field name
        if (value === null || value === undefined || String(value).trim() === '') {
          artwork[artworkField] = null;
        } else if (['price', 'height', 'width', 'depth', 'frame_height', 'frame_width', 'frame_depth', 'weight', 'crate_height', 'crate_width', 'crate_depth'].includes(artworkField)) {
          artwork[artworkField] = Number(value) || null;
        } else if (['is_framed', 'has_crate'].includes(artworkField)) {
          artwork[artworkField] = String(value).toLowerCase() === 'true';
        } else if (['year', 'edition_size', 'inventory_quantity', 'artist_proofs'].includes(artworkField)) {
          artwork[artworkField] = parseInt(String(value), 10) || null;
        } else {
          artwork[artworkField] = value; // Handles strings like title, artist_name, etc.
        }
      }
    }
    
    if (!hasMappedData) continue; // Skip rows if no data was mapped from them

    // Ensure required fields have at least default values if not mapped or empty
    if (artwork.title === undefined || artwork.title === null || String(artwork.title).trim() === '') {
      artwork.title = 'Untitled';
    }
    // These defaults ensure the fields are present and correctly typed for ProcessedArtworkForImport
    if (artwork.classification === undefined || artwork.classification === null || String(artwork.classification).trim() === '') {
      artwork.classification = 'Unique';
    }
    if (artwork.medium_type === undefined || artwork.medium_type === null || String(artwork.medium_type).trim() === '') {
      artwork.medium_type = 'Painting';
    }
    if (artwork.currency === undefined || artwork.currency === null || String(artwork.currency).trim() === '') {
      artwork.currency = 'USD';
    }
    
    // This check helps avoid pushing empty objects if all mapped fields were empty
    if (Object.keys(artwork).some(key => artwork[key] !== null && artwork[key] !== undefined && String(artwork[key]).trim() !== '')) {
       artworks.push(artwork as ProcessedArtworkForImport);
    }
  }
  return artworks;
};

