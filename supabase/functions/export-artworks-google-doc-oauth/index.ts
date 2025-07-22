import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { artworks, title, accessToken } = await req.json();
    console.log("=== EXPORT REQUEST START ===");
    console.log(`Received request with ${artworks?.length || 0} artworks, title: "${title}"`);
    console.log("Access token received:", accessToken ? "YES" : "NO");
    
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

    // Create a new document instead of copying a template
    const docTitle = title || `Artwork List - ${new Date().toLocaleDateString()}`;
    console.log("Creating new document in user's Google Drive:", docTitle);

    // Create a new blank document
    const createResponse = await fetch("https://docs.googleapis.com/v1/documents", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: docTitle
      })
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("Failed to create document:", createResponse.status, errorText);
      
      if (createResponse.status === 401) {
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

    const docData = await createResponse.json();
    const documentId = docData.documentId;
    console.log("=== DOCUMENT CREATED ===");
    console.log("Document ID:", documentId);
    console.log("Full document response:", JSON.stringify(docData, null, 2));

    // Add header content first
    const headerText = `${docTitle}\n\nArtwork Details\n${'='.repeat(50)}\n\n`;
    const headerRequests = [
      {
        insertText: {
          location: { index: 1 },
          text: headerText
        }
      },
      {
        updateTextStyle: {
          range: {
            startIndex: 1,
            endIndex: docTitle.length + 1
          },
          textStyle: {
            bold: true,
            fontSize: { magnitude: 16, unit: "PT" }
          },
          fields: "bold,fontSize"
        }
      }
    ];

    // Apply header formatting
    console.log("=== ADDING HEADER ===");
    console.log("Header requests:", JSON.stringify(headerRequests, null, 2));
    
    const headerResponse = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requests: headerRequests })
    });

    console.log("Header response status:", headerResponse.status);
    if (!headerResponse.ok) {
      const headerError = await headerResponse.text();
      console.error("Header response error:", headerError);
      console.warn("Failed to add header, but continuing with content");
    } else {
      console.log("Header added successfully");
    }

    console.log("=== PROCESSING ARTWORKS ===");
    console.log(`Processing ${artworks.length} artworks...`);
    console.log("First artwork details:", JSON.stringify(artworks[0], null, 2));

    // Build all text content
    let contentText = "";

    for (let i = 0; i < artworks.length; i++) {
      const artwork = artworks[i];
      const artworkAny = artwork as any;
      let artworkContent = `${i + 1}. `;
      
      // 1. URL to public image of the artwork as HTML - use primary_image_url if available
      let imageUrl = null;
      if (artworkAny.primary_image_url) {
        imageUrl = artworkAny.primary_image_url;
      } else {
        // Fallback to finding image from artwork_images array
        const primaryImage = artwork.artwork_images?.find(img => img.is_primary) || artwork.artwork_images?.[0];
        if (primaryImage) {
          // Try different URL sources in order of preference, using correct bucket
          if (primaryImage.medium_storage_path) {
            imageUrl = `https://cvhdspyugfcvkrufqzrq.supabase.co/storage/v1/object/public/artwork-images-processed/${primaryImage.medium_storage_path}`;
          }
          else if (primaryImage.large_storage_path) {
            imageUrl = `https://cvhdspyugfcvkrufqzrq.supabase.co/storage/v1/object/public/artwork-images-processed/${primaryImage.large_storage_path}`;
          }
          else if (primaryImage.thumbnail_storage_path) {
            imageUrl = `https://cvhdspyugfcvkrufqzrq.supabase.co/storage/v1/object/public/artwork-images-processed/${primaryImage.thumbnail_storage_path}`;
          }
        }
      }
      
      if (imageUrl) {
        artworkContent += `<a href="${imageUrl}">${imageUrl}</a>\n`;
        console.log(`Found image for ${artwork.title}: ${imageUrl}`);
      }
      
      // 2. Artist Name
      if (artwork.artist_name && artwork.artist_name.trim() !== '') {
        artworkContent += `${artwork.artist_name}\n`;
      } else {
        artworkContent += "Artist information not available\n";
      }
      
      // 3. Title + Year (on same line)
      const title = artwork.title || "Untitled";
      const year = artwork.year ? `, ${artwork.year}` : "";
      artworkContent += `${title}${year}\n`;
      
      // 4. Materials
      if (artwork.materials) {
        artworkContent += `${artwork.materials}\n`;
      }
      
      // 5. Dimensions
      if (artwork.dimensions) {
        artworkContent += `${artwork.dimensions}\n`;
      }
      
      // 6. Framed Dimensions
      if (artworkAny.frame_width && artworkAny.frame_height) {
        let framedDimensions = `${artworkAny.frame_width} x ${artworkAny.frame_height}`;
        if (artworkAny.frame_depth) {
          framedDimensions += ` x ${artworkAny.frame_depth}`;
        }
        artworkContent += `Framed: ${framedDimensions} cm\n`;
      }
      
      // 7. AI Description (if available)
      if (artworkAny.ai_description) {
        artworkContent += `AI Description: ${artworkAny.ai_description}\n`;
      }
      
      // 8. Current Location - ensure we get location name, not ID
      if (artworkAny.location_name) {
        artworkContent += `Location: ${artworkAny.location_name}\n`;
      }

      contentText += artworkContent + '\n';
    }

    // Step 1: Insert all text content first
    if (contentText) {
      console.log("=== ADDING CONTENT TEXT ===");
      console.log("Content text length:", contentText.length);
      console.log("Content preview:", contentText.substring(0, 200) + "...");
      
      const textRequest = [{
        insertText: {
          location: { index: headerText.length + 1 },
          text: contentText
        }
      }];

      const contentResponse = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requests: textRequest })
      });

      console.log("Content response status:", contentResponse.status);
      
      if (!contentResponse.ok) {
        const errorText = await contentResponse.text();
        console.error("Failed to add text content:", contentResponse.status, errorText);
        console.warn("Document created but text content addition failed");
      } else {
        const contentResult = await contentResponse.json();
        console.log("Text content added successfully");
        console.log("Content response:", JSON.stringify(contentResult, null, 2));
      }
    } else {
      console.warn("No text content to add - this shouldn't happen!");
    }

    // Images are included as HTML links in the text content above

    const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;
    
    console.log("=== EXPORT COMPLETE ===");
    console.log("Final document URL:", documentUrl);
    
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