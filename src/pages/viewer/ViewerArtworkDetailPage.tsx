import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Copy, Upload, Trash2, GripVertical, Check, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useViewerArtwork, useUpdateViewerArtwork } from '@/hooks/viewer/useViewerArtworks';
import { useAddViewerImage, useDeleteViewerImage, useReorderViewerImages } from '@/hooks/viewer/useViewerImages';
import { useProcessViewerImage, useBatchProcessImages } from '@/hooks/viewer/useProcessViewerImage';
import { ViewerImageOptimizer } from '@/services/viewer/image-optimizer';
import { supabase } from '@/integrations/supabase/client';
import type { ViewerArtworkImage } from '@/types/viewer';
import { cn } from '@/lib/utils';

// Check if image has optimized URLs
function isImageProcessed(image: ViewerArtworkImage): boolean {
  return !!(image.small_url && image.medium_url && image.large_url);
}

function SortableImage({
  image,
  onDelete,
  isProcessing,
}: {
  image: ViewerArtworkImage;
  onDelete: () => void;
  isProcessing?: boolean;
}) {
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
    opacity: isDragging ? 0.5 : 1,
  };

  const processed = isImageProcessed(image);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group aspect-square bg-muted rounded overflow-hidden"
    >
      <img
        src={ViewerImageOptimizer.getOptimizedUrl(image, 'small')}
        alt={image.alt_text || ''}
        className="w-full h-full object-cover"
        loading="lazy"
      />
      
      {/* Processing status indicator */}
      <div className={cn(
        "absolute top-1 right-1 p-1 rounded-full",
        isProcessing ? "bg-yellow-500/80" : processed ? "bg-green-500/80" : "bg-orange-500/80"
      )}>
        {isProcessing ? (
          <RefreshCw className="h-3 w-3 text-white animate-spin" />
        ) : processed ? (
          <CheckCircle2 className="h-3 w-3 text-white" />
        ) : (
          <AlertCircle className="h-3 w-3 text-white" />
        )}
      </div>
      
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
        {image.position + 1}
      </div>
    </div>
  );
}

