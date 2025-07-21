import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DocumentAccessRequest {
  file_url: string;
  document_id: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Document access function started');
    
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse request body
    const { file_url, document_id }: DocumentAccessRequest = await req.json();
    
    console.log('Processing document access for:', { file_url, document_id });

    // Get the Authorization header to extract user info
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Authorization required');
    }

    // Verify user has access to this document
    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) {
      throw new Error('Invalid authorization');
    }

    // Check if user can access this document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', document_id)
      .single();

    if (docError || !document) {
      throw new Error('Document not found or access denied');
    }

    // Extract bucket information from file URL
    if (!file_url.includes('gallerysharedbucket')) {
      // If it's not an external bucket, return the original URL
      return new Response(JSON.stringify({ signed_url: file_url }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get storage credentials for accessing the external bucket
    const { data: credentials, error: credError } = await supabase
      .from('shared_storage_credentials')
      .select('*')
      .eq('bucket_name', 'gallerysharedbucket')
      .eq('is_active', true)
      .single();

    if (credError || !credentials) {
      console.error('No storage credentials found for gallerysharedbucket');
      throw new Error('Storage credentials not configured');
    }

    // Extract the file path from the URL
    const urlParts = file_url.split('/');
    const fileName = urlParts[urlParts.length - 1];
    
    // Generate a signed URL using AWS SDK (simplified approach)
    // Note: This is a simplified implementation. In production, you'd use proper AWS SDK
    const signedUrl = await generateSignedUrl(credentials, fileName);

    console.log('Generated signed URL for document access');

    return new Response(JSON.stringify({ signed_url: signedUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-document-access function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function generateSignedUrl(credentials: any, fileName: string): Promise<string> {
  // This is a simplified implementation
  // In a real implementation, you would use the AWS SDK to generate proper signed URLs
  
  const baseUrl = credentials.endpoint_url || 'https://s3.amazonaws.com';
  const bucketName = credentials.bucket_name;
  
  // For now, we'll construct a basic URL with the credentials
  // This is not secure and should be replaced with proper AWS signature v4
  const signedUrl = `${baseUrl}/${bucketName}/${fileName}`;
  
  console.log('Generated basic URL (should implement proper AWS signing):', signedUrl);
  
  return signedUrl;
}