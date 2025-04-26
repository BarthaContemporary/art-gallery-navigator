
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
  // Check storage availability
  const bucketExists = await ensureDocumentsBucketExists();
  if (!bucketExists) {
    console.warn("Document storage bucket issue - proceeding with attempt to upload anyway");
  }

  toast.loading("Preparing PDF document...");

  try {
    // Convert HTML to PDF
    const pdfBlob = await convertHTMLToPDF({ html, fileName });

    // Upload document and create record
    const publicUrl = await uploadDocument(pdfBlob, fileName, {
      type: entityType,
      entityId,
      entityTitle,
      description
    });

    // Create download link
    const downloadLink = document.createElement("a");
    downloadLink.href = URL.createObjectURL(pdfBlob);
    downloadLink.download = `${entityTitle}.pdf`;
    downloadLink.rel = "noopener noreferrer";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(downloadLink.href);

    toast.success("Document ready for download");
    return publicUrl;

  } catch (error) {
    console.error("Error generating document:", error);
    if (error instanceof Error) {
      toast.error("Failed to generate document: " + error.message);
    }
    throw error;
  }
}
