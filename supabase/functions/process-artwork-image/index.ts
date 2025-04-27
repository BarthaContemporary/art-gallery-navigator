
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { image_url, artwork_image_id } = await req.json();
    
    if (!image_url || !artwork_image_id) {
      throw new Error('Missing required fields');
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // First, check if this image already exists in our database and has been processed
    const { data: existingImage } = await supabase
      .from('artwork_images')
      .select('*')
      .eq('id', artwork_image_id)
      .single();

    // If the image has already been processed, return early
    if (existingImage?.processed) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Image already processed',
        thumbnail_url: existingImage.thumbnail_url,
        medium_url: existingImage.medium_url
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update the artwork_images record to mark it as processed
    // In this version, we're not performing actual image processing, but marking it for client-side processing
    const { error: updateError } = await supabase
      .from('artwork_images')
      .update({
        processed: true,
        // Set the URLs to be the same as the original for now
        // The browser will handle resizing for display purposes
        thumbnail_url: image_url,
        medium_url: image_url
      })
      .eq('id', artwork_image_id);

    if (updateError) {
      throw updateError;
    }

    // Log successful processing
    console.log(`Successfully marked image ${artwork_image_id} as processed`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Image marked for client-side processing',
      thumbnail_url: image_url,
      medium_url: image_url
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error processing image:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
