
import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { Document } from "@/hooks/use-documents";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { DocumentInfo } from "./DocumentInfo";
import { DocumentActions } from "./DocumentActions";
import { DocumentDeleteDialog } from "./DocumentDeleteDialog";

interface DocumentCardProps {
  document: Document;
}

export function DocumentCard({ document }: DocumentCardProps) {
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const queryClient = useQueryClient();

  const handleDownload = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try {
      const link = window.document.createElement("a");
      link.href = document.file_url;
      link.target = "_blank";
      link.download = document.file_name;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: "Download failed",
        description: "There was an error downloading the document",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);

    const { error } = await supabase
      .from("documents")
      .delete()
      .eq("id", document.id);
    
    setDeleting(false);
    setShowDeleteDialog(false);

    if (error) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Document deleted",
      description: `${document.file_name} was deleted.`,
    });
    
    queryClient.invalidateQueries({ queryKey: ["documents"] });
  };

  return (
    <>
      <Card>
        <div className="flex flex-col sm:flex-row">
          <div className="w-16 sm:w-20 flex items-center justify-center py-6 px-4 bg-muted">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardContent className="flex-1 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <DocumentInfo
                type={document.type}
                fileName={document.file_name}
                dateUploaded={document.date_uploaded}
                description={document.description}
              />
              <DocumentActions
                onDownload={handleDownload}
                onDelete={() => setShowDeleteDialog(true)}
                isDeleting={deleting}
              />
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
