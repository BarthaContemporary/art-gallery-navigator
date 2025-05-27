
import { toast } from "sonner";
import { Artwork } from "@/hooks/use-artworks"; // Assuming Artwork type is available here
import { formatCSVValue } from './csv-formatting';

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
