import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// AWS Signature V4 implementation
async function signRequest(
  method: string,
  url: string,
  accessKey: string,
  secretKey: string,
  region: string = 'us-east-1',
  service: string = 's3',
  payload: string = ''
) {
  const algorithm = 'AWS4-HMAC-SHA256'
  const date = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '')
  const dateStamp = date.substr(0, 8)
  
  const parsedUrl = new URL(url)
  const host = parsedUrl.host
  const canonicalUri = parsedUrl.pathname
  const canonicalQuerystring = parsedUrl.search.slice(1)
  
  const canonicalHeaders = `host:${host}\nx-amz-date:${date}\n`
  const signedHeaders = 'host;x-amz-date'
  
  const payloadHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload))
  const payloadHashHex = Array.from(new Uint8Array(payloadHash))
    .map(b => b.toString(16).padStart(2, '0')).join('')
  
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    payloadHashHex
  ].join('\n')
  
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = [
    algorithm,
    date,
    credentialScope,
    Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalRequest))))
      .map(b => b.toString(16).padStart(2, '0')).join('')
  ].join('\n')
  
  // Create signing key
  const getSignatureKey = async (key: string, dateStamp: string, regionName: string, serviceName: string) => {
    const kDate = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode('AWS4' + key),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const kRegion = await crypto.subtle.importKey(
      'raw',
      new Uint8Array(await crypto.subtle.sign('HMAC', kDate, new TextEncoder().encode(dateStamp))),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const kService = await crypto.subtle.importKey(
      'raw',
      new Uint8Array(await crypto.subtle.sign('HMAC', kRegion, new TextEncoder().encode(regionName))),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const kSigning = await crypto.subtle.importKey(
      'raw',
      new Uint8Array(await crypto.subtle.sign('HMAC', kService, new TextEncoder().encode(serviceName))),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    return await crypto.subtle.importKey(
      'raw',
      new Uint8Array(await crypto.subtle.sign('HMAC', kSigning, new TextEncoder().encode('aws4_request'))),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
  }
  
  const signingKey = await getSignatureKey(secretKey, dateStamp, region, service)
  const signature = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', signingKey, new TextEncoder().encode(stringToSign))))
    .map(b => b.toString(16).padStart(2, '0')).join('')
  
  const authorizationHeader = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  
  return {
    'Authorization': authorizationHeader,
    'X-Amz-Date': date,
    'Host': host
  }
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
    const key = url.searchParams.get('key') || ''
    const operation = url.searchParams.get('operation') || 'list'

    console.log('Parameters:', { bucketName, prefix, key, operation })

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
    
    let credentials = null
    
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
      credentials = sharedCreds
    } else {
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
        credentials = adminCreds
      }
    }

    if (!credentials) {
      console.log('No credentials found for bucket:', bucketName)
      return new Response('No storage credentials found', { 
        status: 404, 
        headers: corsHeaders 
      })
    }

    // Construct S3 URL
    const s3Url = new URL(`https://${credentials.endpoint_url.replace('https://', '')}/${credentials.bucket_name}`)
    
    if (operation === 'list') {
      if (prefix) {
        s3Url.searchParams.set('prefix', prefix)
      }
      s3Url.searchParams.set('list-type', '2')
    } else if (operation === 'get' && key) {
      s3Url.pathname += `/${key}`
    } else if (operation === 'put' && key) {
      s3Url.pathname += `/${key}`
    } else if (operation === 'createFolder' && key) {
      s3Url.pathname += `/${key}`
    }

    console.log('S3 URL:', s3Url.toString())

    // Sign the request
    const signedHeaders = await signRequest(
      req.method === 'PUT' ? 'PUT' : 'GET',
      s3Url.toString(),
      credentials.access_key,
      credentials.secret_key,
      credentials.region || 'us-east-1'
    )

    // Prepare headers for S3 request
    const s3Headers = {
      ...signedHeaders,
      'Content-Type': req.headers.get('content-type') || 'application/octet-stream'
    }

    // Handle different operations
    let s3Response
    
    if (operation === 'put' || operation === 'createFolder') {
      const body = operation === 'createFolder' ? '' : await req.arrayBuffer()
      s3Response = await fetch(s3Url.toString(), {
        method: 'PUT',
        headers: s3Headers,
        body: body
      })
    } else {
      s3Response = await fetch(s3Url.toString(), {
        method: 'GET',
        headers: s3Headers
      })
    }

    console.log('S3 Response status:', s3Response.status)

    if (!s3Response.ok) {
      const errorText = await s3Response.text()
      console.error('S3 Error:', errorText)
      return new Response(errorText, {
        status: s3Response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/xml' }
      })
    }

    // Forward the S3 response
    const responseBody = await s3Response.arrayBuffer()
    const responseHeaders = {
      ...corsHeaders,
      'Content-Type': s3Response.headers.get('content-type') || 'application/xml'
    }

    return new Response(responseBody, {
      status: s3Response.status,
      headers: responseHeaders
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