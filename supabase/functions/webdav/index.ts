
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, depth, destination, overwrite, if, range',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, HEAD',
  'DAV': '1, 2',
  'MS-Author-Via': 'DAV',
};

interface WebDAVToken {
  user_id: string;
  token_id: string;
  is_valid: boolean;
}

serve(async (req) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID().substring(0, 8);
  
  console.log(`[${requestId}] WebDAV ${req.method} request received for URL: ${req.url}`);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log(`[${requestId}] Handling CORS preflight request`);
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Extract and validate WebDAV token
    const authHeader = req.headers.get('authorization');
    console.log(`[${requestId}] Auth header present: ${!!authHeader}`);
    
    if (!authHeader) {
      console.log(`[${requestId}] No authorization header provided`);
      return new Response('Unauthorized - WebDAV authentication required', { 
        status: 401,
        headers: { 
          ...corsHeaders, 
          'WWW-Authenticate': 'Basic realm="WebDAV File Access"' 
        }
      });
    }

    if (!authHeader.startsWith('Basic ')) {
      console.log(`[${requestId}] Invalid authorization header format`);
      return new Response('Unauthorized - Basic authentication required', { 
        status: 401,
        headers: { 
          ...corsHeaders, 
          'WWW-Authenticate': 'Basic realm="WebDAV File Access"' 
        }
      });
    }

    // Parse Basic auth
    const token = authHeader.replace('Basic ', '');
    let decoded: string;
    let username: string;
    let password: string;
    
    try {
      decoded = atob(token);
      const colonIndex = decoded.indexOf(':');
      if (colonIndex === -1) {
        throw new Error('Invalid credentials format');
      }
      username = decoded.substring(0, colonIndex);
      password = decoded.substring(colonIndex + 1);
    } catch (error) {
      console.log(`[${requestId}] Failed to decode credentials: ${error}`);
      return new Response('Unauthorized - Invalid credentials format', { 
        status: 401,
        headers: { 
          ...corsHeaders, 
          'WWW-Authenticate': 'Basic realm="WebDAV File Access"' 
        }
      });
    }

    console.log(`[${requestId}] Username: ${username}, Password length: ${password?.length || 0}`);

    if (!password || password.trim().length === 0) {
      console.log(`[${requestId}] No password provided`);
      return new Response('Unauthorized - Password required', { 
        status: 401,
        headers: { 
          ...corsHeaders, 
          'WWW-Authenticate': 'Basic realm="WebDAV File Access"' 
        }
      });
    }

    // Validate token using the fixed function
    console.log(`[${requestId}] Validating token with validate_webdav_token function`);
    const { data: tokenData, error: tokenError } = await supabase.rpc('validate_webdav_token', {
      token_text: password.trim()
    });

    console.log(`[${requestId}] Token validation result:`, { 
      hasData: !!tokenData, 
      dataLength: Array.isArray(tokenData) ? tokenData.length : 0,
      error: tokenError 
    });

    if (tokenError) {
      console.log(`[${requestId}] Token validation error:`, tokenError);
      return new Response('Unauthorized - Token validation failed', { 
        status: 401,
        headers: { 
          ...corsHeaders, 
          'WWW-Authenticate': 'Basic realm="WebDAV File Access"' 
        }
      });
    }

    if (!tokenData || !Array.isArray(tokenData) || tokenData.length === 0) {
      console.log(`[${requestId}] No valid token data returned`);
      return new Response('Unauthorized - Invalid or expired token', { 
        status: 401,
        headers: { 
          ...corsHeaders, 
          'WWW-Authenticate': 'Basic realm="WebDAV File Access"' 
        }
      });
    }

    const validToken = tokenData.find((t: any) => t.is_valid && t.user_id && t.token_id);
    if (!validToken) {
      console.log(`[${requestId}] Token found but not valid or missing required fields:`, tokenData);
      return new Response('Unauthorized - Token expired or inactive', { 
        status: 401,
        headers: { 
          ...corsHeaders, 
          'WWW-Authenticate': 'Basic realm="WebDAV File Access"' 
        }
      });
    }

    const userId = validToken.user_id;
    const url = new URL(req.url);
    
    // Improved path handling
    let path = decodeURIComponent(url.pathname);
    
    // Remove WebDAV function path prefixes
    const webdavPrefixes = [
      '/functions/v1/webdav',
      '/webdav'
    ];
    
    for (const prefix of webdavPrefixes) {
      if (path.startsWith(prefix)) {
        path = path.substring(prefix.length);
        break;
      }
    }
    
    // Ensure path starts with /
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    // Normalize path (remove double slashes, etc.)
    path = path.replace(/\/+/g, '/');
    
    // Remove trailing slashes except for root
    if (path !== '/' && path.endsWith('/')) {
      path = path.slice(0, -1);
    }

    console.log(`[${requestId}] WebDAV ${req.method} request for normalized path: ${path} by user: ${userId}`);

    // Log access attempt
    try {
      await supabase.from('webdav_access_logs').insert({
        user_id: userId,
        token_id: validToken.token_id,
        method: req.method,
        path: path,
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown'
      });
    } catch (logError) {
      console.log(`[${requestId}] Failed to log access (continuing):`, logError);
    }

    // Route WebDAV methods
    let response: Response;
    switch (req.method) {
      case 'PROPFIND':
        response = await handlePropfind(supabase, userId, path, req, requestId);
        break;
      case 'GET':
        response = await handleGet(supabase, userId, path, requestId);
        break;
      case 'HEAD':
        response = await handleHead(supabase, userId, path, requestId);
        break;
      case 'PUT':
        response = await handlePut(supabase, userId, path, req, requestId);
        break;
      case 'DELETE':
        response = await handleDelete(supabase, userId, path, requestId);
        break;
      case 'MKCOL':
        response = await handleMkcol(supabase, userId, path, requestId);
        break;
      case 'COPY':
      case 'MOVE':
        response = await handleCopyMove(supabase, userId, path, req, requestId);
        break;
      default:
        console.log(`[${requestId}] Unsupported method: ${req.method}`);
        response = new Response(`Method ${req.method} not allowed`, { 
          status: 405,
          headers: { 
            ...corsHeaders,
            'Allow': 'OPTIONS, PROPFIND, GET, HEAD, PUT, DELETE, MKCOL, COPY, MOVE'
          }
        });
    }

    const duration = Date.now() - startTime;
    console.log(`[${requestId}] Request completed in ${duration}ms with status ${response.status}`);
    
    return response;

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[${requestId}] WebDAV error after ${duration}ms:`, error);
    return new Response('Internal server error', { 
      status: 500,
      headers: corsHeaders
    });
  }
});

async function handlePropfind(supabase: any, userId: string, path: string, req: Request, requestId: string) {
  const depth = req.headers.get('depth') || '1';
  
  console.log(`[${requestId}] PROPFIND for path: ${path}, depth: ${depth}`);
  
  try {
    let folders = [];
    let documents = [];
    
    if (path === '/' || path === '') {
      console.log(`[${requestId}] Handling root directory request`);
      
      try {
        // Get user's folders with better error handling
        const { data: foldersData, error: foldersError } = await supabase
          .from('folders')
          .select('id, name, created_at, updated_at')
          .or(`created_by.eq.${userId},artist_id.in.(select id from artists where user_id = ${userId})`)
          .is('parent_folder_id', null)
          .order('name');
        
        if (foldersError) {
          console.log(`[${requestId}] Folders query error:`, foldersError);
        } else {
          folders = foldersData || [];
          console.log(`[${requestId}] Found ${folders.length} folders for user`);
        }

        // Get documents in root with better error handling
        const { data: docsData, error: docsError } = await supabase
          .from('documents')
          .select('id, file_name, file_size, updated_at, mime_type, created_at')
          .is('folder_id', null)
          .eq('is_deleted', false)
          .or(`artist_id.in.(select id from artists where user_id = ${userId})`)
          .order('file_name');
        
        if (docsError) {
          console.log(`[${requestId}] Documents query error:`, docsError);
        } else {
          documents = docsData || [];
          console.log(`[${requestId}] Found ${documents.length} documents for user`);
        }
      } catch (queryError) {
        console.log(`[${requestId}] Query error:`, queryError);
      }
    } else {
      console.log(`[${requestId}] Handling specific folder: ${path}`);
      
      const folderName = path.substring(1); // Remove leading slash
      
      try {
        // Find the current folder
        const { data: currentFolder, error: folderError } = await supabase
          .from('folders')
          .select('id, name')
          .eq('name', folderName)
          .or(`created_by.eq.${userId},artist_id.in.(select id from artists where user_id = ${userId})`)
          .single();
        
        if (folderError) {
          console.log(`[${requestId}] Current folder lookup error:`, folderError);
        } else if (currentFolder) {
          console.log(`[${requestId}] Found folder: ${currentFolder.name}`);
          
          // Get subfolders
          const { data: foldersData } = await supabase
            .from('folders')
            .select('id, name, created_at, updated_at')
            .eq('parent_folder_id', currentFolder.id)
            .order('name');
          
          folders = foldersData || [];
          
          // Get documents in this folder
          const { data: docsData } = await supabase
            .from('documents')
            .select('id, file_name, file_size, updated_at, mime_type, created_at')
            .eq('folder_id', currentFolder.id)
            .eq('is_deleted', false)
            .order('file_name');
          
          documents = docsData || [];
        }
      } catch (queryError) {
        console.log(`[${requestId}] Specific folder query error:`, queryError);
      }
    }

    // Build proper WebDAV XML response
    const items = [
      {
        href: path || '/',
        isCollection: true,
        name: path === '/' || path === '' ? 'Root' : path.split('/').pop() || 'Root',
        size: 0,
        lastModified: new Date().toISOString(),
        contentType: 'httpd/unix-directory'
      }
    ];

    if (depth !== '0') {
      // Add folders as collections
      folders.forEach((folder: any) => {
        const folderPath = path === '/' ? `/${folder.name}/` : `${path}/${folder.name}/`;
        items.push({
          href: folderPath,
          isCollection: true,
          name: folder.name,
          size: 0,
          lastModified: folder.updated_at || folder.created_at,
          contentType: 'httpd/unix-directory'
        });
      });

      // Add documents as files
      documents.forEach((doc: any) => {
        const docPath = path === '/' ? `/${doc.file_name}` : `${path}/${doc.file_name}`;
        items.push({
          href: docPath,
          isCollection: false,
          name: doc.file_name,
          size: doc.file_size || 0,
          lastModified: doc.updated_at || doc.created_at,
          contentType: doc.mime_type || 'application/octet-stream'
        });
      });
    }

    console.log(`[${requestId}] Returning ${items.length} items for PROPFIND`);
    const xml = generatePropfindXML(items);
    
    return new Response(xml, {
      status: 207,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Length': new Blob([xml]).size.toString()
      }
    });

  } catch (error) {
    console.error(`[${requestId}] PROPFIND error:`, error);
    return new Response('Not found', { 
      status: 404, 
      headers: corsHeaders 
    });
  }
}

async function handleGet(supabase: any, userId: string, path: string, requestId: string) {
  console.log(`[${requestId}] GET request for path: ${path}`);
  
  if (path === '/' || path === '') {
    return new Response('Directory listing not available via GET', { 
      status: 403,
      headers: corsHeaders
    });
  }

  try {
    const fileName = path.split('/').pop();
    console.log(`[${requestId}] Looking for file: ${fileName}`);
    
    // Find the document
    const { data: document, error } = await supabase
      .from('documents')
      .select('*')
      .eq('file_name', fileName)
      .eq('is_deleted', false)
      .or(`artist_id.in.(select id from artists where user_id = ${userId})`)
      .single();

    if (error || !document) {
      console.log(`[${requestId}] Document not found:`, error);
      return new Response('File not found', { 
        status: 404, 
        headers: corsHeaders 
      });
    }

    console.log(`[${requestId}] Found document: ${document.file_name}`);

    // Fetch the file from the URL
    const fileResponse = await fetch(document.file_url);
    if (!fileResponse.ok) {
      console.log(`[${requestId}] File not accessible from URL: ${document.file_url}`);
      return new Response('File not accessible', { 
        status: 404, 
        headers: corsHeaders 
      });
    }

    const fileData = await fileResponse.arrayBuffer();
    
    return new Response(fileData, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': document.mime_type || 'application/octet-stream',
        'Content-Length': fileData.byteLength.toString(),
        'Last-Modified': new Date(document.updated_at).toUTCString(),
        'ETag': `"${document.id}"`
      }
    });

  } catch (error) {
    console.error(`[${requestId}] GET error:`, error);
    return new Response('Internal server error', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}

async function handleHead(supabase: any, userId: string, path: string, requestId: string) {
  console.log(`[${requestId}] HEAD request for path: ${path}`);
  
  if (path === '/' || path === '') {
    return new Response(null, { 
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'httpd/unix-directory',
        'Last-Modified': new Date().toUTCString()
      }
    });
  }

  try {
    const fileName = path.split('/').pop();
    
    // Find the document
    const { data: document, error } = await supabase
      .from('documents')
      .select('file_name, file_size, updated_at, mime_type, id')
      .eq('file_name', fileName)
      .eq('is_deleted', false)
      .or(`artist_id.in.(select id from artists where user_id = ${userId})`)
      .single();

    if (error || !document) {
      return new Response(null, { 
        status: 404, 
        headers: corsHeaders 
      });
    }

    return new Response(null, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': document.mime_type || 'application/octet-stream',
        'Content-Length': (document.file_size || 0).toString(),
        'Last-Modified': new Date(document.updated_at).toUTCString(),
        'ETag': `"${document.id}"`
      }
    });

  } catch (error) {
    console.error(`[${requestId}] HEAD error:`, error);
    return new Response(null, { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}

async function handlePut(supabase: any, userId: string, path: string, req: Request, requestId: string) {
  console.log(`[${requestId}] PUT request for path: ${path}`);
  
  try {
    const fileName = path.split('/').pop();
    if (!fileName) {
      return new Response('Invalid file name', { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    const fileData = await req.arrayBuffer();
    const contentType = req.headers.get('content-type') || 'application/octet-stream';

    console.log(`[${requestId}] Uploading file: ${fileName}, size: ${fileData.byteLength}`);

    // For now, create a placeholder document record
    // In a real implementation, you'd upload to storage first
    const { data: document, error } = await supabase
      .from('documents')
      .insert({
        file_name: fileName,
        file_url: `webdav://uploaded/${fileName}`, // Placeholder
        type: 'file',
        mime_type: contentType,
        file_size: fileData.byteLength,
        artist_id: null // Could be determined from folder context
      })
      .select()
      .single();

    if (error) {
      console.error(`[${requestId}] PUT error:`, error);
      return new Response('Upload failed', { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    console.log(`[${requestId}] File uploaded successfully: ${document.id}`);

    return new Response('Created', { 
      status: 201,
      headers: {
        ...corsHeaders,
        'ETag': `"${document.id}"`
      }
    });

  } catch (error) {
    console.error(`[${requestId}] PUT error:`, error);
    return new Response('Upload failed', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}

async function handleDelete(supabase: any, userId: string, path: string, requestId: string) {
  console.log(`[${requestId}] DELETE request for path: ${path}`);
  
  try {
    const fileName = path.split('/').pop();
    
    // Soft delete the document
    const { error } = await supabase
      .from('documents')
      .update({ 
        is_deleted: true, 
        deleted_at: new Date().toISOString() 
      })
      .eq('file_name', fileName)
      .or(`artist_id.in.(select id from artists where user_id = ${userId})`);

    if (error) {
      console.error(`[${requestId}] DELETE error:`, error);
      return new Response('Delete failed', { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    console.log(`[${requestId}] File deleted: ${fileName}`);

    return new Response(null, { 
      status: 204,
      headers: corsHeaders
    });

  } catch (error) {
    console.error(`[${requestId}] DELETE error:`, error);
    return new Response('Delete failed', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}

async function handleMkcol(supabase: any, userId: string, path: string, requestId: string) {
  console.log(`[${requestId}] MKCOL request for path: ${path}`);
  
  try {
    const folderName = path.split('/').filter(p => p).pop();
    if (!folderName) {
      return new Response('Invalid folder name', { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    const { data: folder, error } = await supabase
      .from('folders')
      .insert({
        name: folderName,
        created_by: userId,
        parent_folder_id: null // Could be determined from path
      })
      .select()
      .single();

    if (error) {
      console.error(`[${requestId}] MKCOL error:`, error);
      return new Response('Folder creation failed', { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    console.log(`[${requestId}] Folder created: ${folder.name}`);

    return new Response(null, { 
      status: 201,
      headers: corsHeaders
    });

  } catch (error) {
    console.error(`[${requestId}] MKCOL error:`, error);
    return new Response('Folder creation failed', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
}

async function handleCopyMove(supabase: any, userId: string, path: string, req: Request, requestId: string) {
  console.log(`[${requestId}] ${req.method} request for path: ${path}`);
  
  // Implement COPY/MOVE operations
  return new Response('Not implemented', { 
    status: 501,
    headers: corsHeaders
  });
}

function generatePropfindXML(items: any[]) {
  const xmlItems = items.map(item => `
    <D:response>
      <D:href>${escapeXml(item.href)}</D:href>
      <D:propstat>
        <D:prop>
          <D:displayname>${escapeXml(item.name)}</D:displayname>
          <D:getlastmodified>${new Date(item.lastModified).toUTCString()}</D:getlastmodified>
          <D:creationdate>${new Date(item.lastModified).toISOString()}</D:creationdate>
          ${item.isCollection ? 
            '<D:resourcetype><D:collection/></D:resourcetype>' : 
            `<D:resourcetype/>
             <D:getcontentlength>${item.size}</D:getcontentlength>
             <D:getcontenttype>${escapeXml(item.contentType)}</D:getcontenttype>`
          }
          <D:supportedlock>
            <D:lockentry>
              <D:lockscope><D:exclusive/></D:lockscope>
              <D:locktype><D:write/></D:locktype>
            </D:lockentry>
          </D:supportedlock>
        </D:prop>
        <D:status>HTTP/1.1 200 OK</D:status>
      </D:propstat>
    </D:response>
  `).join('');

  return `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  ${xmlItems}
</D:multistatus>`;
}

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&#39;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}
