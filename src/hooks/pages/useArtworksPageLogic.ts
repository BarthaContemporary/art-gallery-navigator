
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ViewMode } from "@/components/artworks/ArtworkViewToggle";
import { Artwork, useArtworks } from "@/hooks/use-artworks";
import { Artist, useArtists } from "@/hooks/useArtists";
import { useImagePrefetch } from "@/hooks/use-image-prefetch";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";

export function useArtworksPageLogic() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [artistFilter, setArtistFilter] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<string | undefined>(undefined);
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

  const filteredArtworks = useMemo(() => artworks?.filter(artwork => {
    const matchesSearch = artwork.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (artwork.materials || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter ? artwork.status === statusFilter : true;
    const matchesType = typeFilter ? artwork.medium_type === typeFilter : true;
    const matchesArtist = artistFilter ? artwork.artist_id === artistFilter : true;
    return matchesSearch && matchesStatus && matchesType && matchesArtist;
  })?.sort((a, b) => {
    const artistA = artists?.find(artist => artist.id === a.artist_id);
    const artistB = artists?.find(artist => artist.id === b.artist_id);
    
    const sortLetterA = artistA?.surname_first_letter || artistA?.full_name?.charAt(0) || "Z";
    const sortLetterB = artistB?.surname_first_letter || artistB?.full_name?.charAt(0) || "Z";
    
    const letterCompare = sortLetterA.localeCompare(sortLetterB);
    if (letterCompare !== 0) return letterCompare;
    
    const priceA = a.price || 0;
    const priceB = b.price || 0;
    return priceB - priceA;
  }) ?? [], [artworks, artists, searchTerm, statusFilter, typeFilter, artistFilter]);

  const letters = useMemo(() => Array.from(new Set(filteredArtworks.map(artwork => {
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
  }))).sort(), [filteredArtworks, artists]);

  // Enhanced prefetching for faster loading
  useEffect(() => {
    if (filteredArtworks.length > 0) {
      // Prefetch more images for grid view, fewer for list view
      const prefetchCount = viewMode === 'grid' ? 30 : 15;
      const imagesToPrefetch = filteredArtworks.slice(0, prefetchCount).map((artwork, index) => ({
        imageUrl: artwork.image_url,
        priority: index < 12 ? 12 - index : 1
      }));
      
      const optimizedSizes = {
        thumbnail: { width: 300, height: 225, quality: 75 },
        medium: { width: 800, height: 800, quality: 85 },
        full: { width: 1600, height: 1600, quality: 90 }
      };
      
      // Use requestIdleCallback for better performance
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          prefetchArtworkImages(imagesToPrefetch, optimizedSizes);
        });
      } else {
        prefetchArtworkImages(imagesToPrefetch, optimizedSizes);
      }
    }
  }, [filteredArtworks, viewMode, prefetchArtworkImages]);

  useEffect(() => {
    localStorage.setItem('artworks-view-mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('artworks-virtualization', useVirtualization.toString());
  }, [useVirtualization]);

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

  useEffect(() => {
    if (filteredArtworks.length > 100 && !useVirtualization) {
      toast.info("Large dataset detected. Consider enabling virtualization for better performance.");
    }
  }, [filteredArtworks.length, useVirtualization]);

  const handleScrollToTop = useCallback(() => {
    if (pageTopRef.current) {
      pageTopRef.current.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    try {
      await Promise.all([
        refetchArtworks(),
        refetchArtists()
      ]);
      await queryClient.invalidateQueries({ queryKey: ['artworks'] });
      await queryClient.invalidateQueries({ queryKey: ['artists'] });
      toast.success("Data refreshed successfully");
    } catch (error) {
      console.error('Refresh error:', error);
      toast.error("Failed to refresh data");
    }
  }, [queryClient, refetchArtworks, refetchArtists]);

  return {
    searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    typeFilter, setTypeFilter,
    artistFilter, setArtistFilter,
    activeIndex, setActiveIndex,
    viewMode, setViewMode,
    useVirtualization, setUseVirtualization, // Note: setUseVirtualization was missing in original prompt description but needed
    pageTopRef,
    containerHeight,
    isMobile,
    artworks: artworks || [], // ensure artworks is always an array
    artworksLoading,
    artworksError,
    artistsLoading,
    artistsError,
    filteredArtworks,
    letters,
    handleScrollToTop,
    handleRefresh,
  };
}

