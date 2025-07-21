
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
    console.log("=== Export Request Started ===");
    const { artworks, title }: RequestBody = await req.json();
    console.log(`Processing export request for ${artworks?.length || 0} artworks with title: "${title}"`);
    
    if (!artworks || artworks.length === 0) {
      console.error("No artworks provided in request");
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "No artworks provided",
          errorType: "validation_error"
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get Google API credentials from environment
    console.log("Checking Google API credentials...");
    const googleCredentials = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!googleCredentials) {
      console.error("Google API credentials not found in environment");
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Google API credentials not configured. Please add GOOGLE_SERVICE_ACCOUNT_KEY to your Supabase secrets.",
          errorType: "configuration_error"
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    let credentials;
    try {
      credentials = JSON.parse(googleCredentials);
      console.log("Google credentials parsed successfully");
    } catch (error) {
      console.error("Failed to parse Google credentials:", error);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Invalid Google API credentials format",
          errorType: "configuration_error"
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    // Get access token
    console.log("Attempting to get Google access token...");
    let accessToken;
    try {
      accessToken = await getGoogleAccessToken(credentials);
      console.log("Access token obtained successfully");
    } catch (error) {
      console.error("Failed to get access token:", error);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Failed to authenticate with Google API. Please check the service account configuration.",
          errorType: "authentication_error",
          details: error.message
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    // Check storage quota before proceeding
    console.log("Checking Google Drive storage quota...");
    const storageCheck = await checkStorageQuota(accessToken);
    console.log("Storage check result:", storageCheck);
    
    if (!storageCheck.available) {
      console.log("Storage quota exceeded, attempting cleanup...");
      const deletedCount = await cleanupOldDocuments(accessToken, 30);
      console.log(`Cleaned up ${deletedCount} old documents`);
      
      // Check quota again after cleanup
      const postCleanupCheck = await checkStorageQuota(accessToken);
      console.log("Post-cleanup storage check:", postCleanupCheck);
      
      if (!postCleanupCheck.available) {
        console.error("Storage quota still exceeded after cleanup");
        return new Response(
          JSON.stringify({ 
            success: false,
            error: "Google Drive storage quota exceeded. The system attempted to clean up old documents, but more storage space is needed. Please contact an administrator to upgrade the Google Workspace account or manually clean up old documents.",
            errorType: "storage_quota_exceeded",
            details: "Automatic cleanup performed but insufficient space remains"
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }
    
    // Copy the template document
    const docTitle = title || `Artwork List - ${new Date().toLocaleDateString()}`;
    console.log("Copying template document and creating new document with title:", docTitle);
    
    let documentId;
    try {
      documentId = await copyTemplateDocument(accessToken, TEMPLATE_DOCUMENT_ID, docTitle);
      console.log("Template document copied with new ID:", documentId);
    } catch (error) {
      console.error("Failed to copy template document:", error);
      
      // Check if it's a storage quota error
      if (error.message && error.message.includes("storage quota exceeded")) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: "Google Drive storage quota has been exceeded. Please contact an administrator to upgrade the Google Workspace account or clean up old documents.",
            errorType: "storage_quota_exceeded",
            details: error.message
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Failed to create document from template. This may be due to permissions or template access issues.",
          errorType: "document_creation_error",
          details: error.message
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Process document content with artworks
    try {
      console.log("Processing document content with artworks...");
      await processDocumentContent(documentId, accessToken, artworks);
      console.log("Document content processed successfully");
    } catch (error) {
      console.error("Failed to process document content:", error);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Failed to add artwork content to the document. The document was created but content could not be added.",
          errorType: "content_processing_error",
          details: error.message,
          documentId: documentId
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Make the document publicly viewable
    try {
      console.log("Making document publicly viewable...");
      await makeDocumentPublic(accessToken, documentId);
      console.log("Document made publicly viewable");
    } catch (error) {
      console.warn("Failed to make document public (proceeding anyway):", error);
    }

    const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;
    console.log("Export completed successfully. Document URL:", documentUrl);
    console.log("=== Export Request Completed Successfully ===");

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
    console.error("=== Export Request Failed ===");
    console.error("Unexpected error in export handler:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: "An unexpected error occurred during export. Please try again or contact support if the issue persists.",
        errorType: "unexpected_error",
        details: error.message || "Unknown error"
      }),
      { 
        status: 200, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    );
  }
};

serve(handler);