export default function ViewerArtworkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: artwork, isLoading } = useViewerArtwork(id);
  const updateArtwork = useUpdateViewerArtwork();
  const addImage = useAddViewerImage();
  const deleteImage = useDeleteViewerImage();
  const reorderImages = useReorderViewerImages();
  const processImage = useProcessViewerImage();
  const batchProcess = useBatchProcessImages();

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const [processingImages, setProcessingImages] = useState<Set<string>>(new Set());

  // Count processed vs unprocessed images
  const processedCount = artwork?.images?.filter(isImageProcessed).length || 0;
  const totalImages = artwork?.images?.length || 0;
  const unprocessedImages = artwork?.images?.filter(img => !isImageProcessed(img)) || [];

  // Auto-process new images that don't have optimized URLs
  useEffect(() => {
    if (!artwork?.images?.length) return;

    const toProcess = artwork.images.filter(
      img => !isImageProcessed(img) && !processingImages.has(img.id)
    );

    if (toProcess.length > 0) {
      // Mark as processing
      setProcessingImages(prev => {
        const next = new Set(prev);
        toProcess.forEach(img => next.add(img.id));
        return next;
      });

      // Process in background
      toProcess.forEach(img => {
        processImage.mutate(
          { image_id: img.id, original_url: img.original_url, artwork_id: artwork.id },
          {
            onSettled: () => {
              setProcessingImages(prev => {
                const next = new Set(prev);
                next.delete(img.id);
                return next;
              });
            },
          }
        );
      });
    }
  }, [artwork?.images]);

  // Manual reprocess all images
  const handleReprocessAll = () => {
    if (!artwork?.images?.length) return;

    const imagesToProcess = artwork.images.map(img => ({
      image_id: img.id,
      original_url: img.original_url,
      artwork_id: artwork.id,
    }));

    setProcessingImages(new Set(artwork.images.map(img => img.id)));
    
    batchProcess.mutate(imagesToProcess, {
      onSettled: () => {
        setProcessingImages(new Set());
      },
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Minimum drag distance before activation
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!artwork?.images) return;

      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = artwork.images.findIndex((img) => img.id === active.id);
      const newIndex = artwork.images.findIndex((img) => img.id === over.id);

      const newOrder = arrayMove(artwork.images, oldIndex, newIndex);
      const updates = newOrder.map((img, idx) => ({ id: img.id, position: idx }));

      reorderImages.mutate({ artwork_id: artwork.id, images: updates });
    },
    [artwork, reorderImages]
  );

  const uploadFiles = async (files: FileList | File[]) => {
    if (!files.length || !artwork) return;

    const maxImages = 20;
    const currentCount = artwork.images?.length || 0;
    const filesToUpload = Array.from(files).slice(0, maxImages - currentCount);

    if (filesToUpload.length === 0) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < filesToUpload.length; i++) {
        const file = filesToUpload[i];
        const ext = file.name.split('.').pop();
        const path = `viewer/${artwork.id}/${Date.now()}-${i}.${ext}`;

        // Get image dimensions
        const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ width: img.width, height: img.height });
          img.src = URL.createObjectURL(file);
        });

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('artwork-images')
          .upload(path, file);

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('artwork-images')
          .getPublicUrl(path);

        // Add to database
        await addImage.mutateAsync({
          artwork_id: artwork.id,
          original_url: urlData.publicUrl,
          width: dimensions.width,
          height: dimensions.height,
          position: currentCount + i,
        });

        setUploadProgress(((i + 1) / filesToUpload.length) * 100);
      }

      toast.success(`${filesToUpload.length} image(s) uploaded`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload images');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      await uploadFiles(e.target.files);
      e.target.value = '';
    }
  };

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!uploading && (artwork.images?.length || 0) < 20) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (uploading || (artwork.images?.length || 0) >= 20) return;

    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length) {
      await uploadFiles(files);
    }
  };

  const copyEmbedCode = () => {
    const code = `<iframe src="${window.location.origin}/w/${artwork?.slug}" style="border:0;width:100%;height:100%;" allowfullscreen></iframe>`;
    navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Embed code copied');
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!artwork) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Artwork not found</p>
        <Button variant="link" onClick={() => navigate('/viewer')} className="mt-2 px-0">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to artworks
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/viewer')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight truncate">{artwork.title}</h1>
          <p className="text-sm text-muted-foreground">
            {artwork.artist_name}
            {artwork.year && ` · ${artwork.year}`}
          </p>
        </div>
        <Button variant="outline" onClick={() => window.open(`/w/${artwork.slug}`, '_blank')}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Preview
        </Button>
      </div>

      <Tabs defaultValue="images" className="space-y-4">
        <TabsList>
          <TabsTrigger value="images">Images</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="embed">Embed</TabsTrigger>
        </TabsList>

        <TabsContent value="images" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>Images</CardTitle>
                  <CardDescription>
                    Upload up to 20 high-resolution images. Drag to reorder.
                  </CardDescription>
                </div>
                {totalImages > 0 && (
                  <div className="flex items-center gap-2">
                    <Badge variant={processedCount === totalImages ? "default" : "secondary"}>
                      {processedCount}/{totalImages} optimized
                    </Badge>
                    {unprocessedImages.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleReprocessAll}
                        disabled={batchProcess.isPending || processingImages.size > 0}
                      >
                        <RefreshCw className={cn("h-4 w-4 mr-2", batchProcess.isPending && "animate-spin")} />
                        Reprocess All
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "relative border-2 border-dashed rounded-lg p-6 transition-colors",
                  isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25",
                  uploading && "pointer-events-none opacity-60",
                  (artwork.images?.length || 0) >= 20 && "pointer-events-none opacity-40"
                )}
              >
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={handleFileUpload}
                  disabled={uploading || (artwork.images?.length || 0) >= 20}
                />
                <div className="flex flex-col items-center justify-center gap-2 text-center pointer-events-none">
                  <Upload className={cn("h-8 w-8", isDragging ? "text-primary" : "text-muted-foreground")} />
                  {uploading ? (
                    <>
                      <p className="text-sm text-muted-foreground">Uploading...</p>
                      <Progress value={uploadProgress} className="w-48" />
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium">
                        {isDragging ? "Drop images here" : "Drag & drop images here"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        or click to browse • Max 20 images
                      </p>
                    </>
                  )}
                </div>
              </div>

              {artwork.images?.length ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={artwork.images.map((img) => img.id)}
                    strategy={rectSortingStrategy}
                  >
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {artwork.images.map((image) => (
                        <SortableImage
                          key={image.id}
                          image={image}
                          isProcessing={processingImages.has(image.id)}
                          onDelete={() =>
                            deleteImage.mutate({ id: image.id, artwork_id: artwork.id })
                          }
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Artwork Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="artist_name">Artist Name</Label>
                  <Input
                    id="artist_name"
                    defaultValue={artwork.artist_name}
                    onBlur={(e) => {
                      if (e.target.value !== artwork.artist_name) {
                        updateArtwork.mutate({ id: artwork.id, artist_name: e.target.value });
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    defaultValue={artwork.title}
                    onBlur={(e) => {
                      if (e.target.value !== artwork.title) {
                        updateArtwork.mutate({ id: artwork.id, title: e.target.value });
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">Year</Label>
                  <Input
                    id="year"
                    defaultValue={artwork.year || ''}
                    onBlur={(e) => {
                      if (e.target.value !== artwork.year) {
                        updateArtwork.mutate({ id: artwork.id, year: e.target.value || null });
                      }
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="embed" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Embed Code</CardTitle>
              <CardDescription>
                Copy this code to embed the viewer on external websites
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Textarea
                  readOnly
                  value={`<iframe src="${window.location.origin}/w/${artwork.slug}" style="border:0;width:100%;height:100%;" allowfullscreen></iframe>`}
                  className="font-mono text-sm pr-20"
                  rows={3}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={copyEmbedCode}
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Query Parameters</Label>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>
                    <code className="bg-muted px-1 rounded">?initial=fit</code> or{' '}
                    <code className="bg-muted px-1 rounded">?initial=fill</code> - Initial zoom mode
                  </p>
                  <p>
                    <code className="bg-muted px-1 rounded">?dark=true</code> - Force dark mode
                  </p>
                  <p>
                    <code className="bg-muted px-1 rounded">?metadata=false</code> - Hide artwork info
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <Label>Direct Link</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/w/${artwork.slug}`}
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/w/${artwork.slug}`);
                      toast.success('Link copied');
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
