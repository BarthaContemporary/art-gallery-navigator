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
    const { action } = await req.json();
    console.log(`Google Contacts action: ${action}`);

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

    // Check if token is expired
    if (new Date(config.google_token_expiry) < new Date()) {
      throw new Error('Token expired - please reconnect');
    }

    const accessToken = config.google_access_token;

    if (action === 'fetch-contacts') {
      // Fetch contacts from Google People API
      console.log('Fetching Google contacts...');
      
      const response = await fetch(
        'https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers,organizations,addresses&pageSize=1000',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error('Google API error:', error);
        throw new Error(error.error?.message || 'Failed to fetch contacts');
      }

      const data = await response.json();
      const contacts = data.connections || [];
      
      console.log(`Fetched ${contacts.length} contacts from Google`);

      // Transform Google contacts to CRM format
      const crmContacts = contacts.map((contact: any) => {
        const name = contact.names?.[0];
        const email = contact.emailAddresses?.[0];
        const phone = contact.phoneNumbers?.[0];
        const org = contact.organizations?.[0];
        const address = contact.addresses?.[0];

        return {
          google_contact_id: contact.resourceName,
          full_name: name ? `${name.givenName || ''} ${name.familyName || ''}`.trim() : 'Unknown',
          first_name: name?.givenName || null,
          last_name: name?.familyName || null,
          email: email?.value || null,
          phone: phone?.value || null,
          job_title: org?.title || null,
          organization_name: org?.name || null,
          address_line1: address?.streetAddress || null,
          city: address?.city || null,
          state: address?.region || null,
          postal_code: address?.postalCode || null,
          country: address?.country || null,
        };
      });

      return new Response(JSON.stringify({ contacts: crmContacts }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'import-contacts') {
      const { contacts: selectedContacts } = await req.json();
      
      console.log(`Importing ${selectedContacts?.length || 0} contacts...`);

      let imported = 0;
      let skipped = 0;

      for (const contact of selectedContacts || []) {
        // Check if contact already exists (by google_contact_id or email)
        const { data: existing } = await supabase
          .from('crm_contacts')
          .select('id')
          .or(`google_contact_id.eq.${contact.google_contact_id},email.eq.${contact.email}`)
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

        // Insert new contact
        const { error: insertError } = await supabase
          .from('crm_contacts')
          .insert({
            ...contact,
            source: 'google_contacts',
            created_by: user.id,
          });

        if (insertError) {
          console.error('Error importing contact:', insertError);
          skipped++;
        } else {
          imported++;
        }
      }

      console.log(`Import complete: ${imported} imported, ${skipped} skipped`);

      return new Response(JSON.stringify({ imported, skipped }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action');
  } catch (error) {
    console.error('Google Contacts error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
