import { Collection } from "@/hooks/use-collections";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ensureDocumentsBucketExists } from "@/hooks/use-documents";

export async function createCollectionPDF(collection: Collection): Promise<string> {
  console.log("Creating PDF for collection:", collection.name);
  
  try {
    // First check if the user is authenticated
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !sessionData.session) {
      console.error("Authentication error:", sessionError || "No active session");
      toast.error("You must be logged in to generate documents");
      throw new Error("Authentication required");
    }
    
    // Ensure documents bucket exists
    console.log("Ensuring documents bucket exists...");
    const bucketExists = await ensureDocumentsBucketExists();
    
    if (!bucketExists) {
      console.error("Failed to configure documents storage bucket");
      toast.error("Document storage setup failed");
      throw new Error("Document storage configuration failed");
    }
    
    // Ensure a valid file name with timestamp and random string to prevent overwrites
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const safeCollectionName = collection.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const htmlFileName = `collection_${safeCollectionName}_${timestamp}_${randomStr}.html`;
    
    console.log("Generated filename:", htmlFileName);
    
    // Create HTML content to represent collection data with proper escaping
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Collection: ${escapeHtml(collection.name)}</title>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; margin: 30px; }
            h1 { color: #333; }
            .artwork { margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #eee; }
            .artwork:last-child { border-bottom: none; }
            @media print {
              body { margin: 0; }
              .page-break { page-break-after: always; }
            }
          </style>
        </head>
        <body>
          <h1>Collection: ${escapeHtml(collection.name)}</h1>
          ${collection.description ? `<p>${escapeHtml(collection.description)}</p>` : ''}
          <h2>Artworks:</h2>
          ${collection.artworks?.map(artwork => `
            <div class="artwork">
              <h3>${escapeHtml(artwork.title)} ${artwork.year ? `(${artwork.year})` : ''}</h3>
              <p>Medium: ${escapeHtml(artwork.medium_type || 'N/A')}</p>
              ${artwork.materials ? `<p>Materials: ${escapeHtml(artwork.materials)}</p>` : ''}
              ${artwork.dimensions ? `<p>Dimensions: ${escapeHtml(artwork.dimensions)}</p>` : ''}
            </div>
          `).join('') || '<p>No artworks in this collection</p>'}
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
        type: "collection_overview",
        description: `Overview document for ${collection.name}`,
      });
    
    if (documentError) {
      console.error("Error creating document record:", documentError);
      toast.error("Failed to create document record: " + documentError.message);
    }
    
    // Create a link element to trigger download and navigate to file in new tab
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

function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  return unsafe
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
