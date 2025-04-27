import { DocumentsList } from "@/components/documents/DocumentsList";
import { DocumentsSearch } from "@/components/documents/DocumentsSearch";
import { UploadDocumentDialog } from "@/components/documents/UploadDocumentDialog";
import { useDocuments } from "@/hooks/use-documents";
import { useState } from "react";
export function DocumentsHeader() {
  return <div className="flex items-center justify-between mb-8">
      <div>
        <h1 className="text-slate-700 text-sm font-normal\n">DOCUMENTS</h1>
      </div>
      <UploadDocumentDialog />
    </div>;
}
export default function Documents() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const {
    data: documents = []
  } = useDocuments();

  // Filter documents based on search term and type filter
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.file_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = !typeFilter || doc.type.toLowerCase() === typeFilter.toLowerCase();
    return matchesSearch && matchesType;
  });
  return <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <DocumentsHeader />
      <DocumentsSearch searchTerm={searchTerm} onSearchChange={setSearchTerm} typeFilter={typeFilter} onTypeFilterChange={setTypeFilter} />
      <DocumentsList documents={filteredDocuments} />
    </div>;
}