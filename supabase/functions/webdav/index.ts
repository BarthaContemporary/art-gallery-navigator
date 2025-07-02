
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// Apple/Mac-optimized CORS headers for WebDAV
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, depth, destination, overwrite, range, if-match, if-none-match',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, LOCK, UNLOCK',
  'DAV': '1, 2, 3',
  'MS-Author-Via': 'DAV',
  'Allow': 'OPTIONS, PROPFIND, PROPPATCH, GET, HEAD, PUT, DELETE, MKCOL, COPY, MOVE, LOCK, UNLOCK',
  'Accept-Ranges': 'bytes',
  'Server': 'WebDAV/1.0',
};

serve(async (req) => {
  const requestId = crypto.randomUUID().substring(0, 8);
  console.log(`[${requestId}] ${req.method} ${req.url}`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('', { 
      status: 200, 
      headers: corsHeaders 
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response('Server configuration error', { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Authenticate user and get permissions
    const authResult = await authenticateUser(req, supabase, requestId);
    if (!authResult.success) {
      return new Response('Unauthorized', {
        status: 401,
        headers: {
          ...corsHeaders,
          'WWW-Authenticate': 'Basic realm="WebDAV Server"',
        }
      });
    }

    const { userId, isAdmin } = authResult;
    console.log(`[${requestId}] Auth successful for user: ${userId}, admin: ${isAdmin}`);

    const url = new URL(req.url);
    const path = url.pathname.replace('/functions/v1/webdav', '') || '/';
    
    console.log(`[${requestId}] Processing path: "${path}"`);

    // Route to handlers with user context
    const userContext = { userId, isAdmin, supabase, requestId };
    
    if (req.method === 'PROPFIND') {
      return await handlePropfind(path, req, userContext);
    } else if (req.method === 'GET' || req.method === 'HEAD') {
      return await handleGet(path, req.method === 'HEAD', userContext);
    } else if (req.method === 'PUT') {
      return await handlePut(path, req, userContext);
    } else if (req.method === 'DELETE') {
      return await handleDelete(path, userContext);
    } else if (req.method === 'MKCOL') {
      return await handleMkcol(path, userContext);
    } else if (req.method === 'PROPPATCH') {
      return await handleProppatch(path, req, userContext);
    } else if (req.method === 'COPY' || req.method === 'MOVE') {
      return await handleCopyMove(path, req, userContext);
    }

    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders
    });

  } catch (error) {
    console.error(`[${requestId}] Server error:`, error);
    return new Response('Internal server error', {
      status: 500,
      headers: corsHeaders
    });
  }
});

// Authentication function using WebDAV tokens
async function authenticateUser(req: Request, supabase: any, requestId: string) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    console.log(`[${requestId}] Missing or invalid auth header`);
    return { success: false };
  }

  try {
    const credentials = atob(authHeader.substring(6));
    const [username, password] = credentials.split(':');
    
    console.log(`[${requestId}] Authenticating user: ${username}`);

    // Validate WebDAV token
    const { data: tokenData } = await supabase.rpc('validate_webdav_token', { 
      token_text: password 
    });

    if (!tokenData || !tokenData.is_valid) {
      console.log(`[${requestId}] Invalid token for user: ${username}`);
      return { success: false };
    }

    // Check if user is admin
    const { data: adminCheck } = await supabase.rpc('has_role', {
      _user_id: tokenData.user_id,
      _role: 'gallery_admin'
    });

    return {
      success: true,
      userId: tokenData.user_id,
      isAdmin: !!adminCheck
    };
  } catch (error) {
    console.error(`[${requestId}] Auth error:`, error);
    return { success: false };
  }
}

// Apple-optimized PROPFIND handler
async function handlePropfind(path: string, req: Request, userContext: any) {
  const { userId, isAdmin, supabase, requestId } = userContext;
  console.log(`[${requestId}] PROPFIND for path: "${path}"`);
  
  const depth = req.headers.get('Depth') || '1';
  
  if (path === '/' || path === '') {
    // Root directory - list accessible folders
    const { data: folders } = await supabase.rpc('get_user_accessible_folders_for_user', {
      user_id_param: userId
    });

    const xmlResponse = createPropfindResponse('/', folders || [], [], depth);
    
    return new Response(xmlResponse, {
      status: 207,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
      }
    });
  } else {
    // Folder contents - list accessible documents
    const folderName = path.replace(/^\/+|\/+$/g, '');
    
    // Find folder and check access
    const { data: folders } = await supabase.rpc('get_user_accessible_folders_for_user', {
      user_id_param: userId
    });
    
    const folder = folders?.find((f: any) => f.folder_name === folderName);
    if (!folder || !folder.can_read) {
      return new Response('Not Found', {
        status: 404,
        headers: corsHeaders
      });
    }

    const { data: documents } = await supabase.rpc('get_user_accessible_documents', {
      folder_id_param: folder.folder_id
    });

    const xmlResponse = createPropfindResponse(path, [], documents || [], depth);
    
    return new Response(xmlResponse, {
      status: 207,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
      }
    });
  }
}

