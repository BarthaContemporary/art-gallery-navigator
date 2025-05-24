
import React from "react";
import { Button } from "@/components/ui/button";
import { Save, Download, Files } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
// import { toast } from "sonner"; // toast is not used here
// import JSZip from "jszip"; // JSZip is not used here

interface DialogHeaderActionsProps {
  isGenerating?: boolean;
  setPDFPreviewOpen?: (open: boolean) => void;
  handleDownloadAllImages?: () => void;
  documents?: any[];
  handleDownloadAllFiles?: () => void;
  handleDownloadSingleFile?: (doc: any) => void;

  // New props to control visibility
  showCreatePdf?: boolean;
  showDownloadFiles?: boolean;
  showDownloadAllImages?: boolean;
}

export function DialogHeaderActions({
  isGenerating,
  setPDFPreviewOpen,
  handleDownloadAllImages,
  documents,
  handleDownloadAllFiles,
  handleDownloadSingleFile,
  showCreatePdf = true, // Default to true, so existing usages are not broken
  showDownloadFiles = true, // Default to true
  showDownloadAllImages = true, // Default to true
}: DialogHeaderActionsProps) {
  // If all buttons are meant to be hidden, and no other content, render nothing.
  if (!showCreatePdf && !showDownloadFiles && !showDownloadAllImages) {
    return null;
  }
  
  return (
    <div className="flex gap-2">
      {showCreatePdf && setPDFPreviewOpen && (
        <Button
          variant="outline"
          size="sm" // Added size for consistency
          className="flex items-center gap-2"
          onClick={() => setPDFPreviewOpen(true)}
          disabled={isGenerating}
        >
          <Save className="h-4 w-4" />
          {isGenerating ? "Creating PDF..." : "Create PDF"}
        </Button>
      )}
      {showDownloadFiles && documents && handleDownloadAllFiles && handleDownloadSingleFile && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-2"> {/* Added size */}
              <Files className="h-4 w-4" />
              Download Files
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {documents.length > 0 ? (
              <>
                <DropdownMenuItem onClick={handleDownloadAllFiles}>
                  Download All Files
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {documents.map((doc) => (
                  <DropdownMenuItem
                    key={doc.id}
                    onClick={() => handleDownloadSingleFile(doc)}
                  >
                    {doc.file_name}
                  </DropdownMenuItem>
                ))}
              </>
            ) : (
              <DropdownMenuItem disabled>No files available</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {showDownloadAllImages && handleDownloadAllImages && (
        <Button
          variant="outline"
          size="sm" // Added size
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
