
import { EnhancedDocument } from "@/hooks/use-enhanced-documents";
import { ResponsiveDocumentCard } from "./ResponsiveDocumentCard";

interface DocumentsListProps {
  documents: EnhancedDocument[];
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
