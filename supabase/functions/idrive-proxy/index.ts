import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

console.log('🚀 IDrive S3 Proxy Edge Function starting up...');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Create Supabase client with service role key for database access
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// AWS4-HMAC-SHA256 signing implementation
async function hmacSHA256(key: Uint8Array, data: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
  return new Uint8Array(signature);
}

async function sha256(data: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getSigningKey(dateStamp: string, region: string, service: string, secretKey: string): Promise<Uint8Array> {
  const kDate = hmacSHA256(new TextEncoder().encode('AWS4' + secretKey), dateStamp);
  const kRegion = kDate.then(k => hmacSHA256(k, region));
  const kService = kRegion.then(k => hmacSHA256(k, service));
  return kService.then(k => hmacSHA256(k, 'aws4_request'));
}

async function createSignature(method: string, path: string, query: string, headers: Record<string, string>, payload: string, credentials: any) {
  const algorithm = 'AWS4-HMAC-SHA256';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substring(0, 8);
  
  // Create canonical request
  const canonicalUri = encodeURI(path);
  const canonicalQuerystring = query;
  const canonicalHeaders = Object.entries(headers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key.toLowerCase()}:${value}`)
    .join('\n') + '\n';
  const signedHeaders = Object.keys(headers)
    .sort()
    .map(k => k.toLowerCase())
    .join(';');
  
  const payloadHash = await sha256(payload);
  const canonicalRequest = [method, canonicalUri, canonicalQuerystring, canonicalHeaders, signedHeaders, payloadHash].join('\n');
  
  // Create string to sign
  const credentialScope = `${dateStamp}/${credentials.region}/s3/aws4_request`;
  const stringToSign = [algorithm, amzDate, credentialScope, await sha256(canonicalRequest)].join('\n');
  
  // Calculate signature
  const signingKey = await getSigningKey(dateStamp, credentials.region, 's3', credentials.secret_key);
  const signature = Array.from(await hmacSHA256(signingKey, stringToSign))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Create authorization header
  const authorization = `${algorithm} Credential=${credentials.access_key}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  
  return { authorization, amzDate };
}

async function getStorageCredentials(bucketName: string, userId: string) {
  console.log('🔍 Looking for credentials for bucket:', bucketName, 'user:', userId);
  
  // First try to get artist-specific credentials
  const { data: artistCredentials, error: artistError } = await supabase
    .from('artist_storage_credentials')
    .select('*, artists!inner(*)')
    .eq('bucket_name', bucketName)
    .eq('artists.user_id', userId)
    .single();

  if (artistCredentials && !artistError) {
    console.log('✅ Found artist credentials');
    return artistCredentials;
  }

  // Then try admin credentials if user is admin
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'gallery_admin');

  if (userRoles && userRoles.length > 0) {
    console.log('🔍 User is admin, checking admin credentials');
    
    const { data: adminCredentials, error: adminError } = await supabase
      .from('admin_storage_credentials')
      .select('*')
      .eq('bucket_name', bucketName)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (adminCredentials && !adminError) {
      console.log('✅ Found admin credentials');
      return adminCredentials;
    }
  }

  // Finally try shared credentials
  const { data: sharedCredentials, error: sharedError } = await supabase
    .from('shared_storage_credentials')
    .select('*')
    .eq('bucket_name', bucketName)
    .eq('is_active', true)
    .single();

  if (sharedCredentials && !sharedError) {
    console.log('✅ Found shared credentials');
    return sharedCredentials;
  }

  console.error('❌ No credentials found for bucket:', bucketName);
  throw new Error(`No storage credentials found for bucket: ${bucketName}`);
}

async function proxyToS3(req: Request, credentials: any, path: string, query: string) {
  const method = req.method;
  const url = new URL(credentials.endpoint_url);
  const s3Path = `/${credentials.bucket_name}${path}`;
  const s3Url = `${url.protocol}//${url.host}${s3Path}${query ? `?${query}` : ''}`;
  
  console.log('🌐 Proxying to S3:', method, s3Url);
  
  const headers: Record<string, string> = {
    'host': url.host,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
  };
  
  if (method === 'PUT' && req.headers.get('content-type')) {
    headers['content-type'] = req.headers.get('content-type')!;
  }
  
  const body = method === 'PUT' ? await req.arrayBuffer() : '';
  const payload = method === 'PUT' ? '' : ''; // Use UNSIGNED-PAYLOAD for simplicity
  
  const { authorization, amzDate } = await createSignature(method, s3Path, query, headers, payload, credentials);
  
  headers['authorization'] = authorization;
  headers['x-amz-date'] = amzDate;
  
  console.log('📤 S3 Request headers:', Object.keys(headers));
  
  const s3Response = await fetch(s3Url, {
    method,
    headers,
    body: method === 'PUT' ? body : undefined,
  });
  
  console.log('📥 S3 Response:', s3Response.status, s3Response.statusText);
  
  if (!s3Response.ok) {
    const errorText = await s3Response.text();
    console.error('❌ S3 Error:', errorText);
    throw new Error(`S3 request failed: ${s3Response.status} ${s3Response.statusText} - ${errorText}`);
  }
  
  return s3Response;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('📥 Request received:', req.method, req.url);
  
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Extract user ID from JWT token
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('❌ Auth error:', authError);
      throw new Error('Invalid authentication token');
    }
    
    console.log('👤 Authenticated user:', user.id);
    
    const url = new URL(req.url);
    const bucketName = url.searchParams.get('bucket');
    const prefix = url.searchParams.get('prefix') || '';
    
    if (!bucketName) {
      throw new Error('Bucket name is required');
    }
    
    console.log('🪣 Processing request for bucket:', bucketName, 'prefix:', prefix);
    
    // Get storage credentials
    const credentials = await getStorageCredentials(bucketName, user.id);
    
    // Extract path from URL (everything after /idrive-proxy/)
    const pathMatch = url.pathname.match(/\/idrive-proxy\/(.*)$/);
    const path = pathMatch ? `/${pathMatch[1]}` : '/';
    
    // Build query string for S3
    const queryParams = new URLSearchParams();
    if (req.method === 'GET' && path === '/') {
      // List objects
      queryParams.set('list-type', '2');
      queryParams.set('delimiter', '/');
      if (prefix) {
        queryParams.set('prefix', prefix);
      }
    }
    
    const query = queryParams.toString();
    
    // Proxy request to S3
    const s3Response = await proxyToS3(req, credentials, path, query);
    
    // Return S3 response with CORS headers
    const responseHeaders = new Headers(corsHeaders);
    
    // Copy relevant S3 headers
    ['content-type', 'content-length', 'etag', 'last-modified'].forEach(header => {
      const value = s3Response.headers.get(header);
      if (value) {
        responseHeaders.set(header, value);
      }
    });
    
    const responseBody = await s3Response.arrayBuffer();
    
    console.log('✅ Successfully proxied S3 response');
    
    return new Response(responseBody, {
      status: s3Response.status,
      headers: responseHeaders,
    });
    
  } catch (error) {
    console.error('❌ Proxy error:', error);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
};

Deno.serve(handler);