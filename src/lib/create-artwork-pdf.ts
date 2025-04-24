
import { Artwork } from "@/hooks/use-artworks";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ensureDocumentsBucketExists } from "@/hooks/use-documents";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { generateArtworkHTML } from './pdf/generateArtworkHTML';

export async function createArtworkPDF(
  artwork: Artwork,
  templateStyle: string = 'basic',
  useStationery: boolean = false
): Promise<string> {
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
    
    // Generate HTML content from template
    const htmlContent = generateArtworkHTML(artwork, templateStyle, useStationery);
    
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
    
    // Convert HTML to canvas with improved settings
    const canvas = await html2canvas(tempDiv, {
      scale: 2.0, // Higher quality rendering
      useCORS: true,
      logging: false,
      allowTaint: true,
      backgroundColor: null
    });
    
    // Remove the temporary div
    document.body.removeChild(tempDiv);
    
    // Add canvas to PDF with correct dimensions
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
    
    // Check if a document for this artwork already exists
    const { data: existingDocs } = await supabase
      .from("documents")
      .select("*")
      .eq("type", "artwork_datasheet")
      .eq("artwork_id", artwork.id)
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
          description: `Datasheet for ${artwork.title} (updated)`,
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
          type: "artwork_datasheet",
          artwork_id: artwork.id,
          description: `Datasheet for ${artwork.title}`,
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
    downloadLink.download = `${artwork.title}.pdf`;
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
