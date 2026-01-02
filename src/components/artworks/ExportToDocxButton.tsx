import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { useExportArtworksToDocx } from "@/hooks/use-export-artworks-docx";
import { Artwork } from "@/hooks/use-artworks";

interface ExportToDocxButtonProps {
  artworks: Artwork[];
  className?: string;
}

export function ExportToDocxButton({ 
  artworks, 
  className 
}: ExportToDocxButtonProps) {
  const { exportToDocx, isExporting } = useExportArtworksToDocx();

  const handleExport = async () => {
    try {
      await exportToDocx(artworks);
    } catch (error) {
      console.error('Export failed:', error);
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
      title={artworks.length === 0 ? "No artworks to export" : "Export to Word (DOCX)"}
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileDown className="h-4 w-4" />
      )}
    </Button>
  );
}
