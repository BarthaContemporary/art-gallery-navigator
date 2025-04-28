
import { DocumentsList } from "@/components/documents/DocumentsList";
import { DocumentsSearch } from "@/components/documents/DocumentsSearch";
import { UploadDocumentDialog } from "@/components/documents/UploadDocumentDialog";
import { useDocuments } from "@/hooks/use-documents";
import { useState } from "react";

export default function Documents() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const { data: documents = [] } = useDocuments();

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.file_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = !typeFilter || doc.type.toLowerCase() === typeFilter.toLowerCase();
    return matchesSearch && matchesType;
  });

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 mb-8">
        <h1 className="text-sm font-visby font-extrabold text-slate-700">DOCUMENTS</h1>
        <UploadDocumentDialog />
      </div>
      <DocumentsSearch 
        searchTerm={searchTerm} 
        onSearchChange={setSearchTerm} 
        typeFilter={typeFilter} 
        onTypeFilterChange={setTypeFilter} 
      />
      <DocumentsList documents={filteredDocuments} />
    </div>
  );
}
