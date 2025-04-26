
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DocumentMetadata {
  type: 'artwork' | 'collection';
  entityId: string;
  entityTitle: string;
  description?: string;
}

export async function uploadDocument(
  blob: Blob,
  fileName: string,
  metadata: DocumentMetadata
): Promise<string> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    console.error("Authentication error:", sessionError || "No active session");
    throw new Error("Authentication required");
  }

  // Upload file
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("documents")
    .upload(fileName, blob, {
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

  // Update document record
  await updateDocumentRecord(metadata.type, metadata.entityId, fileName, publicUrl, metadata.description || `PDF for ${metadata.entityTitle}`);

  return publicUrl;
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
