
/**
 * Full Screen Image Viewer Component
 * Uses the unified image system for consistent behavior
 */

import React from "react";
import { Artwork } from "@/hooks/use-artworks";
import { UnifiedImage } from "@/components/ui/unified-image";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, Edit, Download, Share2 } from "lucide-react";

interface FullScreenImageViewerProps {
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

export function FullScreenImageViewer({
  artwork,
  artworks,
  currentIndex,
  open,
  onOpenChange,
  onNext,
  onPrevious,
  onEdit,
  onExport,
  onShare,
}: FullScreenImageViewerProps) {
  if (!artwork) return null;

  const canGoNext = currentIndex < artworks.length - 1;
  const canGoPrevious = currentIndex > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black border-none">
        <div className="relative w-full h-[95vh] flex items-center justify-center">
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-6 w-6" />
          </Button>

          {/* Navigation buttons */}
          {canGoPrevious && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 z-50 text-white hover:bg-white/20"
              onClick={onPrevious}
            >
              <ChevronLeft className="h-8 w-8" />
            </Button>
          )}

          {canGoNext && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 z-50 text-white hover:bg-white/20"
              onClick={onNext}
            >
              <ChevronRight className="h-8 w-8" />
            </Button>
          )}

          {/* Action buttons */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50 flex gap-2">
            {onEdit && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onEdit(artwork)}
                className="bg-white/20 hover:bg-white/30 text-white border-white/20"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
            {onExport && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onExport(artwork)}
                className="bg-white/20 hover:bg-white/30 text-white border-white/20"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            )}
            {onShare && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onShare(artwork)}
                className="bg-white/20 hover:bg-white/30 text-white border-white/20"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            )}
          </div>

          {/* Main image */}
          <UnifiedImage
            artwork={artwork}
            tier="original"
            className="max-w-full max-h-full object-contain"
            alt={artwork.title}
            priority={true}
            showErrorDetails={true}
          />

          {/* Image info overlay */}
          <div className="absolute bottom-4 left-4 z-50 text-white">
            <h3 className="text-lg font-semibold mb-1">
              {artwork.title}
              {artwork.year && `, ${artwork.year}`}
            </h3>
            <p className="text-sm opacity-75">
              {artwork.artist_name || 'Unknown Artist'}
            </p>
            <p className="text-xs opacity-60 mt-1">
              {currentIndex + 1} of {artworks.length}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
