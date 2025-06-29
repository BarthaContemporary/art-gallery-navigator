
import { UserInfo } from "../auth.ts";
import { getWebDAVResponseHeaders } from "../headers.ts";
import { parseWebDAVPath } from "../utils.ts";

export async function handlePropfind(supabase: any, userInfo: UserInfo, path: string, req: Request, requestId: string) {
  const depth = req.headers.get('Depth') || '1';
  console.log(`[${requestId}] PROPFIND depth: ${depth}`);
  console.log(`[${requestId}] PROPFIND for path: "${path}"`);
  
  const pathInfo = parseWebDAVPath(path);
  console.log(`[${requestId}] Parsed path info:`, pathInfo);
  
  if (pathInfo.fileName) {
    // Request for a specific file
    return handleFilePropfind(supabase, userInfo, pathInfo, requestId);
  } else if (pathInfo.isRoot || !pathInfo.folderName) {
    // Root directory request
    return handleRootPropfind(supabase, userInfo, requestId);
  } else {
    // Folder contents request
    return handleFolderPropfind(supabase, userInfo, pathInfo, requestId);
  }
}

async function handleRootPropfind(supabase: any, userInfo: UserInfo, requestId: string) {
  console.log(`[${requestId}] Fetching root folders for user`);
  
  const { data: folders, error } = await supabase.rpc('get_user_accessible_folders_for_user', {
    user_id_param: userInfo.user_id
  });
  
  if (error) {
    console.error(`[${requestId}] Error fetching folders:`, error);
    return new Response('Internal server error', {
      status: 500,
      headers: getWebDAVResponseHeaders()
    });
  }
  
  console.log(`[${requestId}] Found ${folders?.length || 0} accessible folders`);
  
  let response = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/functions/v1/webdav/</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>WebDAV Root</D:displayname>
        <D:resourcetype><D:collection/></D:resourcetype>
        <D:creationdate>${new Date().toISOString()}</D:creationdate>
        <D:getlastmodified>${new Date().toUTCString()}</D:getlastmodified>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`;
  
  // Add folder entries
  for (const folder of (folders || [])) {
    const encodedName = encodeURIComponent(folder.folder_name);
    response += `
  <D:response>
    <D:href>/functions/v1/webdav/${encodedName}/</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>${escapeXml(folder.folder_name)}</D:displayname>
        <D:resourcetype><D:collection/></D:resourcetype>
        <D:creationdate>${new Date().toISOString()}</D:creationdate>
        <D:getlastmodified>${new Date().toUTCString()}</D:getlastmodified>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`;
  }
  
  response += '\n</D:multistatus>';
  
  console.log(`[${requestId}] Returning root PROPFIND response with ${folders?.length || 0} folders`);
  
  return new Response(response, {
    status: 207,
    headers: getWebDAVResponseHeaders({
      'Content-Type': 'application/xml; charset=utf-8'
    })
  });
}

async function handleFolderPropfind(supabase: any, userInfo: UserInfo, pathInfo: any, requestId: string) {
  console.log(`[${requestId}] Fetching contents for folder: "${pathInfo.folderName}"`);
  
  // First, verify the folder exists and user has access
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
    console.log(`[${requestId}] Folder "${pathInfo.folderName}" not found`);
    return new Response('Folder not found', {
      status: 404,
      headers: getWebDAVResponseHeaders()
    });
  }
  
  console.log(`[${requestId}] Found folder:`, {
    id: targetFolder.folder_id,
    name: targetFolder.folder_name,
    artist_id: targetFolder.artist_id
  });
  
  // Get documents in this folder
  console.log(`[${requestId}] Fetching documents for folder ID: ${targetFolder.folder_id}`);
  
  const { data: documents, error: docsError } = await supabase.rpc('get_user_accessible_documents', {
    folder_id_param: targetFolder.folder_id
  });
  
  if (docsError) {
    console.error(`[${requestId}] Error fetching documents:`, docsError);
  }
  
  console.log(`[${requestId}] Found ${documents?.length || 0} documents in folder`);
  console.log(`[${requestId}] Document details:`, documents || []);
  
  // Filter out system files and deleted files
  const visibleDocs = (documents || []).filter((doc: any) => 
    !doc.document_name.startsWith('._') && 
    !doc.document_name.startsWith('.') && 
    doc.document_name !== '.DS_Store' &&
    !doc.is_deleted
  );
  
  console.log(`[${requestId}] Visible documents after filtering: ${visibleDocs.length}`);
  
  const encodedFolderName = encodeURIComponent(pathInfo.folderName);
  
  let response = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/functions/v1/webdav/${encodedFolderName}/</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>${escapeXml(pathInfo.folderName)}</D:displayname>
        <D:resourcetype><D:collection/></D:resourcetype>
        <D:creationdate>${new Date().toISOString()}</D:creationdate>
        <D:getlastmodified>${new Date().toUTCString()}</D:getlastmodified>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`;
  
  // Add document entries
  for (const doc of visibleDocs) {
    const encodedFileName = encodeURIComponent(doc.document_name);
    const fileSize = doc.file_size || 0;
    const lastModified = doc.updated_at ? new Date(doc.updated_at).toUTCString() : new Date().toUTCString();
    const created = doc.created_at ? new Date(doc.created_at).toISOString() : new Date().toISOString();
    
    response += `
  <D:response>
    <D:href>/functions/v1/webdav/${encodedFolderName}/${encodedFileName}</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>${escapeXml(doc.document_name)}</D:displayname>
        <D:getcontentlength>${fileSize}</D:getcontentlength>
        <D:getcontenttype>${doc.mime_type || 'application/octet-stream'}</D:getcontenttype>
        <D:creationdate>${created}</D:creationdate>
        <D:getlastmodified>${lastModified}</D:getlastmodified>
        <D:getetag>"${doc.document_id}-${Date.now()}"</D:getetag>
        <D:resourcetype/>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`;
  }
  
  response += '\n</D:multistatus>';
  
  console.log(`[${requestId}] Returning PROPFIND response with ${visibleDocs.length} documents`);
  
  return new Response(response, {
    status: 207,
    headers: getWebDAVResponseHeaders({
      'Content-Type': 'application/xml; charset=utf-8'
    })
  });
}

