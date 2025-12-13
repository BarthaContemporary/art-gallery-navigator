
import { toast } from "sonner";
import { uploadDocument } from "./document-storage";
import { ensureDocumentsBucketExists } from "@/hooks/use-documents";
import { supabase } from "@/integrations/supabase/client";

interface PDFGenerationOptions {
  html: string;
  fileName: string;
  entityType: 'artwork' | 'collection';
  entityId: string;
  entityTitle: string;
  description?: string;
  pageSize?: 'a4' | 'letter' | 'legal';
  orientation?: 'portrait' | 'landscape';
  addPageNumbers?: boolean;
  addTimeStamp?: boolean;
  forceSplitPages?: boolean;
}

/**
 * Convert base64 string to Blob
 */
function base64ToBlob(base64: string, mimeType: string = 'application/pdf'): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Add timestamp to HTML if requested
 */
function addTimeStampToHTML(html: string): string {
  const timestamp = new Date().toLocaleString();
  const timestampHTML = `
    <div style="position: fixed; bottom: 5mm; left: 10mm; font-size: 8pt; color: #999;">
      Generated on: ${timestamp}
    </div>
  `;
  return html.replace('</body>', `${timestampHTML}</body>`);
}

/**
 * Generate PDF using PDFLayer API via edge function
 */
async function generatePDFViaPDFLayer(options: {
  html: string;
  fileName: string;
  pageSize: 'a4' | 'letter' | 'legal';
  orientation: 'portrait' | 'landscape';
}): Promise<Blob> {
  const { data, error } = await supabase.functions.invoke('generate-pdf', {
    body: {
      html: options.html,
      fileName: options.fileName,
      pageSize: options.pageSize,
      orientation: options.orientation,
    },
  });

  if (error) {
    console.error('Edge function error:', error);
    throw new Error(`PDF generation failed: ${error.message}`);
  }

  if (!data.success) {
    console.error('PDFLayer error:', data.error);
    throw new Error(data.error || 'PDF generation failed');
  }

  return base64ToBlob(data.pdf);
}

export async function generatePDFFromHTML({
  html,
  fileName,
  entityType,
  entityId,
  entityTitle,
  description,
  pageSize = 'a4',
  orientation = 'portrait',
  addPageNumbers = false,
  addTimeStamp = false,
}: PDFGenerationOptions): Promise<string> {
  console.log(`Generating PDF for ${entityType} "${entityTitle}"`);
  
  // Check storage availability
  try {
    const bucketExists = await ensureDocumentsBucketExists();
    if (!bucketExists) {
      console.warn("Document storage bucket issue - proceeding with attempt to upload anyway");
    }
  } catch (error) {
    console.error("Error checking document storage bucket:", error);
  }

  const toastId = toast.loading("Preparing PDF document...");

  try {
    // Prepare HTML with optional timestamp
    let processedHtml = html;
    if (addTimeStamp) {
      processedHtml = addTimeStampToHTML(processedHtml);
    }

    // Generate PDF via PDFLayer API
    toast.loading("Generating PDF...", { id: toastId });
    console.log("Calling PDFLayer API...");
    
    const pdfBlob = await generatePDFViaPDFLayer({
      html: processedHtml,
      fileName,
      pageSize,
      orientation,
    });
    
    console.log("PDF blob created, size:", Math.round(pdfBlob.size / 1024), "KB");

    // Upload document and create record
    toast.loading("Uploading PDF to storage...", { id: toastId });
    const publicUrl = await uploadDocument(pdfBlob, fileName, {
      type: entityType,
      entityId,
      entityTitle,
      description: description || `PDF for ${entityTitle}`
    });
    console.log("PDF uploaded successfully to:", publicUrl);

    // Create download link
    const downloadLink = document.createElement("a");
    downloadLink.href = URL.createObjectURL(pdfBlob);
    downloadLink.download = fileName;
    downloadLink.rel = "noopener noreferrer";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(downloadLink.href);

    toast.success("PDF generated successfully", { id: toastId });
    return publicUrl;

  } catch (error) {
    console.error("Error generating PDF document:", error);
    toast.error(
      error instanceof Error 
        ? `PDF generation failed: ${error.message}` 
        : "PDF generation failed for unknown reason", 
      { id: toastId }
    );
    throw error;
  }
}
