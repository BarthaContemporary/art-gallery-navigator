
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArtworkDocument } from '@/hooks/use-artwork-documents';

// Helper function to get MIME type from filename
const getMimeTypeFromFileName = (fileName: string): string => {
  const extension = fileName.toLowerCase().split('.').pop();
  const mimeTypes: Record<string, string> = {
    'pdf': 'application/pdf',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg', 
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'txt': 'text/plain',
    'md': 'text/markdown',
    'json': 'application/json',
    'xml': 'application/xml',
    'csv': 'text/csv'
  };
  return mimeTypes[extension || ''] || 'application/octet-stream';
};

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
      
      // Check if this is an external storage URL that needs authentication
      if (fileUrl.includes('gallerysharedbucket') || fileUrl.includes('s3') || fileUrl.includes('idrivee2')) {
        console.log('External S3-type file detected, calling edge function');
        
        const session = await supabase.auth.getSession();
        if (!session.data.session?.access_token) {
          throw new Error('No valid session found');
        }
        
        // Use Supabase client to call the edge function
        const { data, error } = await supabase.functions.invoke('get-secure-document', {
          body: { file_url: fileUrl, document_id: documentId }
        });
        
        console.log('Edge function response data type:', typeof data);
        console.log('Edge function response error:', error);
        
        if (error) {
          console.error('Edge function error:', error);
          throw new Error(`Edge function failed: ${error.message}`);
        }
        
        // Check if the response contains an error
        if (data && typeof data === 'object' && 'error' in data) {
          console.error('Edge function returned error:', data.error);
          throw new Error(data.error);
        }
        
        // If we get a JSON response with secure_url, use it
        if (data && typeof data === 'object' && 'secure_url' in data) {
          console.log('Received secure URL from edge function');
          return data.secure_url;
        }
        
        // The edge function returns the file directly as binary data
        if (data) {
          console.log('Received file data, creating blob URL');
          let blob;
          
          if (data instanceof ArrayBuffer) {
            // Get content type from file extension for proper MIME type
            const mimeType = getMimeTypeFromFileName(document.file_name);
            blob = new Blob([data], { type: mimeType });
          } else if (data instanceof Blob) {
            blob = data;
          } else {
            // Convert string data to blob with proper MIME type
            const mimeType = getMimeTypeFromFileName(document.file_name);
            blob = new Blob([data], { type: mimeType });
          }
          
          return URL.createObjectURL(blob);
        }
        
        console.log('No usable data received from edge function');
        throw new Error('No file data received from server');
      }
      
      // Return original URL for public files
      console.log('Public file, using original URL');
      return fileUrl;
    } catch (error) {
      console.error('Error getting secure URL:', error);
      throw error; // Re-throw to be handled by the calling function
    }
  };

  useEffect(() => {
    if (document && open) {
      console.log('DocumentPreview: Starting secure URL fetch for:', document.file_name);
      setLoading(true);
      setError(null);
      setSecureUrl(null); // Clear previous URL
      
      getSecureFileUrl(document.file_url, document.id)
        .then(url => {
          console.log('DocumentPreview: Secure URL result:', url);
          if (url) {
            setSecureUrl(url);
            setError(null);
          } else {
            setError('No file data received from server');
          }
        })
        .catch(err => {
          console.error('DocumentPreview: Failed to get secure URL:', err);
          let errorMessage = 'Failed to load document';
          
          if (err.message.includes('Edge function failed')) {
            errorMessage = 'Server authentication failed - please try again';
          } else if (err.message.includes('No valid session')) {
            errorMessage = 'Please sign in to access this document';
          } else if (err.message.includes('access denied') || err.message.includes('403')) {
            errorMessage = 'Access denied - you may not have permission to view this document';
          } else if (err.message.includes('not found') || err.message.includes('404')) {
            errorMessage = 'Document not found';
          } else if (err.message) {
            errorMessage = err.message;
          }
          
          setError(errorMessage);
          toast.error(errorMessage);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      // Clear state when dialog is closed
      setSecureUrl(null);
      setError(null);
      setLoading(false);
    }
  }, [document, open]);

  // Clean up blob URLs when component unmounts or URL changes
  useEffect(() => {
    return () => {
      if (secureUrl && secureUrl.startsWith('blob:')) {
        URL.revokeObjectURL(secureUrl);
      }
    };
  }, [secureUrl]);

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
          <div className="text-center max-w-md">
            <p className="text-sm text-destructive mb-4">{error}</p>
            <div className="flex gap-2 justify-center">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  if (document) {
                    setError(null);
                    setLoading(true);
                    getSecureFileUrl(document.file_url, document.id)
                      .then(setSecureUrl)
                      .catch(err => setError(err.message))
                      .finally(() => setLoading(false));
                  }
                }}
              >
                Retry
              </Button>
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
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

    // PDF Preview - Chrome compatible approach
    if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
      return (
        <div className="h-96">
          <object
            data={secureUrl}
            type="application/pdf"
            className="w-full h-full"
            aria-label={document.file_name}
          >
            <iframe
              src={secureUrl}
              className="w-full h-full border-0"
              title={document.file_name}
              onError={() => {
                console.error('PDF iframe load error');
                setError('Failed to load PDF preview');
              }}
            />
          </object>
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
            onError={() => {
              console.error('Image load error');
              setError('Failed to load image preview');
            }}
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
            onError={() => {
              console.error('Text file iframe load error');
              setError('Failed to load text file preview');
            }}
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
