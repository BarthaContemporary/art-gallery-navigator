
import { Collection } from "@/hooks/use-collections";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export async function createCollectionPDF(collection: Collection): Promise<string> {
  console.log("Creating PDF for collection:", collection.name);
  
  try {
    // Ensure a valid file name
    const fileName = `collection_${collection.id}_${Date.now()}.html`;
    
    // Create a simple HTML string to represent collection data
    const htmlContent = `
      <html>
        <head>
          <title>Collection: ${collection.name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 30px; }
            h1 { color: #333; }
            .artwork { margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #eee; }
            .artwork:last-child { border-bottom: none; }
          </style>
        </head>
        <body>
          <h1>Collection: ${collection.name}</h1>
          ${collection.description ? `<p>${collection.description}</p>` : ''}
          <h2>Artworks:</h2>
          ${collection.artworks?.map(artwork => `
            <div class="artwork">
              <h3>${artwork.title} ${artwork.year ? `(${artwork.year})` : ''}</h3>
              <p>Medium: ${artwork.medium_type || 'N/A'}</p>
              ${artwork.materials ? `<p>Materials: ${artwork.materials}</p>` : ''}
              ${artwork.dimensions ? `<p>Dimensions: ${artwork.dimensions}</p>` : ''}
            </div>
          `).join('') || '<p>No artworks in this collection</p>'}
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
        type: "collection_overview",
        description: `Overview document for ${collection.name}`,
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
