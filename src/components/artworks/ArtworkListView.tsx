
import { useState } from "react";
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

interface ArtworkListViewProps {
  artworks: Artwork[];
}

const statusColors = {
  available: 'bg-green-100 text-green-800',
  'on hold': 'bg-amber-100 text-amber-800',
  sold: 'bg-blue-100 text-blue-800',
  consigned: 'bg-purple-100 text-purple-800',
  'not for sale': 'bg-gray-100 text-gray-800',
  returned: 'bg-orange-100 text-orange-800',
};

export function ArtworkListView({ artworks }: ArtworkListViewProps) {
  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null);
  const { data: artists } = useArtists();
  const { isAdmin } = useAuth();

  const getArtistName = (artwork: Artwork) => {
    if (artwork.artist_id && artists) {
      const artist = artists.find(a => a.id === artwork.artist_id);
      return artist ? artist.full_name : "Unknown Artist";
    }
    return "Unknown Artist";
  };

  const formatDimensions = (artwork: Artwork) => {
    const parts = [];
    if (artwork.height) parts.push(`H ${artwork.height}`);
    if (artwork.width) parts.push(`W ${artwork.width}`);
    if (artwork.depth) parts.push(`D ${artwork.depth}`);
    return parts.length > 0 ? parts.join(' × ') : "—";
  };

  return (
    <>
      <div className="space-y-1">
        {/* Header */}
        <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-muted/30 rounded-lg text-sm font-medium text-muted-foreground">
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
        {artworks.map((artwork) => (
          <div
            key={artwork.id}
            className="grid grid-cols-12 gap-4 px-4 py-3 border rounded-lg hover:bg-muted/30 transition-colors cursor-pointer"
            onClick={() => setSelectedArtwork(artwork)}
          >
            {/* Image */}
            <div className="col-span-1">
              <div className="w-16 h-12">
                <OptimizedArtworkImage
                  imageUrl={artwork.image_url}
                  title={artwork.title}
                  className="rounded-md aspect-[4/3]"
                  sizes={{
                    thumbnail: { width: 64, height: 48, quality: 70 },
                    medium: { width: 128, height: 96, quality: 80 },
                    full: { width: 256, height: 192, quality: 90 }
                  }}
                />
              </div>
            </div>

            {/* Title & Artist */}
            <div className="col-span-3">
              <div className="font-medium text-sm line-clamp-1">{artwork.title}</div>
              <div className="text-xs text-muted-foreground">{getArtistName(artwork)}</div>
              {artwork.materials && (
                <div className="text-xs text-muted-foreground line-clamp-1">{artwork.materials}</div>
              )}
            </div>

            {/* Year */}
            <div className="col-span-1 text-sm">
              {artwork.year || "—"}
            </div>

            {/* Dimensions */}
            <div className="col-span-2 text-sm">
              {formatDimensions(artwork)}
            </div>

            {/* Status */}
            <div className="col-span-1">
              {artwork.status && (
                <Badge 
                  variant="outline"
                  className={`text-xs ${statusColors[artwork.status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'}`}
                >
                  {artwork.status}
                </Badge>
              )}
            </div>

            {/* Price */}
            <div className="col-span-2 text-sm">
              {artwork.price ? (
                <div className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />
                  <span>{artwork.currency} {artwork.price.toLocaleString()}</span>
                </div>
              ) : (
                "—"
              )}
            </div>

            {/* Updated */}
            <div className="col-span-1 text-xs text-muted-foreground">
              {artwork.updated_at ? formatDistanceToNow(new Date(artwork.updated_at), { addSuffix: true }) : "—"}
            </div>

            {/* Actions */}
            {isAdmin && (
              <div className="col-span-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
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

      <ArtworkOverviewDialog
        artwork={selectedArtwork!}
        open={!!selectedArtwork}
        onOpenChange={(open) => !open && setSelectedArtwork(null)}
      />
    </>
  );
}
