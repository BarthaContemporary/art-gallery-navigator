
import React from "react";
import { Button } from "@/components/ui/button";
import { Save, Download } from "lucide-react";

interface DialogHeaderActionsProps {
  isGenerating?: boolean;
  setPDFPreviewOpen?: (open: boolean) => void;
  handleDownloadAllImages?: () => void;

  // New props to control visibility
  showCreatePdf?: boolean;
  showDownloadAllImages?: boolean;
}

export function DialogHeaderActions({
  isGenerating,
  setPDFPreviewOpen,
  handleDownloadAllImages,
  showCreatePdf = true, // Default to true, so existing usages are not broken
  showDownloadAllImages = true, // Default to true
}: DialogHeaderActionsProps) {
  // If all buttons are meant to be hidden, and no other content, render nothing.
  if (!showCreatePdf && !showDownloadAllImages) {
    return null;
  }
  
  return (
    <div className="flex gap-2">
      {showCreatePdf && setPDFPreviewOpen && (
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
          onClick={() => setPDFPreviewOpen(true)}
          disabled={isGenerating}
        >
          <Save className="h-4 w-4" />
          {isGenerating ? "Creating PDF..." : "Create PDF"}
        </Button>
      )}
      {showDownloadAllImages && handleDownloadAllImages && (
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
          onClick={handleDownloadAllImages}
        >
          <Download className="h-4 w-4" />
          Download All Images
        </Button>
      )}
    </div>
  );
}
