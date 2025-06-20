
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
        
        // Ensure all artwork images are included with all URL variants
        const processedImages = artwork.artwork_images?.map(img => ({
          id: img.id,
          artwork_id: img.artwork_id,
          image_url: img.image_url,
          thumbnail_url: img.thumbnail_url,
          medium_url: img.medium_url,
          is_primary: img.is_primary,
          display_order: img.display_order,
          processed: img.processed
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
        imageUrls: a.artwork_images?.map(img => ({
          image_url: img.image_url,
          thumbnail_url: img.thumbnail_url,
          medium_url: img.medium_url,
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
        toast({
          title: "Export Successful",
          description: `Successfully exported ${response.artworkCount} artworks to Google Docs. Opening document...`,
        });

        // Open the document in a new tab
        window.open(response.documentUrl, '_blank', 'noopener,noreferrer');

        return response;
      } else {
        throw new Error(response.error || 'Unknown error occurred during export');
      }
    } catch (error: any) {
      console.error('Failed to export artworks to Google Docs:', error);
      
      let errorMessage = 'Failed to export artworks to Google Docs.';
      if (error.message?.includes('Google API credentials not configured')) {
        errorMessage = 'Google API credentials are not configured. Please contact an administrator.';
      } else if (error.message?.includes('Google API access forbidden')) {
        errorMessage = 'Google API access is forbidden. Please check the API configuration.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Export Failed",
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
