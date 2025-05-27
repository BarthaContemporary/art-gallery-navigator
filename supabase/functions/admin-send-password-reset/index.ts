
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

  try {
    supabaseClient = getSupabaseClient(req);
    supabaseAdminClient = getSupabaseAdminClient();

    const { data: { user: invokingUser }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !invokingUser) {
      logger.error('Admin Password Reset: Auth error or no user found', userError?.message);
      return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    invokingUserId = invokingUser.id;

    const { data: isAdmin, error: roleError } = await supabaseClient.rpc('has_role', { _user_id: invokingUser.id, _role: 'gallery_admin' });
    if (roleError || !isAdmin) {
      logger.warn(`Admin Password Reset: Forbidden access by user ${invokingUser.email} (ID: ${invokingUser.id})`, roleError?.message);
      return new Response(JSON.stringify({ error: 'Forbidden: Admin privileges required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { targetUserEmail, appBaseUrl } = await req.json();
    if (!targetUserEmail || typeof targetUserEmail !== 'string' || !appBaseUrl || typeof appBaseUrl !== 'string') {
      logger.error('Admin Password Reset: Invalid request body', { targetUserEmail, appBaseUrl });
      return new Response(JSON.stringify({ error: 'targetUserEmail and appBaseUrl are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
    const redirectTo = `${appBaseUrl}/update-password`;
    logger.log(`Admin Password Reset: Admin ${invokingUser.email} (ID: ${invokingUser.id}) initiating password reset for ${targetUserEmail}. Redirect URL: ${redirectTo}`);

    const { error: resetError } = await supabaseAdminClient.auth.resetPasswordForEmail(targetUserEmail, {
      redirectTo: redirectTo,
    });

    if (resetError) {
      logger.error(`Admin Password Reset: Failed for ${targetUserEmail} by admin ${invokingUser.email} (ID: ${invokingUser.id})`, resetError.message);
      return new Response(JSON.stringify({ error: resetError.message || 'Failed to send password reset email' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    logger.log(`Admin Password Reset: Successfully sent to ${targetUserEmail} by admin ${invokingUser.email} (ID: ${invokingUser.id})`);
    // Placeholder for more detailed audit logging if needed in the future
    // e.g., await supabaseAdminClient.from('audit_logs').insert(...)

    return new Response(JSON.stringify({ message: 'Password reset email sent successfully' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (e: any) {
    logger.error('Admin Password Reset: Unexpected error', e.message, { stack: e.stack, invokingUserId });
    return new Response(JSON.stringify({ error: e.message || 'An unexpected error occurred' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
