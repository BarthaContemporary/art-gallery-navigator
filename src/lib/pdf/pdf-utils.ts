import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ensureDocumentsBucketExists } from "@/hooks/use-documents";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface PDFGenerationOptions {
  html: string;
  fileName: string;
  entityType: 'artwork' | 'collection';
  entityId: string;
  entityTitle: string;
  description?: string;
}

export async function generatePDFFromHTML({
  html,
  fileName,
  entityType,
  entityId,
  entityTitle,
  description
}: PDFGenerationOptions): Promise<string> {
  // Check authentication
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    console.error("Authentication error:", sessionError || "No active session");
    toast.error("You must be logged in to generate documents");
    throw new Error("Authentication required");
  }

  // Check storage availability
  const bucketExists = await ensureDocumentsBucketExists();
  if (!bucketExists) {
    console.warn("Document storage bucket issue - proceeding with attempt to upload anyway");
  }

  // Create temporary iframe for rendering with proper dimensions
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.left = '-9999px';
  iframe.style.top = '-9999px';
  iframe.style.width = '210mm';
  iframe.style.height = '297mm';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);
  
  // Wait for iframe to load before accessing its document
  await new Promise((resolve) => {
    iframe.onload = resolve;
    iframe.srcdoc = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            @page { size: A4; margin: 0; }
            @media print { body { -webkit-print-color-adjust: exact; } }
            html, body {
              margin: 0;
              padding: 0;
              width: 210mm;
              height: 297mm;
            }
          </style>
        </head>
        <body>
          ${html}
        </body>
      </html>
    `;
  });

  try {
    toast.loading("Generating PDF, please wait...");
    await new Promise(resolve => setTimeout(resolve, 800));

    // Access the document inside the iframe
    const iframeDocument = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDocument) throw new Error("Could not access iframe document");
    
    // Wait for images to load within the iframe
    await Promise.all(
      Array.from(iframeDocument.images).map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve; // Continue even if some images fail
        });
      })
    );
    
    // Add explicit load event for stationery background
    const stationeryImg = iframeDocument.querySelector('.stationery-background-image') as HTMLImageElement;
    if (stationeryImg) {
      await new Promise(resolve => {
        if (stationeryImg.complete) resolve(true);
        else stationeryImg.onload = () => resolve(true);
      });
    }

    // Generate canvas from iframe content
    const canvas = await html2canvas(iframeDocument.body, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      width: 210 * 3.78, // A4 width in pixels (210mm) at 72 DPI
      height: 297 * 3.78, // A4 height in pixels (297mm) at 72 DPI
      backgroundColor: null, // Transparent background
      imageTimeout: 30000,
      onclone: (clonedDoc) => {
        // Ensure all images are properly set to visible in the cloned document
        const imgs = clonedDoc.querySelectorAll('img');
        imgs.forEach(img => {
          img.style.visibility = 'visible';
          img.style.opacity = '1';
          img.crossOrigin = "Anonymous";
        });
      }
    });

    // Create PDF with A4 dimensions
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    // Add canvas to PDF at A4 size
    doc.addImage(
      canvas.toDataURL('image/png', 1.0), 
      'PNG', 
      0, 
      0, 
      210, 
      297
    );

    // Upload PDF
    const pdfBlob = doc.output('blob');
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, pdfBlob, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from("documents")
      .getPublicUrl(fileName);

    // Update or create document record
    await updateDocumentRecord(entityType, entityId, fileName, publicUrl, description || `PDF for ${entityTitle}`);

    // Create download link
    const downloadLink = document.createElement("a");
    downloadLink.href = publicUrl;
    downloadLink.download = `${entityTitle}.pdf`;
    downloadLink.rel = "noopener noreferrer";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    toast.success("Document ready for download");
    return publicUrl;

  } catch (error) {
    console.error("Error generating document:", error);
    if (error instanceof Error) {
      if (error.message.includes("buckets")) {
        toast.error("Document storage not available. Contact administrator.", {
          description: "You don't have permission to use document storage"
        });
      } else {
        toast.error("Failed to generate document: " + error.message);
      }
    }
    throw error;
  } finally {
    document.body.removeChild(iframe);
  }
}

async function updateDocumentRecord(
  type: 'artwork' | 'collection',
  entityId: string,
  fileName: string,
  fileUrl: string,
  description: string
) {
  const documentType = type === 'artwork' ? 'artwork_datasheet' : 'collection_overview';
  const entityField = type === 'artwork' ? 'artwork_id' : 'collection_id';

  // Check for existing document
  const { data: existingDocs } = await supabase
    .from("documents")
    .select("*")
    .eq("type", documentType)
    .eq(entityField, entityId)
    .order("date_uploaded", { ascending: false })
    .limit(1);

  if (existingDocs && existingDocs.length > 0) {
    // Update existing document
    const { error: updateError } = await supabase
      .from("documents")
      .update({
        file_name: fileName,
        file_url: fileUrl,
        description: `${description} (updated)`,
        date_uploaded: new Date().toISOString()
      })
      .eq("id", existingDocs[0].id);

    if (updateError) {
      console.error("Error updating document record:", updateError);
      toast.error("Failed to update document record: " + updateError.message);
    }
  } else {
    // Create new document record
    const { error: documentError } = await supabase
      .from("documents")
      .insert({
        file_name: fileName,
        file_url: fileUrl,
        type: documentType,
        [entityField]: entityId,
        description: description,
        date_uploaded: new Date().toISOString()
      });

    if (documentError) {
      console.error("Error creating document record:", documentError);
      toast.error("Failed to create document record: " + documentError.message);
    }
  }
}
