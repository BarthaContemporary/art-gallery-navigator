
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImageProcessingOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  watermark?: boolean;
  sharpen?: boolean;
  autoOrient?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { image_url, artwork_image_id, options = {} } = await req.json();
    
    if (!image_url || !artwork_image_id) {
      throw new Error('Missing required fields: image_url and artwork_image_id');
    }

    console.log(`Processing image ${artwork_image_id} with original URL: ${image_url}`);
    console.log('Processing options:', options);

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Always process images to ensure they have proper Cloudinary URLs
    // Even if marked as processed, we may need to regenerate Cloudinary URLs

    // Get Cloudinary credentials
    const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME');
    const apiKey = Deno.env.get('CLOUDINARY_API_KEY');
    const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('Cloudinary credentials not configured');
    }

    // Process image with Cloudinary
    const processedUrls = await processImageWithCloudinary(
      image_url, 
      options, 
      { cloudName, apiKey, apiSecret }
    );

    // Update the artwork_images record with Cloudinary URLs
    const { data: updatedRecord, error: updateError } = await supabase
      .from('artwork_images')
      .update({
        processed: true,
        thumbnail_url: processedUrls.thumbnail,
        medium_url: processedUrls.medium,
        image_url: processedUrls.processed // Store the high-quality Cloudinary URL as the main image_url
      })
      .eq('id', artwork_image_id)
      .select()
      .single();

    if (updateError) {
      console.error('Database update error:', updateError);
      throw updateError;
    }

    console.log(`Successfully processed and updated image ${artwork_image_id}`);
    console.log('Updated record:', updatedRecord);
    console.log('Generated Cloudinary URLs:', processedUrls);

    return new Response(JSON.stringify({
      success: true,
      message: 'Image processed successfully with Cloudinary',
      thumbnail_url: processedUrls.thumbnail,
      medium_url: processedUrls.medium,
      processed_url: processedUrls.processed,
      processing_details: {
        original_url: image_url,
        formats_created: Object.keys(processedUrls),
        options_applied: options,
        cloudinary_enabled: true
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error processing image with Cloudinary:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Cloudinary processing failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function processImageWithCloudinary(
  imageUrl: string,
  options: ImageProcessingOptions,
  credentials: { cloudName: string; apiKey: string; apiSecret: string }
): Promise<Record<string, string>> {
  const {
    quality = 85,
    format = 'webp',
    watermark = false,
    sharpen = true,
    autoOrient = true
  } = options;

  try {
    console.log(`Starting Cloudinary processing for URL: ${imageUrl}`);
    
    // Build Cloudinary transformations
    const baseTransformations = [];
    
    if (autoOrient) {
      baseTransformations.push('a_auto');
    }
    
    if (sharpen) {
      baseTransformations.push('e_sharpen');
    }
    
    if (watermark) {
      baseTransformations.push('l_text:Arial_20:© Gallery Collection,o_30,g_south_east');
    }

    // Create different sizes with Cloudinary URLs
    const sizes = {
      thumbnail: { width: 400, height: 400 },
      medium: { width: 1200, height: 1200 },
      processed: { width: 2400, height: 2400 }
    };

    const processedUrls: Record<string, string> = {};

    for (const [sizeName, dimensions] of Object.entries(sizes)) {
      const transformations = [
        ...baseTransformations,
        `w_${dimensions.width}`,
        `h_${dimensions.height}`,
        'c_limit',
        `q_${quality}`,
        `f_${format}`
      ].join(',');

      // For external URLs (including Supabase storage), we use fetch mode
      let sourceUrl = imageUrl;
      
      // If it's already a Cloudinary URL, extract the original URL
      if (imageUrl.includes('res.cloudinary.com/')) {
        // Extract the original URL from the Cloudinary fetch URL
        const urlParts = imageUrl.split('/');
        const encodedOriginalUrl = urlParts[urlParts.length - 1];
        try {
          sourceUrl = decodeURIComponent(encodedOriginalUrl);
          console.log(`Extracted original URL from Cloudinary URL: ${sourceUrl}`);
        } catch (e) {
          console.warn('Could not extract original URL, using Cloudinary URL as source');
          sourceUrl = imageUrl;
        }
      }

      const cloudinaryUrl = `https://res.cloudinary.com/${credentials.cloudName}/image/fetch/${transformations}/${encodeURIComponent(sourceUrl)}`;
      processedUrls[sizeName] = cloudinaryUrl;
      console.log(`Created ${sizeName} Cloudinary URL: ${cloudinaryUrl}`);
    }

    return processedUrls;

  } catch (error) {
    console.error('Cloudinary processing error:', error);
    throw new Error(`Cloudinary processing failed: ${error.message}`);
  }
}
