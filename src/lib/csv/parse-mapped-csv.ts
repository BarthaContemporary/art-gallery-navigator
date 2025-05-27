import type { FieldMappings, ProcessedArtworkForImport, CSVRowObject, ArtworkKeys, ValidatedProcessedArtwork } from "@/components/artworks/ArtworkFieldMapping.types";

export const parseMappedCSVToArtworks = (
  csvRows: CSVRowObject[],
  mappings: FieldMappings
): ValidatedProcessedArtwork[] => {
  const validatedArtworks: ValidatedProcessedArtwork[] = [];

  csvRows.forEach((rawRow, index) => {
    const artwork: Record<string, any> = {};
    const warnings: string[] = [];
    const errors: string[] = []; // For critical issues making the row un-importable
    let hasMappedData = false;

    for (const csvHeader in mappings) {
      const artworkFieldKey = mappings[csvHeader];
      if (artworkFieldKey && rawRow.hasOwnProperty(csvHeader)) {
        const rawValue = rawRow[csvHeader];
        const valueStr = String(rawValue).trim();
        hasMappedData = true;
        const artworkField = artworkFieldKey as ArtworkKeys | 'artist_name';

        if (rawValue === null || rawValue === undefined || valueStr === '') {
          artwork[artworkField] = null;
        } else if (['price', 'height', 'width', 'depth', 'frame_height', 'frame_width', 'frame_depth', 'weight', 'crate_height', 'crate_width', 'crate_depth'].includes(artworkField)) {
          const numValue = Number(valueStr);
          if (isNaN(numValue)) {
            warnings.push(`Value "${rawValue}" for CSV column "${csvHeader}" (mapped to ${artworkField}) is not a valid number and was set to null.`);
            artwork[artworkField] = null;
          } else {
            artwork[artworkField] = numValue;
          }
        } else if (['is_framed', 'has_crate'].includes(artworkField)) {
          artwork[artworkField] = valueStr.toLowerCase() === 'true';
        } else if (['year', 'edition_size', 'inventory_quantity', 'artist_proofs'].includes(artworkField)) {
          const intValue = parseInt(valueStr, 10);
          if (isNaN(intValue)) {
            warnings.push(`Value "${rawValue}" for CSV column "${csvHeader}" (mapped to ${artworkField}) is not a valid integer and was set to null.`);
            artwork[artworkField] = null;
          } else {
            artwork[artworkField] = intValue;
          }
        } else {
          artwork[artworkField] = rawValue; // Handles strings
        }
      }
    }
    
    if (!hasMappedData && Object.keys(rawRow).length > 0) {
      // If no data was mapped from this row, we might skip it or note it.
      // For now, if it becomes an "empty" artwork, it might be filtered later.
      // Consider adding a specific warning if a row has data but none of it is mapped.
    }

    // Defaulting and critical validation
    if (artwork.title === undefined || artwork.title === null || String(artwork.title).trim() === '') {
      artwork.title = 'Untitled';
      warnings.push(`Title was missing or empty; defaulted to "Untitled".`);
    }
    // These defaults ensure the fields are present for ProcessedArtworkForImport
    if (artwork.classification === undefined || artwork.classification === null || String(artwork.classification).trim() === '') {
      artwork.classification = 'Unique'; 
      warnings.push(`Classification was missing or empty; defaulted to "Unique".`);
    }
    if (artwork.medium_type === undefined || artwork.medium_type === null || String(artwork.medium_type).trim() === '') {
      artwork.medium_type = 'Painting'; 
      warnings.push(`Medium Type was missing or empty; defaulted to "Painting".`);
    }
    if (artwork.currency === undefined || artwork.currency === null || String(artwork.currency).trim() === '') {
      artwork.currency = 'USD'; 
      warnings.push(`Currency was missing or empty; defaulted to "USD".`);
    }

    // Example of a critical error: If after mapping, artist_id is not set and artist_name is also missing/empty.
    // This logic is handled more robustly in `performArtworkImport`, so we might not need explicit errors here for this.
    // For now, `isValid` will primarily depend on if essential parsing created an importable object.
    // Let's assume all rows that produce an artwork object (even with warnings) are "valid" for import attempt.
    // True "errors" that prevent import attempt are better handled by `performArtworkImport`'s feedback.
    // For client-side, `isValid` means it can be *attempted* to be imported.

    const processedArtwork = artwork as ProcessedArtworkForImport;
    const isValid = errors.length === 0; 
    // Initialize isSelectedForImport based on isValid. User can then toggle it.
    // Items with errors (isValid = false) should not be selectable for import.
    const isSelectedForImport = isValid;

    // Only add if it's not an entirely empty object after processing (e.g. all mapped fields were empty)
    if (Object.keys(processedArtwork).some(key => processedArtwork[key as keyof ProcessedArtworkForImport] !== null && processedArtwork[key as keyof ProcessedArtworkForImport] !== undefined && String(processedArtwork[key as keyof ProcessedArtworkForImport]).trim() !== '')) {
      validatedArtworks.push({
        artwork: processedArtwork,
        originalRowIndex: index + 1, 
        warnings,
        errors,
        isValid,
        isSelectedForImport 
      });
    }
  });
  return validatedArtworks;
};
