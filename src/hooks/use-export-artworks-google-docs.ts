
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Artwork } from "@/hooks/use-artworks";

interface ExportResponse {
  success: boolean;
  documentUrl?: string;
  documentId?: string;
  artworkCount?: number;
  error?: string;
  errorType?: string;
  details?: string;
}

export function useExportArtworksToGoogleDocs() {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const exportToGoogleDocs = async (artworks: Artwork[], title?: string) => {
    if (artworks.length === 0) {
      toast({
        title: "No Artworks",
        description: "No artworks to export. Please ensure there are artworks in the current view.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);

    try {
      console.log(`Starting export of ${artworks.length} artworks to Google Docs...`);

      // Prepare artwork data with proper artist information and all image data
      const artworkData = artworks.map(artwork => {
        // Get artist name from multiple possible sources
        const artistName = artwork.artist_name || artwork.artists?.full_name || "Artist information not available";
        
        // Ensure all artwork images are included with ALL URL variants for better compatibility
        const processedImages = artwork.artwork_images?.map(img => ({
          id: img.id,
          artwork_id: img.artwork_id,
          image_url: img.image_url,
          thumbnail_url: img.thumbnail_url,
          medium_url: img.medium_url,
          is_primary: img.is_primary,
          display_order: img.display_order,
          processed: img.processed,
          // Include storage paths for URL construction (making them optional to fix TypeScript errors)
          medium_storage_path: (img as any).medium_storage_path,
          large_storage_path: (img as any).large_storage_path,
          thumbnail_storage_path: (img as any).thumbnail_storage_path,
          original_storage_path: (img as any).original_storage_path
        })) || [];
        
        return {
          id: artwork.id,
          title: artwork.title,
          artist_name: artistName,
          year: artwork.year,
          medium_type: artwork.medium_type,
          materials: artwork.materials,
          dimensions: artwork.dimensions,
          price: artwork.price,
          currency: artwork.currency,
          status: artwork.status,
          location_id: artwork.location_id,
          artwork_images: processedImages
        };
      });

      console.log("Artwork data prepared for export:", artworkData.map(a => ({ 
        title: a.title, 
        artist_name: a.artist_name, 
        images: a.artwork_images?.length || 0,
        sampleImageUrls: a.artwork_images?.slice(0, 1).map(img => ({
          image_url: img.image_url,
          thumbnail_url: img.thumbnail_url,
          medium_url: img.medium_url,
          medium_storage_path: img.medium_storage_path,
          is_primary: img.is_primary
        })) || []
      })));

      const { data, error } = await supabase.functions.invoke('export-artworks-google-doc', {
        body: {
          artworks: artworkData,
          title: title || `Artwork List - ${new Date().toLocaleDateString()}`,
        },
      });

      console.log('Export response received:', { data, error });

      // Handle Supabase client errors (network, auth, etc.)
      if (error) {
        console.error('Supabase client error:', error);
        throw new Error(`Network or authentication error: ${error.message}`);
      }

      // Handle application errors from the edge function
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response from export service');
      }

      const response = data as ExportResponse;

      if (!response.success) {
        console.error('Export failed with application error:', response);
        
        // Provide specific error messages based on error type
        let userErrorMessage = response.error || 'Export failed for unknown reason';
        let errorTitle = 'Export Failed';
        
        switch (response.errorType) {
          case 'storage_quota_exceeded':
            errorTitle = 'Storage Quota Exceeded';
            userErrorMessage = response.error || 'The Google Drive storage is full. Please contact an administrator to upgrade the account or clean up old documents.';
            break;
          case 'configuration_error':
            errorTitle = 'Configuration Error';
            userErrorMessage = response.error || 'Export service is not properly configured. Please contact an administrator.';
            break;
          case 'authentication_error':
            errorTitle = 'Authentication Error';
            userErrorMessage = response.error || 'Failed to authenticate with Google services. Please contact an administrator.';
            break;
          case 'document_creation_error':
            errorTitle = 'Document Creation Error';
            userErrorMessage = response.error || 'Failed to create the document. This may be due to template or permissions issues.';
            break;
          case 'content_processing_error':
            errorTitle = 'Content Processing Error';
            userErrorMessage = response.error || 'The document was created but artwork content could not be added.';
            break;
          case 'validation_error':
            errorTitle = 'Invalid Request';
            userErrorMessage = response.error || 'Invalid export request.';
            break;
          default:
            errorTitle = 'Export Error';
            userErrorMessage = response.error || 'An unexpected error occurred during export.';
        }
        
        toast({
          title: errorTitle,
          description: userErrorMessage,
          variant: "destructive",
        });
        
        throw new Error(userErrorMessage);
      }

      // Handle successful export
      if (response.documentUrl) {
        console.log('Export successful, opening document:', response.documentUrl);
        
        // Try to open the document in a new tab with better handling
        setTimeout(() => {
          const newWindow = window.open(response.documentUrl, '_blank', 'noopener,noreferrer');
          
          if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
            // Popup was blocked, show toast with manual link
            toast({
              title: "Export Successful - Manual Action Required",
              description: `Successfully exported ${response.artworkCount} artworks to Google Docs. Your browser blocked the popup. Please copy and paste this URL to open the document: ${response.documentUrl}`,
              duration: 15000, // Show longer so user can copy URL
            });
          } else {
            toast({
              title: "Export Successful",
              description: `Successfully exported ${response.artworkCount} artworks to Google Docs. Document opened in new tab.`,
            });
          }
        }, 100); // Small delay to ensure popup isn't blocked by timing

        return response;
      } else {
        throw new Error('Export completed but no document URL was provided');
      }

    } catch (error: any) {
      console.error('Export process failed:', error);
      
      // Only show toast if we haven't already shown one for this specific error
      if (!error.message?.includes('Export failed with application error')) {
        toast({
          title: "Export Failed",
          description: error.message || "An unexpected error occurred during export. Please try again.",
          variant: "destructive",
        });
      }

      throw error;
    } finally {
      setIsExporting(false);
    }
  };

  return {
    exportToGoogleDocs,
    isExporting,
  };
}
