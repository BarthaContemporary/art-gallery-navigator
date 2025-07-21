
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

// Helper function to create AWS4-HMAC-SHA256 signature
async function createAwsSignature(
  method: string,
  url: string,
  headers: Record<string, string>,
  credentials: any,
  region: string = 'us-east-1'
) {
  const urlObj = new URL(url);
  const host = urlObj.hostname;
  const pathname = urlObj.pathname;
  const queryString = urlObj.search.slice(1); // Remove the '?' prefix
  
  const now = new Date();
  const dateString = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeString = now.toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
  
  // Add required headers
  headers['Host'] = host;
  headers['X-Amz-Content-Sha256'] = 'UNSIGNED-PAYLOAD';
  headers['X-Amz-Date'] = timeString;
  
  // Create canonical headers
  const sortedHeaders = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaders
    .map(key => `${key.toLowerCase()}:${headers[key]}`)
    .join('\n') + '\n';
  
  const signedHeaders = sortedHeaders.map(key => key.toLowerCase()).join(';');
  
  // Create canonical request
  const canonicalRequest = [
    method,
    pathname,
    queryString,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD'
  ].join('\n');
  
  console.log('Canonical request:', canonicalRequest);
  
  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateString}/${region}/s3/aws4_request`;
  const stringToSign = [
    algorithm,
    timeString,
    credentialScope,
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalRequest))
      .then(hash => Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(''))
  ].join('\n');
  
  console.log('String to sign:', stringToSign);
  
  // Create signing key
  const kSecret = new TextEncoder().encode(`AWS4${credentials.secret_key}`);
  const kDate = await crypto.subtle.importKey(
    'raw', kSecret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  ).then(key => crypto.subtle.sign('HMAC', key, new TextEncoder().encode(dateString)));
  
  const kRegion = await crypto.subtle.importKey(
    'raw', kDate, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  ).then(key => crypto.subtle.sign('HMAC', key, new TextEncoder().encode(region)));
  
  const kService = await crypto.subtle.importKey(
    'raw', kRegion, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  ).then(key => crypto.subtle.sign('HMAC', key, new TextEncoder().encode('s3')));
  
  const kSigning = await crypto.subtle.importKey(
    'raw', kService, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  ).then(key => crypto.subtle.sign('HMAC', key, new TextEncoder().encode('aws4_request')));
  
  const signature = await crypto.subtle.importKey(
    'raw', kSigning, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  ).then(key => crypto.subtle.sign('HMAC', key, new TextEncoder().encode(stringToSign)))
    .then(sig => Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(''));
  
  const authorization = `${algorithm} Credential=${credentials.access_key}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  
  return {
    ...headers,
    'Authorization': authorization
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(`Secure document request: ${req.method} ${req.url}`);
    
    // Parse request body
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
    if (!file_url.includes('gallerysharedbucket') && !file_url.includes('s3') && !file_url.includes('idrivee2')) {
      console.log('Public file, returning original URL');
      return new Response(JSON.stringify({ secure_url: file_url }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('External S3-type file detected, implementing AWS authentication...');

    // Get storage credentials
    let credentials;
    try {
      const { data: credData, error: credError } = await supabase
        .from('shared_storage_credentials')
        .select('*')
        .eq('is_active', true)
        .limit(1);

      if (credError) {
        console.error('Credentials query error:', credError);
        return new Response(JSON.stringify({ error: 'Failed to fetch credentials' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      credentials = credData?.[0];
    } catch (e) {
      console.error('Credentials lookup error:', e);
      return new Response(JSON.stringify({ error: 'Credentials lookup failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!credentials) {
      console.error('No active storage credentials found');
      return new Response(JSON.stringify({ error: 'No storage credentials available' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Storage credentials found, creating signed request...');

    // Create signed headers for the file request
    const headers = {};
    const signedHeaders = await createAwsSignature(
      'GET',
      file_url,
      headers,
      credentials,
      credentials.region || 'us-east-1'
    );

    console.log('Signed headers created, fetching file...');

    // Fetch the file with signed headers
    try {
      const fileResponse = await fetch(file_url, {
        method: 'GET',
        headers: signedHeaders
      });
      
      console.log('File response status:', fileResponse.status);
      console.log('File response headers:', Object.fromEntries(fileResponse.headers.entries()));
      
      if (!fileResponse.ok) {
        console.error(`File fetch failed: ${fileResponse.status} ${fileResponse.statusText}`);
        const errorText = await fileResponse.text();
        console.error('File fetch error body:', errorText);
        
        return new Response(JSON.stringify({ 
          error: `File access failed: ${fileResponse.status} - ${fileResponse.statusText}`,
          details: `Unable to access file: ${document.file_name}`
        }), {
          status: fileResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const contentType = fileResponse.headers.get('content-type') || 'application/octet-stream';
      const fileData = await fileResponse.arrayBuffer();

      console.log('File successfully retrieved:', { 
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
      console.error('Error fetching file with signed request:', fileError);
      return new Response(JSON.stringify({ 
        error: `Failed to access file: ${fileError.message}`,
        details: `File: ${document.file_name}`
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
