import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArtworkDocument } from '@/hooks/use-artwork-documents';

interface DocumentPreviewProps {
  document: ArtworkDocument | null;
  open: boolean;
  onClose: () => void;
}

export function DocumentPreview({ document, open, onClose }: DocumentPreviewProps) {
  const [secureUrl, setSecureUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getSecureFileUrl = async (fileUrl: string, documentId: string) => {
    try {
      console.log('Getting secure URL for file:', fileUrl);
      
      // Check if this is an external storage URL that needs proxying
      if (fileUrl.includes('gallerysharedbucket') || fileUrl.includes('s3')) {
        console.log('External file detected, calling edge function');
        
        const session = await supabase.auth.getSession();
        if (!session.data.session?.access_token) {
          throw new Error('No valid session found');
        }
        
        // Use Supabase client to call the edge function properly
        const { data, error } = await supabase.functions.invoke('get-secure-document', {
          body: { file_url: fileUrl, document_id: documentId }
        });
        
        console.log('Edge function response:', { data, error });
        
        if (error) {
          console.error('Edge function error:', error);
          throw new Error(`Edge function failed: ${error.message}`);
        }
        
        if (data?.error) {
          throw new Error(data.error);
        }
        
        // If we get a secure_url, use it
        if (data?.secure_url) {
          return data.secure_url;
        }
        
        // If the response is binary data (the function returned the file directly)
        // We need to handle this differently - for now, let's try the direct approach
        console.log('No secure_url in response, attempting direct file access');
        return fileUrl;
      }
      
      return fileUrl; // Return original URL for public files
    } catch (error) {
      console.error('Error getting secure URL:', error);
      toast.error(`Failed to load document: ${error.message}`);
      return null; // Return null to indicate failure
    }
  };

  useEffect(() => {
      if (document && open) {
        console.log('DocumentPreview: Starting secure URL fetch for:', document.file_name);
        setLoading(true);
        setError(null);
        
        getSecureFileUrl(document.file_url, document.id)
          .then(url => {
            console.log('DocumentPreview: Secure URL result:', url);
            if (url) {
              setSecureUrl(url);
            } else {
              setError('Failed to load document - access denied');
            }
          })
          .catch(err => {
            console.error('DocumentPreview: Failed to get secure URL:', err);
            setError(`Failed to load document: ${err.message}`);
          })
          .finally(() => {
            setLoading(false);
          });
      }
  }, [document, open]);


  const renderPreview = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading document...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-sm text-destructive mb-2">{error}</p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        </div>
      );
    }

    if (!secureUrl || !document) {
      return (
        <div className="flex items-center justify-center h-96">
          <p className="text-sm text-muted-foreground">No document to preview</p>
        </div>
      );
    }

    const mimeType = document.type?.toLowerCase() || '';
    const fileName = document.file_name.toLowerCase();

    // PDF Preview
    if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
      return (
        <div className="h-96">
          <iframe
            src={`${secureUrl}#toolbar=0&navpanes=0&scrollbar=0`}
            className="w-full h-full border-0"
            title={document.file_name}
          />
        </div>
      );
    }

    // Image Preview
    if (mimeType.startsWith('image/') || fileName.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) {
      return (
        <div className="flex items-center justify-center h-96 bg-muted/20">
          <img
            src={secureUrl}
            alt={document.file_name}
            className="max-w-full max-h-full object-contain"
          />
        </div>
      );
    }

    // Text files
    if (mimeType.startsWith('text/') || fileName.match(/\.(txt|md|json|xml|csv)$/)) {
      return (
        <div className="h-96">
          <iframe
            src={secureUrl}
            className="w-full h-full border border-border rounded"
            title={document.file_name}
          />
        </div>
      );
    }

    // Default fallback - no preview available
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">
            Preview not available for this file type
          </p>
          <p className="text-xs text-muted-foreground">
            {document.file_name} • {document.type}
          </p>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex-1 truncate pr-4">
              {document?.file_name || 'Document Preview'}
            </DialogTitle>
          {document?.description && (
            <p className="text-sm text-muted-foreground mt-2">
              {document.description}
            </p>
          )}
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          {renderPreview()}
        </div>
      </DialogContent>
    </Dialog>
  );
}