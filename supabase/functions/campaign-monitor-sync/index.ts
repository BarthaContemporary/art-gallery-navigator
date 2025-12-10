import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CampaignMonitorSubscriber {
  EmailAddress: string;
  Name: string;
  CustomFields?: Array<{
    Key: string;
    Value: string;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    
    const { data: { user } } = await supabaseClient.auth.getUser(token)
    if (!user) {
      return new Response('Unauthorized', { status: 401 })
    }

    // Check if user is admin
    const { data: userRole } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'gallery_admin')
      .single()

    if (!userRole) {
      return new Response('Forbidden', { status: 403 })
    }

    const { action, contactId, listId } = await req.json()

    // Get Campaign Monitor credentials from env
    const apiKey = Deno.env.get('CAMPAIGN_MONITOR_API_KEY')
    const clientId = Deno.env.get('CAMPAIGN_MONITOR_CLIENT_ID')
    
    if (!apiKey || !clientId) {
      console.error('Campaign Monitor credentials not configured')
      return new Response(JSON.stringify({ error: 'Campaign Monitor not configured' }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const authString = btoa(apiKey + ':x')

    switch (action) {
      case 'get_lists':
        return await getLists(authString, clientId)
      case 'get_campaigns':
        return await getCampaigns(authString, clientId)
      case 'get_campaign_summary':
        return await getCampaignSummary(authString, contactId) // reusing contactId param for campaignId
      case 'sync_contact':
        return await syncContact(supabaseClient, authString, contactId, listId)
      case 'sync_all_contacts':
        return await syncAllContacts(supabaseClient, authString, listId)
      case 'get_list_stats':
        return await getListStats(authString, listId)
      case 'import_from_list':
        return await importFromList(supabaseClient, authString, listId)
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
    }

  } catch (error) {
    console.error('Campaign Monitor sync error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function getLists(authString: string, clientId: string) {
  try {
    const response = await fetch(`https://api.createsend.com/api/v3.3/clients/${clientId}/lists.json`, {
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      const lists = await response.json()
      return new Response(JSON.stringify(lists), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } else {
      const errorText = await response.text()
      console.error('Failed to fetch lists:', errorText)
      return new Response(JSON.stringify({ error: 'Failed to fetch lists' }), { 
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  } catch (error) {
    console.error('Get lists error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch lists' }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function getCampaigns(authString: string, clientId: string) {
  try {
    // Fetch sent campaigns
    const sentResponse = await fetch(`https://api.createsend.com/api/v3.3/clients/${clientId}/campaigns.json`, {
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json'
      }
    })

    // Fetch draft campaigns
    const draftResponse = await fetch(`https://api.createsend.com/api/v3.3/clients/${clientId}/drafts.json`, {
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json'
      }
    })

    // Fetch scheduled campaigns
    const scheduledResponse = await fetch(`https://api.createsend.com/api/v3.3/clients/${clientId}/scheduled.json`, {
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json'
      }
    })

    const sent = sentResponse.ok ? await sentResponse.json() : []
    const drafts = draftResponse.ok ? await draftResponse.json() : []
    const scheduled = scheduledResponse.ok ? await scheduledResponse.json() : []

    return new Response(JSON.stringify({ sent, drafts, scheduled }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Get campaigns error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch campaigns' }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function getCampaignSummary(authString: string, campaignId: string) {
  try {
    const response = await fetch(`https://api.createsend.com/api/v3.3/campaigns/${campaignId}/summary.json`, {
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      const summary = await response.json()
      return new Response(JSON.stringify(summary), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } else {
      return new Response(JSON.stringify({ error: 'Failed to fetch campaign summary' }), { 
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  } catch (error) {
    console.error('Get campaign summary error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch campaign summary' }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function getListStats(authString: string, listId: string) {
  try {
    const response = await fetch(`https://api.createsend.com/api/v3.3/lists/${listId}/stats.json`, {
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      const stats = await response.json()
      return new Response(JSON.stringify(stats), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } else {
      return new Response(JSON.stringify({ error: 'Failed to fetch list stats' }), { 
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  } catch (error) {
    console.error('Get list stats error:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch list stats' }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function syncContact(supabaseClient: any, authString: string, contactId: string, listId: string) {
  try {
    // Get contact data from crm_contacts
    const { data: contact, error: contactError } = await supabaseClient
      .from('crm_contacts')
      .select('*')
      .eq('id', contactId)
      .single()

    if (contactError || !contact) {
      return new Response(JSON.stringify({ error: 'Contact not found' }), { 
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!contact.email) {
      return new Response(JSON.stringify({ error: 'Contact has no email' }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const subscriberData = {
      EmailAddress: contact.email,
      Name: contact.full_name,
      ConsentToTrack: 'Yes',
      CustomFields: [
        { Key: 'Phone', Value: contact.phone || '' },
        { Key: 'Company', Value: contact.organization_id ? 'See CRM' : '' },
        { Key: 'Source', Value: contact.source || '' },
        { Key: 'Tags', Value: (contact.tags || []).join(', ') }
      ]
    }

    const response = await fetch(`https://api.createsend.com/api/v3.3/subscribers/${listId}.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(subscriberData)
    })

    if (response.ok) {
      // Update contact sync status
      await supabaseClient
        .from('crm_contacts')
        .update({
          custom_fields: {
            ...contact.custom_fields,
            cm_sync_status: 'synced',
            cm_last_sync_at: new Date().toISOString(),
            cm_list_id: listId
          }
        })
        .eq('id', contactId)

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } else {
      const errorData = await response.text()
      console.error('Campaign Monitor API error:', errorData)

      await supabaseClient
        .from('crm_contacts')
        .update({
          custom_fields: {
            ...contact.custom_fields,
            cm_sync_status: 'error',
            cm_sync_error: errorData
          }
        })
        .eq('id', contactId)

      return new Response(JSON.stringify({ error: errorData }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  } catch (error) {
    console.error('Sync contact error:', error)
    return new Response(JSON.stringify({ error: 'Sync failed' }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function syncAllContacts(supabaseClient: any, authString: string, listId: string) {
  try {
    console.log('Starting bulk sync to list:', listId);
    
    // Get all contacts with email (no marketing_consent filter)
    const { data: contacts, error } = await supabaseClient
      .from('crm_contacts')
      .select('*')
      .not('email', 'is', null)

    if (error || !contacts) {
      return new Response(JSON.stringify({ error: 'Failed to fetch contacts' }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let syncedCount = 0
    let errorCount = 0

    for (const contact of contacts) {
      try {
        const subscriberData = {
          EmailAddress: contact.email,
          Name: contact.full_name,
          ConsentToTrack: 'Yes',
          CustomFields: [
            { Key: 'Phone', Value: contact.phone || '' },
            { Key: 'Source', Value: contact.source || '' },
            { Key: 'Tags', Value: (contact.tags || []).join(', ') }
          ]
        }

        const response = await fetch(`https://api.createsend.com/api/v3.3/subscribers/${listId}.json`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(subscriberData)
        })

        if (response.ok) {
          await supabaseClient
            .from('crm_contacts')
            .update({
              custom_fields: {
                ...contact.custom_fields,
                cm_sync_status: 'synced',
                cm_last_sync_at: new Date().toISOString(),
                cm_list_id: listId
              }
            })
            .eq('id', contact.id)
          
          syncedCount++
        } else {
          const errorData = await response.text()
          console.error(`Sync error for contact ${contact.email}:`, errorData)
          
          await supabaseClient
            .from('crm_contacts')
            .update({
              custom_fields: {
                ...contact.custom_fields,
                cm_sync_status: 'error',
                cm_sync_error: errorData
              }
            })
            .eq('id', contact.id)
          
          errorCount++
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        console.error(`Error syncing contact ${contact.id}:`, error)
        errorCount++
      }
    }

    return new Response(JSON.stringify({ 
      syncedCount, 
      errorCount, 
      totalContacts: contacts.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Bulk sync error:', error)
    return new Response(JSON.stringify({ error: 'Bulk sync failed' }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function importFromList(supabaseClient: any, authString: string, listId: string) {
  try {
    console.log('Starting import from CM list:', listId);
    
    // Fetch ALL active subscribers with pagination
    let allSubscribers: any[] = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const response = await fetch(`https://api.createsend.com/api/v3.3/lists/${listId}/active.json?page=${page}&pagesize=1000`, {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to fetch subscribers:', errorText);
        return new Response(JSON.stringify({ error: 'Failed to fetch subscribers from Campaign Monitor' }), { 
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const data = await response.json();
      const pageResults = data.Results || [];
      allSubscribers = allSubscribers.concat(pageResults);
      
      console.log(`Page ${page}: fetched ${pageResults.length} subscribers (total: ${allSubscribers.length})`);
      
      // Check if there are more pages
      const totalPages = data.NumberOfPages || 1;
      hasMore = page < totalPages;
      page++;
    }
    
    const subscribers = allSubscribers;
    console.log(`Found ${subscribers.length} total subscribers to import`);
    
    // Get all existing emails to check for duplicates in one query
    const subscriberEmails = subscribers
      .map((s: any) => s.EmailAddress?.toLowerCase())
      .filter(Boolean);
    
    const { data: existingContacts } = await supabaseClient
      .from('crm_contacts')
      .select('email')
      .in('email', subscriberEmails);
    
    const existingEmails = new Set((existingContacts || []).map((c: any) => c.email?.toLowerCase()));
    console.log(`Found ${existingEmails.size} existing contacts to skip`);
    
    // Prepare contacts for batch insert
    const contactsToInsert = [];
    let skippedCount = 0;
    
    for (const subscriber of subscribers) {
      const email = subscriber.EmailAddress?.toLowerCase();
      if (!email || existingEmails.has(email)) {
        skippedCount++;
        continue;
      }
      
      const fullName = subscriber.Name || email.split('@')[0];
      const nameParts = fullName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      const customFields = subscriber.CustomFields || [];
      const getField = (key: string) => {
        const field = customFields.find((f: any) => f.Key === key);
        return field?.Value || null;
      };
      
      contactsToInsert.push({
        email,
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
        phone: getField('Phone'),
        source: 'Campaign Monitor Import',
        marketing_consent: true,
        consent_date: new Date().toISOString(),
        consent_source: 'Campaign Monitor List',
        custom_fields: {
          cm_list_id: listId,
          cm_subscriber_date: subscriber.Date
        }
      });
    }
    
    console.log(`Inserting ${contactsToInsert.length} new contacts in batches`);
    
    // Batch insert in chunks of 100
    let importedCount = 0;
    let errorCount = 0;
    const batchSize = 100;
    
    for (let i = 0; i < contactsToInsert.length; i += batchSize) {
      const batch = contactsToInsert.slice(i, i + batchSize);
      const { error: insertError, data } = await supabaseClient
        .from('crm_contacts')
        .insert(batch)
        .select('id');
      
      if (insertError) {
        console.error(`Batch insert error at ${i}:`, insertError);
        errorCount += batch.length;
      } else {
        importedCount += (data?.length || batch.length);
      }
    }
    
    console.log(`Import complete: ${importedCount} imported, ${skippedCount} skipped, ${errorCount} errors`);

    return new Response(JSON.stringify({ 
      importedCount, 
      skippedCount, 
      errorCount,
      totalSubscribers: subscribers.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Import error:', error);
    return new Response(JSON.stringify({ error: 'Import failed' }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}
