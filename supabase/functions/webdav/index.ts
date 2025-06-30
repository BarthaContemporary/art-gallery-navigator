
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

import { authenticateUser, UserInfo } from "./auth.ts";
import { getWebDAVResponseHeaders, getMacFinderHeaders } from "./headers.ts";
import { normalizePath, parseWebDAVPath } from "./utils.ts";
import { handlePropfind } from "./handlers/propfind.ts";
import { handleGet } from "./handlers/get.ts";
import { handlePut } from "./handlers/put.ts";
import { handleMkcol, handleDelete, handleLock, handleUnlock, handleMove, handleCopy, handleProppatch } from "./handlers/other.ts";
import { handleDebugToken } from "./debug.ts";

serve(async (req) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID().substring(0, 8);
  const url = new URL(req.url);
  
  console.log(`[${requestId}] === NEW REQUEST ===`);
  console.log(`[${requestId}] ${req.method} ${url.pathname}`);
  console.log(`[${requestId}] User-Agent: ${req.headers.get('User-Agent') || 'unknown'}`);
  console.log(`[${requestId}] Headers:`, Object.fromEntries(req.headers.entries()));

  // Handle debug endpoint FIRST
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
    console.log(`[${requestId}] OPTIONS request - Mac Finder capability check`);
    return new Response('', { 
      status: 200,
      headers: {
        ...getWebDAVResponseHeaders(),
        ...getMacFinderHeaders(),
        'WWW-Authenticate': 'Basic realm="WebDAV Server", charset="UTF-8"',
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

    const authHeader = req.headers.get('Authorization');
    console.log(`[${requestId}] Auth header present: ${!!authHeader}`);
    
    // Enhanced authentication challenge for Mac Finder
    if (!authHeader) {
      console.log(`[${requestId}] No auth - sending Mac-compatible challenge`);
      return new Response('', {
        status: 401,
        headers: {
          ...getWebDAVResponseHeaders(),
          ...getMacFinderHeaders(),
          'WWW-Authenticate': 'Basic realm="WebDAV Server", charset="UTF-8"',
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': '0'
        }
      });
    }

    // Authenticate user
    const userInfo = await authenticateUser(supabase, authHeader, requestId);
    if (!userInfo) {
      console.log(`[${requestId}] Authentication failed - invalid credentials`);
      return new Response('', {
        status: 401,
        headers: {
          ...getWebDAVResponseHeaders(),
          ...getMacFinderHeaders(),
          'WWW-Authenticate': 'Basic realm="WebDAV Server", charset="UTF-8"',
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': '0'
        }
      });
    }

    console.log(`[${requestId}] User authenticated: ${userInfo.user_id}`);

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
        console.log(`[${requestId}] Access log failed (non-critical):`, result.error);
      }
    });

    // Enhanced path processing for Mac Finder
    const path = normalizePath(url.pathname);
    const pathInfo = parseWebDAVPath(path);
    console.log(`[${requestId}] Processing ${req.method} for: "${path}"`);
    console.log(`[${requestId}] Path info:`, pathInfo);

    // Route to appropriate handlers
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
          response = await handleMove(supabase, userInfo, path, req, requestId);
          break;
        case 'COPY':
          response = await handleCopy(supabase, userInfo, path, req, requestId);
          break;
        case 'LOCK':
          response = await handleLock(supabase, userInfo, path, req, requestId);
          break;
        case 'UNLOCK':
          response = await handleUnlock(supabase, userInfo, path, req, requestId);
          break;
        case 'PROPPATCH':
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

    console.log(`[${requestId}] Request completed in ${Date.now() - startTime}ms with status ${response.status}`);
    return response;

  } catch (error) {
    console.error(`[${requestId}] Unexpected server error:`, error);
    return new Response('Internal server error', {
      status: 500,
      headers: getWebDAVResponseHeaders()
    });
  }
});
