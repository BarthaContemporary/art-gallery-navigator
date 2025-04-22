
import { useState } from "react";
import { Document } from "@/hooks/use-documents";
import { DocumentCard } from "./DocumentCard";

interface DocumentsListProps {
  documents: Document[];
}

export function DocumentsList({ documents: initialDocuments }: DocumentsListProps) {
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);

  // Update documents when parent prop changes
  if (JSON.stringify(initialDocuments) !== JSON.stringify(documents)) {
    setDocuments(initialDocuments);
  }

  const handleDeleteDocument = (id: string) => {
    setDocuments(documents.filter(doc => doc.id !== id));
  };

  return (
    <div className="space-y-4">
      {documents.map((document) => (
        <DocumentCard 
          key={document.id} 
          document={document} 
          onDelete={handleDeleteDocument} 
        />
      ))}
    </div>
  );
}
