import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArtworksHeader } from "@/components/artworks/ArtworksHeader";
import { ArtworksFilters } from "@/components/artworks/ArtworksFilters";
import { ArtworksStats } from "@/components/artworks/ArtworksStats";
import { ArtworksContent } from "@/components/artworks/ArtworksContent";
import { ViewMode } from "@/components/artworks/ArtworkViewToggle";
import { useArtworks } from "@/hooks/use-artworks";
import { useArtists } from "@/hooks/useArtists";
import { useImagePrefetch } from "@/hooks/use-image-prefetch";
import { useIsMobile } from "@/hooks/use-mobile";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/ui/error-boundary";

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
  const pageTopRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(800);
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  const {
    data: artworks,
    isLoading: artworksLoading,
    error: artworksError,
    refetch: refetchArtworks
  } = useArtworks();

  const {
    data: artists,
    isLoading: artistsLoading,
    error: artistsError,
    refetch: refetchArtists
  } = useArtists();

  const { prefetchArtworkImages } = useImagePrefetch();

  const filteredArtworks = artworks?.filter(artwork => {
    const matchesSearch = artwork.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (artwork.materials || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter ? artwork.status === statusFilter : true;
    const matchesType = typeFilter ? artwork.medium_type === typeFilter : true;
    const matchesArtist = artistFilter ? artwork.artist_id === artistFilter : true;
    return matchesSearch && matchesStatus && matchesType && matchesArtist;
  })?.sort((a, b) => {
    // Get artist details for sorting
    const artistA = artists?.find(artist => artist.id === a.artist_id);
    const artistB = artists?.find(artist => artist.id === b.artist_id);
    
    // Get sorting letters, fallback to first letter of full name, then to "Unknown"
    const sortLetterA = artistA?.surname_first_letter || artistA?.full_name?.charAt(0) || "Z";
    const sortLetterB = artistB?.surname_first_letter || artistB?.full_name?.charAt(0) || "Z";
    
    // First sort by artist sorting letter alphabetically
    const letterCompare = sortLetterA.localeCompare(sortLetterB);
    if (letterCompare !== 0) return letterCompare;
    
    // Then sort by price descending (higher prices first)
    const priceA = a.price || 0;
    const priceB = b.price || 0;
    return priceB - priceA;
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

  const handleScrollToTop = () => {
    if (pageTopRef.current) {
      pageTopRef.current.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleRefresh = async () => {
    try {
      await Promise.all([
        refetchArtworks(),
        refetchArtists()
      ]);
      // Invalidate related queries
      await queryClient.invalidateQueries({ queryKey: ['artworks'] });
      await queryClient.invalidateQueries({ queryKey: ['artists'] });
      toast.success("Data refreshed successfully");
    } catch (error) {
      console.error('Refresh error:', error);
      toast.error("Failed to refresh data");
    }
  };

  if (artworksLoading || artistsLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">Loading artworks and artists...</p>
      </div>
    );
  }

  if (artworksError || artistsError) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-red-500">
          {artworksError ? `Error loading artworks: ${artworksError.message}. ` : ''}
          {artistsError ? `Error loading artists: ${artistsError.message}. ` : ''}
          Please try again.
        </p>
      </div>
    );
  }

  const content = (
    <div className="p-3 md:p-6 max-w-7xl mx-auto" ref={pageTopRef}>
      <ArtworksHeader
        artworks={artworks || []}
        filteredArtworks={filteredArtworks}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      <ArtworksFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        artistFilter={artistFilter}
        onArtistFilterChange={setArtistFilter}
      />

      <ArtworksStats
        filteredCount={filteredArtworks.length}
        totalCount={artworks?.length || 0}
        useVirtualization={useVirtualization}
      />

      <ArtworksContent
        artworks={filteredArtworks}
        viewMode={viewMode}
        useVirtualization={useVirtualization}
        containerHeight={containerHeight}
        letters={letters}
        activeIndex={activeIndex}
        onActiveIndexChange={setActiveIndex}
        onScrollToTop={handleScrollToTop}
      />
    </div>
  );

  // Wrap with PullToRefresh only on mobile
  if (isMobile) {
    return (
      <ErrorBoundary>
        <PullToRefresh onRefresh={handleRefresh} enabled={!artworksLoading && !artistsLoading}>
          {content}
        </PullToRefresh>
      </ErrorBoundary>
    );
  }

  return <ErrorBoundary>{content}</ErrorBoundary>;
};

export default Artworks;
