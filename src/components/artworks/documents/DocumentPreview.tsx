import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, X } from 'lucide-react';
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
        
        // Use the edge function to get the file data directly
        const response = await fetch(`https://cvhdspyugfcvkrufqzrq.supabase.co/functions/v1/get-secure-document`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.data.session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2aGRzcHl1Z2ZjdmtydWZxenJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ5ODkxOTIsImV4cCI6MjA2MDU2NTE5Mn0.NT2RKvxlHAuzTDXg9u2K4zq65dNnqfnKTxjpeMDeN6Y'
          },
          body: JSON.stringify({ file_url: fileUrl, document_id: documentId })
        });
        
        console.log('Edge function response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Edge function error:', response.status, errorText);
          throw new Error(`Edge function failed: ${response.status} ${errorText}`);
        }
        
        // Check if response is JSON (error) or binary data (file)
        const contentType = response.headers.get('content-type');
        console.log('Response content type:', contentType);
        
        if (contentType?.includes('application/json')) {
          const jsonResponse = await response.json();
          if (jsonResponse.secure_url) {
            return jsonResponse.secure_url;
          } else if (jsonResponse.error) {
            throw new Error(jsonResponse.error);
          }
        } else {
          // The edge function returns the file data directly, so create a blob URL
          const blob = await response.blob();
          const blobUrl = URL.createObjectURL(blob);
          console.log('Created blob URL for secure file');
          return blobUrl;
        }
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
      setLoading(true);
      setError(null);
      
      getSecureFileUrl(document.file_url, document.id)
        .then(url => {
          if (url) {
            setSecureUrl(url);
          } else {
            setError('Failed to load document - access denied');
          }
        })
        .catch(err => {
          console.error('Failed to get secure URL:', err);
          setError('Failed to load document');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [document, open]);

  const handleDownload = async () => {
    if (!document || !secureUrl) return;
    
    try {
      const response = await fetch(secureUrl);
      const blob = await response.blob();
      
      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = document.file_name;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Document downloaded successfully');
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Failed to download document');
    }
  };

  const handleOpenInNewTab = () => {
    if (secureUrl) {
      window.open(secureUrl, '_blank');
    }
  };

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

    // Default fallback - show download option
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
        <div className="flex gap-2">
          <Button onClick={handleDownload} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button onClick={handleOpenInNewTab} variant="outline" size="sm">
            <ExternalLink className="h-4 w-4 mr-2" />
            Open in new tab
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex-1 truncate pr-4">
              {document?.file_name || 'Document Preview'}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleDownload}
                variant="outline"
                size="sm"
                disabled={loading || !secureUrl}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button
                onClick={handleOpenInNewTab}
                variant="outline"
                size="sm"
                disabled={loading || !secureUrl}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open
              </Button>
            </div>
          </div>
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