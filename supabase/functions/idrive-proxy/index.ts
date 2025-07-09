import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

interface S3Request {
  method: string;
  path: string;
  body?: string;
  contentType?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing environment variables');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get JWT token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response('Unauthorized', { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    const token = authHeader.substring(7);
    
    // Verify user and get their artist ID
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response('Invalid token', { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    // Get artist for this user
    const { data: artist, error: artistError } = await supabase
      .from('artists')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (artistError || !artist) {
      return new Response('Artist not found', { 
        status: 404, 
        headers: corsHeaders 
      });
    }

    // Get storage credentials for this artist
    const { data: credentials, error: credError } = await supabase
      .from('artist_storage_credentials')
      .select('*')
      .eq('artist_id', artist.id)
      .single();

    if (credError || !credentials) {
      return new Response('Storage credentials not configured', { 
        status: 404, 
        headers: corsHeaders 
      });
    }

    const url = new URL(req.url);
    const s3Path = url.pathname.replace('/functions/v1/idrive-proxy', '');
    
    // Parse request body if present
    let body = undefined;
    if (req.method === 'PUT' || req.method === 'POST') {
      body = await req.arrayBuffer();
    }

    // Forward request to IDrive e2
    const s3Response = await makeS3Request({
      method: req.method,
      path: s3Path,
      body: body ? new Uint8Array(body) : undefined,
      contentType: req.headers.get('content-type') || undefined,
    }, credentials);

    // Forward response back to client
    const responseHeaders = {
      ...corsHeaders,
      'Content-Type': s3Response.headers.get('content-type') || 'application/json',
    };

    if (s3Response.headers.get('content-length')) {
      responseHeaders['Content-Length'] = s3Response.headers.get('content-length')!;
    }

    return new Response(s3Response.body, {
      status: s3Response.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('IDrive proxy error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function makeS3Request(
  request: S3Request, 
  credentials: any
): Promise<Response> {
  const { method, path, body, contentType } = request;
  
  // Create AWS Signature V4
  const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const date = timestamp.substring(0, 8);
  
  const url = `${credentials.endpoint_url}/${credentials.bucket_name}${path}`;
  
  const headers: Record<string, string> = {
    'Host': new URL(credentials.endpoint_url).host,
    'X-Amz-Date': timestamp,
  };

  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  // Simple request without full AWS signature for now
  // In production, you'd implement full AWS Signature V4
  const basicAuth = btoa(`${credentials.access_key}:${credentials.secret_key}`);
  headers['Authorization'] = `Basic ${basicAuth}`;

  const response = await fetch(url, {
    method,
    headers,
    body: body as any,
  });

  return response;
}