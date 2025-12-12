import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SearchRequest {
  fullName: string;
  company?: string;
  jobTitle?: string;
}

interface LinkedInProfile {
  name: string;
  profileUrl: string;
  headline?: string;
  snippet?: string;
  isGenerated?: boolean;
}

async function verifyAuth(req: Request): Promise<{ user: any } | { error: string; status: number }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return { error: 'Unauthorized', status: 401 };
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    return { error: 'Invalid token', status: 401 };
  }

  return { user };
}

// Generate common LinkedIn URL patterns from a name
function generateLinkedInPatterns(fullName: string): string[] {
  const name = fullName.toLowerCase().trim();
  const parts = name.split(/\s+/).filter(p => p.length > 0);
  
  if (parts.length === 0) return [];
  
  const patterns: string[] = [];
  
  if (parts.length === 1) {
    // Single name
    patterns.push(parts[0]);
  } else if (parts.length === 2) {
    const [first, last] = parts;
    // Common patterns for two-part names
    patterns.push(`${first}-${last}`);           // john-doe
    patterns.push(`${first}${last}`);            // johndoe
    patterns.push(`${last}-${first}`);           // doe-john
    patterns.push(`${first[0]}${last}`);         // jdoe
    patterns.push(`${first}${last[0]}`);         // johnd
    patterns.push(`${first}-${last}-`);          // john-doe- (with suffix numbers often)
  } else {
    // Three or more parts
    const first = parts[0];
    const last = parts[parts.length - 1];
    const middle = parts.slice(1, -1).join('-');
    
    patterns.push(`${first}-${last}`);                    // first-last
    patterns.push(`${first}-${middle}-${last}`);          // first-middle-last
    patterns.push(parts.join('-'));                       // all-parts
    patterns.push(`${first}${last}`);                     // firstlast
    patterns.push(`${first[0]}${last}`);                  // flast
  }
  
  // Remove duplicates and invalid patterns
  return [...new Set(patterns)].filter(p => p.length > 2);
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authResult = await verifyAuth(req);
    if ('error' in authResult) {
      console.log('Authentication failed:', authResult.error);
      return new Response(
        JSON.stringify({ error: authResult.error }),
        { status: authResult.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { fullName, company, jobTitle }: SearchRequest = await req.json();
    
    if (!fullName) {
      throw new Error("Full name is required");
    }

    console.log("Generating LinkedIn profile suggestions for:", fullName);

    // Generate potential LinkedIn URL patterns
    const patterns = generateLinkedInPatterns(fullName);
    
    const profiles: LinkedInProfile[] = patterns.map(pattern => ({
      name: fullName,
      profileUrl: `https://www.linkedin.com/in/${pattern}`,
      headline: company || jobTitle ? `${jobTitle || ''} ${company ? `at ${company}` : ''}`.trim() : undefined,
      snippet: `Suggested profile based on name: ${pattern}`,
      isGenerated: true,
    }));

    // Also add a Google search link as the first option
    const googleSearchUrl = `https://www.google.com/search?q=site:linkedin.com/in+${encodeURIComponent(`"${fullName}"`)}${company ? `+${encodeURIComponent(company)}` : ''}`;
    
    profiles.unshift({
      name: `Search Google for "${fullName}"`,
      profileUrl: googleSearchUrl,
      headline: 'Open Google to find the exact LinkedIn profile',
      snippet: 'Click to search Google for LinkedIn profiles matching this name',
      isGenerated: false,
    });

    console.log(`Generated ${profiles.length} suggestions`);

    return new Response(
      JSON.stringify({ profiles, googleSearchUrl }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error generating LinkedIn suggestions:", error);
    return new Response(
      JSON.stringify({ error: error.message, profiles: [] }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
