import { Artwork } from "@/hooks/use-artworks";
import { toast } from "sonner";
import Papa from 'papaparse';
import { CSVPreviewData, CSVRowObject, FieldMappings, ProcessedArtworkForImport } from "@/components/artworks/ArtworkFieldMapping.types";

// Helper to format CSV values properly
const formatCSVValue = (value: any): string => {
  if (value === null || value === undefined) return '';
  
  // Convert booleans to strings
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  
  // For strings, escape quotes and wrap in quotes if it contains commas or quotes
  if (typeof value === 'string') {
    const needsQuotes = value.includes(',') || value.includes('"') || value.includes('\n');
    if (needsQuotes) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
  
  return String(value);
};

// Export artworks to CSV
export const exportArtworksToCSV = (artworks: Artwork[], filename: string = 'artworks.csv') => {
  if (!artworks.length) {
    toast.error("No artworks to export");
    return;
  }

  // Get all possible headers from the artwork objects
  const allKeys = new Set<string>();
  artworks.forEach(artwork => {
    Object.keys(artwork).forEach(key => allKeys.add(key));
  });
  
  // Convert to array and sort alphabetically (but move id, title to front)
  const priorityKeys = ['id', 'title', 'artist_id', 'year', 'medium_type', 'materials', 'dimensions', 'price'];
  const headers = Array.from(allKeys).sort((a, b) => {
    const indexA = priorityKeys.indexOf(a);
    const indexB = priorityKeys.indexOf(b);
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    return a.localeCompare(b);
  });
  
  // Create the CSV header row
  const csvHeader = headers.map(formatCSVValue).join(',');
  
  // Create CSV rows for each artwork
  const csvRows = artworks.map(artwork => {
    return headers.map(header => {
      const value = artwork[header as keyof Artwork];
      return formatCSVValue(value);
    }).join(',');
  });
  
  // Combine header and data rows
  const csvContent = [csvHeader, ...csvRows].join('\n');
  
  // Create a blob and download link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  toast.success(`Exported ${artworks.length} artworks to CSV`);
};

// New function to parse CSV for preview and mapping
export const parseCSVForPreview = async (file: File): Promise<CSVPreviewData> => {
  return new Promise((resolve, reject) => {
    Papa.parse<CSVRowObject>(file, {
      header: true, // Use the first row as headers
      skipEmptyLines: true,
      dynamicTyping: false, // Keep all values as strings for now
      complete: (results) => {
        if (results.errors.length) {
          console.error("CSV parsing errors:", results.errors);
          reject(new Error(results.errors.map(e => e.message).join(', ')));
          return;
        }
        if (!results.meta.fields) {
          reject(new Error("Could not parse CSV headers."));
          return;
        }
        if (results.data.length === 0) {
          reject(new Error("CSV file has no data rows."));
          return;
        }

        const headers = results.meta.fields;
        const rows = results.data;
        const sampleData = results.data.slice(0, 5);

        resolve({ headers, rows, sampleData });
      },
      error: (error) => {
        console.error("PapaParse error:", error);
        reject(error);
      }
    });
  });
};

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
      const artworkField = mappings[csvHeader];
      if (artworkField && rawRow.hasOwnProperty(csvHeader)) {
        const value = rawRow[csvHeader];
        hasMappedData = true;

        // Type conversion based on field name (similar to original logic)
        if (value === null || value === undefined || value.trim() === '') {
          artwork[artworkField] = null;
        } else if (['price', 'height', 'width', 'depth', 'frame_height', 'frame_width', 'frame_depth', 'weight', 'crate_height', 'crate_width', 'crate_depth'].includes(artworkField)) {
          artwork[artworkField] = Number(value) || null;
        } else if (['is_framed', 'has_crate'].includes(artworkField)) {
          artwork[artworkField] = value.toLowerCase() === 'true';
        } else if (['year', 'edition_size', 'inventory_quantity', 'artist_proofs'].includes(artworkField)) {
          artwork[artworkField] = parseInt(value, 10) || null;
        } else {
          artwork[artworkField] = value;
        }
      }
    }
    
    if (!hasMappedData) continue; // Skip rows if no data was mapped from them

    // Ensure required fields have at least default values if not mapped or empty
    if (artwork.title === undefined || artwork.title === null || String(artwork.title).trim() === '') {
      artwork.title = 'Untitled';
    }
    // These defaults ensure the fields are present and correctly typed for ProcessedArtworkForImport
    if (!artwork.classification) artwork.classification = 'Unique';
    if (!artwork.medium_type) artwork.medium_type = 'Painting';
    if (!artwork.currency) artwork.currency = 'USD';
    
    // This check helps avoid pushing empty objects if all mapped fields were empty
    if (Object.keys(artwork).some(key => artwork[key] !== null && artwork[key] !== undefined && artwork[key] !== '')) {
       // Cast to ProcessedArtworkForImport here, as we've ensured the required fields are set
       artworks.push(artwork as ProcessedArtworkForImport);
    }
  }
  return artworks;
};

// The old parseCSVtoArtworks function is no longer directly used by ImportCSVDialog.
// It can be removed or kept if used elsewhere. For now, I'll comment it out to avoid confusion.
/*
// Parse CSV into artwork objects
export const parseCSVtoArtworks = async (file: File): Promise<Partial<Artwork>[]> => {
  // ... old implementation ...
};
*/

// Helper function to parse CSV line handling quoted fields
// This function is no longer needed if using PapaParse, but I'll keep it for now in case other parts of the app use it.
// If confirmed not used, it can be removed.
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      // Check if this is an escaped quote (double quote)
      if (i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++; // Skip the next quote
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  
  // Don't forget the last field
  result.push(current);
  
  return result;
}
