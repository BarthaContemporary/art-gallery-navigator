
import { UserInfo } from "../auth.ts";
import { getWebDAVResponseHeaders } from "../headers.ts";

// Handle MKCOL (create folder)
export async function handleMkcol(supabase: any, userInfo: UserInfo, path: string, requestId: string) {
  console.log(`[${requestId}] MKCOL for path: "${path}"`);
  
  const pathParts = path.split('/').filter(p => p);
  if (pathParts.length === 0) {
    return new Response('Cannot create root folder', {
      status: 403,
      headers: getWebDAVResponseHeaders()
    });
  }
  
  const folderName = pathParts[pathParts.length - 1];
  const parentPath = pathParts.slice(0, -1);
  
  try {
    // Get accessible folders to check permissions
    const { data: folders } = await supabase.rpc('get_user_accessible_folders_for_user', {
      user_id_param: userInfo.user_id
    });
    
    let parentFolderId = null;
    let artistId = null;
    
    if (parentPath.length > 0) {
      // Find parent folder
      const parentFolder = folders?.find((f: any) => f.folder_name === parentPath[parentPath.length - 1]);
      if (!parentFolder) {
        return new Response('Parent folder not found', {
          status: 404,
          headers: getWebDAVResponseHeaders()
        });
      }
      parentFolderId = parentFolder.folder_id;
      artistId = parentFolder.artist_id;
    } else {
      // Creating in root - check if user has admin access or artist folder
      const userArtistFolder = folders?.find((f: any) => f.artist_id && f.can_write);
      if (userArtistFolder) {
        artistId = userArtistFolder.artist_id;
      }
    }
    
    // Create folder in database
    const { data: newFolder, error } = await supabase
      .from('folders')
      .insert({
        name: folderName,
        parent_folder_id: parentFolderId,
        artist_id: artistId,
        created_by: userInfo.user_id,
        assignment_method: 'webdav'
      })
      .select()
      .single();
    
    if (error) {
      console.error(`[${requestId}] Error creating folder:`, error);
      return new Response('Failed to create folder', {
        status: 500,
        headers: getWebDAVResponseHeaders()
      });
    }
    
    console.log(`[${requestId}] Created folder: ${newFolder.id}`);
    
    return new Response('', {
      status: 201,
      headers: getWebDAVResponseHeaders({
        'Location': `/functions/v1/webdav${path}${path.endsWith('/') ? '' : '/'}`
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

// Handle DELETE
export async function handleDelete(supabase: any, userInfo: UserInfo, path: string, requestId: string) {
  console.log(`[${requestId}] DELETE for path: "${path}"`);
  
  const pathParts = path.split('/').filter(p => p);
  if (pathParts.length === 0) {
    return new Response('Cannot delete root', {
      status: 403,
      headers: getWebDAVResponseHeaders()
    });
  }
  
  const itemName = pathParts[pathParts.length - 1];
  
  try {
    // Check if it's a folder
    const { data: folders } = await supabase.rpc('get_user_accessible_folders_for_user', {
      user_id_param: userInfo.user_id
    });
    const folder = folders?.find((f: any) => f.folder_name === itemName && f.can_write);
    
    if (folder) {
      // Delete folder
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', folder.folder_id);
      
      if (error) {
        console.error(`[${requestId}] Error deleting folder:`, error);
        return new Response('Failed to delete folder', {
          status: 500,
          headers: getWebDAVResponseHeaders()
        });
      }
      
      console.log(`[${requestId}] Deleted folder: ${itemName}`);
      return new Response('', {
        status: 204,
        headers: getWebDAVResponseHeaders()
      });
    }
    
    // Check if it's a file
    const { data: documents } = await supabase.rpc('get_user_accessible_documents');
    const document = documents?.find((doc: any) => 
      doc.document_name === itemName && doc.can_write
    );
    
    if (document) {
      // Mark document as deleted
      const { error } = await supabase
        .from('documents')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString()
        })
        .eq('id', document.document_id);
      
      if (error) {
        console.error(`[${requestId}] Error deleting document:`, error);
        return new Response('Failed to delete file', {
          status: 500,
          headers: getWebDAVResponseHeaders()
        });
      }
      
      console.log(`[${requestId}] Deleted file: ${itemName}`);
      return new Response('', {
        status: 204,
        headers: getWebDAVResponseHeaders()
      });
    }
    
    return new Response('Not found', {
      status: 404,
      headers: getWebDAVResponseHeaders()
    });
    
  } catch (error) {
    console.error(`[${requestId}] DELETE error:`, error);
    return new Response('Internal server error', {
      status: 500,
      headers: getWebDAVResponseHeaders()
    });
  }
}

// Handle LOCK
export async function handleLock(path: string, requestId: string) {
  console.log(`[${requestId}] LOCK for path: "${path}"`);
  
  // Basic lock response - WebDAV clients expect this
  const lockToken = crypto.randomUUID();
  const lockXml = `<?xml version="1.0" encoding="utf-8"?>
<D:prop xmlns:D="DAV:">
  <D:lockdiscovery>
    <D:activelock>
      <D:locktype><D:write/></D:locktype>
      <D:lockscope><D:exclusive/></D:lockscope>
      <D:depth>0</D:depth>
      <D:owner>WebDAV User</D:owner>
      <D:timeout>Second-3600</D:timeout>
      <D:locktoken>
        <D:href>urn:uuid:${lockToken}</D:href>
      </D:locktoken>
    </D:activelock>
  </D:lockdiscovery>
</D:prop>`;
  
  return new Response(lockXml, {
    status: 200,
    headers: getWebDAVResponseHeaders({
      'Content-Type': 'application/xml; charset=utf-8',
      'Lock-Token': `<urn:uuid:${lockToken}>`,
      'Timeout': 'Second-3600'
    })
  });
}

// Handle PROPPATCH
export async function handleProppatch(path: string, requestId: string) {
  console.log(`[${requestId}] PROPPATCH for path: "${path}"`);
  
  // Basic PROPPATCH response
  const proppatchXml = `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>${path}</D:href>
    <D:propstat>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>`;
  
  return new Response(proppatchXml, {
    status: 207,
    headers: getWebDAVResponseHeaders({
      'Content-Type': 'application/xml; charset=utf-8'
    })
  });
}
