import React, { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Edit, 
  Download, 
  Share2, 
  MapPin, 
  Palette, 
  Calendar,
  DollarSign,
  Ruler,
  Package,
  FileText,
  X
} from "lucide-react";
import { Artwork } from "@/hooks/use-artworks";
import { useArtists } from "@/hooks/useArtists";
import { useLocations } from "@/hooks/use-locations";
import { ArtworkCarousel } from "./ArtworkCarousel";
import { cn } from "@/lib/utils";
import type { ImageRecord } from "@/utils/image-url-resolver";

interface EnhancedArtworkOverviewDialogProps {
  artwork: Artwork;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
  onExport?: () => void;
}

export function EnhancedArtworkOverviewDialog({
  artwork,
  open,
  onOpenChange,
  onEdit,
  onExport
}: EnhancedArtworkOverviewDialogProps) {
  const { data: artists } = useArtists();
  const { data: locations } = useLocations();
  
  const artist = artists?.find(a => a.id === artwork.artist_id);
  const location = locations?.find(l => l.id === artwork.location_id);
  
  // Convert artwork images to ImageRecord format
  const images: ImageRecord[] = artwork.artwork_images?.map(img => ({
    id: img.id,
    image_url: img.image_url,
    thumbnail_url: img.thumbnail_url,
    medium_url: img.medium_url,
    processed: img.processed,
    is_primary: img.is_primary,
    display_order: img.display_order,
    artwork_id: artwork.id
  })) || [];

  const primaryImage = images.find(img => img.is_primary) || images[0];
  
  // Use primary image as fallback if no multiple images
  const carouselImages = images.length > 0 ? images : (primaryImage ? [primaryImage] : []);

  const formatPrice = (price: number | null, currency: string) => {
    if (!price) return "Price on request";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(price);
  };

  const formatDimensions = () => {
    if (artwork.dimensions) return artwork.dimensions;
    if (artwork.height && artwork.width) {
      const parts = [artwork.height, artwork.width];
      if (artwork.depth) parts.push(artwork.depth);
      return `${parts.join(' × ')} cm`;
    }
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-[95vw] h-[95vh] p-0 overflow-hidden">
        <div className="flex h-full">
          {/* Image Section - 60% */}
          <div className="flex-1 relative bg-muted/5">
            <ArtworkCarousel
              images={carouselImages}
              artworkTitle={artwork.title}
              onClose={() => onOpenChange(false)}
              onExport={onExport}
              className="h-full"
            />
          </div>

          {/* Details Section - 40% */}
          <div className="w-[40%] flex flex-col border-l">
            {/* Header */}
            <div className="p-6 border-b">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h1 className="text-2xl font-bold mb-2">{artwork.title}</h1>
                  {artwork.year && (
                    <p className="text-lg text-muted-foreground mb-2">{artwork.year}</p>
                  )}
                  {artist && (
                    <p className="text-lg font-medium">{artist.full_name}</p>
                  )}
                </div>
                
                <div className="flex gap-2">
                  {onEdit && (
                    <Button variant="outline" size="sm" onClick={onEdit}>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => onOpenChange(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Status and Price */}
              <div className="flex items-center gap-4">
                <Badge 
                  variant={artwork.status?.toLowerCase() === 'available' ? 'default' : 'secondary'}
                  className="capitalize"
                >
                  {artwork.status || 'Unknown'}
                </Badge>
                <div className="flex items-center gap-1 text-lg font-semibold">
                  <DollarSign className="w-4 h-4" />
                  {formatPrice(artwork.price, artwork.currency)}
                </div>
              </div>
            </div>

            {/* Scrollable Details */}
            <ScrollArea className="flex-1">
              <div className="p-6 space-y-6">
                {/* Basic Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-medium text-sm text-muted-foreground mb-1">Medium</h3>
                      <div className="flex items-center gap-2">
                        <Palette className="w-4 h-4 text-muted-foreground" />
                        <span>{artwork.medium_type}</span>
                      </div>
                    </div>
                    
                    {formatDimensions() && (
                      <div>
                        <h3 className="font-medium text-sm text-muted-foreground mb-1">Dimensions</h3>
                        <div className="flex items-center gap-2">
                          <Ruler className="w-4 h-4 text-muted-foreground" />
                          <span>{formatDimensions()}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div>
                      <h3 className="font-medium text-sm text-muted-foreground mb-1">Classification</h3>
                      <span>{artwork.classification}</span>
                    </div>
                    
                    {location && (
                      <div>
                        <h3 className="font-medium text-sm text-muted-foreground mb-1">Location</h3>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <span>{location.name}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Materials */}
                {artwork.materials && (
                  <div>
                    <h3 className="font-medium mb-2">Materials</h3>
                    <p className="text-muted-foreground">{artwork.materials}</p>
                  </div>
                )}

                <Separator />

                {/* Additional Details */}
                <div className="space-y-4">
                  {artwork.edition_size && (
                    <div>
                      <h3 className="font-medium text-sm text-muted-foreground mb-1">Edition</h3>
                      <p>{artwork.edition_size} editions</p>
                    </div>
                  )}

                  {artwork.signature_type && (
                    <div>
                      <h3 className="font-medium text-sm text-muted-foreground mb-1">Signature</h3>
                      <p className="capitalize">{artwork.signature_type.replace(/_/g, ' ')}</p>
                      {artwork.signature_details && (
                        <p className="text-sm text-muted-foreground">{artwork.signature_details}</p>
                      )}
                    </div>
                  )}

                  {artwork.condition && (
                    <div>
                      <h3 className="font-medium text-sm text-muted-foreground mb-1">Condition</h3>
                      <p>{artwork.condition}</p>
                    </div>
                  )}
                </div>

                {/* Story/Description */}
                {artwork.story && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="font-medium mb-2">Description</h3>
                      <p className="text-muted-foreground leading-relaxed">{artwork.story}</p>
                    </div>
                  </>
                )}

                {/* Provenance */}
                {artwork.provenance && (
                  <div>
                    <h3 className="font-medium mb-2">Provenance</h3>
                    <p className="text-muted-foreground leading-relaxed">{artwork.provenance}</p>
                  </div>
                )}

                {/* Exhibition History */}
                {artwork.exhibition_history && (
                  <div>
                    <h3 className="font-medium mb-2">Exhibition History</h3>
                    <p className="text-muted-foreground leading-relaxed">{artwork.exhibition_history}</p>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Action Buttons */}
            <div className="p-6 border-t">
              <div className="flex gap-3">
                <Button className="flex-1">
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
                {onExport && (
                  <Button variant="outline" className="flex-1" onClick={onExport}>
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}