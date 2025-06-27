
import { UserInfo } from "../auth.ts";
import { getWebDAVResponseHeaders } from "../headers.ts";

export async function handleGet(supabase: any, userInfo: UserInfo, path: string, requestId: string, isHead: boolean = false) {
  console.log(`[${requestId}] ${isHead ? 'HEAD' : 'GET'} for path: "${path}"`);
  
  const pathParts = path.split('/').filter(p => p).map(p => decodeURIComponent(p));
  if (pathParts.length < 2) {
    return new Response('Invalid file path', {
      status: 400,
      headers: getWebDAVResponseHeaders()
    });
  }
  
  const fileName = pathParts[pathParts.length - 1];
  const folderName = pathParts[0];
  
  console.log(`[${requestId}] Looking for file "${fileName}" in folder "${folderName}"`);
  
  try {
    // Find target folder
    const { data: folders } = await supabase.rpc('get_user_accessible_folders_for_user', {
      user_id_param: userInfo.user_id
    });
    const targetFolder = folders?.find((f: any) => 
      f.folder_name === folderName && f.can_read
    );
    
    if (!targetFolder) {
      console.log(`[${requestId}] Folder "${folderName}" not found or not accessible`);
      return new Response('Folder not found or not accessible', {
        status: 404,
        headers: getWebDAVResponseHeaders()
      });
    }
    
    // Find document
    const { data: documents } = await supabase.rpc('get_user_accessible_documents', { 
      folder_id_param: targetFolder.folder_id 
    });
    const document = documents?.find((doc: any) => doc.document_name === fileName);
    
    if (!document) {
      console.log(`[${requestId}] File "${fileName}" not found in folder`);
      return new Response('File not found', {
        status: 404,
        headers: getWebDAVResponseHeaders()
      });
    }
    
    if (isHead) {
      // HEAD request - return headers only
      return new Response('', {
        status: 200,
        headers: getWebDAVResponseHeaders({
          'Content-Length': document.file_size?.toString() || '0',
          'Content-Type': document.mime_type || 'application/octet-stream',
          'ETag': `"${crypto.randomUUID()}"`,
          'Last-Modified': new Date().toUTCString()
        })
      });
    }
    
    // GET request - fetch and return file content
    const fileResponse = await fetch(document.file_url);
    if (!fileResponse.ok) {
      console.log(`[${requestId}] Failed to fetch file from URL: ${document.file_url}`);
      return new Response('File not accessible', {
        status: 404,
        headers: getWebDAVResponseHeaders()
      });
    }
    
    const fileContent = await fileResponse.arrayBuffer();
    
    return new Response(fileContent, {
      status: 200,
      headers: getWebDAVResponseHeaders({
        'Content-Length': fileContent.byteLength.toString(),
        'Content-Type': document.mime_type || 'application/octet-stream',
        'ETag': `"${crypto.randomUUID()}"`,
        'Last-Modified': new Date().toUTCString()
      })
    });
    
  } catch (error) {
    console.error(`[${requestId}] GET/HEAD error:`, error);
    return new Response('Internal server error', {
      status: 500,
      headers: getWebDAVResponseHeaders()
    });
  }
}
