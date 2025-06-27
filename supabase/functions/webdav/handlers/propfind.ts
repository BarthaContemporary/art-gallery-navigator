
import { UserInfo } from "../auth.ts";
import { getWebDAVResponseHeaders } from "../headers.ts";
import { escapeXml } from "../utils.ts";

export async function handlePropfind(supabase: any, userInfo: UserInfo, path: string, req: Request, requestId: string) {
  console.log(`[${requestId}] PROPFIND for path: "${path}"`);

  const depth = req.headers.get('Depth') || '1';
  console.log(`[${requestId}] PROPFIND depth: ${depth}`);
  
  try {
    if (path === '/' || path === '' || path === '/webdav/' || path === '/webdav') {
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

      const folderItems = (folders || []).map((folder: any) => `
    <D:response>
      <D:href>/functions/v1/webdav/${encodeURIComponent(folder.folder_name)}/</D:href>
      <D:propstat>
        <D:prop>
          <D:displayname>${escapeXml(folder.folder_name)}</D:displayname>
          <D:resourcetype><D:collection/></D:resourcetype>
          <D:getcontenttype>httpd/unix-directory</D:getcontenttype>
          <D:creationdate>${new Date().toISOString()}</D:creationdate>
          <D:getlastmodified>${new Date().toUTCString()}</D:getlastmodified>
          <D:getcontentlength>0</D:getcontentlength>
          <D:supportedlock>
            <D:lockentry>
              <D:lockscope><D:exclusive/></D:lockscope>
              <D:locktype><D:write/></D:locktype>
            </D:lockentry>
          </D:supportedlock>
        </D:prop>
        <D:status>HTTP/1.1 200 OK</D:status>
      </D:propstat>
    </D:response>`).join('');

      const xmlResponse = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/functions/v1/webdav/</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>WebDAV Root</D:displayname>
        <D:resourcetype><D:collection/></D:resourcetype>
        <D:getcontenttype>httpd/unix-directory</D:getcontenttype>
        <D:creationdate>${new Date().toISOString()}</D:creationdate>
        <D:getlastmodified>${new Date().toUTCString()}</D:getlastmodified>
        <D:getcontentlength>0</D:getcontentlength>
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
          'Content-Length': new TextEncoder().encode(xmlResponse).length.toString()
        })
      });
    } else {
      // Folder contents handling - improved path parsing
      const pathParts = path.split('/').filter(p => p);
      const folderName = decodeURIComponent(pathParts[0] || '');
      
      console.log(`[${requestId}] Fetching contents for folder: "${folderName}"`);
      console.log(`[${requestId}] Path parts:`, pathParts);
      
      const { data: folders } = await supabase.rpc('get_user_accessible_folders_for_user', {
        user_id_param: userInfo.user_id
      });
      
      const folder = folders?.find((f: any) => f.folder_name === folderName);
      
      if (!folder) {
        console.log(`[${requestId}] Folder not found or not accessible: "${folderName}"`);
        return new Response('Not Found', { 
          status: 404, 
          headers: getWebDAVResponseHeaders()
        });
      }

      console.log(`[${requestId}] Found folder:`, folder);
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

      const documentItems = (documents || []).map((doc: any) => `
    <D:response>
      <D:href>/functions/v1/webdav/${encodeURIComponent(folderName)}/${encodeURIComponent(doc.document_name)}</D:href>
      <D:propstat>
        <D:prop>
          <D:displayname>${escapeXml(doc.document_name)}</D:displayname>
          <D:getcontentlength>${doc.file_size || 0}</D:getcontentlength>
          <D:getcontenttype>${doc.mime_type || 'application/octet-stream'}</D:getcontenttype>
          <D:creationdate>${new Date().toISOString()}</D:creationdate>
          <D:getlastmodified>${new Date().toUTCString()}</D:getlastmodified>
          <D:resourcetype/>
          <D:getetag>"${crypto.randomUUID()}"</D:getetag>
          <D:supportedlock>
            <D:lockentry>
              <D:lockscope><D:exclusive/></D:lockscope>
              <D:locktype><D:write/></D:locktype>
            </D:lockentry>
          </D:supportedlock>
        </D:prop>
        <D:status>HTTP/1.1 200 OK</D:status>
      </D:propstat>
    </D:response>`).join('');

      const xmlResponse = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/functions/v1/webdav/${encodeURIComponent(folderName)}/</D:href>
    <D:propstat>
      <D:prop>
        <D:displayname>${escapeXml(folder.folder_name)}</D:displayname>
        <D:resourcetype><D:collection/></D:resourcetype>
        <D:getcontenttype>httpd/unix-directory</D:getcontenttype>
        <D:creationdate>${new Date().toISOString()}</D:creationdate>
        <D:getlastmodified>${new Date().toUTCString()}</D:getlastmodified>
        <D:getcontentlength>0</D:getcontentlength>
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

      return new Response(xmlResponse, {
        status: 207,
        headers: getWebDAVResponseHeaders({
          'Content-Type': 'application/xml; charset=utf-8',
          'Content-Length': new TextEncoder().encode(xmlResponse).length.toString()
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
