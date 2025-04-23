
import { Artwork } from "@/hooks/use-artworks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export async function createArtworkPDF(artwork: Artwork): Promise<string> {
  console.log("Creating PDF for artwork:", artwork.title);
  
  try {
    // Ensure a valid file name
    const fileName = `artwork_${artwork.id}_${Date.now()}.html`;
    
    // Create a simple HTML string to represent artwork data
    const htmlContent = `
      <html>
        <head>
          <title>Artwork: ${artwork.title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 30px; }
            h1 { color: #333; }
            .detail { margin-bottom: 10px; }
          </style>
        </head>
        <body>
          <h1>${artwork.title} ${artwork.year ? `(${artwork.year})` : ''}</h1>
          <div class="detail">Medium: ${artwork.medium_type || 'N/A'}</div>
          ${artwork.materials ? `<div class="detail">Materials: ${artwork.materials}</div>` : ''}
          ${artwork.dimensions ? `<div class="detail">Dimensions: ${artwork.dimensions}</div>` : ''}
          ${artwork.status ? `<div class="detail">Status: ${artwork.status}</div>` : ''}
          ${artwork.story ? `<div class="detail">Story: ${artwork.story}</div>` : ''}
          ${artwork.provenance ? `<div class="detail">Provenance: ${artwork.provenance}</div>` : ''}
        </body>
      </html>
    `;
    
    // Convert HTML content to Blob
    const blob = new Blob([htmlContent], { type: 'text/html' });
    
    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, blob, {
        contentType: 'text/html',
        upsert: true
      });
    
    if (uploadError) {
      console.error("Error uploading PDF:", uploadError);
      toast.error("Failed to upload document");
      throw uploadError;
    }
    
    // Get the public URL for the uploaded file
    const { data: { publicUrl } } = supabase.storage
      .from("documents")
      .getPublicUrl(fileName);
    
    // Create a document record in the database
    const { error: documentError } = await supabase
      .from("documents")
      .insert({
        file_name: fileName,
        file_url: publicUrl,
        type: "artwork_overview",
        description: `Overview document for ${artwork.title}`,
        artwork_id: artwork.id
      });
    
    if (documentError) {
      console.error("Error creating document record:", documentError);
      toast.error("Failed to create document record");
    }
    
    // Open the PDF in a new tab
    window.open(publicUrl, '_blank');
    
    return publicUrl;
  } catch (error) {
    console.error("Error generating PDF:", error);
    toast.error("Failed to generate PDF");
    throw error;
  }
}
