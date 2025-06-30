
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

import { authenticateUser, UserInfo } from "./auth.ts";
import { getWebDAVResponseHeaders, getMacFinderHeaders, getAuthenticationChallengeHeaders } from "./headers.ts";
import { normalizePath, parseWebDAVPath } from "./utils.ts";
import { handlePropfind } from "./handlers/propfind.ts";
import { handleGet } from "./handlers/get.ts";
import { handlePut } from "./handlers/put.ts";
import { handleMkcol, handleDelete, handleLock, handleUnlock, handleMove, handleCopy, handleProppatch } from "./handlers/other.ts";
import { handleDebugToken } from "./debug.ts";

async function ensureStorageBucketExists(supabase: any, requestId: string) {
  try {
    // Check if shared-files bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error(`[${requestId}] Error listing buckets:`, bucketsError);
      return false;
    }
    
    const sharedFilesBucket = buckets?.find((b: any) => b.id === 'shared-files');
    
    if (!sharedFilesBucket) {
      console.log(`[${requestId}] Creating shared-files bucket...`);
      
      // Create the bucket
      const { error: createError } = await supabase.storage.createBucket('shared-files', {
        public: false,
        allowedMimeTypes: null,
        fileSizeLimit: null
      });
      
      if (createError) {
        console.error(`[${requestId}] Error creating shared-files bucket:`, createError);
        return false;
      }
      
      console.log(`[${requestId}] Successfully created shared-files bucket`);
    } else {
      console.log(`[${requestId}] shared-files bucket already exists`);
    }
    
    return true;
  } catch (error) {
    console.error(`[${requestId}] Error ensuring storage bucket:`, error);
    return false;
  }
}

