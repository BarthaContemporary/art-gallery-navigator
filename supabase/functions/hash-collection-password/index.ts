
import 'https://deno.land/x/xhr@0.1.0/mod.ts'; // Required for Supabase client
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log('hash-collection-password function initializing');

// Initialize Supabase client if needed for verification
let supabaseAdmin: SupabaseClient | null = null;
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (supabaseUrl && supabaseServiceRoleKey) {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });
  console.log('Supabase admin client initialized for verification.');
} else {
  console.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Password verification will fail.');
}


serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('OPTIONS request received');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log('Request payload:', payload);

    // VERIFY MODE
    if (payload.slug && payload.attemptedPassword) {
      console.log('Entering verification mode for slug:', payload.slug);
      if (!supabaseAdmin) {
        console.error('Supabase admin client not initialized. Cannot verify password.');
        return new Response(
          JSON.stringify({ error: 'Server configuration error for password verification.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: website, error: fetchError } = await supabaseAdmin
        .from('collection_websites')
        .select('password_hash')
        .eq('slug', payload.slug)
        .eq('is_active', true) // Ensure website is active
        .single();

      if (fetchError) {
        console.error('Error fetching website for verification:', fetchError);
        return new Response(
          JSON.stringify({ error: 'Could not find website or database error.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!website || !website.password_hash) {
        console.log('Website not found or no password hash for slug:', payload.slug);
        // This case means the website is public or doesn't exist, client shouldn't have called verify.
        // However, respond politely.
        return new Response(
          JSON.stringify({ verified: false, error: 'Website is not password protected or not found.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const passwordsMatch = bcrypt.compareSync(payload.attemptedPassword, website.password_hash);
      console.log('Password comparison result:', passwordsMatch);

      if (passwordsMatch) {
        return new Response(
          JSON.stringify({ verified: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({ verified: false, error: 'Invalid password.' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } } // Status 200 for failed auth attempt, error in body
        );
      }
    } 
    // HASH MODE
    else if (payload.password && typeof payload.password === 'string') {
      console.log('Entering hash mode.');
      if (payload.password.length === 0) {
         // Allow empty string to effectively remove password if client logic sends it for that purpose
        // In this mode, we just hash what's given. Client decides if empty string means "remove".
        // The update hook useUpdateCollectionWebsite handles `password: null` for removal.
        // This function only hashes.
        console.log('Password is an empty string, hashing it.');
      }
      
      const salt = bcrypt.genSaltSync(10);
      const hashedPassword = bcrypt.hashSync(payload.password, salt);
      console.log('Password hashed successfully');

      return new Response(
        JSON.stringify({ hashedPassword }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } 
    // INVALID PAYLOAD
    else {
      console.error('Invalid payload structure:', payload);
      return new Response(
        JSON.stringify({ error: 'Invalid request payload. Must provide either (slug and attemptedPassword) or (password).' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in hash-collection-password function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An unexpected error occurred.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
