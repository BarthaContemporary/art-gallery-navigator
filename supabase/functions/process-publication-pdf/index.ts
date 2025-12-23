import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    console.log(`PDF fetched, size: ${pdfBuffer.byteLength} bytes`);

    // Use PDF.js for parsing (via CDN)
    // For server-side, we'll use a simpler approach with pdf-lib for page count
    // and generate placeholder pages that will be rendered client-side
    
    // Import pdf-lib dynamically
    const { PDFDocument } = await import("https://esm.sh/pdf-lib@1.17.1");
    
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();
    
    console.log(`PDF has ${pageCount} pages`);

    // Update publication with page count
    await supabase
      .from('publications')
      .update({ page_count: pageCount })
      .eq('id', publicationId);

    // Create page records
    const pageRecords = [];
    for (let i = 1; i <= pageCount; i++) {
      pageRecords.push({
        publication_id: publicationId,
        page_number: i,
        text_content: '', // Will be extracted client-side using PDF.js
        render_low_url: null, // Will be generated on-demand
        render_high_url: null,
      });
    }

    // Insert all pages
    const { error: pagesError } = await supabase
      .from('publication_pages')
      .insert(pageRecords);

    if (pagesError) {
      console.error('Error inserting pages:', pagesError);
      throw new Error(`Failed to create page records: ${pagesError.message}`);
    }

    console.log(`Created ${pageCount} page records`);

    // Generate cover image for OG
    // For now, we'll set a placeholder - client will generate on first view
    const ogImageUrl = `${supabaseUrl}/storage/v1/object/public/publications/${publicationId}/cover.jpg`;

    // Update publication as completed
    const { error: updateError } = await supabase
      .from('publications')
      .update({ 
        processing_status: 'completed',
        og_image_url: ogImageUrl
      })
      .eq('id', publicationId);

    if (updateError) {
      throw new Error(`Failed to update publication status: ${updateError.message}`);
    }

    console.log('Publication processing completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        pageCount,
        message: 'Publication processed successfully' 
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
