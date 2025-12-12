import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

interface GravatarProfile {
  displayName?: string;
  name?: {
    givenName?: string;
    familyName?: string;
    formatted?: string;
  };
  aboutMe?: string;
  currentLocation?: string;
  urls?: Array<{ value: string; title?: string }>;
  accounts?: Array<{ shortname: string; url: string; username?: string }>;
}

interface EnrichmentResult {
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  bio?: string;
  location?: string;
  profileUrl?: string;
  instagram_handle?: string;
  linkedin_handle?: string;
  linkedin_url?: string;
  instagram_search_url?: string;
  source: 'gravatar' | 'hunter' | 'combined' | 'none';
}

async function md5Hash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('MD5', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function extractInstagramHandle(urls?: Array<{ value: string; title?: string }>, accounts?: Array<{ shortname: string; url: string; username?: string }>): string | undefined {
  // Check accounts array first (more reliable)
  if (accounts) {
    const igAccount = accounts.find(a => a.shortname === 'instagram');
    if (igAccount?.username) return igAccount.username;
    if (igAccount?.url) {
      const match = igAccount.url.match(/instagram\.com\/([^\/\?]+)/i);
      if (match) return match[1];
    }
  }
  
  // Check URLs array
  if (urls) {
    for (const url of urls) {
      const match = url.value.match(/instagram\.com\/([^\/\?]+)/i);
      if (match) return match[1];
    }
  }
  
  return undefined;
}

function extractLinkedInHandle(urls?: Array<{ value: string; title?: string }>, accounts?: Array<{ shortname: string; url: string; username?: string }>): string | undefined {
  // Check accounts array first
  if (accounts) {
    const liAccount = accounts.find(a => a.shortname === 'linkedin');
    if (liAccount?.username) return liAccount.username;
    if (liAccount?.url) {
      const match = liAccount.url.match(/linkedin\.com\/in\/([^\/\?]+)/i);
      if (match) return match[1];
      return liAccount.url;
    }
  }
  
  // Check URLs array
  if (urls) {
    for (const url of urls) {
      const match = url.value.match(/linkedin\.com\/in\/([^\/\?]+)/i);
      if (match) return match[1];
      if (url.value.includes('linkedin.com')) return url.value;
    }
  }
  
  return undefined;
}

async function lookupGravatar(email: string): Promise<EnrichmentResult | null> {
  try {
    const hash = await md5Hash(email);
    const url = `https://www.gravatar.com/${hash}.json`;
    
    console.log(`Looking up Gravatar for hash: ${hash}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'CRM-Email-Enrichment/1.0',
      },
    });
    
    if (response.status === 404) {
      console.log('No Gravatar profile found');
      return null;
    }
    
    if (!response.ok) {
      console.error(`Gravatar API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const profile: GravatarProfile = data.entry?.[0];
    
    if (!profile) {
      return null;
    }
    
    const result: EnrichmentResult = {
      email,
      source: 'gravatar',
      profileUrl: `https://gravatar.com/${hash}`,
    };
    
    // Extract name
    if (profile.name?.formatted) {
      result.fullName = profile.name.formatted;
    } else if (profile.displayName) {
      result.fullName = profile.displayName;
    }
    
    if (profile.name?.givenName) {
      result.firstName = profile.name.givenName;
    }
    
    if (profile.name?.familyName) {
      result.lastName = profile.name.familyName;
    }
    
    // If we have fullName but not first/last, try to split
    if (result.fullName && !result.firstName && !result.lastName) {
      const parts = result.fullName.trim().split(/\s+/);
      if (parts.length >= 2) {
        result.firstName = parts[0];
        result.lastName = parts.slice(1).join(' ');
      } else if (parts.length === 1) {
        result.firstName = parts[0];
      }
    }
    
    if (profile.aboutMe) {
      result.bio = profile.aboutMe;
    }
    
    if (profile.currentLocation) {
      result.location = profile.currentLocation;
    }
    
    // Extract social handles
    const instagram = extractInstagramHandle(profile.urls, profile.accounts);
    if (instagram) {
      result.instagram_handle = instagram;
    }
    
    const linkedin = extractLinkedInHandle(profile.urls, profile.accounts);
    if (linkedin) {
      result.linkedin_handle = linkedin;
    }
    
    console.log('Gravatar enrichment result:', result);
    return result;
  } catch (error) {
    console.error('Gravatar lookup error:', error);
    return null;
  }
}

async function lookupHunterLinkedIn(email: string): Promise<{ linkedin_url?: string; linkedin_handle?: string; firstName?: string; lastName?: string } | null> {
  try {
    const hunterApiKey = Deno.env.get('HUNTER_API_KEY');
    if (!hunterApiKey) {
      console.log('HUNTER_API_KEY not configured, skipping Hunter.io lookup');
      return null;
    }

    console.log('Looking up LinkedIn via Hunter.io');
    
    const response = await fetch(
      `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${hunterApiKey}`
    );

    if (!response.ok) {
      console.error('Hunter.io API error:', response.status);
      return null;
    }

    const hunterData = await response.json();
    const data = hunterData.data;
    
    console.log('Hunter.io sources:', JSON.stringify(data?.sources));
    
    // Extract LinkedIn from sources
    if (data?.sources && Array.isArray(data.sources)) {
      for (const source of data.sources) {
        if (source.uri?.includes('linkedin.com')) {
          const linkedinUrl = source.uri;
          const match = linkedinUrl.match(/linkedin\.com\/in\/([^\/\?]+)/i);
          return {
            linkedin_url: linkedinUrl,
            linkedin_handle: match ? match[1] : undefined,
          };
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Hunter.io lookup error:', error);
    return null;
  }
}

function generateInstagramSearchUrl(name: string): string {
  // Generate Instagram search URL for manual lookup
  const cleanName = name.trim().replace(/\s+/g, '%20');
  return `https://www.instagram.com/explore/search/keyword/?q=${cleanName}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
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
    
    console.log(`Authenticated user ${authResult.user.id} requesting email enrichment`);

    const { email } = await req.json();
    
    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Enriching email: ${email}`);
    
    // Run lookups in parallel
    const [gravatarResult, hunterResult] = await Promise.all([
      lookupGravatar(email),
      lookupHunterLinkedIn(email),
    ]);
    
    // Combine results
    if (gravatarResult || hunterResult) {
      const result: EnrichmentResult = {
        email,
        source: gravatarResult && hunterResult ? 'combined' : (gravatarResult ? 'gravatar' : 'hunter'),
        ...(gravatarResult || {}),
      };
      
      // Add Hunter.io LinkedIn data if not already present from Gravatar
      if (hunterResult) {
        if (!result.linkedin_handle && hunterResult.linkedin_handle) {
          result.linkedin_handle = hunterResult.linkedin_handle;
        }
        if (!result.linkedin_url && hunterResult.linkedin_url) {
          result.linkedin_url = hunterResult.linkedin_url;
        }
      }
      
      // Generate Instagram search URL if we have a name but no Instagram handle
      if (result.fullName && !result.instagram_handle) {
        result.instagram_search_url = generateInstagramSearchUrl(result.fullName);
      }
      
      return new Response(
        JSON.stringify(result),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // No enrichment found
    return new Response(
      JSON.stringify({
        email,
        source: 'none',
        message: 'No profile found for this email',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Email enrichment error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
