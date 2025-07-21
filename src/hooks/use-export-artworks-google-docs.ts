
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
      console.log(`Exporting ${artworks.length} artworks to Google Docs...`);

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

      if (error) {
        console.error('Export error:', error);
        throw new Error(error.message || 'Failed to export artworks');
      }

      const response = data as ExportResponse;
      console.log('Export response:', response);

      if (response.success && response.documentUrl) {
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
        throw new Error(response.error || 'Unknown error occurred during export');
      }
    } catch (error: any) {
      console.error('Failed to export artworks to Google Docs:', error);
      
      let errorMessage = 'Failed to export artworks to Google Docs.';
      let errorTitle = 'Export Failed';
      
      // Handle specific error cases with better user guidance
      if (error.message?.includes('storage quota exceeded') || error.message?.includes('Google Drive storage is full')) {
        errorTitle = 'Storage Quota Exceeded';
        errorMessage = 'The Google Drive storage is full. An administrator needs to clean up old documents or upgrade the Google Workspace account. Please try again later.';
      } else if (error.message?.includes('Template document not found') || error.message?.includes('Export template is not properly configured')) {
        errorTitle = 'Configuration Error';
        errorMessage = 'The export template is not properly configured. Please contact an administrator to resolve this issue.';
      } else if (error.message?.includes('Google API credentials not configured')) {
        errorTitle = 'Configuration Error';
        errorMessage = 'Google API credentials are not configured. Please contact an administrator to set up the export functionality.';
      } else if (error.message?.includes('Google API access forbidden') || error.message?.includes('Google API access is not properly configured')) {
        errorTitle = 'Access Error';
        errorMessage = 'Google API access is not properly configured. Please contact an administrator to check the API permissions.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });

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