// Apple-optimized GET/HEAD handler with range support
async function handleGet(path: string, isHead: boolean, userContext: any) {
  const { userId, isAdmin, supabase, requestId } = userContext;
  console.log(`[${requestId}] ${isHead ? 'HEAD' : 'GET'} for path: "${path}"`);
  
  if (path === '/' || path === '') {
    // Root directory HTML
    const html = `<!DOCTYPE html>
<html><head><title>WebDAV Server</title></head>
<body><h1>WebDAV Server</h1><p>Connected successfully!</p></body></html>`;
    
    return new Response(isHead ? null : html, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html',
        'Content-Length': html.length.toString(),
        'Last-Modified': new Date().toUTCString(),
        'ETag': '"' + btoa(html).substring(0, 8) + '"',
      }
    });
  }

  // File download - parse folder/filename and check access
  const pathParts = path.split('/').filter(p => p);
  if (pathParts.length !== 2) {
    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }

  const [folderName, fileName] = pathParts;

  // Check folder access
  const { data: folders } = await supabase.rpc('get_user_accessible_folders_for_user', {
    user_id_param: userId
  });
  
  const folder = folders?.find((f: any) => f.folder_name === folderName);
  if (!folder || !folder.can_read) {
    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }

  // Get document with access check
  const { data: documents } = await supabase.rpc('get_user_accessible_documents', {
    folder_id_param: folder.folder_id
  });

  const document = documents?.find((d: any) => d.document_name === fileName);
  if (!document) {
    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }

  const lastModified = new Date(document.created_at || Date.now()).toUTCString();
  const etag = '"' + btoa(document.document_id).substring(0, 12) + '"';

  if (isHead) {
    return new Response(null, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': document.mime_type || 'application/octet-stream',
        'Content-Length': (document.file_size || 0).toString(),
        'Last-Modified': lastModified,
        'ETag': etag,
      }
    });
  }

  // Handle range requests for Apple compatibility
  const rangeHeader = req.headers.get('Range');
  
  try {
    if (document.file_url.startsWith('placeholder://')) {
      return new Response('File not yet uploaded to storage', { 
        status: 404, 
        headers: corsHeaders 
      });
    }

    const fileResponse = await fetch(document.file_url);
    if (!fileResponse.ok) {
      return new Response('File not accessible', { status: 404, headers: corsHeaders });
    }

    const fileContent = await fileResponse.arrayBuffer();
    const fileSize = fileContent.byteLength;
    
    // Handle range requests
    if (rangeHeader) {
      const ranges = parseRangeHeader(rangeHeader, fileSize);
      if (ranges.length === 1) {
        const [start, end] = ranges[0];
        const chunk = fileContent.slice(start, end + 1);
        
        return new Response(chunk, {
          status: 206,
          headers: {
            ...corsHeaders,
            'Content-Type': document.mime_type || 'application/octet-stream',
            'Content-Length': chunk.byteLength.toString(),
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Last-Modified': lastModified,
            'ETag': etag,
          }
        });
      }
    }
    
    return new Response(fileContent, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': document.mime_type || 'application/octet-stream',
        'Content-Length': fileSize.toString(),
        'Last-Modified': lastModified,
        'ETag': etag,
      }
    });
  } catch (error) {
    console.error(`[${requestId}] File download error:`, error);
    return new Response('File error', { status: 500, headers: corsHeaders });
  }
}

