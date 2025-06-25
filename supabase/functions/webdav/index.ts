
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, depth, destination, overwrite, if',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE',
};

interface WebDAVToken {
  user_id: string;
  token_id: string;
  is_valid: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log(`WebDAV ${req.method} request received`);
    
    // Extract and validate WebDAV token
    const authHeader = req.headers.get('authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.log('No authorization header provided');
      return new Response('Unauthorized - No credentials provided', { 
        status: 401,
        headers: { ...corsHeaders, 'WWW-Authenticate': 'Basic realm="WebDAV"' }
      });
    }

    if (!authHeader.startsWith('Basic ')) {
      console.log('Invalid authorization header format:', authHeader.substring(0, 20));
      return new Response('Unauthorized - Invalid credentials format', { 
        status: 401,
        headers: { ...corsHeaders, 'WWW-Authenticate': 'Basic realm="WebDAV"' }
      });
    }

    const token = authHeader.replace('Basic ', '');
    let decoded;
    try {
      decoded = atob(token);
    } catch (error) {
      console.log('Failed to decode base64 credentials:', error);
      return new Response('Unauthorized - Invalid credentials encoding', { 
        status: 401,
        headers: { ...corsHeaders, 'WWW-Authenticate': 'Basic realm="WebDAV"' }
      });
    }

    const [username, password] = decoded.split(':');
    console.log('Username:', username);
    console.log('Password length:', password?.length || 0);

    if (!password) {
      console.log('No password provided');
      return new Response('Unauthorized - No password provided', { 
        status: 401,
        headers: { ...corsHeaders, 'WWW-Authenticate': 'Basic realm="WebDAV"' }
      });
    }

    // Validate token using the existing function
    console.log('Validating token with validate_webdav_token function');
    const { data: tokenData, error: tokenError } = await supabase.rpc('validate_webdav_token', {
      token_text: password
    });

    console.log('Token validation result:', { tokenData, tokenError });

    if (tokenError) {
      console.log('Token validation error:', tokenError);
      return new Response('Unauthorized - Token validation failed', { 
        status: 401,
        headers: { ...corsHeaders, 'WWW-Authenticate': 'Basic realm="WebDAV"' }
      });
    }

    if (!tokenData || !Array.isArray(tokenData) || tokenData.length === 0) {
      console.log('No token data returned or empty array');
      return new Response('Unauthorized - Invalid token', { 
        status: 401,
        headers: { ...corsHeaders, 'WWW-Authenticate': 'Basic realm="WebDAV"' }
      });
    }

    const validToken = tokenData.find(t => t.is_valid);
    if (!validToken) {
      console.log('Token found but not valid:', tokenData);
      return new Response('Unauthorized - Token expired or inactive', { 
        status: 401,
        headers: { ...corsHeaders, 'WWW-Authenticate': 'Basic realm="WebDAV"' }
      });
    }

    const userId = validToken.user_id;
    const url = new URL(req.url);
    const path = url.pathname.replace('/webdav', '') || '/';

    console.log(`WebDAV ${req.method} request for path: ${path} by user: ${userId}`);

    // Log access
    try {
      await supabase.from('webdav_access_logs').insert({
        user_id: userId,
        token_id: validToken.token_id,
        method: req.method,
        path: path,
        ip_address: req.headers.get('x-forwarded-for') || 'unknown',
        user_agent: req.headers.get('user-agent') || 'unknown'
      });
    } catch (logError) {
      console.log('Failed to log access:', logError);
      // Don't fail the request if logging fails
    }

    // Route WebDAV methods
    switch (req.method) {
      case 'PROPFIND':
        return await handlePropfind(supabase, userId, path, req);
      case 'GET':
        return await handleGet(supabase, userId, path);
      case 'PUT':
        return await handlePut(supabase, userId, path, req);
      case 'DELETE':
        return await handleDelete(supabase, userId, path);
      case 'MKCOL':
        return await handleMkcol(supabase, userId, path);
      case 'COPY':
      case 'MOVE':
        return await handleCopyMove(supabase, userId, path, req);
      default:
        console.log('Unsupported method:', req.method);
        return new Response('Method not allowed', { 
          status: 405,
          headers: corsHeaders
        });
    }

  } catch (error) {
    console.error('WebDAV error:', error);
    return new Response('Internal server error', { 
      status: 500,
      headers: corsHeaders
    });
  }
});

