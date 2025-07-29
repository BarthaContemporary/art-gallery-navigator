import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { from, to } = await req.json();

    if (!from || !to) {
      return new Response(
        JSON.stringify({ error: 'Missing from or to currency' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (from === to) {
      return new Response(
        JSON.stringify({ rate: 1 }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for cached rate that hasn't expired
    const { data: cached } = await supabase
      .from('exchange_rates')
      .select('rate, expires_at')
      .eq('base_currency', from)
      .eq('target_currency', to)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (cached) {
      console.log(`Using cached rate for ${from} to ${to}: ${cached.rate}`);
      return new Response(
        JSON.stringify({ rate: cached.rate }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch fresh rate from external API
    console.log(`Fetching fresh rate for ${from} to ${to}`);
    const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${from}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch exchange rate');
    }

    const data = await response.json();
    const rate = data.rates[to];

    if (!rate) {
      throw new Error(`Exchange rate not found for ${to}`);
    }

    // Cache the rate for 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    
    await supabase
      .from('exchange_rates')
      .upsert({
        base_currency: from,
        target_currency: to,
        rate: rate,
        expires_at: expiresAt,
        fetched_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'base_currency,target_currency'
      });

    console.log(`Cached fresh rate for ${from} to ${to}: ${rate}`);

    return new Response(
      JSON.stringify({ rate }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in exchange-rates function:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});