import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLOUDINARY_CLOUD_NAME = Deno.env.get('CLOUDINARY_CLOUD_NAME') || 'demo';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface ProcessRequest {
  image_id: string;
  original_url: string;
  artwork_id: string;
}

interface ProcessedUrls {
  small_url: string;
  medium_url: string;
  large_url: string;
}

// Generate Cloudinary optimized URLs
function generateOptimizedUrls(originalUrl: string): ProcessedUrls {
  if (!CLOUDINARY_CLOUD_NAME || CLOUDINARY_CLOUD_NAME === 'demo') {
    // Fallback: return original for all sizes
    return {
      small_url: originalUrl,
      medium_url: originalUrl,
      large_url: originalUrl,
    };
  }

  const encodedUrl = encodeURIComponent(originalUrl);
  const baseUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/fetch`;

  return {
    small_url: `${baseUrl}/w_400,q_75,f_auto,c_limit,fl_progressive/${encodedUrl}`,
    medium_url: `${baseUrl}/w_1200,q_85,f_auto,c_limit,fl_progressive/${encodedUrl}`,
    large_url: `${baseUrl}/w_2400,q_90,f_auto,c_limit,fl_progressive/${encodedUrl}`,
  };
}

// Verify a URL is accessible
async function verifyUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image_id, original_url, artwork_id }: ProcessRequest = await req.json();

    console.log(`Processing image ${image_id} for artwork ${artwork_id}`);

    if (!image_id || !original_url) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate optimized URLs
    const urls = generateOptimizedUrls(original_url);
    console.log('Generated URLs:', urls);

    // Verify at least the medium URL is accessible (warm the cache)
    const isAccessible = await verifyUrl(urls.medium_url);
    if (!isAccessible) {
      console.warn(`Medium URL not accessible: ${urls.medium_url}`);
    }

    // Update the database with processed URLs
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error: updateError } = await supabase
      .from('viewer_artwork_images')
      .update({
        small_url: urls.small_url,
        medium_url: urls.medium_url,
        large_url: urls.large_url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', image_id);

    if (updateError) {
      console.error('Database update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update database', details: updateError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Successfully processed image ${image_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        image_id,
        urls,
        cached: isAccessible,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing image:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
