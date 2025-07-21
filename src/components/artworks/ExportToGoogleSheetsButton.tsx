import React from "react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { useExportArtworksToGoogleSheets } from "@/hooks/use-export-artworks-google-sheets";
import { Artwork } from "@/hooks/use-artworks";

interface ExportToGoogleSheetsButtonProps {
  artworks: Artwork[];
  filename?: string;
}

export function ExportToGoogleSheetsButton({ 
  artworks, 
  filename 
}: ExportToGoogleSheetsButtonProps) {
  const { exportToGoogleSheets, isExporting } = useExportArtworksToGoogleSheets();

  const handleExport = async () => {
    const title = filename || `Artwork List - ${new Date().toLocaleDateString()}`;
    await exportToGoogleSheets(artworks, title);
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleExport}
      disabled={isExporting || artworks.length === 0}
      title={
        artworks.length === 0 
          ? "No artworks to export" 
          : isExporting 
          ? "Exporting to Google Sheets..." 
          : "Export to Google Sheets"
      }
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileSpreadsheet className="h-4 w-4" />
      )}
    </Button>
  );
}