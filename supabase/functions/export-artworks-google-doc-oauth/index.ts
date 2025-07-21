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

    // Build all content requests at once to avoid index calculation issues
    const allRequests = [];
    let contentText = "";

    for (const artwork of artworks) {
      const artworkDetails = [
        `\n📋 ${artwork.title || 'Untitled'}\n`,
        `👤 Artist: ${artwork.artist_name || 'Unknown Artist'}`,
        artwork.year ? `📅 Year: ${artwork.year}` : '',
        artwork.medium_type ? `🎨 Medium: ${artwork.medium_type}` : '',
        artwork.materials ? `🔧 Materials: ${artwork.materials}` : '',
        artwork.dimensions ? `📏 Dimensions: ${artwork.dimensions}` : '',
        artwork.price && artwork.currency ? `💰 Price: ${artwork.currency} ${artwork.price}` : '',
        artwork.status ? `📊 Status: ${artwork.status}` : '',
        '\n'
      ].filter(Boolean).join('\n');

      contentText += artworkDetails;
      
      // Find primary image URL - look for a working image URL
      const primaryImage = artwork.artwork_images?.find(img => img.is_primary) || artwork.artwork_images?.[0];
      
      if (primaryImage) {
        let imageUrl = null;
        
        // Try different URL sources in order of preference
        // 1. Try medium_url if it's a complete HTTP URL and doesn't end with /processing
        if (primaryImage.medium_url && 
            primaryImage.medium_url.startsWith('http') && 
            !primaryImage.medium_url.endsWith('/processing')) {
          imageUrl = primaryImage.medium_url;
        }
        // 2. Try image_url if it's a complete HTTP URL and doesn't end with /processing
        else if (primaryImage.image_url && 
                 primaryImage.image_url.startsWith('http') && 
                 !primaryImage.image_url.endsWith('/processing')) {
          imageUrl = primaryImage.image_url;
        }
        // 3. Try thumbnail_url if it's a complete HTTP URL and doesn't end with /processing
        else if (primaryImage.thumbnail_url && 
                 primaryImage.thumbnail_url.startsWith('http') && 
                 !primaryImage.thumbnail_url.endsWith('/processing')) {
          imageUrl = primaryImage.thumbnail_url;
        }
        // 4. Try to construct Supabase storage URL from storage paths
        else if (primaryImage.medium_storage_path) {
          imageUrl = `https://cvhdspyugfcvkrufqzrq.supabase.co/storage/v1/object/public/artwork-images/${primaryImage.medium_storage_path}`;
        }
        else if (primaryImage.large_storage_path) {
          imageUrl = `https://cvhdspyugfcvkrufqzrq.supabase.co/storage/v1/object/public/artwork-images/${primaryImage.large_storage_path}`;
        }
        // 5. Last resort: construct from image_url if it looks like a path
        else if (primaryImage.image_url && !primaryImage.image_url.startsWith('http')) {
          imageUrl = `https://cvhdspyugfcvkrufqzrq.supabase.co/storage/v1/object/public/artwork-images/${primaryImage.image_url}`;
        }

        if (imageUrl) {
          console.log(`Found image for ${artwork.title}: ${imageUrl}`);
          
          // Add image after the text content
          allRequests.push({
            insertInlineImage: {
              location: { index: headerText.length + contentText.length + 1 },
              uri: imageUrl,
              objectSize: {
                height: { magnitude: 200, unit: "PT" },
                width: { magnitude: 200, unit: "PT" }
              }
            }
          });
        } else {
          console.log(`No valid image URL found for ${artwork.title}`);
        }
      }

      contentText += '─'.repeat(50) + '\n\n';
    }

    // Insert all artwork text content at once
    if (contentText) {
      console.log("=== ADDING CONTENT TEXT ===");
      console.log("Content text length:", contentText.length);
      console.log("Content preview:", contentText.substring(0, 200) + "...");
      
      allRequests.unshift({
        insertText: {
          location: { index: headerText.length + 1 },
          text: contentText
        }
      });
    }

    // Apply all content updates in one batch
    if (allRequests.length > 0) {
      console.log("=== APPLYING ALL REQUESTS ===");
      console.log(`Applying ${allRequests.length} content requests...`);
      console.log("All requests:", JSON.stringify(allRequests, null, 2));
      
      const contentResponse = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requests: allRequests })
      });

      console.log("Content response status:", contentResponse.status);
      
      if (!contentResponse.ok) {
        const errorText = await contentResponse.text();
        console.error("Failed to add content:", contentResponse.status, errorText);
        console.warn("Document created but content addition failed");
      } else {
        const contentResult = await contentResponse.json();
        console.log("Content response:", JSON.stringify(contentResult, null, 2));
        console.log("Successfully added all content to document");
      }
    } else {
      console.warn("No requests to apply - this shouldn't happen!");
    }

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