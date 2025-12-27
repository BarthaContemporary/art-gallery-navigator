import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeadCaptureRequest {
  publicationId: string;
  name: string;
  email: string;
  mailingListOptIn: boolean;
  userAgent?: string;
}

function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { publicationId, name, email, mailingListOptIn, userAgent }: LeadCaptureRequest = await req.json();

    // Validate inputs
    if (!publicationId || !name || !email) {
      return new Response(
        JSON.stringify({ error: 'Publication ID, name, and email are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check publication exists and has download gate enabled
    const { data: publication, error: pubError } = await supabase
      .from('publications')
      .select('id, title, download_gate_enabled, mailing_list_config')
      .eq('id', publicationId)
      .single();

    if (pubError || !publication) {
      return new Response(
        JSON.stringify({ error: 'Publication not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting: check recent leads from this email for this publication
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentLeadCount } = await supabase
      .from('publication_leads')
      .select('*', { count: 'exact', head: true })
      .eq('publication_id', publicationId)
      .eq('email', email)
      .gte('created_at', oneHourAgo);

    if ((recentLeadCount || 0) >= 3) {
      return new Response(
        JSON.stringify({ error: 'Too many download requests. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create lead record
    const { data: lead, error: leadError } = await supabase
      .from('publication_leads')
      .insert({
        publication_id: publicationId,
        name: name.trim(),
        email: email.toLowerCase().trim(),
        mailing_list_opt_in: mailingListOptIn,
        consent_timestamp: new Date().toISOString(),
        user_agent: userAgent || null,
      })
      .select()
      .single();

    if (leadError) {
      console.error('Failed to create lead:', leadError);
      return new Response(
        JSON.stringify({ error: 'Failed to process request' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Lead created: ${lead.id} for publication ${publicationId}`);

    // If opted in, sync to Campaign Monitor
    if (mailingListOptIn && publication.mailing_list_config) {
      try {
        // Invoke Campaign Monitor sync function
        const { error: syncError } = await supabase.functions.invoke('campaign-monitor-sync', {
          body: {
            action: 'add_subscriber',
            email: email.toLowerCase().trim(),
            name: name.trim(),
            customFields: {
              source: 'publication_download',
              publicationTitle: publication.title,
            }
          }
        });

        if (syncError) {
          console.error('Campaign Monitor sync failed:', syncError);
          // Don't fail the request, just log it
        } else {
          // Mark as synced
          await supabase
            .from('publication_leads')
            .update({ synced_to_campaign_monitor: true })
            .eq('id', lead.id);
        }
      } catch (cmError) {
        console.error('Campaign Monitor sync error:', cmError);
      }
    }

    // Create download token (valid for 30 minutes)
    const token = generateSecureToken();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const { data: downloadToken, error: tokenError } = await supabase
      .from('publication_download_tokens')
      .insert({
        publication_id: publicationId,
        lead_id: lead.id,
        token,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (tokenError) {
      console.error('Failed to create download token:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate download token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Download token created successfully');

    return new Response(
      JSON.stringify({
        success: true,
        downloadToken: token,
        expiresAt,
        message: 'Your download is ready'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error processing lead capture:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
