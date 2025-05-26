
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Collection } from "@/hooks/use-collections";
import { Document } from "@/hooks/use-documents";
import { Download, Globe } from "lucide-react";

interface CollectionDialogActionsProps {
  collection: Collection | undefined;
  isGeneratingPDF: boolean;
  onGeneratePDF: () => void;
  documents: Document[] | undefined;
  onDownloadDocument: (url: string, fileName: string) => void;
  onDownloadAllDocuments: () => void;
  isCreatingWebsite: boolean;
  onCreateWebsite: () => void;
}

export function CollectionDialogActions({
  collection,
  isGeneratingPDF,
  onGeneratePDF,
  documents,
  onDownloadDocument,
  onDownloadAllDocuments,
  isCreatingWebsite,
  onCreateWebsite,
}: CollectionDialogActionsProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <Button
        onClick={onGeneratePDF}
        disabled={!collection || isGeneratingPDF || isCreatingWebsite}
        className="flex items-center gap-1 md:gap-2 bg-primary hover:bg-primary/90 text-xs md:text-sm"
        size="sm"
      >
        {isGeneratingPDF ? "Generating PDF..." : "Create Artworks PDF"}
        <Download className="h-3 w-3 md:h-4 md:w-4" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className="flex items-center gap-1 md:gap-2 text-xs md:text-sm"
            disabled={!documents?.length || isGeneratingPDF || isCreatingWebsite}
            size="sm"
          >
            Download Documents
            <Download className="h-3 w-3 md:h-4 md:w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 md:w-56">
          {documents?.length > 0 && (
            <>
              <DropdownMenuItem onClick={onDownloadAllDocuments}>
                Download All Documents
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {documents?.map((doc) => (
            <DropdownMenuItem
              key={doc.id}
              onClick={() => onDownloadDocument(doc.file_url, doc.file_name)}
            >
              {doc.file_name}
            </DropdownMenuItem>
          ))}
          {!documents?.length && (
            <DropdownMenuItem disabled>
              No documents available
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        onClick={onCreateWebsite}
        disabled={!collection || isCreatingWebsite || isGeneratingPDF}
        className="flex items-center gap-1 md:gap-2 text-xs md:text-sm"
        size="sm"
      >
        {isCreatingWebsite ? "Creating Website..." : "Create Website"}
        <Globe className="h-3 w-3 md:h-4 md:w-4" />
      </Button>
    </div>
  );
}
