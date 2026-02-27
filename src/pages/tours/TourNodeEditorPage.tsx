import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Upload, Trash2, Star, Loader2, CheckCircle, AlertCircle, Clock, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";
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
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type NodeType = "panorama" | "image_set";
type JobStatus = "queued" | "processing" | "done" | "failed";

interface NodeImage {
  id: string;
  original_url: string;
  thumbnail_url: string | null;
  medium_url: string | null;
  is_primary: boolean;
  display_order: number;
  processing_status: JobStatus;
  processing_error: string | null;
  original_width: number | null;
  original_height: number | null;
  file_size: number | null;
}

// --- Sortable image card ---
function SortableImageCard({
  img,
  index,
  onSetPrimary,
  onDelete,
  statusIcon,
}: {
  img: NodeImage;
  index: number;
  onSetPrimary: (id: string) => void;
  onDelete: (id: string) => void;
  statusIcon: (s: JobStatus) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: img.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.7 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="group relative aspect-square bg-muted rounded-lg overflow-hidden">
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="absolute top-1.5 right-1.5 z-20 h-7 w-7 flex items-center justify-center rounded bg-black/50 text-white/80 hover:text-white hover:bg-black/70 cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Order badge */}
      <div className="absolute top-1.5 left-1.5 z-20">
        <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-black/60 text-white text-[10px] font-bold px-1.5">
          {index + 1}
        </span>
      </div>

      <img
        src={img.thumbnail_url || img.medium_url || img.original_url}
        alt=""
        className="w-full h-full object-cover"
        loading="lazy"
      />

      {/* Overlay controls */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end justify-between p-2 opacity-0 group-hover:opacity-100">
        <div className="flex gap-1">
          <Button
            variant="secondary"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); onSetPrimary(img.id); }}
          >
            <Star className={`h-3.5 w-3.5 ${img.is_primary ? "fill-yellow-400 text-yellow-400" : ""}`} />
          </Button>
          <Button
            variant="destructive"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm("Remove this image?")) onDelete(img.id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          {statusIcon(img.processing_status)}
        </div>
      </div>

      {/* Primary badge */}
      {img.is_primary && (
        <div className="absolute bottom-1.5 left-1.5 z-20">
          <Badge className="text-[10px] px-1.5 py-0">Primary</Badge>
        </div>
      )}
    </div>
  );
}

