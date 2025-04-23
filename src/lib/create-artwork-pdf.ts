
import { Artwork } from "@/hooks/use-artworks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export async function createArtworkPDF(artwork: Artwork): Promise<string> {
  console.log("Creating PDF for artwork:", artwork.title);
  
  try {
    // First check if the bucket exists
    const { data: bucketData, error: bucketError } = await supabase
      .storage
      .getBucket('documents');
    
    if (bucketError) {
      console.error("Storage bucket error:", bucketError);
      
      if (bucketError.message.includes("not found")) {
        toast.error("Storage bucket 'documents' not found. Please contact the administrator.");
        throw new Error("Storage bucket not found. Please set up the documents bucket in Supabase.");
      }
      
      toast.error("Storage error: " + bucketError.message);
      throw bucketError;
    }
    
    console.log("Bucket exists:", bucketData);
    
    // Ensure a valid file name
    const htmlFileName = `artwork_${artwork.id}_${Date.now()}.html`;
    
    // Create HTML content to represent artwork data
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Artwork: ${artwork.title}</title>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; margin: 30px; }
            h1 { color: #333; }
            .detail { margin-bottom: 10px; }
            @media print {
              body { margin: 0; }
              .page-break { page-break-after: always; }
            }
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
    console.log("Uploading HTML to storage...");
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("documents")
      .upload(htmlFileName, blob, {
        contentType: 'text/html',
        upsert: true
      });
    
    if (uploadError) {
      console.error("Error uploading document:", uploadError);
      toast.error("Failed to upload document: " + uploadError.message);
      throw uploadError;
    }
    
    console.log("Upload successful:", uploadData);
    
    // Get the public URL for the uploaded file
    const { data: { publicUrl } } = supabase.storage
      .from("documents")
      .getPublicUrl(htmlFileName);
    
    console.log("Public URL:", publicUrl);
    
    // Create a document record in the database
    const { error: documentError } = await supabase
      .from("documents")
      .insert({
        file_name: htmlFileName,
        file_url: publicUrl,
        type: "artwork_overview",
        description: `Overview document for ${artwork.title}`,
        artwork_id: artwork.id
      });
    
    if (documentError) {
      console.error("Error creating document record:", documentError);
      toast.error("Failed to create document record: " + documentError.message);
    }
    
    // Create a link element to trigger download
    const downloadLink = document.createElement("a");
    downloadLink.href = publicUrl;
    downloadLink.target = "_blank";
    downloadLink.rel = "noopener noreferrer";
    downloadLink.click();
    
    toast.success("Document ready for viewing");
    return publicUrl;
  } catch (error) {
    console.error("Error generating document:", error);
    toast.error("Failed to generate document: " + (error as Error).message);
    throw error;
  }
}
