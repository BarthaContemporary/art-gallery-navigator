
import { toast } from "sonner";
import { convertEnhancedHTMLToPDF } from "./enhanced-html-to-pdf";
import { uploadDocument } from "./document-storage";
import { ensureDocumentsBucketExists } from "@/hooks/use-documents";

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
  addTimeStamp = false
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
  let progressMessage = "Preparing PDF document...";

  try {
    // Update progress callback
    const updateProgress = (message: string, percentage?: number) => {
      progressMessage = percentage ? `${message} (${Math.round(percentage)}%)` : message;
      toast.loading(progressMessage, { id: toastId });
      console.log(`PDF Generation Progress: ${progressMessage}`);
    };

    // Convert HTML to PDF using enhanced multi-page system
    updateProgress("Converting HTML to PDF...");
    const pdfBlob = await convertEnhancedHTMLToPDF({ 
      html, 
      fileName,
      pageSize,
      orientation,
      addPageNumbers,
      addTimeStamp,
      onProgress: updateProgress
    });
    
    console.log("PDF blob created, size:", Math.round(pdfBlob.size / 1024), "KB");

    // Upload document and create record
    updateProgress("Uploading PDF to storage...");
    const publicUrl = await uploadDocument(pdfBlob, fileName, {
      type: entityType,
      entityId,
      entityTitle,
      description: description || `PDF for ${entityTitle}`
    });
    console.log("PDF uploaded successfully to:", publicUrl);

    // Create download link
    updateProgress("Creating download link...");
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
