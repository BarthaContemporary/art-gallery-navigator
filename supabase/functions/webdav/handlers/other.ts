
import { getWebDAVResponseHeaders } from "../headers.ts";
import { UserInfo } from "../auth.ts";
import { parseWebDAVPath, generateETag, formatDateForWebDAV, createWebDAVXmlResponse, escapeXml, matchesFolderName } from "../utils.ts";

// Enhanced in-memory lock storage with better Mac Finder compatibility
const activeLocks = new Map<string, {
  token: string;
  owner: string;
  timeout: number;
  created: number;
  path: string;
  depth: string;
}>();

export async function handleMkcol(supabase: any, userInfo: UserInfo, path: string, requestId: string): Promise<Response> {
  console.log(`[${requestId}] MKCOL (create folder) for path: "${path}"`);
  
  const pathInfo = parseWebDAVPath(path);
  
  if (!pathInfo.folderName || pathInfo.fileName) {
    console.log(`[${requestId}] Invalid MKCOL path - must be folder only`);
    return new Response('Bad Request', {
      status: 400,
      headers: getWebDAVResponseHeaders()
    });
  }
  
  try {
    // Check if folder already exists with enhanced matching
    const { data: folders, error: folderError } = await supabase.rpc('get_user_accessible_folders_for_user', {
      user_id_param: userInfo.user_id
    });
    
    if (folderError) {
      console.error(`[${requestId}] Error checking folders:`, folderError);
      return new Response('Internal server error', {
        status: 500,
        headers: getWebDAVResponseHeaders()
      });
    }
    
    const existingFolder = folders?.find((f: any) => matchesFolderName(pathInfo.folderName, f.folder_name));
    if (existingFolder) {
      console.log(`[${requestId}] Folder already exists: "${pathInfo.folderName}"`);
      return new Response('Method Not Allowed', {
        status: 405,
        headers: getWebDAVResponseHeaders()
      });
    }
    
    // Create new folder
    const { data: newFolder, error: createError } = await supabase
      .from('folders')
      .insert({
        name: pathInfo.folderName,
        created_by: userInfo.user_id,
        assignment_method: 'webdav_mkcol'
      })
      .select()
      .single();
    
    if (createError) {
      console.error(`[${requestId}] Error creating folder:`, createError);
      return new Response('Conflict', {
        status: 409,
        headers: getWebDAVResponseHeaders()
      });
    }
    
    console.log(`[${requestId}] Folder created successfully: "${pathInfo.folderName}"`);
    
    return new Response('', {
      status: 201,
      headers: getWebDAVResponseHeaders({
        'Location': `/functions/v1/webdav/${encodeURIComponent(pathInfo.folderName)}/`,
        'Content-Length': '0'
      })
    });
    
  } catch (error) {
    console.error(`[${requestId}] MKCOL error:`, error);
    return new Response('Internal server error', {
      status: 500,
      headers: getWebDAVResponseHeaders()
    });
  }
}

export async function handleDelete(supabase: any, userInfo: UserInfo, path: string, requestId: string): Promise<Response> {
  console.log(`[${requestId}] DELETE for path: "${path}"`);
  
  const pathInfo = parseWebDAVPath(path);
  
  // Handle system files
  if (pathInfo.isSystemFile) {
    return new Response('', {
      status: 204,
      headers: getWebDAVResponseHeaders()
    });
  }
  
  if (pathInfo.fileName) {
    // Delete file
    return handleFileDelete(supabase, userInfo, pathInfo, requestId);
  } else if (pathInfo.folderName) {
    // Delete folder (not implemented for safety)
    console.log(`[${requestId}] Folder deletion not supported for safety`);
    return new Response('Method Not Allowed', {
      status: 405,
      headers: getWebDAVResponseHeaders()
    });
  }
  
  return new Response('Bad Request', {
    status: 400,
    headers: getWebDAVResponseHeaders()
  });
}

