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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { publicationId, pdfUrl }: ProcessPublicationRequest = await req.json();

    if (!pdfUrl) {
      throw new Error(`Invalid URL: '${pdfUrl}'`);
    }

    console.log(`Processing publication ${publicationId} from PDF: ${pdfUrl}`);

    // Update status to processing
    await supabase
      .from('publications')
      .update({ 
        processing_status: 'processing',
        processing_error: null 
      })
      .eq('id', publicationId);

    // Fetch the PDF
    console.log('Fetching PDF from URL...');
    const pdfResponse = await fetch(pdfUrl);
    if (!pdfResponse.ok) {
      throw new Error(`Failed to fetch PDF: ${pdfResponse.statusText}`);
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    const pdfData = new Uint8Array(pdfBuffer);
    console.log(`PDF fetched, size: ${pdfBuffer.byteLength} bytes`);

    // Load PDF using unpdf for text extraction
    console.log('Loading PDF document for text extraction...');
    const pdf = await getDocumentProxy(pdfData);
    const pageCount = pdf.numPages;
    
    console.log(`PDF has ${pageCount} pages, extracting text from each page...`);

    // Update publication with page count
    await supabase
      .from('publications')
      .update({ page_count: pageCount })
      .eq('id', publicationId);

    // Extract all text in a single call (much more efficient than per-page)
    console.log('Extracting text from all pages...');
    let allPageTexts: string[] = [];
    try {
      const { text } = await extractText(pdfData, { mergePages: false });
      allPageTexts = text || [];
      console.log(`Text extraction complete for ${allPageTexts.length} pages`);
    } catch (textError) {
      console.warn('Warning: Could not extract text from PDF:', textError);
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

    console.log(`Text extraction complete. Total characters extracted: ${totalTextLength}`);

    // Insert all pages (the trigger will automatically populate text_tokens)
    const { error: pagesError } = await supabase
      .from('publication_pages')
      .insert(pageRecords);

    if (pagesError) {
      console.error('Error inserting pages:', pagesError);
      throw new Error(`Failed to create page records: ${pagesError.message}`);
    }

    console.log(`Created ${pageCount} page records with text content`);

    // Generate full document text for SEO metadata
    const fullText = pageRecords.map(p => p.text_content).join(' ').substring(0, 5000);
    
    // Update publication as completed with text excerpt for SEO
    let ogImageUrl = null;
    
    const { error: updateError } = await supabase
      .from('publications')
      .update({ 
        processing_status: 'completed',
        og_image_url: ogImageUrl,
      })
      .eq('id', publicationId);

    if (updateError) {
      throw new Error(`Failed to update publication status: ${updateError.message}`);
    }

    console.log('Publication processing completed successfully with full-text indexing');

    return new Response(
      JSON.stringify({ 
        success: true, 
        pageCount,
        totalTextLength,
        message: 'Publication processed successfully with text extraction' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error processing publication:', error);

    // Try to update status to failed
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      const { publicationId } = await req.clone().json();
      if (publicationId) {
        await supabase
          .from('publications')
          .update({ 
            processing_status: 'failed',
            processing_error: error.message 
          })
          .eq('id', publicationId);
      }
    } catch (e) {
      console.error('Failed to update error status:', e);
    }

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
