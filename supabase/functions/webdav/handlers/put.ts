
import { UserInfo } from "../auth.ts";
import { getWebDAVResponseHeaders } from "../headers.ts";
import { parseWebDAVPath, generateETag, formatDateForWebDAV } from "../utils.ts";

export async function handlePut(supabase: any, userInfo: UserInfo, path: string, req: Request, requestId: string) {
  console.log(`[${requestId}] PUT for path: "${path}"`);
  
  const pathInfo = parseWebDAVPath(path);
  console.log(`[${requestId}] Parsed path:`, pathInfo);
  
  if (!pathInfo.folderName || !pathInfo.fileName) {
    console.log(`[${requestId}] Invalid path - missing folder or file name`);
    return new Response('Invalid file path', {
      status: 400,
      headers: getWebDAVResponseHeaders()
    });
  }
  
  // Handle system files by returning success without processing
  if (pathInfo.isSystemFile) {
    console.log(`[${requestId}] Ignoring system file: ${pathInfo.fileName}`);
    return new Response('', {
      status: 201,
      headers: getWebDAVResponseHeaders({
        'ETag': generateETag('system', new Date()),
        'Last-Modified': formatDateForWebDAV(new Date())
      })
    });
  }
  
  const fileName = pathInfo.fileName;
  const folderName = pathInfo.folderName;
  
  console.log(`[${requestId}] Processing upload: "${fileName}" to folder "${folderName}"`);
  
  try {
    // Read file content
    const fileContent = await req.arrayBuffer();
    const fileSize = fileContent.byteLength;
    const contentType = req.headers.get('Content-Type') || 'application/octet-stream';
    
    console.log(`[${requestId}] File size: ${fileSize} bytes, type: ${contentType}`);
    
    // Find target folder
    const { data: folders, error: folderError } = await supabase.rpc('get_user_accessible_folders_for_user', {
      user_id_param: userInfo.user_id
    });
    
    if (folderError) {
      console.error(`[${requestId}] Error fetching folders:`, folderError);
      return new Response('Error accessing folders', {
        status: 500,
        headers: getWebDAVResponseHeaders()
      });
    }
    
    const targetFolder = folders?.find((f: any) => 
      f.folder_name === folderName && f.can_write
    );
    
    if (!targetFolder) {
      console.log(`[${requestId}] Target folder "${folderName}" not found or not writable`);
      return new Response('Target folder not accessible', {
        status: 404,
        headers: getWebDAVResponseHeaders()
      });
    }
    
    // Check for existing document
    const { data: existingDocs, error: docsError } = await supabase.rpc('get_user_accessible_documents', { 
      folder_id_param: targetFolder.folder_id 
    });
    
    if (docsError) {
      console.error(`[${requestId}] Error checking existing documents:`, docsError);
    }
    
    const existingDoc = existingDocs?.find((doc: any) => doc.document_name === fileName);
    const isUpdate = !!existingDoc;
    
    console.log(`[${requestId}] ${isUpdate ? 'Updating existing' : 'Creating new'} document`);
    
    let fileUrl = '';
    let actualFileSize = fileSize;
    
    if (fileSize > 0) {
      // Upload to Supabase Storage
      const timestamp = Date.now();
      const randomId = crypto.randomUUID().substring(0, 8);
      const filePath = `webdav/${userInfo.user_id}/${timestamp}_${randomId}_${fileName}`;
      
      console.log(`[${requestId}] Uploading to storage: ${filePath}`);
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('shared-files')
        .upload(filePath, fileContent, {
          contentType,
          upsert: true
        });
      
      if (uploadError) {
        console.error(`[${requestId}] Storage upload error:`, uploadError);
        return new Response(`Upload failed: ${uploadError.message}`, {
          status: 500,
          headers: getWebDAVResponseHeaders()
        });
      }
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('shared-files')
        .getPublicUrl(filePath);
      
      fileUrl = urlData.publicUrl;
      console.log(`[${requestId}] File stored at: ${fileUrl}`);
    } else {
      // Zero-byte file placeholder
      fileUrl = `placeholder://webdav/${userInfo.user_id}/${fileName}`;
      console.log(`[${requestId}] Created placeholder for zero-byte file`);
    }
    
    const currentTime = new Date().toISOString();
    let documentId: string;
    
    if (isUpdate) {
      // Update existing document
      const { error: updateError } = await supabase
        .from('documents')
        .update({
          file_url: fileUrl,
          file_size: actualFileSize,
          mime_type: contentType,
          updated_at: currentTime,
          is_deleted: false
        })
        .eq('id', existingDoc.document_id);
      
      if (updateError) {
        console.error(`[${requestId}] Error updating document:`, updateError);
        return new Response(`Update failed: ${updateError.message}`, {
          status: 500,
          headers: getWebDAVResponseHeaders()
        });
      }
      
      documentId = existingDoc.document_id;
    } else {
      // Create new document
      const documentData = {
        file_name: fileName,
        file_url: fileUrl,
        file_size: actualFileSize,
        mime_type: contentType,
        folder_id: targetFolder.folder_id,
        type: 'webdav_upload',
        description: `WebDAV upload to ${folderName}`,
        created_at: currentTime,
        updated_at: currentTime,
        is_deleted: false,
        version_number: 1
      };
      
      const { data: newDoc, error: docError } = await supabase
        .from('documents')
        .insert(documentData)
        .select('id')
        .single();
      
      if (docError) {
        console.error(`[${requestId}] Error creating document:`, docError);
        return new Response(`Document creation failed: ${docError.message}`, {
          status: 500,
          headers: getWebDAVResponseHeaders()
        });
      }
      
      documentId = newDoc.id;
    }
    
    // Generate strong ETag for Mac Finder
    const etag = generateETag(documentId, currentTime);
    const lastModified = formatDateForWebDAV(new Date(currentTime));
    
    console.log(`[${requestId}] Upload completed successfully - Document ID: ${documentId}`);
    
    return new Response('', {
      status: isUpdate ? 200 : 201,
      headers: getWebDAVResponseHeaders({
        'ETag': etag,
        'Last-Modified': lastModified,
        'Location': `/functions/v1/webdav/${encodeURIComponent(folderName)}/${encodeURIComponent(fileName)}`,
        'Content-Length': '0',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-WebDAV-Status': 'upload-complete',
        'X-Document-Id': documentId
      })
    });
    
  } catch (error) {
    console.error(`[${requestId}] PUT operation failed:`, error);
    return new Response(`Internal server error: ${error.message}`, {
      status: 500,
      headers: getWebDAVResponseHeaders()
    });
  }
}
