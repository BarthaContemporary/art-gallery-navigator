import React, { useState } from "react";
import { useLocalArtworkImages } from "@/hooks/use-local-artwork-images";
import { DraggableImageCard } from "./DraggableImageCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { logger } from "@/lib/logger";
import { ImageRepairService } from "@/services/image-repair-service";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from "@dnd-kit/sortable";

interface LocalArtworkImageManagerProps {
  artworkId: string;
}

export function LocalArtworkImageManager({ artworkId }: LocalArtworkImageManagerProps) {
  const { images, loading, error, refreshImages } = useLocalArtworkImages(artworkId);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const [updatingImageId, setUpdatingImageId] = useState<string | null>(null);
  const [retryingImageId, setRetryingImageId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const sortedImages = [...images].sort((a, b) => {
      // Primary image first, then by display order
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      return (a.display_order || 0) - (b.display_order || 0);
    });

    const oldIndex = sortedImages.findIndex(img => img.id === active.id);
    const newIndex = sortedImages.findIndex(img => img.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reorderedImages = arrayMove(sortedImages, oldIndex, newIndex);
      
      try {
        // Update display_order for all images based on new positions
        const updates = reorderedImages.map((image, index) => ({
          id: image.id,
          display_order: index
        }));

        // Batch update all display orders
        for (const update of updates) {
          await supabase
            .from('artwork_images')
            .update({ display_order: update.display_order })
            .eq('id', update.id);
        }

        toast.success('Images reordered');
        refreshImages();
      } catch (error) {
        logger.error('[LocalArtworkImageManager] Drag reorder failed:', error);
        toast.error('Failed to reorder images');
      }
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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={sortedImages.map(img => img.id)}
        strategy={rectSortingStrategy}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedImages.map((image, index) => (
            <DraggableImageCard
              key={image.id}
              image={image}
              index={index}
              onSetPrimary={handleSetPrimary}
              onDelete={handleDelete}
              onRetryProcessing={handleRetryProcessing}
              updatingImageId={updatingImageId}
              deletingImageId={deletingImageId}
              retryingImageId={retryingImageId}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
