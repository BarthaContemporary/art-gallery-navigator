import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

const GOOGLE_API_URL = "https://docs.googleapis.com/v1/documents";

async function insertImageAtIndex(documentId: string, accessToken: string, index: number, imageUrl: string) {
  // Convert 4cm to points (1 cm = 28.35 points)
  const maxHeightPoints = 4 * 28.35;
  
  const response = await fetch(`${GOOGLE_API_URL}/${documentId}:batchUpdate`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          insertInlineImage: {
            location: { index },
            uri: imageUrl,
            objectSize: {
              height: {
                magnitude: maxHeightPoints,
                unit: "PT"
              },
              width: {
                magnitude: maxHeightPoints, // Will be adjusted proportionally by Google Docs
                unit: "PT"
              }
            }
          }
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to insert image: ${response.status} - ${errorText}`);
  }
}

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

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

    // Skip adding header - user doesn't want it

    console.log("=== PROCESSING ARTWORKS ===");
    console.log(`Processing ${artworks.length} artworks...`);
    console.log("First artwork details:", JSON.stringify(artworks[0], null, 2));

    // Get unique location IDs for batch lookup
    const locationIds = [...new Set(artworks.map(artwork => artwork.location_id).filter(Boolean))];
    const locationMap = new Map();
    
    if (locationIds.length > 0) {
      const { data: locations, error: locationError } = await supabase
        .from('locations')
        .select('id, name')
        .in('id', locationIds);
      
      if (locationError) {
        console.warn('Failed to fetch locations:', locationError);
      } else if (locations) {
        locations.forEach(location => {
          locationMap.set(location.id, location.name);
        });
        console.log('Loaded location names:', locationMap);
      }
    }

    // Build all content and image requests in proper sequence
    const allRequests: any[] = [];
    let currentIndex = 1; // Start after the initial paragraph

    for (let i = 0; i < artworks.length; i++) {
      const artwork = artworks[i];
      const artworkAny = artwork as any;
      
      // Build artwork text content
      let artworkContent = `${i + 1}. `;
      
      // 1. Artist Name
      if (artwork.artist_name && artwork.artist_name.trim() !== '') {
        artworkContent += `${artwork.artist_name}\n`;
      } else {
        artworkContent += "Artist information not available\n";
      }
      
      // 2. Title + Year (on same line)
      const title = artwork.title || "Untitled";
      const year = artwork.year ? `, ${artwork.year}` : "";
      artworkContent += `${title}${year}\n`;
      
      // 3. Materials
      if (artwork.materials) {
        artworkContent += `${artwork.materials}\n`;
      }
      
      // 4. Dimensions
      if (artwork.dimensions) {
        artworkContent += `${artwork.dimensions}\n`;
      }
      
      // 5. Framed Dimensions
      if (artworkAny.frame_width && artworkAny.frame_height) {
        let framedDimensions = `${artworkAny.frame_width} x ${artworkAny.frame_height}`;
        if (artworkAny.frame_depth) {
          framedDimensions += ` x ${artworkAny.frame_depth}`;
        }
        artworkContent += `Framed: ${framedDimensions} cm\n`;
      }
      
      // 6. AI Description (if available)
      if (artworkAny.ai_description) {
        artworkContent += `AI Description: ${artworkAny.ai_description}\n`;
      }
      
      // 7. Current Location
      if (artwork.location_id) {
        const locationName = locationMap.get(artwork.location_id) || 'Unknown Location';
        artworkContent += `Location: ${locationName}\n`;
      }

      // Add text content request
      allRequests.push({
        insertText: {
          location: { index: currentIndex },
          text: artworkContent
        }
      });
      
      currentIndex += artworkContent.length;

      // Find and insert image immediately after text
      const primaryImage = artwork.artwork_images?.find(img => img.is_primary) || artwork.artwork_images?.[0];
      let imageUrl = null;
      
      if (primaryImage) {
        // Use the correct public bucket - try storage paths first
        if (primaryImage.medium_storage_path) {
          imageUrl = `https://cvhdspyugfcvkrufqzrq.supabase.co/storage/v1/object/public/artwork-images/${primaryImage.medium_storage_path}`;
        }
        else if (primaryImage.large_storage_path) {
          imageUrl = `https://cvhdspyugfcvkrufqzrq.supabase.co/storage/v1/object/public/artwork-images/${primaryImage.large_storage_path}`;
        }
        else if (primaryImage.thumbnail_storage_path) {
          imageUrl = `https://cvhdspyugfcvkrufqzrq.supabase.co/storage/v1/object/public/artwork-images/${primaryImage.thumbnail_storage_path}`;
        }
      }
      
      if (imageUrl) {
        console.log(`Adding image for ${artwork.title}: ${imageUrl} at index ${currentIndex}`);
        
        // Add image insertion request
        allRequests.push({
          insertInlineImage: {
            location: { index: currentIndex },
            uri: imageUrl,
            objectSize: {
              height: {
                magnitude: 113.4, // 4cm in points (4 * 28.35)
                unit: "PT"
              },
              width: {
                magnitude: 113.4, // Will be adjusted proportionally by Google Docs
                unit: "PT"
              }
            }
          }
        });
        
        currentIndex += 1; // Images take 1 character space
      }
      
      // Add spacing between artworks
      if (i < artworks.length - 1) {
        allRequests.push({
          insertText: {
            location: { index: currentIndex },
            text: '\n\n'
          }
        });
        currentIndex += 2;
      }
    }

    // Execute all requests at once
    if (allRequests.length > 0) {
      console.log("=== EXECUTING ALL REQUESTS ===");
      console.log(`Executing ${allRequests.length} requests`);
      
      const batchResponse = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requests: allRequests })
      });

      console.log("Batch response status:", batchResponse.status);
      
      if (!batchResponse.ok) {
        const errorText = await batchResponse.text();
        console.error("Failed to execute batch requests:", batchResponse.status, errorText);
        
        return new Response(
          JSON.stringify({ 
            success: false,
            error: "Failed to add content to document",
            details: errorText
          }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      } else {
        const batchResult = await batchResponse.json();
        console.log("All requests executed successfully");
        console.log("Batch response:", JSON.stringify(batchResult, null, 2));
      }
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