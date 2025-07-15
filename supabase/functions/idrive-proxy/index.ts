import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

Deno.serve(async (req: Request): Promise<Response> => {
  console.log('Request received:', req.method, req.url);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get the current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    
    if (userError || !user) {
      console.error('User authentication failed:', userError)
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Authenticated user:', user.id)

    let bucketName = 'default';
    let prefix = '';

    if (req.method === 'POST') {
      // Handle POST request with body data from supabase.functions.invoke
      const body = await req.json();
      bucketName = body.bucket || 'default';
      prefix = body.prefix || '';
    } else {
      // Handle GET request with query parameters (fallback)
      const url = new URL(req.url);
      bucketName = url.searchParams.get('bucket') || 'default';
      prefix = url.searchParams.get('prefix') || '';
    }
    
    console.log('Processing bucket:', bucketName, 'prefix:', prefix);

    // Get storage credentials from database
    let credentials = null;
    
    if (bucketName === 'gallerysharedbucket') {
      // Get shared storage credentials
      const { data, error } = await supabaseClient
        .from('shared_storage_credentials')
        .select('*')
        .eq('is_active', true)
        .limit(1);
      
      if (error) {
        console.error('Error fetching shared credentials:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch credentials' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      credentials = data?.[0];
    } else {
      // Check if it's an admin bucket
      const { data: adminData, error: adminError } = await supabaseClient
        .from('admin_storage_credentials')
        .select('*')
        .eq('bucket_name', bucketName)
        .eq('is_active', true)
        .limit(1);
      
      if (adminError) {
        console.error('Error fetching admin credentials:', adminError);
      } else if (adminData?.[0]) {
        credentials = adminData[0];
      } else {
        // Check if it's an artist bucket
        const { data: artistData, error: artistError } = await supabaseClient
          .from('artist_storage_credentials')
          .select('*')
          .eq('bucket_name', bucketName)
          .limit(1);
        
        if (artistError) {
          console.error('Error fetching artist credentials:', artistError);
        } else {
          credentials = artistData?.[0];
        }
      }
    }

    if (!credentials) {
      console.error('No credentials found for bucket:', bucketName);
      return new Response(JSON.stringify({ error: 'No credentials found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Found credentials for bucket:', bucketName);

    // Make request to actual storage provider
    const storageUrl = `${credentials.endpoint_url}/${bucketName}`;
    const params = new URLSearchParams();
    if (prefix) params.append('prefix', prefix);
    params.append('max-keys', '1000');
    params.append('list-type', '2'); // Use S3 v2 list format
    
    const fullUrl = `${storageUrl}?${params.toString()}`;
    console.log('Making request to storage provider:', fullUrl);

    // Create proper authentication headers for S3-compatible service
    const authHeader = `AWS ${credentials.access_key}:${credentials.secret_key}`;
    
    const storageResponse = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/xml',
        'x-amz-request-payer': 'BucketOwner'
      },
    });

    console.log('Storage response status:', storageResponse.status);
    console.log('Storage response headers:', Object.fromEntries(storageResponse.headers.entries()));

    if (!storageResponse.ok) {
      console.error('Storage provider error:', storageResponse.status, storageResponse.statusText);
      const errorText = await storageResponse.text();
      console.error('Storage provider error body:', errorText);
      
      // Return empty XML response instead of error to avoid breaking the UI
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
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/xml',
        },
      });
    }

    const xmlResponse = await storageResponse.text();
    console.log('Storage provider response length:', xmlResponse.length);

    return new Response(xmlResponse, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml',
      },
    });
    
  } catch (error) {
    console.error('Error in idrive-proxy:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      success: false,
      message: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
});