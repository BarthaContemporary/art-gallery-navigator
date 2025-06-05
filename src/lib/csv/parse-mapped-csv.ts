
import type { CSVRowObject, FieldMappings, ValidatedProcessedArtwork, ProcessedArtworkForImport } from "@/components/artworks/ArtworkFieldMapping.types";

// Helper function to clean and validate field values
function cleanFieldValue(value: any): string | null {
  if (value === null || value === undefined) return null;
  const stringValue = String(value).trim();
  return stringValue === '' ? null : stringValue;
}

// Helper function to parse numeric values
function parseNumericValue(value: any): number | null {
  if (value === null || value === undefined) return null;
  const stringValue = String(value).trim();
  if (stringValue === '') return null;
  
  const numericValue = parseFloat(stringValue);
  return isNaN(numericValue) ? null : numericValue;
}

// Helper function to parse boolean values
function parseBooleanValue(value: any): boolean | null {
  if (value === null || value === undefined) return null;
  const stringValue = String(value).trim().toLowerCase();
  if (stringValue === '') return null;
  
  return ['true', 'yes', '1', 'on'].includes(stringValue);
}

// Validation function for required fields
function validateRequiredFields(artwork: Partial<ProcessedArtworkForImport>): { errors: string[], warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Title is required
  if (!artwork.title || artwork.title.trim() === '') {
    errors.push('Title is required');
  }

  // Classification is required
  if (!artwork.classification || artwork.classification.trim() === '') {
    errors.push('Classification is required');
  }

  // Medium type is required
  if (!artwork.medium_type || artwork.medium_type.trim() === '') {
    errors.push('Medium type is required');
  }

  // Currency is required
  if (!artwork.currency || artwork.currency.trim() === '') {
    errors.push('Currency is required');
  }

  // Artist validation - either artist_id or artist_name should be provided
  if (!artwork.artist_id && !artwork.artist_name) {
    warnings.push('No artist information provided (artist_id or artist_name)');
  }

  // Price validation
  if (artwork.price !== null && artwork.price !== undefined && artwork.price < 0) {
    warnings.push('Price should not be negative');
  }

  // Year validation
  if (artwork.year !== null && artwork.year !== undefined) {
    const currentYear = new Date().getFullYear();
    if (artwork.year < 1000 || artwork.year > currentYear + 10) {
      warnings.push(`Year ${artwork.year} seems unusual`);
    }
  }

  return { errors, warnings };
}

// Main function to parse CSV data to artworks
export function parseMappedCSVToArtworks(
  csvRows: CSVRowObject[],
  fieldMappings: FieldMappings
): ValidatedProcessedArtwork[] {
  console.log("Starting to parse CSV rows to artworks:", csvRows.length, "rows");
  console.log("Field mappings:", fieldMappings);

  const validatedArtworks: ValidatedProcessedArtwork[] = [];

  csvRows.forEach((row, index) => {
    console.log(`Processing row ${index + 1}:`, row);
    
    const artwork: Partial<ProcessedArtworkForImport> = {
      // Set default required values
      classification: 'Other',
      medium_type: 'Mixed Media',
      currency: 'USD',
    };

    // Process each mapped field
    Object.entries(fieldMappings).forEach(([csvHeader, artworkField]) => {
      if (!artworkField || csvHeader === '' || !row.hasOwnProperty(csvHeader)) {
        return;
      }

      const rawValue = row[csvHeader];
      console.log(`Mapping ${csvHeader} -> ${artworkField}:`, rawValue);

      switch (artworkField) {
        case 'title':
        case 'materials':
        case 'dimensions':
        case 'status':
        case 'image_url':
        case 'signature_details':
        case 'provenance':
        case 'story':
        case 'exhibition_history':
        case 'condition':
        case 'classification':
        case 'medium_type':
        case 'currency':
        case 'signature_type':
        case 'artist_id':
        case 'location_id':
          artwork[artworkField] = cleanFieldValue(rawValue);
          break;

        case 'artist_name':
          artwork.artist_name = cleanFieldValue(rawValue);
          break;

        case 'year':
        case 'edition_size':
        case 'price':
        case 'inventory_quantity':
        case 'available_works':
        case 'artist_proofs':
        case 'height':
        case 'width':
        case 'depth':
        case 'frame_height':
        case 'frame_width':
        case 'frame_depth':
        case 'weight':
        case 'crate_height':
        case 'crate_width':
        case 'crate_depth':
          artwork[artworkField] = parseNumericValue(rawValue);
          break;

        case 'is_framed':
        case 'has_crate':
          artwork[artworkField] = parseBooleanValue(rawValue);
          break;

        default:
          console.warn(`Unknown artwork field: ${artworkField}`);
      }
    });

    // Validate the artwork
    const { errors, warnings } = validateRequiredFields(artwork);
    const isValid = errors.length === 0;

    console.log(`Row ${index + 1} validation:`, { isValid, errors, warnings });

    validatedArtworks.push({
      artwork: artwork as ProcessedArtworkForImport,
      originalRowIndex: index + 1,
      warnings,
      errors,
      isValid,
      isSelectedForImport: isValid, // Auto-select valid artworks
    });
  });

  console.log("Finished parsing CSV rows. Validated artworks:", validatedArtworks.length);
  return validatedArtworks;
}
