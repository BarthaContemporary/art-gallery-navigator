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

    console.log("Searching LinkedIn profile for:", fullName, company, jobTitle);

    // Build search query for LinkedIn profiles
    let searchQuery = `site:linkedin.com/in "${fullName}"`;
    if (company) {
      searchQuery += ` "${company}"`;
    }
    if (jobTitle) {
      searchQuery += ` "${jobTitle}"`;
    }

    // Use DuckDuckGo HTML search (no API key needed) as a fallback
    // This is a simple approach that doesn't require additional secrets
    const duckDuckGoUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;
    
    console.log("Search URL:", duckDuckGoUrl);

    const response = await fetch(duckDuckGoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    if (!response.ok) {
      console.log("Search request failed:", response.status);
      throw new Error("Search request failed");
    }

    const html = await response.text();
    
    // Parse search results for LinkedIn profile URLs
    const profiles: LinkedInProfile[] = [];
    
    // Match LinkedIn profile URLs and their context
    const linkedInRegex = /href="(https?:\/\/(www\.)?linkedin\.com\/in\/[^"\/]+\/?)[^"]*"[^>]*>([^<]*)<\/a>/gi;
    const matches = html.matchAll(linkedInRegex);
    
    const seenUrls = new Set<string>();
    
    for (const match of matches) {
      const url = match[1].replace(/\/+$/, ''); // Clean trailing slashes
      const linkText = match[3];
      
      // Skip if we've seen this URL
      if (seenUrls.has(url)) continue;
      seenUrls.add(url);
      
      // Extract name from URL or link text
      const urlHandle = url.split('/in/')[1]?.replace(/-/g, ' ') || '';
      const displayName = linkText || urlHandle;
      
      // Try to find the snippet/description near this result
      const snippetMatch = html.match(new RegExp(`${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^<]*<[^>]*>[^<]*<[^>]*class="result__snippet"[^>]*>([^<]+)`, 'i'));
      const snippet = snippetMatch ? snippetMatch[1].trim() : undefined;
      
      profiles.push({
        name: displayName.trim() || 'LinkedIn Profile',
        profileUrl: url,
        headline: snippet,
        snippet: snippet,
      });
      
      // Limit to 5 results
      if (profiles.length >= 5) break;
    }
    
    // Alternative parsing for DuckDuckGo results
    if (profiles.length === 0) {
      // Try to find result blocks
      const resultBlockRegex = /<a[^>]*href="[^"]*linkedin\.com\/in\/([^"\/]+)[^"]*"[^>]*>[\s\S]*?<\/a>/gi;
      const blockMatches = html.matchAll(resultBlockRegex);
      
      for (const match of blockMatches) {
        const handle = match[1];
        const url = `https://www.linkedin.com/in/${handle}`;
        
        if (seenUrls.has(url)) continue;
        seenUrls.add(url);
        
        const displayName = handle.replace(/-/g, ' ');
        
        profiles.push({
          name: displayName.charAt(0).toUpperCase() + displayName.slice(1),
          profileUrl: url,
        });
        
        if (profiles.length >= 5) break;
      }
    }

    console.log(`Found ${profiles.length} LinkedIn profiles`);

    return new Response(
      JSON.stringify({ profiles }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error searching LinkedIn profiles:", error);
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
