
import { Artwork } from "@/hooks/use-artworks";
import { toast } from "sonner";

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

// Parse CSV into artwork objects
export const parseCSVtoArtworks = async (file: File): Promise<Partial<Artwork>[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) {
          reject(new Error("Failed to read file"));
          return;
        }
        
        // Split into lines and handle quoted fields properly
        const lines = text.split('\n');
        if (lines.length < 2) {
          reject(new Error("CSV file must have a header row and at least one data row"));
          return;
        }
        
        // Parse headers (first line)
        const headers = parseCSVLine(lines[0]);
        
        // Parse data rows
        const artworks: Partial<Artwork>[] = [];
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue; // Skip empty lines
          
          const values = parseCSVLine(line);
          if (values.length !== headers.length) {
            console.warn(`Line ${i+1} has ${values.length} values but should have ${headers.length}`);
            continue;
          }
          
          const artwork: Record<string, any> = {};
          headers.forEach((header, index) => {
            const value = values[index];
            
            // Type conversion based on field name
            if (value === '') {
              artwork[header] = null;
            } else if (['price', 'height', 'width', 'depth', 'frame_height', 'frame_width', 'frame_depth', 'weight', 'crate_height', 'crate_width', 'crate_depth'].includes(header)) {
              artwork[header] = Number(value) || null;
            } else if (['is_framed', 'has_crate'].includes(header)) {
              artwork[header] = value.toLowerCase() === 'true';
            } else if (['year', 'edition_size', 'inventory_quantity', 'artist_proofs'].includes(header)) {
              artwork[header] = parseInt(value) || null;
            } else {
              artwork[header] = value;
            }
          });
          
          // Ensure required fields have at least default values
          if (!artwork.classification) {
            artwork.classification = 'Unique';
          }
          
          if (!artwork.medium_type) {
            artwork.medium_type = 'Painting';
          }
          
          if (!artwork.title) {
            artwork.title = 'Untitled';
          }
          
          if (!artwork.currency) {
            artwork.currency = 'USD';
          }
          
          artworks.push(artwork as Partial<Artwork>);
        }
        
        resolve(artworks);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error("Error reading file"));
    };
    
    reader.readAsText(file);
  });
};

// Helper function to parse CSV line handling quoted fields
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
