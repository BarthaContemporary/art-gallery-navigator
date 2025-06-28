
import { UserInfo } from "../auth.ts";
import { getWebDAVResponseHeaders } from "../headers.ts";
import { parseWebDAVPath } from "../utils.ts";

export async function handleGet(supabase: any, userInfo: UserInfo, path: string, requestId: string, isHead: boolean = false) {
  console.log(`[${requestId}] ${isHead ? 'HEAD' : 'GET'} for path: "${path}"`);
  
  const pathInfo = parseWebDAVPath(path);
  console.log(`[${requestId}] Parsed path info:`, pathInfo);
  
  if (!pathInfo.folderName || !pathInfo.fileName) {
    return new Response('Invalid file path', {
      status: 400,
      headers: getWebDAVResponseHeaders()
    });
  }
  
  const fileName = pathInfo.fileName;
  const folderName = pathInfo.folderName;
  
  // Handle Mac system files
  if (fileName.startsWith('._') || fileName === '.DS_Store' || fileName.startsWith('.')) {
    console.log(`[${requestId}] Returning empty response for system file: ${fileName}`);
    return new Response('', {
      status: isHead ? 200 : 404,
      headers: getWebDAVResponseHeaders({
        'Content-Length': '0',
        'Content-Type': 'application/octet-stream'
      })
    });
  }
  
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
          'ETag': `"${document.document_id}"`,
          'Last-Modified': new Date().toUTCString(),
          'Accept-Ranges': 'bytes'
        })
      });
    }
    
    // GET request - fetch and return file content
    console.log(`[${requestId}] Fetching file from URL: ${document.file_url}`);
    
    try {
      const fileResponse = await fetch(document.file_url);
      if (!fileResponse.ok) {
        console.log(`[${requestId}] Failed to fetch file from URL: ${document.file_url}, status: ${fileResponse.status}`);
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
          'ETag': `"${document.document_id}"`,
          'Last-Modified': new Date().toUTCString(),
          'Accept-Ranges': 'bytes'
        })
      });
    } catch (fetchError) {
      console.error(`[${requestId}] Error fetching file content:`, fetchError);
      return new Response('Error reading file', {
        status: 500,
        headers: getWebDAVResponseHeaders()
      });
    }
    
  } catch (error) {
    console.error(`[${requestId}] GET/HEAD error:`, error);
    return new Response('Internal server error', {
      status: 500,
      headers: getWebDAVResponseHeaders()
    });
  }
}
