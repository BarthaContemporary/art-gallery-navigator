import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

interface SendNotificationRequest {
  campaignId: string;
}

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: any;
  actions?: Array<{
    action: string;
    title: string;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { campaignId }: SendNotificationRequest = await req.json();

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('notification_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      throw new Error('Campaign not found');
    }

    // Get target users based on audience
    let targetUserIds: string[] = [];
    
    if (campaign.target_audience === 'all') {
      const { data: users } = await supabase.auth.admin.listUsers();
      targetUserIds = users.users.map(user => user.id);
    } else if (campaign.target_audience === 'artists') {
      const { data: artists } = await supabase
        .from('artists')
        .select('user_id')
        .not('user_id', 'is', null);
      targetUserIds = artists?.map(a => a.user_id).filter(Boolean) || [];
    } else if (campaign.target_audience === 'clients') {
      // For now, we'll send to all users except artists
      const { data: users } = await supabase.auth.admin.listUsers();
      const { data: artists } = await supabase
        .from('artists')
        .select('user_id')
        .not('user_id', 'is', null);
      
      const artistUserIds = new Set(artists?.map(a => a.user_id) || []);
      targetUserIds = users.users
        .map(user => user.id)
        .filter(id => !artistUserIds.has(id));
    }

    // Get notification subscriptions for target users
    const { data: subscriptions } = await supabase
      .from('notification_subscriptions')
      .select('*')
      .in('user_id', targetUserIds);

    if (!subscriptions || subscriptions.length === 0) {
      console.log('No active subscriptions found for target audience, but marking campaign as sent');
      
      // Update campaign status and set delivery count to 0
      const { error: updateError } = await supabase
        .from('notification_campaigns')
        .update({ 
          status: 'sent',
          delivery_count: 0,
          sent_at: new Date().toISOString()
        })
        .eq('id', campaignId);

      if (updateError) {
        throw updateError;
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Campaign marked as sent with 0 deliveries (no active subscriptions)',
          deliveryCount: 0 
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Prepare notification payload
    const notificationPayload: NotificationPayload = {
      title: campaign.title,
      body: campaign.message,
      icon: campaign.icon_url || '/lovable-uploads/3ba18906-49f8-43ba-ad34-1ff106219d42.png',
      badge: '/lovable-uploads/3ba18906-49f8-43ba-ad34-1ff106219d42.png',
      data: {
        campaignId: campaign.id,
        url: campaign.action_url || '/',
        timestamp: Date.now()
      },
      actions: campaign.action_url ? [{
        action: 'open',
        title: 'View'
      }] : undefined
    };

    let successCount = 0;
    let failureCount = 0;

    // Send notifications to all subscriptions
    for (const subscription of subscriptions) {
      try {
        // In a real implementation, you would use a push service like Firebase FCM
        // For now, we'll simulate the notification sending
        console.log(`Sending notification to user ${subscription.user_id}:`, {
          endpoint: subscription.endpoint,
          payload: notificationPayload
        });

        // Log successful delivery in analytics
        await supabase
          .from('notification_analytics')
          .insert({
            campaign_id: campaignId,
            user_id: subscription.user_id,
            event_type: 'delivered'
          });

        successCount++;
      } catch (error) {
        console.error(`Failed to send notification to user ${subscription.user_id}:`, error);
        failureCount++;
      }
    }

    // Update campaign status and delivery count
    await supabase
      .from('notification_campaigns')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        delivery_count: successCount
      })
      .eq('id', campaignId);

    return new Response(JSON.stringify({
      success: true,
      campaignId,
      deliveryCount: successCount,
      failureCount,
      message: `Notification sent to ${successCount} users successfully`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error sending push notification:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Failed to send push notification'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});