/**
 * Phase 2: Modern Artwork Card Component
 * 
 * Clean, performant card with hover effects.
 * Uses the new ReliableArtworkImage component.
 */

import React, { useState } from "react";
import { Artwork } from "@/hooks/use-artworks";
import { SmartArtworkImage } from "./SmartArtworkImage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Edit, Copy, Download, Trash2, Heart, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModernArtworkCardProps {
  artwork: Artwork;
  onView?: (artwork: Artwork) => void;
  onEdit?: (artwork: Artwork) => void;
  onDuplicate?: (artwork: Artwork) => void;
  onExport?: (artwork: Artwork) => void;
  onDelete?: (artwork: Artwork) => void;
  onFavorite?: (artwork: Artwork) => void;
  onShare?: (artwork: Artwork) => void;
  showActions?: boolean;
  compact?: boolean;
}

export function ModernArtworkCard({ 
  artwork,
  onView,
  onEdit,
  onDuplicate,
  onExport,
  onDelete,
  onFavorite,
  onShare,
  showActions = true,
  compact = false
}: ModernArtworkCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const handleView = () => {
    onView?.(artwork);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(artwork);
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDuplicate?.(artwork);
  };

  const handleExport = (e: React.MouseEvent) => {
    e.stopPropagation();
    onExport?.(artwork);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(artwork);
  };

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFavorite?.(artwork);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    onShare?.(artwork);
  };

  return (
    <div
      className={cn(
        "group relative bg-card border rounded-xl overflow-hidden transition-all duration-300 cursor-pointer",
        "hover:shadow-xl hover:shadow-primary/10 hover:border-primary/20",
        compact ? "hover:scale-[1.02]" : "hover:scale-[1.03]"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleView}
    >
      {/* Image Container */}
      <div className={cn(
        "relative overflow-hidden",
        compact ? "aspect-square" : "aspect-[4/3]"
      )}>
        <SmartArtworkImage
          artwork={artwork}
          finalTier="medium"
          className="group-hover:scale-105 transition-transform duration-500"
          alt={artwork.title}
          showHealthIndicator={process.env.NODE_ENV === 'development'}
        />
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Status badge */}
        <div className="absolute top-3 left-3">
          <Badge 
            variant={artwork.status?.toLowerCase() === 'available' ? 'default' : 'secondary'}
            className="backdrop-blur-sm bg-background/80"
          >
            {artwork.status || 'Unknown'}
          </Badge>
        </div>

        {/* Quick actions */}
        {showActions && (
          <div className={cn(
            "absolute top-3 right-3 flex gap-1 transition-all duration-300",
            isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
          )}>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleFavorite}
              className="h-8 w-8 p-0 backdrop-blur-sm bg-background/80 hover:bg-background/90"
            >
              <Heart className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleShare}
              className="h-8 w-8 p-0 backdrop-blur-sm bg-background/80 hover:bg-background/90"
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        )}
        
        {/* Main action buttons */}
        {showActions && (
          <div className={cn(
            "absolute bottom-3 left-3 right-3 flex justify-between items-end transition-all duration-300",
            isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          )}>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleEdit}
                className="h-8 w-8 p-0 backdrop-blur-sm bg-background/80 hover:bg-background/90"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleDuplicate}
                className="h-8 w-8 p-0 backdrop-blur-sm bg-background/80 hover:bg-background/90"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleExport}
                className="h-8 w-8 p-0 backdrop-blur-sm bg-background/80 hover:bg-background/90"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDelete}
                className="h-8 w-8 p-0 backdrop-blur-sm bg-destructive/80 hover:bg-destructive/90"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            
            <Button
              size="sm"
              variant="default"
              onClick={handleView}
              className="px-4 backdrop-blur-sm bg-primary/90 hover:bg-primary"
            >
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className={cn("p-4", compact && "p-3")}>
        <div className="space-y-2">
          <h3 className={cn(
            "font-semibold line-clamp-1 text-foreground",
            compact ? "text-sm" : "text-base"
          )}>
            {artwork.title}
          </h3>
          
          <p className={cn(
            "text-muted-foreground line-clamp-1",
            compact ? "text-xs" : "text-sm"
          )}>
            {artwork.artist_name || 'Unknown Artist'}
          </p>
          
          <div className="flex items-center justify-between">
            <span className={cn(
              "text-muted-foreground",
              compact ? "text-xs" : "text-sm"
            )}>
              {artwork.year || 'Unknown'}
              {artwork.medium_type && ` • ${artwork.medium_type}`}
            </span>
            
            {artwork.price && (
              <span className={cn(
                "font-semibold text-foreground",
                compact ? "text-sm" : "text-base"
              )}>
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: artwork.currency || 'USD',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0
                }).format(artwork.price)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}