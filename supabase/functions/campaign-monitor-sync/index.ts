import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CampaignMonitorClient {
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

    const { action, clientId, listId, campaignMonitorClientId } = await req.json()

    // Get Campaign Monitor API key
    const campaignMonitorApiKey = Deno.env.get('CAMPAIGN_MONITOR_API_KEY')
    if (!campaignMonitorApiKey) {
      return new Response('Campaign Monitor API key not configured', { status: 500 })
    }

    switch (action) {
      case 'sync_client':
        return await syncClientToCampaignMonitor(supabaseClient, campaignMonitorApiKey, clientId, listId, campaignMonitorClientId)
      case 'get_lists':
        return await getCampaignMonitorLists(campaignMonitorApiKey, campaignMonitorClientId)
      case 'sync_all_clients':
        return await syncAllClients(supabaseClient, campaignMonitorApiKey, listId, campaignMonitorClientId)
      default:
        return new Response('Invalid action', { status: 400 })
    }

  } catch (error) {
    console.error('Campaign Monitor sync error:', error)
    return new Response('Internal server error', { status: 500 })
  }
})

async function syncClientToCampaignMonitor(supabaseClient: any, apiKey: string, clientId: string, listId: string, campaignMonitorClientId: string) {
  try {
    // Get client data
    const { data: client, error: clientError } = await supabaseClient
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single()

    if (clientError || !client) {
      return new Response('Client not found', { status: 404 })
    }

    // Prepare Campaign Monitor subscriber data
    const subscriberData: CampaignMonitorClient = {
      EmailAddress: client.email,
      Name: client.full_name,
      CustomFields: [
        { Key: 'Company', Value: client.company || '' },
        { Key: 'Phone', Value: client.phone || '' },
        { Key: 'Status', Value: client.status || '' },
        { Key: 'Source', Value: client.source || '' },
        { Key: 'ClientType', Value: client.client_type || '' }
      ]
    }

    // Add subscriber to Campaign Monitor list using the client ID
    const response = await fetch(`https://api.createsend.com/api/v3.3/subscribers/${listId}.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(apiKey + ':x')}`,
        'Content-Type': 'application/json',
        'X-Client-Id': campaignMonitorClientId
      },
      body: JSON.stringify(subscriberData)
    })

    if (response.ok) {
      // Update client sync status
      await supabaseClient
        .from('clients')
        .update({
          cm_sync_status: 'synced',
          cm_last_sync_at: new Date().toISOString(),
          campaign_monitor_id: client.email
        })
        .eq('id', clientId)

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } else {
      const errorData = await response.text()
      console.error('Campaign Monitor API error:', errorData)

      await supabaseClient
        .from('clients')
        .update({
          cm_sync_status: 'error',
          cm_sync_error: errorData
        })
        .eq('id', clientId)

      return new Response(JSON.stringify({ error: errorData }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  } catch (error) {
    console.error('Sync client error:', error)
    return new Response('Sync failed', { status: 500 })
  }
}

async function getCampaignMonitorLists(apiKey: string, campaignMonitorClientId: string) {
  try {
    const response = await fetch(`https://api.createsend.com/api/v3.3/clients/${campaignMonitorClientId}/lists.json`, {
      headers: {
        'Authorization': `Basic ${btoa(apiKey + ':x')}`,
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      const lists = await response.json()
      return new Response(JSON.stringify(lists), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    } else {
      return new Response('Failed to fetch lists', { status: 500 })
    }
  } catch (error) {
    console.error('Get lists error:', error)
    return new Response('Failed to fetch lists', { status: 500 })
  }
}

async function syncAllClients(supabaseClient: any, apiKey: string, listId: string, campaignMonitorClientId: string) {
  try {
    const { data: clients, error } = await supabaseClient
      .from('clients')
      .select('*')
      .not('email', 'is', null)

    if (error || !clients) {
      return new Response('Failed to fetch clients', { status: 500 })
    }

    let syncedCount = 0
    let errorCount = 0

    for (const client of clients) {
      try {
        const subscriberData: CampaignMonitorClient = {
          EmailAddress: client.email,
          Name: client.full_name,
          CustomFields: [
            { Key: 'Company', Value: client.company || '' },
            { Key: 'Phone', Value: client.phone || '' },
            { Key: 'Status', Value: client.status || '' },
            { Key: 'Source', Value: client.source || '' },
            { Key: 'ClientType', Value: client.client_type || '' }
          ]
        }

        const response = await fetch(`https://api.createsend.com/api/v3.3/subscribers/${listId}.json`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(apiKey + ':x')}`,
            'Content-Type': 'application/json',
            'X-Client-Id': campaignMonitorClientId
          },
          body: JSON.stringify(subscriberData)
        })

        if (response.ok) {
          await supabaseClient
            .from('clients')
            .update({
              cm_sync_status: 'synced',
              cm_last_sync_at: new Date().toISOString(),
              campaign_monitor_id: client.email
            })
            .eq('id', client.id)
          
          syncedCount++
        } else {
          const errorData = await response.text()
          await supabaseClient
            .from('clients')
            .update({
              cm_sync_status: 'error',
              cm_sync_error: errorData
            })
            .eq('id', client.id)
          
          errorCount++
        }

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        console.error(`Error syncing client ${client.id}:`, error)
        errorCount++
      }
    }

    return new Response(JSON.stringify({ 
      syncedCount, 
      errorCount, 
      totalClients: clients.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Bulk sync error:', error)
    return new Response('Bulk sync failed', { status: 500 })
  }
}
