
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DocumentMetadata {
  type: 'artwork' | 'collection';
  entityId: string;
  entityTitle: string;
  description?: string;
}

/**
 * Uploads a document to storage and creates a database record
 */
export async function uploadDocument(
  blob: Blob,
  fileName: string,
  metadata: DocumentMetadata
): Promise<string> {
  console.log(`Uploading document: ${fileName} for ${metadata.type} ${metadata.entityId}`);
  
  // Check authentication
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    console.error("Authentication error:", sessionError || "No active session");
    throw new Error("Authentication required to upload documents");
  }

  try {
    // Upload file
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, blob, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (uploadError) {
      console.error("Error uploading document:", uploadError);
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from("documents")
      .getPublicUrl(fileName);
    
    console.log("Document uploaded successfully with URL:", publicUrl);

    // Update document record
    await updateDocumentRecord(metadata.type, metadata.entityId, fileName, publicUrl, metadata.description || `PDF for ${metadata.entityTitle}`);

    return publicUrl;
  } catch (error) {
    console.error("Error in document upload process:", error);
    throw error;
  }
}

/**
 * Updates or creates a document record in the database
 */
async function updateDocumentRecord(
  type: 'artwork' | 'collection',
  entityId: string,
  fileName: string,
  fileUrl: string,
  description: string
) {
  console.log(`Updating document record for: ${fileName}`);
  
  const documentType = type === 'artwork' ? 'artwork_datasheet' : 'collection_overview';
  const entityField = type === 'artwork' ? 'artwork_id' : 'collection_id';

  try {
    // Check for existing document
    const { data: existingDocs, error: fetchError } = await supabase
      .from("documents")
      .select("*")
      .eq("type", documentType)
      .eq(entityField, entityId)
      .order("date_uploaded", { ascending: false })
      .limit(1);
    
    if (fetchError) {
      console.error("Error fetching existing document records:", fetchError);
      throw fetchError;
    }

    if (existingDocs && existingDocs.length > 0) {
      // Update existing record
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
        toast.error("Failed to update document record");
        throw updateError;
      }
      
      console.log("Document record updated successfully");
    } else {
      // Create new record
      const { error: createError } = await supabase
        .from("documents")
        .insert({
          file_name: fileName,
          file_url: fileUrl,
          type: documentType,
          [entityField]: entityId,
          description: description,
          date_uploaded: new Date().toISOString()
        });

      if (createError) {
        console.error("Error creating document record:", createError);
        toast.error("Failed to create document record");
        throw createError;
      }
      
      console.log("Document record created successfully");
    }
  } catch (error) {
    console.error("Error in document record update/creation:", error);
    // Don't throw here to avoid blocking PDF generation if only the record fails
  }
}
