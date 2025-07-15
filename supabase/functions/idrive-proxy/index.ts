const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log('🚀 IDrive proxy starting...');

Deno.serve(async (req: Request): Promise<Response> => {
  console.log('📥 Request:', req.method, req.url);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight handled');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const bucketName = url.searchParams.get('bucket') || 'default-bucket';
    
    console.log('🪣 Processing bucket:', bucketName);
    
    // Return a simple XML response for testing
    const xmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>${bucketName}</Name>
  <Prefix></Prefix>
  <Marker></Marker>
  <MaxKeys>1000</MaxKeys>
  <IsTruncated>false</IsTruncated>
</ListBucketResult>`;

    console.log('✅ Returning XML response');

    return new Response(xmlResponse, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml',
      },
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    
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
});