/**
 * Clean Artwork Filters Component
 * Simple, effective filtering UI
 */

import React from "react";
import { Search, X, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { ArtworkFilters, Artist } from "@/types/artwork";
import { cn } from "@/lib/utils";

interface ArtworkFiltersProps {
  filters: ArtworkFilters;
  filterOptions: {
    statuses: string[];
    mediumTypes: string[];
    artists: Artist[];
    yearRange: [number, number];
    priceRange: [number, number];
  };
  onUpdateFilter: <K extends keyof ArtworkFilters>(key: K, value: ArtworkFilters[K]) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  artworkCount: number;
  compact?: boolean;
}

export function ArtworkFilters({
  filters,
  filterOptions,
  onUpdateFilter,
  onClearFilters,
  hasActiveFilters,
  artworkCount,
  compact = false
}: ArtworkFiltersProps) {
  return (
    <div className={cn("space-y-4", compact && "space-y-2")}>
      {/* Clear Filters */}
      {hasActiveFilters && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            onClick={onClearFilters}
            className="whitespace-nowrap"
          >
            <X className="h-4 w-4 mr-2" />
            Clear Filters
          </Button>
        </div>
      )}

      {/* Filter Options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Artist Filter */}
        <Select
          value={filters.artist || "__all__"}
          onValueChange={(value) => onUpdateFilter('artist', value === "__all__" ? null : value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Artists" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Artists</SelectItem>
            {filterOptions.artists.map((artist) => (
              <SelectItem key={artist.id} value={artist.id}>
                {artist.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select
          value={filters.status || "__all__"}
          onValueChange={(value) => onUpdateFilter('status', value === "__all__" ? null : value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Statuses</SelectItem>
            {filterOptions.statuses.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Medium Type Filter */}
        <Select
          value={filters.mediumType || "__all__"}
          onValueChange={(value) => onUpdateFilter('mediumType', value === "__all__" ? null : value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="All Mediums" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Mediums</SelectItem>
            {filterOptions.mediumTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Results Count */}
        <div className="flex items-center justify-center sm:justify-start">
          <Badge variant="secondary" className="text-sm">
            <Filter className="h-3 w-3 mr-1" />
            {artworkCount} artwork{artworkCount !== 1 ? 's' : ''}
          </Badge>
        </div>
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {filters.search && (
            <Badge variant="outline">
              Search: "{filters.search}"
              <button
                onClick={() => onUpdateFilter('search', '')}
                className="ml-1 hover:text-destructive"
              >
                ×
              </button>
            </Badge>
          )}
          {filters.artist && (
            <Badge variant="outline">
              Artist: {filterOptions.artists.find(a => a.id === filters.artist)?.full_name}
              <button
                onClick={() => onUpdateFilter('artist', null)}
                className="ml-1 hover:text-destructive"
              >
                ×
              </button>
            </Badge>
          )}
          {filters.status && (
            <Badge variant="outline">
              Status: {filters.status}
              <button
                onClick={() => onUpdateFilter('status', null)}
                className="ml-1 hover:text-destructive"
              >
                ×
              </button>
            </Badge>
          )}
          {filters.mediumType && (
            <Badge variant="outline">
              Medium: {filters.mediumType}
              <button
                onClick={() => onUpdateFilter('mediumType', null)}
                className="ml-1 hover:text-destructive"
              >
                ×
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}