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
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
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

    const url = new URL(req.url);
    const bucketName = url.searchParams.get('bucket') || 'default';
    const prefix = url.searchParams.get('prefix') || '';
    
    console.log('Processing bucket:', bucketName, 'prefix:', prefix);
    
    // Determine bucket type and return appropriate mock data
    const isSharedBucket = bucketName === 'gallerysharedbucket';
    const isAdminBucket = bucketName === 'bclondon';
    
    let xmlContent = '';
    if (isSharedBucket) {
      xmlContent = `
  <Contents>
    <Key>shared-document.pdf</Key>
    <Size>1024000</Size>
    <LastModified>2024-01-15T12:00:00.000Z</LastModified>
  </Contents>
  <Contents>
    <Key>shared-image.jpg</Key>
    <Size>2048000</Size>
    <LastModified>2024-01-15T12:30:00.000Z</LastModified>
  </Contents>
  <CommonPrefixes>
    <Prefix>documents/</Prefix>
  </CommonPrefixes>
  <CommonPrefixes>
    <Prefix>images/</Prefix>
  </CommonPrefixes>`;
    } else if (isAdminBucket) {
      xmlContent = `
  <Contents>
    <Key>admin-report.pdf</Key>
    <Size>512000</Size>
    <LastModified>2024-01-15T14:00:00.000Z</LastModified>
  </Contents>
  <Contents>
    <Key>admin-data.xlsx</Key>
    <Size>256000</Size>
    <LastModified>2024-01-15T14:30:00.000Z</LastModified>
  </Contents>
  <CommonPrefixes>
    <Prefix>reports/</Prefix>
  </CommonPrefixes>`;
    } else {
      xmlContent = `
  <Contents>
    <Key>artwork-1.jpg</Key>
    <Size>3072000</Size>
    <LastModified>2024-01-15T16:00:00.000Z</LastModified>
  </Contents>
  <Contents>
    <Key>portfolio.pdf</Key>
    <Size>8192000</Size>
    <LastModified>2024-01-15T16:30:00.000Z</LastModified>
  </Contents>
  <CommonPrefixes>
    <Prefix>artworks/</Prefix>
  </CommonPrefixes>
  <CommonPrefixes>
    <Prefix>documents/</Prefix>
  </CommonPrefixes>`;
    }

    const response = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>${bucketName}</Name>
  <Prefix>${prefix}</Prefix>
  <Marker></Marker>
  <MaxKeys>1000</MaxKeys>
  <IsTruncated>false</IsTruncated>${xmlContent}
</ListBucketResult>`;

    console.log('Returning response for bucket:', bucketName);

    return new Response(response, {
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