export default function TourNodeEditorPage() {
  const { id: projectId, nodeId } = useParams<{ id: string; nodeId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { data: node } = useQuery({
    queryKey: ["tour-node", nodeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tour_nodes")
        .select("*")
        .eq("id", nodeId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!nodeId,
  });

  const { data: images = [], isLoading: imagesLoading } = useQuery({
    queryKey: ["tour-node-images", nodeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tour_node_images")
        .select("*")
        .eq("node_id", nodeId!)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as NodeImage[];
    },
    enabled: !!nodeId,
  });

  // --- Reorder mutation ---
  const reorderMutation = useMutation({
    mutationFn: async (reordered: NodeImage[]) => {
      const updates = reordered.map((img, idx) =>
        supabase.from("tour_node_images").update({ display_order: idx }).eq("id", img.id)
      );
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-node-images", nodeId] });
    },
    onError: () => {
      toast.error("Failed to reorder images");
      queryClient.invalidateQueries({ queryKey: ["tour-node-images", nodeId] });
    },
  });

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = images.findIndex((img) => img.id === active.id);
      const newIndex = images.findIndex((img) => img.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(images, oldIndex, newIndex);
      // Optimistic update
      queryClient.setQueryData(["tour-node-images", nodeId], reordered);
      reorderMutation.mutate(reordered);
    },
    [images, nodeId, queryClient, reorderMutation]
  );

  const uploadFiles = useCallback(async (files: File[]) => {
    if (!nodeId) return;
    setUploading(true);
    setUploadProgress(0);

    let completed = 0;
    for (const file of files) {
      try {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `tours/${projectId}/${nodeId}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("tour-uploads")
          .upload(path, file, { upsert: false });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("tour-uploads")
          .getPublicUrl(path);

        const img = new window.Image();
        const dimensions = await new Promise<{ w: number; h: number }>((resolve) => {
          img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => resolve({ w: 0, h: 0 });
          img.src = URL.createObjectURL(file);
        });

        const { error: insertError } = await supabase.from("tour_node_images").insert({
          node_id: nodeId,
          original_url: publicUrlData.publicUrl,
          original_width: dimensions.w || null,
          original_height: dimensions.h || null,
          file_size: file.size,
          mime_type: file.type,
          is_primary: images.length === 0 && completed === 0,
          display_order: images.length + completed,
          processing_status: "queued" as JobStatus,
        });

        if (insertError) throw insertError;
        completed++;
        setUploadProgress(Math.round((completed / files.length) * 100));
      } catch (err: any) {
        console.error("Upload error:", err);
        toast.error(`Failed to upload ${file.name}: ${err.message}`);
      }
    }

    setUploading(false);
    queryClient.invalidateQueries({ queryKey: ["tour-node-images", nodeId] });
    if (completed > 0) toast.success(`Uploaded ${completed} image${completed !== 1 ? "s" : ""}`);
  }, [nodeId, projectId, images.length, queryClient]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: uploadFiles,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp", ".tiff"] },
    disabled: uploading,
  });

  const deleteImageMutation = useMutation({
    mutationFn: async (imageId: string) => {
      const { error } = await supabase.from("tour_node_images").delete().eq("id", imageId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-node-images", nodeId] });
      toast.success("Image removed");
    },
  });

  const setPrimaryMutation = useMutation({
    mutationFn: async (imageId: string) => {
      await supabase.from("tour_node_images").update({ is_primary: false }).eq("node_id", nodeId!);
      const { error } = await supabase.from("tour_node_images").update({ is_primary: true }).eq("id", imageId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-node-images", nodeId] });
    },
  });

  const updateNodeMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase.from("tour_nodes").update(updates).eq("id", nodeId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tour-node", nodeId] });
      toast.success("Node updated");
    },
  });

  const statusIcon = (status: JobStatus) => {
    switch (status) {
      case "done": return <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />;
      case "processing": return <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />;
      case "failed": return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
      default: return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  if (!node) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/tours/${projectId}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Input
              value={node.name}
              onChange={(e) => updateNodeMutation.mutate({ name: e.target.value })}
              className="text-xl font-semibold border-none p-0 h-auto focus-visible:ring-0 bg-transparent"
            />
            <Badge variant="secondary" className="text-xs capitalize flex-shrink-0">
              {node.node_type === "panorama" ? "360° Panorama" : "Image Set"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Node Settings */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Node Type</Label>
              <Select
                value={node.node_type}
                onValueChange={(v) => updateNodeMutation.mutate({ node_type: v })}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="image_set">Image Set</SelectItem>
                  <SelectItem value="panorama">Panorama</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Initial Heading (°)</Label>
              <Input
                type="number"
                value={node.initial_heading || 0}
                onChange={(e) => updateNodeMutation.mutate({ initial_heading: parseFloat(e.target.value) || 0 })}
                className="h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        } ${uploading ? "opacity-50 pointer-events-none" : ""}`}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div className="space-y-2">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Uploading... {uploadProgress}%</p>
            <div className="w-48 mx-auto bg-muted rounded-full h-1.5">
              <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        ) : (
          <div>
            <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium">Drop images here or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">
              {node.node_type === "panorama"
                ? "Upload an equirectangular panorama image"
                : "Upload multiple high-res photographs"}
            </p>
          </div>
        )}
      </div>

      {/* Image Grid with drag-to-reorder */}
      {imagesLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-square bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : images.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Images ({images.length})</h3>
            <p className="text-xs text-muted-foreground">Drag to reorder • Order determines immersive strip sequence</p>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={images.map((img) => img.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {images.map((img, idx) => (
                  <SortableImageCard
                    key={img.id}
                    img={img}
                    index={idx}
                    onSetPrimary={(id) => setPrimaryMutation.mutate(id)}
                    onDelete={(id) => deleteImageMutation.mutate(id)}
                    statusIcon={statusIcon}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      ) : null}
    </div>
  );
}
