import React, { useState } from "react";
import { Artwork } from "@/hooks/use-artworks";
import { SimpleArtworkImage } from "./SimpleArtworkImage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Edit, Copy, Download, Trash2 } from "lucide-react";
import { EnhancedArtworkOverviewDialog } from "./enhanced/EnhancedArtworkOverviewDialog";

interface SimpleArtworkCardProps {
  artwork: Artwork;
}

export function SimpleArtworkCard({ artwork }: SimpleArtworkCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showOverview, setShowOverview] = useState(false);

  const handleView = () => {
    setShowOverview(true);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: Implement edit functionality
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: Implement duplicate functionality
  };

  const handleExport = (e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: Implement export functionality
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    // TODO: Implement delete functionality
  };

  return (
    <>
      <div
        className="group relative bg-card border rounded-lg overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleView}
      >
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden">
          <SimpleArtworkImage artwork={artwork} />
          
          {/* Hover overlay with actions */}
          <div className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
            <div className="absolute top-2 right-2 flex gap-1">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleEdit}
                className="h-8 w-8 p-0"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleDuplicate}
                className="h-8 w-8 p-0"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleExport}
                className="h-8 w-8 p-0"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDelete}
                className="h-8 w-8 p-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end">
              <Badge variant={artwork.status?.toLowerCase() === 'available' ? 'default' : 'secondary'}>
                {artwork.status || 'Unknown'}
              </Badge>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleView}
                className="h-8 px-3"
              >
                <Eye className="h-4 w-4 mr-1" />
                View
              </Button>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="p-4">
          <h3 className="font-semibold text-sm mb-1 line-clamp-1">
            {artwork.title}
          </h3>
          <p className="text-muted-foreground text-xs mb-2 line-clamp-1">
            {artwork.artist_name || 'Unknown Artist'}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {artwork.year || 'Unknown'}
            </span>
            {artwork.price && (
              <span className="text-sm font-medium">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: artwork.currency || 'USD'
                }).format(artwork.price)}
              </span>
            )}
          </div>
        </div>
      </div>

      <EnhancedArtworkOverviewDialog
        artwork={artwork}
        open={showOverview}
        onOpenChange={setShowOverview}
      />
    </>
  );
}