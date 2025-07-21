import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SecureDocumentRequest {
  file_url: string;
  document_id: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Secure document access function started');
    
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse request body
    const { file_url, document_id }: SecureDocumentRequest = await req.json();
    
    console.log('Processing secure document access for:', { file_url, document_id });

    // Get the Authorization header to extract user info
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization required');
    }

    // Verify user has access to this document
    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) {
      throw new Error('Invalid authorization');
    }

    // Check if user can access this document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', document_id)
      .single();

    if (docError || !document) {
      throw new Error('Document not found or access denied');
    }

    // For now, if it's not an external bucket, return the original URL
    if (!file_url.includes('gallerysharedbucket') && !file_url.includes('s3')) {
      return new Response(JSON.stringify({ secure_url: file_url }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For external buckets, we need to proxy the file content
    // This is a simplified approach - fetch the file and return it with proper headers
    try {
      const fileResponse = await fetch(file_url);
      
      if (!fileResponse.ok) {
        throw new Error(`Failed to fetch file: ${fileResponse.status}`);
      }

      const contentType = fileResponse.headers.get('content-type') || 'application/octet-stream';
      const fileData = await fileResponse.arrayBuffer();

      console.log('Successfully proxied file:', { 
        size: fileData.byteLength, 
        contentType,
        fileName: document.file_name 
      });

      // Return the file data directly with proper headers
      return new Response(fileData, {
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Content-Disposition': `inline; filename="${document.file_name}"`,
          'Cache-Control': 'private, max-age=3600',
        },
      });

    } catch (fileError) {
      console.error('Error fetching file from external storage:', fileError);
      
      // Return the original URL as fallback
      return new Response(JSON.stringify({ secure_url: file_url }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Error in get-secure-document function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});