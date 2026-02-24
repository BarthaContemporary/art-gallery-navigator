import { useState, useEffect } from "react";
import { X, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CaptureGuidanceOverlayProps {
  nodeType: "image_set" | "panorama";
  photoCount: number;
}

const DISMISSED_KEY = "capture-guidance-dismissed";

export function CaptureGuidanceOverlay({ nodeType, photoCount }: CaptureGuidanceOverlayProps) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === "true";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const tips =
    nodeType === "panorama"
      ? [
          "Hold phone upright and rotate slowly",
          "Keep a steady pace as you turn",
          "Try to stay in the same spot",
        ]
      : [
          "Stand in the centre of the room",
          "Take 8–12 overlapping photos around the room",
          "Overlap each photo by ~30%",
          "Keep the camera level",
        ];

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED_KEY, "true");
    } catch {}
  };

  return (
    <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mx-4 mb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <Lightbulb className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground mb-1.5">
              {nodeType === "panorama" ? "Panorama Tips" : "Capture Tips"}
            </p>
            <ul className="space-y-1">
              {tips.map((tip, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <span className="text-primary mt-px">•</span>
                  {tip}
                </li>
              ))}
            </ul>
            {nodeType === "image_set" && (
              <p className="text-xs text-primary font-medium mt-2">
                Photo {photoCount} of ~10
              </p>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 flex-shrink-0"
          onClick={handleDismiss}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
