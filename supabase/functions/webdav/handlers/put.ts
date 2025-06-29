
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
  
  // Skip Mac system files but return success to avoid errors
  if (fileName.startsWith('._') || fileName === '.DS_Store' || fileName.startsWith('.')) {
    console.log(`[${requestId}] Skipping system file: ${fileName}`);
    return new Response('', {
      status: 201,
      headers: getWebDAVResponseHeaders({
        'ETag': `"system-${Date.now()}"`,
        'Last-Modified': new Date().toUTCString()
      })
    });
  }
  
  console.log(`[${requestId}] Uploading file "${fileName}" to folder "${folderName}"`);
  
  try {
    // Get file content - handle both regular uploads and Mac Finder's zero-byte placeholder files
    const fileContent = await req.arrayBuffer();
    const fileSize = fileContent.byteLength;
    
    console.log(`[${requestId}] File content size: ${fileSize} bytes`);
    
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
      return new Response('Target folder not found or not writable', {
        status: 404,
        headers: getWebDAVResponseHeaders()
      });
    }
    
    console.log(`[${requestId}] Target folder found:`, {
      id: targetFolder.folder_id,
      name: targetFolder.folder_name,
      artist_id: targetFolder.artist_id
    });
    
    // Check if document already exists
    const { data: existingDocs, error: docsError } = await supabase.rpc('get_user_accessible_documents', { 
      folder_id_param: targetFolder.folder_id 
    });
    
    if (docsError) {
      console.error(`[${requestId}] Error fetching existing documents:`, docsError);
    }
    
    const existingDoc = existingDocs?.find((doc: any) => doc.document_name === fileName);
    console.log(`[${requestId}] Existing document check:`, existingDoc ? 'Found' : 'Not found');
    
    // For zero-byte files (Mac Finder placeholders), don't upload to storage but create database record
    let fileUrl = '';
    let actualFileSize = fileSize;
    
    if (fileSize > 0) {
      // Upload actual file content to Supabase Storage
      const timestamp = Date.now();
      const randomId = crypto.randomUUID();
      const filePath = `webdav/${userInfo.user_id}/${timestamp}_${randomId}_${fileName}`;
      
      console.log(`[${requestId}] Uploading to storage path: ${filePath}`);
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('shared-files')
        .upload(filePath, fileContent, {
          contentType: req.headers.get('Content-Type') || 'application/octet-stream',
          upsert: true
        });
      
      if (uploadError) {
        console.error(`[${requestId}] Storage upload error:`, uploadError);
        return new Response(`Failed to upload file: ${uploadError.message}`, {
          status: 500,
          headers: getWebDAVResponseHeaders()
        });
      }
      
      console.log(`[${requestId}] File uploaded to storage successfully:`, uploadData);
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('shared-files')
        .getPublicUrl(filePath);
      
      fileUrl = urlData.publicUrl;
      console.log(`[${requestId}] Generated public URL:`, fileUrl);
    } else {
      // For zero-byte files, create a placeholder URL
      fileUrl = `placeholder://webdav/${userInfo.user_id}/${fileName}`;
      console.log(`[${requestId}] Created placeholder URL for zero-byte file: ${fileUrl}`);
    }
    
    const currentTime = new Date().toISOString();
    let documentId: string;
    const isUpdate = !!existingDoc;
    
    if (existingDoc) {
      // Update existing document
      console.log(`[${requestId}] Updating existing document: ${existingDoc.document_id}`);
      
      const { error: updateError } = await supabase
        .from('documents')
        .update({
          file_url: fileUrl,
          file_size: actualFileSize,
          mime_type: req.headers.get('Content-Type') || 'application/octet-stream',
          updated_at: currentTime,
          is_deleted: false
        })
        .eq('id', existingDoc.document_id);
      
      if (updateError) {
        console.error(`[${requestId}] Error updating document record:`, updateError);
        return new Response(`Failed to update document record: ${updateError.message}`, {
          status: 500,
          headers: getWebDAVResponseHeaders()
        });
      }
      
      documentId = existingDoc.document_id;
      console.log(`[${requestId}] Successfully updated document: ${fileName}`);
    } else {
      // Create new document record - now this should work with the fixed constraint
      console.log(`[${requestId}] Creating new document record with folder_id: ${targetFolder.folder_id}`);
      
      const documentData = {
        file_name: fileName,
        file_url: fileUrl,
        file_size: actualFileSize,
        mime_type: req.headers.get('Content-Type') || 'application/octet-stream',
        folder_id: targetFolder.folder_id, // Only link to folder - this is now allowed
        type: 'webdav_upload',
        description: `Uploaded via WebDAV to ${folderName}`,
        created_at: currentTime,
        updated_at: currentTime,
        is_deleted: false,
        version_number: 1
      };
      
      console.log(`[${requestId}] Document data to insert:`, documentData);
      
      const { data: newDoc, error: docError } = await supabase
        .from('documents')
        .insert(documentData)
        .select('id')
        .single();
      
      if (docError) {
        console.error(`[${requestId}] Error creating document record:`, docError);
        return new Response(`Failed to create document record: ${docError.message}`, {
          status: 500,
          headers: getWebDAVResponseHeaders()
        });
      }
      
      if (!newDoc) {
        console.error(`[${requestId}] No document returned after insert`);
        return new Response('Failed to create document record - no data returned', {
          status: 500,
          headers: getWebDAVResponseHeaders()
        });
      }
      
      documentId = newDoc.id;
      console.log(`[${requestId}] Successfully created new document: ${fileName} with ID: ${documentId}`);
    }
    
    // Generate strong ETag and timestamp for Mac Finder compatibility
    const uniqueTimestamp = Date.now() + Math.random();
    const strongEtag = `"${documentId}-${uniqueTimestamp}-${actualFileSize}"`;
    
    console.log(`[${requestId}] Upload completed successfully. Document ID: ${documentId}, File: ${fileName}`);
    
    return new Response('', {
      status: isUpdate ? 200 : 201,
      headers: getWebDAVResponseHeaders({
        'ETag': strongEtag,
        'Last-Modified': new Date().toUTCString(),
        'Location': `/functions/v1/webdav/${encodeURIComponent(folderName)}/${encodeURIComponent(fileName)}`,
        'Content-Length': '0',
        // Mac Finder specific headers
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Content-Type-Options': 'nosniff',
        'Vary': '*',
        'X-WebDAV-Status': 'upload-complete',
        'X-Document-Id': documentId,
        'X-File-Version': uniqueTimestamp.toString()
      })
    });
    
  } catch (error) {
    console.error(`[${requestId}] PUT error:`, error);
    return new Response(`Internal server error: ${error.message}`, {
      status: 500,
      headers: getWebDAVResponseHeaders()
    });
  }
}
