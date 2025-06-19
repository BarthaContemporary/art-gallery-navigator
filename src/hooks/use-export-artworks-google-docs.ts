
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

      // Pre-open a blank window before the async operation
      // This ensures it's treated as a user-initiated action
      const newWindow = window.open('about:blank', '_blank');

      const { data, error } = await supabase.functions.invoke('export-artworks-google-doc', {
        body: {
          artworks: artworks.map(artwork => ({
            id: artwork.id,
            title: artwork.title,
            artist_name: artwork.artist_name,
            year: artwork.year,
            medium_type: artwork.medium_type,
            materials: artwork.materials,
            dimensions: artwork.dimensions,
            price: artwork.price,
            currency: artwork.currency,
            status: artwork.status,
            location_id: artwork.location_id,
          })),
          title: title || `Artwork List - ${new Date().toLocaleDateString()}`,
        },
      });

      if (error) {
        console.error('Export error:', error);
        // Close the blank window if there was an error
        if (newWindow) {
          newWindow.close();
        }
        throw new Error(error.message || 'Failed to export artworks');
      }

      const response = data as ExportResponse;

      if (response.success && response.documentUrl) {
        toast({
          title: "Export Successful",
          description: `Successfully exported ${response.artworkCount} artworks to Google Docs.`,
        });

        // Navigate the pre-opened window to the document URL
        if (newWindow) {
          newWindow.location.href = response.documentUrl;
          newWindow.focus();
        } else {
          // Fallback: try to open normally if the pre-opened window failed
          window.open(response.documentUrl, '_blank');
        }

        return response;
      } else {
        // Close the blank window if there was an error
        if (newWindow) {
          newWindow.close();
        }
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
