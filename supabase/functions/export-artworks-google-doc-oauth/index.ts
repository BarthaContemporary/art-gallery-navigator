
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";

const GOOGLE_API_URL = "https://docs.googleapis.com/v1/documents";

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function validateImageUrl(url: string): Promise<boolean> {
  try {
    if (!url || url === '/placeholder.svg' || url.includes('processing')) {
      return false;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    console.log(`URL validation for ${url}: ${response.status} ${response.ok ? 'OK' : 'FAILED'}`);
    
    return response.ok;
  } catch (error) {
    console.warn(`Failed to validate URL ${url}:`, error.message);
    return false;
  }
}

function selectBestImageUrl(imageRecord: any): string | null {
  console.log('Selecting best image URL from:', {
    id: imageRecord.id,
    image_url: imageRecord.image_url,
    medium_url: imageRecord.medium_url,
    thumbnail_url: imageRecord.thumbnail_url,
    medium_storage_path: imageRecord.medium_storage_path
  });

  // Priority 1: Cloudinary URLs (most reliable for Google Docs)
  const cloudinaryUrls = [
    imageRecord.image_url,
    imageRecord.medium_url,
    imageRecord.thumbnail_url
  ].filter(url => url && typeof url === 'string' && url.includes('cloudinary.com') && !url.includes('processing'));

  if (cloudinaryUrls.length > 0) {
    console.log('Using Cloudinary URL:', cloudinaryUrls[0]);
    return cloudinaryUrls[0];
  }

  // Priority 2: Supabase processed storage URLs (public bucket)
  if (imageRecord.medium_storage_path) {
    const processedUrl = `https://cvhdspyugfcvkrufqzrq.supabase.co/storage/v1/object/public/artwork-images-processed/${imageRecord.medium_storage_path}`;
    console.log('Using processed storage URL:', processedUrl);
    return processedUrl;
  }

  // Priority 3: Other storage paths as fallback
  if (imageRecord.large_storage_path) {
    const largeUrl = `https://cvhdspyugfcvkrufqzrq.supabase.co/storage/v1/object/public/artwork-images-processed/${imageRecord.large_storage_path}`;
    console.log('Using large storage URL:', largeUrl);
    return largeUrl;
  }

  console.warn('No suitable image URL found for image record:', imageRecord.id);
  return null;
}

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

    // Create a new document
    const docTitle = title || `Artwork List - ${new Date().toLocaleDateString()}`;
    console.log("Creating new document in user's Google Drive:", docTitle);

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

    console.log("=== PROCESSING ARTWORKS ===");
    console.log(`Processing ${artworks.length} artworks...`);

    // Build batch requests for all content at once
    const batchRequests = [];
    let currentIndex = 1; // Start after the default paragraph

    for (let i = 0; i < artworks.length; i++) {
      const artwork = artworks[i];
      const artworkAny = artwork as any;
      
      console.log(`\n--- Processing artwork ${i + 1}: "${artwork.title}" ---`);

      // Find the best image URL
      const primaryImage = artwork.artwork_images?.find(img => img.is_primary) || artwork.artwork_images?.[0];
      let selectedImageUrl = null;
      let imageValidated = false;

      if (primaryImage) {
        selectedImageUrl = selectBestImageUrl(primaryImage);
        
        if (selectedImageUrl) {
          console.log(`Validating selected image URL: ${selectedImageUrl}`);
          imageValidated = await validateImageUrl(selectedImageUrl);
          console.log(`Image validation result: ${imageValidated ? 'VALID' : 'INVALID'}`);
        }
      }

      // Build artwork text content
      let artworkText = "";
      
      // Artist Name
      if (artwork.artist_name && artwork.artist_name.trim() !== '') {
        artworkText += `${artwork.artist_name}\n`;
      } else {
        artworkText += "Artist information not available\n";
      }
      
      // Title + Year
      const title = artwork.title || "Untitled";
      const year = artwork.year ? `, ${artwork.year}` : "";
      artworkText += `${title}${year}\n`;
      
      // Materials
      if (artwork.materials) {
        artworkText += `${artwork.materials}\n`;
      }
      
      // Dimensions
      if (artwork.dimensions) {
        artworkText += `${artwork.dimensions}\n`;
      }
      
      // Price
      if (artwork.price && artwork.currency) {
        const formattedPrice = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: artwork.currency,
          minimumFractionDigits: 0
        }).format(artwork.price);
        artworkText += `Price: ${formattedPrice}\n`;
      }
      
      // Framed Dimensions
      if (artworkAny.frame_width && artworkAny.frame_height) {
        let framedDimensions = `${artworkAny.frame_width} x ${artworkAny.frame_height}`;
        if (artworkAny.frame_depth) {
          framedDimensions += ` x ${artworkAny.frame_depth}`;
        }
        artworkText += `Framed: ${framedDimensions} cm\n`;
      }
      
      // AI Description
      if (artworkAny.ai_description) {
        artworkText += `AI Description: ${artworkAny.ai_description}\n`;
      }
      
      // Location
      if (artwork.location_id) {
        const locationName = locationMap.get(artwork.location_id) || 'Unknown Location';
        artworkText += `Location: ${locationName}\n`;
      }

      // Add the text first
      batchRequests.push({
        insertText: {
          location: { index: currentIndex },
          text: artworkText
        }
      });
      
      currentIndex += artworkText.length;

      // Add image if valid
      if (selectedImageUrl && imageValidated) {
        console.log(`Adding image request for "${artwork.title}" at index ${currentIndex}`);
        
        batchRequests.push({
          insertText: {
            location: { index: currentIndex },
            text: "\n"
          }
        });
        currentIndex += 1;

        batchRequests.push({
          insertInlineImage: {
            location: { index: currentIndex },
            uri: selectedImageUrl,
            objectSize: {
              height: { magnitude: 200, unit: "PT" },
              width: { magnitude: 200, unit: "PT" }
            }
          }
        });
        currentIndex += 1;
      } else {
        console.warn(`Skipping image for "${artwork.title}" - no valid URL found`);
      }

      // Add spacing between artworks (except for the last one)
      if (i < artworks.length - 1) {
        batchRequests.push({
          insertText: {
            location: { index: currentIndex },
            text: "\n\n"
          }
        });
        currentIndex += 2;
      }
    }

    console.log("\n=== EXECUTING BATCH UPDATE ===");
    console.log(`Total batch requests: ${batchRequests.length}`);

    // Execute the batch update
    const batchResponse = await fetch(`${GOOGLE_API_URL}/${documentId}:batchUpdate`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: batchRequests
      })
    });

    if (!batchResponse.ok) {
      const errorText = await batchResponse.text();
      console.error("Batch update failed:", errorText);
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: "Failed to add content to document",
          errorType: "content_processing_error",
          details: errorText
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const batchResult = await batchResponse.json();
    console.log("Batch update completed successfully");

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
