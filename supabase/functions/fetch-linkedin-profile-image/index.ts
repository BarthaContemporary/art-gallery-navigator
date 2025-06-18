
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface LinkedInProfileRequest {
  profileUrl: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profileUrl }: LinkedInProfileRequest = await req.json();
    
    if (!profileUrl) {
      throw new Error("Profile URL is required");
    }

    console.log("Fetching LinkedIn profile image for:", profileUrl);

    // Try to scrape the profile page for Open Graph image
    const response = await fetch(profileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    if (!response.ok) {
      throw new Error("Profile not found or inaccessible");
    }

    const html = await response.text();
    
    // Look for Open Graph image meta tag
    const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"[^>]*>/i);
    let imageUrl = ogImageMatch ? ogImageMatch[1] : null;

    // Also try to find profile image in the page content
    if (!imageUrl) {
      const profileImageMatch = html.match(/profile-photo-[^"]*"[^>]*src="([^"]*)"[^>]*/i);
      imageUrl = profileImageMatch ? profileImageMatch[1] : null;
    }

    // Try another pattern for LinkedIn profile images
    if (!imageUrl) {
      const linkedinImageMatch = html.match(/https:\/\/media\.licdn\.com\/dms\/image\/[^"\\s]+/g);
      if (linkedinImageMatch && linkedinImageMatch.length > 0) {
        imageUrl = linkedinImageMatch[0];
      }
    }
    
    if (imageUrl) {
      console.log("Found LinkedIn image:", imageUrl);
      return new Response(JSON.stringify({ imageUrl }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    } else {
      throw new Error("Profile image not found");
    }
  } catch (error: any) {
    console.error("Error fetching LinkedIn profile image:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
