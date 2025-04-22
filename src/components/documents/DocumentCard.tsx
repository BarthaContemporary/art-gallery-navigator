
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Download, FileText, Edit, Trash2 } from "lucide-react";
import { Document } from "@/hooks/use-documents";
import { useToast } from "@/hooks/use-toast";

interface DocumentCardProps {
  document: Document;
}

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
    case "artwork_overview":
      return { color: "bg-sky-100 text-sky-800 border-sky-200" };
    default:
      return { color: "bg-gray-100 text-gray-800 border-gray-200" };
  }
};

export function DocumentCard({ document }: DocumentCardProps) {
  const { color } = getDocumentTypeInfo(document.type);
  const { toast } = useToast();
  
  const handleDownload = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try {
      // Create a temporary anchor element
      const link = window.document.createElement('a');
      link.href = document.file_url;
      link.target = '_blank';
      link.download = document.file_name;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download failed",
        description: "There was an error downloading the document",
        variant: "destructive"
      });
    }
  };

  // Placeholder handlers for edit and delete
  const handleEdit = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    toast({
      title: "Edit",
      description: "Edit functionality not yet implemented.",
    });
  };

  const handleDelete = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    toast({
      title: "Delete",
      description: "Delete functionality not yet implemented.",
      variant: "destructive"
    });
  };
  
  return (
    <Card>
      <div className="flex flex-col sm:flex-row">
        <div className="w-16 sm:w-20 flex items-center justify-center py-6 px-4 bg-muted">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <CardContent className="flex-1 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs px-2 py-1 rounded-full capitalize ${color}`}>
                  {document.type === "artwork_overview" ? "Artwork Overview" : document.type}
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
            {/* Action Buttons: Download, then Edit/Delete below */}
            <div className="flex flex-col items-start gap-2 self-start">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDownload}
                className="w-32 flex items-center justify-center"
              >
                <Download className="mr-2 h-4 w-4" /> Download
              </Button>
              <div className="flex gap-2 mt-1 w-32">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEdit}
                  className="flex-1 flex items-center justify-center border-primary-purple-500 text-primary-purple-700 hover:bg-primary-purple-50"
                  style={{
                    borderColor: "#9b87f5",
                    color: "#9b87f5"
                  }}
                >
                  <Edit className="mr-1 h-4 w-4" /> Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  className="flex-1 flex items-center justify-center border-red-500 text-red-600 hover:bg-red-50"
                  style={{
                    borderColor: "#ea384c",
                    color: "#ea384c"
                  }}
                >
                  <Trash2 className="mr-1 h-4 w-4" /> Delete
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}
