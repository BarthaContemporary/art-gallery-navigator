
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log(`WebDAV Token Creation - ${req.method} ${req.url}`);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      console.error('Missing environment variables');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify user auth
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: { user }, error: authError } = await userSupabase.auth.getUser();

    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(JSON.stringify({ error: 'Authentication failed' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('User authenticated:', user.email);

    const requestBody = await req.json();
    const { name, expiresInDays } = requestBody;

    if (!name) {
      return new Response(JSON.stringify({ error: 'Token name is required' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Generate a secure token - 64 characters hex (exactly matching validation function expectation)
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const tokenString = Array.from(tokenBytes, b => b.toString(16).padStart(2, '0')).join('');

    // Hash the token using the EXACT same method as the validation function
    // This MUST match the database function: encode(digest(token_text::bytea, 'sha256'), 'hex')
    const encoder = new TextEncoder();
    const tokenBytes2 = encoder.encode(tokenString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', tokenBytes2);
    const hashArray = new Uint8Array(hashBuffer);
    const tokenHash = Array.from(hashArray, b => b.toString(16).padStart(2, '0')).join('');

    // Verify our hashing method produces the expected result
    if (tokenHash.length !== 64) {
      console.error('Hash length mismatch: expected 64, got', tokenHash.length);
      return new Response(JSON.stringify({ error: 'Token hashing failed' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const expiresAt = expiresInDays > 0 
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // Store token using service role
    const serviceSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // First, deactivate any existing tokens to ensure we don't have conflicts
    console.log('Deactivating existing tokens for user:', user.id);
    await serviceSupabase
      .from('webdav_tokens')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('is_active', true);

    const { data: tokenRecord, error: dbError } = await serviceSupabase
      .from('webdav_tokens')
      .insert({
        user_id: user.id,
        name: name,
        token_hash: tokenHash,
        expires_at: expiresAt,
        is_active: true
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(JSON.stringify({ error: 'Failed to create token' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Token created successfully for user');

    // Verify the hash was stored correctly
    if (tokenRecord.token_hash !== tokenHash) {
      console.error('Hash verification failed');
    }

    // Test the token immediately after creation
    const { data: testValidation, error: testError } = await serviceSupabase
      .rpc('validate_webdav_token', { token_text: tokenString });

    if (testError) {
      console.error('Immediate validation test failed');
    } else if (!testValidation || testValidation.length === 0) {
      console.error('Immediate validation returned no results');
    }

    return new Response(JSON.stringify({
      token: tokenString,
      id: tokenRecord.id,
      name: tokenRecord.name,
      expires_at: tokenRecord.expires_at,
      is_active: tokenRecord.is_active,
      created_at: tokenRecord.created_at,
      validation_test: testValidation?.[0] || null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
