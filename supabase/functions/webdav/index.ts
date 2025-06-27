
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

import { authenticateUser, UserInfo } from "./auth.ts";
import { getWebDAVResponseHeaders } from "./headers.ts";
import { normalizePath } from "./utils.ts";
import { handlePropfind } from "./handlers/propfind.ts";
import { handleGet } from "./handlers/get.ts";
import { handlePut } from "./handlers/put.ts";
import { handleMkcol, handleDelete, handleLock, handleProppatch } from "./handlers/other.ts";
import { handleDebugToken } from "./debug.ts";

serve(async (req) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID().substring(0, 8);
  const url = new URL(req.url);
  
  console.log(`[${requestId}] === NEW REQUEST ===`);
  console.log(`[${requestId}] ${req.method} ${url.pathname}`);
  console.log(`[${requestId}] User-Agent: ${req.headers.get('User-Agent') || 'unknown'}`);

  // Handle debug endpoint FIRST - before any other processing
  if (url.pathname.includes('/debug-token')) {
    console.log(`[${requestId}] Handling debug token endpoint`);
    if (req.method === 'OPTIONS') {
      return new Response('', { 
        status: 200,
        headers: getWebDAVResponseHeaders()
      });
    }
    return await handleDebugToken(req, requestId);
  }

  // Enhanced CORS preflight with Mac-specific headers
  if (req.method === 'OPTIONS') {
    console.log(`[${requestId}] CORS preflight - responding with Mac-compatible headers`);
    return new Response('', { 
      status: 200,
      headers: {
        ...getWebDAVResponseHeaders(),
        'WWW-Authenticate': 'Basic realm="WebDAV Server", charset="UTF-8"'
      }
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(`[${requestId}] Missing environment variables`);
      return new Response('Server configuration error', { 
        status: 500, 
        headers: getWebDAVResponseHeaders()
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const authHeader = req.headers.get('Authorization');
    console.log(`[${requestId}] Auth header present: ${!!authHeader}`);
    
    // Enhanced WebDAV authentication flow with Mac compatibility
    if (!authHeader) {
      console.log(`[${requestId}] No auth header - sending Mac-compatible challenge`);
      return new Response('WebDAV Server - Authentication Required\n\nThis server requires authentication.\nPlease use your WebDAV token as the password.', {
        status: 401,
        headers: getWebDAVResponseHeaders({
          'WWW-Authenticate': 'Basic realm="WebDAV Server", charset="UTF-8"',
          'Content-Type': 'text/plain; charset=utf-8'
        })
      });
    }

    // Authenticate user
    const userInfo = await authenticateUser(supabase, authHeader, requestId);
    if (!userInfo) {
      console.log(`[${requestId}] Authentication failed`);
      return new Response('Invalid credentials format\n\nFor Mac Finder:\n1. Username: webdav\n2. Password: Your 64-character WebDAV token\n\nIf this continues to fail, try a third-party WebDAV client like Transmit or ForkLift.', {
        status: 401,
        headers: getWebDAVResponseHeaders({
          'WWW-Authenticate': 'Basic realm="WebDAV Server", charset="UTF-8"',
          'Content-Type': 'text/plain; charset=utf-8'
        })
      });
    }

    console.log(`[${requestId}] User authenticated successfully: ${userInfo.user_id}`);

    // Log access attempt (non-blocking)
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
        console.log(`[${requestId}] Failed to log access (non-critical):`, result.error);
      }
    });

    // Enhanced path parsing with proper URL decoding and Mac Finder compatibility
    const path = normalizePath(url.pathname);
    console.log(`[${requestId}] Processing ${req.method} for path: "${path}"`);

    // Route to handlers with comprehensive error handling
    let response: Response;
    
    try {
      switch (req.method) {
        case 'PROPFIND':
          response = await handlePropfind(supabase, userInfo, path, req, requestId);
          break;
        case 'GET':
        case 'HEAD':
          response = await handleGet(supabase, userInfo, path, requestId, req.method === 'HEAD');
          break;
        case 'PUT':
          response = await handlePut(supabase, userInfo, path, req, requestId);
          break;
        case 'DELETE':
          response = await handleDelete(supabase, userInfo, path, requestId);
          break;
        case 'MKCOL':
          response = await handleMkcol(supabase, userInfo, path, requestId);
          break;
        case 'MOVE':
          console.log(`[${requestId}] MOVE not yet implemented for path: "${path}"`);
          response = new Response('Method not implemented', {
            status: 501,
            headers: getWebDAVResponseHeaders()
          });
          break;
        case 'COPY':
          console.log(`[${requestId}] COPY not yet implemented for path: "${path}"`);
          response = new Response('Method not implemented', {
            status: 501,
            headers: getWebDAVResponseHeaders()
          });
          break;
        case 'LOCK':
          response = await handleLock(path, requestId);
          break;
        case 'UNLOCK':
          response = new Response('', {
            status: 204,
            headers: getWebDAVResponseHeaders()
          });
          break;
        case 'PROPPATCH':
          response = await handleProppatch(path, requestId);
          break;
        default:
          console.log(`[${requestId}] Method not allowed: ${req.method}`);
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

    console.log(`[${requestId}] Completed in ${Date.now() - startTime}ms with status ${response.status}`);
    return response;

  } catch (error) {
    console.error(`[${requestId}] Unexpected error:`, error);
    return new Response('Internal server error', {
      status: 500,
      headers: getWebDAVResponseHeaders()
    });
  }
});
