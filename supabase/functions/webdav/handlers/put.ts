
import { UserInfo } from "../auth.ts";
import { getWebDAVResponseHeaders } from "../headers.ts";
import { parseWebDAVPath } from "../utils.ts";

export async function handlePut(supabase: any, userInfo: UserInfo, path: string, req: Request, requestId: string) {
  console.log(`[${requestId}] PUT for path: "${path}"`);
  
  const pathInfo = parseWebDAVPath(path);
  console.log(`[${requestId}] Parsed path info:`, pathInfo);
  
  if (!pathInfo.folderName || !pathInfo.fileName) {
    console.log(`[${requestId}] Invalid file path - missing folder or file name`);
    return new Response('Invalid file path', {
      status: 400,
      headers: getWebDAVResponseHeaders()
    });
  }
  
  const fileName = pathInfo.fileName;
  const folderName = pathInfo.folderName;
  
  // Skip Mac system files
  if (fileName.startsWith('._') || fileName === '.DS_Store' || fileName.startsWith('.')) {
    console.log(`[${requestId}] Skipping system file: ${fileName}`);
    return new Response('', {
      status: 201,
      headers: getWebDAVResponseHeaders()
    });
  }
  
  console.log(`[${requestId}] Uploading file "${fileName}" to folder "${folderName}"`);
  
  try {
    // Get file content
    const fileContent = await req.arrayBuffer();
    const fileSize = fileContent.byteLength;
    
    console.log(`[${requestId}] File content size: ${fileSize} bytes`);
    
    // Find target folder
    const { data: folders } = await supabase.rpc('get_user_accessible_folders_for_user', {
      user_id_param: userInfo.user_id
    });
    const targetFolder = folders?.find((f: any) => 
      f.folder_name === folderName && f.can_write
    );
    
    if (!targetFolder) {
      console.log(`[${requestId}] Target folder "${folderName}" not found or not writable`);
      return new Response('Target folder not found or not writable', {
        status: 404,
        headers: getWebDAVResponseHeaders()
      });
    }
    
    console.log(`[${requestId}] Target folder found:`, targetFolder);
    
    // Check if document already exists and update it
    const { data: existingDocs } = await supabase.rpc('get_user_accessible_documents', { 
      folder_id_param: targetFolder.folder_id 
    });
    const existingDoc = existingDocs?.find((doc: any) => doc.document_name === fileName);
    
    // Upload to Supabase Storage
    const filePath = `webdav/${userInfo.user_id}/${crypto.randomUUID()}_${fileName}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('shared-files')
      .upload(filePath, fileContent, {
        contentType: req.headers.get('Content-Type') || 'application/octet-stream',
        upsert: true
      });
    
    if (uploadError) {
      console.error(`[${requestId}] Storage upload error:`, uploadError);
      return new Response('Failed to upload file', {
        status: 500,
        headers: getWebDAVResponseHeaders()
      });
    }
    
    console.log(`[${requestId}] File uploaded to storage:`, uploadData);
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('shared-files')
      .getPublicUrl(filePath);
    
    if (existingDoc) {
      // Update existing document
      const { error: updateError } = await supabase
        .from('documents')
        .update({
          file_url: urlData.publicUrl,
          file_size: fileSize,
          mime_type: req.headers.get('Content-Type') || 'application/octet-stream',
          updated_at: new Date().toISOString()
        })
        .eq('id', existingDoc.document_id);
      
      if (updateError) {
        console.error(`[${requestId}] Error updating document record:`, updateError);
        await supabase.storage.from('shared-files').remove([filePath]);
        return new Response('Failed to update document record', {
          status: 500,
          headers: getWebDAVResponseHeaders()
        });
      }
      
      console.log(`[${requestId}] Successfully updated file: ${fileName}`);
    } else {
      // Create new document record
      const { error: docError } = await supabase
        .from('documents')
        .insert({
          file_name: fileName,
          file_url: urlData.publicUrl,
          file_size: fileSize,
          mime_type: req.headers.get('Content-Type') || 'application/octet-stream',
          folder_id: targetFolder.folder_id,
          artist_id: targetFolder.artist_id,
          type: 'webdav_upload',
          description: `Uploaded via WebDAV`
        });
      
      if (docError) {
        console.error(`[${requestId}] Error creating document record:`, docError);
        await supabase.storage.from('shared-files').remove([filePath]);
        return new Response('Failed to create document record', {
          status: 500,
          headers: getWebDAVResponseHeaders()
        });
      }
      
      console.log(`[${requestId}] Successfully uploaded new file: ${fileName}`);
    }
    
    return new Response('', {
      status: existingDoc ? 200 : 201,
      headers: getWebDAVResponseHeaders({
        'ETag': `"${crypto.randomUUID()}"`,
        'Location': `/functions/v1/webdav${path}`
      })
    });
    
  } catch (error) {
    console.error(`[${requestId}] PUT error:`, error);
    return new Response('Internal server error', {
      status: 500,
      headers: getWebDAVResponseHeaders()
    });
  }
}
