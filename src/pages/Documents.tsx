
import { useState } from "react";
import { useDocuments } from "@/hooks/use-documents";
import { DocumentsHeader } from "@/components/documents/DocumentsHeader";
import { DocumentsSearch } from "@/components/documents/DocumentsSearch";
import { DocumentsList } from "@/components/documents/DocumentsList";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const Documents = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const { 
    data: documents, 
    isLoading, 
    error,
    bucketStatus, 
    isBucketLoading,
    bucketError,
    bucketData,
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

  if (isLoading || isBucketLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <p className="text-muted-foreground">Loading documents...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <DocumentsHeader />
      
      {!bucketData && (
        <Alert variant="warning" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Storage Configuration</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <p>
              Document storage is now configured with the correct permissions.
              You should be able to upload and manage documents.
            </p>
            <div>
              <Button 
                onClick={verifyBucket} 
                disabled={isVerifying}
                variant="outline"
                size="sm"
              >
                {isVerifying ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Checking bucket status...
                  </>
                ) : (
                  "Verify bucket status"
                )}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            An error occurred while loading documents. Please try again.
          </AlertDescription>
        </Alert>
      )}

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
