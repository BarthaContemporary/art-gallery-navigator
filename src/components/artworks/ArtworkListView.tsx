
import React, { useState, useMemo, useCallback, Suspense, lazy } from "react";
import { Artwork } from "@/hooks/use-artworks";
import { useArtists } from "@/hooks/useArtists";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OptimizedArtworkImage } from "./OptimizedArtworkImage";
import { formatDistanceToNow } from "date-fns";
import { Edit, MoreHorizontal, DollarSign, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import type { ArtworkImage } from "@/hooks/use-artworks";

const ArtworkOverviewDialogLazy = lazy(() => import('./overview/ArtworkOverviewDialog').then(module => ({ default: module.ArtworkOverviewDialog })));

interface ArtworkListViewProps {
  artworks: Artwork[];
}

const statusColors: Record<string, string> = {
  available: 'bg-green-100 text-green-800',
  'on hold': 'bg-amber-100 text-amber-800',
  sold: 'bg-blue-100 text-blue-800',
  consigned: 'bg-purple-100 text-purple-800',
  'not for sale': 'bg-gray-100 text-gray-800',
  returned: 'bg-orange-100 text-orange-800',
};

function ArtworkListViewContent({ artworks }: ArtworkListViewProps) {
  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null);
  const { data: artists, isLoading: artistsLoading } = useArtists();
  const { isAdmin } = useAuth();

  const getArtistName = useCallback((artwork: Artwork): string => {
    if (!artwork.artist_id || !artists || artistsLoading) {
      return "Unknown Artist";
    }
    const artist = artists.find(a => a.id === artwork.artist_id);
    return artist?.full_name || "Unknown Artist";
  }, [artists, artistsLoading]);

  const formatDimensions = useCallback((artwork: Artwork): string => {
    const parts: string[] = [];
    if (artwork.height) parts.push(`H ${artwork.height}`);
    if (artwork.width) parts.push(`W ${artwork.width}`);
    if (artwork.depth) parts.push(`D ${artwork.depth}`);
    return parts.length > 0 ? parts.join(' × ') : "—";
  }, []);

  const formatPrice = useCallback((artwork: Artwork): string => {
    if (!artwork.price) return "—";
    return `${artwork.currency || 'USD'} ${artwork.price.toLocaleString().replace(/,/g, "'")}`;
  }, []);

  const formatUpdatedDate = useCallback((artwork: Artwork): string => {
    if (!artwork.updated_at) return "—";
    try {
      return formatDistanceToNow(new Date(artwork.updated_at), { addSuffix: true });
    } catch {
      return "—";
    }
  }, []);

  const handleArtworkClick = useCallback((artwork: Artwork) => {
    setSelectedArtwork(artwork);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setSelectedArtwork(null);
  }, []);

  const handleActionClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const createOptimizedImageClickHandler = useCallback((artwork: Artwork) => () => {
    handleArtworkClick(artwork);
  }, [handleArtworkClick]);

  const memoizedArtworks = useMemo(() => artworks, [artworks]);

  if (!memoizedArtworks || memoizedArtworks.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground">
        No artworks to display
      </div>
    );
  }

  return (
    <>
      <div className="space-y-1 overflow-x-auto">
        <div className="hidden lg:grid lg:grid-cols-12 gap-4 px-4 py-3 bg-muted/30 rounded-lg text-sm font-medium text-muted-foreground">
          <div className="col-span-1">Image</div>
          <div className="col-span-3">Title & Artist</div>
          <div className="col-span-1">Year</div>
          <div className="col-span-2">Dimensions</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-2">Price</div>
          <div className="col-span-1">Updated</div>
          {isAdmin && <div className="col-span-1">Actions</div>}
        </div>

        {memoizedArtworks.map((artwork) => {
          // Prepare imageRecord for OptimizedArtworkImage
          // Use artwork.artwork_images (fetched from Supabase)
          const primaryImage = artwork.artwork_images?.find(img => img.is_primary) || artwork.artwork_images?.[0];
          const imageRecordToPass: ArtworkImage | undefined = primaryImage
            ? primaryImage
            : (artwork.image_url // Fallback to main artwork.image_url
                ? {
                    id: artwork.id + '_list_primary_fallback', // Construct a stable ID
                    artwork_id: artwork.id,
                    image_url: artwork.image_url,
                    is_primary: true,
                    display_order: 0,
                    thumbnail_url: null, 
                    medium_url: null,
                    processed: false,
                  }
                : undefined);

          return (
            <div
              key={artwork.id}
              className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-2 md:gap-4 px-4 py-3 border rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
              onClick={() => handleArtworkClick(artwork)}
            >
              {/* Mobile view */}
              <div className="md:hidden col-span-1 space-y-2">
                <div className="flex gap-3">
                  <div className="w-16 h-12 flex-shrink-0">
                    <OptimizedArtworkImage
                      imageRecord={imageRecordToPass}
                      title={artwork.title || "Untitled"}
                      onClick={createOptimizedImageClickHandler(artwork)}
                      className="rounded-md aspect-[4/3] object-cover"
                      tier="thumbnail"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm line-clamp-1">{artwork.title || "Untitled"}</div>
                    <div className="text-xs text-muted-foreground">{getArtistName(artwork)}</div>
                    {artwork.materials && (
                      <div className="text-xs text-muted-foreground line-clamp-1">{artwork.materials}</div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {artwork.year && <span>Year: {artwork.year}</span>}
                  <span>Dims: {formatDimensions(artwork)}</span>
                  {artwork.status && (
                    <Badge 
                      variant="outline"
                      className={`text-xs ${statusColors[artwork.status] || 'bg-gray-100 text-gray-800'}`}
                    >
                      {artwork.status}
                    </Badge>
                  )}
                  <span>Price: {formatPrice(artwork)}</span>
                </div>
              </div>

              {/* Desktop/Tablet view Image */}
              <div className="hidden lg:block lg:col-span-1">
                <div className="w-16 h-12">
                  <OptimizedArtworkImage
                    imageRecord={imageRecordToPass}
                    title={artwork.title || "Untitled"}
                    onClick={createOptimizedImageClickHandler(artwork)}
                    className="rounded-md aspect-[4/3] object-cover"
                    tier="thumbnail"
                  />
                </div>
              </div>

              {/* Desktop/Tablet view Title, Artist, Materials */}
              <div className="hidden md:block md:col-span-2 lg:col-span-3">
                <div className="font-medium text-sm line-clamp-1">{artwork.title || "Untitled"}</div>
                <div className="text-xs text-muted-foreground">{getArtistName(artwork)}</div>
                {artwork.materials && (
                  <div className="text-xs text-muted-foreground line-clamp-1">{artwork.materials}</div>
                )}
              </div>

              <div className="hidden lg:block lg:col-span-1 text-sm">
                {artwork.year || "—"}
              </div>

              <div className="hidden md:block md:col-span-1 lg:col-span-2 text-sm">
                {formatDimensions(artwork)}
              </div>

              <div className="hidden md:block md:col-span-1 lg:col-span-1">
                {artwork.status && (
                  <Badge 
                    variant="outline"
                    className={`text-xs ${statusColors[artwork.status] || 'bg-gray-100 text-gray-800'}`}
                  >
                    {artwork.status}
                  </Badge>
                )}
              </div>

              <div className="hidden md:block md:col-span-1 lg:col-span-2 text-sm">
                {artwork.price ? (
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    <span>{formatPrice(artwork)}</span>
                  </div>
                ) : (
                  "—"
                )}
              </div>

              <div className="hidden lg:block lg:col-span-1 text-xs text-muted-foreground">
                {formatUpdatedDate(artwork)}
              </div>

              {isAdmin && (
                <div className="hidden md:block md:col-span-1 lg:col-span-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={handleActionClick}>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleActionClick}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {selectedArtwork && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"><Loader2 className="h-8 w-8 animate-spin text-white" /></div>}>
          <ArtworkOverviewDialogLazy
            artwork={selectedArtwork}
            open={!!selectedArtwork}
            onOpenChange={(open) => !open && handleCloseDialog()}
          />
        </Suspense>
      )}
    </>
  );
}

export function ArtworkListView({ artworks }: ArtworkListViewProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex items-center justify-center h-32 text-red-500">
          Error loading list view. Please try refreshing the page.
        </div>
      }
    >
      <ArtworkListViewContent artworks={artworks} />
    </ErrorBoundary>
  );
}
