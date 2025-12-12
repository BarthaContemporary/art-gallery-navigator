import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { name, birthDate, nationality, country } = await req.json();

    if (!name) {
      return new Response(
        JSON.stringify({ error: 'Name is required for sanctions check' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { key: apiKey, keyName } = getApiKey();
    if (!apiKey) {
      console.error(`${keyName} not configured`);
      return new Response(
        JSON.stringify({ 
          error: 'Sanctions check API not configured',
          checked: false 
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Checking sanctions for: ${name}`);

    // Build the query for OpenSanctions matching API
    const matchQuery: Record<string, string[]> = {
      schema: ['Person'],
      name: [name],
    };

    if (birthDate) {
      matchQuery.birthDate = [birthDate];
    }
    if (nationality) {
      matchQuery.nationality = [nationality];
    }
    if (country) {
      matchQuery.country = [country];
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

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
            error: 'Invalid API key or insufficient permissions',
            checked: false,
            api_error: true 
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ 
          error: `Sanctions API returned status ${response.status}`,
          checked: false,
          api_error: true 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('OpenSanctions response:', JSON.stringify(data));

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
        error: error instanceof Error ? error.message : 'Unknown error',
        checked: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
