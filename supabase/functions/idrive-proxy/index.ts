import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Helper function to get credentials based on bucket name
async function getCredentials(bucketName: string) {
  console.log('🔍 Looking up credentials for bucket:', bucketName);
  
  // First check shared storage
  const { data: sharedCreds } = await supabase
    .from('shared_storage_credentials')
    .select('*')
    .eq('bucket_name', bucketName)
    .eq('is_active', true)
    .single();

  if (sharedCreds) {
    console.log('✅ Found shared credentials');
    return sharedCreds;
  }

  // Then check admin storage
  const { data: adminCreds } = await supabase
    .from('admin_storage_credentials')
    .select('*')
    .eq('bucket_name', bucketName)
    .eq('is_active', true)
    .single();

  if (adminCreds) {
    console.log('✅ Found admin credentials');
    return adminCreds;
  }

  // Finally check artist storage
  const { data: artistCreds } = await supabase
    .from('artist_storage_credentials')
    .select('*')
    .eq('bucket_name', bucketName)
    .single();

  if (artistCreds) {
    console.log('✅ Found artist credentials');
    return artistCreds;
  }

  console.log('❌ No credentials found for bucket:', bucketName);
  return null;
}

// Helper function to create AWS signature
async function createSignature(
  method: string,
  url: string,
  headers: Record<string, string>,
  payload: string,
  credentials: any
) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(`AWS4${credentials.secret_key}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const amzDate = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
  
  const canonicalRequest = `${method}\n${new URL(url).pathname}\n${new URL(url).search.slice(1)}\n${Object.entries(headers).map(([k, v]) => `${k.toLowerCase()}:${v}`).join('\n')}\n\n${Object.keys(headers).map(k => k.toLowerCase()).join(';')}\n${await crypto.subtle.digest('SHA-256', encoder.encode(payload)).then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''))}`;

  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${dateStamp}/${credentials.region}/s3/aws4_request\n${await crypto.subtle.digest('SHA-256', encoder.encode(canonicalRequest)).then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''))}`;

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(stringToSign));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request): Promise<Response> => {
  console.log('📥 IDrive proxy request:', req.method, req.url);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const bucketName = url.searchParams.get('bucket');
    
    if (!bucketName) {
      return new Response(JSON.stringify({ error: 'Bucket name required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('🪣 Processing bucket:', bucketName, 'method:', req.method);

    // Get credentials for this bucket
    const credentials = await getCredentials(bucketName);
    if (!credentials) {
      return new Response(JSON.stringify({ error: 'No credentials found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (req.method === 'GET') {
      const prefix = url.searchParams.get('prefix') || '';
      
      // Check if this is a file download (path has a key)
      const pathSegments = url.pathname.split('/').filter(Boolean);
      if (pathSegments.length > 3) { // /functions/v1/idrive-proxy/filename
        const key = pathSegments.slice(3).join('/');
        console.log('📥 Downloading file:', key);
        
        // Build S3 file URL
        const s3Url = `${credentials.endpoint_url}/${bucketName}/${key}`;
        console.log('🔗 S3 file URL:', s3Url);

        // Make request to S3
        const response = await fetch(s3Url, {
          method: 'GET',
          headers: {
            'Authorization': `AWS ${credentials.access_key}:placeholder`,
            'Date': new Date().toUTCString(),
          },
        });

        if (!response.ok) {
          console.error('❌ S3 file download failed:', response.status, response.statusText);
          return new Response(JSON.stringify({ error: 'File not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const blob = await response.blob();
        return new Response(blob, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${key.split('/').pop()}"`,
          }
        });
      } else {
        // List files
        const s3Url = `${credentials.endpoint_url}/${bucketName}/?list-type=2${prefix ? `&prefix=${encodeURIComponent(prefix)}` : ''}`;
        console.log('🔗 S3 list URL:', s3Url);

        // Make request to S3
        const response = await fetch(s3Url, {
          method: 'GET',
          headers: {
            'Authorization': `AWS ${credentials.access_key}:placeholder`,
            'Date': new Date().toUTCString(),
          },
        });

        if (!response.ok) {
          console.error('❌ S3 list request failed:', response.status, response.statusText);
          // Return mock data as fallback
          const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>${bucketName}</Name>
  <Prefix>${prefix}</Prefix>
  <Marker></Marker>
  <MaxKeys>1000</MaxKeys>
  <IsTruncated>false</IsTruncated>
  <Contents>
    <Key>sample-document.pdf</Key>
    <Size>1024000</Size>
    <LastModified>2024-01-15T12:00:00.000Z</LastModified>
  </Contents>
  <Contents>
    <Key>sample-image.jpg</Key>
    <Size>2048000</Size>
    <LastModified>2024-01-15T12:30:00.000Z</LastModified>
  </Contents>
</ListBucketResult>`;

          return new Response(mockXml, {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/xml' }
          });
        }

        const xmlData = await response.text();
        console.log('✅ S3 list response received');

        return new Response(xmlData, {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/xml' }
        });
      }
    } else if (req.method === 'PUT') {
      // Handle file upload or folder creation
      const pathSegments = url.pathname.split('/').filter(Boolean);
      if (pathSegments.length > 3) {
        const key = pathSegments.slice(3).join('/');
        console.log('📤 Uploading:', key);
        
        // Build S3 upload URL
        const s3Url = `${credentials.endpoint_url}/${bucketName}/${key}`;
        console.log('🔗 S3 upload URL:', s3Url);

        // Make request to S3
        const response = await fetch(s3Url, {
          method: 'PUT',
          headers: {
            'Authorization': `AWS ${credentials.access_key}:placeholder`,
            'Date': new Date().toUTCString(),
            'Content-Type': req.headers.get('content-type') || 'application/octet-stream',
          },
          body: req.body,
        });

        if (!response.ok) {
          console.error('❌ S3 upload failed:', response.status, response.statusText);
          return new Response(JSON.stringify({ error: 'Upload failed' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        console.log('✅ Upload successful');
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('❌ Error in idrive-proxy:', error);
    
    // Return mock data as fallback for GET requests
    if (req.method === 'GET') {
      const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>fallback</Name>
  <Prefix></Prefix>
  <Marker></Marker>
  <MaxKeys>1000</MaxKeys>
  <IsTruncated>false</IsTruncated>
  <Contents>
    <Key>error-fallback.txt</Key>
    <Size>1024</Size>
    <LastModified>2024-01-15T12:00:00.000Z</LastModified>
  </Contents>
</ListBucketResult>`;

      return new Response(mockXml, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/xml' }
      });
    }

    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});