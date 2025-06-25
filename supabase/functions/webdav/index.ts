
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
    console.log(`WebDAV ${req.method} request received for URL: ${req.url}`);
    
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
    
    // Fix path handling - properly extract WebDAV path
    let path = url.pathname;
    if (path.includes('/functions/v1/webdav')) {
      path = path.replace('/functions/v1/webdav', '');
    } else if (path.includes('/webdav')) {
      path = path.replace('/webdav', '');
    }
    
    // Ensure path starts with /
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    
    // Remove trailing slashes except for root
    if (path !== '/' && path.endsWith('/')) {
      path = path.slice(0, -1);
    }

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
  
  console.log(`PROPFIND for path: ${path}, depth: ${depth}, userId: ${userId}`);
  
  try {
    // Simplified approach: Just return basic structure for now
    let folders = [];
    let documents = [];
    
    if (path === '/' || path === '') {
      console.log('Handling root directory request');
      
      // For root directory, get user's folders and documents
      try {
        // Get user's folders (simplified query)
        const { data: foldersData, error: foldersError } = await supabase
          .from('folders')
          .select('id, name, created_at, updated_at')
          .or(`created_by.eq.${userId},artist_id.in.(select id from artists where user_id = ${userId})`)
          .is('parent_folder_id', null);
        
        if (foldersError) {
          console.log('Folders query error:', foldersError);
        } else {
          folders = foldersData || [];
          console.log(`Found ${folders.length} folders for user`);
        }

        // Get documents in root (simplified query)
        const { data: docsData, error: docsError } = await supabase
          .from('documents')
          .select('id, file_name, file_size, updated_at, mime_type')
          .is('folder_id', null)
          .eq('is_deleted', false)
          .or(`artist_id.in.(select id from artists where user_id = ${userId})`);
        
        if (docsError) {
          console.log('Documents query error:', docsError);
        } else {
          documents = docsData || [];
          console.log(`Found ${documents.length} documents for user`);
        }
      } catch (queryError) {
        console.log('Query error:', queryError);
        // Continue with empty arrays if queries fail
      }
    } else {
      console.log(`Handling specific folder: ${path}`);
      
      // For specific folder, try to find it and get its contents
      const folderName = path.substring(1); // Remove leading slash
      
      try {
        const { data: currentFolder } = await supabase
          .from('folders')
          .select('id, name')
          .eq('name', folderName)
          .or(`created_by.eq.${userId},artist_id.in.(select id from artists where user_id = ${userId})`)
          .single();
        
        if (currentFolder) {
          console.log(`Found folder: ${currentFolder.name}`);
          
          // Get subfolders
          const { data: foldersData } = await supabase
            .from('folders')
            .select('id, name, created_at, updated_at')
            .eq('parent_folder_id', currentFolder.id);
          
          folders = foldersData || [];
          
          // Get documents in this folder
          const { data: docsData } = await supabase
            .from('documents')
            .select('id, file_name, file_size, updated_at, mime_type')
            .eq('folder_id', currentFolder.id)
            .eq('is_deleted', false);
          
          documents = docsData || [];
        }
      } catch (queryError) {
        console.log('Specific folder query error:', queryError);
      }
    }

    // Build XML response
    const items = [
      {
        href: path || '/',
        isCollection: true,
        name: path === '/' || path === '' ? 'Root' : path.split('/').pop(),
        size: 0,
        lastModified: new Date().toISOString()
      }
    ];

    if (depth !== '0') {
      // Add folders
      folders.forEach(folder => {
        const folderPath = path === '/' ? `/${folder.name}/` : `${path}/${folder.name}/`;
        items.push({
          href: folderPath,
          isCollection: true,
          name: folder.name,
          size: 0,
          lastModified: folder.updated_at || folder.created_at
        });
      });

      // Add documents
      documents.forEach(doc => {
        const docPath = path === '/' ? `/${doc.file_name}` : `${path}/${doc.file_name}`;
        items.push({
          href: docPath,
          isCollection: false,
          name: doc.file_name,
          size: doc.file_size || 0,
          lastModified: doc.updated_at
        });
      });
    }

    console.log(`Returning ${items.length} items for PROPFIND`);
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
  console.log(`GET request for path: ${path}`);
  
  if (path === '/' || path === '') {
    return new Response('Directory listing not available via GET', { 
      status: 403,
      headers: corsHeaders
    });
  }

  try {
    const fileName = path.split('/').pop();
    console.log(`Looking for file: ${fileName}`);
    
    // Find the document (simplified query)
    const { data: document, error } = await supabase
      .from('documents')
      .select('*')
      .eq('file_name', fileName)
      .eq('is_deleted', false)
      .or(`artist_id.in.(select id from artists where user_id = ${userId})`)
      .single();

    if (error || !document) {
      console.log('Document not found:', error);
      return new Response('File not found', { status: 404, headers: corsHeaders });
    }

    console.log(`Found document: ${document.file_name}`);

    // Fetch the file from the URL
    const fileResponse = await fetch(document.file_url);
    if (!fileResponse.ok) {
      console.log('File not accessible from URL:', document.file_url);
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
  console.log(`PUT request for path: ${path}`);
  
  try {
    const fileName = path.split('/').pop();
    if (!fileName) {
      return new Response('Invalid file name', { status: 400, headers: corsHeaders });
    }

    const fileData = await req.arrayBuffer();
    const contentType = req.headers.get('content-type') || 'application/octet-stream';

    console.log(`Uploading file: ${fileName}, size: ${fileData.byteLength}`);

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
      console.error('PUT error:', error);
      return new Response('Upload failed', { status: 500, headers: corsHeaders });
    }

    console.log(`File uploaded successfully: ${document.id}`);

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
  console.log(`DELETE request for path: ${path}`);
  
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
      console.error('DELETE error:', error);
      return new Response('Delete failed', { status: 500, headers: corsHeaders });
    }

    console.log(`File deleted: ${fileName}`);

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
  console.log(`MKCOL request for path: ${path}`);
  
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
      console.error('MKCOL error:', error);
      return new Response('Folder creation failed', { status: 500, headers: corsHeaders });
    }

    console.log(`Folder created: ${folder.name}`);

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
  console.log(`${req.method} request for path: ${path}`);
  
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