// Enhanced PUT handler with proper storage and access control
async function handlePut(path: string, req: Request, userContext: any) {
  const { userId, isAdmin, supabase, requestId } = userContext;
  console.log(`[${requestId}] PUT for path: "${path}"`);

  const pathParts = path.split('/').filter(p => p);
  if (pathParts.length !== 2) {
    return new Response('Bad Request', { status: 400, headers: corsHeaders });
  }

  const [folderName, fileName] = pathParts;

  // Check folder access
  const { data: folders } = await supabase.rpc('get_user_accessible_folders_for_user', {
    user_id_param: userId
  });
  
  let folder = folders?.find((f: any) => f.folder_name === folderName);
  
  if (!folder && isAdmin) {
    // Admin can create new folders
    const { data: newFolder } = await supabase
      .from('folders')
      .insert({ 
        name: folderName, 
        created_by: userId 
      })
      .select('id, name')
      .single();
    
    if (newFolder) {
      folder = { 
        folder_id: newFolder.id, 
        folder_name: newFolder.name, 
        can_write: true 
      };
    }
  }

  if (!folder || !folder.can_write) {
    return new Response('Forbidden', { status: 403, headers: corsHeaders });
  }

  try {
    // Read file content
    const fileContent = await req.arrayBuffer();
    const fileSize = fileContent.byteLength;
    
    // Store file in Supabase Storage
    const fileName_sanitized = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `${folderName}/${fileName_sanitized}`;
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('shared-files')
      .upload(storagePath, fileContent, {
        contentType: req.headers.get('Content-Type') || 'application/octet-stream',
        upsert: true
      });

    if (uploadError) {
      console.error(`[${requestId}] Storage upload error:`, uploadError);
      return new Response('Upload failed', { status: 500, headers: corsHeaders });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('shared-files')
      .getPublicUrl(storagePath);

    // Insert or update document
    const { error } = await supabase
      .from('documents')
      .upsert({
        file_name: fileName,
        file_url: urlData.publicUrl,
        file_size: fileSize,
        folder_id: folder.folder_id,
        type: 'webdav_upload',
        mime_type: req.headers.get('Content-Type') || 'application/octet-stream',
        is_deleted: false,
      }, {
        onConflict: 'folder_id,file_name'
      });

    if (error) {
      console.error(`[${requestId}] Document insert error:`, error);
      return new Response('Database update failed', { status: 500, headers: corsHeaders });
    }

    return new Response('', {
      status: 201,
      headers: {
        ...corsHeaders,
        'ETag': '"' + btoa(storagePath).substring(0, 12) + '"',
      }
    });
  } catch (error) {
    console.error(`[${requestId}] PUT error:`, error);
    return new Response('Upload failed', { status: 500, headers: corsHeaders });
  }
}

// Enhanced DELETE handler with access control
async function handleDelete(path: string, userContext: any) {
  const { userId, isAdmin, supabase, requestId } = userContext;
  console.log(`[${requestId}] DELETE for path: "${path}"`);

  const pathParts = path.split('/').filter(p => p);
  if (pathParts.length !== 2) {
    return new Response('Bad Request', { status: 400, headers: corsHeaders });
  }

  const [folderName, fileName] = pathParts;

  // Check folder access
  const { data: folders } = await supabase.rpc('get_user_accessible_folders_for_user', {
    user_id_param: userId
  });
  
  const folder = folders?.find((f: any) => f.folder_name === folderName);
  if (!folder || !folder.can_write) {
    return new Response('Forbidden', { status: 403, headers: corsHeaders });
  }

  try {
    // Get document to find storage path
    const { data: documents } = await supabase.rpc('get_user_accessible_documents', {
      folder_id_param: folder.folder_id
    });

    const document = documents?.find((d: any) => d.document_name === fileName);
    if (!document) {
      return new Response('Not Found', { status: 404, headers: corsHeaders });
    }

    // Delete from storage if it exists
    if (!document.file_url.startsWith('placeholder://')) {
      const storagePath = `${folderName}/${fileName}`;
      await supabase.storage
        .from('shared-files')
        .remove([storagePath]);
    }

    // Mark as deleted in database
    const { error } = await supabase
      .from('documents')
      .update({ is_deleted: true, deleted_at: new Date().toISOString() })
      .eq('id', document.document_id);

    if (error) {
      console.error(`[${requestId}] Delete error:`, error);
      return new Response('Delete failed', { status: 500, headers: corsHeaders });
    }

    return new Response('', {
      status: 204,
      headers: corsHeaders
    });
  } catch (error) {
    console.error(`[${requestId}] DELETE error:`, error);
    return new Response('Delete failed', { status: 500, headers: corsHeaders });
  }
}

// Enhanced MKCOL handler with access control
async function handleMkcol(path: string, userContext: any) {
  const { userId, isAdmin, supabase, requestId } = userContext;
  console.log(`[${requestId}] MKCOL for path: "${path}"`);

  const folderName = path.replace(/^\/+|\/+$/g, '');
  if (!folderName) {
    return new Response('Bad Request', { status: 400, headers: corsHeaders });
  }

  // Only admins can create folders
  if (!isAdmin) {
    return new Response('Forbidden', { status: 403, headers: corsHeaders });
  }

  try {
    const { error } = await supabase
      .from('folders')
      .insert({ 
        name: folderName, 
        created_by: userId,
        assignment_method: 'webdav_manual'
      });

    if (error) {
      console.error(`[${requestId}] MKCOL error:`, error);
      if (error.code === '23505') { // Unique constraint violation
        return new Response('Folder already exists', { status: 409, headers: corsHeaders });
      }
      return new Response('Folder creation failed', { status: 500, headers: corsHeaders });
    }

    return new Response('', {
      status: 201,
      headers: corsHeaders
    });
  } catch (error) {
    console.error(`[${requestId}] MKCOL error:`, error);
    return new Response('Folder creation failed', { status: 500, headers: corsHeaders });
  }
}

// PROPPATCH handler for property updates
async function handleProppatch(path: string, req: Request, userContext: any) {
  const { requestId } = userContext;
  console.log(`[${requestId}] PROPPATCH for path: "${path}" - properties not modifiable`);
  
  return new Response('', {
    status: 207,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/xml; charset=utf-8',
    }
  });
}

