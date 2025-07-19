/**
 * Clean Artwork Viewer Component
 * Full-screen artwork viewing experience
 */

import React from "react";
import { X, ChevronLeft, ChevronRight, Edit, Download, Share2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArtworkImage } from "./ArtworkImage";
import type { Artwork } from "@/types/artwork";
import { cn } from "@/lib/utils";

interface ArtworkViewerProps {
  artwork: Artwork | null;
  artworks: Artwork[];
  currentIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNext: () => void;
  onPrevious: () => void;
  onEdit?: (artwork: Artwork) => void;
  onExport?: (artwork: Artwork) => void;
  onShare?: (artwork: Artwork) => void;
}

export function ArtworkViewer({
  artwork,
  artworks,
  currentIndex,
  open,
  onOpenChange,
  onNext,
  onPrevious,
  onEdit,
  onExport,
  onShare
}: ArtworkViewerProps) {
  if (!artwork) return null;

  const hasNext = currentIndex < artworks.length - 1;
  const hasPrevious = currentIndex > 0;

  const handleAction = (action: (() => void) | undefined) => {
    action?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-0 overflow-hidden">
        <div className="relative bg-black">
          {/* Close button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="absolute top-4 right-4 z-50 text-white hover:bg-white/20 h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>

          {/* Navigation */}
          {hasPrevious && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onPrevious}
              className="absolute left-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 h-12 w-12 p-0"
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
          )}

          {hasNext && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20 h-12 w-12 p-0"
            >
              <ChevronRight className="h-6 w-6" />
            </Button>
          )}

          {/* Actions */}
          <div className="absolute top-4 left-4 z-50 flex gap-2">
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAction(() => onEdit(artwork))}
                className="text-white hover:bg-white/20 h-8 w-8 p-0"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {onExport && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAction(() => onExport(artwork))}
                className="text-white hover:bg-white/20 h-8 w-8 p-0"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            {onShare && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleAction(() => onShare(artwork))}
                className="text-white hover:bg-white/20 h-8 w-8 p-0"
              >
                <Share2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Image */}
          <div className="relative flex items-center justify-center min-h-[60vh] max-h-[80vh]">
            <ArtworkImage
              artwork={artwork}
              tier="large"
              className="max-w-full max-h-full object-contain"
              alt={artwork.title}
              priority
            />
          </div>

          {/* Info panel */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 text-white">
            <div className="max-w-4xl">
              <div className="flex items-start justify-between mb-4">
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold">{artwork.title}</h2>
                  <p className="text-lg text-white/90">{artwork.artist_name}</p>
                  <div className="flex items-center gap-4 text-sm text-white/80">
                    {artwork.year && <span>{artwork.year}</span>}
                    {artwork.medium_type && <span>{artwork.medium_type}</span>}
                    {artwork.dimensions && <span>{artwork.dimensions}</span>}
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                  <Badge variant={artwork.status?.toLowerCase() === 'available' ? 'default' : 'secondary'}>
                    {artwork.status}
                  </Badge>
                  {artwork.price && (
                    <div className="text-lg font-semibold">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: artwork.currency || 'USD',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0
                      }).format(artwork.price)}
                    </div>
                  )}
                </div>
              </div>

              {/* Additional details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-white/80">
                {artwork.materials && (
                  <div>
                    <span className="font-medium">Materials:</span> {artwork.materials}
                  </div>
                )}
                {artwork.classification && (
                  <div>
                    <span className="font-medium">Classification:</span> {artwork.classification}
                  </div>
                )}
                {artwork.condition && (
                  <div>
                    <span className="font-medium">Condition:</span> {artwork.condition}
                  </div>
                )}
              </div>

              {/* Navigation indicator */}
              <div className="mt-4 text-xs text-white/60 text-center">
                {currentIndex + 1} of {artworks.length}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}