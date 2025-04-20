
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Search, 
  FileText, 
  Download, 
  Calendar, 
  Palette,
  Filter
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { useDocuments } from "@/hooks/use-documents";
import { UploadDocumentDialog } from "@/components/documents/UploadDocumentDialog";

// Helper function to format date
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Helper function for document type styles
const getDocumentTypeInfo = (type: string) => {
  switch (type) {
    case "condition report":
      return { color: "bg-blue-100 text-blue-800 border-blue-200" };
    case "invoice":
      return { color: "bg-green-100 text-green-800 border-green-200" };
    case "provenance":
      return { color: "bg-purple-100 text-purple-800 border-purple-200" };
    case "CoA":
      return { color: "bg-amber-100 text-amber-800 border-amber-200" };
    default:
      return { color: "bg-gray-100 text-gray-800 border-gray-200" };
  }
};

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
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground">
            Manage artwork documentation, certificates, and reports
          </p>
        </div>
        <UploadDocumentDialog />
      </div>

      <div className="mb-6 flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search documents..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Filter className="mr-2 h-4 w-4" />
              {typeFilter ? `Type: ${typeFilter}` : "Filter by type"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => setTypeFilter(null)}>
                All Document Types
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTypeFilter("condition report")}>
                Condition Reports
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTypeFilter("invoice")}>
                Invoices
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTypeFilter("provenance")}>
                Provenance Documents
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTypeFilter("CoA")}>
                Certificates of Authenticity
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-4">
        {filteredDocuments.map((document) => {
          const { color } = getDocumentTypeInfo(document.type);
          
          return (
            <Card key={document.id}>
              <div className="flex flex-col sm:flex-row">
                <div className="w-16 sm:w-20 flex items-center justify-center py-6 px-4 bg-muted">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <CardContent className="flex-1 p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-xs px-2 py-1 rounded-full capitalize ${color}`}>
                          {document.type}
                        </span>
                      </div>
                      <h3 className="font-semibold">{document.file_name}</h3>
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Uploaded on {formatDate(document.date_uploaded)}
                        </span>
                      </div>
                      {document.description && (
                        <p className="text-sm text-muted-foreground">{document.description}</p>
                      )}
                    </div>
                    <div className="flex self-start">
                      <a
                        href={document.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline" size="sm">
                          <Download className="mr-2 h-4 w-4" /> Download
                        </Button>
                      </a>
                    </div>
                  </div>
                </CardContent>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default Documents;