// COPY/MOVE handler for file operations
async function handleCopyMove(path: string, req: Request, userContext: any) {
  const { requestId } = userContext;
  const method = req.method;
  console.log(`[${requestId}] ${method} for path: "${path}" - not implemented yet`);
  
  return new Response('Not Implemented', {
    status: 501,
    headers: corsHeaders
  });
}

// Utility function to parse range headers
function parseRangeHeader(rangeHeader: string, fileSize: number): [number, number][] {
  const ranges: [number, number][] = [];
  const rangeRegex = /bytes=(\d+)-(\d*)/g;
  let match;
  
  while ((match = rangeRegex.exec(rangeHeader)) !== null) {
    const start = parseInt(match[1]);
    const end = match[2] ? parseInt(match[2]) : fileSize - 1;
    
    if (start >= 0 && end < fileSize && start <= end) {
      ranges.push([start, end]);
    }
  }
  
  return ranges;
}

// Apple-optimized XML response creator with full WebDAV properties
function createPropfindResponse(path: string, folders: any[], documents: any[], depth: string = '1'): string {
  const escapeXml = (str: string) => str.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });

  let xml = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:" xmlns:A="http://www.apple.com/webdav_fs/">`;

  // Add current directory with Apple-specific properties
  const currentName = path === '/' ? 'WebDAV Root' : path.split('/').pop() || '';
  xml += `
  <D:response>
    <D:href>/functions/v1/webdav${path}</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>${escapeXml(currentName)}</D:displayname>
        <D:resourcetype><D:collection/></D:resourcetype>
        <D:getlastmodified>${new Date().toUTCString()}</D:getlastmodified>
        <D:creationdate>${new Date().toISOString()}</D:creationdate>
        <D:getcontenttype>httpd/unix-directory</D:getcontenttype>
        <D:getetag>"${btoa(path).substring(0, 8)}"</D:getetag>
        <A:appledoubleheader/>
        <D:supportedlock>
          <D:lockentry>
            <D:lockscope><D:exclusive/></D:lockscope>
            <D:locktype><D:write/></D:locktype>
          </D:lockentry>
        </D:supportedlock>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`;

  // Add folders with Apple-specific properties
  for (const folder of folders) {
    const folderName = folder.folder_name || folder.name;
    const created = new Date(folder.created_at || Date.now()).toISOString();
    xml += `
  <D:response>
    <D:href>/functions/v1/webdav/${encodeURIComponent(folderName)}/</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>${escapeXml(folderName)}</D:displayname>
        <D:resourcetype><D:collection/></D:resourcetype>
        <D:getlastmodified>${new Date(folder.created_at || Date.now()).toUTCString()}</D:getlastmodified>
        <D:creationdate>${created}</D:creationdate>
        <D:getcontenttype>httpd/unix-directory</D:getcontenttype>
        <D:getetag>"${btoa(folderName).substring(0, 8)}"</D:getetag>
        <A:appledoubleheader/>
        <D:supportedlock>
          <D:lockentry>
            <D:lockscope><D:exclusive/></D:lockscope>
            <D:locktype><D:write/></D:locktype>
          </D:lockentry>
        </D:supportedlock>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`;
  }

  // Add documents with full WebDAV properties
  for (const doc of documents) {
    const fileName = doc.document_name || doc.file_name;
    const folderName = path.replace(/^\/+|\/+$/g, '');
    const created = new Date(doc.created_at || Date.now()).toISOString();
    const fileSize = doc.file_size || 0;
    const mimeType = doc.mime_type || 'application/octet-stream';
    
    xml += `
  <D:response>
    <D:href>/functions/v1/webdav/${encodeURIComponent(folderName)}/${encodeURIComponent(fileName)}</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>${escapeXml(fileName)}</D:displayname>
        <D:getcontentlength>${fileSize}</D:getcontentlength>
        <D:getcontenttype>${escapeXml(mimeType)}</D:getcontenttype>
        <D:getlastmodified>${new Date(doc.created_at || Date.now()).toUTCString()}</D:getlastmodified>
        <D:creationdate>${created}</D:creationdate>
        <D:getetag>"${btoa(doc.document_id || fileName).substring(0, 12)}"</D:getetag>
        <D:resourcetype/>
        <A:appledoubleheader/>
        <D:supportedlock>
          <D:lockentry>
            <D:lockscope><D:exclusive/></D:lockscope>
            <D:locktype><D:write/></D:locktype>
          </D:lockentry>
        </D:supportedlock>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`;
  }

  xml += '\n</D:multistatus>';
  return xml;
}
