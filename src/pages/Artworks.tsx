import { useState, useRef, useEffect } from "react";
import { CreateArtworkDialog } from "@/components/artworks/CreateArtworkDialog";
import { SearchBar } from "@/components/artworks/SearchBar";
import { StatusFilter } from "@/components/artworks/StatusFilter";
import { TypeFilter } from "@/components/artworks/TypeFilter";
import { ArtistFilter } from "@/components/artworks/ArtistFilter";
import { ArtworkGrid } from "@/components/artworks/ArtworkGrid";
import { VirtualizedArtworkGrid } from "@/components/artworks/VirtualizedArtworkGrid";
import { ArtworkListView } from "@/components/artworks/ArtworkListView";
import { ArtworkViewToggle, ViewMode } from "@/components/artworks/ArtworkViewToggle";
import { AlphabeticalIndex } from "@/components/artworks/AlphabeticalIndex";
import { useArtworks } from "@/hooks/use-artworks";
import { useArtists } from "@/hooks/useArtists";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw, Settings } from "lucide-react";
import { exportArtworksToCSV } from "@/lib/csv";
import { ImportCSVDialog } from "@/components/artworks/ImportCSVDialog";
import { useImageCache } from "@/hooks/use-image-cache";
import { toast } from "sonner";
import { useImagePrefetch } from "@/hooks/use-image-prefetch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Artworks = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [artistFilter, setArtistFilter] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<string>();
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('artworks-view-mode') as ViewMode) || 'grid';
  });
  const [useVirtualization, setUseVirtualization] = useState(() => {
    return localStorage.getItem('artworks-virtualization') === 'true';
  });
  const { clearImageCache } = useImageCache();
  const pageTopRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(800);

  const {
    data: artworks,
    isLoading: artworksLoading,
    error: artworksError
  } = useArtworks();

  const {
    data: artists,
    isLoading: artistsLoading,
    error: artistsError
  } = useArtists();

  const { prefetchArtworkImages } = useImagePrefetch();

  const filteredArtworks = artworks?.filter(artwork => {
    const matchesSearch = artwork.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (artwork.materials || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter ? artwork.status === statusFilter : true;
    const matchesType = typeFilter ? artwork.medium_type === typeFilter : true;
    const matchesArtist = artistFilter ? artwork.artist_id === artistFilter : true;
    return matchesSearch && matchesStatus && matchesType && matchesArtist;
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
    
    return (sortLetter && sortLetter.trim() !== "") 
      ? sortLetter.trim().toUpperCase() 
      : artistName.charAt(0).toUpperCase();
  }))).sort();

  // Prefetch images for better UX
  useEffect(() => {
    if (filteredArtworks.length > 0 && viewMode === 'grid') {
      const imagesToPrefetch = filteredArtworks.slice(0, 20).map((artwork, index) => ({
        imageUrl: artwork.image_url,
        priority: index < 10 ? 10 - index : 1 // Higher priority for first 10 images
      }));
      
      const defaultSizes = {
        thumbnail: { width: 400, height: 300, quality: 80 },
        medium: { width: 1200, height: 1200, quality: 100 },
        full: { width: 2400, height: 2400, quality: 100 }
      };
      
      prefetchArtworkImages(imagesToPrefetch, defaultSizes);
    }
  }, [filteredArtworks, viewMode, prefetchArtworkImages]);

  // Persist view mode preference
  useEffect(() => {
    localStorage.setItem('artworks-view-mode', viewMode);
  }, [viewMode]);

  // Persist virtualization preference
  useEffect(() => {
    localStorage.setItem('artworks-virtualization', useVirtualization.toString());
  }, [useVirtualization]);

  // Calculate container height for virtualization
  useEffect(() => {
    const updateHeight = () => {
      const viewportHeight = window.innerHeight;
      const headerHeight = 200; // Approximate header space
      setContainerHeight(Math.max(400, viewportHeight - headerHeight));
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Auto-enable virtualization for large datasets
  useEffect(() => {
    if (filteredArtworks.length > 100 && !useVirtualization) {
      toast.info("Large dataset detected. Consider enabling virtualization for better performance.");
    }
  }, [filteredArtworks.length, useVirtualization]);

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

  const handleScrollToTop = () => {
    if (pageTopRef.current) {
      pageTopRef.current.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (artworksLoading || artistsLoading) {
    return <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">Loading artworks and artists...</p>
      </div>;
  }

  if (artworksError || artistsError) {
    return <div className="flex items-center justify-center h-[50vh]">
        <p className="text-red-500">
          {artworksError ? `Error loading artworks: ${artworksError.message}. ` : ''}
          {artistsError ? `Error loading artists: ${artistsError.message}. ` : ''}
          Please try again.
        </p>
      </div>;
  }

  const renderContent = () => {
    if (viewMode === 'list' || viewMode === 'table') {
      return <ArtworkListView artworks={filteredArtworks} />;
    }

    if (viewMode === 'grid') {
      if (useVirtualization && filteredArtworks.length > 50) {
        return (
          <VirtualizedArtworkGrid 
            artworks={filteredArtworks} 
            containerHeight={containerHeight}
            onScrollToTop={handleScrollToTop}
          />
        );
      }
      return (
        <ArtworkGrid 
          artworks={filteredArtworks} 
          activeIndex={activeIndex} 
          onScrollToTop={handleScrollToTop} 
        />
      );
    }

    return <ArtworkListView artworks={filteredArtworks} />;
  };

  return <div className="p-3 md:p-6 max-w-7xl mx-auto" ref={pageTopRef}>
      <div className="flex flex-wrap items-center justify-between mb-4 md:mb-6 gap-2">
        <div className="flex flex-wrap items-center gap-1 sm:gap-2">
          <CreateArtworkDialog />
          <ImportCSVDialog />
          <Button 
            variant="outline" 
            size="sm" 
            className="flex gap-1 md:gap-2 text-xs md:text-sm" 
            onClick={handleExportFiltered} 
            disabled={!filteredArtworks.length}
          >
            <Download className="h-3 w-3 md:h-4 md:w-4" />
            Export {filteredArtworks.length !== artworks?.length ? 'Filtered' : 'All'}
          </Button>
          {filteredArtworks.length !== artworks?.length && artworks?.length && artworks.length > 0 && 
            <Button 
              variant="outline" 
              size="sm" 
              className="flex gap-1 md:gap-2 text-xs md:text-sm" 
              onClick={handleExportAll}
            >
              <Download className="h-3 w-3 md:h-4 md:w-4" />
              Export All ({artworks.length})
            </Button>
          }
          <Button 
            variant="ghost" 
            size="sm" 
            className="p-2" 
            title="Clear Image Cache" 
            onClick={handleClearImageCache}
          >
            <RefreshCw className="h-3 w-3 md:h-4 md:w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <ArtworkViewToggle 
            viewMode={viewMode} 
            onViewModeChange={setViewMode}
            className="hidden md:flex"
          />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4" />
                <span className="hidden md:inline ml-2">Settings</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>View Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => setViewMode('grid')}
                className={viewMode === 'grid' ? 'bg-accent' : ''}
              >
                Grid View
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setViewMode('list')}
                className={viewMode === 'list' ? 'bg-accent' : ''}
              >
                List View
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setViewMode('table')}
                className={viewMode === 'table' ? 'bg-accent' : ''}
              >
                Table View
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Performance</DropdownMenuLabel>
              <DropdownMenuItem 
                onClick={() => setUseVirtualization(!useVirtualization)}
              >
                {useVirtualization ? '✓' : '○'} Virtualization
                <span className="text-xs text-muted-foreground ml-2">
                  (Large datasets)
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mb-4 md:mb-8">
        <div className="w-full mb-3 md:mb-4">
          <SearchBar value={searchTerm} onChange={setSearchTerm} />
        </div>
        <div className="flex flex-row items-center gap-1 sm:gap-2 overflow-x-auto pb-1">
          <div className="flex-shrink-0 w-[100px] sm:w-[140px]">
            <StatusFilter value={statusFilter} onChange={setStatusFilter} />
          </div>
          <div className="flex-shrink-0 w-[100px] sm:w-[140px]">
            <TypeFilter value={typeFilter} onChange={setTypeFilter} />
          </div>
          <div className="flex-shrink-0 w-[100px] sm:w-[140px] md:w-[180px]">
            <ArtistFilter value={artistFilter} onChange={setArtistFilter} />
          </div>
        </div>
      </div>

      <div className="mb-4 text-sm text-muted-foreground">
        Showing {filteredArtworks.length} of {artworks?.length || 0} artworks
        {filteredArtworks.length > 100 && !useVirtualization && (
          <span className="ml-2 text-amber-600">
            • Consider enabling virtualization for better performance
          </span>
        )}
      </div>

      {viewMode === 'grid' && letters.length > 0 && !useVirtualization && (
        <AlphabeticalIndex 
          letters={letters} 
          onLetterClick={setActiveIndex} 
          activeLetter={activeIndex}
        />
      )}

      {renderContent()}
    </div>;
};

export default Artworks;
