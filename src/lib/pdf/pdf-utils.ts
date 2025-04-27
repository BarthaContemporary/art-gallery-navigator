
import { toast } from "sonner";
import { convertHTMLToPDF } from "./html-to-pdf";
import { uploadDocument } from "./document-storage";
import { ensureDocumentsBucketExists } from "@/hooks/use-documents";

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
  console.log(`Generating PDF for ${entityType} "${entityTitle}"`);
  
  // Check storage availability
  const bucketExists = await ensureDocumentsBucketExists();
  if (!bucketExists) {
    console.warn("Document storage bucket issue - proceeding with attempt to upload anyway");
  }

  const toastId = toast.loading("Preparing PDF document...");

  try {
    // Convert HTML to PDF
    console.log("Converting HTML to PDF");
    const pdfBlob = await convertHTMLToPDF({ html, fileName });
    console.log("PDF blob created, size:", Math.round(pdfBlob.size / 1024), "KB");

    // Upload document and create record
    console.log("Uploading PDF to storage");
    const publicUrl = await uploadDocument(pdfBlob, fileName, {
      type: entityType,
      entityId,
      entityTitle,
      description
    });
    console.log("PDF uploaded successfully to:", publicUrl);

    // Create download link
    console.log("Creating download link for user");
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
