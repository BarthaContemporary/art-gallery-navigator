import "https://deno.land/x/xhr@0.1.0/mod.ts";
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

// OCR a page using OpenAI GPT-4 Vision
async function ocrPageWithOpenAI(
  pdfData: Uint8Array,
  pageNumber: number,
  openAIApiKey: string
): Promise<string> {
  try {
    // For now, we'll use a simpler approach - send the page context to GPT-4
    // In a full implementation, you'd render the PDF page to an image first
    console.log(`[OCR] Attempting AI text extraction for page ${pageNumber}`);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an OCR assistant. Extract and return ONLY the text content from the provided page. Return plain text, no formatting or explanations.'
          },
          {
            role: 'user',
            content: `This is page ${pageNumber} of a PDF document. The native text extraction returned very little content, suggesting this might be a scanned or image-heavy page. Please help identify any text that might be present on this type of page.`
          }
        ],
        max_tokens: 2000,
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.warn(`[OCR] OpenAI API error for page ${pageNumber}:`, response.status);
      return '';
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.warn(`[OCR] Error processing page ${pageNumber}:`, error);
    return '';
  }
}

// Background processing function
async function processPublicationInBackground(publicationId: string, pdfUrl: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
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

    // STEP 1: Delete existing page records FIRST (before any other operations)
    console.log('[Background] Deleting existing page records...');
    const { error: deleteError, count: deletedCount } = await supabase
      .from('publication_pages')
      .delete()
      .eq('publication_id', publicationId)
      .select('id', { count: 'exact', head: true });

    if (deleteError) {
      console.error('[Background] CRITICAL: Failed to delete existing pages:', deleteError);
      throw new Error(`Failed to delete existing pages: ${deleteError.message}`);
    }
    console.log(`[Background] Successfully deleted existing page records (${Date.now() - startTime}ms)`);

    // Small delay to ensure database consistency
    await new Promise(resolve => setTimeout(resolve, 100));

    // STEP 2: Fetch the PDF
    console.log('[Background] Fetching PDF from URL...');
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.statusText}`);
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfData = new Uint8Array(pdfBuffer);
    console.log(`[Background] PDF fetched, size: ${pdfBuffer.byteLength} bytes (${Date.now() - startTime}ms)`);

    // STEP 3: Load PDF using unpdf for text extraction
    console.log('[Background] Loading PDF document for text extraction...');
    const pdf = await getDocumentProxy(pdfData);
    const pageCount = pdf.numPages;
    
    console.log(`[Background] PDF has ${pageCount} pages (${Date.now() - startTime}ms)`);

    // Update publication with page count immediately
    await supabase
      .from('publications')
      .update({ page_count: pageCount })
      .eq('id', publicationId);

    // STEP 4: Extract all text using unpdf
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

    // STEP 5: Create page records with text (and OCR enhancement for sparse pages)
    const pageRecords = [];
    let totalTextLength = 0;
    let pagesNeedingOCR = 0;
    const MIN_TEXT_THRESHOLD = 50; // Pages with less than 50 chars may need OCR

    for (let i = 1; i <= pageCount; i++) {
      let pageText = (allPageTexts[i - 1] || '').trim();
      
      // If page has very little text and we have OpenAI key, try OCR
      if (pageText.length < MIN_TEXT_THRESHOLD && openAIApiKey) {
        pagesNeedingOCR++;
        // For now, just log - full image OCR would require PDF-to-image conversion
        console.log(`[Background] Page ${i} has sparse text (${pageText.length} chars), would benefit from OCR`);
      }
      
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
    if (pagesNeedingOCR > 0) {
      console.log(`[Background] ${pagesNeedingOCR} pages have sparse text and could benefit from OCR`);
    }

    // STEP 6: Insert pages in batches
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

    // STEP 7: Update publication as completed
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
        status: 202
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
