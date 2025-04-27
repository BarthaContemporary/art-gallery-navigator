
import { DocumentsList } from "@/components/documents/DocumentsList";
import { DocumentsSearch } from "@/components/documents/DocumentsSearch";
import { UploadDocumentDialog } from "@/components/documents/UploadDocumentDialog";
import { useDocuments } from "@/hooks/use-documents";
import { useState } from "react";

export function DocumentsHeader() {
  return <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-3xl tracking-wide text-slate-500 font-thin">DOCUMENTS</h1>
      </div>
      <UploadDocumentDialog />
    </div>;
}

export default function Documents() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: documents = [] } = useDocuments();
  
  // Filter documents based on search term
  const filteredDocuments = documents.filter(doc => 
    doc.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <DocumentsHeader />
      <DocumentsSearch searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <DocumentsList documents={filteredDocuments} />
    </div>
  );
}
