
import { UserInfo } from "../auth.ts";
import { getWebDAVResponseHeaders } from "../headers.ts";
import { parseWebDAVPath, escapeXml, generateETag, formatDateForWebDAV, createWebDAVXmlResponse } from "../utils.ts";

export async function handlePropfind(supabase: any, userInfo: UserInfo, path: string, req: Request, requestId: string) {
  const depth = req.headers.get('Depth') || '1';
  console.log(`[${requestId}] PROPFIND depth: ${depth} for path: "${path}"`);
  
  const pathInfo = parseWebDAVPath(path);
  console.log(`[${requestId}] Parsed path:`, pathInfo);
  
  // Handle system files with success response to avoid Mac Finder errors
  if (pathInfo.isSystemFile) {
    console.log(`[${requestId}] System file request: ${pathInfo.fileName || pathInfo.folderName}`);
    return createSystemFileResponse(path, requestId);
  }
  
  if (pathInfo.fileName) {
    return handleFilePropfind(supabase, userInfo, pathInfo, requestId);
  } else if (pathInfo.isRoot || !pathInfo.folderName) {
    return handleRootPropfind(supabase, userInfo, requestId);
  } else {
    return handleFolderPropfind(supabase, userInfo, pathInfo, requestId);
  }
}

function createSystemFileResponse(path: string, requestId: string): Response {
  console.log(`[${requestId}] Creating system file response for: ${path}`);
  
  const response = createWebDAVXmlResponse(`
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>${escapeXml(path)}</D:href>
    <D:propstat>
      <D:status>HTTP/1.1 404 Not Found</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`);

  return new Response(response, {
    status: 207,
    headers: getWebDAVResponseHeaders({
      'Content-Type': 'text/xml; charset=utf-8',
      'Content-Length': response.length.toString()
    })
  });
}

async function handleRootPropfind(supabase: any, userInfo: UserInfo, requestId: string) {
  console.log(`[${requestId}] Root PROPFIND - fetching folders`);
  
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
  
  const currentTime = new Date();
  const rootEtag = generateETag('root', currentTime);
  
  let xmlContent = `
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/functions/v1/webdav/</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>WebDAV Root</D:displayname>
        <D:resourcetype><D:collection/></D:resourcetype>
        <D:creationdate>${currentTime.toISOString()}</D:creationdate>
        <D:getlastmodified>${formatDateForWebDAV(currentTime)}</D:getlastmodified>
        <D:getetag>${rootEtag}</D:getetag>
        <D:getcontenttype>httpd/unix-directory</D:getcontenttype>
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
  
  // Add folder entries with full WebDAV properties
  for (const folder of (folders || [])) {
    const encodedName = encodeURIComponent(folder.folder_name);
    const folderEtag = generateETag(folder.folder_id, currentTime);
    
    xmlContent += `
  <D:response>
    <D:href>/functions/v1/webdav/${encodedName}/</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>${escapeXml(folder.folder_name)}</D:displayname>
        <D:resourcetype><D:collection/></D:resourcetype>
        <D:creationdate>${currentTime.toISOString()}</D:creationdate>
        <D:getlastmodified>${formatDateForWebDAV(currentTime)}</D:getlastmodified>
        <D:getetag>${folderEtag}</D:getetag>
        <D:getcontenttype>httpd/unix-directory</D:getcontenttype>
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
  
  xmlContent += '\n</D:multistatus>';
  
  const response = createWebDAVXmlResponse(xmlContent);
  
  return new Response(response, {
    status: 207,
    headers: getWebDAVResponseHeaders({
      'Content-Type': 'text/xml; charset=utf-8',
      'Content-Length': response.length.toString()
    })
  });
}

