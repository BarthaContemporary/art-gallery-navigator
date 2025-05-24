
import { useState } from "react";
import { CreateArtworkDialog } from "@/components/artworks/CreateArtworkDialog";
import { SearchBar } from "@/components/artworks/SearchBar";
import { StatusFilter } from "@/components/artworks/StatusFilter";
import { TypeFilter } from "@/components/artworks/TypeFilter";
import { ArtworkGrid } from "@/components/artworks/ArtworkGrid";
import { AlphabeticalIndex } from "@/components/artworks/AlphabeticalIndex";
import { useArtworks } from "@/hooks/use-artworks";
import { useArtists } from "@/components/artworks/form/useArtists"; // Ensure this is the correct hook
import { Button } from "@/components/ui/button";
import { Download, RefreshCw } from "lucide-react";
import { exportArtworksToCSV } from "@/lib/csv-utils";
import { ImportCSVDialog } from "@/components/artworks/ImportCSVDialog";
import { useImageCache } from "@/hooks/use-image-cache";
import { toast } from "sonner";
import { Artwork } from "@/hooks/use-artworks";

const Artworks = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<string>();
  const { clearImageCache } = useImageCache();

  const {
    data: artworks,
    isLoading,
    error
  } = useArtworks();

  const {
    data: artists // This now includes surname_first_letter
  } = useArtists();

  const filteredArtworks = artworks?.filter(artwork => {
    const matchesSearch = artwork.title.toLowerCase().includes(searchTerm.toLowerCase()) || (artwork.materials || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter ? artwork.status === statusFilter : true;
    const matchesType = typeFilter ? artwork.medium_type === typeFilter : true;
    return matchesSearch && matchesStatus && matchesType;
  }) ?? [];

  const letters = Array.from(new Set(filteredArtworks.map(artwork => {
    let artistName = "Unknown Artist";
    let sortLetter: string | null = null;

    if (artwork.artist_id && artists) {
      const artist = artists.find(a => a.id === artwork.artist_id);
      if (artist) {
        artistName = artist.full_name;
        sortLetter = artist.surname_first_letter;
      }
    }
    
    // Use surname_first_letter if available and not empty, otherwise use first letter of full_name
    return (sortLetter && sortLetter.trim() !== "") 
      ? sortLetter.trim().toUpperCase() 
      : artistName.charAt(0).toUpperCase();
  }))).sort();

  const handleExportAll = () => {
    if (artworks) {
      exportArtworksToCSV(artworks, 'all_artworks.csv');
    }
  };

  const handleExportFiltered = () => {
    if (filteredArtworks.length) {
      exportArtworksToCSV(filteredArtworks, 'filtered_artworks.csv');
    }
  };

  const handleClearImageCache = () => {
    clearImageCache();
    toast.success("Image cache cleared. Refresh the page to reload images.");
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">Loading artworks...</p>
      </div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-[50vh]">
        <p className="text-red-500">Error loading artworks. Please try again.</p>
      </div>;
  }

  return <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 sm:gap-0">
        
        <div /> {/* Added an empty div to maintain justify-between with buttons */}
        <div className="flex flex-wrap gap-2">
          <ImportCSVDialog />
          <Button variant="outline" className="flex gap-2" onClick={handleExportFiltered} disabled={!filteredArtworks.length}>
            <Download className="h-4 w-4" />
            Export {filteredArtworks.length !== artworks?.length ? 'Filtered' : 'All'}
          </Button>
          {filteredArtworks.length !== artworks?.length && artworks?.length > 0 && <Button variant="outline" className="flex gap-2" onClick={handleExportAll}>
              <Download className="h-4 w-4" />
              Export All ({artworks.length})
            </Button>}
          <CreateArtworkDialog />
          <Button variant="ghost" size="icon" title="Clear Image Cache" onClick={handleClearImageCache}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mb-8 flex flex-col sm:flex-row items-stretch gap-4">
        <SearchBar value={searchTerm} onChange={setSearchTerm} />
        <div className="flex gap-2">
          <StatusFilter value={statusFilter} onChange={setStatusFilter} />
          <TypeFilter value={typeFilter} onChange={setTypeFilter} />
        </div>
      </div>

      {letters.length > 0 && <AlphabeticalIndex letters={letters} onLetterClick={setActiveIndex} activeLetter={activeIndex} />}

      <ArtworkGrid artworks={filteredArtworks} activeIndex={activeIndex} />
    </div>;
};

export default Artworks;
