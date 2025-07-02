
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// Simple CORS headers for WebDAV
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, depth, destination, overwrite',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PROPFIND, MKCOL',
  'DAV': '1, 2',
  'MS-Author-Via': 'DAV',
  'Allow': 'OPTIONS, PROPFIND, GET, HEAD, PUT, DELETE, MKCOL',
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

    // Simple Basic Auth - no complex token hashing for now
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return new Response('Unauthorized', {
        status: 401,
        headers: {
          ...corsHeaders,
          'WWW-Authenticate': 'Basic realm="WebDAV Server"',
        }
      });
    }

    // For now, accept any credentials to test mounting
    // TODO: Implement proper authentication later
    console.log(`[${requestId}] Auth accepted for testing`);

    const url = new URL(req.url);
    const path = url.pathname.replace('/functions/v1/webdav', '') || '/';
    
    console.log(`[${requestId}] Processing path: "${path}"`);

    // Route to handlers
    if (req.method === 'PROPFIND') {
      return await handlePropfind(supabase, path, req, requestId);
    } else if (req.method === 'GET' || req.method === 'HEAD') {
      return await handleGet(supabase, path, req.method === 'HEAD', requestId);
    } else if (req.method === 'PUT') {
      return await handlePut(supabase, path, req, requestId);
    } else if (req.method === 'DELETE') {
      return await handleDelete(supabase, path, requestId);
    } else if (req.method === 'MKCOL') {
      return await handleMkcol(supabase, path, requestId);
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

// Simple PROPFIND handler
async function handlePropfind(supabase: any, path: string, req: Request, requestId: string) {
  console.log(`[${requestId}] PROPFIND for path: "${path}"`);
  
  if (path === '/' || path === '') {
    // Root directory - list folders
    const { data: folders } = await supabase
      .from('folders')
      .select('id, name, created_at')
      .is('parent_folder_id', null)
      .limit(10);

    const xmlResponse = createPropfindResponse('/', folders || [], []);
    
    return new Response(xmlResponse, {
      status: 207,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/xml; charset=utf-8',
      }
    });
  } else {
    // Folder contents - list documents
    const folderName = path.replace(/^\/+|\/+$/g, ''); // Remove leading/trailing slashes
    
    const { data: folder } = await supabase
      .from('folders')
      .select('id, name')
      .eq('name', folderName)
      .single();

    if (!folder) {
      return new Response('Not Found', {
        status: 404,
        headers: corsHeaders
      });
    }

    const { data: documents } = await supabase
      .from('documents')
      .select('id, file_name, file_size, created_at')
      .eq('folder_id', folder.id)
      .eq('is_deleted', false)
      .limit(100);

    const xmlResponse = createPropfindResponse(path, [], documents || []);
    
    return new Response(xmlResponse, {
      status: 207,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/xml; charset=utf-8',
      }
    });
  }
}

// Simple GET handler
async function handleGet(supabase: any, path: string, isHead: boolean, requestId: string) {
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
      }
    });
  }

  // File download - parse folder/filename
  const pathParts = path.split('/').filter(p => p);
  if (pathParts.length !== 2) {
    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }

  const [folderName, fileName] = pathParts;

  const { data: folder } = await supabase
    .from('folders')
    .select('id')
    .eq('name', folderName)
    .single();

  if (!folder) {
    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }

  const { data: document } = await supabase
    .from('documents')
    .select('file_name, file_url, file_size, mime_type')
    .eq('folder_id', folder.id)
    .eq('file_name', fileName)
    .eq('is_deleted', false)
    .single();

  if (!document) {
    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }

  if (isHead) {
    return new Response(null, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': document.mime_type || 'application/octet-stream',
        'Content-Length': (document.file_size || 0).toString(),
      }
    });
  }

  // Download file
  try {
    const fileResponse = await fetch(document.file_url);
    if (!fileResponse.ok) {
      return new Response('File not accessible', { status: 404, headers: corsHeaders });
    }

    const fileContent = await fileResponse.arrayBuffer();
    
    return new Response(fileContent, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': document.mime_type || 'application/octet-stream',
        'Content-Length': fileContent.byteLength.toString(),
      }
    });
  } catch (error) {
    console.error(`[${requestId}] File download error:`, error);
    return new Response('File error', { status: 500, headers: corsHeaders });
  }
}

