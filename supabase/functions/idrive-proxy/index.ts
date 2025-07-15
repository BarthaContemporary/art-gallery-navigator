console.log('🚀 Edge function starting up...');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  console.log('📥 Request received:', req.method, req.url);
  
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const bucketName = url.searchParams.get('bucket');
    
    console.log('🔍 Processing request for bucket:', bucketName);
    
    const response = {
      success: true,
      message: 'Edge function working!',
      bucket: bucketName,
      timestamp: new Date().toISOString(),
      url: req.url,
    };

    console.log('✅ Sending response:', response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
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
};

Deno.serve(handler);