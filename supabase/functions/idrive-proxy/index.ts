const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

Deno.serve(async (req: Request): Promise<Response> => {
  console.log('📥 IDrive proxy request:', req.method, req.url);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const bucketName = url.searchParams.get('bucket') || 'default';
    const prefix = url.searchParams.get('prefix') || '';
    
    console.log('🪣 Processing bucket:', bucketName, 'prefix:', prefix);
    
    // Return mock data for shared/gallery buckets, empty for others
    const isSharedBucket = bucketName.includes('shared') || bucketName.includes('gallery');
    
    let xmlContent = '';
    if (isSharedBucket) {
      xmlContent = `
  <Contents>
    <Key>documents/sample.pdf</Key>
    <Size>1024000</Size>
    <LastModified>2024-01-15T12:00:00.000Z</LastModified>
  </Contents>
  <Contents>
    <Key>images/photo.jpg</Key>
    <Size>2048000</Size>
    <LastModified>2024-01-15T12:30:00.000Z</LastModified>
  </Contents>
  <CommonPrefixes>
    <Prefix>documents/</Prefix>
  </CommonPrefixes>
  <CommonPrefixes>
    <Prefix>images/</Prefix>
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

    console.log('✅ Returning XML response');

    return new Response(response, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml',
      },
    });
    
  } catch (error) {
    console.error('❌ Error in idrive-proxy:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      success: false 
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
});