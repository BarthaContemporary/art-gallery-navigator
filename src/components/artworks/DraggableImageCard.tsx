import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LocalArtworkImage } from "./LocalArtworkImage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Star, 
  Trash2, 
  RefreshCw, 
  AlertTriangle, 
  GripVertical 
} from "lucide-react";
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

interface DraggableImageCardProps {
  image: any;
  index: number;
  onSetPrimary: (imageId: string) => void;
  onDelete: (imageId: string) => void;
  onRetryProcessing: (imageId: string) => void;
  updatingImageId: string | null;
  deletingImageId: string | null;
  retryingImageId: string | null;
}

export function DraggableImageCard({
  image,
  index,
  onSetPrimary,
  onDelete,
  onRetryProcessing,
  updatingImageId,
  deletingImageId,
  retryingImageId,
}: DraggableImageCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
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

  const needsRetry = image.processing_status === 'failed' || 
    (image.processing_status === 'processing' && image.created_at &&
     new Date().getTime() - new Date(image.created_at).getTime() > 30 * 60 * 1000);

  return (
    <Card 
      ref={setNodeRef} 
      style={style} 
      className={`relative group ${isDragging ? 'opacity-50 shadow-lg' : ''}`}
    >
      <CardContent className="p-0">
        <div className="aspect-square relative">
          <LocalArtworkImage
            imageRecord={image}
            title={`Image ${index + 1}`}
            className="w-full h-full rounded-t-lg"
            size="medium"
            showProcessingStatus={true}
          />
          
          {/* Drag handle */}
          <div 
            {...attributes}
            {...listeners}
            className="absolute top-2 left-2 bg-background/80 rounded p-1 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
            title="Drag to reorder"
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </div>
          
          {/* Image badges - moved to top-right */}
          <div className="absolute top-2 right-2 flex gap-1">
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
            <div className="absolute top-12 left-2">
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
          <div className="flex justify-center gap-1">
            {!image.is_primary && image.processing_status === 'completed' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSetPrimary(image.id)}
                disabled={updatingImageId === image.id}
                className="text-xs h-8 px-2"
                title="Set as Primary"
              >
                <Star className="w-3 h-3 mr-1" />
                Primary
              </Button>
            )}

            {needsRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRetryProcessing(image.id)}
                disabled={retryingImageId === image.id}
                className="text-xs h-8 px-2"
              >
                {retryingImageId === image.id ? (
                  <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="w-3 h-3 mr-1" />
                )}
                Retry
              </Button>
            )}
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={deletingImageId === image.id}
                  className="text-xs h-8 px-2"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Delete
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
                    onClick={() => onDelete(image.id)}
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
}