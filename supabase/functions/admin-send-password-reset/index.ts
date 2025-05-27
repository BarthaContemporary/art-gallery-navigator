import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { logger } from "../_shared/logger.ts";

// Helper to create Supabase client instance
const getSupabaseClient = (req?: Request) => {
  const authHeader = req ? req.headers.get('Authorization')! : undefined;
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    authHeader ? { global: { headers: { Authorization: authHeader } } } : {}
  );
};

// Helper to create Supabase admin client instance
const getSupabaseAdminClient = () => {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let supabaseClient: SupabaseClient | null = null;
  let supabaseAdminClient: SupabaseClient | null = null;
  let invokingUserId: string | null = null;
  let clientIp: string | null = null;
  let userAgent: string | null = null;

  try {
    // Extract client IP and User-Agent
    // Note: IP detection can be complex due to proxies. 'x-forwarded-for' is common.
    // Supabase might also provide a specific header like 'x-real-ip'.
    const xForwardedFor = req.headers.get('x-forwarded-for');
    clientIp = xForwardedFor ? xForwardedFor.split(',')[0].trim() : req.headers.get('x-real-ip');
    userAgent = req.headers.get('user-agent');

    supabaseClient = getSupabaseClient(req);
    supabaseAdminClient = getSupabaseAdminClient();

    const { data: { user: invokingUser }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !invokingUser) {
      logger.error('Admin Password Reset: Auth error or no user found', {
        error: userError?.message,
        ip: clientIp,
        userAgent: userAgent,
      });
      return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    invokingUserId = invokingUser.id;

    const { data: isAdmin, error: roleError } = await supabaseClient.rpc('has_role', { _user_id: invokingUser.id, _role: 'gallery_admin' });
    if (roleError || !isAdmin) {
      logger.warn(`Admin Password Reset: Forbidden access by user ${invokingUser.email} (ID: ${invokingUser.id})`, {
        roleError: roleError?.message,
        ip: clientIp,
        userAgent: userAgent,
      });
      return new Response(JSON.stringify({ error: 'Forbidden: Admin privileges required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { targetUserEmail, appBaseUrl } = await req.json();
    if (!targetUserEmail || typeof targetUserEmail !== 'string' || !appBaseUrl || typeof appBaseUrl !== 'string') {
      logger.error('Admin Password Reset: Invalid request body', {
        targetUserEmail,
        appBaseUrl,
        adminId: invokingUser.id,
        adminEmail: invokingUser.email,
        ip: clientIp,
        userAgent: userAgent,
      });
      return new Response(JSON.stringify({ error: 'targetUserEmail and appBaseUrl are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    const redirectTo = `${appBaseUrl}/update-password`;
    logger.log(`Admin Password Reset: Admin ${invokingUser.email} (ID: ${invokingUser.id}) initiating password reset for ${targetUserEmail}. Redirect URL: ${redirectTo}`, {
      ip: clientIp,
      userAgent: userAgent,
    });

    const { error: resetError } = await supabaseAdminClient.auth.resetPasswordForEmail(targetUserEmail, {
      redirectTo: redirectTo,
    });

    if (resetError) {
      logger.error(`Admin Password Reset: Failed for ${targetUserEmail} by admin ${invokingUser.email} (ID: ${invokingUser.id})`, {
        errorMessage: resetError.message,
        ip: clientIp,
        userAgent: userAgent,
      });
      return new Response(JSON.stringify({ error: resetError.message || 'Failed to send password reset email' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    logger.log(`Admin Password Reset: Successfully sent to ${targetUserEmail} by admin ${invokingUser.email} (ID: ${invokingUser.id})`, {
      ip: clientIp,
      userAgent: userAgent,
    });
    // Placeholder for more detailed audit logging to a dedicated 'audit_logs' table if needed in the future
    // e.g., await supabaseAdminClient.from('audit_logs').insert({
    //   action: 'admin_password_reset',
    //   actor_id: invokingUser.id,
    //   target_user_email: targetUserEmail,
    //   ip_address: clientIp,
    //   user_agent: userAgent,
    //   status: 'success'
    // });

    return new Response(JSON.stringify({ message: 'Password reset email sent successfully' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e: any) {
    logger.error('Admin Password Reset: Unexpected error', {
      errorMessage: e.message,
      stack: e.stack,
      invokingUserId,
      ip: clientIp,
      userAgent: userAgent,
    });
    return new Response(JSON.stringify({ error: e.message || 'An unexpected error occurred' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
