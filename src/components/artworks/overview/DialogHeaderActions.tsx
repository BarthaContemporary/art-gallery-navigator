
import React from "react";
import { Button } from "@/components/ui/button";
import { Save, Download, Files } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import JSZip from "jszip";

interface DialogHeaderActionsProps {
  isGenerating: boolean;
  setPDFPreviewOpen: (open: boolean) => void;
  handleDownloadAllImages: () => void;
  documents: any[];
  handleDownloadAllFiles: () => void;
  handleDownloadSingleFile: (doc: any) => void;
}

export function DialogHeaderActions({
  isGenerating,
  setPDFPreviewOpen,
  handleDownloadAllImages,
  documents,
  handleDownloadAllFiles,
  handleDownloadSingleFile,
}: DialogHeaderActionsProps) {
  return (
    <div className="flex gap-2 absolute right-8">
      <Button
        variant="outline"
        className="flex items-center gap-2"
        onClick={() => setPDFPreviewOpen(true)}
        disabled={isGenerating}
      >
        <Save className="h-4 w-4" />
        {isGenerating ? "Creating PDF..." : "Create PDF"}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
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
      <Button
        variant="outline"
        className="flex items-center gap-2"
        onClick={handleDownloadAllImages}
      >
        <Download className="h-4 w-4" />
        Download All Images
      </Button>
    </div>
  );
}
