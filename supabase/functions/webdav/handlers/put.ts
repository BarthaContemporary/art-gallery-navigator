
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
      headers: getWebDAVResponseHeaders({
        'ETag': `"${crypto.randomUUID()}"`,
        'Last-Modified': new Date().toUTCString()
      })
    });
  }
  
  console.log(`[${requestId}] Uploading file "${fileName}" to folder "${folderName}"`);
  
  try {
    // Get file content
    const fileContent = await req.arrayBuffer();
    const fileSize = fileContent.byteLength;
    
    console.log(`[${requestId}] File content size: ${fileSize} bytes`);
    
    // Find target folder using the corrected function
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
      console.log(`[${requestId}] Available folders:`, folders?.map((f: any) => ({ name: f.folder_name, can_write: f.can_write })));
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
    
    // Check if document already exists and update it
    const { data: existingDocs, error: docsError } = await supabase.rpc('get_user_accessible_documents', { 
      folder_id_param: targetFolder.folder_id 
    });
    
    if (docsError) {
      console.error(`[${requestId}] Error fetching existing documents:`, docsError);
    }
    
    const existingDoc = existingDocs?.find((doc: any) => doc.document_name === fileName);
    console.log(`[${requestId}] Existing document check:`, existingDoc ? 'Found' : 'Not found');
    
    // Upload to Supabase Storage with unique path including timestamp
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
    
    console.log(`[${requestId}] Generated public URL:`, urlData.publicUrl);
    
    const currentTime = new Date().toISOString();
    let documentId: string;
    const isUpdate = !!existingDoc;
    
    if (existingDoc) {
      // Update existing document
      console.log(`[${requestId}] Updating existing document: ${existingDoc.document_id}`);
      
      const { error: updateError } = await supabase
        .from('documents')
        .update({
          file_url: urlData.publicUrl,
          file_size: fileSize,
          mime_type: req.headers.get('Content-Type') || 'application/octet-stream',
          updated_at: currentTime,
          is_deleted: false // Ensure it's not marked as deleted
        })
        .eq('id', existingDoc.document_id);
      
      if (updateError) {
        console.error(`[${requestId}] Error updating document record:`, updateError);
        // Clean up uploaded file
        await supabase.storage.from('shared-files').remove([filePath]);
        return new Response(`Failed to update document record: ${updateError.message}`, {
          status: 500,
          headers: getWebDAVResponseHeaders()
        });
      }
      
      documentId = existingDoc.document_id;
      console.log(`[${requestId}] Successfully updated document: ${fileName}`);
    } else {
      // Create new document record with proper folder linking
      console.log(`[${requestId}] Creating new document record with folder_id: ${targetFolder.folder_id}`);
      
      const documentData = {
        file_name: fileName,
        file_url: urlData.publicUrl,
        file_size: fileSize,
        mime_type: req.headers.get('Content-Type') || 'application/octet-stream',
        folder_id: targetFolder.folder_id, // Critical: Link to folder
        artist_id: targetFolder.artist_id, // Link to artist if folder has one
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
        console.error(`[${requestId}] Error details:`, {
          message: docError.message,
          details: docError.details,
          hint: docError.hint,
          code: docError.code
        });
        // Clean up uploaded file
        await supabase.storage.from('shared-files').remove([filePath]);
        return new Response(`Failed to create document record: ${docError.message}`, {
          status: 500,
          headers: getWebDAVResponseHeaders()
        });
      }
      
      if (!newDoc) {
        console.error(`[${requestId}] No document returned after insert`);
        await supabase.storage.from('shared-files').remove([filePath]);
        return new Response('Failed to create document record - no data returned', {
          status: 500,
          headers: getWebDAVResponseHeaders()
        });
      }
      
      documentId = newDoc.id;
      console.log(`[${requestId}] Successfully created new document: ${fileName} with ID: ${documentId}`);
    }
    
    // Verify the document was created/updated correctly
    const { data: verifyDoc, error: verifyError } = await supabase
      .from('documents')
      .select('id, file_name, folder_id, artist_id, is_deleted')
      .eq('id', documentId)
      .single();
    
    if (verifyError || !verifyDoc) {
      console.error(`[${requestId}] Failed to verify document creation:`, verifyError);
    } else {
      console.log(`[${requestId}] Document verification:`, verifyDoc);
    }
    
    // Generate ultra-strong ETag and timestamp for cache invalidation
    const uniqueTimestamp = Date.now() + Math.random();
    const strongEtag = `"${documentId}-${uniqueTimestamp}-${fileSize}"`;
    
    console.log(`[${requestId}] Upload completed successfully. Document ID: ${documentId}, File: ${fileName}`);
    
    return new Response('', {
      status: isUpdate ? 200 : 201,
      headers: getWebDAVResponseHeaders({
        'ETag': strongEtag,
        'Last-Modified': new Date().toUTCString(),
        'Location': `/functions/v1/webdav/${encodeURIComponent(folderName)}/${encodeURIComponent(fileName)}`,
        'Content-Length': '0',
        // Ultra-aggressive cache invalidation
        'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        // Mac Finder specific headers to force refresh
        'X-Content-Type-Options': 'nosniff',
        'Vary': '*',
        'X-WebDAV-No-Cache': 'true',
        'X-Mac-Finder-Refresh': uniqueTimestamp.toString(),
        'X-Upload-Complete': 'true',
        'X-Document-Id': documentId,
        'X-File-Version': uniqueTimestamp.toString(),
        // Additional refresh signals
        'X-Folder-Changed': folderName,
        'X-Upload-Timestamp': timestamp.toString(),
        'X-Folder-Id': targetFolder.folder_id
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