async function handleFilePropfind(supabase: any, userInfo: UserInfo, pathInfo: any, requestId: string) {
  console.log(`[${requestId}] Getting properties for file "${pathInfo.fileName}" in folder "${pathInfo.folderName}"`);
  
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
    return new Response('Folder not found', {
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
    return new Response('File not found', {
      status: 404,
      headers: getWebDAVResponseHeaders()
    });
  }
  
  const encodedFolderName = encodeURIComponent(pathInfo.folderName);
  const encodedFileName = encodeURIComponent(pathInfo.fileName);
  const fileSize = document.file_size || 0;
  const lastModified = document.updated_at ? new Date(document.updated_at).toUTCString() : new Date().toUTCString();
  const created = document.created_at ? new Date(document.created_at).toISOString() : new Date().toISOString();
  
  const response = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/functions/v1/webdav/${encodedFolderName}/${encodedFileName}</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>${escapeXml(pathInfo.fileName)}</D:displayname>
        <D:getcontentlength>${fileSize}</D:getcontentlength>
        <D:getcontenttype>${document.mime_type || 'application/octet-stream'}</D:getcontenttype>
        <D:creationdate>${created}</D:creationdate>
        <D:getlastmodified>${lastModified}</D:getlastmodified>
        <D:getetag>"${document.document_id}-${Date.now()}"</D:getetag>
        <D:resourcetype/>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`;
  
  console.log(`[${requestId}] Returning file PROPFIND response for: ${pathInfo.fileName}`);
  
  return new Response(response, {
    status: 207,
    headers: getWebDAVResponseHeaders({
      'Content-Type': 'application/xml; charset=utf-8'
    })
  });
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
