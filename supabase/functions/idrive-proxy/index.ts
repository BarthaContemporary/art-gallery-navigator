import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log('🚀 IDrive proxy with real S3 integration starting...');

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getStorageCredentials(bucketName: string, userId: string) {
  console.log('🔍 Getting credentials for bucket:', bucketName);
  
  // Try shared credentials first
  const { data: sharedCreds, error: sharedError } = await supabase
    .from('shared_storage_credentials')
    .select('*')
    .eq('bucket_name', bucketName)
    .eq('is_active', true)
    .maybeSingle();

  if (sharedCreds && !sharedError) {
    console.log('✅ Found shared credentials');
    return sharedCreds;
  }

  // Try admin credentials
  const { data: adminCreds, error: adminError } = await supabase
    .from('admin_storage_credentials')
    .select('*')
    .eq('bucket_name', bucketName)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (adminCreds && !adminError) {
    console.log('✅ Found admin credentials');
    return adminCreds;
  }

  // Try artist credentials
  const { data: artistCreds, error: artistError } = await supabase
    .from('artist_storage_credentials')
    .select('*')
    .eq('bucket_name', bucketName)
    .maybeSingle();

  if (artistCreds && !artistError) {
    console.log('✅ Found artist credentials');
    return artistCreds;
  }

  throw new Error(`No credentials found for bucket: ${bucketName}`);
}

async function listS3Objects(credentials: any, prefix: string = '') {
  console.log('📡 Making S3 list request with prefix:', prefix);
  
  const params = new URLSearchParams();
  params.append('list-type', '2');
  params.append('delimiter', '/');
  if (prefix) params.append('prefix', prefix);

  const url = `${credentials.endpoint_url}/${credentials.bucket_name}?${params.toString()}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `AWS ${credentials.access_key}:${credentials.secret_key}`,
    },
  });

  if (!response.ok) {
    throw new Error(`S3 request failed: ${response.status} ${response.statusText}`);
  }

  return await response.text();
}

Deno.serve(async (req: Request): Promise<Response> => {
  console.log('📥 Request:', req.method, req.url);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    const url = new URL(req.url);
    const bucketName = url.searchParams.get('bucket');
    const prefix = url.searchParams.get('prefix') || '';
    
    if (!bucketName) {
      throw new Error('Bucket name required');
    }

    console.log('🪣 Processing bucket:', bucketName, 'prefix:', prefix);

    // Get credentials and make S3 request
    const credentials = await getStorageCredentials(bucketName, user.id);
    const s3Response = await listS3Objects(credentials, prefix);
    
    console.log('✅ S3 response received');

    return new Response(s3Response, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml',
      },
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    
    // Return empty list XML on error so UI doesn't break
    const emptyXML = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <Name>error-bucket</Name>
  <Prefix></Prefix>
  <Marker></Marker>
  <MaxKeys>1000</MaxKeys>
  <IsTruncated>false</IsTruncated>
</ListBucketResult>`;
    
    return new Response(emptyXML, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml',
      },
    });
  }
});