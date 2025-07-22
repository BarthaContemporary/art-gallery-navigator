
import React, { useState } from 'react';
import { format } from 'date-fns';
import { FileText, ExternalLink, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArtworkDocument, useDeleteArtworkDocument } from '@/hooks/use-artwork-documents';
import { DocumentPreview } from './DocumentPreview';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface DocumentCardProps {
  document: ArtworkDocument;
}

export function DocumentCard({ document }: DocumentCardProps) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const deleteDocument = useDeleteArtworkDocument();

  const handleView = () => {
    setPreviewOpen(true);
  };

  const handleDelete = () => {
    if (!document.artwork_id) return;
    
    deleteDocument.mutate({
      documentId: document.id,
      artworkId: document.artwork_id,
    });
  };

  return (
    <>
      <Card className="w-full">
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <FileText className="h-4 w-4 text-gray-500" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-medium text-gray-900 truncate">
                    {document.file_name}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">
                      {format(new Date(document.date_uploaded), 'MMM dd, yyyy')}
                    </span>
                  </div>
                  {document.description && (
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                      {document.description}
                    </p>
                  )}
                </div>
                
                <div className="flex items-center gap-1 ml-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleView}
                    className="h-8 w-8 p-0"
                    title="Preview document"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Remove document link"
                        disabled={deleteDocument.isPending}
                      >
                        {deleteDocument.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Document Link</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove the link to "{document.file_name}" from this artwork? 
                          The document will not be deleted, only the link will be removed.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={handleDelete}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Remove Link
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <DocumentPreview
        document={document}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  );
}