async function handleFileDelete(supabase: any, userInfo: UserInfo, pathInfo: any, requestId: string): Promise<Response> {
  try {
    // Find folder with enhanced matching
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
      return new Response('Not Found', {
        status: 404,
        headers: getWebDAVResponseHeaders()
      });
    }
    
    // Soft delete the document
    const { error: deleteError } = await supabase
      .from('documents')
      .update({ 
        is_deleted: true,
        deleted_at: new Date().toISOString()
      })
      .eq('id', document.document_id);
    
    if (deleteError) {
      console.error(`[${requestId}] Error deleting document:`, deleteError);
      return new Response('Internal server error', {
        status: 500,
        headers: getWebDAVResponseHeaders()
      });
    }
    
    console.log(`[${requestId}] File deleted successfully: "${pathInfo.fileName}"`);
    
    return new Response('', {
      status: 204,
      headers: getWebDAVResponseHeaders()
    });
    
  } catch (error) {
    console.error(`[${requestId}] Delete error:`, error);
    return new Response('Internal server error', {
      status: 500,
      headers: getWebDAVResponseHeaders()
    });
  }
}

export async function handleLock(supabase: any, userInfo: UserInfo, path: string, req: Request, requestId: string): Promise<Response> {
  console.log(`[${requestId}] LOCK request for path: "${path}"`);
  
  const pathInfo = parseWebDAVPath(path);
  const depth = req.headers.get('Depth') || '0';
  const timeout = req.headers.get('Timeout') || 'Second-3600';
  
  // Parse timeout
  let timeoutSeconds = 3600; // Default 1 hour
  const timeoutMatch = timeout.match(/Second-(\d+)/);
  if (timeoutMatch) {
    timeoutSeconds = parseInt(timeoutMatch[1]);
  }
  
  const lockToken = `opaquelocktoken:${crypto.randomUUID()}`;
  const owner = userInfo.user_id;
  
  // Store the lock
  activeLocks.set(path, {
    token: lockToken,
    owner,
    timeout: timeoutSeconds,
    created: Date.now(),
    path,
    depth
  });
  
  console.log(`[${requestId}] Lock created: ${lockToken} for ${timeoutSeconds}s`);
  
  const lockResponse = createWebDAVXmlResponse(`
<D:prop xmlns:D="DAV:">
  <D:lockdiscovery>
    <D:activelock>
      <D:locktype><D:write/></D:locktype>
      <D:lockscope><D:exclusive/></D:lockscope>
      <D:depth>${depth}</D:depth>
      <D:owner>${escapeXml(owner)}</D:owner>
      <D:timeout>Second-${timeoutSeconds}</D:timeout>
      <D:locktoken><D:href>${lockToken}</D:href></D:locktoken>
      <D:lockroot><D:href>${escapeXml(path)}</D:href></D:lockroot>
    </D:activelock>
  </D:lockdiscovery>
</D:prop>`);

  return new Response(lockResponse, {
    status: 200,
    headers: getWebDAVResponseHeaders({
      'Content-Type': 'text/xml; charset=utf-8',
      'Lock-Token': `<${lockToken}>`,
      'Timeout': `Second-${timeoutSeconds}`,
      'Content-Length': lockResponse.length.toString()
    })
  });
}

export async function handleUnlock(supabase: any, userInfo: UserInfo, path: string, req: Request, requestId: string): Promise<Response> {
  console.log(`[${requestId}] UNLOCK request for path: "${path}"`);
  
  const lockTokenHeader = req.headers.get('Lock-Token');
  if (lockTokenHeader) {
    const token = lockTokenHeader.replace(/[<>]/g, '');
    const lock = activeLocks.get(path);
    
    if (lock && lock.token === token && lock.owner === userInfo.user_id) {
      activeLocks.delete(path);
      console.log(`[${requestId}] Lock removed: ${token}`);
    } else {
      console.log(`[${requestId}] Lock not found or unauthorized: ${token}`);
    }
  }
  
  return new Response('', {
    status: 204,
    headers: getWebDAVResponseHeaders({
      'Content-Length': '0'
    })
  });
}

