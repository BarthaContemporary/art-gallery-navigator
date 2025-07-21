

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

  // At least one of these should be present for classification
  if (!artwork.classification || artwork.classification.trim() === '') {
    warnings.push('Classification not specified - will use default "Other"');
  }

  // Medium type should be present
  if (!artwork.medium_type || artwork.medium_type.trim() === '') {
    warnings.push('Medium type not specified - will use default "Mixed Media"');
  }

  // Currency should be present if price is specified
  if (artwork.price !== null && artwork.price !== undefined && (!artwork.currency || artwork.currency.trim() === '')) {
    warnings.push('Currency not specified but price is present - will use USD');
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
      // Set more lenient default values
      classification: 'Unique' as const,
      medium_type: 'Painting' as const,
      currency: 'USD' as const,
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
        case 'signature_type':
        case 'artist_id':
        case 'location_id':
          const cleanValue = cleanFieldValue(rawValue);
          if (cleanValue !== null) {
            (artwork as any)[artworkField] = cleanValue;
          }
          break;

        case 'classification':
          const cleanClassification = cleanFieldValue(rawValue);
          if (cleanClassification !== null) {
            // Normalize classification to match database constraints
            const classification = cleanClassification.toLowerCase();
            if (classification.includes('unique') || classification === 'one of a kind' || classification === 'original') {
              (artwork as any).classification = 'Unique';
            } else if (classification.includes('limited') || classification.includes('edition')) {
              (artwork as any).classification = 'Limited Edition';
            } else {
              // Default fallback
              (artwork as any).classification = 'Unique';
            }
          }
          break;

        case 'medium_type':
          const cleanMediumType = cleanFieldValue(rawValue);
          if (cleanMediumType !== null) {
            // Normalize medium_type to match database constraints
            const mediumType = cleanMediumType.toLowerCase();
            if (mediumType.includes('paint') || mediumType.includes('oil') || mediumType.includes('acrylic') || mediumType.includes('watercolor')) {
              (artwork as any).medium_type = 'Painting';
            } else if (mediumType.includes('sculpt') || mediumType.includes('bronze') || mediumType.includes('clay') || mediumType.includes('ceramic')) {
              (artwork as any).medium_type = 'Sculpture';
            } else if (mediumType.includes('photo') || mediumType.includes('digital print')) {
              (artwork as any).medium_type = 'Photography';
            } else if (mediumType.includes('drawing') || mediumType.includes('print') || mediumType.includes('paper') || mediumType.includes('collage') || mediumType.includes('etching') || mediumType.includes('lithograph')) {
              (artwork as any).medium_type = 'Work on Paper';
            } else if (mediumType.includes('textile') || mediumType.includes('fabric') || mediumType.includes('fiber')) {
              (artwork as any).medium_type = 'Textile Arts';
            } else if (mediumType.includes('install') || mediumType.includes('mixed media') || mediumType.includes('video') || mediumType.includes('performance')) {
              (artwork as any).medium_type = 'Installation';
            } else {
              // Default fallback
              (artwork as any).medium_type = 'Painting';
            }
          }
          break;

        case 'currency':
          const cleanCurrency = cleanFieldValue(rawValue);
          if (cleanCurrency !== null) {
            (artwork as any).currency = cleanCurrency;
          }
          break;

        case 'artist_name':
          const artistName = cleanFieldValue(rawValue);
          if (artistName !== null) {
            (artwork as any).artist_name = artistName;
          }
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
          const numericValue = parseNumericValue(rawValue);
          if (numericValue !== null) {
            (artwork as any)[artworkField] = numericValue;
          }
          break;

        case 'is_framed':
        case 'has_crate':
          const boolValue = parseBooleanValue(rawValue);
          if (boolValue !== null) {
            (artwork as any)[artworkField] = boolValue;
          }
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
  const validCount = validatedArtworks.filter(va => va.isValid).length;
  console.log(`Valid artworks: ${validCount}/${validatedArtworks.length}`);
  
  return validatedArtworks;
}
