import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Camera, X, Check, Plus, ArrowRight, Loader2, Trash2, Image } from "lucide-react";
import { CaptureGuidanceOverlay } from "./CaptureGuidanceOverlay";

type NodeType = "panorama" | "image_set";
type WizardStep = "name" | "capture" | "summary";

interface CompletedPosition {
  nodeId: string;
  name: string;
  nodeType: NodeType;
  photoCount: number;
}

interface CapturedPhoto {
  id: string;
  url: string;
  file: File;
}

interface MobileCaptureWizardProps {
  projectId: string;
  onComplete: () => void;
  onClose: () => void;
}

export function MobileCaptureWizard({ projectId, onComplete, onClose }: MobileCaptureWizardProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<WizardStep>("name");
  const [positionName, setPositionName] = useState("");
  const [nodeType, setNodeType] = useState<NodeType>("image_set");
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [completedPositions, setCompletedPositions] = useState<CompletedPosition[]>([]);
  const [uploading, setUploading] = useState(false);

  const totalPositions = completedPositions.length + (currentNodeId ? 1 : 0);

  const hapticFeedback = () => {
    try {
      navigator.vibrate?.(50);
    } catch {}
  };

  const createNode = useCallback(async () => {
    if (!positionName.trim()) return;
    setUploading(true);
    try {
      const { data, error } = await supabase
        .from("tour_nodes")
        .insert({
          project_id: projectId,
          name: positionName.trim(),
          node_type: nodeType,
          position_index: completedPositions.length,
        })
        .select("id")
        .single();

      if (error) throw error;
      setCurrentNodeId(data.id);
      setStep("capture");
      hapticFeedback();
    } catch (err: any) {
      toast.error("Failed to create position: " + err.message);
    } finally {
      setUploading(false);
    }
  }, [positionName, nodeType, projectId, completedPositions.length]);

  const handlePhotoCapture = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0 || !currentNodeId) return;

      setUploading(true);
      const file = files[0];

      try {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `tours/${projectId}/${currentNodeId}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("tour-uploads")
          .upload(path, file, { upsert: false });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("tour-uploads")
          .getPublicUrl(path);

        // Get dimensions
        const img = new window.Image();
        const dimensions = await new Promise<{ w: number; h: number }>((resolve) => {
          img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => resolve({ w: 0, h: 0 });
          img.src = URL.createObjectURL(file);
        });

        const { data: insertData, error: insertError } = await supabase
          .from("tour_node_images")
          .insert({
            node_id: currentNodeId,
            original_url: publicUrlData.publicUrl,
            original_width: dimensions.w || null,
            original_height: dimensions.h || null,
            file_size: file.size,
            mime_type: file.type,
            is_primary: photos.length === 0,
            display_order: photos.length,
            processing_status: "queued" as const,
          })
          .select("id")
          .single();

        if (insertError) throw insertError;

        setPhotos((prev) => [
          ...prev,
          { id: insertData.id, url: URL.createObjectURL(file), file },
        ]);

        hapticFeedback();
        toast.success("Photo captured!");
      } catch (err: any) {
        toast.error("Upload failed: " + err.message);
      } finally {
        setUploading(false);
        // Reset input so the same file can be selected again
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [currentNodeId, projectId, photos.length]
  );

  const deletePhoto = useCallback(
    async (photoId: string) => {
      try {
        await supabase.from("tour_node_images").delete().eq("id", photoId);
        setPhotos((prev) => prev.filter((p) => p.id !== photoId));
        toast.success("Photo removed");
      } catch {
        toast.error("Failed to remove photo");
      }
    },
    []
  );

  const finishPosition = useCallback(() => {
    if (!currentNodeId) return;
    setCompletedPositions((prev) => [
      ...prev,
      {
        nodeId: currentNodeId,
        name: positionName,
        nodeType: nodeType,
        photoCount: photos.length,
      },
    ]);
    setStep("summary");
  }, [currentNodeId, positionName, nodeType, photos.length]);

  const startNextPosition = useCallback(() => {
    setPositionName("");
    setNodeType("image_set");
    setCurrentNodeId(null);
    setPhotos([]);
    setStep("name");
  }, []);

  const finishCapture = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["tour-nodes", projectId] });
    onComplete();
  }, [queryClient, projectId, onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Camera className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-sm font-semibold">Capture Mode</h2>
            <p className="text-xs text-muted-foreground">
              {totalPositions === 0
                ? "Set up your first position"
                : `${completedPositions.length} position${completedPositions.length !== 1 ? "s" : ""} captured`}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-9 w-9">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Progress bar */}
      {completedPositions.length > 0 && (
        <Progress value={100} className="h-1 rounded-none" />
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Step: Name */}
        {step === "name" && (
          <div className="p-6 space-y-6">
            <div className="text-center pt-4 pb-2">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Camera className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">New Position</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Name this scan position and choose the type
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Position Name</label>
                <Input
                  value={positionName}
                  onChange={(e) => setPositionName(e.target.value)}
                  placeholder="e.g. Entrance Hall"
                  className="h-12 text-base"
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setNodeType("image_set")}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      nodeType === "image_set"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <Image className="h-5 w-5 mb-2 text-primary" />
                    <p className="text-sm font-medium">Image Set</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Multiple photos for deep zoom</p>
                  </button>
                  <button
                    onClick={() => setNodeType("panorama")}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      nodeType === "panorama"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30"
                    }`}
                  >
                    <span className="text-xl mb-2 block">🌐</span>
                    <p className="text-sm font-medium">Panorama</p>
                    <p className="text-xs text-muted-foreground mt-0.5">360° view of the space</p>
                  </button>
                </div>
              </div>
            </div>

            <Button
              onClick={createNode}
              disabled={!positionName.trim() || uploading}
              className="w-full h-14 text-base"
              size="xl"
            >
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <ArrowRight className="h-5 w-5 mr-2" />
              )}
              Continue to Capture
            </Button>
          </div>
        )}

        {/* Step: Capture */}
        {step === "capture" && (
          <div className="flex flex-col h-full">
            <CaptureGuidanceOverlay nodeType={nodeType} photoCount={photos.length + 1} />

            {/* Photo grid */}
            {photos.length > 0 && (
              <div className="px-4 pb-4">
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  {photos.length} photo{photos.length !== 1 ? "s" : ""} captured
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((photo) => (
                    <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                      <img
                        src={photo.url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => deletePhoto(photo.id)}
                        className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive/90 text-destructive-foreground flex items-center justify-center"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Camera input (hidden) */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoCapture}
            />

            {/* Action buttons */}
            <div className="mt-auto p-4 space-y-3 border-t border-border bg-background">
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full h-14 text-base"
                size="xl"
              >
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                ) : (
                  <Camera className="h-5 w-5 mr-2" />
                )}
                {photos.length === 0 ? "Take Photo" : "Add Another Photo"}
              </Button>

              {photos.length > 0 && (
                <Button
                  onClick={finishPosition}
                  variant="secondary"
                  className="w-full h-12 text-base"
                >
                  <Check className="h-5 w-5 mr-2" />
                  Done with this spot
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Step: Summary */}
        {step === "summary" && (
          <div className="p-6 space-y-6">
            <div className="text-center pt-4 pb-2">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Great work!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {completedPositions.length} position{completedPositions.length !== 1 ? "s" : ""} captured so far
              </p>
            </div>

            {/* Completed positions list */}
            <div className="space-y-2">
              {completedPositions.map((pos, i) => (
                <div
                  key={pos.nodeId}
                  className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50"
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{pos.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {pos.photoCount} photo{pos.photoCount !== 1 ? "s" : ""} •{" "}
                      {pos.nodeType === "panorama" ? "Panorama" : "Image Set"}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Button
                onClick={startNextPosition}
                variant="outline"
                className="w-full h-14 text-base"
                size="xl"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Next Position
              </Button>
              <Button
                onClick={finishCapture}
                className="w-full h-14 text-base"
                size="xl"
              >
                <Check className="h-5 w-5 mr-2" />
                Finish Capture
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
