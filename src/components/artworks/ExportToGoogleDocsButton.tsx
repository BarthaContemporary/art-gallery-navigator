
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
      await exportToGoogleDocs(artworks);
    } catch (error) {
      // Error is already handled in the hook
      console.error('Export failed:', error);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={isExporting || artworks.length === 0}
      className={className}
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileText className="h-4 w-4" />
      )}
    </Button>
  );
}
