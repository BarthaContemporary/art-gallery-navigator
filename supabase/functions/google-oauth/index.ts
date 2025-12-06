import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Scopes for Google Workspace integration
const SCOPES = [
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'openid',
  'email',
  'profile'
].join(' ');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, code, redirectUri, state } = await req.json();
    console.log(`Google OAuth action: ${action}`);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      throw new Error('Unauthorized');
    }

    console.log(`User authenticated: ${user.id}`);

    if (action === 'get-auth-url') {
      // Generate OAuth URL
      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: SCOPES,
        access_type: 'offline',
        prompt: 'consent',
        state: state || user.id,
      });

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      console.log('Generated auth URL for user:', user.id, 'with redirect_uri:', redirectUri);

      return new Response(JSON.stringify({ authUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'exchange-code') {
      // Exchange authorization code for tokens
      console.log('Exchanging code for tokens...');
      console.log('Redirect URI used for exchange:', redirectUri);
      
      if (!code) {
        console.error('Missing authorization code');
        throw new Error('Missing authorization code');
      }

      if (!redirectUri) {
        console.error('Missing redirect URI');
        throw new Error('Missing redirect URI');
      }

      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        console.error('Missing Google OAuth credentials');
        throw new Error('Server configuration error: Missing OAuth credentials');
      }
      
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID!,
          client_secret: GOOGLE_CLIENT_SECRET!,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });

      const tokenData = await tokenResponse.json();
      
      if (tokenData.error) {
        console.error('Token exchange error from Google:', tokenData);
        console.error('Error details:', {
          error: tokenData.error,
          error_description: tokenData.error_description,
          redirect_uri_used: redirectUri
        });
        throw new Error(tokenData.error_description || tokenData.error);
      }

      console.log('Token exchange successful, storing tokens...');

      // Store tokens in database
      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();
      
      const { error: upsertError } = await supabase
        .from('crm_integration_config')
        .upsert({
          user_id: user.id,
          google_access_token: tokenData.access_token,
          google_refresh_token: tokenData.refresh_token,
          google_token_expiry: expiresAt,
          google_scopes: SCOPES.split(' '),
          auto_sync_contacts: true,
          auto_log_emails: false,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (upsertError) {
        console.error('Error storing tokens in database:', upsertError);
        throw upsertError;
      }

      console.log('Tokens stored successfully for user:', user.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'refresh-token') {
      // Get stored refresh token
      const { data: config, error: configError } = await supabase
        .from('crm_integration_config')
        .select('google_refresh_token')
        .eq('user_id', user.id)
        .single();

      if (configError || !config?.google_refresh_token) {
        throw new Error('No refresh token found');
      }

      // Refresh the access token
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID!,
          client_secret: GOOGLE_CLIENT_SECRET!,
          refresh_token: config.google_refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      const refreshData = await refreshResponse.json();
      
      if (refreshData.error) {
        throw new Error(refreshData.error_description || refreshData.error);
      }

      // Update stored access token
      const expiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString();
      
      await supabase
        .from('crm_integration_config')
        .update({
          google_access_token: refreshData.access_token,
          google_token_expiry: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      return new Response(JSON.stringify({ 
        access_token: refreshData.access_token,
        expires_at: expiresAt 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'disconnect') {
      // Revoke Google access and clear tokens
      const { data: config } = await supabase
        .from('crm_integration_config')
        .select('google_access_token')
        .eq('user_id', user.id)
        .single();

      if (config?.google_access_token) {
        // Revoke token with Google
        await fetch(`https://oauth2.googleapis.com/revoke?token=${config.google_access_token}`, {
          method: 'POST',
        });
      }

      // Clear tokens from database
      await supabase
        .from('crm_integration_config')
        .update({
          google_access_token: null,
          google_refresh_token: null,
          google_token_expiry: null,
          google_scopes: null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      console.log('Google integration disconnected for user:', user.id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action');
  } catch (error) {
    console.error('Google OAuth error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
