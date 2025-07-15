const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log('✅ IDrive proxy function initialized');

function buildXMLResponse(bucketName: string, prefix: string, hasContent: boolean) {
  const nameElement = 'Name';
  const prefixElement = 'Prefix';
  
  let contentXML = '';
  if (hasContent) {
    contentXML = `
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
    <${prefixElement}>documents/</${prefixElement}>
  </CommonPrefixes>
  <CommonPrefixes>
    <${prefixElement}>images/</${prefixElement}>
  </CommonPrefixes>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <${nameElement}>${bucketName}</${nameElement}>
  <${prefixElement}>${prefix}</${prefixElement}>
  <Marker></Marker>
  <MaxKeys>1000</MaxKeys>
  <IsTruncated>false</IsTruncated>${contentXML}
</ListBucketResult>`;
}

Deno.serve(async (req: Request): Promise<Response> => {
  console.log('📥 Request:', req.method, req.url);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const bucketName = url.searchParams.get('bucket') || 'test';
    const prefix = url.searchParams.get('prefix') || '';
    
    console.log('🪣 Processing:', bucketName, 'prefix:', prefix);
    
    // Check if this is a shared/gallery bucket that should have sample content
    const shouldHaveContent = bucketName.includes('shared') || bucketName.includes('gallery');
    
    const xmlResponse = buildXMLResponse(bucketName, prefix, shouldHaveContent);

    console.log('✅ XML response generated');

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