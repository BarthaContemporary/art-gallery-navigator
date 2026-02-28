import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Save, RotateCcw, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NodeImage {
  id: string;
  original_url: string;
  thumbnail_url: string | null;
  medium_url: string | null;
  large_url: string | null;
  display_order: number;
}

interface PanoramaComposerProps {
  nodeId: string;
  images: NodeImage[];
  className?: string;
  onSaved?: (stripUrl: string) => void;
}

interface ImageState {
  id: string;
  url: string;
  xOffset: number;
  element: HTMLImageElement | null;
  width: number;
  height: number;
  loaded: boolean;
}

export function PanoramaComposer({ nodeId, images, className = "", onSaved }: PanoramaComposerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageStates, setImageStates] = useState<ImageState[]>([]);
  const [dragging, setDragging] = useState<{ idx: number; startX: number; startOffset: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(0.3);
  const [scrollX, setScrollX] = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(400);

  // Load all images
  useEffect(() => {
    const sorted = [...images].sort((a, b) => a.display_order - b.display_order);
    const states: ImageState[] = sorted.map((img, i) => ({
      id: img.id,
      url: img.medium_url || img.original_url,
      xOffset: 0,
      element: null,
      width: 0,
      height: 0,
      loaded: false,
    }));

    let loadedCount = 0;
    const targetHeight = 800; // normalize all images to this height

    sorted.forEach((img, i) => {
      const el = new Image();
      el.crossOrigin = "anonymous";
      el.onload = () => {
        const scale = targetHeight / el.naturalHeight;
        const scaledWidth = el.naturalWidth * scale;
        states[i].element = el;
        states[i].width = scaledWidth;
        states[i].height = targetHeight;
        states[i].loaded = true;
        loadedCount++;

        if (loadedCount === sorted.length) {
          // Calculate initial offsets: side by side with 10% overlap
          let x = 0;
          for (let j = 0; j < states.length; j++) {
            states[j].xOffset = x;
            const overlap = j < states.length - 1 ? states[j].width * 0.1 : 0;
            x += states[j].width - overlap;
          }
          setImageStates([...states]);
          setCanvasHeight(targetHeight);
        }
      };
      el.onerror = () => {
        states[i].loaded = true;
        loadedCount++;
        if (loadedCount === sorted.length) {
          setImageStates([...states]);
        }
      };
      el.src = img.medium_url || img.original_url;
    });
  }, [images]);

  // Draw canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || imageStates.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const totalWidth = Math.max(
      ...imageStates.map((s) => s.xOffset + s.width),
      1
    );

    const displayWidth = totalWidth * zoom;
    const displayHeight = canvasHeight * zoom;

    canvas.width = Math.max(displayWidth, containerRef.current?.clientWidth || 800);
    canvas.height = displayHeight;

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    imageStates.forEach((state) => {
      if (!state.element || !state.loaded) return;
      const dx = state.xOffset * zoom;
      const dy = 0;
      const dw = state.width * zoom;
      const dh = canvasHeight * zoom;
      ctx.globalAlpha = 0.85;
      ctx.drawImage(state.element, dx, dy, dw, dh);
    });
    ctx.globalAlpha = 1;

    // Draw overlap indicators
    for (let i = 1; i < imageStates.length; i++) {
      const prev = imageStates[i - 1];
      const curr = imageStates[i];
      const overlapStart = curr.xOffset * zoom;
      const overlapEnd = (prev.xOffset + prev.width) * zoom;
      if (overlapEnd > overlapStart) {
        ctx.fillStyle = "rgba(59, 130, 246, 0.15)";
        ctx.fillRect(overlapStart, 0, overlapEnd - overlapStart, canvas.height);
        // Drag handle line
        ctx.strokeStyle = "rgba(59, 130, 246, 0.6)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(overlapStart, 0);
        ctx.lineTo(overlapStart, canvas.height);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }, [imageStates, zoom, canvasHeight]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Mouse/touch drag handling
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left + (containerRef.current?.scrollLeft || 0)) / zoom;

    // Find which image boundary we're near (for images 1+)
    for (let i = 1; i < imageStates.length; i++) {
      const imgX = imageStates[i].xOffset;
      if (Math.abs(x - imgX) < 30) {
        setDragging({ idx: i, startX: e.clientX, startOffset: imageStates[i].xOffset });
        canvas.setPointerCapture(e.pointerId);
        return;
      }
    }
  }, [imageStates, zoom]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = (e.clientX - dragging.startX) / zoom;
    const newOffset = dragging.startOffset + dx;

    // Constrain: can't go before previous image start, can't go past own width overlap
    const prevState = imageStates[dragging.idx - 1];
    const minOffset = prevState.xOffset + prevState.width * 0.3; // max 70% overlap
    const maxOffset = prevState.xOffset + prevState.width; // no gap

    setImageStates((prev) => {
      const next = [...prev];
      next[dragging.idx] = {
        ...next[dragging.idx],
        xOffset: Math.max(minOffset, Math.min(maxOffset, newOffset)),
      };
      // Push subsequent images
      for (let j = dragging.idx + 1; j < next.length; j++) {
        const gap = next[j].xOffset - prev[j].xOffset;
        const prevImg = next[j - 1];
        const minNext = prevImg.xOffset + prevImg.width * 0.3;
        if (next[j].xOffset < minNext) {
          next[j] = { ...next[j], xOffset: minNext };
        }
      }
      return next;
    });
  }, [dragging, imageStates, zoom]);

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  // Reset overlaps
  const resetOverlaps = useCallback(() => {
    setImageStates((prev) => {
      const next = [...prev];
      let x = 0;
      for (let j = 0; j < next.length; j++) {
        next[j] = { ...next[j], xOffset: x };
        const overlap = j < next.length - 1 ? next[j].width * 0.1 : 0;
        x += next[j].width - overlap;
      }
      return next;
    });
  }, []);

  // Save panorama strip
  const savePanoramaStrip = useCallback(async () => {
    if (imageStates.length === 0) return;
    setSaving(true);

    try {
      // Create full-res canvas
      const totalWidth = Math.max(...imageStates.map((s) => s.xOffset + s.width));
      const offscreen = document.createElement("canvas");
      offscreen.width = totalWidth;
      offscreen.height = canvasHeight;
      const ctx = offscreen.getContext("2d");
      if (!ctx) throw new Error("Canvas context unavailable");

      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, offscreen.width, offscreen.height);

      imageStates.forEach((state) => {
        if (!state.element) return;
        ctx.drawImage(state.element, state.xOffset, 0, state.width, canvasHeight);
      });

      const blob = await new Promise<Blob>((resolve, reject) => {
        offscreen.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Failed to create blob"))),
          "image/jpeg",
          0.92
        );
      });

      const storagePath = `panorama-strips/${nodeId}/strip.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from("tour-uploads")
        .upload(storagePath, blob, { contentType: "image/jpeg", upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("tour-uploads")
        .getPublicUrl(storagePath);

      const publicUrl = urlData.publicUrl;

      // Save URL to tour_nodes
      const { error: updateErr } = await supabase
        .from("tour_nodes")
        .update({ panorama_strip_url: publicUrl } as any)
        .eq("id", nodeId);

      if (updateErr) throw updateErr;

      toast.success("Panorama strip saved!");
      onSaved?.(publicUrl);
    } catch (err) {
      console.error("Save panorama strip error:", err);
      toast.error("Failed to save panorama strip", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  }, [imageStates, canvasHeight, nodeId, onSaved]);

  const allLoaded = imageStates.length > 0 && imageStates.every((s) => s.loaded);

  if (!allLoaded) {
    return (
      <div className={`flex-1 flex items-center justify-center bg-black ${className}`}>
        <div className="text-center space-y-3">
          <Loader2 className="h-6 w-6 animate-spin text-white/70 mx-auto" />
          <p className="text-sm text-white/60">Loading images for composer…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex-1 flex flex-col bg-black ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-black/80 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/60">Drag blue lines to adjust overlap</span>
          <div className="flex items-center gap-2">
            <ZoomOut className="h-3.5 w-3.5 text-white/50" />
            <Slider
              value={[zoom * 100]}
              onValueChange={([v]) => setZoom(v / 100)}
              min={10}
              max={100}
              step={5}
              className="w-24"
            />
            <ZoomIn className="h-3.5 w-3.5 text-white/50" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-white/70 hover:text-white hover:bg-white/10 text-xs"
            onClick={resetOverlaps}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={savePanoramaStrip}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
            Save Strip
          </Button>
        </div>
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto"
        style={{ touchAction: "pan-x pan-y" }}
      >
        <canvas
          ref={canvasRef}
          className="cursor-col-resize"
          style={{ display: "block", minHeight: "100%" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>
    </div>
  );
}
