
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

  // Use service role client for admin operations
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Get user from auth header using anon client
    const anonSupabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await anonSupabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

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

    // Store the token using service role client
    const { data: tokenRecord, error } = await supabase
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

    if (error) {
      console.error('Token creation error:', error);
      return new Response('Failed to create token', { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({
      token: tokenString,
      id: tokenRecord.id,
      name: tokenRecord.name,
      expires_at: tokenRecord.expires_at
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in webdav-create-token:', error);
    return new Response('Internal server error', { status: 500, headers: corsHeaders });
  }
});
