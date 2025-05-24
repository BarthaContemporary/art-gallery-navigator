import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SearchBar } from "@/components/artists/SearchBar";
import { ArtistCard } from "@/components/artists/ArtistCard";
import { LoadingSkeleton } from "@/components/artists/LoadingSkeleton";
import { Button } from "@/components/ui/button";
import { Download, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import { CreateArtistDialog } from "@/components/artists/CreateArtistDialog";

interface Artist {
  id: string;
  full_name: string;
  surname_first_letter?: string | null; // New
  birth_year: number | null;
  death_year?: number | null; // New
  place_of_birth?: string | null; // New
  place_of_death?: string | null; // New
  nationality: string | null;
  representation_status: string;
  biography: string | null;
  image_url: string | null;
  email?: string | null;
}
const Artists = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [createArtistDialogOpen, setCreateArtistDialogOpen] = useState(false);
  const {
    data: artists,
    isLoading
  } = useQuery({
    queryKey: ['artists'],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('artists').select('*').order('full_name');
      if (error) throw error;
      return data as Artist[];
    }
  });
  const filteredArtists = artists?.filter(artist => 
    artist.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (artist.nationality && artist.nationality.toLowerCase().includes(searchTerm.toLowerCase())) || 
    (artist.email && artist.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (artist.surname_first_letter && artist.surname_first_letter.toLowerCase().includes(searchTerm.toLowerCase())) || // Include new field in search
    (artist.place_of_birth && artist.place_of_birth.toLowerCase().includes(searchTerm.toLowerCase())) || // Include new field in search
    (artist.place_of_death && artist.place_of_death.toLowerCase().includes(searchTerm.toLowerCase()))    // Include new field in search
  ) ?? [];
  const formatCSVValue = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return String(value);
  };
  const exportArtistsToCSV = (artistsToExport: Artist[], filename: string = 'artists.csv') => {
    if (!artistsToExport.length) {
      toast.error("No artists to export");
      return;
    }
    const headers = [
      'id', 'full_name', 'surname_first_letter', 'email', 
      'birth_year', 'death_year', 'place_of_birth', 'place_of_death', 
      'nationality', 'representation_status', 'biography', 'image_url'
    ]; // Added new headers
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
  const handleExportAll = () => {
    if (artists) {
      exportArtistsToCSV(artists, 'all_artists.csv');
    }
  };
  const handleExportFiltered = () => {
    if (filteredArtists.length) {
      exportArtistsToCSV(filteredArtists, 'filtered_artists.csv');
    }
  };
  return <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 sm:gap-0">
        
        <div /> {/* Added an empty div to maintain justify-between with buttons */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="flex gap-2" onClick={handleExportFiltered} disabled={!filteredArtists.length}>
            <Download className="h-4 w-4" />
            Export {filteredArtists.length !== artists?.length ? 'Filtered' : 'All'}
          </Button>
          {filteredArtists.length !== artists?.length && (artists?.length ?? 0) > 0 && <Button variant="outline" className="flex gap-2" onClick={handleExportAll}>
              <Download className="h-4 w-4" />
              Export All ({artists?.length})
            </Button>}
          <Button variant="default" className="flex gap-2" onClick={() => setCreateArtistDialogOpen(true)}>
            <PlusCircle className="h-4 w-4" />
            Add Artist
          </Button>
        </div>
      </div>
      
      <CreateArtistDialog open={createArtistDialogOpen} onOpenChange={setCreateArtistDialogOpen} />

      <div className="mt-6 mb-8">
        <SearchBar value={searchTerm} onChange={setSearchTerm} />
      </div>

      {isLoading ? <LoadingSkeleton /> : <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {filteredArtists.map(artist => <ArtistCard key={artist.id} artist={artist} />)}
        </div>}
    </div>;
};
export default Artists;
