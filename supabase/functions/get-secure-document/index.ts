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
    
    // Parse request body first
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('Request body parsed:', requestBody);
    } catch (e) {
      console.error('Failed to parse request body:', e);
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { file_url, document_id } = requestBody as SecureDocumentRequest;
    
    if (!file_url || !document_id) {
      console.error('Missing required parameters:', { file_url: !!file_url, document_id: !!document_id });
      return new Response(JSON.stringify({ error: 'Missing file_url or document_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log('Processing request for document:', document_id);

    // Get the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header found');
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Auth header present');

    // Initialize Supabase client
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('Missing Supabase configuration');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify user authentication
    const token = authHeader.replace('Bearer ', '');
    let user;
    try {
      const { data: { user: authUser }, error: userError } = await supabase.auth.getUser(token);
      if (userError) {
        console.error('User verification failed:', userError);
        return new Response(JSON.stringify({ error: 'Invalid authorization' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      user = authUser;
    } catch (e) {
      console.error('Auth verification error:', e);
      return new Response(JSON.stringify({ error: 'Authorization verification failed' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (!user) {
      console.error('No user found from token');
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('User verified:', user.id);

    // Check document access
    let document;
    try {
      const { data: docData, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', document_id)
        .maybeSingle();

      if (docError) {
        console.error('Document query error:', docError);
        return new Response(JSON.stringify({ error: 'Database error' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      document = docData;
    } catch (e) {
      console.error('Document lookup error:', e);
      return new Response(JSON.stringify({ error: 'Document lookup failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (!document) {
      console.error('Document not found in database');
      return new Response(JSON.stringify({ error: 'Document not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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

    // For external buckets, try to proxy the file content
    try {
      console.log('Fetching file from external storage...');
      const fileResponse = await fetch(file_url);
      
      console.log('External file response status:', fileResponse.status);
      
      if (!fileResponse.ok) {
        console.error(`External file fetch failed: ${fileResponse.status} ${fileResponse.statusText}`);
        return new Response(JSON.stringify({ 
          error: `External file access denied: ${fileResponse.status}` 
        }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const contentType = fileResponse.headers.get('content-type') || 'application/octet-stream';
      const fileData = await fileResponse.arrayBuffer();

      console.log('Successfully proxied file:', { 
        size: fileData.byteLength, 
        contentType,
        fileName: document.file_name 
      });

      // Return the file data directly
      return new Response(fileData, {
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Content-Disposition': `inline; filename="${document.file_name}"`,
          'Cache-Control': 'private, max-age=3600',
        },
      });

    } catch (fileError) {
      console.error('Error fetching external file:', fileError);
      return new Response(JSON.stringify({ 
        error: `Failed to access external file: ${fileError.message}` 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Unexpected error in edge function:', error);
    return new Response(JSON.stringify({ 
      error: `Unexpected error: ${error.message}` 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});