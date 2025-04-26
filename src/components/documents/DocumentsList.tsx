
import { Document } from "@/hooks/use-documents";
import { DocumentCard } from "./DocumentCard";

interface DocumentsListProps {
  documents: Document[];
}

export function DocumentsList({ documents }: DocumentsListProps) {
  // Added a simple conditional rendering for empty state
  if (documents.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        No documents found. Upload some documents to get started.
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {documents.map((document) => (
        <DocumentCard
          key={document.id}
          document={document}
        />
      ))}
    </div>
  );
}
