
import { UserInfo } from "../auth.ts";
import { getWebDAVResponseHeaders } from "../headers.ts";
import { parseWebDAVPath, generateETag, formatDateForWebDAV } from "../utils.ts";

export async function handleGet(supabase: any, userInfo: UserInfo, path: string, requestId: string, isHead = false) {
  console.log(`[${requestId}] ${isHead ? 'HEAD' : 'GET'} for path: "${path}"`);
  
  const pathInfo = parseWebDAVPath(path);
  console.log(`[${requestId}] Parsed path info:`, pathInfo);
  
  // Handle system files gracefully
  if (pathInfo.isSystemFile) {
    console.log(`[${requestId}] System file request: ${pathInfo.fileName || pathInfo.folderName}`);
    return new Response('Not Found', {
      status: 404,
      headers: getWebDAVResponseHeaders()
    });
  }
  
  if (pathInfo.isRoot || !pathInfo.fileName) {
    return handleDirectoryGet(supabase, userInfo, pathInfo, requestId);
  }
  
  return handleFileGet(supabase, userInfo, pathInfo, requestId, isHead);
}

async function handleDirectoryGet(supabase: any, userInfo: UserInfo, pathInfo: any, requestId: string) {
  console.log(`[${requestId}] Directory GET for: ${pathInfo.folderName || 'root'}`);
  
  // Return a Mac-friendly HTML directory listing
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>WebDAV Directory - ${pathInfo.folderName || 'Root'}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; }
        .header { border-bottom: 1px solid #ddd; padding-bottom: 20px; margin-bottom: 30px; }
        .info { background: #f5f5f7; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .code { font-family: 'SF Mono', Monaco, monospace; background: #f0f0f0; padding: 2px 6px; border-radius: 3px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📁 WebDAV Directory</h1>
        <p>Path: <span class="code">${pathInfo.folderName || '/'}</span></p>
    </div>
    
    <div class="info">
        <h3>🍎 Mac Finder Instructions</h3>
        <p><strong>To connect with Mac Finder:</strong></p>
        <ol>
            <li>Open Finder and press <kbd>⌘K</kbd> (Command+K)</li>
            <li>Enter this URL: <span class="code">https://your-supabase-url.supabase.co/functions/v1/webdav/</span></li>
            <li>Use username: <span class="code">webdav</span></li>
            <li>Use your 64-character WebDAV token as password</li>
        </ol>
        
        <h4>📱 iOS Files App</h4>
        <p>In the Files app, tap "..." → "Connect to Server" and use the same URL and credentials.</p>
    </div>
    
    <p><small>WebDAV Server - Powered by Supabase</small></p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: getWebDAVResponseHeaders({
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': html.length.toString(),
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    })
  });
}

async function handleFileGet(supabase: any, userInfo: UserInfo, pathInfo: any, requestId: string, isHead: boolean) {
  console.log(`[${requestId}] File ${isHead ? 'HEAD' : 'GET'} for: "${pathInfo.fileName}" in "${pathInfo.folderName}"`);
  
  // Find folder
  const { data: folders, error: folderError } = await supabase.rpc('get_user_accessible_folders_for_user', {
    user_id_param: userInfo.user_id
  });
  
  if (folderError) {
    console.error(`[${requestId}] Error fetching folders:`, folderError);
    return new Response('Internal server error', {
      status: 500,
      headers: getWebDAVResponseHeaders()
    });
  }
  
  const targetFolder = folders?.find((f: any) => f.folder_name === pathInfo.folderName);
  if (!targetFolder) {
    console.log(`[${requestId}] Folder not found: "${pathInfo.folderName}"`);
    return new Response('Not Found', {
      status: 404,
      headers: getWebDAVResponseHeaders()
    });
  }
  
  // Find document
  const { data: documents, error: docsError } = await supabase.rpc('get_user_accessible_documents', {
    folder_id_param: targetFolder.folder_id
  });
  
  if (docsError) {
    console.error(`[${requestId}] Error fetching documents:`, docsError);
    return new Response('Internal server error', {
      status: 500,
      headers: getWebDAVResponseHeaders()
    });
  }
  
  const document = documents?.find((doc: any) => doc.document_name === pathInfo.fileName);
  if (!document) {
    console.log(`[${requestId}] File not found: "${pathInfo.fileName}"`);
    return new Response('Not Found', {
      status: 404,
      headers: getWebDAVResponseHeaders()
    });
  }
  
  try {
    // Handle placeholder URLs (zero-byte files)
    if (document.file_url.startsWith('placeholder://')) {
      console.log(`[${requestId}] Returning empty content for placeholder file`);
      
      const headers = getWebDAVResponseHeaders({
        'Content-Type': document.mime_type || 'application/octet-stream',
        'Content-Length': '0',
        'Last-Modified': formatDateForWebDAV(document.updated_at || new Date()),
        'ETag': generateETag(document.document_id, document.updated_at || new Date()),
        'Accept-Ranges': 'bytes',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(pathInfo.fileName)}"`
      });
      
      return new Response(isHead ? null : new Uint8Array(0), {
        status: 200,
        headers
      });
    }
    
    // Fetch actual file
    const fileResponse = await fetch(document.file_url);
    if (!fileResponse.ok) {
      console.error(`[${requestId}] File fetch failed: ${fileResponse.status}`);
      return new Response('File not accessible', {
        status: 404,
        headers: getWebDAVResponseHeaders()
      });
    }
    
    const contentType = document.mime_type || fileResponse.headers.get('content-type') || 'application/octet-stream';
    const fileSize = document.file_size || 0;
    const lastModified = document.updated_at ? new Date(document.updated_at) : new Date();
    const etag = generateETag(document.document_id, lastModified);
    
    const headers = getWebDAVResponseHeaders({
      'Content-Type': contentType,
      'Content-Length': fileSize.toString(),
      'Last-Modified': formatDateForWebDAV(lastModified),
      'ETag': etag,
      'Accept-Ranges': 'bytes',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(pathInfo.fileName)}"`,
      'Cache-Control': 'private, max-age=0'
    });
    
    if (isHead) {
      return new Response(null, { status: 200, headers });
    } else {
      const fileContent = await fileResponse.arrayBuffer();
      return new Response(fileContent, { status: 200, headers });
    }
    
  } catch (error) {
    console.error(`[${requestId}] Error serving file:`, error);
    return new Response('Internal server error', {
      status: 500,
      headers: getWebDAVResponseHeaders()
    });
  }
}
