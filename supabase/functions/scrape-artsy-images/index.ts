import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ScrapeRequest {
  items: Array<{
    artwork_id: string;
    artsy_url: string;
  }>;
}

async function extractOgImage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ArtGalleryBot/1.0)',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Failed to fetch ${url}: ${response.status}`);
      return null;
    }

    const html = await response.text();

    // Extract og:image meta tag
    const ogImageMatch = html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i)
      || html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i);

    if (ogImageMatch?.[1]) {
      const imageUrl = ogImageMatch[1];
      console.log(`Extracted og:image from ${url}: ${imageUrl}`);
      return imageUrl;
    }

    // Fallback: look for high-res image URLs in Artsy's data
    const largerImageMatch = html.match(/https:\/\/d32dm0rphc51dk\.cloudfront\.net\/[^"'\s]+\/larger\.jpg/i)
      || html.match(/https:\/\/d32dm0rphc51dk\.cloudfront\.net\/[^"'\s]+\/large\.jpg/i)
      || html.match(/https:\/\/d32dm0rphc51dk\.cloudfront\.net\/[^"'\s]+\/medium\.jpg/i);

    if (largerImageMatch?.[0]) {
      console.log(`Extracted fallback image from ${url}: ${largerImageMatch[0]}`);
      return largerImageMatch[0];
    }

    console.warn(`No image found on ${url}`);
    return null;
  } catch (e) {
    console.error(`Error fetching ${url}:`, e.message);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { items }: ScrapeRequest = await req.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'items array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log(`Processing ${items.length} Artsy URLs`);

    let processed = 0;
    let failed = 0;
    let skipped = 0;
    const results: Array<{ artwork_id: string; image_url: string | null; status: string }> = [];

    // Process in batches of 5 to avoid overwhelming
    const batchSize = 5;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      const batchResults = await Promise.allSettled(
        batch.map(async (item) => {
          const imageUrl = await extractOgImage(item.artsy_url);

          if (!imageUrl) {
            failed++;
            return { artwork_id: item.artwork_id, image_url: null, status: 'no_image_found' };
          }

          // Check if artwork_images record already exists for this artwork
          const { data: existing } = await supabaseAdmin
            .from('artwork_images')
            .select('id')
            .eq('artwork_id', item.artwork_id)
            .limit(1);

          if (existing && existing.length > 0) {
            skipped++;
            return { artwork_id: item.artwork_id, image_url: imageUrl, status: 'already_exists' };
          }

          // Insert artwork_images record
          const { error: insertError } = await supabaseAdmin
            .from('artwork_images')
            .insert({
              artwork_id: item.artwork_id,
              image_url: imageUrl,
              is_primary: true,
              display_order: 0,
              processed: false,
            });

          if (insertError) {
            console.error(`Insert error for ${item.artwork_id}:`, insertError);
            failed++;
            return { artwork_id: item.artwork_id, image_url: imageUrl, status: 'insert_failed' };
          }

          // Also update the artworks table image_url
          await supabaseAdmin
            .from('artworks')
            .update({ image_url: imageUrl })
            .eq('id', item.artwork_id)
            .is('image_url', null);

          processed++;
          return { artwork_id: item.artwork_id, image_url: imageUrl, status: 'success' };
        })
      );

      for (const r of batchResults) {
        if (r.status === 'fulfilled') {
          results.push(r.value);
        } else {
          failed++;
          results.push({ artwork_id: 'unknown', image_url: null, status: 'error' });
        }
      }
    }

    console.log(`Scraping complete. Processed: ${processed}, Failed: ${failed}, Skipped: ${skipped}`);

    return new Response(JSON.stringify({
      success: true,
      processed,
      failed,
      skipped,
      total: items.length,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in scrape-artsy-images:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