export async function handleMove(supabase: any, userInfo: UserInfo, path: string, req: Request, requestId: string): Promise<Response> {
  console.log(`[${requestId}] MOVE request from: "${path}"`);
  
  const destination = req.headers.get('Destination');
  if (!destination) {
    return new Response('Bad Request: Missing Destination header', {
      status: 400,
      headers: getWebDAVResponseHeaders()
    });
  }
  
  const overwrite = req.headers.get('Overwrite') === 'T';
  console.log(`[${requestId}] MOVE to: "${destination}", overwrite: ${overwrite}`);
  
  // Parse source and destination paths
  const sourcePath = parseWebDAVPath(path);
  const destUrl = new URL(destination);
  const destPath = parseWebDAVPath(destUrl.pathname);
  
  if (!sourcePath.fileName || !destPath.fileName) {
    return new Response('Bad Request: Move operation only supports files', {
      status: 400,
      headers: getWebDAVResponseHeaders()
    });
  }
  
  try {
    // Find source folder and document with enhanced matching
    const { data: folders } = await supabase.rpc('get_user_accessible_folders_for_user', {
      user_id_param: userInfo.user_id
    });
    
    const sourceFolder = folders?.find((f: any) => matchesFolderName(sourcePath.folderName, f.folder_name));
    const destFolder = folders?.find((f: any) => matchesFolderName(destPath.folderName, f.folder_name));
    
    if (!sourceFolder || !destFolder) {
      return new Response('Not Found', {
        status: 404,
        headers: getWebDAVResponseHeaders()
      });
    }
    
    // Find source document
    const { data: sourceDocs } = await supabase.rpc('get_user_accessible_documents', {
      folder_id_param: sourceFolder.folder_id
    });
    
    const sourceDoc = sourceDocs?.find((doc: any) => doc.document_name === sourcePath.fileName);
    if (!sourceDoc) {
      return new Response('Not Found', {
        status: 404,
        headers: getWebDAVResponseHeaders()
      });
    }
    
    // Check destination
    const { data: destDocs } = await supabase.rpc('get_user_accessible_documents', {
      folder_id_param: destFolder.folder_id
    });
    
    const destDoc = destDocs?.find((doc: any) => doc.document_name === destPath.fileName);
    if (destDoc && !overwrite) {
      return new Response('Precondition Failed', {
        status: 412,
        headers: getWebDAVResponseHeaders()
      });
    }
    
    // Perform move (update folder and/or filename)
    const updateData: any = {};
    if (sourceFolder.folder_id !== destFolder.folder_id) {
      updateData.folder_id = destFolder.folder_id;
    }
    if (sourcePath.fileName !== destPath.fileName) {
      updateData.file_name = destPath.fileName;
    }
    updateData.updated_at = new Date().toISOString();
    
    const { error: moveError } = await supabase
      .from('documents')
      .update(updateData)
      .eq('id', sourceDoc.document_id);
    
    if (moveError) {
      console.error(`[${requestId}] Move error:`, moveError);
      return new Response('Internal server error', {
        status: 500,
        headers: getWebDAVResponseHeaders()
      });
    }
    
    console.log(`[${requestId}] Move completed successfully`);
    
    return new Response('', {
      status: destDoc ? 204 : 201,
      headers: getWebDAVResponseHeaders({
        'Location': destUrl.pathname
      })
    });
    
  } catch (error) {
    console.error(`[${requestId}] Move operation failed:`, error);
    return new Response('Internal server error', {
      status: 500,
      headers: getWebDAVResponseHeaders()
    });
  }
}

export async function handleCopy(supabase: any, userInfo: UserInfo, path: string, req: Request, requestId: string): Promise<Response> {
  console.log(`[${requestId}] COPY request from: "${path}"`);
  
  const destination = req.headers.get('Destination');
  if (!destination) {
    return new Response('Bad Request: Missing Destination header', {
      status: 400,
      headers: getWebDAVResponseHeaders()
    });
  }
  
  // For now, return not implemented - copy operations are complex
  console.log(`[${requestId}] COPY to: "${destination}" - not implemented`);
  
  return new Response('Not Implemented', {
    status: 501,
    headers: getWebDAVResponseHeaders()
  });
}

export async function handleProppatch(path: string, requestId: string): Promise<Response> {
  console.log(`[${requestId}] PROPPATCH request for: "${path}"`);
  
  // Return success for property updates (Mac Finder compatibility)
  const proppatchResponse = createWebDAVXmlResponse(`
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>${escapeXml(path)}</D:href>
    <D:propstat>
      <D:prop/>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`);

  return new Response(proppatchResponse, {
    status: 207,
    headers: getWebDAVResponseHeaders({
      'Content-Type': 'text/xml; charset=utf-8',
      'Content-Length': proppatchResponse.length.toString()
    })
  });
}

// Cleanup expired locks periodically
setInterval(() => {
  const now = Date.now();
  for (const [path, lock] of activeLocks.entries()) {
    if (now - lock.created > lock.timeout * 1000) {
      activeLocks.delete(path);
      console.log(`Expired lock removed: ${lock.token}`);
    }
  }
}, 60000); // Check every minute
