/**
 * Clean Artwork Filters Hook
 * Simple, efficient filtering logic
 */

import { useState, useMemo } from "react";
import type { Artwork, Artist, ArtworkFilters } from "@/types/artwork";

export function useArtworkFilters(artworks: Artwork[], artists: Artist[]) {
  const [filters, setFilters] = useState<ArtworkFilters>({
    search: '',
    artist: null,
    status: null,
    mediumType: null,
    yearRange: null,
    priceRange: null
  });

  const filteredArtworks = useMemo(() => {
    if (!artworks) return [];

    return artworks.filter(artwork => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesTitle = artwork.title.toLowerCase().includes(searchLower);
        const matchesMaterials = artwork.materials?.toLowerCase().includes(searchLower);
        const matchesArtist = artwork.artist_name?.toLowerCase().includes(searchLower);
        
        if (!matchesTitle && !matchesMaterials && !matchesArtist) {
          return false;
        }
      }

      // Artist filter
      if (filters.artist && artwork.artist_id !== filters.artist) {
        return false;
      }

      // Status filter
      if (filters.status && artwork.status !== filters.status) {
        return false;
      }

      // Medium type filter
      if (filters.mediumType && artwork.medium_type !== filters.mediumType) {
        return false;
      }

      // Year range filter
      if (filters.yearRange && artwork.year) {
        const [minYear, maxYear] = filters.yearRange;
        if (artwork.year < minYear || artwork.year > maxYear) {
          return false;
        }
      }

      // Price range filter
      if (filters.priceRange && artwork.price) {
        const [minPrice, maxPrice] = filters.priceRange;
        if (artwork.price < minPrice || artwork.price > maxPrice) {
          return false;
        }
      }

      return true;
    });
  }, [artworks, filters]);

  // Sort artworks by artist name, then by price
  const sortedArtworks = useMemo(() => {
    return [...filteredArtworks].sort((a, b) => {
      // First by artist name
      const artistA = a.artist_name || 'Unknown Artist';
      const artistB = b.artist_name || 'Unknown Artist';
      
      const nameCompare = artistA.localeCompare(artistB);
      if (nameCompare !== 0) return nameCompare;
      
      // Then by price (lowest first)
      const priceA = a.price || 0;
      const priceB = b.price || 0;
      return priceA - priceB;
    });
  }, [filteredArtworks]);

  // Get available filter options
  const filterOptions = useMemo(() => {
    if (!artworks) return {
      statuses: [],
      mediumTypes: [],
      artists: [],
      yearRange: [0, 0] as [number, number],
      priceRange: [0, 0] as [number, number]
    };

    const statuses = [...new Set(artworks.map(a => a.status))].filter(Boolean).sort();
    const mediumTypes = [...new Set(artworks.map(a => a.medium_type))].filter(Boolean).sort();
    const years = artworks.map(a => a.year).filter(Boolean) as number[];
    const prices = artworks.map(a => a.price).filter(Boolean) as number[];

    return {
      statuses,
      mediumTypes,
      artists: artists || [],
      yearRange: years.length > 0 ? [Math.min(...years), Math.max(...years)] as [number, number] : [0, 0],
      priceRange: prices.length > 0 ? [Math.min(...prices), Math.max(...prices)] as [number, number] : [0, 0]
    };
  }, [artworks, artists]);

  const updateFilter = <K extends keyof ArtworkFilters>(
    key: K,
    value: ArtworkFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      artist: null,
      status: null,
      mediumType: null,
      yearRange: null,
      priceRange: null
    });
  };

  return {
    filters,
    filteredArtworks: sortedArtworks,
    filterOptions,
    updateFilter,
    clearFilters,
    hasActiveFilters: Object.values(filters).some(value => 
      value !== null && value !== '' && 
      (Array.isArray(value) ? value.length > 0 : true)
    )
  };
}