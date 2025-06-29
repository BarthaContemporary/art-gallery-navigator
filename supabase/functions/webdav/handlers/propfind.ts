
import { UserInfo } from "../auth.ts";
import { getWebDAVResponseHeaders } from "../headers.ts";
import { escapeXml, parseWebDAVPath } from "../utils.ts";

export async function handlePropfind(supabase: any, userInfo: UserInfo, path: string, req: Request, requestId: string) {
  console.log(`[${requestId}] PROPFIND for path: "${path}"`);

  const depth = req.headers.get('Depth') || '1';
  console.log(`[${requestId}] PROPFIND depth: ${depth}`);
  
  try {
    const pathInfo = parseWebDAVPath(path);
    console.log(`[${requestId}] Parsed path info:`, pathInfo);
    
    if (pathInfo.isRoot) {
      // Root directory - show accessible folders
      console.log(`[${requestId}] Fetching accessible folders for user: ${userInfo.user_id}`);
      
      const { data: folders, error } = await supabase.rpc('get_user_accessible_folders_for_user', {
        user_id_param: userInfo.user_id
      });

      console.log(`[${requestId}] RPC call result:`, { 
        folders: folders, 
        error: error,
        foldersLength: folders?.length || 0
      });

      if (error) {
        console.error(`[${requestId}] Error fetching folders:`, error);
        return new Response('Internal server error', { 
          status: 500, 
          headers: getWebDAVResponseHeaders()
        });
      }

      console.log(`[${requestId}] Found ${folders?.length || 0} accessible folders`);

      // Generate unique timestamp for this exact moment to bust caches
      const currentTime = new Date();
      const uniqueTimestamp = Date.now() + Math.random();
      const strongEtag = `"root-${userInfo.user_id}-${uniqueTimestamp}"`;
      
      const folderItems = (folders || []).map((folder: any) => {
        const folderEtag = `"folder-${folder.folder_id}-${uniqueTimestamp}"`;
        return `
    <D:response>
      <D:href>/functions/v1/webdav/${encodeURIComponent(folder.folder_name)}/</D:href>
      <D:propstat>
        <D:prop>
          <D:displayname>${escapeXml(folder.folder_name)}</D:displayname>
          <D:resourcetype><D:collection/></D:resourcetype>
          <D:getcontenttype>httpd/unix-directory</D:getcontenttype>
          <D:creationdate>${currentTime.toISOString()}</D:creationdate>
          <D:getlastmodified>${currentTime.toUTCString()}</D:getlastmodified>
          <D:getcontentlength>0</D:getcontentlength>
          <D:getetag>${folderEtag}</D:getetag>
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
      }).join('');

      const xmlResponse = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/functions/v1/webdav/</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>WebDAV Root</D:displayname>
        <D:resourcetype><D:collection/></D:resourcetype>
        <D:getcontenttype>httpd/unix-directory</D:getcontenttype>
        <D:creationdate>${currentTime.toISOString()}</D:creationdate>
        <D:getlastmodified>${currentTime.toUTCString()}</D:getlastmodified>
        <D:getcontentlength>0</D:getcontentlength>
        <D:getetag>${strongEtag}</D:getetag>
        <D:supportedlock>
          <D:lockentry>
            <D:lockscope><D:exclusive/></D:lockscope>
            <D:locktype><D:write/></D:locktype>
          </D:lockentry>
        </D:supportedlock>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>${folderItems}
</D:multistatus>`;

      return new Response(xmlResponse, {
        status: 207,
        headers: getWebDAVResponseHeaders({
          'Content-Type': 'application/xml; charset=utf-8',
          'Content-Length': new TextEncoder().encode(xmlResponse).length.toString(),
          'ETag': strongEtag,
          // Extremely aggressive cache busting for Mac Finder
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Last-Modified': currentTime.toUTCString(),
          // Force Mac Finder to not cache this response
          'X-Content-Type-Options': 'nosniff',
          'Vary': '*',
          // Additional Mac Finder specific headers
          'X-WebDAV-No-Cache': 'true',
          'X-Mac-Finder-Refresh': uniqueTimestamp.toString()
        })
      });
    } else if (pathInfo.folderName && !pathInfo.fileName) {
      // Folder contents handling
      const folderName = pathInfo.folderName;
      
      console.log(`[${requestId}] Fetching contents for folder: "${folderName}"`);
      
      const { data: folders, error: foldersError } = await supabase.rpc('get_user_accessible_folders_for_user', {
        user_id_param: userInfo.user_id
      });
      
      if (foldersError) {
        console.error(`[${requestId}] Error fetching folders:`, foldersError);
        return new Response('Error fetching folders', { 
          status: 500, 
          headers: getWebDAVResponseHeaders()
        });
      }
      
      const folder = folders?.find((f: any) => f.folder_name === folderName);
      
      if (!folder) {
        console.log(`[${requestId}] Folder not found or not accessible: "${folderName}"`);
        return new Response('Not Found', { 
          status: 404, 
          headers: getWebDAVResponseHeaders()
        });
      }

      console.log(`[${requestId}] Found folder:`, {
        id: folder.folder_id,
        name: folder.folder_name,
        artist_id: folder.artist_id
      });
      
      console.log(`[${requestId}] Fetching documents for folder ID: ${folder.folder_id}`);
      
      const { data: documents, error: docsError } = await supabase.rpc('get_user_accessible_documents', { 
        folder_id_param: folder.folder_id 
      });

      if (docsError) {
        console.error(`[${requestId}] Error fetching documents:`, docsError);
        return new Response('Error fetching folder contents', { 
          status: 500, 
          headers: getWebDAVResponseHeaders()
        });
      }

      console.log(`[${requestId}] Found ${documents?.length || 0} documents in folder`);
      console.log(`[${requestId}] Document details:`, documents?.map((d: any) => ({
        id: d.document_id,
        name: d.document_name,
        folder_id: d.folder_id,
        file_size: d.file_size
      })));

      // Filter out system files from the response but still show them as existing
      const visibleDocuments = (documents || []).filter((doc: any) => 
        !doc.document_name.startsWith('._') && 
        doc.document_name !== '.DS_Store' && 
        !doc.document_name.startsWith('.')
      );

      console.log(`[${requestId}] Visible documents after filtering: ${visibleDocuments.length}`);

      // Generate unique timestamp for cache busting
      const currentTime = new Date();
      const uniqueTimestamp = Date.now() + Math.random();
      const folderEtag = `"folder-${folder.folder_id}-${uniqueTimestamp}-${visibleDocuments.length}"`;
      
      const documentItems = visibleDocuments.map((doc: any) => {
        const docEtag = `"doc-${doc.document_id || crypto.randomUUID()}-${uniqueTimestamp}"`;
        return `
    <D:response>
      <D:href>/functions/v1/webdav/${encodeURIComponent(folderName)}/${encodeURIComponent(doc.document_name)}</D:href>
      <D:propstat>
        <D:prop>
          <D:displayname>${escapeXml(doc.document_name)}</D:displayname>
          <D:getcontentlength>${doc.file_size || 0}</D:getcontentlength>
          <D:getcontenttype>${doc.mime_type || 'application/octet-stream'}</D:getcontenttype>
          <D:creationdate>${currentTime.toISOString()}</D:creationdate>
          <D:getlastmodified>${currentTime.toUTCString()}</D:getlastmodified>
          <D:resourcetype/>
          <D:getetag>${docEtag}</D:getetag>
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
      }).join('');

      const xmlResponse = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/functions/v1/webdav/${encodeURIComponent(folderName)}/</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>${escapeXml(folder.folder_name)}</D:displayname>
        <D:resourcetype><D:collection/></D:resourcetype>
        <D:getcontenttype>httpd/unix-directory</D:getcontenttype>
        <D:creationdate>${currentTime.toISOString()}</D:creationdate>
        <D:getlastmodified>${currentTime.toUTCString()}</D:getlastmodified>
        <D:getcontentlength>0</D:getcontentlength>
        <D:getetag>${folderEtag}</D:getetag>
        <D:supportedlock>
          <D:lockentry>
            <D:lockscope><D:exclusive/></D:lockscope>
            <D:locktype><D:write/></D:locktype>
          </D:lockentry>
        </D:supportedlock>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>${documentItems}
</D:multistatus>`;

      console.log(`[${requestId}] Returning PROPFIND response with ${visibleDocuments.length} documents`);

      return new Response(xmlResponse, {
        status: 207,
        headers: getWebDAVResponseHeaders({
          'Content-Type': 'application/xml; charset=utf-8',
          'Content-Length': new TextEncoder().encode(xmlResponse).length.toString(),
          'ETag': folderEtag,
          // Extremely aggressive cache busting
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Last-Modified': currentTime.toUTCString(),
          // Force Mac Finder to refresh
          'X-Content-Type-Options': 'nosniff',
          'Vary': '*',
          'X-WebDAV-No-Cache': 'true',
          'X-Mac-Finder-Refresh': uniqueTimestamp.toString(),
          // Additional headers to force refresh
          'X-Folder-Version': uniqueTimestamp.toString(),
          'X-Document-Count': visibleDocuments.length.toString(),
          'X-Folder-Id': folder.folder_id
        })
      });
    } else {
      // Individual file properties
      const folderName = pathInfo.folderName!;
      const fileName = pathInfo.fileName!;
      
      // Handle Mac system files
      if (fileName.startsWith('._') || fileName === '.DS_Store' || fileName.startsWith('.')) {
        console.log(`[${requestId}] Returning minimal response for system file: ${fileName}`);
        const xmlResponse = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/functions/v1/webdav/${encodeURIComponent(folderName)}/${encodeURIComponent(fileName)}</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>${escapeXml(fileName)}</D:displayname>
        <D:getcontentlength>0</D:getcontentlength>
        <D:getcontenttype>application/octet-stream</D:getcontenttype>
        <D:creationdate>${new Date().toISOString()}</D:creationdate>
        <D:getlastmodified>${new Date().toUTCString()}</D:getlastmodified>
        <D:resourcetype/>
        <D:getetag>"${crypto.randomUUID()}"</D:getetag>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`;
        
        return new Response(xmlResponse, {
          status: 207,
          headers: getWebDAVResponseHeaders({
            'Content-Type': 'application/xml; charset=utf-8'
          })
        });
      }
      
      console.log(`[${requestId}] Getting properties for file "${fileName}" in folder "${folderName}"`);
      
      const { data: folders } = await supabase.rpc('get_user_accessible_folders_for_user', {
        user_id_param: userInfo.user_id
      });
      
      const folder = folders?.find((f: any) => f.folder_name === folderName);
      
      if (!folder) {
        console.log(`[${requestId}] Folder not found: "${folderName}"`);
        return new Response('Not Found', { 
          status: 404, 
          headers: getWebDAVResponseHeaders()
        });
      }
      
      const { data: documents } = await supabase.rpc('get_user_accessible_documents', { 
        folder_id_param: folder.folder_id 
      });
      const document = documents?.find((doc: any) => doc.document_name === fileName);
      
      if (!document) {
        console.log(`[${requestId}] File not found: "${fileName}"`);
        return new Response('Not Found', { 
          status: 404, 
          headers: getWebDAVResponseHeaders()
        });
      }
      
      const currentTime = new Date();
      const uniqueTimestamp = Date.now() + Math.random();
      const fileEtag = `"file-${document.document_id}-${uniqueTimestamp}"`;
      
      const xmlResponse = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/functions/v1/webdav/${encodeURIComponent(folderName)}/${encodeURIComponent(fileName)}</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>${escapeXml(document.document_name)}</D:displayname>
        <D:getcontentlength>${document.file_size || 0}</D:getcontentlength>
        <D:getcontenttype>${document.mime_type || 'application/octet-stream'}</D:getcontenttype>
        <D:creationdate>${currentTime.toISOString()}</D:creationdate>
        <D:getlastmodified>${currentTime.toUTCString()}</D:getlastmodified>
        <D:resourcetype/>
        <D:getetag>${fileEtag}</D:getetag>
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

      return new Response(xmlResponse, {
        status: 207,
        headers: getWebDAVResponseHeaders({
          'Content-Type': 'application/xml; charset=utf-8',
          'ETag': fileEtag,
          'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Last-Modified': currentTime.toUTCString(),
          'X-Content-Type-Options': 'nosniff',
          'X-File-Version': uniqueTimestamp.toString()
        })
      });
    }
  } catch (error) {
    console.error(`[${requestId}] PROPFIND error:`, error);
    return new Response('Internal server error', { 
      status: 500, 
      headers: getWebDAVResponseHeaders()
    });
  }
}
