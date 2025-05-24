
import { Button } from "@/components/ui/button";
import { Document } from "@/hooks/use-documents";
import { Download } from "lucide-react";

interface CollectionDialogDocumentsListProps {
  documents: Document[] | undefined;
  onDownloadDocument: (url: string, fileName: string) => void;
}

export function CollectionDialogDocumentsList({
  documents,
  onDownloadDocument,
}: CollectionDialogDocumentsListProps) {
  if (!documents || documents.length === 0) {
    return (
      <p className="p-4 text-muted-foreground">No documents attached</p>
    );
  }

  return (
    <div className="border rounded-lg divide-y">
      {documents.map((doc) => (
        <div key={doc.id} className="p-4 flex items-center justify-between">
          <span>{doc.file_name}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDownloadDocument(doc.file_url, doc.file_name)}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
