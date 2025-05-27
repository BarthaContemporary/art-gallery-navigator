
import Papa from 'papaparse';
import type { CSVPreviewData, CSVRowObject } from "@/components/artworks/ArtworkFieldMapping.types";

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
