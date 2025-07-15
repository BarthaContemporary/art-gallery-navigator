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

async function getStorageCredentials(bucketName: string, userId: string) {
  console.log('🔍 Looking for credentials for bucket:', bucketName, 'user:', userId);
  
  try {
    // Try shared credentials first (simpler)
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

    console.error('❌ No credentials found for bucket:', bucketName, 'Error:', sharedError);
    throw new Error(`No storage credentials found for bucket: ${bucketName}`);
  } catch (error) {
    console.error('❌ Error getting credentials:', error);
    throw error;
  }
}

// Simple S3 XML list response generator for testing
function generateListXML(items: any[] = [], folders: any[] = []) {
  const xmlItems = items.map(item => 
    `<Contents>
      <Key>${item.key}</Key>
      <Size>${item.size || 0}</Size>
      <LastModified>${item.lastModified || new Date().toISOString()}</LastModified>
    </Contents>`
  ).join('');
  
  const xmlFolders = folders.map(folder =>
    `<CommonPrefixes>
      <Prefix>${folder.prefix}</Prefix>
    </CommonPrefixes>`
  ).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult>
  <Name>test-bucket</Name>
  <Prefix></Prefix>
  <Marker></Marker>
  <MaxKeys>1000</MaxKeys>
  <IsTruncated>false</IsTruncated>
  ${xmlFolders}
  ${xmlItems}
</ListBucketResult>`;
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
    
    // Get storage credentials to verify they exist
    const credentials = await getStorageCredentials(bucketName, user.id);
    console.log('✅ Got credentials for:', credentials.bucket_name);
    
    // For now, return empty list XML to test the flow
    const responseXML = generateListXML();
    
    console.log('✅ Returning XML response');
    
    return new Response(responseXML, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml',
      },
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