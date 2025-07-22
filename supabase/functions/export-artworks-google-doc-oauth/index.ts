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

    // Build all text content first
    let allTextContent = "";
    const imageInsertions: { index: number; url: string; title: string }[] = [];
    
    for (let i = 0; i < artworks.length; i++) {
      const artwork = artworks[i];
      const artworkAny = artwork as any;
      
      // Build artwork text content
      let artworkContent = `${i + 1}. `;
      
      // Track where to insert image (after the artwork number)
      const imageInsertionIndex = allTextContent.length + artworkContent.length + 1; // +1 for document start
      
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
      
      // 5. Price
      if (artwork.price && artwork.currency) {
        const formattedPrice = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: artwork.currency,
          minimumFractionDigits: 0
        }).format(artwork.price);
        artworkContent += `Price: ${formattedPrice}\n`;
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
      
      // 8. Current Location
      if (artwork.location_id) {
        const locationName = locationMap.get(artwork.location_id) || 'Unknown Location';
        artworkContent += `Location: ${locationName}\n`;
      }

      // Find image URL for later insertion
      const primaryImage = artwork.artwork_images?.find(img => img.is_primary) || artwork.artwork_images?.[0];
      let imageUrl = null;
      
      if (primaryImage) {
        console.log(`Processing image for ${title}:`, {
          primary_image_url: artworkAny.primary_image_url,
          medium_storage_path: primaryImage.medium_storage_path,
          large_storage_path: primaryImage.large_storage_path,
          thumbnail_storage_path: primaryImage.thumbnail_storage_path
        });
        
        // Try multiple approaches in priority order
        const candidates = [
          // Try the primary storage paths in the main public bucket
          primaryImage.medium_storage_path ? `https://cvhdspyugfcvkrufqzrq.supabase.co/storage/v1/object/public/artwork-images/${primaryImage.medium_storage_path}` : null,
          primaryImage.large_storage_path ? `https://cvhdspyugfcvkrufqzrq.supabase.co/storage/v1/object/public/artwork-images/${primaryImage.large_storage_path}` : null,
          primaryImage.thumbnail_storage_path ? `https://cvhdspyugfcvkrufqzrq.supabase.co/storage/v1/object/public/artwork-images/${primaryImage.thumbnail_storage_path}` : null,
          // Try the primary_image_url if it exists and looks valid
          (artworkAny.primary_image_url && artworkAny.primary_image_url.startsWith('http') && !artworkAny.primary_image_url.includes('processing')) ? artworkAny.primary_image_url : null
        ].filter(Boolean);
        
        imageUrl = candidates[0] || null;
        console.log(`Selected image URL for ${title}: ${imageUrl}`);
      }
      
      if (imageUrl) {
        imageInsertions.push({
          index: imageInsertionIndex,
          url: imageUrl,
          title: title
        });
        artworkContent += "\n"; // Space where image will be inserted
        console.log(`Will insert image for ${title} at index ${imageInsertionIndex}: ${imageUrl}`);
      }
      
      allTextContent += artworkContent;
      
      // Add spacing between artworks
      if (i < artworks.length - 1) {
        allTextContent += '\n\n';
      }
    }

    // Step 1: Insert all text content first
    console.log("=== INSERTING TEXT CONTENT ===");
    console.log("Text content length:", allTextContent.length);
    
    const textResponse = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [{
          insertText: {
            location: { index: 1 },
            text: allTextContent
          }
        }]
      })
    });

    if (!textResponse.ok) {
      const errorText = await textResponse.text();
      console.error("Failed to insert text:", errorText);
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Failed to add text content to document",
          details: errorText
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }
    
    console.log("Text content inserted successfully");

    // Step 2: Insert images individually (continue even if some fail)
    console.log("=== INSERTING IMAGES ===");
    console.log(`Found ${imageInsertions.length} images to insert`);
    
    let successfulImages = 0;
    for (const imageData of imageInsertions) {
      try {
        console.log(`Attempting to insert image for "${imageData.title}" at index ${imageData.index}`);
        
        const imageResponse = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requests: [{
              insertInlineImage: {
                location: { index: imageData.index },
                uri: imageData.url,
                objectSize: {
                  height: { magnitude: 113.4, unit: "PT" },
                  width: { magnitude: 113.4, unit: "PT" }
                }
              }
            }]
          })
        });
        
        if (imageResponse.ok) {
          console.log(`Successfully inserted image for "${imageData.title}"`);
          successfulImages++;
        } else {
          const errorText = await imageResponse.text();
          console.warn(`Failed to insert image for "${imageData.title}": ${errorText}`);
        }
        
      } catch (error) {
        console.warn(`Error inserting image for "${imageData.title}":`, error);
      }
    }
    
    console.log(`Successfully inserted ${successfulImages}/${imageInsertions.length} images`);

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