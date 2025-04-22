
import { useState } from "react";
import { CreateArtworkDialog } from "@/components/artworks/CreateArtworkDialog";
import { SearchBar } from "@/components/artworks/SearchBar";
import { StatusFilter } from "@/components/artworks/StatusFilter";
import { ArtworkGrid } from "@/components/artworks/ArtworkGrid";
import { useArtworks } from "@/hooks/use-artworks";

const Artworks = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const { data: artworks, isLoading, error } = useArtworks();
  
  const filteredArtworks = artworks?.filter(artwork => {
    const matchesSearch = 
      artwork.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (artwork.materials || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter ? artwork.status === statusFilter : true;
    
    return matchesSearch && matchesStatus;
  }) ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">Loading artworks...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-red-500">Error loading artworks. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="pt-6 pb-6 px-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 sm:gap-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Artworks</h1>
          <p className="text-muted-foreground">
            Browse and manage your gallery inventory
          </p>
        </div>
        <CreateArtworkDialog />
      </div>

      <div className="mb-8 flex flex-col sm:flex-row items-stretch gap-4">
        <SearchBar value={searchTerm} onChange={setSearchTerm} />
        <StatusFilter value={statusFilter} onChange={setStatusFilter} />
      </div>

      <ArtworkGrid artworks={filteredArtworks} />
    </div>
  );
};

export default Artworks;
