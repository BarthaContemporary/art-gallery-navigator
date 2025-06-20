
import React from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { useExportArtworksToGoogleDocs } from "@/hooks/use-export-artworks-google-docs";
import { ImageDownloadDropdown } from "./ImageDownloadDropdown";
import { Artwork } from "@/hooks/use-artworks";

interface DialogHeaderActionsProps {
  artwork: Artwork;
  showCreatePdf?: boolean;
  showDownloadAllImages?: boolean;
}

export function DialogHeaderActions({
  artwork,
  showCreatePdf = true,
  showDownloadAllImages = true,
}: DialogHeaderActionsProps) {
  const { exportToGoogleDocs, isExporting } = useExportArtworksToGoogleDocs();

  const handleExportToGoogleDocs = async () => {
    try {
      await exportToGoogleDocs([artwork], `${artwork.title} - Artwork Details`);
    } catch (error) {
      console.error('Export failed:', error);
      // Error is already handled in the hook with toast notifications
    }
  };

  return (
    <div className="flex gap-2">
      {showCreatePdf && (
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
          onClick={handleExportToGoogleDocs}
          disabled={isExporting}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          {isExporting ? "Exporting..." : "Export to Google Docs"}
        </Button>
      )}
      {showDownloadAllImages && (
        <ImageDownloadDropdown artworkId={artwork.id} />
      )}
    </div>
  );
}
