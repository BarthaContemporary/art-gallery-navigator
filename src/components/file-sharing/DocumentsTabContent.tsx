
import { DocumentsList } from "@/components/documents/DocumentsList";
import { DocumentsSearch } from "@/components/documents/DocumentsSearch";
import { EnhancedUploadDocumentDialog } from "@/components/documents/EnhancedUploadDocumentDialog";
import { EnhancedDocument } from "@/hooks/use-enhanced-documents";

interface DocumentsTabContentProps {
  filteredAllDocuments: EnhancedDocument[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  typeFilter: string | null;
  onTypeFilterChange: (filter: string | null) => void;
}

export function DocumentsTabContent({
  filteredAllDocuments,
  searchTerm,
  onSearchChange,
  typeFilter,
  onTypeFilterChange
}: DocumentsTabContentProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">All Documents</h3>
        <EnhancedUploadDocumentDialog />
      </div>
      
      <DocumentsSearch 
        searchTerm={searchTerm} 
        onSearchChange={onSearchChange} 
        typeFilter={typeFilter} 
        onTypeFilterChange={onTypeFilterChange} 
      />

      {filteredAllDocuments.length > 0 ? (
        <DocumentsList documents={filteredAllDocuments} />
      ) : (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📄</div>
          <h3 className="text-lg font-medium mb-2">No documents found</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm || typeFilter ? "Try adjusting your search or filters." : "Upload some documents to get started."}
          </p>
          <EnhancedUploadDocumentDialog />
        </div>
      )}
    </div>
  );
}
