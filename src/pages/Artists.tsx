import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArtistHeader } from "@/components/artists/ArtistHeader";
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
  birth_year: number | null;
  nationality: string | null;
  representation_status: string;
  biography: string | null;
  image_url: string | null;
  email?: string | null;
}

const Artists = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [createArtistDialogOpen, setCreateArtistDialogOpen] = useState(false);

  const { data: artists, isLoading } = useQuery({
    queryKey: ['artists'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('artists')
        .select('*')
        .order('full_name');

      if (error) throw error;
      return data as Artist[];
    }
  });

  const filteredArtists = artists?.filter(artist =>
    artist.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (artist.nationality && artist.nationality.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (artist.email && artist.email.toLowerCase().includes(searchTerm.toLowerCase()))
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

    const headers = ['id', 'full_name', 'email', 'birth_year', 'nationality', 'representation_status', 'biography', 'image_url'];
    
    const csvHeader = headers.map(formatCSVValue).join(',');
    
    const csvRows = artistsToExport.map(artist => {
      return headers.map(header => {
        const value = artist[header as keyof Artist];
        return formatCSVValue(value);
      }).join(',');
    });
    
    const csvContent = [csvHeader, ...csvRows].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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

  return (
    <div className="pt-6 pb-6 px-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <ArtistHeader />
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            className="flex gap-2"
            onClick={handleExportFiltered}
            disabled={!filteredArtists.length}
          >
            <Download className="h-4 w-4" />
            Export {filteredArtists.length !== artists?.length ? 'Filtered' : 'All'}
          </Button>
          {filteredArtists.length !== artists?.length && artists?.length > 0 && (
            <Button 
              variant="outline" 
              className="flex gap-2"
              onClick={handleExportAll}
            >
              <Download className="h-4 w-4" />
              Export All ({artists.length})
            </Button>
          )}
          <Button 
            variant="default" 
            className="flex gap-2"
            onClick={() => setCreateArtistDialogOpen(true)}
          >
            <PlusCircle className="h-4 w-4" />
            Create Artist
          </Button>
        </div>
      </div>
      
      <CreateArtistDialog 
        open={createArtistDialogOpen} 
        onOpenChange={setCreateArtistDialogOpen} 
      />

      <div className="mt-6 mb-8">
        <SearchBar value={searchTerm} onChange={setSearchTerm} />
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredArtists.map((artist) => (
            <ArtistCard key={artist.id} artist={artist} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Artists;
