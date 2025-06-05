
import { toast } from "sonner";

interface Artist {
  id: string;
  full_name: string;
  surname_first_letter?: string | null;
  birth_year: number | null;
  death_year?: number | null;
  place_of_birth?: string | null;
  place_of_death?: string | null;
  nationality: string | null;
  representation_status: string;
  biography: string | null;
  image_url: string | null;
  email?: string | null;
}

const formatCSVValue = (value: any): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return String(value);
};

export const exportArtistsToCSV = (artistsToExport: Artist[], filename: string = 'artists.csv') => {
  if (!artistsToExport.length) {
    toast.error("No artists to export");
    return;
  }
  const headers = [
    'id', 'full_name', 'surname_first_letter', 'email', 
    'birth_year', 'death_year', 'place_of_birth', 'place_of_death', 
    'nationality', 'representation_status', 'biography', 'image_url'
  ]; 
  const csvHeader = headers.map(formatCSVValue).join(',');
  const csvRows = artistsToExport.map(artist => {
    return headers.map(header => {
      const value = artist[header as keyof Artist];
      return formatCSVValue(value);
    }).join(',');
  });
  const csvContent = [csvHeader, ...csvRows].join('\n');
  const blob = new Blob([csvContent], {
    type: 'text/csv;charset=utf-8;'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  toast.success(`Exported ${artistsToExport.length} artists to CSV`);
};
