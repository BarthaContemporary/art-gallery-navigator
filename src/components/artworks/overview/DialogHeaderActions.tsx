
import React from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, FileSpreadsheet } from "lucide-react";
import { useExportArtworksToGoogleDocs } from "@/hooks/use-export-artworks-google-docs";
import { useExportArtworksToGoogleSheets } from "@/hooks/use-export-artworks-google-sheets";
import { ImageDownloadDropdown } from "./ImageDownloadDropdown";
import { Artwork } from "@/hooks/use-artworks";

interface DialogHeaderActionsProps {
  artwork: Artwork;
  showCreatePdf?: boolean;
  showDownloadAllImages?: boolean;
  showExportToSheets?: boolean;
}

export function DialogHeaderActions({
  artwork,
  showCreatePdf = true,
  showDownloadAllImages = true,
  showExportToSheets = true,
}: DialogHeaderActionsProps) {
  const { exportToGoogleDocs, isExporting } = useExportArtworksToGoogleDocs();
  const { exportToGoogleSheets, isExporting: isSheetsExporting } = useExportArtworksToGoogleSheets();

  const handleExportToGoogleDocs = async () => {
    try {
      await exportToGoogleDocs([artwork], `${artwork.title} - Artwork Details`);
    } catch (error) {
      console.error('Export failed:', error);
      // Error is already handled in the hook with toast notifications
    }
  };

  const handleExportToGoogleSheets = async () => {
    try {
      await exportToGoogleSheets([artwork], `${artwork.title} - Artwork Details`);
    } catch (error) {
      console.error('Sheets export failed:', error);
      // Error is already handled in the hook with toast notifications
    }
  };

  return (
    <div className="flex gap-2">
      {showCreatePdf && (
        <Button
          variant="outline"
          size="icon"
          onClick={handleExportToGoogleDocs}
          disabled={isExporting}
          title={isExporting ? "Exporting..." : "Export to Google Docs"}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
        </Button>
      )}
      {showExportToSheets && (
        <Button
          variant="outline"
          size="icon"
          onClick={handleExportToGoogleSheets}
          disabled={isSheetsExporting}
          title={isSheetsExporting ? "Exporting to Sheets..." : "Export to Google Sheets"}
        >
          {isSheetsExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-4 w-4" />
          )}
        </Button>
      )}
      {showDownloadAllImages && (
        <ImageDownloadDropdown artworkId={artwork.id} />
      )}
    </div>
  );
}
