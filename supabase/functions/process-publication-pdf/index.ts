import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDocumentProxy, extractText } from "https://esm.sh/unpdf@0.12.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessPublicationRequest {
  publicationId: string;
  pdfUrl: string;
}

// Background processing function
async function processPublicationInBackground(publicationId: string, pdfUrl: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log(`[Background] Starting processing for publication ${publicationId}`);
    const startTime = Date.now();

    // Update status to processing
    await supabase
      .from('publications')
      .update({ 
        processing_status: 'processing',
        processing_error: null 
      })
      .eq('id', publicationId);

    // Fetch the PDF
    console.log('[Background] Fetching PDF from URL...');
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.statusText}`);
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfData = new Uint8Array(pdfBuffer);
    console.log(`[Background] PDF fetched, size: ${pdfBuffer.byteLength} bytes (${Date.now() - startTime}ms)`);

    // Load PDF using unpdf for text extraction
    console.log('[Background] Loading PDF document for text extraction...');
    const pdf = await getDocumentProxy(pdfData);
    const pageCount = pdf.numPages;
    
    console.log(`[Background] PDF has ${pageCount} pages (${Date.now() - startTime}ms)`);

    // Update publication with page count immediately
    await supabase
      .from('publications')
      .update({ page_count: pageCount })
      .eq('id', publicationId);

    // Extract all text in a single call
    console.log('[Background] Extracting text from all pages...');
    let allPageTexts: string[] = [];
    try {
      const { text } = await extractText(pdfData, { mergePages: false });
      allPageTexts = text || [];
      console.log(`[Background] Text extraction complete for ${allPageTexts.length} pages (${Date.now() - startTime}ms)`);
    } catch (textError) {
      console.warn('[Background] Warning: Could not extract text from PDF:', textError);
      allPageTexts = new Array(pageCount).fill('');
    }

    // Create page records from extracted text
    const pageRecords = [];
    let totalTextLength = 0;

    for (let i = 1; i <= pageCount; i++) {
      const pageText = (allPageTexts[i - 1] || '').trim();
      totalTextLength += pageText.length;

      pageRecords.push({
        publication_id: publicationId,
        page_number: i,
        text_content: pageText,
        render_low_url: null,
        render_high_url: null,
      });
    }

    console.log(`[Background] Total characters extracted: ${totalTextLength} (${Date.now() - startTime}ms)`);

    // Delete existing page records for this publication (for reprocessing)
    const { error: deleteError } = await supabase
      .from('publication_pages')
      .delete()
      .eq('publication_id', publicationId);

    if (deleteError) {
      console.warn('[Background] Warning: Could not delete existing pages:', deleteError);
    } else {
      console.log('[Background] Deleted existing page records for reprocessing');
    }

    // Insert pages in batches to avoid timeout issues with large PDFs
    const BATCH_SIZE = 50;
    for (let i = 0; i < pageRecords.length; i += BATCH_SIZE) {
      const batch = pageRecords.slice(i, i + BATCH_SIZE);
      const { error: pagesError } = await supabase
        .from('publication_pages')
        .insert(batch);

      if (pagesError) {
        console.error(`[Background] Error inserting pages batch ${i}-${i + batch.length}:`, pagesError);
        throw new Error(`Failed to create page records: ${pagesError.message}`);
      }
      console.log(`[Background] Inserted pages ${i + 1}-${i + batch.length} of ${pageRecords.length}`);
    }

    console.log(`[Background] Created ${pageCount} page records (${Date.now() - startTime}ms)`);

    // Update publication as completed
    const { error: updateError } = await supabase
      .from('publications')
      .update({ 
        processing_status: 'completed',
        og_image_url: null,
      })
      .eq('id', publicationId);

    if (updateError) {
      throw new Error(`Failed to update publication status: ${updateError.message}`);
    }

    console.log(`[Background] Publication processing completed in ${Date.now() - startTime}ms`);

  } catch (error) {
    console.error('[Background] Error processing publication:', error);

    // Update status to failed
    try {
      await supabase
        .from('publications')
        .update({ 
          processing_status: 'failed',
          processing_error: error.message 
        })
        .eq('id', publicationId);
    } catch (e) {
      console.error('[Background] Failed to update error status:', e);
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { publicationId, pdfUrl }: ProcessPublicationRequest = await req.json();

    if (!pdfUrl) {
      throw new Error(`Invalid URL: '${pdfUrl}'`);
    }

    if (!publicationId) {
      throw new Error('Missing publicationId');
    }

    console.log(`Received request to process publication ${publicationId}`);

    // Start background processing using EdgeRuntime.waitUntil
    // This returns immediately while processing continues in the background
    EdgeRuntime.waitUntil(processPublicationInBackground(publicationId, pdfUrl));

    // Return immediate response - processing continues in background
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'PDF processing started in background',
        publicationId
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 202 // Accepted - processing started
      }
    );

  } catch (error) {
    console.error('Error starting publication processing:', error);

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
