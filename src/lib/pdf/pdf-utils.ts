
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

  // Create temporary div for rendering
  const tempDiv = document.createElement('div');
  tempDiv.style.position = 'absolute';
  tempDiv.style.left = '-9999px';
  tempDiv.style.top = '-9999px';
  tempDiv.style.width = '595px'; // A4 width in pixels at 72 DPI
  tempDiv.style.height = '842px'; // A4 height in pixels at 72 DPI
  tempDiv.style.backgroundColor = 'white';
  tempDiv.innerHTML = html;
  document.body.appendChild(tempDiv);

  try {
    // Generate PDF with correct A4 dimensions
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      hotfixes: ['px_scaling']
    });

    toast.loading("Generating PDF, please wait...");
    await new Promise(resolve => setTimeout(resolve, 800));

    const canvas = await html2canvas(tempDiv, {
      scale: 2.0, // Higher resolution
      useCORS: true,
      logging: false,
      allowTaint: true,
      backgroundColor: null, // Transparent background to let stationery show
      imageTimeout: 0,
      onclone: (clonedDoc) => {
        const style = clonedDoc.createElement('style');
        style.innerHTML = `
          @import url('https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;500;600;700&display=swap');
          body { margin: 0; padding: 0; }
          .stationery-background-image {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1;
          }
        `;
        clonedDoc.head.appendChild(style);
        
        // Ensure images are loaded and visible
        const imgs = clonedDoc.querySelectorAll('img');
        imgs.forEach(img => {
          img.style.visibility = 'visible';
          img.style.opacity = '1';
          const newImg = new Image();
          newImg.crossOrigin = "Anonymous";
          newImg.src = img.src;
        });
      }
    });

    // Add canvas to PDF at correct dimensions
    const imgData = canvas.toDataURL('image/png');
    doc.addImage(imgData, 'PNG', 0, 0, 210, 297); // A4 dimensions in mm (210x297)

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
    document.body.removeChild(tempDiv);
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
