
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CloudinaryImageService } from "@/services/cloudinary-image-service";
import { useLocalArtworkImages } from "@/hooks/use-local-artwork-images";
import { Badge } from "@/components/ui/badge";

interface ImageDiagnosticsProps {
  artworkId: string;
  artworkTitle: string;
}

export function ImageDiagnostics({ artworkId, artworkTitle }: ImageDiagnosticsProps) {
  const { images, primaryImage, loading, error } = useLocalArtworkImages(artworkId);

  if (loading) return <div>Loading diagnostics...</div>;
  if (error) return <div>Error loading diagnostics: {error}</div>;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-sm">Image Diagnostics - {artworkTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm font-medium">Total Images: {images.length}</p>
          <p className="text-sm">Primary Image: {primaryImage ? 'Found' : 'None'}</p>
        </div>

        {images.map((image, index) => {
          const thumbnailUrl = CloudinaryImageService.getBestImageUrl(image, 'thumbnail');
          const mediumUrl = CloudinaryImageService.getBestImageUrl(image, 'medium');
          
          return (
            <div key={image.id} className="border p-3 rounded text-xs space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={image.is_primary ? "default" : "secondary"}>
                  {image.is_primary ? 'Primary' : `Image ${index + 1}`}
                </Badge>
                <Badge variant="outline">{image.processing_status || 'unknown'}</Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p><strong>ID:</strong> {image.id}</p>
                  <p><strong>Original Path:</strong> {image.original_storage_path || 'None'}</p>
                  <p><strong>Thumbnail Path:</strong> {image.thumbnail_storage_path || 'None'}</p>
                  <p><strong>Medium Path:</strong> {image.medium_storage_path || 'None'}</p>
                </div>
                <div>
                  <p><strong>Image URL:</strong> {image.image_url || 'None'}</p>
                  <p><strong>Thumbnail URL:</strong> {image.thumbnail_url || 'None'}</p>
                  <p><strong>Medium URL:</strong> {image.medium_url || 'None'}</p>
                  <p><strong>Processing Status:</strong> {image.processing_status || 'unknown'}</p>
                </div>
              </div>
              
              <div className="border-t pt-2">
                <p><strong>Resolved Thumbnail:</strong> {thumbnailUrl}</p>
                <p><strong>Resolved Medium:</strong> {mediumUrl}</p>
              </div>

              {thumbnailUrl !== '/placeholder.svg' && (
                <div className="border rounded p-2">
                  <p className="text-xs mb-1">Preview:</p>
                  <img 
                    src={thumbnailUrl} 
                    alt={`Preview ${index + 1}`}
                    className="w-16 h-16 object-cover rounded"
                    onError={(e) => {
                      console.error(`Failed to load preview for image ${image.id}:`, thumbnailUrl);
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
