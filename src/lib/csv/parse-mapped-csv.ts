
import type { FieldMappings, ProcessedArtworkForImport, CSVRowObject, ArtworkKeys, ValidatedProcessedArtwork } from "@/components/artworks/ArtworkFieldMapping.types";

export const parseMappedCSVToArtworks = (
  csvRows: CSVRowObject[],
  mappings: FieldMappings
): ValidatedProcessedArtwork[] => {
  const tempValidatedArtworks: ValidatedProcessedArtwork[] = [];

  csvRows.forEach((rawRow, index) => {
    const artwork: Record<string, any> = {};
    const warnings: string[] = [];
    const errors: string[] = []; 
    let hasMappedData = false;

    // Check if the rawRow has any actual data (not just empty strings or nulls)
    const rawRowHasContent = Object.values(rawRow).some(val => val !== null && String(val).trim() !== '');

    for (const csvHeader in mappings) {
      const artworkFieldKey = mappings[csvHeader];
      if (artworkFieldKey && rawRow.hasOwnProperty(csvHeader)) {
        const rawValue = rawRow[csvHeader];
        const valueStr = String(rawValue).trim();
        
        if (rawValue !== null && rawValue !== undefined && valueStr !== '') {
          hasMappedData = true; // Set hasMappedData only if the mapped field has a non-empty value
        }
        
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
          artwork[artworkField] = rawValue; 
        }
      }
    }
    
    if (rawRowHasContent && !hasMappedData) {
      errors.push("This row contains data, but no fields were successfully mapped from it. Please check your field mappings.");
    }

    // Defaulting and critical validation
    if (artwork.title === undefined || artwork.title === null || String(artwork.title).trim() === '') {
      artwork.title = 'Untitled';
      if (hasMappedData || errors.length === 0) { // Add warning only if it's not already an error or completely unmapped
         warnings.push(`Title was missing or empty; defaulted to "Untitled".`);
      }
    }
    if (artwork.classification === undefined || artwork.classification === null || String(artwork.classification).trim() === '') {
      artwork.classification = 'Unique'; 
      if (hasMappedData || errors.length === 0) {
        warnings.push(`Classification was missing or empty; defaulted to "Unique".`);
      }
    }
    if (artwork.medium_type === undefined || artwork.medium_type === null || String(artwork.medium_type).trim() === '') {
      artwork.medium_type = 'Painting'; 
      if (hasMappedData || errors.length === 0) {
        warnings.push(`Medium Type was missing or empty; defaulted to "Painting".`);
      }
    }
    if (artwork.currency === undefined || artwork.currency === null || String(artwork.currency).trim() === '') {
      artwork.currency = 'USD'; 
      if (hasMappedData || errors.length === 0) {
        warnings.push(`Currency was missing or empty; defaulted to "USD".`);
      }
    }

    const processedArtwork = artwork as ProcessedArtworkForImport;
    let isValid = errors.length === 0; 
    const isSelectedForImport = isValid; // Default selection based on validity

    // Only add if it's not an entirely empty object or if there are errors to show
    const artworkHasContent = Object.keys(processedArtwork).some(key => 
        processedArtwork[key as keyof ProcessedArtworkForImport] !== null && 
        processedArtwork[key as keyof ProcessedArtworkForImport] !== undefined && 
        String(processedArtwork[key as keyof ProcessedArtworkForImport]).trim() !== ''
    );

    if (artworkHasContent || errors.length > 0 || warnings.length > 0) {
      tempValidatedArtworks.push({
        artwork: processedArtwork,
        originalRowIndex: index + 1, 
        warnings,
        errors,
        isValid,
        isSelectedForImport 
      });
    }
  });

  // Duplicate Detection
  const finalValidatedArtworks: ValidatedProcessedArtwork[] = [];
  const artworkSignatures = new Map<string, number[]>(); // Stores signature -> [originalRowIndex]

  tempValidatedArtworks.forEach(item => {
    if (!item.isValid) { // Skip duplicate check for already invalid items, but still include them
      finalValidatedArtworks.push(item);
      return;
    }

    const title = String(item.artwork.title || '').trim().toLowerCase();
    const artistName = String(item.artwork.artist_name || '').trim().toLowerCase();
    // Only consider items with a title for duplicate checking, or if artist_name is also present
    if (title) { 
      const signature = `${title}::${artistName}`;
      if (artworkSignatures.has(signature)) {
        artworkSignatures.get(signature)!.push(item.originalRowIndex);
      } else {
        artworkSignatures.set(signature, [item.originalRowIndex]);
      }
    }
    finalValidatedArtworks.push(item); // Add current item to final list before processing its potential duplicates
  });
  
  artworkSignatures.forEach((rowIndices) => {
    if (rowIndices.length > 1) { // Found duplicates
      rowIndices.forEach((rowIndex, idx) => {
        const artworkIndex = finalValidatedArtworks.findIndex(art => art.originalRowIndex === rowIndex);
        if (artworkIndex !== -1) {
          const otherIndices = rowIndices.filter(r => r !== rowIndex).join(', ');
          let warningMsg = `Possible duplicate: Matches title and artist name of row(s) ${otherIndices}.`;
          if (idx > 0) { // Mark subsequent duplicates more clearly
            warningMsg = `Possible duplicate of row ${rowIndices[0]} (and potentially others: ${otherIndices}). Matches title and artist name.`;
          }
          // Add warning only if it doesn't exist to prevent multiple same warnings from different runs
          if (!finalValidatedArtworks[artworkIndex].warnings.includes(warningMsg)) {
             finalValidatedArtworks[artworkIndex].warnings.push(warningMsg);
          }
        }
      });
    }
  });

  return finalValidatedArtworks;
};
