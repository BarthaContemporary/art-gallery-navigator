import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
}

interface EnrichmentResult {
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  bio?: string;
  location?: string;
  profileUrl?: string;
  source: 'gravatar' | 'none';
}

async function md5Hash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('MD5', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
    
    console.log('Gravatar enrichment result:', result);
    return result;
  } catch (error) {
    console.error('Gravatar lookup error:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    
    if (!email || typeof email !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Enriching email: ${email}`);
    
    // Try Gravatar first (free, no API key needed)
    const gravatarResult = await lookupGravatar(email);
    
    if (gravatarResult) {
      return new Response(
        JSON.stringify(gravatarResult),
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
