
import React, { useState } from "react";
import { useLocalArtworkImages } from "@/hooks/use-local-artwork-images";
import { LocalArtworkImage } from "./LocalArtworkImage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Star, Trash2, MoveUp, MoveDown, RefreshCw, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { logger } from "@/lib/logger";
import { ImageRepairService } from "@/services/image-repair-service";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface LocalArtworkImageManagerProps {
  artworkId: string;
}

export function LocalArtworkImageManager({ artworkId }: LocalArtworkImageManagerProps) {
  const { images, loading, error, refreshImages } = useLocalArtworkImages(artworkId);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const [updatingImageId, setUpdatingImageId] = useState<string | null>(null);
  const [retryingImageId, setRetryingImageId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const handleSetPrimary = async (imageId: string) => {
    setUpdatingImageId(imageId);
    try {
      // First, unset all primary images for this artwork
      const { error: unsetError } = await supabase
        .from('artwork_images')
        .update({ is_primary: false })
        .eq('artwork_id', artworkId);

      if (unsetError) throw unsetError;

      // Then set the selected image as primary
      const { error } = await supabase
        .from('artwork_images')
        .update({ is_primary: true })
        .eq('id', imageId);

      if (error) throw error;

      toast.success('Primary image updated');
      refreshImages();
      queryClient.invalidateQueries({ queryKey: ['artworks'] });
    } catch (error) {
      logger.error('[LocalArtworkImageManager] Set primary failed:', error);
      toast.error('Failed to update primary image');
    } finally {
      setUpdatingImageId(null);
    }
  };

  const handleDelete = async (imageId: string) => {
    setDeletingImageId(imageId);
    try {
      const { error } = await supabase
        .from('artwork_images')
        .delete()
        .eq('id', imageId);

      if (error) throw error;

      toast.success('Image deleted');
      refreshImages();
      queryClient.invalidateQueries({ queryKey: ['artworks'] });
    } catch (error) {
      logger.error('[LocalArtworkImageManager] Delete failed:', error);
      toast.error('Failed to delete image');
    } finally {
      setDeletingImageId(null);
    }
  };

  const handleReorder = async (imageId: string, direction: 'up' | 'down') => {
    setUpdatingImageId(imageId);
    try {
      const currentImage = images.find(img => img.id === imageId);
      if (!currentImage) return;

      const currentOrder = currentImage.display_order || 0;
      const newOrder = direction === 'up' ? currentOrder - 1 : currentOrder + 1;

      // Find image at target position and swap orders
      const targetImage = images.find(img => (img.display_order || 0) === newOrder);
      
      if (targetImage) {
        // Swap orders
        await supabase
          .from('artwork_images')
          .update({ display_order: currentOrder })
          .eq('id', targetImage.id);
      }

      const { error } = await supabase
        .from('artwork_images')
        .update({ display_order: newOrder })
        .eq('id', imageId);

      if (error) throw error;

      toast.success('Image order updated');
      refreshImages();
    } catch (error) {
      logger.error('[LocalArtworkImageManager] Reorder failed:', error);
      toast.error('Failed to reorder image');
    } finally {
      setUpdatingImageId(null);
    }
  };

  const handleRetryProcessing = async (imageId: string) => {
    setRetryingImageId(imageId);
    try {
      const result = await ImageRepairService.retryImageProcessing(imageId);
      
      if (result.success) {
        toast.success('Processing retry initiated');
        refreshImages();
      } else {
        toast.error(`Retry failed: ${result.error}`);
      }
    } catch (error) {
      logger.error('[LocalArtworkImageManager] Retry failed:', error);
      toast.error('Failed to retry processing');
    } finally {
      setRetryingImageId(null);
    }
  };

  const getProcessingStatusBadge = (image: any) => {
    const status = image.processing_status;
    const isStuck = status === 'processing' && image.created_at &&
      new Date().getTime() - new Date(image.created_at).getTime() > 30 * 60 * 1000;

    switch (status) {
      case 'completed':
        return <Badge variant="default" className="text-xs bg-green-600">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="text-xs">Failed</Badge>;
      case 'processing':
        return (
          <Badge variant={isStuck ? "destructive" : "secondary"} className="text-xs">
            {isStuck ? 'Stuck' : 'Processing...'}
          </Badge>
        );
      case 'pending':
        return <Badge variant="secondary" className="text-xs">Pending</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Unknown</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="aspect-square">
            <CardContent className="p-4 h-full">
              <div className="animate-pulse bg-muted rounded h-full"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={refreshImages} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (!images.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No images uploaded yet</p>
      </div>
    );
  }

  const sortedImages = [...images].sort((a, b) => {
    // Primary image first, then by display order
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return (a.display_order || 0) - (b.display_order || 0);
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sortedImages.map((image, index) => {
        const needsRetry = image.processing_status === 'failed' || 
          (image.processing_status === 'processing' && image.created_at &&
           new Date().getTime() - new Date(image.created_at).getTime() > 30 * 60 * 1000);

        return (
          <Card key={image.id} className="relative group">
            <CardContent className="p-0">
              <div className="aspect-square relative">
                <LocalArtworkImage
                  imageRecord={image}
                  title={`Image ${index + 1}`}
                  className="w-full h-full rounded-t-lg"
                  size="medium"
                  showProcessingStatus={true}
                />
                
                {/* Image badges */}
                <div className="absolute top-2 left-2 flex gap-1">
                  {image.is_primary && (
                    <Badge variant="default" className="text-xs">
                      <Star className="w-3 h-3 mr-1" />
                      Primary
                    </Badge>
                  )}
                  {getProcessingStatusBadge(image)}
                </div>

                {/* Error indicator */}
                {needsRetry && (
                  <div className="absolute top-2 right-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  </div>
                )}
              </div>
              
              {/* Image info and actions */}
              <div className="p-3 space-y-2">
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>Order: {image.display_order || 0}</span>
                  <span>
                    {image.original_width && image.original_height && 
                      `${image.original_width}×${image.original_height}`
                    }
                  </span>
                </div>

                {/* Error message */}
                {image.processing_error && (
                  <div className="text-xs text-red-600 p-2 bg-red-50 rounded">
                    <strong>Error:</strong> {image.processing_error}
                  </div>
                )}
                
                {/* Action buttons */}
                <div className="flex flex-wrap gap-1">
                  {!image.is_primary && image.processing_status === 'completed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSetPrimary(image.id)}
                      disabled={updatingImageId === image.id}
                      className="text-xs h-6 w-6 p-0"
                      title="Set as Primary"
                    >
                      <Star className="w-2.5 h-2.5" />
                    </Button>
                  )}

                  {needsRetry && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRetryProcessing(image.id)}
                      disabled={retryingImageId === image.id}
                      className="text-xs h-6"
                    >
                      {retryingImageId === image.id ? (
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                      ) : (
                        <>
                          <RefreshCw className="w-2.5 h-2.5 mr-1" />
                          Retry
                        </>
                      )}
                    </Button>
                  )}
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReorder(image.id, 'up')}
                    disabled={updatingImageId === image.id || index === 0}
                    className="text-xs h-6 w-6 p-0"
                  >
                    <MoveUp className="w-2.5 h-2.5" />
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReorder(image.id, 'down')}
                    disabled={updatingImageId === image.id || index === sortedImages.length - 1}
                    className="text-xs h-6 w-6 p-0"
                  >
                    <MoveDown className="w-2.5 h-2.5" />
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={deletingImageId === image.id}
                        className="text-xs h-6 w-6 p-0"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Image</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this image? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(image.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
