import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

async function handleUpload(body: any, supabaseClient: any, userId: string): Promise<Response> {
  try {
    const { bucket: bucketName, key, file: fileBase64, contentType } = body;
    
    if (!bucketName || !key || !fileBase64) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get storage credentials with authorization checks
    const credentials = await getAuthorizedCredentials(supabaseClient, userId, bucketName);
    
    if (!credentials) {
      return new Response(JSON.stringify({ error: 'Access denied or no credentials found for bucket' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!credentials) {
      console.error('No credentials found for bucket:', bucketName);
      return new Response(JSON.stringify({ error: 'No credentials found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Found credentials for bucket:', bucketName);

    // Create proper S3 signature for iDrive e2
    const now = new Date();
    const dateString = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeString = now.toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
    
    const host = credentials.endpoint_url.replace('https://', '');
    const region = credentials.region || 'us-east-1';
    
    // Create the canonical request with proper URL encoding
    const method = 'GET';
    const uri = `/${bucketName}`;
    
    // Build query parameters manually with proper encoding
    const queryParts: string[] = [];
    queryParts.push('list-type=2');
    queryParts.push('max-keys=1000');
    
    if (prefix) {
      // URL encode the prefix properly for AWS canonical request
      // AWS requires percent-encoding for the canonical request
      const encodedPrefix = encodeURIComponent(prefix)
        .replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
      queryParts.push(`prefix=${encodedPrefix}`);
      console.log('Original prefix:', prefix);
      console.log('Encoded prefix for canonical request:', encodedPrefix);
    }
    
    // Sort alphabetically for AWS canonical request requirement
    queryParts.sort();
    const queryString = queryParts.join('&');
    
    const canonicalHeaders = [
      `host:${host}`,
      `x-amz-content-sha256:UNSIGNED-PAYLOAD`,
      `x-amz-date:${timeString}`
    ].join('\n') + '\n';
    
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    
    const canonicalRequest = [
      method,
      uri,
      queryString,
      canonicalHeaders,
      signedHeaders,
      'UNSIGNED-PAYLOAD'
    ].join('\n');
    
    console.log('Canonical request:', canonicalRequest);
    
    // Create string to sign
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateString}/${region}/s3/aws4_request`;
    const stringToSign = [
      algorithm,
      timeString,
      credentialScope,
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalRequest))
        .then(hash => Array.from(new Uint8Array(hash))
          .map(b => b.toString(16).padStart(2, '0'))
          .join(''))
    ].join('\n');
    
    console.log('String to sign:', stringToSign);
    
    // Create signing key
    const kSecret = new TextEncoder().encode(`AWS4${credentials.secret_key}`);
    const kDate = await crypto.subtle.importKey(
      'raw', kSecret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    ).then(key => crypto.subtle.sign('HMAC', key, new TextEncoder().encode(dateString)));
    
    const kRegion = await crypto.subtle.importKey(
      'raw', kDate, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    ).then(key => crypto.subtle.sign('HMAC', key, new TextEncoder().encode(region)));
    
    const kService = await crypto.subtle.importKey(
      'raw', kRegion, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    ).then(key => crypto.subtle.sign('HMAC', key, new TextEncoder().encode('s3')));
    
    const kSigning = await crypto.subtle.importKey(
      'raw', kService, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    ).then(key => crypto.subtle.sign('HMAC', key, new TextEncoder().encode('aws4_request')));
    
    const signature = await crypto.subtle.importKey(
      'raw', kSigning, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    ).then(key => crypto.subtle.sign('HMAC', key, new TextEncoder().encode(stringToSign)))
      .then(sig => Array.from(new Uint8Array(sig))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(''));
    
    const authorization = `${algorithm} Credential=${credentials.access_key}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    
    console.log('Authorization header:', authorization);
    
    // Make the authenticated request
    const storageUrl = `${credentials.endpoint_url}${uri}?${queryString}`;
    console.log('Final request URL:', storageUrl);
    
    const storageResponse = await fetch(storageUrl, {
      method: 'GET',
      headers: {
        'Host': host,
        'Authorization': authorization,
        'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD',
        'X-Amz-Date': timeString,
        'Content-Type': 'application/xml'
      }
    });

    console.log('Storage response status:', storageResponse.status);
    console.log('Storage response headers:', Object.fromEntries(storageResponse.headers.entries()));

    if (!storageResponse.ok) {
      console.error('Storage provider error:', storageResponse.status, storageResponse.statusText);
      const errorText = await storageResponse.text();
      console.error('Storage provider error body:', errorText);
      
      // Return empty XML response instead of error to avoid breaking the UI
      const emptyResponse = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>${bucketName}</Name>
  <Prefix>${prefix}</Prefix>
  <Marker></Marker>
  <MaxKeys>1000</MaxKeys>
  <IsTruncated>false</IsTruncated>
</ListBucketResult>`;

      return new Response(emptyResponse, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/xml',
        },
      });
    }

    const xmlResponse = await storageResponse.text();
    console.log('Storage provider response length:', xmlResponse.length);
    console.log('Storage provider response preview:', xmlResponse.substring(0, 1000));
    
    // Log raw XML structure for debugging
    console.log('=== XML STRUCTURE ANALYSIS ===');
    console.log('Looking for <Contents> elements:', xmlResponse.includes('<Contents>'));
    console.log('Looking for <CommonPrefixes> elements:', xmlResponse.includes('<CommonPrefixes>'));
    console.log('Looking for <Key> elements:', xmlResponse.includes('<Key>'));
    console.log('Looking for <Prefix> elements:', xmlResponse.includes('<Prefix>'));
    
    // Extract some key information using regex for debugging
    const keyMatches = xmlResponse.match(/<Key>(.*?)<\/Key>/g);
    const prefixMatches = xmlResponse.match(/<Prefix>(.*?)<\/Prefix>/g);
    
    console.log('Key matches found:', keyMatches?.length || 0);
    console.log('Prefix matches found:', prefixMatches?.length || 0);
    
    if (keyMatches) {
      console.log('First few keys:', keyMatches.slice(0, 5).map(m => m.replace(/<\/?Key>/g, '')));
    }
    
    if (prefixMatches) {
      console.log('First few prefixes:', prefixMatches.slice(0, 5).map(m => m.replace(/<\/?Prefix>/g, '')));
    }

    return new Response(xmlResponse, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml',
      },
    });
    
  } catch (error) {
    console.error('Error in idrive-proxy:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      success: false,
      message: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  }
});