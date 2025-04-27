
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import sharp from 'https://esm.sh/sharp@0.32.6';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function processImage(imageBuffer: Uint8Array, width: number): Promise<{ buffer: Uint8Array, metadata: sharp.Metadata }> {
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  
  const resizedImage = await image
    .resize(width, undefined, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 80 })
    .toBuffer();

  return { buffer: resizedImage, metadata };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { image_url, artwork_image_id } = await req.json();
    
    if (!image_url || !artwork_image_id) {
      throw new Error('Missing required fields');
    }

    // Download the original image
    const response = await fetch(image_url);
    const imageBuffer = new Uint8Array(await response.arrayBuffer());

    // Process images for different sizes
    const [thumbnail, medium, original] = await Promise.all([
      processImage(imageBuffer, 400),
      processImage(imageBuffer, 800),
      processImage(imageBuffer, undefined)
    ]);

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Upload processed images to their respective buckets
    const [thumbnailUpload, mediumUpload] = await Promise.all([
      supabase.storage
        .from('artwork-thumbnails')
        .upload(`${artwork_image_id}.webp`, thumbnail.buffer, {
          contentType: 'image/webp',
          upsert: true
        }),
      supabase.storage
        .from('artwork-medium')
        .upload(`${artwork_image_id}.webp`, medium.buffer, {
          contentType: 'image/webp',
          upsert: true
        })
    ]);

    if (thumbnailUpload.error || mediumUpload.error) {
      throw new Error('Failed to upload processed images');
    }

    // Get public URLs for the uploaded images
    const thumbnailUrl = supabase.storage
      .from('artwork-thumbnails')
      .getPublicUrl(`${artwork_image_id}.webp`).data.publicUrl;
      
    const mediumUrl = supabase.storage
      .from('artwork-medium')
      .getPublicUrl(`${artwork_image_id}.webp`).data.publicUrl;

    // Update the artwork_images record with new URLs and metadata
    const { error: updateError } = await supabase
      .from('artwork_images')
      .update({
        thumbnail_url: thumbnailUrl,
        medium_url: mediumUrl,
        original_width: original.metadata.width,
        original_height: original.metadata.height,
        original_size: imageBuffer.length,
        thumbnail_width: thumbnail.metadata.width,
        thumbnail_height: thumbnail.metadata.height,
        medium_width: medium.metadata.width,
        medium_height: medium.metadata.height,
        processed: true
      })
      .eq('id', artwork_image_id);

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({
      success: true,
      thumbnail_url: thumbnailUrl,
      medium_url: mediumUrl
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
