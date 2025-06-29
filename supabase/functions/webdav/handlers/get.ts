
import { UserInfo } from "../auth.ts";
import { getWebDAVResponseHeaders } from "../headers.ts";
import { parseWebDAVPath } from "../utils.ts";

export async function handleGet(supabase: any, userInfo: UserInfo, path: string, requestId: string, isHead = false) {
  console.log(`[${requestId}] ${isHead ? 'HEAD' : 'GET'} for path: "${path}"`);
  
  const pathInfo = parseWebDAVPath(path);
  console.log(`[${requestId}] Parsed path info:`, pathInfo);
  
  if (pathInfo.isRoot || !pathInfo.fileName) {
    // Directory listing or root access - return HTML directory listing
    return handleDirectoryGet(supabase, userInfo, pathInfo, requestId);
  }
  
  // File download request
  return handleFileGet(supabase, userInfo, pathInfo, requestId, isHead);
}

async function handleDirectoryGet(supabase: any, userInfo: UserInfo, pathInfo: any, requestId: string) {
  console.log(`[${requestId}] Directory GET request for: ${pathInfo.folderName || 'root'}`);
  
  // Return a simple HTML directory listing for browser compatibility
  const html = `<!DOCTYPE html>
<html>
<head>
    <title>WebDAV Directory</title>
    <meta charset="utf-8">
</head>
<body>
    <h1>WebDAV Directory</h1>
    <p>This is a WebDAV server. Please use a WebDAV client to access files.</p>
    <p>For Mac Finder: Connect to Server (Cmd+K) and use this URL.</p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: getWebDAVResponseHeaders({
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': html.length.toString()
    })
  });
}

async function handleFileGet(supabase: any, userInfo: UserInfo, pathInfo: any, requestId: string, isHead: boolean) {
  console.log(`[${requestId}] File ${isHead ? 'HEAD' : 'GET'} request for: "${pathInfo.fileName}" in folder: "${pathInfo.folderName}"`);
  
  // Find the folder first
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
  
  // Find the document
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
    // Fetch the file from storage
    const fileResponse = await fetch(document.file_url);
    if (!fileResponse.ok) {
      console.error(`[${requestId}] Failed to fetch file from storage: ${fileResponse.status}`);
      return new Response('File not accessible', {
        status: 404,
        headers: getWebDAVResponseHeaders()
      });
    }
    
    const contentType = document.mime_type || 'application/octet-stream';
    const fileSize = document.file_size || 0;
    const lastModified = document.updated_at ? new Date(document.updated_at).toUTCString() : new Date().toUTCString();
    const etag = `"${document.document_id}-${Date.now()}"`;
    
    const headers = getWebDAVResponseHeaders({
      'Content-Type': contentType,
      'Content-Length': fileSize.toString(),
      'Last-Modified': lastModified,
      'ETag': etag,
      'Accept-Ranges': 'bytes',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(pathInfo.fileName)}"`
    });
    
    if (isHead) {
      // HEAD request - return headers only
      return new Response(null, {
        status: 200,
        headers
      });
    } else {
      // GET request - return file content
      const fileContent = await fileResponse.arrayBuffer();
      return new Response(fileContent, {
        status: 200,
        headers
      });
    }
    
  } catch (error) {
    console.error(`[${requestId}] Error fetching file:`, error);
    return new Response('Internal server error', {
      status: 500,
      headers: getWebDAVResponseHeaders()
    });
  }
}
