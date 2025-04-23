import { Collection } from "@/hooks/use-collections";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ensureDocumentsBucketExists } from "@/hooks/use-documents";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

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
    
    // Try to ensure documents bucket exists - but proceed even if it fails
    console.log("Checking document storage availability...");
    const bucketExists = await ensureDocumentsBucketExists();
    
    if (!bucketExists) {
      console.warn("Document storage bucket issue - proceeding with attempt to upload anyway");
    }
    
    // Ensure a valid file name with timestamp and random string to prevent overwrites
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const safeCollectionName = collection.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const pdfFileName = `collection_${safeCollectionName}_${timestamp}_${randomStr}.pdf`;
    
    console.log("Generated filename:", pdfFileName);
    
    // Create HTML content to represent collection data with proper escaping
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Collection: ${escapeHtml(collection.name)}</title>
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
              font-size: 28px;
              margin-bottom: 20px;
              padding-bottom: 10px;
              border-bottom: 2px solid #18465a;
            }
            h2 {
              color: #18465a;
              font-size: 22px;
              margin: 30px 0 20px;
            }
            .collection-description {
              font-size: 16px;
              color: #666;
              margin-bottom: 30px;
              padding: 15px;
              background: #f8f9fa;
              border-radius: 6px;
            }
            .artwork { 
              margin-bottom: 25px; 
              padding: 20px;
              background: #fff;
              border: 1px solid #e1e4e8;
              border-radius: 8px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .artwork:last-child { 
              margin-bottom: 0; 
            }
            .artwork h3 {
              color: #18465a;
              font-size: 18px;
              margin: 0 0 15px;
              padding-bottom: 8px;
              border-bottom: 1px solid #e1e4e8;
            }
            .artwork p {
              margin: 8px 0;
              color: #555;
            }
            .artwork-detail {
              font-size: 14px;
              display: flex;
              gap: 10px;
              align-items: center;
            }
            .detail-label {
              font-weight: bold;
              color: #18465a;
              min-width: 80px;
            }
            @media print {
              body { margin: 20px; }
              .artwork { 
                break-inside: avoid;
                box-shadow: none;
              }
              .collection-description {
                background: #fff;
                border: 1px solid #eee;
              }
            }
          </style>
        </head>
        <body>
          <h1>Collection: ${escapeHtml(collection.name)}</h1>
          ${collection.description ? `
            <div class="collection-description">
              ${escapeHtml(collection.description)}
            </div>
          ` : ''}
          
          <h2>Artworks</h2>
          ${collection.artworks?.map(artwork => `
            <div class="artwork">
              <h3>${escapeHtml(artwork.title)} ${artwork.year ? `(${artwork.year})` : ''}</h3>
              <div class="artwork-detail">
                <span class="detail-label">Medium:</span>
                ${escapeHtml(artwork.medium_type || 'N/A')}
              </div>
              ${artwork.materials ? `
                <div class="artwork-detail">
                  <span class="detail-label">Materials:</span>
                  ${escapeHtml(artwork.materials)}
                </div>
              ` : ''}
              ${artwork.dimensions ? `
                <div class="artwork-detail">
                  <span class="detail-label">Dimensions:</span>
                  ${escapeHtml(artwork.dimensions)}
                </div>
              ` : ''}
            </div>
          `).join('') || '<p>No artworks in this collection</p>'}
        </body>
      </html>
    `;
    
    // Create an invisible div to render the HTML content
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '-9999px';
    tempDiv.innerHTML = htmlContent;
    document.body.appendChild(tempDiv);
    
    // Create a PDF document and add the rendered HTML content
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'px',
      format: 'a4'
    });
    
    // Convert the HTML content to canvas and then to PDF
    toast.loading("Generating PDF, please wait...");
    
    // Convert HTML to canvas
    const canvas = await html2canvas(tempDiv, {
      scale: 1.5, // Higher quality rendering
      useCORS: true,
      logging: false,
      allowTaint: true
    });
    
    // Remove the temporary div
    document.body.removeChild(tempDiv);
    
    // Add canvas to PDF
    const imgData = canvas.toDataURL('image/png');
    const imgProps = doc.getImageProperties(imgData);
    const pdfWidth = doc.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    
    // Convert PDF to Blob
    const pdfBlob = doc.output('blob');
    
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
    
    // Check if a document for this collection already exists
    const { data: existingDocs } = await supabase
      .from("documents")
      .select("*")
      .eq("type", "collection_overview")
      .ilike("description", `%${collection.name}%`)
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
          description: `Overview document for ${collection.name} (updated)`,
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
      // Create a document record in the database
      const { data: newDoc, error: documentError } = await supabase
        .from("documents")
        .insert({
          file_name: pdfFileName,
          file_url: publicUrl,
          type: "collection_overview",
          description: `Overview document for ${collection.name}`,
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
    
    // Create a download link element to trigger download
    const downloadLink = document.createElement("a");
    downloadLink.href = publicUrl;
    downloadLink.download = `${collection.name}.pdf`;
    downloadLink.rel = "noopener noreferrer";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    toast.success("Document ready for download");
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
