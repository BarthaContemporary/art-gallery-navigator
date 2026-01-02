import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Artwork } from "@/hooks/use-artworks";

interface ExportResponse {
  success: boolean;
  file?: string;
  fileName?: string;
  size?: number;
  format?: string;
  error?: string;
}

export function useExportArtworksToDocx() {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const generateArtworkHTML = (artworks: Artwork[], title: string): string => {
    const artworkRows = artworks.map(artwork => {
      const artistName = artwork.artist_name || artwork.artists?.full_name || "Unknown Artist";
      const primaryImage = artwork.artwork_images?.find(img => img.is_primary) || artwork.artwork_images?.[0];
      
      let imageUrl = '';
      if (primaryImage) {
        if (primaryImage.medium_url) {
          imageUrl = primaryImage.medium_url;
        } else if (primaryImage.image_url) {
          imageUrl = primaryImage.image_url;
        }
      }

      return `
        <div style="page-break-inside: avoid; margin-bottom: 30px; border-bottom: 1px solid #eee; padding-bottom: 20px;">
          ${imageUrl ? `<img src="${imageUrl}" style="max-width: 300px; max-height: 200px; margin-bottom: 10px;" />` : ''}
          <h2 style="margin: 0 0 5px 0; font-size: 18px;">${artwork.title || 'Untitled'}</h2>
          <p style="margin: 0 0 5px 0; color: #666;">${artistName}${artwork.year ? `, ${artwork.year}` : ''}</p>
          ${artwork.medium_type ? `<p style="margin: 0 0 5px 0;"><strong>Medium:</strong> ${artwork.medium_type}</p>` : ''}
          ${artwork.materials ? `<p style="margin: 0 0 5px 0;"><strong>Materials:</strong> ${artwork.materials}</p>` : ''}
          ${artwork.dimensions ? `<p style="margin: 0 0 5px 0;"><strong>Dimensions:</strong> ${artwork.dimensions}</p>` : ''}
          ${artwork.price ? `<p style="margin: 0 0 5px 0;"><strong>Price:</strong> ${artwork.currency || 'USD'} ${artwork.price.toLocaleString()}</p>` : ''}
          ${artwork.status ? `<p style="margin: 0 0 5px 0;"><strong>Status:</strong> ${artwork.status}</p>` : ''}
        </div>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; }
          h1 { font-size: 24px; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p style="color: #666; margin-bottom: 30px;">Generated on ${new Date().toLocaleDateString()} • ${artworks.length} artwork${artworks.length !== 1 ? 's' : ''}</p>
        ${artworkRows}
      </body>
      </html>
    `;
  };

  const exportToDocx = async (artworks: Artwork[], title?: string) => {
    if (artworks.length === 0) {
      toast({
        title: "No Artworks",
        description: "No artworks to export.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);

    try {
      const exportTitle = title || `Artwork List - ${new Date().toLocaleDateString()}`;
      const html = generateArtworkHTML(artworks, exportTitle);

      console.log(`Exporting ${artworks.length} artworks to DOCX...`);

      const { data, error } = await supabase.functions.invoke('export-to-docx', {
        body: {
          html,
          fileName: exportTitle,
          format: 'docx',
        },
      });

      if (error) {
        console.error('Supabase error:', error);
        throw new Error(error.message || 'Failed to export');
      }

      const response = data as ExportResponse;

      if (!response.success || !response.file) {
        throw new Error(response.error || 'Export failed');
      }

      // Convert base64 to blob and download
      const byteCharacters = atob(response.file);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = response.fileName || `${exportTitle}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: `Downloaded ${artworks.length} artworks as DOCX`,
      });

      return response;

    } catch (error: any) {
      console.error('Export failed:', error);
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export artworks",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return {
    exportToDocx,
    isExporting,
  };
}
