
import React from 'react';
import { format } from 'date-fns';
import { FileText, Download, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArtworkDocument } from '@/hooks/use-artwork-documents';
import { supabase } from '@/integrations/supabase/client';

interface DocumentCardProps {
  document: ArtworkDocument;
}

export function DocumentCard({ document }: DocumentCardProps) {
  const handleDownload = () => {
    window.open(document.file_url, '_blank');
  };

  const handleView = async () => {
    try {
      // Check if this is an external storage URL that needs proxying
      if (document.file_url.includes('gallerysharedbucket') || document.file_url.includes('s3')) {
        // Use edge function to get signed URL for secure access
        const { data, error } = await supabase.functions.invoke('get-document-access', {
          body: { file_url: document.file_url, document_id: document.id }
        });
        
        if (error) {
          console.error('Error getting document access:', error);
          window.open(document.file_url, '_blank'); // Fallback to direct URL
          return;
        }
        
        if (data?.signed_url) {
          window.open(data.signed_url, '_blank');
        } else {
          window.open(document.file_url, '_blank'); // Fallback
        }
      } else {
        // Direct access for public URLs
        window.open(document.file_url, '_blank');
      }
    } catch (error) {
      console.error('Error viewing document:', error);
      window.open(document.file_url, '_blank'); // Fallback
    }
  };

  return (
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
                  title="View document"
                >
                  <ExternalLink className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDownload}
                  className="h-8 w-8 p-0"
                  title="Download document"
                >
                  <Download className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