// Simple PUT handler
async function handlePut(supabase: any, path: string, req: Request, requestId: string) {
  console.log(`[${requestId}] PUT for path: "${path}"`);

  const pathParts = path.split('/').filter(p => p);
  if (pathParts.length !== 2) {
    return new Response('Bad Request', { status: 400, headers: corsHeaders });
  }

  const [folderName, fileName] = pathParts;

  // Find or create folder
  let { data: folder } = await supabase
    .from('folders')
    .select('id')
    .eq('name', folderName)
    .single();

  if (!folder) {
    const { data: newFolder } = await supabase
      .from('folders')
      .insert({ name: folderName, created_by: '00000000-0000-0000-0000-000000000000' })
      .select('id')
      .single();
    folder = newFolder;
  }

  if (!folder) {
    return new Response('Folder creation failed', { status: 500, headers: corsHeaders });
  }

  // Read file content
  const fileContent = await req.arrayBuffer();
  const fileSize = fileContent.byteLength;
  
  // For now, create a placeholder URL (we'll implement proper storage later)
  const fileUrl = `placeholder://webdav/${folderName}/${fileName}`;

  // Insert document
  const { error } = await supabase
    .from('documents')
    .insert({
      file_name: fileName,
      file_url: fileUrl,
      file_size: fileSize,
      folder_id: folder.id,
      type: 'webdav_upload',
      mime_type: req.headers.get('Content-Type') || 'application/octet-stream',
    });

  if (error) {
    console.error(`[${requestId}] Document insert error:`, error);
    return new Response('Upload failed', { status: 500, headers: corsHeaders });
  }

  return new Response('', {
    status: 201,
    headers: corsHeaders
  });
}

// Simple DELETE handler
async function handleDelete(supabase: any, path: string, requestId: string) {
  console.log(`[${requestId}] DELETE for path: "${path}"`);

  const pathParts = path.split('/').filter(p => p);
  if (pathParts.length !== 2) {
    return new Response('Bad Request', { status: 400, headers: corsHeaders });
  }

  const [folderName, fileName] = pathParts;

  const { data: folder } = await supabase
    .from('folders')
    .select('id')
    .eq('name', folderName)
    .single();

  if (!folder) {
    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }

  const { error } = await supabase
    .from('documents')
    .update({ is_deleted: true })
    .eq('folder_id', folder.id)
    .eq('file_name', fileName);

  if (error) {
    return new Response('Delete failed', { status: 500, headers: corsHeaders });
  }

  return new Response('', {
    status: 204,
    headers: corsHeaders
  });
}

// Simple MKCOL handler
async function handleMkcol(supabase: any, path: string, requestId: string) {
  console.log(`[${requestId}] MKCOL for path: "${path}"`);

  const folderName = path.replace(/^\/+|\/+$/g, '');
  if (!folderName) {
    return new Response('Bad Request', { status: 400, headers: corsHeaders });
  }

  const { error } = await supabase
    .from('folders')
    .insert({ 
      name: folderName, 
      created_by: '00000000-0000-0000-0000-000000000000' 
    });

  if (error) {
    return new Response('Folder creation failed', { status: 409, headers: corsHeaders });
  }

  return new Response('', {
    status: 201,
    headers: corsHeaders
  });
}

// Simple XML response creator
function createPropfindResponse(path: string, folders: any[], documents: any[]): string {
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
<D:multistatus xmlns:D="DAV:">`;

  // Add current directory
  xml += `
  <D:response>
    <D:href>/functions/v1/webdav${path}</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>${escapeXml(path === '/' ? 'Root' : path.split('/').pop() || '')}</D:displayname>
        <D:resourcetype><D:collection/></D:resourcetype>
        <D:getlastmodified>${new Date().toUTCString()}</D:getlastmodified>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`;

  // Add folders
  for (const folder of folders) {
    xml += `
  <D:response>
    <D:href>/functions/v1/webdav/${encodeURIComponent(folder.name)}/</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>${escapeXml(folder.name)}</D:displayname>
        <D:resourcetype><D:collection/></D:resourcetype>
        <D:getlastmodified>${new Date(folder.created_at).toUTCString()}</D:getlastmodified>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`;
  }

  // Add documents
  for (const doc of documents) {
    const folderName = path.replace(/^\/+|\/+$/g, '');
    xml += `
  <D:response>
    <D:href>/functions/v1/webdav/${encodeURIComponent(folderName)}/${encodeURIComponent(doc.file_name)}</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>${escapeXml(doc.file_name)}</D:displayname>
        <D:getcontentlength>${doc.file_size || 0}</D:getcontentlength>
        <D:getlastmodified>${new Date(doc.created_at).toUTCString()}</D:getlastmodified>
        <D:resourcetype/>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`;
  }

  xml += '\n</D:multistatus>';
  return xml;
}
