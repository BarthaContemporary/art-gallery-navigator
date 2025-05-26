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
import { RepresentationStatusFilter } from "@/components/artists/RepresentationStatusFilter";

interface Artist {
  id: string;
  full_name: string;
  surname_first_letter?: string | null;
  birth_year: number | null;
  death_year?: number | null;
  place_of_birth?: string | null;
  place_of_death?: string | null;
  nationality: string | null;
  representation_status: string; // This is a string like "represented", "formerly represented", "not represented"
  biography: string | null;
  image_url: string | null;
  email?: string | null;
}

type RepresentationStatusFilterType = "all" | "represented" | "formerly represented" | "not represented";

const Artists = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [createArtistDialogOpen, setCreateArtistDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<RepresentationStatusFilterType>("all");

  const {
    data: artists,
    isLoading
  } = useQuery({
    queryKey: ['artists', statusFilter],
    queryFn: async () => {
      let query = supabase.from('artists').select('*').order('full_name');
      const { data, error } = await query;
      if (error) throw error;
      return data as Artist[];
    }
  });

  const filteredArtists = artists?.filter(artist => {
    const searchTermLower = searchTerm.toLowerCase();
    const matchesSearchTerm =
      artist.full_name.toLowerCase().includes(searchTermLower) ||
      (artist.nationality && artist.nationality.toLowerCase().includes(searchTermLower)) ||
      (artist.email && artist.email.toLowerCase().includes(searchTermLower)) ||
      (artist.surname_first_letter && artist.surname_first_letter.toLowerCase().includes(searchTermLower)) ||
      (artist.place_of_birth && artist.place_of_birth.toLowerCase().includes(searchTermLower)) ||
      (artist.place_of_death && artist.place_of_death.toLowerCase().includes(searchTermLower));

    const matchesStatusFilter =
      statusFilter === "all" ||
      artist.representation_status.toLowerCase() === statusFilter;

    return matchesSearchTerm && matchesStatusFilter;
  }) ?? [];

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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-start mb-8 gap-4 sm:gap-0">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="flex gap-2" onClick={handleExportFiltered} disabled={!filteredArtists.length}>
            <Download className="h-4 w-4" />
            Export {filteredArtists.length !== artists?.length ? 'Filtered' : 'All'}
          </Button>
          {filteredArtists.length !== artists?.length && (artists?.length ?? 0) > 0 && 
            <Button variant="outline" size="sm" className="flex gap-2" onClick={handleExportAll}>
              <Download className="h-4 w-4" />
              Export All ({artists?.length})
            </Button>}
          <Button variant="default" size="sm" className="flex gap-2" onClick={() => setCreateArtistDialogOpen(true)}>
            <PlusCircle className="h-4 w-4" />
            Add Artist
          </Button>
        </div>
      </div>
      
      <CreateArtistDialog open={createArtistDialogOpen} onOpenChange={setCreateArtistDialogOpen} />

      <div className="mt-6 mb-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <SearchBar value={searchTerm} onChange={setSearchTerm} />
        <RepresentationStatusFilter value={statusFilter} onChange={setStatusFilter} /> 
      </div>

      {isLoading ? <LoadingSkeleton /> : <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {filteredArtists.map(artist => <ArtistCard key={artist.id} artist={artist} />)}
        </div>}
    </div>;
};
export default Artists;
