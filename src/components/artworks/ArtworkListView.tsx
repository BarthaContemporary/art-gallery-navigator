
import { useState, useMemo, useCallback } from "react";
import { Artwork } from "@/hooks/use-artworks";
import { useArtists } from "@/hooks/useArtists";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OptimizedArtworkImage } from "./OptimizedArtworkImage";
import { ArtworkOverviewDialog } from "./ArtworkOverviewDialog";
import { formatDistanceToNow } from "date-fns";
import { Edit, MoreHorizontal, DollarSign } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { ErrorBoundary } from "@/components/ui/error-boundary";

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
    return `${artwork.currency || 'USD'} ${artwork.price.toLocaleString()}`;
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
        {/* Header - Hidden on mobile, visible on larger screens */}
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

        {/* Rows */}
        {memoizedArtworks.map((artwork) => (
          <div
            key={artwork.id}
            className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-2 md:gap-4 px-4 py-3 border rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
            onClick={() => handleArtworkClick(artwork)}
          >
            {/* Mobile Layout */}
            <div className="md:hidden col-span-1 space-y-2">
              <div className="flex gap-3">
                <div className="w-16 h-12 flex-shrink-0">
                  <OptimizedArtworkImage
                    imageUrl={artwork.image_url || "/placeholder.svg"}
                    title={artwork.title || "Untitled"}
                    className="rounded-md aspect-[4/3] object-cover"
                    sizes={{
                      thumbnail: { width: 64, height: 48, quality: 70 },
                      medium: { width: 128, height: 96, quality: 80 },
                      full: { width: 256, height: 192, quality: 90 }
                    }}
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

            {/* Desktop Layout */}
            {/* Image */}
            <div className="hidden lg:block lg:col-span-1">
              <div className="w-16 h-12">
                <OptimizedArtworkImage
                  imageUrl={artwork.image_url || "/placeholder.svg"}
                  title={artwork.title || "Untitled"}
                  className="rounded-md aspect-[4/3] object-cover"
                  sizes={{
                    thumbnail: { width: 64, height: 48, quality: 70 },
                    medium: { width: 128, height: 96, quality: 80 },
                    full: { width: 256, height: 192, quality: 90 }
                  }}
                />
              </div>
            </div>

            {/* Title & Artist */}
            <div className="hidden md:block md:col-span-2 lg:col-span-3">
              <div className="font-medium text-sm line-clamp-1">{artwork.title || "Untitled"}</div>
              <div className="text-xs text-muted-foreground">{getArtistName(artwork)}</div>
              {artwork.materials && (
                <div className="text-xs text-muted-foreground line-clamp-1">{artwork.materials}</div>
              )}
            </div>

            {/* Year */}
            <div className="hidden lg:block lg:col-span-1 text-sm">
              {artwork.year || "—"}
            </div>

            {/* Dimensions */}
            <div className="hidden md:block md:col-span-1 lg:col-span-2 text-sm">
              {formatDimensions(artwork)}
            </div>

            {/* Status */}
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

            {/* Price */}
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

            {/* Updated */}
            <div className="hidden lg:block lg:col-span-1 text-xs text-muted-foreground">
              {formatUpdatedDate(artwork)}
            </div>

            {/* Actions */}
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
        ))}
      </div>

      {selectedArtwork && (
        <ArtworkOverviewDialog
          artwork={selectedArtwork}
          open={!!selectedArtwork}
          onOpenChange={(open) => !open && handleCloseDialog()}
        />
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
