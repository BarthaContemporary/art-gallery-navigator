import { Artwork } from "@/hooks/use-artworks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ensureDocumentsBucketExists } from "@/hooks/use-documents";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export async function createArtworkPDF(artwork: Artwork): Promise<string> {
  console.log("Creating PDF for artwork:", artwork.title);
  
  try {
    // First check if the user is authenticated
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !sessionData.session) {
      console.error("Authentication error:", sessionError || "No active session");
      toast.error("You must be logged in to generate documents");
      throw new Error("Authentication required");
    }
    
    // Try to ensure documents bucket exists - but proceed even if it fails
    console.log("Checking document storage availability...");
    const bucketExists = await ensureDocumentsBucketExists();
    
    if (!bucketExists) {
      console.warn("Document storage bucket issue - proceeding with attempt to upload anyway");
    }
    
    // Ensure a valid file name with timestamp and random string to prevent overwrites
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const safeArtworkTitle = artwork.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const pdfFileName = `artwork_${safeArtworkTitle}_${timestamp}_${randomStr}.pdf`;
    
    console.log("Generated filename:", pdfFileName);
    
    // Create HTML content to represent artwork data with proper escaping
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Artwork: ${escapeHtml(artwork.title)}</title>
          <meta charset="UTF-8">
          <style>
            body { 
              font-family: Arial, sans-serif; 
              margin: 40px;
              color: #333;
              line-height: 1.6;
            }
            h1 { 
              color: #18465a;
              font-size: 24px;
              margin-bottom: 20px;
              padding-bottom: 10px;
              border-bottom: 2px solid #18465a;
            }
            .detail { 
              margin-bottom: 15px;
              padding: 12px;
              background: #f8f9fa;
              border-radius: 6px;
            }
            .detail-label {
              font-weight: bold;
              color: #18465a;
              margin-right: 8px;
            }
            .section {
              margin-bottom: 30px;
            }
            @media print {
              body { margin: 20px; }
              .detail { 
                background: #fff;
                border: 1px solid #eee;
              }
            }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(artwork.title)} ${artwork.year ? `(${artwork.year})` : ''}</h1>
          
          <div class="section">
            <div class="detail">
              <span class="detail-label">Medium:</span>
              ${escapeHtml(artwork.medium_type || 'N/A')}
            </div>
            
            ${artwork.materials ? `
              <div class="detail">
                <span class="detail-label">Materials:</span>
                ${escapeHtml(artwork.materials)}
              </div>
            ` : ''}
            
            ${artwork.dimensions ? `
              <div class="detail">
                <span class="detail-label">Dimensions:</span>
                ${escapeHtml(artwork.dimensions)}
              </div>
            ` : ''}
            
            ${artwork.status ? `
              <div class="detail">
                <span class="detail-label">Status:</span>
                ${escapeHtml(artwork.status)}
              </div>
            ` : ''}
          </div>

          ${artwork.story || artwork.provenance ? `
            <div class="section">
              ${artwork.story ? `
                <div class="detail">
                  <span class="detail-label">Story:</span>
                  ${escapeHtml(artwork.story)}
                </div>
              ` : ''}
              
              ${artwork.provenance ? `
                <div class="detail">
                  <span class="detail-label">Provenance:</span>
                  ${escapeHtml(artwork.provenance)}
                </div>
              ` : ''}
            </div>
          ` : ''}
        </body>
      </html>
    `;
    
    // Create a temporary container to render the HTML
    const container = document.createElement('div');
    container.innerHTML = htmlContent;
    document.body.appendChild(container);
    
    // Generate PDF using html2canvas and jsPDF
    try {
      const canvas = await html2canvas(container);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      
      // Add the image to the PDF
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      
      // Save the PDF
      const pdfBlob = pdf.output('blob');
      
      // Remove the temporary container
      document.body.removeChild(container);
      
      // Upload to Supabase storage
      console.log("Uploading PDF to storage...");
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("documents")
        .upload(pdfFileName, pdfBlob, {
          contentType: 'application/pdf',
          upsert: true
        });
      
      if (uploadError) {
        console.error("Error uploading document:", uploadError);
        
        if (uploadError.message.includes("buckets")) {
          toast.error("Document storage not available. Contact administrator.", {
            description: "You don't have permission to use document storage"
          });
        } else {
          toast.error("Failed to upload document: " + uploadError.message);
        }
        
        throw uploadError;
      }
      
      console.log("Upload successful:", uploadData);
      
      // Get the public URL for the uploaded file
      const { data: { publicUrl } } = supabase.storage
        .from("documents")
        .getPublicUrl(pdfFileName);
      
      console.log("Public URL:", publicUrl);
      
      // Check if a similar document already exists
      const { data: existingDocs } = await supabase
        .from("documents")
        .select("*")
        .eq("artwork_id", artwork.id)
        .eq("type", "artwork_overview")
        .order("date_uploaded", { ascending: false })
        .limit(1);
        
      // If a document already exists, update it rather than creating a new one
      let documentId;
      
      if (existingDocs && existingDocs.length > 0) {
        // Update the existing document
        const { error: updateError } = await supabase
          .from("documents")
          .update({
            file_name: pdfFileName,
            file_url: publicUrl,
            description: `Overview document for ${artwork.title} (updated)`,
            date_uploaded: new Date().toISOString() // Update timestamp
          })
          .eq("id", existingDocs[0].id);
          
        if (updateError) {
          console.error("Error updating document record:", updateError);
          toast.error("Failed to update document record: " + updateError.message);
        } else {
          documentId = existingDocs[0].id;
          console.log("Updated existing document record:", documentId);
        }
      } else {
        // Create a new document record
        const { data: newDoc, error: documentError } = await supabase
          .from("documents")
          .insert({
            file_name: pdfFileName,
            file_url: publicUrl,
            type: "artwork_overview",
            description: `Overview document for ${artwork.title}`,
            artwork_id: artwork.id
          })
          .select();
        
        if (documentError) {
          console.error("Error creating document record:", documentError);
          toast.error("Failed to create document record: " + documentError.message);
        } else if (newDoc) {
          documentId = newDoc[0].id;
          console.log("Created new document record:", documentId);
        }
      }
      
      // Download the PDF directly instead of opening in a new tab
      const downloadLink = document.createElement("a");
      downloadLink.href = URL.createObjectURL(pdfBlob);
      downloadLink.download = `${artwork.title}_overview.pdf`;
      downloadLink.click();
      
      toast.success("PDF created successfully");
      return publicUrl;
      
    } catch (pdfError) {
      console.error("Error generating PDF:", pdfError);
      toast.error("Failed to generate PDF: " + (pdfError as Error).message);
      throw pdfError;
    }
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
