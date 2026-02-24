
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStoragePublicUrl } from '@/lib/supabase-url';
import { useToast } from "@/hooks/use-toast";
import { Artwork } from "@/hooks/use-artworks";

declare global {
  interface Window {
    google: any;
  }
}

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

  const authenticateWithGoogle = async (): Promise<string | null> => {
    return new Promise((resolve) => {
      // Use Google Identity Services (newer OAuth method)
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => {
        const currentOrigin = window.location.origin;
        console.log('Current origin for OAuth:', currentOrigin);
        
        // Initialize Google Identity Services
        window.google.accounts.oauth2.initTokenClient({
          client_id: '255260465584-drej8c72nkt1no7sb8lldcg255fn903p.apps.googleusercontent.com',
          scope: 'https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file',
          callback: (response: any) => {
            if (response.error) {
              console.error('Google auth failed:', response);
              toast({
                title: "Authentication Failed", 
                description: `Google authentication failed: ${response.error_description || response.error}. Please ensure popup blockers are disabled and try again.`,
                variant: "destructive",
              });
              resolve(null);
            } else {
              console.log('Google auth successful');
              resolve(response.access_token);
            }
          }
        }).requestAccessToken();
      };
      
      script.onerror = () => {
        toast({
          title: "Authentication Failed",
          description: "Failed to load Google authentication. Please check your internet connection and try again.",
          variant: "destructive",
        });
        resolve(null);
      };
      
      document.head.appendChild(script);
    });
  };

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
      
      // Authenticate with Google
      const accessToken = await authenticateWithGoogle();
      if (!accessToken) {
        return; // Error already shown in authenticateWithGoogle
      }

      // Prepare artwork data with proper artist information and all image data
      const artworkData = artworks.map(artwork => {
        // Get artist name from multiple possible sources
        const artistName = artwork.artist_name || artwork.artists?.full_name || "Artist information not available";
        
        // Get primary image URL for =IMAGE() function
        const primaryImage = artwork.artwork_images?.find(img => img.is_primary) || artwork.artwork_images?.[0];
        let primaryImageUrl = '';
        
        if (primaryImage) {
          // Try to get the best available URL
          if (primaryImage.medium_storage_path) {
            primaryImageUrl = getStoragePublicUrl('artwork-images-processed', primaryImage.medium_storage_path);
          } else if (primaryImage.image_url && !primaryImage.image_url.includes('/processing')) {
            primaryImageUrl = primaryImage.image_url;
          }
        }
        
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
          ai_description: (artwork as any).ai_description,
          frame_width: (artwork as any).frame_width,
          frame_height: (artwork as any).frame_height,
          frame_depth: (artwork as any).frame_depth,
          primary_image_url: primaryImageUrl,
          artwork_images: processedImages
        };
      });

      console.log("Artwork data prepared for export:", artworkData.map(a => ({ 
        title: a.title, 
        artist_name: a.artist_name, 
        images: a.artwork_images?.length || 0
      })));

      const { data, error } = await supabase.functions.invoke('export-artworks-google-doc-oauth', {
        body: {
          artworks: artworkData,
          title: title || `Artwork List - ${new Date().toLocaleDateString()}`,
          accessToken: accessToken,
        },
      });

      console.log('Export response received:', { data, error });

      // Handle Supabase client errors (network, auth, etc.)
      if (error) {
        console.error('Supabase client error:', error);
        toast({
          title: "Export Failed",
          description: error.message || "Failed to connect to export service",
          variant: "destructive",
        });
        return;
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
          case 'authentication_required':
            errorTitle = 'Authentication Required';
            userErrorMessage = 'Please sign in to your Google account to export to Google Docs.';
            break;
          case 'authentication_expired':
            errorTitle = 'Authentication Expired';
            userErrorMessage = 'Your Google authentication has expired. Please try again.';
            break;
          case 'document_creation_error':
            errorTitle = 'Document Creation Error';
            userErrorMessage = response.error || 'Failed to create the document in your Google Drive.';
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
        return;
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
              description: `Successfully exported ${response.artworkCount} artworks to your Google Drive. Your browser blocked the popup. Please copy and paste this URL to open the document: ${response.documentUrl}`,
              duration: 15000, // Show longer so user can copy URL
            });
          } else {
            toast({
              title: "Export Successful",
              description: `Successfully exported ${response.artworkCount} artworks to your Google Drive. Document opened in new tab.`,
            });
          }
        }, 100); // Small delay to ensure popup isn't blocked by timing

        return response;
      } else {
        toast({
          title: "Export Failed",
          description: "Export completed but no document URL was provided",
          variant: "destructive",
        });
        return;
      }

    } catch (error: any) {
      console.error('Export process failed:', error);
      
      toast({
        title: "Export Failed",
        description: error.message || "An unexpected error occurred during export. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return {
    exportToGoogleDocs,
    isExporting,
  };
}
