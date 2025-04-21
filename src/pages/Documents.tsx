
import { useState } from "react";
import { useDocuments } from "@/hooks/use-documents";
import { DocumentsHeader } from "@/components/documents/DocumentsHeader";
import { DocumentsSearch } from "@/components/documents/DocumentsSearch";
import { DocumentsList } from "@/components/documents/DocumentsList";

const Documents = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const { data: documents, isLoading, error } = useDocuments();
  
  const filteredDocuments = documents?.filter(doc => {
    const matchesSearch = 
      doc.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.description || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter ? doc.type === typeFilter : true;
    
    return matchesSearch && matchesType;
  }) ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">Loading documents...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-red-500">Error loading documents. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="pt-2 pb-4 px-2 sm:px-0">
      <DocumentsHeader />
      <DocumentsSearch
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
      />
      <DocumentsList documents={filteredDocuments} />
    </div>
  );
};

export default Documents;
