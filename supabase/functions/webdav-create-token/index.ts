
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log(`[${new Date().toISOString()}] WebDAV Token Creation - ${req.method} ${req.url}`);
  
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Log request details
    console.log('Request headers:', {
      authorization: req.headers.get('Authorization') ? 'Bearer [PRESENT]' : 'MISSING',
      contentType: req.headers.get('Content-Type'),
      userAgent: req.headers.get('User-Agent'),
    });

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('ERROR: No authorization header provided');
      return new Response(JSON.stringify({ 
        error: 'Unauthorized - No authorization header' 
      }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Authorization header present, creating Supabase client...');

    // Get environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('ERROR: Missing environment variables:', {
        supabaseUrl: !!supabaseUrl,
        supabaseAnonKey: !!supabaseAnonKey
      });
      return new Response(JSON.stringify({ 
        error: 'Server configuration error - missing environment variables' 
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create user client to verify authentication
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    console.log('Verifying user authentication...');
    
    // Verify user authentication
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();

    if (authError) {
      console.error('AUTH ERROR:', authError);
      return new Response(JSON.stringify({ 
        error: `Authentication failed: ${authError.message}`,
        details: authError
      }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!user) {
      console.error('ERROR: No user found in auth context');
      return new Response(JSON.stringify({ 
        error: 'No authenticated user found' 
      }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('User authenticated successfully:', {
      userId: user.id,
      email: user.email,
      emailConfirmed: user.email_confirmed_at ? 'YES' : 'NO'
    });

    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('Request body parsed:', requestBody);
    } catch (parseError) {
      console.error('ERROR: Failed to parse request body:', parseError);
      return new Response(JSON.stringify({ 
        error: 'Invalid JSON in request body',
        details: parseError.message
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { name, expiresInDays } = requestBody;

    if (!name) {
      console.error('ERROR: Token name is required');
      return new Response(JSON.stringify({ 
        error: 'Token name is required' 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Generating secure token...');
    
    // Generate a secure random token
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const tokenString = Array.from(tokenBytes, b => b.toString(16).padStart(2, '0')).join('');

    console.log('Token generated, creating hash...');
    
    // Hash the token for storage
    const encoder = new TextEncoder();
    const data = encoder.encode(tokenString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    const tokenHash = Array.from(hashArray, b => b.toString(16).padStart(2, '0')).join('');

    // Calculate expiration date
    const expiresAt = expiresInDays > 0 
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    console.log('Creating database record with service role client...', {
      userId: user.id,
      tokenName: name,
      expiresAt: expiresAt,
      tokenHashLength: tokenHash.length
    });

    // Create service role client for database operations
    const serviceSupabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Store the token using service role client - EXPLICITLY SET is_active to true
    const { data: tokenRecord, error: dbError } = await serviceSupabase
      .from('webdav_tokens')
      .insert({
        user_id: user.id,
        name: name,
        token_hash: tokenHash,
        expires_at: expiresAt,
        is_active: true  // Explicitly set to true
      })
      .select()
      .single();

    if (dbError) {
      console.error('DATABASE ERROR:', dbError);
      return new Response(JSON.stringify({ 
        error: 'Failed to store token in database',
        details: dbError
      }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Token created successfully in database:', {
      tokenId: tokenRecord.id,
      isActive: tokenRecord.is_active,
      createdAt: tokenRecord.created_at
    });

    const response = {
      token: tokenString,
      id: tokenRecord.id,
      name: tokenRecord.name,
      expires_at: tokenRecord.expires_at,
      is_active: tokenRecord.is_active,
      created_at: tokenRecord.created_at
    };

    console.log('Returning successful response');
    
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('UNEXPECTED ERROR in webdav-create-token:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message,
      stack: error.stack
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
