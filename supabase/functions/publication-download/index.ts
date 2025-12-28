import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response('Download token required', { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the token
    const { data: downloadToken, error: tokenError } = await supabase
      .from('publication_download_tokens')
      .select(`
        *,
        publication:publications(id, title, slug, pdf_url, pdf_storage_path)
      `)
      .eq('token', token)
      .single();

    if (tokenError || !downloadToken) {
      console.error('Token not found:', tokenError);
      return new Response('Invalid or expired download token', { 
        status: 404, 
        headers: corsHeaders 
      });
    }

    // Check if token is expired
    if (new Date(downloadToken.expires_at) < new Date()) {
      return new Response('Download token has expired', { 
        status: 410, 
        headers: corsHeaders 
      });
    }

    // Check if token was already used
    if (downloadToken.used_at) {
      return new Response('Download token has already been used', { 
        status: 410, 
        headers: corsHeaders 
      });
    }

    const publication = downloadToken.publication;
    if (!publication || !publication.pdf_url) {
      return new Response('Publication PDF not found', { 
        status: 404, 
        headers: corsHeaders 
      });
    }

    // Mark token as used
    await supabase
      .from('publication_download_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', downloadToken.id);

    console.log(`Download initiated for publication: ${publication.title}`);

    // Generate safe filename from publication title
    const safeFilename = publication.title
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 100) + '.pdf';

    let pdfUrl: string;

    // Get the PDF URL - either from storage or direct URL
    if (publication.pdf_storage_path) {
      const { data: signedUrl, error: signError } = await supabase
        .storage
        .from('publications')
        .createSignedUrl(publication.pdf_storage_path, 300); // 5 minutes

      if (signError || !signedUrl) {
        console.error('Failed to create signed URL:', signError);
        return new Response('Failed to generate download link', { 
          status: 500, 
          headers: corsHeaders 
        });
      }
      pdfUrl = signedUrl.signedUrl;
    } else {
      pdfUrl = publication.pdf_url;
    }

    // Fetch the PDF content directly and stream it back
    // This avoids redirect-based downloads that get blocked by ad blockers
    console.log(`Fetching PDF from: ${pdfUrl}`);
    
    const pdfResponse = await fetch(pdfUrl);
    
    if (!pdfResponse.ok) {
      console.error(`Failed to fetch PDF: ${pdfResponse.status} ${pdfResponse.statusText}`);
      return new Response('Failed to retrieve PDF file', { 
        status: 502, 
        headers: corsHeaders 
      });
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();
    
    console.log(`Successfully fetched PDF, size: ${pdfBuffer.byteLength} bytes`);

    // Return the PDF directly with proper headers for download
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
        'Content-Length': pdfBuffer.byteLength.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });

  } catch (error) {
    console.error('Error processing download:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
