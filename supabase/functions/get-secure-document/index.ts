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
    console.log(`Secure document request: ${req.method} ${req.url}`);
    
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing Supabase configuration');
      throw new Error('Server configuration error');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse request body
    const { file_url, document_id }: SecureDocumentRequest = await req.json();
    
    console.log('Processing secure document access:', { 
      file_url: file_url?.substring(0, 50) + '...', 
      document_id 
    });

    // Get the Authorization header to extract user info
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header found');
      throw new Error('Authorization required');
    }

    console.log('Auth header present:', authHeader.startsWith('Bearer '));

    // Verify user has access to this document
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError) {
      console.error('User verification failed:', userError);
      throw new Error('Invalid authorization');
    }
    
    if (!user) {
      console.error('No user found from token');
      throw new Error('User not found');
    }

    console.log('User verified:', user.id);

    // Check if user can access this document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', document_id)
      .single();

    if (docError) {
      console.error('Document query error:', docError);
      throw new Error('Document not found');
    }
    
    if (!document) {
      console.error('Document not found in database');
      throw new Error('Document not found');
    }

    console.log('Document found:', document.file_name);

    // For non-external buckets, return the original URL
    if (!file_url.includes('gallerysharedbucket') && !file_url.includes('s3')) {
      console.log('Public file, returning original URL');
      return new Response(JSON.stringify({ secure_url: file_url }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('External file detected, attempting to proxy...');

    // For external buckets, we need to proxy the file content
    try {
      console.log('Fetching file from external storage:', file_url);
      const fileResponse = await fetch(file_url);
      
      console.log('External file response status:', fileResponse.status);
      
      if (!fileResponse.ok) {
        console.error(`Failed to fetch file: ${fileResponse.status} ${fileResponse.statusText}`);
        
        // If we can't access the file, return error
        return new Response(JSON.stringify({ 
          error: `Access denied to external file: ${fileResponse.status}` 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const contentType = fileResponse.headers.get('content-type') || 'application/octet-stream';
      const contentLength = fileResponse.headers.get('content-length');
      const fileData = await fileResponse.arrayBuffer();

      console.log('Successfully proxied file:', { 
        size: fileData.byteLength, 
        contentType,
        contentLength,
        fileName: document.file_name 
      });

      // Return the file data directly with proper headers
      return new Response(fileData, {
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Content-Disposition': `inline; filename="${document.file_name}"`,
          'Cache-Control': 'private, max-age=3600',
          'Content-Length': fileData.byteLength.toString(),
        },
      });

    } catch (fileError) {
      console.error('Error fetching file from external storage:', fileError);
      
      // Return error response
      return new Response(JSON.stringify({ 
        error: `Failed to access external file: ${fileError.message}` 
      }), {
        status: 500,
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