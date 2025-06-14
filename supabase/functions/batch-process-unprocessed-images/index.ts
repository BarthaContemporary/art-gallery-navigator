
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import { corsHeaders } from '../_shared/cors.ts';
import { logger } from '../_shared/logger.ts';

interface BatchProcessRequestBody {
  limit?: number;
}

async function processSingleImage(
  supabaseAdmin: SupabaseClient,
  artworkImageId: string,
  imageUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    logger.info(`[batch-process] Invoking 'process-artwork-image-cloudinary' for ${artworkImageId}, URL: ${imageUrl}`);
    const { data: processResult, error: invokeError } = await supabaseAdmin.functions.invoke(
      'process-artwork-image-cloudinary',
      { body: { artwork_image_id: artworkImageId, image_url: imageUrl, options: {} } } // Pass empty options object
    );

    if (invokeError) {
      logger.error(`[batch-process] Error invoking 'process-artwork-image-cloudinary' for ${artworkImageId}:`, invokeError);
      return { success: false, error: invokeError.message };
    }

    if (processResult && processResult.success) {
      logger.info(`[batch-process] Successfully processed ${artworkImageId}. Result:`, processResult);
      return { success: true };
    } else {
      logger.warn(`[batch-process] 'process-artwork-image-cloudinary' returned success:false for ${artworkImageId}. Details:`, processResult);
      return { success: false, error: processResult?.error || 'Processing function returned failure.' };
    }
  } catch (e) {
    logger.error(`[batch-process] Unexpected error processing image ${artworkImageId}:`, e);
    return { success: false, error: e.message };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const requestBody: BatchProcessRequestBody = await req.json().catch(() => ({}));
    const limit = requestBody.limit || 10; // Default to processing 10 images

    logger.info(`[batch-process] Starting batch processing. Limit: ${limit}`);

    // Fetch artwork images where thumbnail_url or medium_url is null
    // And also image_url is not already a cloudinary url (to avoid reprocessing already processed images by mistake)
    const { data: imagesToProcess, error: fetchError } = await supabaseAdmin
      .from('artwork_images')
      .select('id, image_url')
      .or('thumbnail_url.is.null,medium_url.is.null')
      .not('image_url', 'like', '%res.cloudinary.com%') // Avoid if main URL is already Cloudinary
      .limit(limit);

    if (fetchError) {
      logger.error('[batch-process] Error fetching images to process:', fetchError);
      throw fetchError;
    }

    if (!imagesToProcess || imagesToProcess.length === 0) {
      logger.info('[batch-process] No images found requiring processing.');
      return new Response(JSON.stringify({
        success: true,
        message: 'No images found requiring processing.',
        processedCount: 0,
        failedCount: 0,
        attemptedCount: 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    logger.info(`[batch-process] Found ${imagesToProcess.length} images to process.`);

    let processedCount = 0;
    let failedCount = 0;

    for (const image of imagesToProcess) {
      if (!image.id || !image.image_url) {
        logger.warn('[batch-process] Skipping image with missing id or image_url:', image);
        failedCount++; // Count as failed if essential data is missing
        continue;
      }
      const result = await processSingleImage(supabaseAdmin, image.id, image.image_url);
      if (result.success) {
        processedCount++;
      } else {
        failedCount++;
      }
    }

    logger.info(`[batch-process] Batch processing complete. Processed: ${processedCount}, Failed: ${failedCount}`);

    return new Response(JSON.stringify({
      success: true,
      message: `Batch processing finished. Processed: ${processedCount}, Failed: ${failedCount}.`,
      processedCount,
      failedCount,
      attemptedCount: imagesToProcess.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    logger.error('[batch-process] Main error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
