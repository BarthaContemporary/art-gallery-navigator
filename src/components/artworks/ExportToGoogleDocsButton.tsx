
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { useExportArtworksToGoogleDocs } from "@/hooks/use-export-artworks-google-docs";
import { Artwork } from "@/hooks/use-artworks";

interface ExportToGoogleDocsButtonProps {
  artworks: Artwork[];
  className?: string;
}

export function ExportToGoogleDocsButton({ 
  artworks, 
  className 
}: ExportToGoogleDocsButtonProps) {
  const { exportToGoogleDocs, isExporting } = useExportArtworksToGoogleDocs();

  const handleExport = async () => {
    try {
      console.log('Starting export with artworks:', artworks.length);
      await exportToGoogleDocs(artworks);
      console.log('Export completed successfully');
    } catch (error) {
      console.error('Export failed in button handler:', error);
      // Error is already handled in the hook with toast notifications
    }
  };

  const isDisabled = isExporting || artworks.length === 0;

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleExport}
      disabled={isDisabled}
      className={className}
      title={artworks.length === 0 ? "No artworks to export" : "Export to Google Docs"}
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileText className="h-4 w-4" />
      )}
    </Button>
  );
}
