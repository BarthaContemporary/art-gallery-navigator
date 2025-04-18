
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { 
  Plus, 
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

// Mock data for documents
const mockDocuments = [
  {
    id: 1,
    artwork: {
      id: 1,
      title: "Abstract Composition #42",
      artist: "Emma Johnson"
    },
    type: "condition report",
    file_name: "abstract_composition_42_condition_report.pdf",
    file_url: "/documents/abstract_composition_42_condition_report.pdf",
    date_uploaded: "2025-03-15",
    description: "Pre-exhibition condition assessment. Good condition with no visible damage."
  },
  {
    id: 2,
    artwork: {
      id: 2,
      title: "Summer Landscape",
      artist: "Michael Chen"
    },
    type: "invoice",
    file_name: "invoice_summer_landscape_apr2025.pdf",
    file_url: "/documents/invoice_summer_landscape_apr2025.pdf",
    date_uploaded: "2025-04-10",
    description: "Invoice for sale to Sarah Williams."
  },
  {
    id: 3,
    artwork: {
      id: 2,
      title: "Summer Landscape",
      artist: "Michael Chen"
    },
    type: "CoA",
    file_name: "summer_landscape_certificate.pdf",
    file_url: "/documents/summer_landscape_certificate.pdf",
    date_uploaded: "2025-04-10",
    description: "Certificate of Authenticity signed by the artist."
  },
  {
    id: 4,
    artwork: {
      id: 5,
      title: "Vibrant Dreams",
      artist: "Amara Okafor"
    },
    type: "provenance",
    file_name: "vibrant_dreams_provenance.pdf",
    file_url: "/documents/vibrant_dreams_provenance.pdf",
    date_uploaded: "2025-02-28",
    description: "Complete ownership history from artist studio to gallery."
  },
  {
    id: 5,
    artwork: {
      id: 6,
      title: "Memory Fragments",
      artist: "Jean-Pierre Dubois"
    },
    type: "condition report",
    file_name: "memory_fragments_condition_feb2025.pdf",
    file_url: "/documents/memory_fragments_condition_feb2025.pdf",
    date_uploaded: "2025-02-10",
    description: "Post-transportation condition report. Minor frame scratch noted."
  },
  {
    id: 6,
    artwork: {
      id: 3,
      title: "Urban Perspective",
      artist: "Sophia Rodriguez"
    },
    type: "CoA",
    file_name: "urban_perspective_certificate.pdf",
    file_url: "/documents/urban_perspective_certificate.pdf",
    date_uploaded: "2025-01-20",
    description: "Certificate of Authenticity with artist signature and thumbprint."
  }
];

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
  
  const filteredDocuments = mockDocuments.filter(doc => {
    const matchesSearch = 
      doc.artwork.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.artwork.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter ? doc.type === typeFilter : true;
    
    return matchesSearch && matchesType;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground">
            Manage artwork documentation, certificates, and reports
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Upload Document
        </Button>
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
                      <div className="flex items-start gap-2 mt-2 mb-1">
                        <Palette className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <span className="text-sm">{document.artwork.title} by {document.artwork.artist}</span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Uploaded on {formatDate(document.date_uploaded)}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{document.description}</p>
                    </div>
                    <div className="flex self-start">
                      <Button variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" /> Download
                      </Button>
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
