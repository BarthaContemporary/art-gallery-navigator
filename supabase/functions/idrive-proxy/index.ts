// Simple test version to verify deployment and connectivity
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  console.log('🚀 Edge function invoked:', req.method, req.url);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('iDrive proxy function called:', req.method, req.url)
    
    const url = new URL(req.url)
    const bucketName = url.searchParams.get('bucket')
    const prefix = url.searchParams.get('prefix') || ''
    const key = url.searchParams.get('key') || ''
    const operation = url.searchParams.get('operation') || 'list'

    console.log('📋 Request details:', {
      method: req.method,
      pathname: url.pathname,
      searchParams: Object.fromEntries(url.searchParams),
      headers: Object.fromEntries(req.headers.entries())
    });

    // Simple test response for now
    const response = {
      success: true,
      message: 'Edge function is working!',
      timestamp: new Date().toISOString(),
      method: req.method,
      path: url.pathname,
      params: Object.fromEntries(url.searchParams),
      bucketName,
      prefix,
      key,
      operation
    };

    console.log('✅ Sending response:', response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    })

  } catch (error) {
    console.error('Error in idrive-proxy:', error)
    return new Response(JSON.stringify({ 
      error: error.message,
      type: error.constructor.name 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})