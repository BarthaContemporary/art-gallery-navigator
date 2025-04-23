
import { useState } from "react";
import { useDocuments } from "@/hooks/use-documents";
import { DocumentsHeader } from "@/components/documents/DocumentsHeader";
import { DocumentsSearch } from "@/components/documents/DocumentsSearch";
import { DocumentsList } from "@/components/documents/DocumentsList";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

const Documents = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const { 
    data: documents, 
    isLoading, 
    error, 
    bucketStatus, 
    isBucketLoading,
    verifyBucket,
    isVerifying 
  } = useDocuments();
  
  const filteredDocuments = documents?.filter(doc => {
    const matchesSearch = 
      doc.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.description || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter ? doc.type === typeFilter : true;
    
    return matchesSearch && matchesType;
  }) ?? [];

  // Handle initial loading state
  if (isLoading || isBucketLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">Loading documents...</p>
      </div>
    );
  }

  // Handle bucket configuration issues
  if (bucketStatus === 'error') {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <p className="font-medium">Document storage is not properly configured</p>
        </div>
        <p className="text-muted-foreground text-center max-w-md">
          The document storage bucket could not be created or accessed. This is necessary for document management.
        </p>
        <Button 
          onClick={verifyBucket} 
          disabled={isVerifying}
          className="mt-2"
        >
          {isVerifying ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Configuring...
            </>
          ) : (
            "Configure Document Storage"
          )}
        </Button>
      </div>
    );
  }

  // Handle other errors
  if (error) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-red-500">Error loading documents. Please try again.</p>
      </div>
    );
  }

  // Main content
  return (
    <div className="p-4 sm:p-6 md:p-8 lg:p-10 max-w-7xl mx-auto">
      <DocumentsHeader />
      <DocumentsSearch
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
      />
      {filteredDocuments.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No documents found</p>
        </div>
      ) : (
        <DocumentsList documents={filteredDocuments} />
      )}
    </div>
  );
};

export default Documents;
