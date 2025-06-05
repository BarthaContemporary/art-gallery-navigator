
import { DocumentsList } from "@/components/documents/DocumentsList";
import { DocumentsSearch } from "@/components/documents/DocumentsSearch";
import { EnhancedUploadDocumentDialog } from "@/components/documents/EnhancedUploadDocumentDialog";
import { DocumentsErrorBoundary } from "@/components/documents/DocumentsErrorBoundary";
import { DocumentsLoadingSkeleton } from "@/components/documents/DocumentsLoadingSkeleton";
import { DocumentsEmptyState } from "@/components/documents/DocumentsEmptyState";
import { RetryButton } from "@/components/documents/RetryButton";
import { useDocumentsSimplified } from "@/hooks/use-documents-simplified";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Documents() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const { user, session } = useAuth();
  const { data: documents = [], isLoading, error, refetch, debugInfo } = useDocumentsSimplified();

  // Show authentication required message if not logged in
  if (!session || !user) {
    return (
      <DocumentsErrorBoundary>
        <div className="p-3 md:p-6 max-w-7xl mx-auto">
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <AlertCircle className="h-12 w-12 text-yellow-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Authentication Required</h2>
            <p className="text-muted-foreground">
              Please log in to access your documents.
            </p>
          </div>
        </div>
      </DocumentsErrorBoundary>
    );
  }

  // Filter documents based on search and type
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.file_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = !typeFilter || doc.type.toLowerCase() === typeFilter.toLowerCase();
    return matchesSearch && matchesType;
  });

  return (
    <DocumentsErrorBoundary>
      <div className="p-3 md:p-6 max-w-7xl mx-auto">
        {/* Add Documents Button moved to the left */}
        <div className="mb-6">
          <EnhancedUploadDocumentDialog />
        </div>

        {/* Search and Filters */}
        <div className="mb-6">
          <DocumentsSearch 
            searchTerm={searchTerm} 
            onSearchChange={setSearchTerm} 
            typeFilter={typeFilter} 
            onTypeFilterChange={setTypeFilter} 
          />
        </div>

        {/* Error State */}
        {error && (
          <Card className="mb-6">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Failed to Load Documents</h3>
              <p className="text-muted-foreground mb-4 max-w-md">
                {error instanceof Error ? error.message : "An unexpected error occurred while loading documents."}
              </p>
              <RetryButton onRetry={() => refetch()} />
              
              {/* Debug Info (only in development) */}
              {process.env.NODE_ENV === 'development' && debugInfo && (
                <details className="mt-4 text-left">
                  <summary className="cursor-pointer text-sm text-gray-500">Debug Info</summary>
                  <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-w-md">
                    {JSON.stringify(debugInfo, null, 2)}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {isLoading && !error && <DocumentsLoadingSkeleton />}

        {/* Empty State */}
        {!isLoading && !error && filteredDocuments.length === 0 && documents.length === 0 && (
          <DocumentsEmptyState onUploadClick={() => setShowUploadDialog(true)} />
        )}

        {/* No Search Results */}
        {!isLoading && !error && filteredDocuments.length === 0 && documents.length > 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No documents found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search terms or filters.
              </p>
              <Button 
                variant="outline" 
                onClick={() => {
                  setSearchTerm("");
                  setTypeFilter(null);
                }}
              >
                Clear filters
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Documents List */}
        {!isLoading && !error && filteredDocuments.length > 0 && (
          <DocumentsList documents={filteredDocuments} />
        )}

        {/* Debug Panel for Development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold mb-2">Debug Information</h4>
            <div className="text-sm space-y-1">
              <div>User: {user?.email || 'Not authenticated'}</div>
              <div>Session: {session ? 'Active' : 'None'}</div>
              <div>Documents count: {documents.length}</div>
              <div>Filtered count: {filteredDocuments.length}</div>
              <div>Loading: {isLoading ? 'Yes' : 'No'}</div>
              <div>Error: {error ? 'Yes' : 'No'}</div>
            </div>
          </div>
        )}
      </div>
    </DocumentsErrorBoundary>
  );
}
