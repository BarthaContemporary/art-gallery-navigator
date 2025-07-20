
import React from "react";
import { Artwork } from "@/hooks/use-artworks";
import { UnifiedImage } from "@/components/ui/unified-image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EnhancedArtworkOverviewDialogProps {
  artwork: Artwork;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EnhancedArtworkOverviewDialog({
  artwork,
  open,
  onOpenChange,
}: EnhancedArtworkOverviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
        <div className="flex flex-col h-full">
          {/* Image Section */}
          <div className="relative w-full bg-black flex-shrink-0" style={{ height: "60vh" }}>
            <UnifiedImage
              artwork={artwork}
              tier="large"
              className="w-full h-full"
              alt={artwork.title}
              priority={true}
              showErrorDetails={true}
            />
          </div>
          
          {/* Content Section */}
          <div className="flex-1 overflow-y-auto p-6">
            <DialogHeader>
              <DialogTitle className="text-2xl font-semibold">
                {artwork.title}
                {artwork.year && `, ${artwork.year}`}
              </DialogTitle>
            </DialogHeader>
            
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-lg text-muted-foreground">
                  {artwork.artist_name || 'Unknown Artist'}
                </p>
              </div>
              
              {artwork.medium_type && (
                <div>
                  <h3 className="font-semibold mb-1">Medium</h3>
                  <p className="text-muted-foreground">{artwork.medium_type}</p>
                </div>
              )}
              
              {artwork.dimensions && (
                <div>
                  <h3 className="font-semibold mb-1">Dimensions</h3>
                  <p className="text-muted-foreground">{artwork.dimensions}</p>
                </div>
              )}
              
              {artwork.price && (
                <div>
                  <h3 className="font-semibold mb-1">Price</h3>
                  <p className="text-muted-foreground">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: artwork.currency || 'USD'
                    }).format(artwork.price)}
                  </p>
                </div>
              )}
              
              {artwork.story && (
                <div>
                  <h3 className="font-semibold mb-1">Story</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{artwork.story}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
