
import { Document } from "@/hooks/use-documents-simplified";
import { ResponsiveDocumentCard } from "./ResponsiveDocumentCard";

interface DocumentsListProps {
  documents: Document[];
}

export function DocumentsList({ documents }: DocumentsListProps) {
  return (
    <div className="space-y-4">
      {documents.map((document) => (
        <ResponsiveDocumentCard
          key={document.id}
          document={document}
        />
      ))}
    </div>
  );
}
