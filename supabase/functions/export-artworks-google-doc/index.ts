
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { RequestBody } from "./types.ts";
import { getGoogleAccessToken } from "./google-auth.ts";
import { copyTemplateDocument, makeDocumentPublic, checkStorageQuota, cleanupOldDocuments } from "./google-drive-service.ts";
import { processDocumentContent } from "./document-processor.ts";

// Template document ID extracted from the URL
const TEMPLATE_DOCUMENT_ID = "1uHXsP9k-rkSGmfamNfS-LMy7hg6Xp_aMSPZVRkKtGpc";

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { artworks, title }: RequestBody = await req.json();
    
    if (!artworks || artworks.length === 0) {
      return new Response(
        JSON.stringify({ error: "No artworks provided" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get Google API credentials from environment
    const googleCredentials = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!googleCredentials) {
      console.error("Google API credentials not found in environment");
      return new Response(
        JSON.stringify({ error: "Google API credentials not configured. Please add GOOGLE_SERVICE_ACCOUNT_KEY to your Supabase secrets." }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    let credentials;
    try {
      credentials = JSON.parse(googleCredentials);
      console.log("Google credentials parsed successfully");
    } catch (error) {
      console.error("Failed to parse Google credentials:", error);
      return new Response(
        JSON.stringify({ error: "Invalid Google API credentials format" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    // Get access token
    console.log("Attempting to get Google access token...");
    const accessToken = await getGoogleAccessToken(credentials);
    console.log("Access token obtained successfully");
    
    // Check storage quota before proceeding
    console.log("Checking Google Drive storage quota...");
    const storageCheck = await checkStorageQuota(accessToken);
    
    if (!storageCheck.available) {
      console.log("Storage quota exceeded, attempting cleanup...");
      const deletedCount = await cleanupOldDocuments(accessToken, 30);
      console.log(`Cleaned up ${deletedCount} old documents`);
      
      // Check quota again after cleanup
      const postCleanupCheck = await checkStorageQuota(accessToken);
      if (!postCleanupCheck.available) {
        return new Response(
          JSON.stringify({ 
            error: "Google Drive storage quota exceeded. Please contact an administrator to upgrade the Google Workspace account or manually clean up old documents.",
            details: "The service has automatically removed some old exported documents, but more storage space is needed."
          }),
          { status: 507, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }
    
    // Copy the template document
    const docTitle = title || `Artwork List - ${new Date().toLocaleDateString()}`;
    console.log("Copying template document and creating new document with title:", docTitle);
    
    const documentId = await copyTemplateDocument(accessToken, TEMPLATE_DOCUMENT_ID, docTitle);
    console.log("Template document copied with new ID:", documentId);

    // Process document content with artworks
    await processDocumentContent(documentId, accessToken, artworks);

    // Make the document publicly viewable
    console.log("Making document publicly viewable...");
    await makeDocumentPublic(accessToken, documentId);

    const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;
    console.log("Document URL:", documentUrl);

    return new Response(
      JSON.stringify({ 
        success: true, 
        documentUrl,
        documentId,
        artworkCount: artworks.length
      }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );

  } catch (error: any) {
    console.error("Error creating artwork Google Doc:", error);
    
    // Provide more specific error messages to the user
    let userErrorMessage = error.message;
    let statusCode = 500;
    
    if (error.message.includes("storage quota exceeded")) {
      statusCode = 507;
      userErrorMessage = "Google Drive storage is full. Please contact an administrator to resolve this issue.";
    } else if (error.message.includes("Template document not found")) {
      statusCode = 404;
      userErrorMessage = "Export template is not properly configured. Please contact an administrator.";
    } else if (error.message.includes("Google API access forbidden")) {
      statusCode = 403;
      userErrorMessage = "Google API access is not properly configured. Please contact an administrator.";
    }
    
    return new Response(
      JSON.stringify({ 
        error: userErrorMessage,
        details: "Check the function logs for more information"
      }),
      { 
        status: statusCode, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  }
};

serve(handler);
