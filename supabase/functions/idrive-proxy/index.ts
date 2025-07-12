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
    const { data: sharedCredsArray } = await supabase
      .from('shared_storage_credentials')
      .select('*')
      .eq('bucket_name', bucketName)
      .eq('is_active', true)
      .limit(1)

    const sharedCreds = sharedCredsArray?.[0] || null

    if (sharedCreds) {
      return {
        access_key: sharedCreds.access_key,
        secret_key: sharedCreds.secret_key,
        endpoint_url: sharedCreds.endpoint_url,
        bucket_name: sharedCreds.bucket_name,
      }
    }

    // Then try admin storage credentials
    const { data: adminCredsArray } = await supabase
      .from('admin_storage_credentials')
      .select('*')
      .eq('bucket_name', bucketName)
      .eq('is_active', true)
      .limit(1)

    const adminCreds = adminCredsArray?.[0] || null

    if (adminCreds) {
      return {
        access_key: adminCreds.access_key,
        secret_key: adminCreds.secret_key,
        endpoint_url: adminCreds.endpoint_url,
        bucket_name: adminCreds.bucket_name,
      }
    }

    // Finally try artist storage credentials
    const { data: artistCredsArray } = await supabase
      .from('artist_storage_credentials')
      .select('*')
      .eq('bucket_name', bucketName)
      .limit(1)

    const artistCreds = artistCredsArray?.[0] || null

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

// Extract region from endpoint URL
function extractRegionFromEndpoint(endpointUrl: string): string {
  try {
    const url = new URL(endpointUrl)
    // For iDrive e2, the region is often embedded in the hostname
    // e.g., e0a7.ldn203.idrivee2-99.com -> use 'us-east-1' as default for S3 compatibility
    return 'us-east-1'
  } catch {
    return 'us-east-1'
  }
}

async function createSignedHeaders(
  method: string,
  url: string,
  credentials: StorageCredentials,
  contentType?: string
) {
  console.log('Creating signed headers for:', { method, url, contentType })
  
  const urlObj = new URL(url)
  const host = urlObj.hostname
  const region = extractRegionFromEndpoint(credentials.endpoint_url)
  
  // Create timestamp in UTC
  const now = new Date()
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '')
  const dateStamp = amzDate.substring(0, 8)
  
  console.log('Timestamp info:', { amzDate, dateStamp, region })
  
  // Normalize the path - ensure it starts with / and handle encoding
  let canonicalUri = urlObj.pathname
  if (!canonicalUri.startsWith('/')) {
    canonicalUri = '/' + canonicalUri
  }
  // Don't double-encode if already encoded
  if (!canonicalUri.includes('%')) {
    canonicalUri = encodeURI(canonicalUri).replace(/[!'()*]/g, function(c) {
      return '%' + c.charCodeAt(0).toString(16).toUpperCase()
    })
  }
  
  // Sort query parameters for canonical query string
  const searchParams = new URLSearchParams(urlObj.search)
  const sortedParams = Array.from(searchParams.entries()).sort()
  const canonicalQuerystring = sortedParams
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
  
  console.log('Canonical components:', { canonicalUri, canonicalQuerystring })
  
  // Create canonical headers (must be sorted)
  const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`
  const signedHeaders = 'host;x-amz-date'
  
  // Create payload hash (empty for GET requests)
  const payloadHash = await sha256('')
  
  // Create canonical request
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n')
  
  console.log('Canonical request:', canonicalRequest)
  
  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256'
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`
  const canonicalRequestHash = await sha256(canonicalRequest)
  
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    canonicalRequestHash
  ].join('\n')
  
  console.log('String to sign:', stringToSign)
  
  // Calculate signature
  const signingKey = await getSignatureKey(credentials.secret_key, dateStamp, region, 's3')
  const signature = await hmacSha256(signingKey, stringToSign)
  
  console.log('Generated signature:', signature)
  
  // Create authorization header
  const authorizationHeader = `${algorithm} Credential=${credentials.access_key}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
  
  const headers: Record<string, string> = {
    'Host': host,
    'X-Amz-Date': amzDate,
    'Authorization': authorizationHeader
  }
  
  if (contentType) {
    headers['Content-Type'] = contentType
  }
  
  console.log('Final headers:', headers)
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

    console.log('Request details:', { 
      method: req.method, 
      path, 
      bucketName, 
      fullUrl: req.url 
    })

    if (!bucketName) {
      console.error('Missing bucket parameter')
      return new Response('Bucket name is required', { status: 400, headers: corsHeaders })
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables')
      return new Response('Server configuration error', { status: 500, headers: corsHeaders })
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get storage credentials
    const credentials = await getStorageCredentials(supabase, bucketName)
    if (!credentials) {
      console.error('Storage credentials not found for bucket:', bucketName)
      return new Response('Storage credentials not found', { status: 404, headers: corsHeaders })
    }

    console.log('Found credentials for bucket:', { 
      bucket: credentials.bucket_name, 
      endpoint: credentials.endpoint_url 
    })

    // Build the target URL - for listing bucket contents, use empty path
    let targetUrl = `${credentials.endpoint_url}/${bucketName}`
    
    // Add query parameters for proper S3 directory listing
    const queryParams = new URLSearchParams()
    
    if (path) {
      queryParams.set('prefix', path)
    }
    
    // Add delimiter to get folder structure
    queryParams.set('delimiter', '/')
    
    if (queryParams.toString()) {
      targetUrl += '?' + queryParams.toString()
    }
    
    console.log('Target URL with params:', targetUrl)

    // Validate target URL
    try {
      new URL(targetUrl)
    } catch (urlError) {
      console.error('Invalid target URL:', targetUrl, urlError)
      return new Response('Invalid storage endpoint configuration', { status: 500, headers: corsHeaders })
    }

    // Create signed headers
    console.log('Creating signed request...')
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

    console.log('Making request to iDrive e2...')
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: signedHeaders,
      body: body,
    })

    console.log('iDrive e2 response:', { 
      status: response.status, 
      statusText: response.statusText 
    })

    // If there's an error response, log the body for debugging
    if (!response.ok) {
      const errorText = await response.text()
      console.error('iDrive e2 error response:', errorText)
      return new Response(errorText, {
        status: response.status,
        statusText: response.statusText,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      })
    }

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
    console.error('Error stack:', error.stack)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        type: error.constructor.name,
        details: 'Check function logs for more information'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})