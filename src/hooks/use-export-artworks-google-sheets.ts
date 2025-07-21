import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Artwork } from "@/hooks/use-artworks";

declare global {
  interface Window {
    google: any;
  }
}

interface ExportResponse {
  success: boolean;
  spreadsheetUrl?: string;
  spreadsheetId?: string;
  artworkCount?: number;
  error?: string;
  errorType?: string;
  details?: string;
}

export function useExportArtworksToGoogleSheets() {
  const [isExporting, setIsExporting] = useState(false);

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
          scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
          callback: (response: any) => {
            if (response.error) {
              console.error('Google auth failed:', response);
              toast.error(`Google authentication failed: ${response.error_description || response.error}. Please ensure popup blockers are disabled and try again.`);
              resolve(null);
            } else {
              console.log('Google auth successful');
              resolve(response.access_token);
            }
          }
        }).requestAccessToken();
      };
      
      script.onerror = () => {
        toast.error("Failed to load Google authentication. Please check your internet connection and try again.");
        resolve(null);
      };
      
      document.head.appendChild(script);
    });
  };

  const exportToGoogleSheets = async (artworks: Artwork[], title?: string) => {
    if (artworks.length === 0) {
      toast.error("No artworks to export. Please ensure there are artworks in the current view.");
      return;
    }

    setIsExporting(true);

    try {
      console.log(`Starting export of ${artworks.length} artworks to Google Sheets...`);
      
      // Authenticate with Google
      const accessToken = await authenticateWithGoogle();
      if (!accessToken) {
        return; // Error already shown in authenticateWithGoogle
      }

      // Prepare artwork data for spreadsheet format
      const artworkData = artworks.map(artwork => {
        // Get artist name from multiple possible sources
        const artistName = artwork.artist_name || artwork.artists?.full_name || "Artist information not available";
        
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
          classification: artwork.classification,
          condition: artwork.condition,
          signature_type: artwork.signature_type,
          provenance: artwork.provenance,
          exhibition_history: artwork.exhibition_history,
          story: artwork.story,
          ai_description: artwork.ai_description,
          image_count: artwork.artwork_images?.length || 0
        };
      });

      console.log("Artwork data prepared for export:", artworkData.map(a => ({ 
        title: a.title, 
        artist_name: a.artist_name, 
        images: a.image_count
      })));

      const { data, error } = await supabase.functions.invoke('export-artworks-google-sheets', {
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
        toast.error(error.message || "Failed to connect to export service");
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
        
        switch (response.errorType) {
          case 'authentication_required':
            userErrorMessage = 'Please sign in to your Google account to export to Google Sheets.';
            break;
          case 'authentication_expired':
            userErrorMessage = 'Your Google authentication has expired. Please try again.';
            break;
          case 'spreadsheet_creation_error':
            userErrorMessage = response.error || 'Failed to create the spreadsheet in your Google Drive.';
            break;
          case 'validation_error':
            userErrorMessage = response.error || 'Invalid export request.';
            break;
          default:
            userErrorMessage = response.error || 'An unexpected error occurred during export.';
        }
        
        toast.error(userErrorMessage);
        return;
      }

      // Handle successful export
      if (response.spreadsheetUrl) {
        console.log('Export successful, opening spreadsheet:', response.spreadsheetUrl);
        
        // Try to open the spreadsheet in a new tab with better handling
        setTimeout(() => {
          const newWindow = window.open(response.spreadsheetUrl, '_blank', 'noopener,noreferrer');
          
          if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
            // Popup was blocked, show toast with manual link
            toast.success(`Successfully exported ${response.artworkCount} artworks to Google Sheets. Your browser blocked the popup. Please copy and paste this URL: ${response.spreadsheetUrl}`, {
              duration: 15000, // Show longer so user can copy URL
            });
          } else {
            toast.success(`Successfully exported ${response.artworkCount} artworks to Google Sheets. Spreadsheet opened in new tab.`);
          }
        }, 100); // Small delay to ensure popup isn't blocked by timing

        return response;
      } else {
        toast.error("Export completed but no spreadsheet URL was provided");
        return;
      }

    } catch (error: any) {
      console.error('Export process failed:', error);
      
      toast.error(error.message || "An unexpected error occurred during export. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return {
    exportToGoogleSheets,
    isExporting,
  };
}