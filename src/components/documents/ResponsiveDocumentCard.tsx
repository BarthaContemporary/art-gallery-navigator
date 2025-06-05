
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Download, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Document } from "@/hooks/use-documents-simplified";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DocumentDeleteDialog } from "./DocumentDeleteDialog";
import { formatDistanceToNow } from "date-fns";

interface ResponsiveDocumentCardProps {
  document: Document;
}

export function ResponsiveDocumentCard({ document }: ResponsiveDocumentCardProps) {
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const queryClient = useQueryClient();

  const handleDownload = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try {
      // Create a temporary link to download the file
      const link = window.document.createElement("a");
      link.href = document.file_url;
      link.target = "_blank";
      link.download = document.file_name;
      link.rel = "noopener noreferrer";
      
      // Trigger download
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      
      toast.success(`Downloading ${document.file_name}`);
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download file");
    }
  };

  const handlePreview = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    window.open(document.file_url, '_blank', 'noopener,noreferrer');
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);

    try {
      // Delete from database
      const { error: dbError } = await supabase
        .from("documents")
        .delete()
        .eq("id", document.id);
      
      if (dbError) throw dbError;

      // Try to delete from storage (optional - file might not exist)
      const fileName = document.file_url.split('/').pop();
      if (fileName) {
        await supabase.storage
          .from('documents')
          .remove([fileName]);
      }

      toast.success(`${document.file_name} deleted successfully`);
      queryClient.invalidateQueries({ queryKey: ["documents-simplified"] });
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete document");
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const getFileExtension = () => {
    return document.file_name.split('.').pop()?.toUpperCase() || 'FILE';
  };

  const formatFileSize = (url: string) => {
    // This is a simplified version - in a real app you'd store file size
    return 'Unknown size';
  };

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <div className="flex flex-col sm:flex-row">
          {/* File Icon */}
          <div className="w-full sm:w-20 flex items-center justify-center py-4 px-4 bg-muted">
            <div className="flex flex-col items-center gap-1">
              <FileText className="h-8 w-8" style={{ color: '#18465a' }} />
              <Badge variant="outline" className="text-xs">
                {getFileExtension()}
              </Badge>
            </div>
          </div>
          
          {/* Content */}
          <CardContent className="flex-1 p-4">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              {/* File Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm md:text-base truncate mb-1">
                  {document.file_name}
                </h3>
                
                <div className="space-y-1 text-xs md:text-sm text-muted-foreground">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      {document.type.replace('_', ' ')}
                    </Badge>
                    <span>•</span>
                    <span>{formatDistanceToNow(new Date(document.date_uploaded), { addSuffix: true })}</span>
                  </div>
                  
                  {document.description && (
                    <p className="text-xs md:text-sm line-clamp-2">
                      {document.description}
                    </p>
                  )}
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex flex-row lg:flex-col gap-2 lg:gap-1 self-start">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreview}
                  className="flex-1 lg:flex-none gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span className="sm:hidden lg:inline">Preview</span>
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="flex-1 lg:flex-none gap-1"
                >
                  <Download className="h-3 w-3" />
                  <span className="sm:hidden lg:inline">Download</span>
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={deleting}
                  className="flex-1 lg:flex-none gap-1 border-red-200 text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" />
                  <span className="sm:hidden lg:inline">Delete</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </div>
      </Card>

      <DocumentDeleteDialog
        fileName={document.file_name}
        isOpen={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDelete}
      />
    </>
  );
}
