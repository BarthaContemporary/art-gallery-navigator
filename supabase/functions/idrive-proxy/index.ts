import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

// Helper: Check if user has a specific role using the service client
async function checkUserRole(serviceClient: any, userId: string, role: string): Promise<boolean> {
  const { data, error } = await serviceClient.rpc('has_role', { _user_id: userId, _role: role });
  if (error) {
    console.error('Error checking role:', error);
    return false;
  }
  return data === true;
}

// Helper: Check if user owns a specific artist record
async function isArtistOwner(serviceClient: any, userId: string, artistId: string): Promise<boolean> {
  const { data, error } = await serviceClient
    .from('artists')
    .select('id')
    .eq('id', artistId)
    .eq('user_id', userId)
    .maybeSingle();
  return !error && !!data;
}

// Helper: Get authorized credentials for a bucket with proper access control
async function getAuthorizedCredentials(
  serviceClient: any,
  userId: string,
  bucketName: string
): Promise<any | null> {
  // Shared bucket: all authenticated users can access
  if (bucketName === 'gallerysharedbucket') {
    const { data, error } = await serviceClient
      .from('shared_storage_credentials')
      .select('*')
      .eq('is_active', true)
      .limit(1);
    
    if (error || !data?.[0]) {
      console.error('Error fetching shared credentials:', error);
      return null;
    }
    return data[0];
  }

  // Admin bucket: only gallery_admin can access
  const isAdmin = await checkUserRole(serviceClient, userId, 'gallery_admin');
  
  if (isAdmin) {
    const { data: adminData, error: adminError } = await serviceClient
      .from('admin_storage_credentials')
      .select('*')
      .eq('bucket_name', bucketName)
      .eq('is_active', true)
      .limit(1);
    
    if (!adminError && adminData?.[0]) {
      return adminData[0];
    }
  }

  // Artist bucket: only the owning artist or admin can access
  const { data: artistCred, error: artistError } = await serviceClient
    .from('artist_storage_credentials')
    .select('*, artists!inner(user_id)')
    .eq('bucket_name', bucketName)
    .limit(1);

  if (!artistError && artistCred?.[0]) {
    const artistUserId = (artistCred[0] as any).artists?.user_id;
    // Allow if user is the artist owner OR is admin
    if (artistUserId === userId || isAdmin) {
      return artistCred[0];
    }
    console.warn(`User ${userId} denied access to artist bucket ${bucketName} (owner: ${artistUserId})`);
    return null;
  }

  console.error('No credentials found for bucket:', bucketName);
  return null;
}

// AWS S3 signing helpers
async function createSigningKey(secretKey: string, dateString: string, region: string): Promise<ArrayBuffer> {
  const kSecret = new TextEncoder().encode(`AWS4${secretKey}`);
  const kDate = await crypto.subtle.importKey(
    'raw', kSecret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  ).then(key => crypto.subtle.sign('HMAC', key, new TextEncoder().encode(dateString)));
  
  const kRegion = await crypto.subtle.importKey(
    'raw', kDate, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  ).then(key => crypto.subtle.sign('HMAC', key, new TextEncoder().encode(region)));
  
  const kService = await crypto.subtle.importKey(
    'raw', kRegion, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  ).then(key => crypto.subtle.sign('HMAC', key, new TextEncoder().encode('s3')));
  
  return await crypto.subtle.importKey(
    'raw', kService, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  ).then(key => crypto.subtle.sign('HMAC', key, new TextEncoder().encode('aws4_request')));
}

async function signRequest(stringToSign: string, signingKey: ArrayBuffer): Promise<string> {
  return await crypto.subtle.importKey(
    'raw', signingKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  ).then(key => crypto.subtle.sign('HMAC', key, new TextEncoder().encode(stringToSign)))
    .then(sig => Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(''));
}

async function sha256Hex(data: string): Promise<string> {
  return await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
    .then(hash => Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(''));
}

