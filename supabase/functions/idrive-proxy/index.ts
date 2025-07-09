import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface StorageCredentials {
  access_key: string
  secret_key: string
  endpoint_url: string
  bucket_name: string
}

async function getStorageCredentials(supabase: any, bucketName: string): Promise<StorageCredentials | null> {
  try {
    // First try shared storage credentials
    const { data: sharedCreds } = await supabase
      .from('shared_storage_credentials')
      .select('*')
      .eq('bucket_name', bucketName)
      .eq('is_active', true)
      .single()

    if (sharedCreds) {
      return {
        access_key: sharedCreds.access_key,
        secret_key: sharedCreds.secret_key,
        endpoint_url: sharedCreds.endpoint_url,
        bucket_name: sharedCreds.bucket_name,
      }
    }

    // Then try artist storage credentials
    const { data: artistCreds } = await supabase
      .from('artist_storage_credentials')
      .select('*')
      .eq('bucket_name', bucketName)
      .single()

    if (artistCreds) {
      return {
        access_key: artistCreds.access_key,
        secret_key: artistCreds.secret_key,
        endpoint_url: artistCreds.endpoint_url,
        bucket_name: artistCreds.bucket_name,
      }
    }

    return null
  } catch (error) {
    console.error('Error fetching storage credentials:', error)
    return null
  }
}

async function createSignedHeaders(
  method: string,
  url: string,
  credentials: StorageCredentials,
  contentType?: string
) {
  const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '')
  const datestamp = timestamp.substr(0, 8)
  
  const headers: Record<string, string> = {
    'Host': new URL(credentials.endpoint_url).host,
    'X-Amz-Date': timestamp,
  }

  if (contentType) {
    headers['Content-Type'] = contentType
  }

  // Create canonical headers
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map(key => `${key.toLowerCase()}:${headers[key]}`)
    .join('\n') + '\n'

  const signedHeaders = Object.keys(headers)
    .sort()
    .map(key => key.toLowerCase())
    .join(';')

  // Create canonical request
  const canonicalRequest = [
    method,
    new URL(url).pathname,
    new URL(url).search.slice(1),
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD'
  ].join('\n')

  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256'
  const credentialScope = `${datestamp}/us-east-1/s3/aws4_request`
  const stringToSign = [
    algorithm,
    timestamp,
    credentialScope,
    await sha256(canonicalRequest)
  ].join('\n')

  // Calculate signature
  const signingKey = await getSignatureKey(credentials.secret_key, datestamp, 'us-east-1', 's3')
  const signature = await hmacSha256(signingKey, stringToSign)

  headers['Authorization'] = `${algorithm} Credential=${credentials.access_key}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  return headers
}

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hmacSha256(key: ArrayBuffer, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message))
  const hashArray = Array.from(new Uint8Array(signature))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

async function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Promise<ArrayBuffer> {
  const kDate = await hmacSha256Bytes('AWS4' + key, dateStamp)
  const kRegion = await hmacSha256Bytes(kDate, regionName)
  const kService = await hmacSha256Bytes(kRegion, serviceName)
  const kSigning = await hmacSha256Bytes(kService, 'aws4_request')
  return kSigning
}

async function hmacSha256Bytes(key: string | ArrayBuffer, message: string): Promise<ArrayBuffer> {
  const keyBuffer = typeof key === 'string' ? new TextEncoder().encode(key) : key
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  return await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message))
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/functions/v1/idrive-proxy/')
    const path = pathParts[1] || ''
    const bucketName = url.searchParams.get('bucket')

    if (!bucketName) {
      return new Response('Bucket name is required', { status: 400, headers: corsHeaders })
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get storage credentials
    const credentials = await getStorageCredentials(supabase, bucketName)
    if (!credentials) {
      return new Response('Storage credentials not found', { status: 404, headers: corsHeaders })
    }

    // Build the target URL - for listing bucket contents, use empty path
    const targetUrl = path ? `${credentials.endpoint_url}/${bucketName}/${path}` : `${credentials.endpoint_url}/${bucketName}`
    console.log('Target URL:', targetUrl)

    // Create signed headers
    const signedHeaders = await createSignedHeaders(
      req.method,
      targetUrl,
      credentials,
      req.headers.get('content-type') || undefined
    )

    // Forward the request to iDrive e2
    let body: ArrayBuffer | undefined = undefined
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = await req.arrayBuffer()
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: signedHeaders,
      body: body,
    })

    // Return the response with CORS headers
    const responseHeaders = { ...corsHeaders }
    response.headers.forEach((value, key) => {
      if (!key.toLowerCase().startsWith('access-control-')) {
        responseHeaders[key] = value
      }
    })

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (error) {
    console.error('Error in idrive-proxy:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})