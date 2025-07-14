import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('iDrive proxy function called:', req.method, req.url)
    
    const url = new URL(req.url)
    const bucketName = url.searchParams.get('bucket')
    const prefix = url.searchParams.get('prefix') || ''

    console.log('Parameters:', { bucketName, prefix })

    if (!bucketName) {
      return new Response('Missing bucket parameter', { 
        status: 400, 
        headers: corsHeaders 
      })
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase environment variables')
      return new Response('Server configuration error', { 
        status: 500, 
        headers: corsHeaders 
      })
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get storage credentials from database
    console.log('Fetching credentials for bucket:', bucketName)
    
    // Try shared storage first
    const { data: sharedCreds } = await supabase
      .from('shared_storage_credentials')
      .select('*')
      .eq('bucket_name', bucketName)
      .eq('is_active', true)
      .limit(1)
      .single()
    
    if (sharedCreds) {
      console.log('Using shared storage credentials')
      return new Response(JSON.stringify({
        message: 'Found shared storage credentials',
        bucket: bucketName,
        credentials: {
          endpoint: sharedCreds.endpoint_url,
          bucket: sharedCreds.bucket_name
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Try admin storage
    const { data: adminCreds } = await supabase
      .from('admin_storage_credentials')
      .select('*')
      .eq('bucket_name', bucketName)
      .eq('is_active', true)
      .limit(1)
      .single()
    
    if (adminCreds) {
      console.log('Using admin storage credentials')
      return new Response(JSON.stringify({
        message: 'Found admin storage credentials',
        bucket: bucketName,
        credentials: {
          endpoint: adminCreds.endpoint_url,
          bucket: adminCreds.bucket_name
        }
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('No credentials found for bucket:', bucketName)
    return new Response('No storage credentials found', { 
      status: 404, 
      headers: corsHeaders 
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