async function handleUpload(body: any, serviceClient: any, userId: string): Promise<Response> {
  try {
    const { bucket: bucketName, key, file: fileBase64, contentType } = body;
    
    if (!bucketName || !key || !fileBase64) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get storage credentials with authorization checks
    const credentials = await getAuthorizedCredentials(serviceClient, userId, bucketName);
    
    if (!credentials) {
      return new Response(JSON.stringify({ error: 'Access denied or no credentials found for bucket' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Convert base64 to binary
    const base64Data = fileBase64.split(',')[1];
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    // Create AWS signature for PUT request
    const now = new Date();
    const dateString = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeString = now.toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
    
    const host = credentials.endpoint_url.replace('https://', '');
    const region = credentials.region || 'us-east-1';
    
    const method = 'PUT';
    const uri = `/${bucketName}/${key}`;
    
    const canonicalHeaders = [
      `host:${host}`,
      `x-amz-content-sha256:UNSIGNED-PAYLOAD`,
      `x-amz-date:${timeString}`
    ].join('\n') + '\n';
    
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    
    const canonicalRequest = [
      method, uri, '', canonicalHeaders, signedHeaders, 'UNSIGNED-PAYLOAD'
    ].join('\n');
    
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateString}/${region}/s3/aws4_request`;
    const stringToSign = [
      algorithm, timeString, credentialScope, await sha256Hex(canonicalRequest)
    ].join('\n');
    
    const signingKey = await createSigningKey(credentials.secret_key, dateString, region);
    const signature = await signRequest(stringToSign, signingKey);
    
    const authorization = `${algorithm} Credential=${credentials.access_key}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    
    const uploadUrl = `${credentials.endpoint_url}${uri}`;
    
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Host': host,
        'Authorization': authorization,
        'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD',
        'X-Amz-Date': timeString,
        'Content-Type': contentType || 'application/octet-stream'
      },
      body: binaryData
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Upload failed:', uploadResponse.status, errorText);
      return new Response(JSON.stringify({ error: 'Upload failed', details: errorText }), {
        status: uploadResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, message: 'File uploaded successfully' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Upload error:', error);
    return new Response(JSON.stringify({ error: 'Upload failed', message: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  console.log('Request received:', req.method, req.url);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use anon key client for user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Validate user identity
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    
    if (userError || !user) {
      console.error('User authentication failed:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Authenticated user:', user.id);

    // Service client for privileged DB operations (credential lookups only, after auth checks)
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let bucketName = 'default';
    let prefix = '';

    if (req.method === 'POST') {
      const body = await req.json();
      
      if (body.action === 'upload') {
        return await handleUpload(body, serviceClient, user.id);
      }
      
      bucketName = body.bucket || 'default';
      prefix = body.prefix || '';
    } else {
      const url = new URL(req.url);
      bucketName = url.searchParams.get('bucket') || 'default';
      prefix = url.searchParams.get('prefix') || '';
    }
    
    console.log('Processing bucket:', bucketName, 'prefix:', prefix);

    // Get storage credentials with authorization checks
    const credentials = await getAuthorizedCredentials(serviceClient, user.id, bucketName);
    
    if (!credentials) {
      return new Response(JSON.stringify({ error: 'Access denied or no credentials found for bucket' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Found authorized credentials for bucket:', bucketName);

    // Create proper S3 signature for listing
    const now = new Date();
    const dateString = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeString = now.toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
    
    const host = credentials.endpoint_url.replace('https://', '');
    const region = credentials.region || 'us-east-1';
    
    const method = 'GET';
    const uri = `/${bucketName}`;
    
    const queryParts: string[] = [];
    queryParts.push('list-type=2');
    queryParts.push('max-keys=1000');
    
    if (prefix) {
      const encodedPrefix = encodeURIComponent(prefix)
        .replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
      queryParts.push(`prefix=${encodedPrefix}`);
    }
    
    queryParts.sort();
    const queryString = queryParts.join('&');
    
    const canonicalHeaders = [
      `host:${host}`,
      `x-amz-content-sha256:UNSIGNED-PAYLOAD`,
      `x-amz-date:${timeString}`
    ].join('\n') + '\n';
    
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    
    const canonicalRequest = [
      method, uri, queryString, canonicalHeaders, signedHeaders, 'UNSIGNED-PAYLOAD'
    ].join('\n');
    
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateString}/${region}/s3/aws4_request`;
    const stringToSign = [
      algorithm, timeString, credentialScope, await sha256Hex(canonicalRequest)
    ].join('\n');
    
    const signingKey = await createSigningKey(credentials.secret_key, dateString, region);
    const signature = await signRequest(stringToSign, signingKey);
    
    const authorization = `${algorithm} Credential=${credentials.access_key}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    
    const storageUrl = `${credentials.endpoint_url}${uri}?${queryString}`;
    
    const storageResponse = await fetch(storageUrl, {
      method: 'GET',
      headers: {
        'Host': host,
        'Authorization': authorization,
        'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD',
        'X-Amz-Date': timeString,
        'Content-Type': 'application/xml'
      }
    });

    if (!storageResponse.ok) {
      console.error('Storage provider error:', storageResponse.status, storageResponse.statusText);
      
      const emptyResponse = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>${bucketName}</Name>
  <Prefix>${prefix}</Prefix>
  <Marker></Marker>
  <MaxKeys>1000</MaxKeys>
  <IsTruncated>false</IsTruncated>
</ListBucketResult>`;

      return new Response(emptyResponse, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/xml' },
      });
    }

    const xmlResponse = await storageResponse.text();

    return new Response(xmlResponse, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/xml' },
    });
    
  } catch (error) {
    console.error('Error in idrive-proxy:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