async function handlePropfind(supabase: any, userId: string, path: string, req: Request) {
  const depth = req.headers.get('depth') || '1';
  
  try {
    // Get folders and documents based on path
    let folders = [];
    let documents = [];
    
    if (path === '/' || path === '') {
      // Root directory - get user's folders
      const { data: foldersData } = await supabase
        .from('folders')
        .select('*')
        .is('parent_folder_id', null)
        .or(`created_by.eq.${userId},artist_id.in.(select id from artists where user_id = ${userId})`);
      
      folders = foldersData || [];
      
      // Get documents in root
      const { data: docsData } = await supabase
        .from('documents')
        .select('*')
        .is('folder_id', null)
        .eq('is_deleted', false)
        .or(`artist_id.in.(select id from artists where user_id = ${userId})`);
      
      documents = docsData || [];
    } else {
      // Specific folder
      const folderPath = path.substring(1);
      const { data: currentFolder } = await supabase
        .from('folders')
        .select('*')
        .eq('name', folderPath)
        .single();
      
      if (currentFolder) {
        // Get subfolders
        const { data: foldersData } = await supabase
          .from('folders')
          .select('*')
          .eq('parent_folder_id', currentFolder.id);
        
        folders = foldersData || [];
        
        // Get documents in this folder
        const { data: docsData } = await supabase
          .from('documents')
          .select('*')
          .eq('folder_id', currentFolder.id)
          .eq('is_deleted', false);
        
        documents = docsData || [];
      }
    }

    // Build XML response
    const items = [
      {
        href: path,
        isCollection: true,
        name: path === '/' ? 'Root' : path.split('/').pop(),
        size: 0,
        lastModified: new Date().toISOString()
      }
    ];

    if (depth !== '0') {
      // Add folders
      folders.forEach(folder => {
        items.push({
          href: `${path}${path.endsWith('/') ? '' : '/'}${folder.name}/`,
          isCollection: true,
          name: folder.name,
          size: 0,
          lastModified: folder.updated_at
        });
      });

      // Add documents
      documents.forEach(doc => {
        items.push({
          href: `${path}${path.endsWith('/') ? '' : '/'}${doc.file_name}`,
          isCollection: false,
          name: doc.file_name,
          size: doc.file_size || 0,
          lastModified: doc.updated_at
        });
      });
    }

    const xml = generatePropfindXML(items);
    
    return new Response(xml, {
      status: 207,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8'
      }
    });

  } catch (error) {
    console.error('PROPFIND error:', error);
    return new Response('Not found', { status: 404, headers: corsHeaders });
  }
}

async function handleGet(supabase: any, userId: string, path: string) {
  if (path === '/' || path === '') {
    return new Response('Directory listing not available via GET', { 
      status: 403,
      headers: corsHeaders
    });
  }

  try {
    const fileName = path.split('/').pop();
    
    // Find the document
    const { data: document } = await supabase
      .from('documents')
      .select('*')
      .eq('file_name', fileName)
      .eq('is_deleted', false)
      .single();

    if (!document) {
      return new Response('File not found', { status: 404, headers: corsHeaders });
    }

    // Check if user has access
    const hasAccess = await checkDocumentAccess(supabase, userId, document.id);
    if (!hasAccess) {
      return new Response('Forbidden', { status: 403, headers: corsHeaders });
    }

    // Fetch the file from the URL
    const fileResponse = await fetch(document.file_url);
    if (!fileResponse.ok) {
      return new Response('File not accessible', { status: 404, headers: corsHeaders });
    }

    const fileData = await fileResponse.arrayBuffer();
    
    return new Response(fileData, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': document.mime_type || 'application/octet-stream',
        'Content-Length': fileData.byteLength.toString(),
        'Last-Modified': new Date(document.updated_at).toUTCString()
      }
    });

  } catch (error) {
    console.error('GET error:', error);
    return new Response('Internal server error', { status: 500, headers: corsHeaders });
  }
}

async function handlePut(supabase: any, userId: string, path: string, req: Request) {
  try {
    const fileName = path.split('/').pop();
    if (!fileName) {
      return new Response('Invalid file name', { status: 400, headers: corsHeaders });
    }

    const fileData = await req.arrayBuffer();
    const contentType = req.headers.get('content-type') || 'application/octet-stream';

    // Upload to Supabase storage (if you have storage configured)
    // For now, we'll create a document record
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
      console.error('PUT error:', error);
      return new Response('Upload failed', { status: 500, headers: corsHeaders });
    }

    return new Response('Created', { 
      status: 201,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('PUT error:', error);
    return new Response('Upload failed', { status: 500, headers: corsHeaders });
  }
}

async function handleDelete(supabase: any, userId: string, path: string) {
  try {
    const fileName = path.split('/').pop();
    
    // Soft delete the document
    const { error } = await supabase
      .from('documents')
      .update({ 
        is_deleted: true, 
        deleted_at: new Date().toISOString() 
      })
      .eq('file_name', fileName);

    if (error) {
      return new Response('Delete failed', { status: 500, headers: corsHeaders });
    }

    return new Response('Deleted', { 
      status: 204,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('DELETE error:', error);
    return new Response('Delete failed', { status: 500, headers: corsHeaders });
  }
}

async function handleMkcol(supabase: any, userId: string, path: string) {
  try {
    const folderName = path.split('/').filter(p => p).pop();
    if (!folderName) {
      return new Response('Invalid folder name', { status: 400, headers: corsHeaders });
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
      return new Response('Folder creation failed', { status: 500, headers: corsHeaders });
    }

    return new Response('Created', { 
      status: 201,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('MKCOL error:', error);
    return new Response('Folder creation failed', { status: 500, headers: corsHeaders });
  }
}

async function handleCopyMove(supabase: any, userId: string, path: string, req: Request) {
  // Implement COPY/MOVE operations
  return new Response('Not implemented', { 
    status: 501,
    headers: corsHeaders
  });
}

async function checkDocumentAccess(supabase: any, userId: string, documentId: string) {
  try {
    const { data } = await supabase.rpc('is_document_accessible_by_current_artist', {
      _document_id: documentId
    });
    return data;
  } catch (error) {
    console.error('Access check error:', error);
    return false;
  }
}

function generatePropfindXML(items: any[]) {
  const xmlItems = items.map(item => `
    <D:response>
      <D:href>${escapeXml(item.href)}</D:href>
      <D:propstat>
        <D:prop>
          <D:displayname>${escapeXml(item.name)}</D:displayname>
          <D:getlastmodified>${new Date(item.lastModified).toUTCString()}</D:getlastmodified>
          ${item.isCollection ? 
            '<D:resourcetype><D:collection/></D:resourcetype>' : 
            `<D:resourcetype/>
             <D:getcontentlength>${item.size}</D:getcontentlength>
             <D:getcontenttype>application/octet-stream</D:getcontenttype>`
          }
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