serve(async (req) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID().substring(0, 8);
  const url = new URL(req.url);
  
  console.log(`[${requestId}] === NEW REQUEST ===`);
  console.log(`[${requestId}] ${req.method} ${url.pathname}`);
  console.log(`[${requestId}] User-Agent: ${req.headers.get('User-Agent') || 'unknown'}`);
  console.log(`[${requestId}] Full URL: ${req.url}`);
  console.log(`[${requestId}] Headers:`, Object.fromEntries(req.headers.entries()));
  
  // Handle debug endpoint FIRST (before any auth)
  if (url.pathname.includes('/debug-token')) {
    console.log(`[${requestId}] Debug endpoint requested`);
    if (req.method === 'OPTIONS') {
      return new Response('', { 
        status: 200,
        headers: getWebDAVResponseHeaders()
      });
    }
    return await handleDebugToken(req, requestId);
  }

  // Enhanced OPTIONS handling for Mac Finder compatibility
  if (req.method === 'OPTIONS') {
    console.log(`[${requestId}] OPTIONS request - Mac Finder capability discovery`);
    return new Response('', { 
      status: 200,
      headers: {
        ...getWebDAVResponseHeaders(),
        ...getMacFinderHeaders(),
        'Content-Length': '0'
      }
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(`[${requestId}] Missing Supabase environment variables`);
      return new Response('Server configuration error', { 
        status: 500, 
        headers: getWebDAVResponseHeaders()
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Ensure storage bucket exists (but don't block on failure)
    await ensureStorageBucketExists(supabase, requestId);

    const authHeader = req.headers.get('Authorization');
    console.log(`[${requestId}] Auth header present: ${!!authHeader}`);
    console.log(`[${requestId}] Auth header value: ${authHeader ? 'Basic ' + authHeader.slice(6, 16) + '...' : 'none'}`);
    
    // Enhanced authentication challenge for Mac Finder
    if (!authHeader) {
      console.log(`[${requestId}] No auth header - sending Mac-compatible challenge`);
      return new Response('Unauthorized', {
        status: 401,
        headers: getAuthenticationChallengeHeaders()
      });
    }

    // Authenticate user with enhanced debugging
    console.log(`[${requestId}] Starting authentication process...`);
    const userInfo = await authenticateUser(supabase, authHeader, requestId);
    
    if (!userInfo) {
      console.log(`[${requestId}] Authentication failed - sending challenge with detailed error`);
      return new Response('Authentication failed', {
        status: 401,
        headers: {
          ...getAuthenticationChallengeHeaders(),
          'X-WebDAV-Error': 'Invalid token or credentials'
        }
      });
    }

    console.log(`[${requestId}] Authentication successful for user: ${userInfo.user_id}`);

    // Log access attempt (non-blocking for performance)
    supabase.from('webdav_access_logs').insert({
      user_id: userInfo.user_id,
      token_id: userInfo.token_id,
      method: req.method,
      path: url.pathname,
      ip_address: req.headers.get('CF-Connecting-IP') || req.headers.get('X-Forwarded-For') || 'unknown',
      user_agent: req.headers.get('User-Agent') || 'unknown',
      status_code: 200
    }).then(result => {
      if (result.error) {
        console.log(`[${requestId}] Access log failed (non-critical):`, result.error);
      }
    });

    // Enhanced path processing for Mac Finder
    const path = normalizePath(url.pathname);
    const pathInfo = parseWebDAVPath(path);
    console.log(`[${requestId}] Processing ${req.method} for normalized path: "${path}"`);
    console.log(`[${requestId}] Path info:`, pathInfo);

    // Route to appropriate handlers with enhanced error handling
    let response: Response;
    
    try {
      switch (req.method) {
        case 'PROPFIND':
          console.log(`[${requestId}] Handling PROPFIND request`);
          response = await handlePropfind(supabase, userInfo, path, req, requestId);
          break;
        case 'GET':
        case 'HEAD':
          console.log(`[${requestId}] Handling ${req.method} request`);
          response = await handleGet(supabase, userInfo, path, requestId, req.method === 'HEAD');
          break;
        case 'PUT':
          console.log(`[${requestId}] Handling PUT request`);
          response = await handlePut(supabase, userInfo, path, req, requestId);
          break;
        case 'DELETE':
          console.log(`[${requestId}] Handling DELETE request`);
          response = await handleDelete(supabase, userInfo, path, requestId);
          break;
        case 'MKCOL':
          console.log(`[${requestId}] Handling MKCOL request`);
          response = await handleMkcol(supabase, userInfo, path, requestId);
          break;
        case 'MOVE':
          console.log(`[${requestId}] Handling MOVE request`);
          response = await handleMove(supabase, userInfo, path, req, requestId);
          break;
        case 'COPY':
          console.log(`[${requestId}] Handling COPY request`);
          response = await handleCopy(supabase, userInfo, path, req, requestId);
          break;
        case 'LOCK':
          console.log(`[${requestId}] Handling LOCK request`);
          response = await handleLock(supabase, userInfo, path, req, requestId);
          break;
        case 'UNLOCK':
          console.log(`[${requestId}] Handling UNLOCK request`);
          response = await handleUnlock(supabase, userInfo, path, req, requestId);
          break;
        case 'PROPPATCH':
          console.log(`[${requestId}] Handling PROPPATCH request`);
          response = await handleProppatch(path, requestId);
          break;
        default:
          console.log(`[${requestId}] Method not supported: ${req.method}`);
          response = new Response('Method not allowed', {
            status: 405,
            headers: getWebDAVResponseHeaders({
              'Allow': 'OPTIONS, PROPFIND, GET, HEAD, PUT, DELETE, MKCOL, MOVE, COPY, LOCK, UNLOCK, PROPPATCH'
            })
          });
      }
    } catch (handlerError) {
      console.error(`[${requestId}] Handler error for ${req.method}:`, handlerError);
      response = new Response('Internal server error in request handler', {
        status: 500,
        headers: getWebDAVResponseHeaders()
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[${requestId}] Request completed in ${duration}ms with status ${response.status}`);
    
    // Add timing header for debugging
    const finalHeaders = new Headers(response.headers);
    finalHeaders.set('X-Response-Time', `${duration}ms`);
    finalHeaders.set('X-Request-ID', requestId);
    
    return new Response(response.body, {
      status: response.status,
      headers: finalHeaders
    });

  } catch (error) {
    console.error(`[${requestId}] Unexpected server error:`, error);
    return new Response('Internal server error', {
      status: 500,
      headers: getWebDAVResponseHeaders()
    });
  }
});
