
import { useState, useEffect } from "react";
import { EditArtworkDialog } from "./EditArtworkDialog";
import { Artwork } from "@/hooks/use-artworks";

interface DebugEditDialogProps {
  artwork: Artwork;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DebugEditDialog({ artwork, open, onOpenChange }: DebugEditDialogProps) {
  const [forceKey, setForceKey] = useState(0);

  useEffect(() => {
    if (open) {
      console.log("🚀 FORCE REFRESH: Debug dialog opening");
      setForceKey(prev => prev + 1);
    }
  }, [open]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (open) {
        console.log("🔄 FORCE REFRESH: Auto-refreshing dialog");
        setForceKey(prev => prev + 1);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [open]);

  return (
    <EditArtworkDialog
      key={`debug-${forceKey}`}
      artwork={artwork}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}