async function handleFolderPropfind(supabase: any, userInfo: UserInfo, pathInfo: any, requestId: string) {
  console.log(`[${requestId}] Folder PROPFIND for: "${pathInfo.folderName}"`);
  
  // Verify folder access
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
  
  // Get documents in folder
  const { data: documents, error: docsError } = await supabase.rpc('get_user_accessible_documents', {
    folder_id_param: targetFolder.folder_id
  });
  
  if (docsError) {
    console.error(`[${requestId}] Error fetching documents:`, docsError);
  }
  
  // Filter visible documents (exclude system files)
  const visibleDocs = (documents || []).filter((doc: any) => 
    !doc.document_name.startsWith('._') && 
    !doc.document_name.startsWith('.') && 
    doc.document_name !== '.DS_Store' &&
    !doc.is_deleted
  );
  
  const encodedFolderName = encodeURIComponent(pathInfo.folderName);
  const currentTime = new Date();
  const folderEtag = generateETag(targetFolder.folder_id, currentTime);
  
  let xmlContent = `
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/functions/v1/webdav/${encodedFolderName}/</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>${escapeXml(pathInfo.folderName)}</D:displayname>
        <D:resourcetype><D:collection/></D:resourcetype>
        <D:creationdate>${currentTime.toISOString()}</D:creationdate>
        <D:getlastmodified>${formatDateForWebDAV(currentTime)}</D:getlastmodified>
        <D:getetag>${folderEtag}</D:getetag>
        <D:getcontenttype>httpd/unix-directory</D:getcontenttype>
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
  
  // Add document entries with full properties
  for (const doc of visibleDocs) {
    const encodedFileName = encodeURIComponent(doc.document_name);
    const fileSize = doc.file_size || 0;
    const lastModified = doc.updated_at ? new Date(doc.updated_at) : currentTime;
    const created = doc.created_at ? new Date(doc.created_at) : currentTime;
    const contentType = doc.mime_type || 'application/octet-stream';
    const docEtag = generateETag(doc.document_id, lastModified);
    
    xmlContent += `
  <D:response>
    <D:href>/functions/v1/webdav/${encodedFolderName}/${encodedFileName}</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>${escapeXml(doc.document_name)}</D:displayname>
        <D:getcontentlength>${fileSize}</D:getcontentlength>
        <D:getcontenttype>${contentType}</D:getcontenttype>
        <D:creationdate>${created.toISOString()}</D:creationdate>
        <D:getlastmodified>${formatDateForWebDAV(lastModified)}</D:getlastmodified>
        <D:getetag>${docEtag}</D:getetag>
        <D:resourcetype/>
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
  
  xmlContent += '\n</D:multistatus>';
  
  const response = createWebDAVXmlResponse(xmlContent);
  
  console.log(`[${requestId}] Returning folder PROPFIND with ${visibleDocs.length} documents`);
  
  return new Response(response, {
    status: 207,
    headers: getWebDAVResponseHeaders({
      'Content-Type': 'text/xml; charset=utf-8',
      'Content-Length': response.length.toString()
    })
  });
}

async function handleFilePropfind(supabase: any, userInfo: UserInfo, pathInfo: any, requestId: string) {
  console.log(`[${requestId}] File PROPFIND for: "${pathInfo.fileName}" in "${pathInfo.folderName}"`);
  
  // Find folder first
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
  
  const encodedFolderName = encodeURIComponent(pathInfo.folderName);
  const encodedFileName = encodeURIComponent(pathInfo.fileName);
  const fileSize = document.file_size || 0;
  const lastModified = document.updated_at ? new Date(document.updated_at) : new Date();
  const created = document.created_at ? new Date(document.created_at) : new Date();
  const contentType = document.mime_type || 'application/octet-stream';
  const docEtag = generateETag(document.document_id, lastModified);
  
  const xmlContent = `
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/functions/v1/webdav/${encodedFolderName}/${encodedFileName}</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>${escapeXml(pathInfo.fileName)}</D:displayname>
        <D:getcontentlength>${fileSize}</D:getcontentlength>
        <D:getcontenttype>${contentType}</D:getcontenttype>
        <D:creationdate>${created.toISOString()}</D:creationdate>
        <D:getlastmodified>${formatDateForWebDAV(lastModified)}</D:getlastmodified>
        <D:getetag>${docEtag}</D:getetag>
        <D:resourcetype/>
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
</D:multistatus>`;
  
  const response = createWebDAVXmlResponse(xmlContent);
  
  return new Response(response, {
    status: 207,
    headers: getWebDAVResponseHeaders({
      'Content-Type': 'text/xml; charset=utf-8',
      'Content-Length': response.length.toString()
    })
  });
}
