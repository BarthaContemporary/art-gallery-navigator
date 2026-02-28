import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Save, RotateCcw, Loader2, ZoomIn, ZoomOut, GripVertical, Wand2, X } from "lucide-react";
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
  onProcess?: () => void;
  onExit?: () => void;
  processing?: boolean;
  canProcess?: boolean;
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

export function PanoramaComposer({
  nodeId,
  images,
  className = "",
  onSaved,
  onProcess,
  onExit,
  processing = false,
  canProcess = false,
}: PanoramaComposerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageStates, setImageStates] = useState<ImageState[]>([]);
  const [dragging, setDragging] = useState<{ idx: number; startX: number; startOffset: number } | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(0.5);
  const [canvasHeight, setCanvasHeight] = useState(400);

  // Load all images — duplicate first image at the end for 360° wrap
  useEffect(() => {
    const sorted = [...images].sort((a, b) => a.display_order - b.display_order);
    // Append a copy of the first image at the end for seamless 360° looping
    const withWrap = sorted.length > 0 ? [...sorted, { ...sorted[0], id: sorted[0].id + "_wrap" }] : sorted;

    const states: ImageState[] = withWrap.map((img) => ({
      id: img.id,
      url: img.medium_url || img.original_url,
      xOffset: 0,
      element: null,
      width: 0,
      height: 0,
      loaded: false,
    }));

    let loadedCount = 0;
    const targetHeight = 800;

    withWrap.forEach((img, i) => {
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

        if (loadedCount === withWrap.length) {
          let x = 0;
          for (let j = 0; j < states.length; j++) {
            states[j].xOffset = x;
            const overlap = j < states.length - 1 ? states[j].width * 0.15 : 0;
            x += states[j].width - overlap;
          }
          setImageStates([...states]);
          setCanvasHeight(targetHeight);
        }
      };
      el.onerror = () => {
        states[i].loaded = true;
        loadedCount++;
        if (loadedCount === withWrap.length) {
          setImageStates([...states]);
        }
      };
      el.src = img.medium_url || img.original_url;
    });
  }, [images]);

  // Get canvas X from pointer event, accounting for scroll
  const getCanvasX = useCallback((e: React.PointerEvent | PointerEvent) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return 0;
    const rect = canvas.getBoundingClientRect();
    return (e.clientX - rect.left) / zoom;
  }, [zoom]);

  // Find which drag handle index is near x (in unzoomed coords)
  const findHandleAt = useCallback((x: number): number | null => {
    // Hit zone: 50px in unzoomed space (generous)
    const hitZone = 50;
    for (let i = 1; i < imageStates.length; i++) {
      const handleX = imageStates[i].xOffset;
      if (Math.abs(x - handleX) < hitZone) {
        return i;
      }
    }
    return null;
  }, [imageStates]);

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
    canvas.height = Math.max(displayHeight, containerRef.current?.clientHeight || 400);

    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw images at 50% transparency for overlap visibility
    imageStates.forEach((state) => {
      if (!state.element || !state.loaded) return;
      const dx = state.xOffset * zoom;
      const dw = state.width * zoom;
      const dh = canvasHeight * zoom;
      ctx.globalAlpha = 0.5;
      ctx.drawImage(state.element, dx, 0, dw, dh);
    });
    ctx.globalAlpha = 1.0;

    // Draw overlap zones and drag handles
    for (let i = 1; i < imageStates.length; i++) {
      const prev = imageStates[i - 1];
      const curr = imageStates[i];
      const overlapStartPx = curr.xOffset * zoom;
      const overlapEndPx = (prev.xOffset + prev.width) * zoom;
      const isHovered = hoveredIdx === i;
      const isDragged = dragging?.idx === i;
      const isActive = isHovered || isDragged;

      // Overlap shading
      if (overlapEndPx > overlapStartPx) {
        ctx.fillStyle = isActive ? "rgba(59, 130, 246, 0.25)" : "rgba(59, 130, 246, 0.1)";
        ctx.fillRect(overlapStartPx, 0, overlapEndPx - overlapStartPx, canvas.height);
      }

      // Drag handle line
      const lineColor = isActive ? "rgba(59, 130, 246, 1)" : "rgba(59, 130, 246, 0.5)";
      const lineWidth = isActive ? 3 : 2;
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = lineWidth;
      ctx.setLineDash(isActive ? [] : [6, 4]);
      ctx.beginPath();
      ctx.moveTo(overlapStartPx, 0);
      ctx.lineTo(overlapStartPx, canvas.height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw drag grip icon at handle center
      const gripY = canvas.height / 2;
      const gripSize = isActive ? 28 : 22;
      ctx.fillStyle = isActive ? "rgba(59, 130, 246, 0.9)" : "rgba(59, 130, 246, 0.6)";
      ctx.beginPath();
      ctx.roundRect(overlapStartPx - gripSize / 2, gripY - gripSize / 2, gripSize, gripSize, 6);
      ctx.fill();

      // Grip dots
      ctx.fillStyle = "#fff";
      const dotR = 2;
      for (let row = -1; row <= 1; row++) {
        for (let col = -1; col <= 1; col += 2) {
          ctx.beginPath();
          ctx.arc(overlapStartPx + col * 4, gripY + row * 6, dotR, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Overlap label
      if (overlapEndPx > overlapStartPx) {
        const overlapPx = overlapEndPx - overlapStartPx;
        const overlapPct = Math.round((overlapPx / (prev.width * zoom)) * 100);
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.font = `${isActive ? "bold " : ""}11px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(`${overlapPct}%`, overlapStartPx + overlapPx / 2, 18);
      }
    }
  }, [imageStates, zoom, canvasHeight, hoveredIdx, dragging]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Pointer handlers
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const x = getCanvasX(e);
    const idx = findHandleAt(x);
    if (idx !== null) {
      e.preventDefault();
      setDragging({ idx, startX: e.clientX, startOffset: imageStates[idx].xOffset });
      canvasRef.current?.setPointerCapture(e.pointerId);
    }
  }, [imageStates, getCanvasX, findHandleAt]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (dragging) {
      e.preventDefault();
      const dx = (e.clientX - dragging.startX) / zoom;
      let newOffset = dragging.startOffset + dx;

      const prevState = imageStates[dragging.idx - 1];
      const minOffset = prevState.xOffset + prevState.width * 0.2; // max 80% overlap
      const maxOffset = prevState.xOffset + prevState.width + 50; // allow small gap

      newOffset = Math.max(minOffset, Math.min(maxOffset, newOffset));

      setImageStates((prev) => {
        const next = [...prev];
        const delta = newOffset - next[dragging.idx].xOffset;
        next[dragging.idx] = { ...next[dragging.idx], xOffset: newOffset };
        // Push subsequent images by same delta
        for (let j = dragging.idx + 1; j < next.length; j++) {
          next[j] = { ...next[j], xOffset: next[j].xOffset + delta };
        }
        return next;
      });
    } else {
      // Hover detection for cursor
      const x = getCanvasX(e);
      const idx = findHandleAt(x);
      setHoveredIdx(idx);
      if (canvasRef.current) {
        canvasRef.current.style.cursor = idx !== null ? "col-resize" : "default";
      }
    }
  }, [dragging, imageStates, zoom, getCanvasX, findHandleAt]);

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
        const overlap = j < next.length - 1 ? next[j].width * 0.15 : 0;
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
          <div className="flex items-center gap-1.5 text-xs text-blue-400">
            <GripVertical className="h-3.5 w-3.5" />
            <span>Drag handles to adjust overlap</span>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <ZoomOut className="h-3.5 w-3.5 text-white/50" />
            <Slider
              value={[zoom * 100]}
              onValueChange={([v]) => setZoom(v / 100)}
              min={15}
              max={100}
              step={5}
              className="w-28"
            />
            <ZoomIn className="h-3.5 w-3.5 text-white/50" />
            <span className="text-xs text-white/40 min-w-[3ch]">{Math.round(zoom * 100)}%</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onProcess?.();
            }}
            disabled={processing || !canProcess}
          >
            {processing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 mr-1" />}
            Process 360°
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-white/70 hover:text-white hover:bg-white/10 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onExit?.();
            }}
          >
            <X className="h-3.5 w-3.5 mr-1" /> Exit
          </Button>
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
