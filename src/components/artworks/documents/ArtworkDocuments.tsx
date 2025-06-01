
import React, { useState } from 'react';
import { useArtworkDocuments } from '@/hooks/use-artwork-documents';
import { DocumentCard } from './DocumentCard';
import { AttachDocumentDialog } from './AttachDocumentDialog';
import { Button } from '@/components/ui/button';
import { Plus, FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface ArtworkDocumentsProps {
  artworkId: string;
}

export function ArtworkDocuments({ artworkId }: ArtworkDocumentsProps) {
  const [attachDialogOpen, setAttachDialogOpen] = useState(false);
  const { data: documents, isLoading, error } = useArtworkDocuments(artworkId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-6 text-red-500">
        <p>Error loading documents</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span className="text-sm font-medium">
            Documents ({documents?.length || 0})
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAttachDialogOpen(true)}
          className="flex items-center gap-1"
        >
          <Plus className="h-3 w-3" />
          Attach
        </Button>
      </div>

      {!documents || documents.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          <FileText className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No documents attached</p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setAttachDialogOpen(true)}
            className="mt-2"
          >
            Attach first document
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((document) => (
            <DocumentCard key={document.id} document={document} />
          ))}
        </div>
      )}

      <AttachDocumentDialog
        artworkId={artworkId}
        open={attachDialogOpen}
        onOpenChange={setAttachDialogOpen}
      />
    </div>
  );
}
