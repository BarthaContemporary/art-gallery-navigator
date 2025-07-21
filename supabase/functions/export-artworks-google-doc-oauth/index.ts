import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { artworks, title, accessToken } = await req.json();
    
    if (!accessToken) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "User access token required",
          errorType: "authentication_required"
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!artworks || artworks.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "No artworks provided",
          errorType: "validation_error"
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Template document ID
    const TEMPLATE_DOCUMENT_ID = "1uHXsP9k-rkSGmfamNfS-LMy7hg6Xp_aMSPZVRkKtGpc";
    
    const docTitle = title || `Artwork List - ${new Date().toLocaleDateString()}`;
    console.log("Creating document with user's Google account:", docTitle);

    // Copy template using user's access token
    const copyResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${TEMPLATE_DOCUMENT_ID}/copy`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: docTitle
      })
    });

    if (!copyResponse.ok) {
      const errorText = await copyResponse.text();
      console.error("Failed to copy template:", copyResponse.status, errorText);
      
      if (copyResponse.status === 401) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: "Google authentication expired. Please refresh and try again.",
            errorType: "authentication_expired"
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Failed to create document in your Google Drive",
          errorType: "document_creation_error",
          details: errorText
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const docData = await copyResponse.json();
    const documentId = docData.id;
    console.log("Document created with ID:", documentId);

    // Add artwork content to the document
    const requests = [];
    let index = 1; // Start after the placeholder text

    for (const artwork of artworks) {
      const artworkText = [
        `Title: ${artwork.title || 'Untitled'}`,
        `Artist: ${artwork.artist_name || 'Unknown Artist'}`,
        artwork.year ? `Year: ${artwork.year}` : '',
        artwork.medium_type ? `Medium: ${artwork.medium_type}` : '',
        artwork.materials ? `Materials: ${artwork.materials}` : '',
        artwork.dimensions ? `Dimensions: ${artwork.dimensions}` : '',
        artwork.price && artwork.currency ? `Price: ${artwork.currency} ${artwork.price}` : '',
        artwork.status ? `Status: ${artwork.status}` : '',
        '\n---\n\n'
      ].filter(Boolean).join('\n');

      requests.push({
        insertText: {
          location: { index },
          text: artworkText
        }
      });

      index += artworkText.length;
    }

    // Apply content updates
    if (requests.length > 0) {
      const updateResponse = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requests })
      });

      if (!updateResponse.ok) {
        console.warn("Failed to add content, but document was created");
      } else {
        console.log("Content added successfully");
      }
    }

    const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        documentUrl,
        documentId,
        artworkCount: artworks.length
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Export error:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: "Unexpected error during export",
        errorType: "unexpected_error",
        details: error.message
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);