
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, depth, destination, overwrite, if, lock-token, timeout, translate, range, content-length, user-agent, accept, accept-encoding, accept-language, cache-control, connection, host, pragma',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PROPFIND, MKCOL, MOVE, COPY, LOCK, UNLOCK, PROPPATCH, HEAD',
  'Access-Control-Expose-Headers': 'dav, ms-author-via, etag, last-modified, content-length, content-type, location, lock-token, timeout',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'true'
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: { 
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      } 
    });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'overview';
    const userId = url.searchParams.get('user_id');
    const folderId = url.searchParams.get('folder_id');

    if (!userId && action !== 'storage') {
      return new Response(JSON.stringify({ error: 'user_id parameter required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    let debugData: any = {};

    switch (action) {
      case 'overview':
        // Get user folders
        const { data: folders, error: foldersError } = await supabase.rpc('get_user_accessible_folders_for_user', {
          user_id_param: userId
        });
        
        // Get user documents
        const { data: documents, error: docsError } = await supabase.rpc('get_user_accessible_documents');
        
        // Get folder-specific documents for each folder
        const folderDocuments: any = {};
        if (folders) {
          for (const folder of folders) {
            const { data: folderDocs } = await supabase.rpc('get_user_accessible_documents', {
              folder_id_param: folder.folder_id
            });
            folderDocuments[folder.folder_id] = folderDocs || [];
          }
        }

        debugData = {
          user_id: userId,
          folders: {
            data: folders,
            error: foldersError,
            count: folders?.length || 0
          },
          documents: {
            data: documents,
            error: docsError,
            count: documents?.length || 0
          },
          folder_documents: folderDocuments,
          summary: {
            total_folders: folders?.length || 0,
            total_documents: documents?.length || 0,
            documents_with_folders: documents?.filter((d: any) => d.folder_id).length || 0,
            documents_without_folders: documents?.filter((d: any) => !d.folder_id).length || 0
          }
        };
        break;

      case 'folder':
        if (!folderId) {
          return new Response(JSON.stringify({ error: 'folder_id parameter required for folder action' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }

        // Get folder details
        const { data: folderData, error: folderError } = await supabase
          .from('folders')
          .select('*')
          .eq('id', folderId)
          .single();

        // Get documents in folder
        const { data: folderDocuments2, error: folderDocsError } = await supabase.rpc('get_user_accessible_documents', {
          folder_id_param: folderId
        });

        // Get direct database query for comparison
        const { data: directDocs, error: directError } = await supabase
          .from('documents')
          .select('*')
          .eq('folder_id', folderId)
          .eq('is_deleted', false);

        debugData = {
          folder: {
            data: folderData,
            error: folderError
          },
          documents_via_function: {
            data: folderDocuments2,
            error: folderDocsError,
            count: folderDocuments2?.length || 0
          },
          documents_direct_query: {
            data: directDocs,
            error: directError,
            count: directDocs?.length || 0
          }
        };
        break;

      case 'storage':
        // Check storage bucket
        const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
        
        const sharedFilesBucket = buckets?.find(b => b.id === 'shared-files');
        
        let files: any = null;
        let filesError: any = null;
        
        if (sharedFilesBucket) {
          const { data: filesList, error: fError } = await supabase.storage
            .from('shared-files')
            .list('webdav', { limit: 100 });
          files = filesList;
          filesError = fError;
        }

        debugData = {
          buckets: {
            data: buckets,
            error: bucketsError,
            shared_files_exists: !!sharedFilesBucket
          },
          webdav_files: {
            data: files,
            error: filesError,
            count: files?.length || 0
          }
        };
        break;

      case 'test-rls':
        // Test RLS policies
        const { data: testDocs, error: testError } = await supabase
          .from('documents')
          .select('*')
          .limit(5);

        const { data: testFolders, error: testFoldersError } = await supabase
          .from('folders')
          .select('*')
          .limit(5);

        debugData = {
          documents_rls_test: {
            data: testDocs,
            error: testError,
            note: 'This tests RLS policies on documents table'
          },
          folders_rls_test: {
            data: testFolders,
            error: testFoldersError,
            note: 'This tests RLS policies on folders table'
          }
        };
        break;

      default:
        debugData = { error: 'Unknown action. Available: overview, folder, storage, test-rls' };
    }

    return new Response(JSON.stringify(debugData, null, 2), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('WebDAV debug error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});
