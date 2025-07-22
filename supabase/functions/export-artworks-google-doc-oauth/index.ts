
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { findBestImageUrl } from "./image-url-validator.ts";
import { buildBatchRequests } from "./content-builder.ts";

const GOOGLE_API_URL = "https://docs.googleapis.com/v1/documents";

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
    console.log("=== ENHANCED EXPORT REQUEST START ===");
    console.log(`Received request with ${artworks?.length || 0} artworks, title: "${title}"`);
    
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
    console.log("Creating new document:", docTitle);

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
    console.log("Document created with ID:", documentId);

    // Load location data
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
        console.log(`Loaded ${locations.length} location names`);
      }
    }

    // Enhanced image processing with validation
    console.log("=== PROCESSING IMAGES ===");
    const imageResults = new Map();
    const imageStats = { total: 0, found: 0, validated: 0, failed: 0 };

    for (const artwork of artworks) {
      imageStats.total++;
      
      const primaryImage = artwork.artwork_images?.find(img => img.is_primary) || artwork.artwork_images?.[0];
      if (!primaryImage) {
        console.log(`No images found for artwork: ${artwork.title}`);
        imageStats.failed++;
        continue;
      }

      imageStats.found++;
      console.log(`\n--- Validating image for "${artwork.title}" ---`);
      
      try {
        const imageResult = await findBestImageUrl(primaryImage);
        if (imageResult) {
          imageResults.set(artwork.id, imageResult);
          imageStats.validated++;
          console.log(`✓ Valid image found for "${artwork.title}": ${imageResult.source}`);
        } else {
          imageStats.failed++;
          console.log(`✗ No valid image found for "${artwork.title}"`);
        }
      } catch (error) {
        imageStats.failed++;
        console.error(`Error processing image for "${artwork.title}":`, error);
      }
    }

    console.log("Image processing complete:", imageStats);

    // Build content with enhanced structure
    console.log("=== BUILDING DOCUMENT CONTENT ===");
    const batchRequests = buildBatchRequests(artworks, locationMap, imageResults);
    console.log(`Built ${batchRequests.length} batch requests`);

    // Execute batch update
    console.log("=== EXECUTING BATCH UPDATE ===");
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
    
    console.log("=== ENHANCED EXPORT COMPLETE ===");
    console.log("Document URL:", documentUrl);
    console.log("Image statistics:", imageStats);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        documentUrl,
        documentId,
        artworkCount: artworks.length,
        imageStats: {
          total: imageStats.total,
          successful: imageStats.validated,
          failed: imageStats.failed
        }
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Enhanced export error:", error);
    
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
