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

    // Redirect to the PDF URL (or serve it directly if in storage)
    // For signed URLs from storage:
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

      // Redirect to signed URL
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': signedUrl.signedUrl,
        }
      });
    }

    // Fallback: redirect to public PDF URL
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': publication.pdf_url,
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
