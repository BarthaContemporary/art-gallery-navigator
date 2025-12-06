import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Copy, Upload, Trash2, GripVertical, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
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
import { supabase } from '@/integrations/supabase/client';
import type { ViewerArtworkImage } from '@/types/viewer';

function SortableImage({
  image,
  onDelete,
}: {
  image: ViewerArtworkImage;
  onDelete: () => void;
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group aspect-square bg-muted rounded overflow-hidden"
    >
      <img
        src={image.medium_url || image.original_url}
        alt={image.alt_text || ''}
        className="w-full h-full object-cover"
        loading="lazy"
      />
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

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [copied, setCopied] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !artwork) return;

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
      e.target.value = '';
    }
  };

  const copyEmbedCode = () => {
    const code = `<iframe src="${window.location.origin}/w/${artwork?.id}" style="border:0;width:100%;height:100%;" allowfullscreen></iframe>`;
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
        <Button variant="outline" onClick={() => window.open(`/w/${artwork.id}`, '_blank')}>
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
              <CardTitle>Images</CardTitle>
              <CardDescription>
                Upload up to 20 high-resolution images. Drag to reorder.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Button asChild disabled={uploading || (artwork.images?.length || 0) >= 20}>
                  <label className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Images
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                </Button>
                {uploading && (
                  <div className="flex-1 max-w-xs">
                    <Progress value={uploadProgress} />
                  </div>
                )}
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
                          onDelete={() =>
                            deleteImage.mutate({ id: image.id, artwork_id: artwork.id })
                          }
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <p className="text-muted-foreground">No images uploaded yet</p>
                </div>
              )}
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
                  value={`<iframe src="${window.location.origin}/w/${artwork.id}" style="border:0;width:100%;height:100%;" allowfullscreen></iframe>`}
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
                    value={`${window.location.origin}/w/${artwork.id}`}
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/w/${artwork.id}`);
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
