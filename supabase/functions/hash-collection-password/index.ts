
import 'https://deno.land/x/xhr@0.1.0/mod.ts'; // Required for Supabase client
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Or specific origins
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log('hash-collection-password function initializing');

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('OPTIONS request received');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing POST request');
    const { password } = await req.json();

    if (!password || typeof password !== 'string' || password.length === 0) {
      console.error('Password is required and must be a non-empty string');
      return new Response(
        JSON.stringify({ error: 'Password is required and must be a non-empty string.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    console.log('Password hashed successfully');

    return new Response(
      JSON.stringify({ hashedPassword }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in hash-collection-password function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to hash password.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

