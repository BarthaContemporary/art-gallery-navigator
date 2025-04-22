
import { Document } from "@/hooks/use-documents";
import { DocumentCard } from "./DocumentCard";

interface DocumentsListProps {
  documents: Document[];
}

export function DocumentsList({ documents }: DocumentsListProps) {
  // The list always comes from props (live from query)
  // DocumentCard handles onDelete which triggers a query refetch on the parent

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
