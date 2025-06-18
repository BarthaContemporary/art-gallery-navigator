
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

    // Extract LinkedIn username from various URL formats
    const linkedinUsername = extractLinkedInUsername(profileUrl);
    if (!linkedinUsername) {
      throw new Error("Invalid LinkedIn profile URL");
    }

    // Use LinkedIn's public profile image endpoint (limited but doesn't require API key)
    const imageUrl = `https://media.licdn.com/dms/image/v2/profileImage/${linkedinUsername}/profileImage/displayImage/`;
    
    // Verify the image exists by making a HEAD request
    const imageResponse = await fetch(imageUrl, { method: 'HEAD' });
    
    if (imageResponse.ok) {
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

function extractLinkedInUsername(url: string): string | null {
  const patterns = [
    /linkedin\.com\/in\/([^\/\?]+)/,
    /linkedin\.com\/pub\/([^\/\?]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

serve(handler);
