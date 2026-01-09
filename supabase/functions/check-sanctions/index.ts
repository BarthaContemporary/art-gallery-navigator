import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SanctionsMatch {
  id: string;
  caption: string;
  schema: string;
  score: number;
  match: boolean;
  datasets: string[];
  properties: Record<string, string[]>;
}

// Input validation constants
const MAX_NAME_LENGTH = 200;
const MAX_FIELD_LENGTH = 100;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Note: OpenSanctions is migrating gb_hmt_sanctions -> gb_fcdo_sanctions on January 28, 2026
// This is handled automatically by OpenSanctions API - no code changes required

// Function to get the appropriate API key based on date
// Key 1 expires January 11, 2026 - Key 2 activates January 12, 2026
function getApiKey(): { key: string | null; keyName: string } {
  const switchDate = new Date('2026-01-12T00:00:00Z');
  const now = new Date();
  
  if (now >= switchDate) {
    const key2 = Deno.env.get('OPENSANCTIONS_API_KEY_2');
    if (key2) {
      console.log('Using OPENSANCTIONS_API_KEY_2 (activated Jan 12, 2026)');
      return { key: key2, keyName: 'OPENSANCTIONS_API_KEY_2' };
    }
    console.warn('OPENSANCTIONS_API_KEY_2 not found, falling back to primary key');
  }
  
  const key1 = Deno.env.get('OPENSANCTIONS_API_KEY');
  console.log('Using OPENSANCTIONS_API_KEY (primary key, valid until Jan 11, 2026)');
  return { key: key1 || null, keyName: 'OPENSANCTIONS_API_KEY' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Authentication failed:', authError?.message || 'Invalid token');
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Authenticated user: ${user.id}`);

    const { name, birthDate, nationality, country } = await req.json();

    // Input validation
    if (!name) {
      return new Response(
        JSON.stringify({ error: 'Name is required for sanctions check' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (typeof name !== 'string' || name.length > MAX_NAME_LENGTH) {
      return new Response(
        JSON.stringify({ error: 'Invalid name format or length' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (birthDate && (typeof birthDate !== 'string' || !DATE_REGEX.test(birthDate))) {
      return new Response(
        JSON.stringify({ error: 'Invalid birth date format. Use YYYY-MM-DD' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (nationality && (typeof nationality !== 'string' || nationality.length > MAX_FIELD_LENGTH)) {
      return new Response(
        JSON.stringify({ error: 'Invalid nationality format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (country && (typeof country !== 'string' || country.length > MAX_FIELD_LENGTH)) {
      return new Response(
        JSON.stringify({ error: 'Invalid country format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { key: apiKey, keyName } = getApiKey();
    if (!apiKey) {
      console.error(`${keyName} not configured`);
      return new Response(
        JSON.stringify({ 
          error: 'Sanctions check service not configured',
          checked: false 
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Checking sanctions for: ${name}`);

    // Build the query for OpenSanctions matching API
    const matchQuery: Record<string, string[]> = {
      schema: ['Person'],
      name: [name.trim()],
    };

    if (birthDate) {
      matchQuery.birthDate = [birthDate];
    }
    if (nationality) {
      matchQuery.nationality = [nationality.trim()];
    }
    if (country) {
      matchQuery.country = [country.trim()];
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    // Use the default dataset which includes all sanctions lists
    const response = await fetch('https://api.opensanctions.org/match/default', {
      method: 'POST',
      headers: {
        'Authorization': `ApiKey ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        queries: {
          contact_check: {
            schema: 'Person',
            properties: matchQuery,
          },
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log(`OpenSanctions API response status: ${response.status}`);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`OpenSanctions API error ${response.status}: ${errorBody}`);
      
      if (response.status === 401 || response.status === 403) {
        return new Response(
          JSON.stringify({ 
            error: 'Sanctions check service authentication failed',
            checked: false,
            api_error: true 
          }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          error: 'Sanctions check service temporarily unavailable',
          checked: false,
          api_error: true 
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('OpenSanctions response received');

    // Process the results
    const results = data.responses?.contact_check?.results || [];
    const matches: SanctionsMatch[] = results
      .filter((r: any) => r.score >= 0.7) // Only include matches with 70%+ confidence
      .map((r: any) => ({
        id: r.id,
        caption: r.caption,
        schema: r.schema,
        score: r.score,
        match: r.match,
        datasets: r.datasets || [],
        properties: r.properties || {},
      }));

    const hasMatches = matches.length > 0;
    const highConfidenceMatch = matches.some((m: SanctionsMatch) => m.score >= 0.9);

    return new Response(
      JSON.stringify({
        checked: true,
        checked_at: new Date().toISOString(),
        name_checked: name,
        has_matches: hasMatches,
        high_confidence_match: highConfidenceMatch,
        match_count: matches.length,
        matches: matches.slice(0, 10), // Limit to 10 matches
        risk_level: highConfidenceMatch ? 'high' : (hasMatches ? 'medium' : 'clear'),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('OpenSanctions API request timed out');
      return new Response(
        JSON.stringify({ 
          error: 'Sanctions check timed out',
          checked: false,
          api_error: true 
        }),
        { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.error('Error in check-sanctions:', error);
    return new Response(
      JSON.stringify({ 
        error: 'An unexpected error occurred',
        checked: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
