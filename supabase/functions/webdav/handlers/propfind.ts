
import { UserInfo } from "../auth.ts";
import { getWebDAVResponseHeaders } from "../headers.ts";
import { parseWebDAVPath, escapeXml, generateETag, formatDateForWebDAV, createWebDAVXmlResponse, createMacCompatibleHref, matchesFolderName } from "../utils.ts";

export async function handlePropfind(supabase: any, userInfo: UserInfo, path: string, req: Request, requestId: string) {
  const depth = req.headers.get('Depth') || '1';
  console.log(`[${requestId}] PROPFIND depth: ${depth} for path: "${path}"`);
  
  const pathInfo = parseWebDAVPath(path);
  console.log(`[${requestId}] Parsed path:`, pathInfo);
  
  // Handle system files with proper 404 response for Mac Finder
  if (pathInfo.isSystemFile) {
    console.log(`[${requestId}] System file request: ${pathInfo.fileName || pathInfo.folderName}`);
    return createSystemFileResponse(path, requestId);
  }
  
  // CRITICAL FIX: Proper routing logic
  if (pathInfo.isRoot) {
    console.log(`[${requestId}] Handling root PROPFIND`);
    return handleRootPropfind(supabase, userInfo, requestId);
  } else if (pathInfo.fileName && !pathInfo.isFolder) {
    console.log(`[${requestId}] Handling file PROPFIND for: "${pathInfo.fileName}"`);
    return handleFilePropfind(supabase, userInfo, pathInfo, requestId);
  } else if (pathInfo.folderName && pathInfo.isFolder) {
    console.log(`[${requestId}] Handling folder PROPFIND for: "${pathInfo.folderName}"`);
    return handleFolderPropfind(supabase, userInfo, pathInfo, requestId);
  } else {
    console.log(`[${requestId}] Ambiguous path, defaulting to root`);
    return handleRootPropfind(supabase, userInfo, requestId);
  }
}

function createSystemFileResponse(path: string, requestId: string): Response {
  console.log(`[${requestId}] Creating 404 response for system file: ${path}`);
  
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
  console.log(`[${requestId}] Root PROPFIND - fetching folders for user: ${userInfo.user_id}`);
  
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
  folders?.forEach((f: any, i: number) => {
    console.log(`[${requestId}] Folder ${i}: "${f.folder_name}" (${f.folder_id})`);
  });
  
  const currentTime = new Date();
  const rootEtag = generateETag('root', currentTime);
  const rootHref = createMacCompatibleHref();
  
  let xmlContent = `
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>${rootHref}</D:href>
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
        <D:lockdiscovery/>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`;
  
  // Add folder entries with enhanced Mac Finder compatibility
  for (const folder of (folders || [])) {
    const folderHref = createMacCompatibleHref(folder.folder_name);
    const folderEtag = generateETag(folder.folder_id, currentTime);
    
    xmlContent += `
  <D:response>
    <D:href>${folderHref}</D:href>
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
        <D:lockdiscovery/>
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
  
  // Verify folder access with enhanced matching
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
  
  console.log(`[${requestId}] Looking for folder "${pathInfo.folderName}" in ${folders?.length || 0} folders`);
  folders?.forEach((f: any, i: number) => {
    console.log(`[${requestId}] Available folder ${i}: "${f.folder_name}" (ID: ${f.folder_id})`);
  });
  
  // Enhanced folder matching
  const targetFolder = folders?.find((f: any) => matchesFolderName(pathInfo.folderName, f.folder_name));
  
  if (!targetFolder) {
    console.log(`[${requestId}] Folder not found: "${pathInfo.folderName}"`);
    console.log(`[${requestId}] Available folders: ${folders?.map((f: any) => `"${f.folder_name}"`).join(', ')}`);
    return new Response('Not Found', {
      status: 404,
      headers: getWebDAVResponseHeaders()
    });
  }
  
  console.log(`[${requestId}] Found target folder: "${targetFolder.folder_name}" (${targetFolder.folder_id})`);
  
  // Get documents in folder
  const { data: documents, error: docsError } = await supabase.rpc('get_user_accessible_documents', {
    folder_id_param: targetFolder.folder_id
  });
  
  if (docsError) {
    console.error(`[${requestId}] Error fetching documents:`, docsError);
  }
  
  // Filter visible documents (exclude system files and deleted)
  const visibleDocs = (documents || []).filter((doc: any) => 
    !doc.document_name.startsWith('._') && 
    !doc.document_name.startsWith('.') && 
    doc.document_name !== '.DS_Store' &&
    (!doc.is_deleted || doc.is_deleted === false)
  );
  
  console.log(`[${requestId}] Found ${visibleDocs.length} visible documents in folder`);
  
  const currentTime = new Date();
  const folderEtag = generateETag(targetFolder.folder_id, currentTime);
  const folderHref = createMacCompatibleHref(pathInfo.folderName);
  
  let xmlContent = `
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>${folderHref}</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>${escapeXml(targetFolder.folder_name)}</D:displayname>
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
        <D:lockdiscovery/>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>`;
  
  // Add document entries with enhanced Mac Finder properties
  for (const doc of visibleDocs) {
    const fileHref = createMacCompatibleHref(targetFolder.folder_name, doc.document_name);
    const fileSize = doc.file_size || 0;
    const lastModified = doc.updated_at ? new Date(doc.updated_at) : currentTime;
    const created = doc.created_at ? new Date(doc.created_at) : currentTime;
    const contentType = doc.mime_type || 'application/octet-stream';
    const docEtag = generateETag(doc.document_id, lastModified);
    
    xmlContent += `
  <D:response>
    <D:href>${fileHref}</D:href>
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
        <D:lockdiscovery/>
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
  
  // Find folder first with enhanced matching
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
  
  const targetFolder = folders?.find((f: any) => matchesFolderName(pathInfo.folderName, f.folder_name));
  
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
  
  const fileHref = createMacCompatibleHref(pathInfo.folderName, pathInfo.fileName);
  const fileSize = document.file_size || 0;
  const lastModified = document.updated_at ? new Date(document.updated_at) : new Date();
  const created = document.created_at ? new Date(document.created_at) : new Date();
  const contentType = document.mime_type || 'application/octet-stream';
  const docEtag = generateETag(document.document_id, lastModified);
  
  const xmlContent = `
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>${fileHref}</D:href>
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
        <D:lockdiscovery/>
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
