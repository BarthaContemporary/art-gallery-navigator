import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, contactEmail, maxResults = 10 } = await req.json();
    console.log(`Gmail action: ${action}, contactEmail: ${contactEmail}`);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Get access token
    const { data: config, error: configError } = await supabase
      .from('crm_integration_config')
      .select('google_access_token, google_token_expiry')
      .eq('user_id', user.id)
      .single();

    if (configError || !config?.google_access_token) {
      throw new Error('Google not connected');
    }

    if (new Date(config.google_token_expiry) < new Date()) {
      throw new Error('Token expired - please reconnect');
    }

    const accessToken = config.google_access_token;

    if (action === 'search-threads') {
      if (!contactEmail) {
        throw new Error('Contact email required');
      }

      // Search Gmail for threads with this contact
      const query = encodeURIComponent(`from:${contactEmail} OR to:${contactEmail}`);
      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads?q=${query}&maxResults=${maxResults}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error('Gmail API error:', error);
        throw new Error(error.error?.message || 'Failed to search Gmail');
      }

      const data = await response.json();
      const threads = data.threads || [];

      console.log(`Found ${threads.length} threads for ${contactEmail}`);

      // Get details for each thread
      const threadDetails = await Promise.all(
        threads.slice(0, 5).map(async (thread: any) => {
          const threadResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/threads/${thread.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            }
          );
          return threadResponse.json();
        })
      );

      // Transform to simpler format
      const formattedThreads = threadDetails.map((thread: any) => {
        const firstMessage = thread.messages?.[0];
        const headers = firstMessage?.payload?.headers || [];
        
        const getHeader = (name: string) => 
          headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

        return {
          id: thread.id,
          subject: getHeader('Subject') || '(No subject)',
          from: getHeader('From'),
          to: getHeader('To'),
          date: getHeader('Date'),
          messageCount: thread.messages?.length || 0,
          snippet: firstMessage?.snippet || '',
        };
      });

      return new Response(JSON.stringify({ threads: formattedThreads }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action');
  } catch (error) {
    console.error('Gmail error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
