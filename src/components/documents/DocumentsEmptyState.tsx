
import { FileText, Upload, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DocumentsEmptyStateProps {
  onUploadClick: () => void;
}

export function DocumentsEmptyState({ onUploadClick }: DocumentsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-6">
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>
      
      <h3 className="text-xl font-semibold mb-2">No documents yet</h3>
      <p className="text-muted-foreground mb-6 max-w-md">
        Start building your document library by uploading files. You can attach documents to artworks, collections, or artists.
      </p>
      
      <Button onClick={onUploadClick} className="gap-2">
        <Plus className="h-4 w-4" />
        Upload your first document
      </Button>
      
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-muted-foreground max-w-2xl">
        <div className="flex flex-col items-center gap-2">
          <Upload className="h-6 w-6" />
          <span>Upload files easily</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <FileText className="h-6 w-6" />
          <span>Organize by category</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 rounded border-2 border-current flex items-center justify-center">
            <span className="text-xs">↓</span>
          </div>
          <span>Download anytime</span>
        </div>
      </div>
    </div>
  );
}
