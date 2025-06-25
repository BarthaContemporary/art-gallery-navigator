
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    // Create supabase client with the user's JWT token
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    
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

    // Verify user authentication
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    console.log('User authenticated:', user.id);

    const { name, expiresInDays } = await req.json();

    if (!name) {
      return new Response('Token name is required', { status: 400, headers: corsHeaders });
    }

    // Generate a secure random token
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const tokenString = Array.from(tokenBytes, b => b.toString(16).padStart(2, '0')).join('');

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

    console.log('Creating token for user:', user.id, 'with name:', name, 'expires at:', expiresAt);

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
    const { data: tokenRecord, error } = await serviceSupabase
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

    if (error) {
      console.error('Token creation error:', error);
      return new Response('Failed to create token', { status: 500, headers: corsHeaders });
    }

    console.log('Token created successfully:', tokenRecord.id, 'is_active:', tokenRecord.is_active);

    return new Response(JSON.stringify({
      token: tokenString,
      id: tokenRecord.id,
      name: tokenRecord.name,
      expires_at: tokenRecord.expires_at,
      is_active: tokenRecord.is_active
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in webdav-create-token:', error);
    return new Response('Internal server error', { status: 500, headers: corsHeaders });
  }
});
