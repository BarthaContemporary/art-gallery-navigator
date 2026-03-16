import { useState, useRef, useEffect, useCallback } from "react";
import { ZoomIn, ZoomOut, Eye, EyeOff, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface PanoramaDiagnosticsViewerProps {
  panoramaUrl: string;
  stripUrl?: string | null;
  imageCount?: number;
  className?: string;
}

interface DiagnosticResult {
  type: "warning" | "info" | "success";
  label: string;
  detail: string;
}

/**
 * Displays the flat equirectangular panorama with visual diagnostic overlays:
 * - Seam zone indicators
 * - Exposure/brightness analysis per segment
 * - Coverage band visualization
 * - Resolution info
 */
export function PanoramaDiagnosticsViewer({
  panoramaUrl,
  stripUrl,
  imageCount = 0,
  className = "",
}: PanoramaDiagnosticsViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.5);
  const [showOverlays, setShowOverlays] = useState(true);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [segmentBrightness, setSegmentBrightness] = useState<number[]>([]);

  // Load panorama image
  useEffect(() => {
    setImgLoaded(false);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setImgEl(img);
      setImgLoaded(true);
    };
    img.onerror = () => setImgLoaded(false);
    img.src = panoramaUrl;
  }, [panoramaUrl]);

  // Analyze and draw
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !imgEl) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const displayW = imgEl.naturalWidth * zoom;
    const displayH = imgEl.naturalHeight * zoom;
    canvas.width = Math.max(displayW, container.clientWidth);
    canvas.height = Math.max(displayH, container.clientHeight);

    // Dark background
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Center the image
    const offsetX = Math.max(0, (canvas.width - displayW) / 2);
    const offsetY = Math.max(0, (canvas.height - displayH) / 2);

    ctx.drawImage(imgEl, offsetX, offsetY, displayW, displayH);

    if (!showOverlays) return;

    // --- Analyze segments ---
    const numSegments = Math.max(imageCount, 6);
    const segW = displayW / numSegments;
    const results: DiagnosticResult[] = [];
    const brightnesses: number[] = [];

    // Sample brightness per segment
    const sampleCanvas = document.createElement("canvas");
    sampleCanvas.width = imgEl.naturalWidth;
    sampleCanvas.height = imgEl.naturalHeight;
    const sampleCtx = sampleCanvas.getContext("2d", { willReadFrequently: true })!;
    sampleCtx.drawImage(imgEl, 0, 0);

    const segSrcW = Math.floor(imgEl.naturalWidth / numSegments);
    const bandTop = Math.round(imgEl.naturalHeight * 0.31);
    const bandBottom = Math.round(imgEl.naturalHeight * 0.69);
    const sampleH = bandBottom - bandTop;

    for (let i = 0; i < numSegments; i++) {
      const sx = i * segSrcW;
      const data = sampleCtx.getImageData(sx, bandTop, Math.min(segSrcW, imgEl.naturalWidth - sx), sampleH);
      let totalBrightness = 0;
      const step = 16;
      let count = 0;
      for (let p = 0; p < data.data.length; p += 4 * step) {
        totalBrightness += (data.data[p] * 0.299 + data.data[p + 1] * 0.587 + data.data[p + 2] * 0.114);
        count++;
      }
      brightnesses.push(count > 0 ? totalBrightness / count : 0);
    }

    setSegmentBrightness(brightnesses);

    // --- Draw overlays ---

    // 1. Coverage band indicators
    const bandTopY = offsetY + imgEl.naturalHeight * 0.31 * zoom;
    const bandBottomY = offsetY + imgEl.naturalHeight * 0.69 * zoom;

    // Top pole zone
    ctx.fillStyle = "rgba(239, 68, 68, 0.08)";
    ctx.fillRect(offsetX, offsetY, displayW, bandTopY - offsetY);
    // Bottom pole zone
    ctx.fillRect(offsetX, bandBottomY, displayW, offsetY + displayH - bandBottomY);

    // Band boundary lines
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = "rgba(251, 191, 36, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(offsetX, bandTopY);
    ctx.lineTo(offsetX + displayW, bandTopY);
    ctx.moveTo(offsetX, bandBottomY);
    ctx.lineTo(offsetX + displayW, bandBottomY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Labels for zones
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "rgba(251, 191, 36, 0.7)";
    ctx.textAlign = "center";
    ctx.fillText("↑ Gradient fill (ceiling)", offsetX + displayW / 2, offsetY + (bandTopY - offsetY) / 2 + 4);
    ctx.fillText("↓ Gradient fill (floor)", offsetX + displayW / 2, bandBottomY + (offsetY + displayH - bandBottomY) / 2 + 4);

    // 2. Segment dividers with brightness analysis
    const avgBrightness = brightnesses.reduce((a, b) => a + b, 0) / brightnesses.length;
    let exposureIssues = 0;

    for (let i = 0; i < numSegments; i++) {
      const x = offsetX + i * segW;

      // Segment divider
      if (i > 0) {
        ctx.strokeStyle = "rgba(99, 179, 237, 0.3)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x, bandTopY);
        ctx.lineTo(x, bandBottomY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Brightness indicator bar at bottom of each segment
      const brightness = brightnesses[i];
      const deviation = Math.abs(brightness - avgBrightness) / avgBrightness;
      const barH = 4;
      const barY = bandBottomY + 8;

      if (deviation > 0.15) {
        // Significant exposure difference
        ctx.fillStyle = "rgba(239, 68, 68, 0.6)";
        exposureIssues++;
      } else if (deviation > 0.08) {
        ctx.fillStyle = "rgba(251, 191, 36, 0.5)";
      } else {
        ctx.fillStyle = "rgba(34, 197, 94, 0.4)";
      }
      ctx.fillRect(x + 2, barY, segW - 4, barH);

      // Brightness value
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${Math.round(brightness)}`, x + segW / 2, barY + barH + 12);
    }

    // 3. Seam wrap indicator (left–right edge)
    const seamX = offsetX;
    ctx.strokeStyle = "rgba(168, 85, 247, 0.6)";
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(seamX, bandTopY);
    ctx.lineTo(seamX, bandBottomY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(168, 85, 247, 0.7)";
    ctx.font = "bold 9px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("← WRAP SEAM", seamX + 4, bandTopY + 14);

    // Same at right edge
    const seamXR = offsetX + displayW;
    ctx.strokeStyle = "rgba(168, 85, 247, 0.6)";
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(seamXR, bandTopY);
    ctx.lineTo(seamXR, bandBottomY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(168, 85, 247, 0.7)";
    ctx.textAlign = "right";
    ctx.fillText("WRAP SEAM →", seamXR - 4, bandTopY + 14);

    // Build diagnostics
    results.push({
      type: "info",
      label: "Resolution",
      detail: `${imgEl.naturalWidth}×${imgEl.naturalHeight}px (${imgEl.naturalWidth >= 4096 ? "HD" : "Low"})`,
    });
    results.push({
      type: "info",
      label: "Aspect ratio",
      detail: `${(imgEl.naturalWidth / imgEl.naturalHeight).toFixed(2)}:1 (${Math.abs(imgEl.naturalWidth / imgEl.naturalHeight - 2) < 0.1 ? "correct" : "should be 2:1"})`,
    });
    results.push({
      type: "info",
      label: "Coverage",
      detail: "Central 38% band contains source imagery, poles are gradient-filled",
    });

    if (exposureIssues > 0) {
      results.push({
        type: "warning",
        label: "Exposure variation",
        detail: `${exposureIssues} segment${exposureIssues > 1 ? "s" : ""} with >15% brightness deviation — consider matching exposure before composing`,
      });
    } else {
      results.push({
        type: "success",
        label: "Exposure consistency",
        detail: "All segments have consistent brightness levels",
      });
    }

    const firstBrightness = brightnesses[0];
    const lastBrightness = brightnesses[brightnesses.length - 1];
    const seamDeviation = Math.abs(firstBrightness - lastBrightness) / avgBrightness;
    if (seamDeviation > 0.12) {
      results.push({
        type: "warning",
        label: "Wrap seam",
        detail: `Left/right edges differ by ${Math.round(seamDeviation * 100)}% — may cause visible seam in 360° view`,
      });
    } else {
      results.push({
        type: "success",
        label: "Wrap seam",
        detail: "Left and right edges match well for seamless wrapping",
      });
    }

    setDiagnostics(results);
  }, [imgEl, zoom, showOverlays, imageCount]);

  useEffect(() => {
    draw();
  }, [draw]);

  if (!imgLoaded) {
    return (
      <div className={`flex items-center justify-center bg-black ${className}`}>
        <div className="text-center space-y-2">
          <div className="animate-spin h-5 w-5 border-2 border-white/20 border-t-white/60 rounded-full mx-auto" />
          <p className="text-xs text-white/40">Loading panorama…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col bg-black ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-white/8 bg-black/90 backdrop-blur-sm z-10 shrink-0">
        <span className="text-xs text-white/40 shrink-0">Panorama Diagnostics</span>

        <div className="w-px h-4 bg-white/10" />

        {/* Zoom */}
        <div className="flex items-center gap-2 shrink-0">
          <ZoomOut className="h-3 w-3 text-white/30" />
          <Slider
            value={[zoom * 100]}
            onValueChange={([v]) => setZoom(v / 100)}
            min={10}
            max={100}
            step={5}
            className="w-20"
          />
          <ZoomIn className="h-3 w-3 text-white/30" />
          <span className="text-[10px] text-white/30 min-w-[3ch] tabular-nums">{Math.round(zoom * 100)}%</span>
        </div>

        <div className="w-px h-4 bg-white/10" />

        {/* Toggle overlays */}
        <button
          onClick={() => setShowOverlays(!showOverlays)}
          className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded-md transition-colors ${
            showOverlays ? "text-white/80 bg-white/10" : "text-white/40 hover:text-white/60"
          }`}
        >
          {showOverlays ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          Overlays
        </button>

        <div className="flex-1" />

        {/* Legend */}
        <div className="flex items-center gap-3 text-[9px] text-white/30 shrink-0">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-500/60" /> Wrap seam
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400/60" /> Band edge
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-400/40" /> Segments
          </span>
        </div>
      </div>

      {/* Canvas area */}
      <div ref={containerRef} className="flex-1 overflow-auto" style={{ touchAction: "pan-x pan-y" }}>
        <canvas ref={canvasRef} style={{ display: "block", minHeight: "100%" }} />
      </div>

      {/* Diagnostics panel */}
      {diagnostics.length > 0 && (
        <div className="shrink-0 border-t border-white/8 bg-black/95 px-4 py-2.5 space-y-1.5 max-h-[30%] overflow-y-auto">
          <p className="text-[10px] text-white/30 uppercase tracking-wider font-medium mb-1">Diagnostics</p>
          {diagnostics.map((d, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              {d.type === "warning" ? (
                <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />
              ) : d.type === "success" ? (
                <CheckCircle className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <Info className="h-3 w-3 text-blue-400 shrink-0 mt-0.5" />
              )}
              <div>
                <span className="text-white/70 font-medium">{d.label}: </span>
                <span className="text-white/45">{d.detail}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
