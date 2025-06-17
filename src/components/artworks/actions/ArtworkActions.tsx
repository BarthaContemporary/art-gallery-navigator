
import React, { useState } from "react";
import { Artwork } from "@/hooks/use-artworks";
import { Artist } from "@/hooks/use-artist";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { createArtworkPDF } from "@/lib/create-artwork-pdf";
import { toast } from "sonner";

interface ArtworkActionsProps {
  artwork: Artwork;
  artist: Artist | null | undefined;
}

export function ArtworkActions({ artwork, artist }: ArtworkActionsProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGeneratePDF = async () => {
    if (isGenerating) return;
    
    setIsGenerating(true);
    try {
      await createArtworkPDF(artwork, true);
      toast.success("PDF generated successfully");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={handleGeneratePDF}
        disabled={isGenerating}
        title={isGenerating ? "Generating PDF..." : "Create PDF"}
      >
        <FileText className="h-4 w-4" />
      </Button>
    </div>
  );
}
