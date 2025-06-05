
import Papa from 'papaparse';
import type { CSVPreviewData, CSVRowObject } from "@/components/artworks/ArtworkFieldMapping.types";

// New function to parse CSV for preview and mapping
export const parseCSVForPreview = async (file: File): Promise<CSVPreviewData> => {
  console.log("Starting CSV preview parsing for file:", file.name);
  
  return new Promise((resolve, reject) => {
    Papa.parse<CSVRowObject>(file, {
      header: true, // Use the first row as headers
      skipEmptyLines: true,
      dynamicTyping: false, // Keep all values as strings for now
      transformHeader: (header: string) => {
        // Clean up headers - trim whitespace and normalize
        return header.trim();
      },
      complete: (results) => {
        console.log("Papa Parse results:", results);
        
        if (results.errors.length) {
          console.error("CSV parsing errors:", results.errors);
          const errorMessages = results.errors
            .filter(error => error.type !== 'Quotes') // Filter out quote warnings
            .map(e => e.message);
          
          if (errorMessages.length > 0) {
            reject(new Error(`CSV parsing errors: ${errorMessages.join(', ')}`));
            return;
          }
        }
        
        if (!results.meta.fields) {
          console.error("No CSV headers found");
          reject(new Error("Could not parse CSV headers. Please ensure your CSV file has a header row."));
          return;
        }
        
        if (results.data.length === 0) {
          console.error("No data rows found");
          reject(new Error("CSV file has no data rows. Please ensure your file contains data."));
          return;
        }

        // Filter out completely empty rows
        const filteredRows = results.data.filter(row => {
          return Object.values(row).some(value => 
            value !== null && value !== undefined && String(value).trim() !== ''
          );
        });

        if (filteredRows.length === 0) {
          reject(new Error("No valid data rows found in CSV file."));
          return;
        }

        const headers = results.meta.fields;
        const rows = filteredRows;
        const sampleData = filteredRows.slice(0, 5);

        console.log("CSV parsing successful:", {
          headers: headers.length,
          totalRows: rows.length,
          sampleRows: sampleData.length
        });

        resolve({ headers, rows, sampleData });
      },
      error: (error) => {
        console.error("PapaParse error:", error);
        reject(new Error(`Failed to parse CSV file: ${error.message || 'Unknown error'}`));
      }
    });
  });
};
