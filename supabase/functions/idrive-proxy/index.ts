// Simple test version to verify deployment and connectivity
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log('🚀 Edge function loaded successfully');

Deno.serve(async (req) => {
  console.log('🔥 Request received:', req.method, req.url);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight request');
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  try {
    const url = new URL(req.url);
    console.log('📋 Request details:', {
      method: req.method,
      pathname: url.pathname,
      search: url.search,
      searchParams: Object.fromEntries(url.searchParams),
      headers: Object.fromEntries(req.headers.entries())
    });

    // Extract parameters
    const bucketName = url.searchParams.get('bucket');
    const prefix = url.searchParams.get('prefix') || '';
    const operation = url.searchParams.get('operation') || 'list';

    console.log('Parameters extracted:', { bucketName, prefix, operation });

    // For testing, return a simple JSON response
    const response = {
      success: true,
      message: 'Edge function is working!',
      timestamp: new Date().toISOString(),
      request: {
        method: req.method,
        pathname: url.pathname,
        search: url.search,
        bucketName,
        prefix,
        operation
      }
    };

    console.log('✅ Sending test response:', response);

    return new Response(JSON.stringify(response, null, 2), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('❌ Edge function error:', error);
    
    const errorResponse = {
      success: false,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(errorResponse, null, 2), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
});