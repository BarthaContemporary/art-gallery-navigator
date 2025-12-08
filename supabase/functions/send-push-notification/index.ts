import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  userId: string;
  title: string;
  body: string;
  icon?: string;
  url?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authentication check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("Authentication failed:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const senderId = user.id;
    console.log(`Authenticated user: ${senderId}`);

    const { userId, title, body, icon, url }: PushPayload = await req.json();
    
    console.log(`Sending push notification to user: ${userId}`);
    console.log(`Title: ${title}, Body: ${body}`);

    // Authorization check: sender must be admin OR a chat room participant with the recipient
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: senderId,
      _role: 'gallery_admin'
    });

    let isAuthorized = isAdmin;

    if (!isAdmin) {
      // Check if sender and recipient share a chat room
      const { data: sharedRoom, error: roomError } = await supabase
        .from('chat_rooms')
        .select('id')
        .or(`and(participant_1_id.eq.${senderId},participant_2_id.eq.${userId}),and(participant_1_id.eq.${userId},participant_2_id.eq.${senderId})`)
        .limit(1);

      if (roomError) {
        console.error("Error checking chat room:", roomError);
      }

      isAuthorized = sharedRoom && sharedRoom.length > 0;
    }

    if (!isAuthorized) {
      console.error(`User ${senderId} not authorized to send notifications to ${userId}`);
      return new Response(
        JSON.stringify({ error: "Not authorized to send notifications to this user" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Authorization passed for user ${senderId}`);

    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId);

    if (subError) {
      console.error("Error fetching subscriptions:", subError);
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log("No push subscriptions found for user");
      return new Response(
        JSON.stringify({ success: false, message: "No subscriptions found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${subscriptions.length} subscription(s)`);

    const payload = JSON.stringify({
      title,
      body,
      icon: icon || "/favicon.ico",
      url: url || "/chat",
      timestamp: Date.now(),
    });

    // Import web-push compatible library for Deno
    const webPush = await import("npm:web-push@3.6.7");
    
    webPush.setVapidDetails(
      "mailto:admin@barthacontemporary.com",
      vapidPublicKey,
      vapidPrivateKey
    );

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          };

          console.log(`Sending to endpoint: ${sub.endpoint.substring(0, 50)}...`);
          
          await webPush.sendNotification(pushSubscription, payload);
          console.log("Push notification sent successfully");
          return { success: true, endpoint: sub.endpoint };
        } catch (error) {
          console.error(`Failed to send to ${sub.endpoint}:`, error);
          
          // Remove invalid subscriptions (410 Gone or 404 Not Found)
          if (error.statusCode === 410 || error.statusCode === 404) {
            console.log("Removing invalid subscription");
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("id", sub.id);
          }
          
          return { success: false, endpoint: sub.endpoint, error: error.message };
        }
      })
    );

    const successCount = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;

    return new Response(
      JSON.stringify({
        success: true,
        sent: successCount,
        total: subscriptions.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-push-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
